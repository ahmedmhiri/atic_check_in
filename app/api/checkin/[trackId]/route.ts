import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/guard";

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
  const qrToken = (body.qrToken ?? "").trim();
  const timeSlotId = (body.timeSlotId ?? "").trim();
  const sessionOccurrenceId = (body.sessionOccurrenceId ?? "").trim();

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

  // Look up student and hotel status.
  const student = await prisma.student.findUnique({
    where: { qrToken },
    include: { hotelCheckIn: true },
  });
  if (!student) {
    return NextResponse.json({ status: "error", message: "Invalid QR — student not found" }, { status: 404 });
  }

  // Stage 1 gate: must have hotel check-in first.
  if (!student.hotelCheckIn) {
    return NextResponse.json(
      { status: "rejected", message: `${student.name} has not completed hotel check-in yet` },
      { status: 409 }
    );
  }

  // Determine LATE vs PRESENT.
  const now = new Date();
  const graceCutoff = new Date(occ.timeSlot.startTime.getTime() + GRACE_MINUTES * 60_000);
  const status = now > graceCutoff ? "LATE" : "PRESENT";

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Existing slot selection for this (student, timeSlot)?
      const selection = await tx.slotSelection.findUnique({
        where: { studentId_timeSlotId: { studentId: student.id, timeSlotId } },
        include: { track: true },
      });

      if (selection && selection.trackId !== trackId) {
        return {
          kind: "wrong_track" as const,
          otherTrack: selection.track.name,
        };
      }

      // No selection yet -> lock student to this track FOR THIS SLOT.
      if (!selection) {
        await tx.slotSelection.create({
          data: { studentId: student.id, timeSlotId, trackId },
        });
        await tx.student.update({
          where: { id: student.id },
          data: { currentTrackId: trackId },
        });
      } else {
        // Matches this track — keep currentTrackId in sync.
        await tx.student.update({
          where: { id: student.id },
          data: { currentTrackId: trackId },
        });
      }

      // Record attendance (unique per student+occurrence).
      try {
        const rec = await tx.attendanceRecord.create({
          data: { studentId: student.id, sessionOccurrenceId, status },
        });
        return { kind: "recorded" as const, status: rec.status };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return { kind: "duplicate" as const };
        }
        throw e;
      }
    });

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
  } catch (e: any) {
    return NextResponse.json({ status: "error", message: e?.message ?? "Server error" }, { status: 500 });
  }
}
