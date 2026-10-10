import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { attendanceSummary } from "@/lib/attendance";
import { eligibilityThreshold } from "@/lib/config";

export const dynamic = "force-dynamic";

const PODIUM_TONES = ["bg-accent text-navy-950", "bg-white text-navy-950", "bg-brand text-white"];

export default async function RankingPage() {
  const [students, totalSlots, summary] = await Promise.all([
    prisma.student.findMany({ select: { id: true, name: true, studentId: true } }),
    prisma.timeSlot.count(),
    attendanceSummary(),
  ]);
  const threshold = eligibilityThreshold();

  // Most slots attended first, then fewest late arrivals. Same score = same rank (1, 2, 2, 4).
  const sorted = students
    .map((s) => ({ ...s, slots: summary.get(s.id)?.slots ?? 0, late: summary.get(s.id)?.late ?? 0 }))
    .sort((a, b) => b.slots - a.slots || a.late - b.late || a.name.localeCompare(b.name));
  const ranked: (typeof sorted[number] & { rank: number; pct: number })[] = [];
  sorted.forEach((s, i) => {
    const prev = ranked[i - 1];
    const rank = prev && prev.slots === s.slots && prev.late === s.late ? prev.rank : i + 1;
    ranked.push({ ...s, rank, pct: totalSlots ? Math.round((s.slots / totalSlots) * 100) : 0 });
  });
  const podium = ranked.filter((s) => s.rank <= 3 && s.slots > 0).slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mist">
          <span>[ ATIC 2.0 ]</span>
          <span>Attendance ranking</span>
        </div>
        <h1 className="mt-2 text-4xl sm:text-6xl">
          Top <span className="pill-word">Attendees</span>
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Ranked by time slots attended, then fewest late arrivals. Equal scores share a rank. Certificate eligibility from{" "}
          {threshold}%.
        </p>
      </div>

      {podium.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {podium.map((s, i) => (
            <Link
              key={s.id}
              href={`/students/${s.id}`}
              className={`rounded-lg p-4 transition hover:-translate-y-0.5 hover:shadow-block sm:p-5 ${PODIUM_TONES[i]}`}
            >
              <div className="font-mono text-[11px] font-semibold opacity-70">#{s.rank}</div>
              <div className="mt-2 font-display text-xl font-black uppercase leading-tight">{s.name}</div>
              <div className="mt-2 border-t border-dashed border-current pt-2 font-mono text-[11px] font-semibold uppercase tracking-wider opacity-80">
                {s.slots}/{totalSlots} slots · {s.pct}%{s.late > 0 && ` · ${s.late} late`}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="eyebrow mb-3">Full ranking</h2>
        <div className="max-h-[36rem] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-navy-900 text-left font-mono text-[11px] uppercase tracking-wider text-mist">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Attended</th>
                <th className="hidden px-3 py-2 sm:table-cell">Late</th>
                <th className="px-3 py-2">Eligible</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => (
                <tr key={s.id} className="border-t border-white/5 transition hover:bg-white/5">
                  <td className="px-3 py-1.5 font-display font-black text-white">{s.rank}</td>
                  <td className="px-3 py-2 sm:py-1.5">
                    <Link href={`/students/${s.id}`} className="-my-1 block py-2 text-white underline-offset-2 hover:underline sm:inline sm:py-0">
                      {s.name}
                    </Link>
                    <div className="font-mono text-[11px] text-slate-500">{s.studentId}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    {s.slots}/{totalSlots} <span className="text-slate-500">({s.pct}%)</span>
                  </td>
                  <td className="hidden px-3 py-1.5 text-slate-300 sm:table-cell">{s.late || "—"}</td>
                  <td className="px-3 py-1.5">
                    {s.pct >= threshold ? (
                      <span className="badge bg-emerald-400/15 text-emerald-300">yes</span>
                    ) : (
                      <span className="badge bg-white/10 text-slate-400">no</span>
                    )}
                  </td>
                </tr>
              ))}
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
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
