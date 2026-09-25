import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { sendResultEmail } from "@/lib/email";
import { attendedSlotCounts } from "@/lib/attendance";

export const runtime = "nodejs";
export const maxDuration = 300; // allow long-running send loop (if platform permits)

const SEND_DELAY_MS = 600; // ~1.6 req/sec
const MAX_RETRIES = 2;
// Stop picking up new students after this long and let the client call again.
// Kept well under the smallest Vercel function limit (60s) so a batch never
// gets killed mid-send.
const TIME_BUDGET_MS = 40_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type LogRow = {
  id: string;
  studentId: string;
  name: string;
  email: string;
  attendancePct: number;
  eligible: boolean;
  status: "sent" | "failed";
  error?: string;
  messageId?: string;
};

// POST /api/finalize -> email one batch of not-yet-emailed students.
// Idempotent: each student is claimed (resultEmailSentAt) before sending, so
// re-running, double-clicking or two admins at once never email anyone twice.
// Body `{ skipIds }` lists students that already failed in this run so the
// next batch doesn't retry them. Response `remaining` > 0 => call again.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY is not set — no emails sent." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const skipIds: string[] = Array.isArray(body.skipIds) ? body.skipIds.filter((x: unknown) => typeof x === "string") : [];

  const startedAt = Date.now();
  const threshold = Number(process.env.ELIGIBILITY_THRESHOLD ?? 70);

  // total time slots in the event = denominator (track can differ per slot).
  const totalSlots = await prisma.timeSlot.count();
  if (totalSlots === 0) {
    return NextResponse.json({ error: "No time slots defined" }, { status: 400 });
  }

  const pending = await prisma.student.findMany({
    where: { resultEmailSentAt: null, id: { notIn: skipIds } },
    select: { id: true, name: true, email: true, studentId: true },
    orderBy: { studentId: "asc" },
  });
  const attended = await attendedSlotCounts(pending.map((s) => s.id));

  const log: LogRow[] = [];

  for (const s of pending) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    // Atomic claim: skip if someone else got there first.
    const claimed = await prisma.student.updateMany({
      where: { id: s.id, resultEmailSentAt: null },
      data: { resultEmailSentAt: new Date() },
    });
    if (claimed.count === 0) continue;

    const pct = Math.round(((attended.get(s.id) ?? 0) / totalSlots) * 100);
    const eligible = pct >= threshold;

    let attempt = 0;
    let sent = false;
    let lastErr = "";
    let messageId: string | undefined;

    while (attempt <= MAX_RETRIES && !sent) {
      try {
        messageId = await sendResultEmail(
          { name: s.name, email: s.email, attendancePct: pct },
          eligible
        );
        sent = true;
      } catch (e: any) {
        lastErr = e?.message ?? "send error";
        attempt++;
        if (attempt <= MAX_RETRIES) await sleep(SEND_DELAY_MS * attempt); // backoff
      }
    }

    if (!sent) {
      // Release the claim; failed students are retried on the next Finalize run,
      // not in this one (otherwise a hard failure would loop forever).
      await prisma.student.update({ where: { id: s.id }, data: { resultEmailSentAt: null } });
    }

    log.push({
      id: s.id,
      studentId: s.studentId,
      name: s.name,
      email: s.email,
      attendancePct: pct,
      eligible,
      status: sent ? "sent" : "failed",
      error: sent ? undefined : lastErr,
      messageId,
    });

    await sleep(SEND_DELAY_MS); // rate limit between students
  }

  const failedIds = log.filter((l) => l.status === "failed").map((l) => l.id);
  const [remainingTotal, alreadySent] = await Promise.all([
    prisma.student.count({ where: { resultEmailSentAt: null, id: { notIn: [...skipIds, ...failedIds] } } }),
    prisma.student.count({ where: { resultEmailSentAt: { not: null } } }),
  ]);

  const summary = {
    processed: log.length,
    sent: log.filter((l) => l.status === "sent").length,
    failed: failedIds.length,
    eligible: log.filter((l) => l.eligible).length,
    notEligible: log.filter((l) => !l.eligible).length,
    // Students still to try in this run (failures are excluded; re-run Finalize to retry them).
    remaining: remainingTotal,
    alreadySent,
  };

  return NextResponse.json({ summary, log });
}
