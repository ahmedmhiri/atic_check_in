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
        const { studentId, timeSlotId, trackId } = body;
        if (!studentId || !timeSlotId || !trackId)
          return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        const sel = await prisma.slotSelection.upsert({
          where: { studentId_timeSlotId: { studentId, timeSlotId } },
          update: { trackId, selectedAt: new Date() },
          create: { studentId, timeSlotId, trackId },
        });
        return NextResponse.json({ status: "ok", selection: sel });
      }

      case "addAttendance": {
        const { studentId, sessionOccurrenceId } = body;
        const status = body.status === "LATE" ? "LATE" : "PRESENT";
        if (!studentId || !sessionOccurrenceId)
          return NextResponse.json({ error: "Missing fields" }, { status: 400 });
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
