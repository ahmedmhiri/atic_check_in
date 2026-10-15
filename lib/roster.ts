/**
 * Turn spreadsheet rows (e.g. a Google Form "Responses" export) into students.
 * Only name + email (+ an optional student ID) are used; every other column
 * (phone, Facebook, roommate, …) is ignored — except a payment-status column
 * like the rooming list's "Paid 130": then only the paid rows are imported.
 */

export interface RosterRecord {
  row: number; // spreadsheet row number (header = 1)
  name: string;
  email: string;
  studentId?: string;
  note?: string; // e.g. an email typo that was corrected
}
export interface RosterIssue {
  row: number;
  studentId?: string;
  name?: string;
  email?: string;
  status: "error" | "skipped";
  reason: string;
}
export interface ParsedRoster {
  records: RosterRecord[];
  issues: RosterIssue[];
  columns: { name: string | null; email: string | null; studentId: string | null; paid: string | null };
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

const cell = (r: Record<string, unknown>, col: string | null) =>
  col === null ? "" : String(r[col] ?? "").replace(/\s+/g, " ").trim(); // "" is a real (unnamed) column

/**
 * Payment column of the organisers' sheet (rooming list): cells like "Paid 130",
 * "In Progress (130 Confirmed)", "No longer interested". Found by its content,
 * since that column has no header there. Otherwise a payment-status header whose
 * cells say "Paid". Google Form exports have neither, so nothing is filtered.
 */
const PAID_RE = /^(paid|payé|payée|paye|payee)\b/i;
function findPaidColumn(headers: string[], rows: Record<string, unknown>[]): string | null {
  const says = (col: string, re: RegExp) => rows.some((r) => re.test(cell(r, col)));
  const byAmount = headers.find((h) => says(h, /^(paid|payé|payée|paye|payee)\s*\d/i));
  if (byAmount !== undefined) return byAmount;
  return (
    headers.find((h) => {
      const n = norm(h);
      return (
        /(participation|registration|inscription) fee|frais d'inscription|payment status|^paid$|^payé$|^paiement$/.test(n) &&
        !/transport|method|méthode|methode|mode|proof|preuve/.test(n) &&
        says(h, PAID_RE)
      );
    }) ?? null
  );
}

// Common typos of gmail.com: "gamil.com", "gmail.cim", …
function fixEmailTypo(email: string): string {
  return email
    .replace(/@(gamil|gmial|gmali|gmaill|gnail|gmal|gmai)\.com$/, "@gmail.com")
    .replace(/@gmail\.(cim|con|cm|co|om|comm)$/, "@gmail.com");
}

const nameWords = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

// Same person answering twice ("Ahmed" / "ahmed mhiri") vs two people typed
// with one address ("Emna Gassara" / "Manar gassara").
function samePerson(a: string, b: string): boolean {
  const [x, y] = [nameWords(a), nameWords(b)];
  const [small, big] = x.length <= y.length ? [x, new Set(y)] : [y, new Set(x)];
  return small.every((w) => big.has(w));
}

// How many of the name's words appear in the address (emnagassara51@ -> Emna Gassara: 2).
const emailMatch = (name: string, email: string) =>
  nameWords(name).filter((w) => w.length >= 3 && email.split("@")[0].includes(w)).length;

export function parseRoster(rows: Record<string, unknown>[]): ParsedRoster {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columns = {
    name: findColumn(headers, NAME_TESTS),
    email: findColumn(headers, EMAIL_TESTS),
    studentId: findColumn(headers, ID_TESTS),
    paid: findPaidColumn(headers, rows),
  };
  const issues: RosterIssue[] = [];
  if (!columns.name || !columns.email) return { records: [], issues, columns };

  // Keep each person's LATEST response: forms are exported oldest-first and a
  // second submission is usually a correction.
  const byEmail = new Map<string, RosterRecord>();
  // One address typed for two different people: neither gets it, unless the
  // address clearly belongs to one of them.
  const conflicts = new Map<string, RosterRecord[]>();
  rows.forEach((r, i) => {
    const row = i + 2;
    // Drop trailing notes like "Firas Ben Dhaou (no roommate)".
    const name = cell(r, columns.name).replace(/\s*\([^)]*\)$/, "");
    const typed = cell(r, columns.email).toLowerCase().replace(/\s/g, "");
    const email = fixEmailTypo(typed);
    const note = email !== typed ? `Email typo fixed (was ${typed})` : undefined;
    const studentId = cell(r, columns.studentId) || undefined;
    if (!name && !email) return; // blank line
    if (columns.paid !== null) {
      const paid = cell(r, columns.paid);
      if (!PAID_RE.test(paid)) {
        issues.push({ row, studentId, name, email, status: "skipped", reason: `Not paid (${paid || "empty"})` });
        return;
      }
    }
    if (!name || !email) {
      issues.push({ row, studentId, name, email, status: "error", reason: `Missing ${!name ? "name" : "email"}` });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      issues.push({ row, studentId, name, email, status: "error", reason: "Invalid email" });
      return;
    }
    const rec: RosterRecord = { row, name, email, studentId, note };
    const clash = conflicts.get(email);
    if (clash) {
      clash.push(rec);
      return;
    }
    const prev = byEmail.get(email);
    if (prev && !samePerson(prev.name, name)) {
      byEmail.delete(email);
      conflicts.set(email, [prev, rec]);
      return;
    }
    if (prev)
      issues.push({
        row: prev.row,
        studentId: prev.studentId,
        name: prev.name,
        email: prev.email,
        status: "skipped",
        reason: `Duplicate response — row ${row} (newer) used`,
      });
    byEmail.set(email, rec);
  });

  conflicts.forEach((recs, email) => {
    const scores = recs.map((r) => emailMatch(r.name, email));
    const best = Math.max(...scores);
    const owner = best > 0 && scores.filter((s) => s === best).length === 1 ? recs[scores.indexOf(best)] : undefined;
    if (owner) byEmail.set(email, owner);
    for (const r of recs) {
      if (r === owner) continue;
      const others = recs.filter((o) => o !== r).map((o) => `${o.name} (row ${o.row})`).join(", ");
      issues.push({
        row: r.row,
        studentId: r.studentId,
        name: r.name,
        email: r.email,
        status: "error",
        reason: `Same email as ${others} — fix it in the sheet and re-import`,
      });
    }
  });

  // A supplied student ID must also be unique within the file.
  const seenIds = new Set<string>();
  const records: RosterRecord[] = [];
  for (const rec of Array.from(byEmail.values()).sort((a, b) => a.row - b.row)) {
    if (rec.studentId) {
      if (seenIds.has(rec.studentId)) {
        issues.push({ row: rec.row, studentId: rec.studentId, name: rec.name, email: rec.email, status: "skipped", reason: "Duplicate student ID within file" });
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
