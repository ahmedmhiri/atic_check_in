import { prisma } from "@/lib/prisma";
import { FatalEmailError } from "@/lib/email";

const SEND_DELAY_MS = 600; // ~1.6 req/sec, under Resend's default rate limit
const MAX_RETRIES = 2;
// Stop picking up new students after this long and let the client call again.
// Kept well under the smallest Vercel function limit (60s) so a batch never
// gets killed mid-send.
const TIME_BUDGET_MS = 40_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Student column that records "this email was sent" (also used as a claim while sending). */
export type SentField = "resultEmailSentAt" | "qrEmailSentAt";

export interface BatchStudent {
  id: string;
  studentId: string;
  name: string;
  email: string;
}

export interface BatchLogRow {
  id: string;
  studentId: string;
  name: string;
  email: string;
  status: "sent" | "failed";
  error?: string;
  messageId?: string;
}

/**
 * Send one time-boxed batch of emails.
 * Each student is claimed (field set) before sending, so re-running, double
 * clicks or two admins at once never email anyone twice. Failures release the
 * claim so a later run retries them. A FatalEmailError (bad login, daily quota)
 * stops the batch and is returned as `stopped`.
 */
export async function runEmailBatch<S extends BatchStudent, Extra extends object = {}>(opts: {
  field: SentField;
  students: S[];
  send: (s: S) => Promise<string | undefined>;
  /** Extra per-student columns for the log (e.g. attendance %). */
  describe?: (s: S) => Extra;
}): Promise<{ log: (BatchLogRow & Extra)[]; stopped?: string }> {
  const startedAt = Date.now();
  const log: (BatchLogRow & Extra)[] = [];
  let stopped: string | undefined;

  for (const s of opts.students) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    // Atomic claim: skip if someone else got there first.
    const claimed = await prisma.student.updateMany({
      where: { id: s.id, [opts.field]: null },
      data: { [opts.field]: new Date() },
    });
    if (claimed.count === 0) continue;

    let attempt = 0;
    let sent = false;
    let lastErr = "";
    let messageId: string | undefined;

    while (attempt <= MAX_RETRIES && !sent) {
      try {
        messageId = await opts.send(s);
        sent = true;
      } catch (e: any) {
        if (e instanceof FatalEmailError) {
          stopped = e.message;
          break;
        }
        lastErr = e?.message ?? "send error";
        attempt++;
        if (attempt <= MAX_RETRIES) await sleep(SEND_DELAY_MS * attempt); // backoff
      }
    }

    if (!sent) {
      // Release the claim; retried on the next run, not this one
      // (otherwise a hard failure would loop forever).
      await prisma.student.update({ where: { id: s.id }, data: { [opts.field]: null } });
    }

    // Not this student's fault — leave them out of the log so they aren't
    // marked failed/skipped for the rest of the run.
    if (stopped) break;

    log.push({
      id: s.id,
      studentId: s.studentId,
      name: s.name,
      email: s.email,
      status: sent ? "sent" : "failed",
      error: sent ? undefined : lastErr,
      messageId,
      ...((opts.describe?.(s) ?? {}) as Extra),
    });

    await sleep(SEND_DELAY_MS); // rate limit between students
  }

  return { log, stopped };
}

/** Parse the `{ skipIds }` body the batch client sends (ids that already failed this run). */
export async function readSkipIds(req: Request): Promise<string[]> {
  const body = await req.json().catch(() => ({}));
  return Array.isArray(body.skipIds) ? body.skipIds.filter((x: unknown) => typeof x === "string") : [];
}

/** Counts for the client loop: still to try this run, and emailed overall. */
export async function batchProgress(field: SentField, excludeIds: string[]) {
  const [remaining, alreadySent] = await Promise.all([
    prisma.student.count({ where: { [field]: null, id: { notIn: excludeIds } } }),
    prisma.student.count({ where: { [field]: { not: null } } }),
  ]);
  return { remaining, alreadySent };
}
