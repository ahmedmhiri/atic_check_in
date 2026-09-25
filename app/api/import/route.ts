import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { generateQrToken } from "@/lib/qr";
import { AUTO_ID_PREFIX, nextAutoIds, parseRoster, RosterIssue } from "@/lib/roster";
import { readSheet } from "@/lib/sheet";

export const runtime = "nodejs";

// POST /api/import (multipart "file") — .xlsx or .csv, e.g. the Google Form
// responses export. Uses name + email (+ optional student ID); other columns
// are ignored. Re-importing an updated export only adds new people.
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

  let rows: Record<string, unknown>[];
  try {
    rows = readSheet(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "Could not parse file. Use .xlsx or .csv." }, { status: 400 });
  }

  const { records, issues, columns } = parseRoster(rows);
  if (!columns.name || !columns.email) {
    const found = rows.length ? Object.keys(rows[0]).map((h) => h.trim()).join(", ") : "none";
    return NextResponse.json(
      { error: `Couldn't find a ${!columns.name ? "name" : "email"} column. Columns found: ${found}` },
      { status: 400 }
    );
  }

  const details: { row: number; studentId?: string; status: RosterIssue["status"] | "created"; reason?: string }[] = [...issues];
  let created = 0;

  // Already imported (by email, or by a supplied student ID) -> skip.
  const [byEmail, byId] = await Promise.all([
    prisma.student.findMany({ where: { email: { in: records.map((r) => r.email) } }, select: { email: true, studentId: true } }),
    prisma.student.findMany({
      where: { studentId: { in: records.flatMap((r) => (r.studentId ? [r.studentId] : [])) } },
      select: { studentId: true },
    }),
  ]);
  const existingEmail = new Map(byEmail.map((s) => [s.email, s.studentId]));
  const existingId = new Set(byId.map((s) => s.studentId));

  const toCreate = records.filter((r) => {
    if (existingEmail.has(r.email)) {
      details.push({ row: r.row, studentId: existingEmail.get(r.email), status: "skipped", reason: "Already imported" });
      return false;
    }
    if (r.studentId && existingId.has(r.studentId)) {
      details.push({ row: r.row, studentId: r.studentId, status: "skipped", reason: "Student ID already used" });
      return false;
    }
    return true;
  });

  // Rosters without a student ID column (Google Form) get ATIC-0001, ATIC-0002, …
  const needIds = toCreate.filter((r) => !r.studentId).length;
  const autoIds = needIds
    ? nextAutoIds(
        (await prisma.student.findMany({ where: { studentId: { startsWith: AUTO_ID_PREFIX } }, select: { studentId: true } })).map(
          (s) => s.studentId
        ),
        needIds
      )
    : [];

  for (const r of toCreate) {
    const studentId = r.studentId ?? autoIds.shift()!;
    try {
      await prisma.student.create({ data: { name: r.name, email: r.email, studentId, qrToken: generateQrToken() } });
      created++;
      details.push({ row: r.row, studentId, status: "created" });
    } catch (e: any) {
      details.push({
        row: r.row,
        studentId,
        status: "error",
        reason: e?.code === "P2002" ? "Already exists (imported at the same time?)" : e?.message ?? "DB error",
      });
    }
  }

  details.sort((a, b) => a.row - b.row);
  return NextResponse.json({
    total: rows.length,
    created,
    skipped: details.filter((d) => d.status === "skipped").length,
    errors: details.filter((d) => d.status === "error").length,
    columns,
    details,
  });
}
