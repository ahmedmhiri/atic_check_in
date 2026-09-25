import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { emailConfigError, sendQrEmail } from "@/lib/email";
import { qrPngBuffer } from "@/lib/qr";
import { batchProgress, runEmailBatch } from "@/lib/email-batch";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/qr-email
//   { skipIds? }  -> email one batch of students who haven't received their QR yet
//                    (idempotent via Student.qrEmailSentAt; `remaining` > 0 => call again)
//   { id }        -> (re)send one student's QR now, even if already sent
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const configError = emailConfigError();
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  // ---- Single student resend ----
  if (typeof body.id === "string" && body.id) {
    const s = await prisma.student.findUnique({ where: { id: body.id } });
    if (!s) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    try {
      const messageId = await sendQrEmail({
        name: s.name,
        email: s.email,
        studentId: s.studentId,
        qrPng: await qrPngBuffer(s.qrToken),
      });
      await prisma.student.update({ where: { id: s.id }, data: { qrEmailSentAt: new Date() } });
      return NextResponse.json({ status: "sent", messageId });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? "Send failed" }, { status: 502 });
    }
  }

  // ---- Batch ----
  const skipIds: string[] = Array.isArray(body.skipIds)
    ? body.skipIds.filter((x: unknown) => typeof x === "string")
    : [];

  const pending = await prisma.student.findMany({
    where: { qrEmailSentAt: null, id: { notIn: skipIds } },
    select: { id: true, name: true, email: true, studentId: true, qrToken: true },
    orderBy: { studentId: "asc" },
  });

  const { log, stopped } = await runEmailBatch({
    field: "qrEmailSentAt",
    students: pending,
    send: async (s) =>
      sendQrEmail({ name: s.name, email: s.email, studentId: s.studentId, qrPng: await qrPngBuffer(s.qrToken) }),
  });

  const failedIds = log.filter((l) => l.status === "failed").map((l) => l.id);
  const { remaining, alreadySent } = await batchProgress("qrEmailSentAt", [...skipIds, ...failedIds]);

  return NextResponse.json({
    summary: {
      processed: log.length,
      sent: log.length - failedIds.length,
      failed: failedIds.length,
      remaining,
      alreadySent,
      stopped,
    },
    log,
  });
}
