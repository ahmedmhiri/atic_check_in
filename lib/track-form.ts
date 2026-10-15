import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { slotWindow } from "@/lib/slot-window";

// Track choice via a Google Form (scripts/track-form.gs). The event-day email
// links each student to the form with their email and a personal code
// pre-filled; on submit the form's Apps Script posts the answers to
// /api/track-form, which turns them into binding SlotSelections (the check-in
// API then rejects scans at any other track for that session).

/** Short per-student code proving a form answer came from that student's link. */
export function choiceCode(studentId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`track-form:${studentId}`).digest("hex").slice(0, 8).toUpperCase();
}

/**
 * The student's pre-filled form link. TRACK_FORM_URL is the pre-filled URL the
 * Apps Script logs, with __EMAIL__ and __CODE__ where the values go.
 */
export function trackFormLink(student: { id: string; email: string }): string | null {
  const tpl = process.env.TRACK_FORM_URL?.trim();
  if (!tpl || !tpl.includes("__CODE__")) return null;
  return tpl
    .replace("__EMAIL__", encodeURIComponent(student.email))
    .replace("__CODE__", encodeURIComponent(choiceCode(student.id)));
}

export function secretMatches(given: string | null): boolean {
  const want = process.env.TRACK_FORM_SECRET;
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface FormAnswer {
  title: string;
  response: string;
}

export type ChoiceResult =
  | { session: number; status: "saved"; track: string }
  | { session: number; status: "unchanged" | "closed" | "attended" | "unknown"; track?: string };

/**
 * Apply one form submission. Questions are matched by their title
 * ("Email", "Personal code", "Session N …") and answers by "Track N …".
 * A session's choice can no longer change once its scanning window opens, or
 * once the student has been scanned in it — otherwise a student turned away
 * at the door could just re-submit the form.
 */
export async function applyTrackChoices(answers: FormAnswer[], now = Date.now()) {
  const get = (re: RegExp) => answers.find((a) => re.test(a.title.trim()))?.response.trim() ?? "";
  const email = get(/^e-?mail/i).toLowerCase();
  const code = get(/code/i).toUpperCase();
  if (!code) return { ok: false as const, error: "Missing personal code" };

  // Email first; fall back to the code alone in case the email was edited.
  let student = email ? await prisma.student.findUnique({ where: { email }, select: { id: true, name: true } }) : null;
  if (!student || choiceCode(student.id) !== code) {
    const all = await prisma.student.findMany({ select: { id: true, name: true } });
    student = all.find((s) => choiceCode(s.id) === code) ?? null;
  }
  if (!student) return { ok: false as const, error: `No student matches email "${email}" and code "${code}"` };

  const [slots, tracks] = await Promise.all([
    prisma.timeSlot.findMany({ orderBy: [{ day: "asc" }, { order: "asc" }] }),
    prisma.track.findMany({ select: { id: true, name: true } }),
  ]);

  const results: ChoiceResult[] = [];
  for (const a of answers) {
    const sm = a.title.trim().match(/^session\s*(\d+)/i);
    if (!sm) continue;
    const session = Number(sm[1]);
    const slot = slots[session - 1];
    const tm = a.response.trim().match(/^track\s*(\d+)/i);
    const track = tm ? tracks.find((t) => new RegExp(`^track\\s*${tm[1]}\\b`, "i").test(t.name)) : undefined;
    if (!slot || !track) {
      results.push({ session, status: "unknown" });
      continue;
    }

    const current = await prisma.slotSelection.findUnique({
      where: { studentId_timeSlotId: { studentId: student.id, timeSlotId: slot.id } },
      include: { track: { select: { name: true } } },
    });
    if (current?.trackId === track.id) {
      results.push({ session, status: "unchanged", track: track.name });
      continue;
    }
    if (now >= slotWindow(slot.startTime, slot.endTime).opens) {
      results.push({ session, status: "closed", track: current?.track.name });
      continue;
    }
    const attended = await prisma.attendanceRecord.count({
      where: { studentId: student.id, sessionOccurrence: { timeSlotId: slot.id } },
    });
    if (attended) {
      results.push({ session, status: "attended", track: current?.track.name });
      continue;
    }

    await prisma.slotSelection.upsert({
      where: { studentId_timeSlotId: { studentId: student.id, timeSlotId: slot.id } },
      update: { trackId: track.id, selectedAt: new Date(now) },
      create: { studentId: student.id, timeSlotId: slot.id, trackId: track.id },
    });
    results.push({ session, status: "saved", track: track.name });
  }

  return { ok: true as const, student: student.name, results };
}
