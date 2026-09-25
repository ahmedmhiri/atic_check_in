import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/timeslots -> all slots with their per-track session occurrences.
export async function GET() {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const slots = await prisma.timeSlot.findMany({
    orderBy: [{ day: "asc" }, { order: "asc" }],
    include: {
      sessions: {
        include: { track: true },
        orderBy: { track: { name: "asc" } },
      },
    },
  });

  return NextResponse.json({ slots });
}
