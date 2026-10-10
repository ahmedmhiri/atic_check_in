import { prisma } from "@/lib/prisma";

/**
 * Number of distinct time slots each student attended.
 * Counts slots, not AttendanceRecord rows, so a student can never exceed
 * 100% even if two records ever exist in the same slot.
 */
export async function attendedSlotCounts(studentIds?: string[]): Promise<Map<string, number>> {
  const records = await prisma.attendanceRecord.findMany({
    where: studentIds ? { studentId: { in: studentIds } } : undefined,
    select: { studentId: true, sessionOccurrence: { select: { timeSlotId: true } } },
  });

  const slotsByStudent = new Map<string, Set<string>>();
  for (const r of records) {
    let set = slotsByStudent.get(r.studentId);
    if (!set) slotsByStudent.set(r.studentId, (set = new Set()));
    set.add(r.sessionOccurrence.timeSlotId);
  }

  return new Map(Array.from(slotsByStudent, ([id, set]) => [id, set.size]));
}

/**
 * Per student: distinct time slots attended, and how many of those were LATE
 * (a slot is on time if any of its records is PRESENT). Drives the ranking.
 */
export async function attendanceSummary(): Promise<Map<string, { slots: number; late: number }>> {
  const records = await prisma.attendanceRecord.findMany({
    select: { studentId: true, status: true, sessionOccurrence: { select: { timeSlotId: true } } },
  });

  // studentId -> timeSlotId -> on time?
  const byStudent = new Map<string, Map<string, boolean>>();
  for (const r of records) {
    let slots = byStudent.get(r.studentId);
    if (!slots) byStudent.set(r.studentId, (slots = new Map()));
    const slotId = r.sessionOccurrence.timeSlotId;
    slots.set(slotId, slots.get(slotId) === true || r.status === "PRESENT");
  }

  return new Map(
    Array.from(byStudent, ([id, slots]) => [
      id,
      { slots: slots.size, late: Array.from(slots.values()).filter((onTime) => !onTime).length },
    ])
  );
}
