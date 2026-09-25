import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { qrPngBuffer } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/qr  -> ZIP of PNG QR codes, one per student.
export async function GET() {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const students = await prisma.student.findMany({
    select: { name: true, studentId: true, qrToken: true },
    orderBy: { studentId: "asc" },
  });

  if (students.length === 0) {
    return NextResponse.json({ error: "No students to export" }, { status: 400 });
  }

  const zip = new JSZip();
  for (const s of students) {
    const png = await qrPngBuffer(s.qrToken);
    const safe = `${s.studentId}_${s.name}`.replace(/[^a-z0-9_\-]+/gi, "_").slice(0, 80);
    zip.file(`${safe}.png`, png);
  }

  const content = await zip.generateAsync({ type: "uint8array" });
  // Cast: Node 24 / TS typed-array generics don't align with DOM BodyInit,
  // but a Uint8Array is a valid response body at runtime.
  return new NextResponse(content as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="qr-codes.zip"`,
    },
  });
}
