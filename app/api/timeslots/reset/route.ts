import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";

export const runtime = "nodejs";

// POST /api/timeslots/reset
// Marks the start of a new time slot: every student is free to choose any
// track again, so Student.currentTrackId resets to null. Past SlotSelection
// and AttendanceRecord rows are preserved (history is per-slot).
export async function POST() {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const { count } = await prisma.student.updateMany({
    where: { currentTrackId: { not: null } },
    data: { currentTrackId: null },
  });

  return NextResponse.json({ status: "ok", reset: count });
}
