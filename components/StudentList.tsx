"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface StudentListRow {
  id: string;
  name: string;
  studentId: string;
  email: string;
  opening: boolean;
  track: string | null;
  attended: number;
}

// Lowercase and strip accents, so "ines" finds "Inès".
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Dashboard student list with a search box. Every row is one link, so on a
 * phone tapping anywhere on it opens the student (not just the name).
 */
export default function StudentList({ students, totalSlots }: { students: StudentListRow[]; totalSlots: number }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return students;
    return students.filter((s) => {
      const hay = fold(`${s.name} ${s.studentId} ${s.email}`);
      return words.every((w) => hay.includes(w));
    });
  }, [q, students]);

  // Each row is its own grid, so columns are fixed widths to line up across rows.
  const cols =
    "grid grid-cols-[1fr_2.75rem_5.75rem_0.75rem] items-center gap-3 sm:grid-cols-[9rem_1fr_4.5rem_6.5rem_0.75rem] md:grid-cols-[9rem_1fr_4.5rem_12rem_6.5rem_0.75rem]";

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, student ID or email"
          aria-label="Search students"
          className="input flex-1"
          autoComplete="off"
          enterKeyHint="search"
        />
        <span className="whitespace-nowrap font-mono text-[11px] text-slate-400">
          {q ? `${shown.length} / ${students.length}` : students.length}
        </span>
      </div>

      <div className="rounded-lg border border-white/10 sm:max-h-[28rem] sm:overflow-auto">
        <div
          className={`${cols} sticky top-0 hidden bg-navy-900 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-mist sm:grid`}
        >
          <span>Student ID</span>
          <span>Name</span>
          <span>Opening</span>
          <span className="hidden md:block">Current Track</span>
          <span>Attended</span>
          <span />
        </div>

        {shown.map((s) => {
          const pct = totalSlots ? Math.round((s.attended / totalSlots) * 100) : 0;
          return (
            <Link
              key={s.id}
              href={`/students/${s.id}`}
              className={`${cols} border-t border-white/5 px-3 py-2.5 text-sm transition first:border-t-0 hover:bg-white/5 active:bg-white/10 sm:py-1.5 sm:first:border-t`}
            >
              <span className="hidden font-mono text-xs sm:block">{s.studentId}</span>
              <span className="min-w-0">
                <span className="block text-white">{s.name}</span>
                <span className="block font-mono text-[11px] text-slate-500 sm:hidden">{s.studentId}</span>
              </span>
              <span>
                {s.opening ? (
                  <span className="badge bg-emerald-400/15 text-emerald-300">in</span>
                ) : (
                  <span className="badge bg-white/10 text-slate-400">—</span>
                )}
              </span>
              <span className="hidden truncate text-slate-300 md:block">{s.track ?? "—"}</span>
              <span className="whitespace-nowrap">
                {s.attended}/{totalSlots} <span className="text-slate-500">({pct}%)</span>
              </span>
              <span className="text-right text-accent" aria-hidden>
                ›
              </span>
            </Link>
          );
        })}

        {shown.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-slate-500">
            {students.length ? `No student matches "${q}".` : "No students yet — import a spreadsheet."}
          </p>
        )}
      </div>
    </div>
  );
}
