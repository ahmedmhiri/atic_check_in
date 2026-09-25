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
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card label="Imported" value={totalStudents} />
        <Card label="Hotel Checked-In" value={hotelCheckedIn} tone="text-green-600" />
        <Card label="Not Arrived" value={totalStudents - hotelCheckedIn} tone="text-amber-600" />
        <Card label="Time Slots" value={totalSlots} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          Live Track Occupancy (current time slot)
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tracks.map((t) => (
            <Link
              key={t.id}
              href={`/scan/${t.id}`}
              className="rounded-md border border-slate-200 p-4 hover:border-teal-400 hover:bg-teal-50"
            >
              <div className="text-2xl font-bold text-teal-700">{t._count.currentStudents}</div>
              <div className="text-sm text-slate-600">{t.name}</div>
              <div className="mt-1 text-xs text-teal-600">Open scanner →</div>
            </Link>
          ))}
        </div>
      </div>

      <FinalizeButton />

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Students</h2>
        <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
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
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="hidden px-3 py-1.5 font-mono text-xs sm:table-cell">{s.studentId}</td>
                    <td className="px-3 py-2 sm:py-1.5">
                      <Link href={`/students/${s.id}`} className="text-slate-900 underline-offset-2 hover:underline">
                        {s.name}
                      </Link>
                      <div className="font-mono text-[11px] text-slate-400 sm:hidden">{s.studentId}</div>
                    </td>
                    <td className="px-3 py-1.5">
                      {s.hotelCheckIn ? (
                        <span className="badge bg-green-100 text-green-700">in</span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-500">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-1.5 text-slate-600 md:table-cell">{s.currentTrack?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      {count}/{totalSlots} <span className="text-slate-400">({pct}%)</span>
                    </td>
                    <td className="hidden px-3 py-1.5 text-right sm:table-cell">
                      <Link href={`/students/${s.id}`} className="text-teal-600 hover:underline">
                        Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
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

function Card({ label, value, tone = "text-slate-700" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card">
      <div className={`text-3xl font-bold ${tone}`}>{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}
