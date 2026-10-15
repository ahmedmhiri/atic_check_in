import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { emailConfigError, sendDayEmail } from "@/lib/email";
import { batchProgress, readSkipIds, runEmailBatch } from "@/lib/email-batch";
import { trackFormLink } from "@/lib/track-form";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/day-email { skipIds? }
// Email one batch of students the event-day email (track choice form link,
// QR code, program). Idempotent via Student.dayEmailSentAt; `remaining` > 0
// => call again.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const configError = emailConfigError();
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });
  if (!trackFormLink({ id: "check", email: "check" })) {
    return NextResponse.json(
      { error: "TRACK_FORM_URL is not set — add the Google Form's pre-filled link in Vercel first." },
      { status: 400 }
    );
  }

  const skipIds = await readSkipIds(req);
  const pending = await prisma.student.findMany({
    where: { dayEmailSentAt: null, id: { notIn: skipIds } },
    select: { id: true, name: true, email: true, studentId: true, qrToken: true },
    orderBy: { studentId: "asc" },
  });

  const { log, stopped } = await runEmailBatch({
    field: "dayEmailSentAt",
    students: pending,
    send: (s) =>
      sendDayEmail({ name: s.name, email: s.email, studentId: s.studentId, qrToken: s.qrToken, formUrl: trackFormLink(s)! }),
  });

  const failedIds = log.filter((l) => l.status === "failed").map((l) => l.id);
  const { remaining, alreadySent } = await batchProgress("dayEmailSentAt", [...skipIds, ...failedIds]);

  return NextResponse.json({
    summary: {
      processed: log.length,
      sent: log.length - failedIds.length,
      failed: failedIds.length,
      remaining,
      alreadySent,
      stopped,
    },
    log,
  });
}
