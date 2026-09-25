import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { emailConfigError, sendResultEmail } from "@/lib/email";
import { attendedSlotCounts } from "@/lib/attendance";
import { batchProgress, readSkipIds, runEmailBatch } from "@/lib/email-batch";

export const runtime = "nodejs";
export const maxDuration = 300; // allow long-running send loop (if platform permits)

// POST /api/finalize -> email one batch of students not yet sent their result.
// Idempotent via Student.resultEmailSentAt (see runEmailBatch).
// Body `{ skipIds }` lists students that already failed in this run so the
// next batch doesn't retry them. Response `remaining` > 0 => call again.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const configError = emailConfigError();
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });

  const skipIds = await readSkipIds(req);
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
  const pctOf = (id: string) => Math.round(((attended.get(id) ?? 0) / totalSlots) * 100);

  const { log, stopped } = await runEmailBatch({
    field: "resultEmailSentAt",
    students: pending,
    send: (s) =>
      sendResultEmail({ name: s.name, email: s.email, attendancePct: pctOf(s.id) }, pctOf(s.id) >= threshold),
    describe: (s) => ({ attendancePct: pctOf(s.id), eligible: pctOf(s.id) >= threshold }),
  });

  const failedIds = log.filter((l) => l.status === "failed").map((l) => l.id);
  const { remaining, alreadySent } = await batchProgress("resultEmailSentAt", [...skipIds, ...failedIds]);

  const summary = {
    processed: log.length,
    sent: log.length - failedIds.length,
    failed: failedIds.length,
    eligible: log.filter((l) => l.eligible).length,
    notEligible: log.filter((l) => !l.eligible).length,
    // Students still to try in this run (failures are excluded; re-run Finalize to retry them).
    remaining,
    alreadySent,
    stopped,
  };

  return NextResponse.json({ summary, log });
}
