import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { qrPngBuffer } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /q/<qrToken>.png — the student's QR code as an image, for emails.
// Public on purpose (email clients fetch it without a session; the path ends
// in .png so middleware skips it). The URL only works for a real student's
// token, which is exactly what the QR itself encodes, so it reveals nothing
// the email doesn't already contain.
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const m = params.file.match(/^([0-9a-f]{32})\.png$/);
  if (!m) return new NextResponse("Not found", { status: 404 });

  const student = await prisma.student.findUnique({ where: { qrToken: m[1] }, select: { id: true } });
  if (!student) return new NextResponse("Not found", { status: 404 });

  const png = await qrPngBuffer(m[1]);
  return new NextResponse(new Uint8Array(png) as unknown as BodyInit, {
    headers: {
      "content-type": "image/png",
      // Tokens never change, so email proxies (Gmail's image cache) can keep it.
      "cache-control": "public, max-age=31536000, immutable",
      "x-robots-tag": "noindex",
    },
  });
}
