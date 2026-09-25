/**
 * Turn spreadsheet rows (e.g. a Google Form "Responses" export) into students.
 * Only name + email (+ an optional student ID) are used; every other column
 * (phone, Facebook, payment, roommate, …) is ignored.
 */

export interface RosterRecord {
  row: number; // spreadsheet row number (header = 1)
  name: string;
  email: string;
  studentId?: string;
}
export interface RosterIssue {
  row: number;
  studentId?: string;
  status: "error" | "skipped";
  reason: string;
}
export interface ParsedRoster {
  records: RosterRecord[];
  issues: RosterIssue[];
  columns: { name: string | null; email: string | null; studentId: string | null };
}

const norm = (h: string) => h.replace(/\s+/g, " ").trim().toLowerCase();

// Header matchers, most specific first. Tolerant of form typos ("Email Adress").
function findColumn(headers: string[], tests: ((h: string) => boolean)[]): string | null {
  for (const test of tests) {
    const hit = headers.find((h) => test(norm(h)));
    if (hit !== undefined) return hit;
  }
  return null;
}

const NAME_TESTS = [
  (h: string) => ["full name", "name", "student name", "nom complet", "nom et prénom", "nom"].includes(h),
  (h: string) => /\b(full ?name|nom complet)\b/.test(h),
];
const EMAIL_TESTS = [
  (h: string) => ["email", "e-mail", "email address", "email adress", "adresse email", "mail"].includes(h),
  (h: string) => /e-?mail|courriel/.test(h),
];
const ID_TESTS = [
  (h: string) => ["studentid", "student id", "id", "roll", "roll no", "matricule"].includes(h),
  (h: string) => /\b(student ?id|matricule)\b/.test(h),
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRoster(rows: Record<string, unknown>[]): ParsedRoster {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columns = {
    name: findColumn(headers, NAME_TESTS),
    email: findColumn(headers, EMAIL_TESTS),
    studentId: findColumn(headers, ID_TESTS),
  };
  const issues: RosterIssue[] = [];
  if (!columns.name || !columns.email) return { records: [], issues, columns };

  const cell = (r: Record<string, unknown>, col: string | null) =>
    col ? String(r[col] ?? "").replace(/\s+/g, " ").trim() : "";

  // Keep each person's LATEST response: forms are exported oldest-first and a
  // second submission is usually a correction.
  const byEmail = new Map<string, RosterRecord>();
  rows.forEach((r, i) => {
    const row = i + 2;
    const name = cell(r, columns.name);
    const email = cell(r, columns.email).toLowerCase().replace(/\s/g, "");
    const studentId = cell(r, columns.studentId) || undefined;
    if (!name && !email) return; // blank line
    if (!name || !email) {
      issues.push({ row, studentId, status: "error", reason: `Missing ${!name ? "name" : "email"}` });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      issues.push({ row, studentId, status: "error", reason: "Invalid email" });
      return;
    }
    const prev = byEmail.get(email);
    if (prev) issues.push({ row: prev.row, studentId: prev.studentId, status: "skipped", reason: `Duplicate response — row ${row} (newer) used` });
    byEmail.set(email, { row, name, email, studentId });
  });

  // A supplied student ID must also be unique within the file.
  const seenIds = new Set<string>();
  const records: RosterRecord[] = [];
  for (const rec of Array.from(byEmail.values()).sort((a, b) => a.row - b.row)) {
    if (rec.studentId) {
      if (seenIds.has(rec.studentId)) {
        issues.push({ row: rec.row, studentId: rec.studentId, status: "skipped", reason: "Duplicate student ID within file" });
        continue;
      }
      seenIds.add(rec.studentId);
    }
    records.push(rec);
  }
  return { records, issues, columns };
}

/** Auto IDs for rosters without a student ID column: ATIC-0001, ATIC-0002, … */
export const AUTO_ID_PREFIX = "ATIC-";
export function nextAutoIds(existing: string[], count: number): string[] {
  let max = 0;
  for (const id of existing) {
    const m = id.match(/^ATIC-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `${AUTO_ID_PREFIX}${String(max + i + 1).padStart(4, "0")}`);
}
