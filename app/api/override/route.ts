import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";

export const runtime = "nodejs";

// POST /api/override
// body: { action, ...payload }
// Supported actions:
//   reassignSlot     { studentId, timeSlotId, trackId }
//   addAttendance    { studentId, sessionOccurrenceId, status? }
//   deleteAttendance { attendanceRecordId }
//   setHotel         { studentId, checkedIn: boolean }
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  try {
    switch (action) {
      case "reassignSlot": {
        // trackId "" / null clears the slot (no track, no attendance).
        const { studentId, timeSlotId } = body;
        const trackId: string | null = body.trackId || null;
        if (!studentId || !timeSlotId)
          return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        const newOcc = trackId
          ? await prisma.sessionOccurrence.findUnique({
              where: { trackId_timeSlotId: { trackId, timeSlotId } },
            })
          : null;
        if (trackId && !newOcc)
          return NextResponse.json({ error: "No session for that track in this slot" }, { status: 400 });

        await prisma.$transaction(async (tx) => {
          // Attendance in this slot on any other track must follow the student,
          // otherwise the slot ends up with two records (or one on the wrong track).
          const stale = await tx.attendanceRecord.findMany({
            where: {
              studentId,
              sessionOccurrence: { timeSlotId },
              ...(newOcc ? { sessionOccurrenceId: { not: newOcc.id } } : {}),
            },
            orderBy: { checkedInAt: "asc" },
          });
          if (stale.length) {
            await tx.attendanceRecord.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
          }

          if (!trackId || !newOcc) {
            await tx.slotSelection.deleteMany({ where: { studentId, timeSlotId } });
            return;
          }

          await tx.slotSelection.upsert({
            where: { studentId_timeSlotId: { studentId, timeSlotId } },
            update: { trackId, selectedAt: new Date() },
            create: { studentId, timeSlotId, trackId },
          });
          if (stale.length) {
            const moved = stale[0];
            await tx.attendanceRecord.upsert({
              where: { studentId_sessionOccurrenceId: { studentId, sessionOccurrenceId: newOcc.id } },
              update: {},
              create: {
                studentId,
                sessionOccurrenceId: newOcc.id,
                status: moved.status,
                checkedInAt: moved.checkedInAt,
              },
            });
          }
        });
        return NextResponse.json({ status: "ok" });
      }

      case "addAttendance": {
        const { studentId, sessionOccurrenceId } = body;
        const status = body.status === "LATE" ? "LATE" : "PRESENT";
        if (!studentId || !sessionOccurrenceId)
          return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        const occ = await prisma.sessionOccurrence.findUnique({ where: { id: sessionOccurrenceId } });
        if (!occ) return NextResponse.json({ error: "Unknown session" }, { status: 400 });
        const clash = await prisma.attendanceRecord.findFirst({
          where: {
            studentId,
            sessionOccurrence: { timeSlotId: occ.timeSlotId },
            sessionOccurrenceId: { not: sessionOccurrenceId },
          },
        });
        if (clash)
          return NextResponse.json(
            { error: "Student already has attendance on another track in this slot" },
            { status: 409 }
          );
        const rec = await prisma.attendanceRecord.upsert({
          where: { studentId_sessionOccurrenceId: { studentId, sessionOccurrenceId } },
          update: { status },
          create: { studentId, sessionOccurrenceId, status },
        });
        return NextResponse.json({ status: "ok", record: rec });
      }

      case "deleteAttendance": {
        const { attendanceRecordId } = body;
        if (!attendanceRecordId)
          return NextResponse.json({ error: "Missing attendanceRecordId" }, { status: 400 });
        await prisma.attendanceRecord.delete({ where: { id: attendanceRecordId } });
        return NextResponse.json({ status: "ok" });
      }

      case "setHotel": {
        const { studentId, checkedIn } = body;
        if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
        if (checkedIn) {
          await prisma.hotelCheckIn.upsert({
            where: { studentId },
            update: {},
            create: { studentId },
          });
        } else {
          await prisma.hotelCheckIn.deleteMany({ where: { studentId } });
        }
        return NextResponse.json({ status: "ok" });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
