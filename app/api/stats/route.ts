import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stats -> live overview numbers for dashboards.
export async function GET() {
  try {
    await requireStaff();
  } catch (r) {
    return r as Response;
  }

  const [totalStudents, hotelCheckedIn, tracks] = await Promise.all([
    prisma.student.count(),
    prisma.hotelCheckIn.count(),
    prisma.track.findMany({
      select: { id: true, name: true, _count: { select: { currentStudents: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    totalStudents,
    hotelCheckedIn,
    notArrived: totalStudents - hotelCheckedIn,
    // currentStudents = students whose currentTrackId points here RIGHT NOW.
    perTrackCurrent: tracks.map((t) => ({ id: t.id, name: t.name, occupancy: t._count.currentStudents })),
  });
}
