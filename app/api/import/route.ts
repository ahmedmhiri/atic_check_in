import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { generateQrToken } from "@/lib/qr";

export const runtime = "nodejs";

interface Row {
  name?: string;
  email?: string;
  studentId?: string;
}

function pick(row: Record<string, any>, keys: string[]): string | undefined {
  for (const k of Object.keys(row)) {
    if (keys.includes(k.trim().toLowerCase())) {
      const v = row[k];
      if (v === null || v === undefined) return undefined;
      return String(v).trim();
    }
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let rows: Record<string, any>[];
  try {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  } catch {
    return NextResponse.json({ error: "Could not parse file. Use .xlsx or .csv." }, { status: 400 });
  }

  const summary = {
    total: rows.length,
    created: 0,
    skipped: 0,
    errors: 0,
    details: [] as { row: number; studentId?: string; status: string; reason?: string }[],
  };

  // Track dupes within the same file too.
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rec: Row = {
      name: pick(raw, ["name", "full name", "student name"]),
      email: pick(raw, ["email", "e-mail", "email address"]),
      studentId: pick(raw, ["studentid", "student id", "id", "roll", "roll no"]),
    };
    const rowNum = i + 2; // header is row 1

    if (!rec.name || !rec.email || !rec.studentId) {
      summary.errors++;
      summary.details.push({ row: rowNum, status: "error", reason: "Missing name/email/studentId" });
      continue;
    }

    const email = rec.email.toLowerCase();
    const sid = rec.studentId;

    if (seenIds.has(sid) || seenEmails.has(email)) {
      summary.skipped++;
      summary.details.push({ row: rowNum, studentId: sid, status: "skipped", reason: "Duplicate within file" });
      continue;
    }

    try {
      const exists = await prisma.student.findFirst({
        where: { OR: [{ studentId: sid }, { email }] },
        select: { id: true },
      });
      if (exists) {
        summary.skipped++;
        summary.details.push({ row: rowNum, studentId: sid, status: "skipped", reason: "Already exists in DB" });
        continue;
      }
      await prisma.student.create({
        data: { name: rec.name, email, studentId: sid, qrToken: generateQrToken() },
      });
      seenIds.add(sid);
      seenEmails.add(email);
      summary.created++;
      summary.details.push({ row: rowNum, studentId: sid, status: "created" });
    } catch (e: any) {
      summary.errors++;
      summary.details.push({ row: rowNum, studentId: sid, status: "error", reason: e?.message ?? "DB error" });
    }
  }

  return NextResponse.json(summary);
}
