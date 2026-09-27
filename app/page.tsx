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
        <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
          <span>[ ATIC 2.0 ]</span>
          <span>Live dashboard</span>
        </div>
        <h1 className="mt-2 text-4xl sm:text-6xl">
          Event <span className="pill-word">Live</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card n="01" label="Imported" value={totalStudents} />
        <Card n="02" label="Hotel checked-in" value={hotelCheckedIn} tone="text-success" />
        <Card n="03" label="Not arrived" value={totalStudents - hotelCheckedIn} tone="text-warn" />
        <Card n="04" label="Time slots" value={totalSlots} />
      </div>

      {totalStudents > 0 && (
        <div className="card">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="eyebrow">(01) Arrivals</h2>
            <span className="font-display text-2xl font-black text-ink">
              {Math.round((hotelCheckedIn / totalStudents) * 100)}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-sm bg-surface-subtle">
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
              className="group rounded-lg border border-line bg-surface-page p-4 transition hover:-translate-y-0.5 hover:border-white hover:shadow-block"
            >
              <div className="font-display text-3xl font-black text-ink">{t._count.currentStudents}</div>
              <div className="font-display text-sm font-bold uppercase text-ink">{t.name}</div>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-accent">Open scanner ↗</div>
            </Link>
          ))}
        </div>
      </div>

      <FinalizeButton />

      <div className="card">
        <h2 className="eyebrow mb-3">(03) Students</h2>
        <div className="max-h-[28rem] overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left font-mono text-[11px] uppercase tracking-wider text-ink-muted">
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
                  <tr key={s.id} className="border-t border-line transition hover:bg-surface-subtle">
                    <td className="hidden px-3 py-1.5 font-mono text-xs sm:table-cell">{s.studentId}</td>
                    <td className="px-3 py-2 sm:py-1.5">
                      <Link href={`/students/${s.id}`} className="-my-1 block py-2 text-ink underline-offset-2 hover:underline sm:inline sm:py-0">
                        {s.name}
                      </Link>
                      <div className="font-mono text-[11px] text-ink-subtle sm:hidden">{s.studentId}</div>
                    </td>
                    <td className="px-3 py-1.5">
                      {s.hotelCheckIn ? (
                        <span className="badge bg-emerald-400/15 text-emerald-300">in</span>
                      ) : (
                        <span className="badge bg-surface-subtle text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-1.5 text-ink-muted md:table-cell">{s.currentTrack?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      {count}/{totalSlots} <span className="text-ink-subtle">({pct}%)</span>
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
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-subtle">
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

function Card({ n, label, value, tone = "text-ink" }: { n: string; label: string; value: number; tone?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-ink-subtle">/{n}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${tone}`}>{value}</div>
      <div className="mt-1 text-sm text-ink-muted">{label}</div>
    </div>
  );
}
