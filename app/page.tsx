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
        <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mist">
          <span>[ ATIC 2.0 ]</span>
          <span>Live dashboard</span>
        </div>
        <h1 className="mt-2 text-4xl sm:text-6xl">
          Event <span className="pill-word">Live</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {/* Colour blocks, like the mockup's ticket cards. */}
        <Card n="01" label="Imported" value={totalStudents} tone="bg-white text-navy-950" />
        <Card n="02" label="Hotel checked-in" value={hotelCheckedIn} tone="bg-accent text-navy-950" />
        <Card n="03" label="Not arrived" value={totalStudents - hotelCheckedIn} tone="border border-white/15 bg-navy-950 text-white" />
        <Card n="04" label="Time slots" value={totalSlots} tone="bg-brand text-white" />
      </div>

      {totalStudents > 0 && (
        <div className="card">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="eyebrow">(01) Arrivals</h2>
            <span className="font-display text-2xl font-black text-white">
              {Math.round((hotelCheckedIn / totalStudents) * 100)}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-sm bg-white/10">
            <div className="h-full bg-accent transition-all" style={{ width: `${(hotelCheckedIn / totalStudents) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="eyebrow mb-3">(02) Live track occupancy</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tracks.map((t) => (
            <Link
              key={t.id}
              href={`/scan/${t.id}`}
              className="group rounded-lg border border-white/15 bg-navy-950 p-4 transition hover:-translate-y-0.5 hover:border-white hover:shadow-block"
            >
              <div className="font-display text-3xl font-black text-white">{t._count.currentStudents}</div>
              <div className="font-display text-sm font-bold uppercase text-white">{t.name}</div>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-accent">Open scanner ↗</div>
            </Link>
          ))}
        </div>
      </div>

      <FinalizeButton />

      <div className="card">
        <h2 className="eyebrow mb-3">(03) Students</h2>
        <div className="max-h-[28rem] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-navy-900 text-left font-mono text-[11px] uppercase tracking-wider text-mist">
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

function Card({ n, label, value, tone }: { n: string; label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg p-4 sm:p-5 ${tone}`}>
      <div className="font-mono text-[11px] font-semibold opacity-70">/{n}</div>
      <div className="mt-2 font-display text-4xl font-black leading-none sm:text-5xl">{value}</div>
      <div className="mt-2 border-t border-dashed border-current pt-2 font-mono text-[11px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </div>
    </div>
  );
}
