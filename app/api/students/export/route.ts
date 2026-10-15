import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { qrPngBuffer } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/students/export -> .xlsx with one row per student: ID, name, email,
// the QR code as a picture in the sheet, the token it encodes and a link to
// the QR image (/q/<token>.png). exceljs because SheetJS CE can't embed images.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const students = await prisma.student.findMany({
    select: {
      name: true,
      email: true,
      studentId: true,
      qrToken: true,
      hotelCheckIn: { select: { id: true } },
      currentTrack: { select: { name: true } },
    },
    orderBy: { studentId: "asc" },
  });
  if (students.length === 0) {
    return NextResponse.json({ error: "No students to export" }, { status: 400 });
  }

  const base = (process.env.NEXTAUTH_URL?.replace(/\/+$/, "") || req.nextUrl.origin);
  const wb = new ExcelJS.Workbook();
  wb.creator = "ATIC 2.0 Check-In";
  const ws = wb.addWorksheet("Students", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Student ID", key: "studentId", width: 18 },
    { header: "Name", key: "name", width: 32 },
    { header: "Email", key: "email", width: 36 },
    { header: "QR code", key: "qr", width: 14 },
    { header: "QR token", key: "token", width: 36 },
    { header: "QR image link", key: "link", width: 30 },
    { header: "Opening check-in", key: "opening", width: 17 },
    { header: "Current track", key: "track", width: 30 },
  ];
  ws.getRow(1).font = { bold: true };

  const QR_PX = 90;
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const url = `${base}/q/${s.qrToken}.png`;
    const row = ws.addRow({
      studentId: s.studentId,
      name: s.name,
      email: s.email,
      token: s.qrToken,
      link: { text: "Open QR image", hyperlink: url },
      opening: s.hotelCheckIn ? "Yes" : "No",
      track: s.currentTrack?.name ?? "",
    });
    row.height = QR_PX * 0.75 + 6; // points; the picture is in pixels
    row.alignment = { vertical: "middle" };
    row.getCell("link").font = { color: { argb: "FF2A2FE0" }, underline: true };

    const img = wb.addImage({ buffer: (await qrPngBuffer(s.qrToken, 200)) as any, extension: "png" });
    ws.addImage(img, { tl: { col: 3.08, row: i + 1.04 }, ext: { width: QR_PX, height: QR_PX }, editAs: "oneCell" });
  }

  const buf = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="atic-students-${date}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
