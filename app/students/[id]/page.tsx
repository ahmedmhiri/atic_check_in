import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StudentOverride, { SlotRow } from "@/components/StudentOverride";
import ResendQrButton from "@/components/ResendQrButton";
import DeleteStudentButton from "@/components/DeleteStudentButton";
import { eligibilityThreshold } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: { params: { id: string } }) {
  const [student, slots] = await Promise.all([
    prisma.student.findUnique({
      where: { id: params.id },
      include: {
        hotelCheckIn: true,
        slotSelections: { include: { track: true, timeSlot: true } },
        attendance: {
          include: { sessionOccurrence: { include: { track: true, timeSlot: true } } },
        },
      },
    }),
    prisma.timeSlot.findMany({
      orderBy: [{ day: "asc" }, { order: "asc" }],
      include: { sessions: { include: { track: true }, orderBy: { track: { name: "asc" } } } },
    }),
  ]);

  if (!student) notFound();

  const totalSlots = slots.length;
  // Distinct slots attended (never more than one per slot).
  const attendedCount = new Set(student.attendance.map((a) => a.sessionOccurrence.timeSlotId)).size;
  const pct = totalSlots ? Math.round((attendedCount / totalSlots) * 100) : 0;

  // Map: timeSlotId -> selected trackId
  const selByslot = new Map(student.slotSelections.map((s) => [s.timeSlotId, s.trackId]));
  // Map: sessionOccurrenceId -> attendance record
  const attByOcc = new Map(student.attendance.map((a) => [a.sessionOccurrenceId, a]));

  const rows: SlotRow[] = slots.map((slot) => {
    const sessions = slot.sessions.map((se) => ({
      trackId: se.trackId,
      trackName: se.track.name,
      occurrenceId: se.id,
    }));
    const selectedTrackId = selByslot.get(slot.id) ?? null;
    // Find any attendance for this slot (across sessions in the slot).
    let attendanceRecordId: string | null = null;
    let attendedStatus: string | null = null;
    for (const se of slot.sessions) {
      const rec = attByOcc.get(se.id);
      if (rec) {
        attendanceRecordId = rec.id;
        attendedStatus = rec.status;
        break;
      }
    }
    return { slotId: slot.id, slotLabel: slot.label, selectedTrackId, sessions, attendanceRecordId, attendedStatus };
  });

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← Back to dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl">{student.name}</h1>
          <p className="break-all text-sm text-slate-400">
            {student.email} · <span className="font-mono">{student.studentId}</span>
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:gap-4">
          <Metric label="Attendance" value={`${pct}%`} sub={`${attendedCount}/${totalSlots}`} />
          <Metric
            label="Hotel"
            value={student.hotelCheckIn ? "In" : "Out"}
            sub={student.hotelCheckIn ? student.hotelCheckIn.checkedInAt.toLocaleString() : "not arrived"}
          />
          <Metric label="Eligible" value={pct >= eligibilityThreshold() ? "Yes" : "No"} />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 eyebrow">Slot-by-Slot History</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="px-3 py-2">Time Slot</th>
              <th className="px-3 py-2">Track Chosen</th>
              <th className="px-3 py-2">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const trackName = r.sessions.find((s) => s.trackId === r.selectedTrackId)?.trackName;
              return (
                <tr key={r.slotId} className="border-t border-white/5">
                  <td className="px-3 py-2">{r.slotLabel}</td>
                  <td className="px-3 py-2">{trackName ?? <span className="text-slate-500">—</span>}</td>
                  <td className="px-3 py-2">
                    {r.attendanceRecordId ? (
                      <span className="badge bg-emerald-400/15 text-emerald-300">{r.attendedStatus}</span>
                    ) : (
                      <span className="badge bg-white/10 text-slate-400">absent</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <ResendQrButton
        id={student.id}
        email={student.email}
        sentAt={student.qrEmailSentAt ? student.qrEmailSentAt.toISOString() : null}
      />

      <StudentOverride studentId={student.id} hotelCheckedIn={!!student.hotelCheckIn} rows={rows} />

      <DeleteStudentButton id={student.id} name={student.name} studentId={student.studentId} />
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card text-center sm:min-w-[7rem]">
      <div className="text-2xl font-bold text-accent">{value}</div>
      <div className="text-xs font-medium text-slate-400">{label}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}
