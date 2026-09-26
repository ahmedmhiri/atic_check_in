import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/guard";
import { isUniqueViolation, str } from "@/lib/body";
import { formatEventTime } from "@/lib/time";

export const runtime = "nodejs";

// POST { qrToken, roomNumber?, notes? }
export async function POST(req: NextRequest) {
  try {
    await requireStaff();
  } catch (r) {
    return r as Response;
  }

  const body = await req.json().catch(() => ({}));
  const qrToken = str(body.qrToken);
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

  const who = { id: student.id, name: student.name, studentId: student.studentId };
  const already = (at: Date) =>
    NextResponse.json({ status: "already", message: `Already checked in at ${formatEventTime(at)}`, student: who, checkedInAt: at });

  if (student.hotelCheckIn) return already(student.hotelCheckIn.checkedInAt);

  let checkIn;
  try {
    checkIn = await prisma.hotelCheckIn.create({
      data: { studentId: student.id, roomNumber: str(body.roomNumber) || null, notes: str(body.notes) || null },
    });
  } catch (e) {
    // Two scanners (or a double read) hit the same badge at once: the other one won.
    if (!isUniqueViolation(e)) throw e;
    const existing = await prisma.hotelCheckIn.findUnique({ where: { studentId: student.id } });
    return already(existing?.checkedInAt ?? new Date());
  }

  return NextResponse.json({
    status: "checked_in",
    message: `${student.name} checked in successfully`,
    student: who,
    checkedInAt: checkIn.checkedInAt,
  });
}
