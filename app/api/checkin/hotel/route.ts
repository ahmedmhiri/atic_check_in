import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";

export const runtime = "nodejs";

// POST { qrToken, roomNumber?, notes? }
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const body = await req.json().catch(() => ({}));
  const qrToken = (body.qrToken ?? "").trim();
  if (!qrToken) {
    return NextResponse.json({ error: "Missing qrToken" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { qrToken },
    include: { hotelCheckIn: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Invalid QR code — student not found" }, { status: 404 });
  }

  if (student.hotelCheckIn) {
    return NextResponse.json({
      status: "already",
      message: `Already checked in at ${student.hotelCheckIn.checkedInAt.toLocaleString()}`,
      student: { id: student.id, name: student.name, studentId: student.studentId },
      checkedInAt: student.hotelCheckIn.checkedInAt,
    });
  }

  const checkIn = await prisma.hotelCheckIn.create({
    data: {
      studentId: student.id,
      roomNumber: body.roomNumber?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  });

  return NextResponse.json({
    status: "checked_in",
    message: `${student.name} checked in successfully`,
    student: { id: student.id, name: student.name, studentId: student.studentId },
    checkedInAt: checkIn.checkedInAt,
  });
}
