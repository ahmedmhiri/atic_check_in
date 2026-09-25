import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { sendResultEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 300; // allow long-running send loop (if platform permits)

const SEND_DELAY_MS = 600; // ~1.6 req/sec
const MAX_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST /api/finalize -> compute attendance %, email each student, return log.
export async function POST() {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const threshold = Number(process.env.ELIGIBILITY_THRESHOLD ?? 70);

  // total time slots in the event = denominator (track can differ per slot).
  const totalSlots = await prisma.timeSlot.count();
  if (totalSlots === 0) {
    return NextResponse.json({ error: "No time slots defined" }, { status: 400 });
  }

  const students = await prisma.student.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      studentId: true,
      _count: { select: { attendance: true } },
    },
    orderBy: { studentId: "asc" },
  });

  const log: {
    studentId: string;
    name: string;
    email: string;
    attendancePct: number;
    eligible: boolean;
    status: "sent" | "failed";
    error?: string;
    messageId?: string;
  }[] = [];

  for (const s of students) {
    const attended = s._count.attendance;
    const pct = Math.round((attended / totalSlots) * 100);
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

    log.push({
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

  const summary = {
    total: log.length,
    sent: log.filter((l) => l.status === "sent").length,
    failed: log.filter((l) => l.status === "failed").length,
    eligible: log.filter((l) => l.eligible).length,
    notEligible: log.filter((l) => !l.eligible).length,
  };

  return NextResponse.json({ summary, log });
}
