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
