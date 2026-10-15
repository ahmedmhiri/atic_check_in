import Link from "next/link";
import { prisma } from "@/lib/prisma";
import FinalizeButton from "@/components/FinalizeButton";
import StudentList from "@/components/StudentList";
import { attendedSlotCounts } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalStudents, hotelCheckedIn, totalSlots, tracks, students, attended, slots, choices] = await Promise.all([
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
        email: true,
        hotelCheckIn: { select: { checkedInAt: true } },
        currentTrack: { select: { name: true } },
      },
    }),
    attendedSlotCounts(),
    prisma.timeSlot.findMany({ orderBy: [{ day: "asc" }, { order: "asc" }], select: { id: true, label: true } }),
    // Track chosen per session (one track for all sessions): from the Google Form, or locked in by the first scan.
    prisma.slotSelection.groupBy({ by: ["timeSlotId", "trackId"], _count: { _all: true } }),
  ]);
  const chosen = (slotId: string, trackId: string) =>
    choices.find((c) => c.timeSlotId === slotId && c.trackId === trackId)?._count._all ?? 0;

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
        <Card n="02" label="Opening checked-in" value={hotelCheckedIn} tone="bg-accent text-navy-950" />
        <Card n="03" label="Not checked in" value={totalStudents - hotelCheckedIn} tone="border border-white/15 bg-navy-950 text-white" />
        <Card n="04" label="Time slots" value={totalSlots} tone="bg-brand text-white" />
      </div>

      {totalStudents > 0 && (
        <div className="card">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="eyebrow">(01) Opening ceremony check-in</h2>
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

      {slots.length > 0 && (
        <div className="card">
          <h2 className="eyebrow mb-1">(03) Track choices</h2>
          <p className="mb-3 text-xs text-slate-400">
            Students per track. Each student follows one track for all 3 sessions, chosen on the Google Form or at their
            first track scan.
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-navy-900 text-left font-mono text-[11px] uppercase tracking-wider text-mist">
                <tr>
                  <th className="px-3 py-2">Track</th>
                  {slots.map((sl) => (
                    <th key={sl.id} className="px-2 py-2 text-center" title={sl.label}>
                      {/* "Session 1 · Sat 14:00" → "S1" with the time below */}
                      {sl.label.split(" · ")[0].replace(/^session\s*/i, "S")}
                      <span className="block normal-case tracking-normal text-slate-500 sm:whitespace-nowrap">
                        {sl.label.split(" · ").slice(1).join(" · ")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tracks.map((t) => {
                  const [num, ...topic] = t.name.split(" · ");
                  return (
                    <tr key={t.id} className="border-t border-white/5">
                      <td className="px-3 py-1.5">
                        <span className="font-semibold text-white">{num}</span>
                        {topic.length > 0 && <span className="block text-xs text-slate-400 sm:ml-2 sm:inline">{topic.join(" · ")}</span>}
                      </td>
                      {slots.map((sl) => (
                        <td key={sl.id} className="px-2 py-1.5 text-center font-mono">{chosen(sl.id, t.id)}</td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-t border-white/10 text-slate-500">
                  <td className="px-3 py-1.5">Not chosen</td>
                  {slots.map((sl) => (
                    <td key={sl.id} className="px-2 py-1.5 text-center font-mono">
                      {Math.max(totalStudents - tracks.reduce((n, t) => n + chosen(sl.id, t.id), 0), 0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FinalizeButton />

      <div className="card">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow">(04) Students</h2>
          {/* Name, email, student ID and QR code (as a picture) for every student. */}
          <a href="/api/students/export" className="font-mono text-[11px] uppercase tracking-wider text-accent hover:underline">
            Download sheet (.xlsx) ↓
          </a>
        </div>
        <StudentList
          totalSlots={totalSlots}
          students={students.map((s) => ({
            id: s.id,
            name: s.name,
            studentId: s.studentId,
            email: s.email,
            opening: !!s.hotelCheckIn,
            track: s.currentTrack?.name ?? null,
            attended: attended.get(s.id) ?? 0,
          }))}
        />
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
