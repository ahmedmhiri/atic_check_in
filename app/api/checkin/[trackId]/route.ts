import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/guard";
import { isUniqueViolation, str } from "@/lib/body";
import { isSlotOpen } from "@/lib/slot-window";
import { formatEventTime } from "@/lib/time";
import { isAdminOrAbove } from "@/lib/accounts";

export const runtime = "nodejs";

const GRACE_MINUTES = 15;

// POST /api/checkin/[trackId]
// body: { qrToken, timeSlotId, sessionOccurrenceId }
export async function POST(
  req: NextRequest,
  { params }: { params: { trackId: string } }
) {
  let session;
  try {
    session = await requireStaff();
  } catch (r) {
    return r as Response;
  }

  const { trackId } = params;

  // Volunteers locked to a track can only record attendance for that track.
  const lockedTrack = session.user.role === "SCANNER" ? session.user.assignedTrackId : null;
  if (lockedTrack && lockedTrack !== trackId) {
    return NextResponse.json(
      { status: "rejected", message: "Your volunteer account is assigned to a different track" },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const qrToken = str(body.qrToken);
  const timeSlotId = str(body.timeSlotId);
  const sessionOccurrenceId = str(body.sessionOccurrenceId);

  if (!qrToken || !timeSlotId || !sessionOccurrenceId) {
    return NextResponse.json(
      { status: "error", message: "Missing qrToken, timeSlotId, or sessionOccurrenceId" },
      { status: 400 }
    );
  }

  // Validate the session occurrence belongs to this track + slot.
  const occ = await prisma.sessionOccurrence.findUnique({
    where: { id: sessionOccurrenceId },
    include: { track: true, timeSlot: true },
  });
  if (!occ || occ.trackId !== trackId || occ.timeSlotId !== timeSlotId) {
    return NextResponse.json(
      { status: "error", message: "Session/track/slot mismatch" },
      { status: 400 }
    );
  }

  // Volunteers can only record a slot while it is running (the page only warns;
  // this is the real check). Admins may record outside it to fix a missed scan.
  if (!isAdminOrAbove(session.user.role) && !isSlotOpen(occ.timeSlot.startTime, occ.timeSlot.endTime)) {
    return NextResponse.json(
      {
        status: "rejected",
        message: `${occ.timeSlot.label} is not open for scanning (${formatEventTime(occ.timeSlot.startTime)} – ${formatEventTime(occ.timeSlot.endTime)})`,
      },
      { status: 403 }
    );
  }

  // No opening ceremony gate: a student who skipped the opening can still
  // attend the workshops.
  const student = await prisma.student.findUnique({ where: { qrToken } });
  if (!student) {
    return NextResponse.json({ status: "error", message: "Invalid QR — student not found" }, { status: 404 });
  }

  // Determine LATE vs PRESENT.
  const now = new Date();
  const graceCutoff = new Date(occ.timeSlot.startTime.getTime() + GRACE_MINUTES * 60_000);
  const status = now > graceCutoff ? "LATE" : "PRESENT";

  // No interactive transaction on purpose: with the pooled connection
  // (connection_limit=1) a transaction holds the only connection, and a burst
  // of simultaneous scans timed out waiting for it (P2028). Each step below is
  // a single query; the unique indexes settle any race between two scanners.
  const scan = async () => {
    const selWhere = { studentId_timeSlotId: { studentId: student.id, timeSlotId } };
    const selection = await prisma.slotSelection.findUnique({ where: selWhere, include: { track: true } });
    if (selection && selection.trackId !== trackId) {
      return { kind: "wrong_track" as const, otherTrack: selection.track.name };
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: { studentId_sessionOccurrenceId: { studentId: student.id, sessionOccurrenceId } },
      select: { id: true },
    });
    if (existing) return { kind: "duplicate" as const };

    // First scan in this slot locks the student to this track for this slot —
    // and, since students keep one track for the whole congress, for every
    // later slot they haven't chosen yet.
    if (!selection) {
      try {
        await prisma.slotSelection.create({ data: { studentId: student.id, timeSlotId, trackId } });
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        // Another scanner locked this slot a moment ago — maybe to another track.
        const winner = await prisma.slotSelection.findUnique({ where: selWhere, include: { track: true } });
        if (winner && winner.trackId !== trackId) return { kind: "wrong_track" as const, otherTrack: winner.track.name };
      }
      const later = await prisma.timeSlot.findMany({
        where: { startTime: { gt: occ.timeSlot.startTime } },
        select: { id: true },
      });
      await prisma.slotSelection.createMany({
        data: later.map((s) => ({ studentId: student.id, timeSlotId: s.id, trackId })),
        skipDuplicates: true,
      });
    }

    let rec;
    try {
      rec = await prisma.attendanceRecord.create({ data: { studentId: student.id, sessionOccurrenceId, status } });
    } catch (e) {
      if (isUniqueViolation(e)) return { kind: "duplicate" as const }; // simultaneous re-scan
      throw e;
    }
    await prisma.student.update({ where: { id: student.id }, data: { currentTrackId: trackId } });
    return { kind: "recorded" as const, status: rec.status };
  };

  try {
    const result = await scan();

    const who = { id: student.id, name: student.name, studentId: student.studentId };

    if (result.kind === "wrong_track") {
      return NextResponse.json(
        {
          status: "rejected",
          message: `Student already chose ${result.otherTrack} for this time slot`,
          student: who,
        },
        { status: 409 }
      );
    }
    if (result.kind === "duplicate") {
      return NextResponse.json({
        status: "already",
        message: `${student.name} was already scanned for this session`,
        student: who,
      });
    }
    return NextResponse.json({
      status: "recorded",
      message: `${student.name} — ${result.status} in ${occ.track.name}`,
      attendanceStatus: result.status,
      student: who,
    });
  } catch (e) {
    console.error("workshop check-in failed", e);
    return NextResponse.json({ status: "error", message: "Server error — please scan again" }, { status: 500 });
  }
}
