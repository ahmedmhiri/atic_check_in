import Link from "next/link";
import { prisma } from "@/lib/prisma";
import FinalizeButton from "@/components/FinalizeButton";
import { attendedSlotCounts } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalStudents, hotelCheckedIn, totalSlots, tracks, students, attended] = await Promise.all([
    prisma.student.count(),
    prisma.hotelCheckIn.count(),
    prisma.timeSlot.count(),
    prisma.track.findMany({
      select: { id: true, name: true, _count: { select: { currentStudents: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      orderBy: { studentId: "asc" },
      select: {
        id: true,
        name: true,
        studentId: true,
        hotelCheckIn: { select: { checkedInAt: true } },
        currentTrack: { select: { name: true } },
      },
    }),
    attendedSlotCounts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">ATIC 2.0 · Live dashboard</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">
          Event <span className="text-accent">Overview</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card label="Imported" value={totalStudents} />
        <Card label="Hotel Checked-In" value={hotelCheckedIn} tone="text-emerald-400" />
        <Card label="Not Arrived" value={totalStudents - hotelCheckedIn} tone="text-amber-300" />
        <Card label="Time Slots" value={totalSlots} />
      </div>

      {totalStudents > 0 && (
        <div className="card">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="eyebrow">Arrivals</h2>
            <span className="text-sm text-slate-300">
              <b className="text-white">{Math.round((hotelCheckedIn / totalStudents) * 100)}%</b> checked in
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-accent shadow-glow transition-all"
              style={{ width: `${(hotelCheckedIn / totalStudents) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 eyebrow">
          Live Track Occupancy (current time slot)
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tracks.map((t) => (
            <Link
              key={t.id}
              href={`/scan/${t.id}`}
              className="group rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-accent/60 hover:bg-accent/10"
            >
              <div className="font-display text-3xl font-black text-white">{t._count.currentStudents}</div>
              <div className="text-sm font-semibold text-slate-200">{t.name}</div>
              <div className="mt-1 text-xs text-accent transition group-hover:translate-x-0.5">Open scanner →</div>
            </Link>
          ))}
        </div>
      </div>

      <FinalizeButton />

      <div className="card">
        <h2 className="mb-3 eyebrow">Students</h2>
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-navy-900 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="hidden px-3 py-2 sm:table-cell">Student ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Hotel</th>
                <th className="hidden px-3 py-2 md:table-cell">Current Track</th>
                <th className="px-3 py-2">Attended</th>
                <th className="hidden px-3 py-2 sm:table-cell"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const count = attended.get(s.id) ?? 0;
                const pct = totalSlots ? Math.round((count / totalSlots) * 100) : 0;
                return (
                  <tr key={s.id} className="border-t border-white/5 transition hover:bg-white/5">
                    <td className="hidden px-3 py-1.5 font-mono text-xs sm:table-cell">{s.studentId}</td>
                    <td className="px-3 py-2 sm:py-1.5">
                      <Link href={`/students/${s.id}`} className="text-white underline-offset-2 hover:underline">
                        {s.name}
                      </Link>
                      <div className="font-mono text-[11px] text-slate-500 sm:hidden">{s.studentId}</div>
                    </td>
                    <td className="px-3 py-1.5">
                      {s.hotelCheckIn ? (
                        <span className="badge bg-emerald-400/15 text-emerald-300">in</span>
                      ) : (
                        <span className="badge bg-white/10 text-slate-400">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-1.5 text-slate-300 md:table-cell">{s.currentTrack?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      {count}/{totalSlots} <span className="text-slate-500">({pct}%)</span>
                    </td>
                    <td className="hidden px-3 py-1.5 text-right sm:table-cell">
                      <Link href={`/students/${s.id}`} className="text-accent hover:underline">
                        Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No students yet — import a spreadsheet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, tone = "text-white" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card">
      <div className={`font-display text-3xl font-black sm:text-4xl ${tone}`}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}
