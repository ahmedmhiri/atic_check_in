"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface SlotRow {
  slotId: string;
  slotLabel: string;
  selectedTrackId: string | null;
  sessions: { trackId: string; trackName: string; occurrenceId: string }[];
  attendanceRecordId: string | null;
  attendedStatus: string | null;
}

export default function StudentOverride({
  studentId,
  hotelCheckedIn,
  rows,
}: {
  studentId: string;
  hotelCheckedIn: boolean;
  rows: SlotRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(body: any) {
    setBusy(true);
    try {
      const res = await fetch("/api/override", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? `Override failed (${res.status})`);
      }
    } catch {
      alert("Network error — override not saved");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow">Manual Override</h2>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm">
          <input
            className="h-5 w-5 accent-brand"
            type="checkbox"
            checked={hotelCheckedIn}
            disabled={busy}
            onChange={(e) => call({ action: "setHotel", studentId, checkedIn: e.target.checked })}
          />
          Hotel checked in
        </label>
      </div>

      <div className="overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-slate-400">
            <tr>
              <th className="px-3 py-2">Time Slot</th>
              <th className="px-3 py-2">Selected Track</th>
              <th className="px-3 py-2">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const selected = r.sessions.find((s) => s.trackId === r.selectedTrackId);
              const targetOcc = selected?.occurrenceId ?? null;
              const attended = !!r.attendanceRecordId;
              return (
                <tr key={r.slotId} className="border-t border-white/5">
                  <td className="px-3 py-2">{r.slotLabel}</td>
                  <td className="px-3 py-2">
                    <select
                      className="input min-w-[8rem]"
                      value={r.selectedTrackId ?? ""}
                      disabled={busy}
                      onChange={(e) => {
                        if (
                          attended &&
                          !confirm(
                            e.target.value
                              ? "Move this slot's attendance to the new track?"
                              : "Clear the track AND remove attendance for this slot?"
                          )
                        )
                          return;
                        call({
                          action: "reassignSlot",
                          studentId,
                          timeSlotId: r.slotId,
                          trackId: e.target.value,
                        });
                      }}
                    >
                      <option value="">— none —</option>
                      {r.sessions.map((s) => (
                        <option key={s.trackId} value={s.trackId}>
                          {s.trackName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {attended ? (
                      <div className="flex items-center gap-2">
                        <span className="badge bg-emerald-400/15 text-emerald-300">{r.attendedStatus}</span>
                        <button
                          className="rounded-md border border-red-400/30 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
                          disabled={busy}
                          onClick={() =>
                            call({ action: "deleteAttendance", attendanceRecordId: r.attendanceRecordId })
                          }
                        >
                          remove
                        </button>
                      </div>
                    ) : targetOcc ? (
                      <button
                        className="whitespace-nowrap rounded-md border border-accent/30 px-3 py-2 text-xs text-accent hover:bg-accent/10"
                        disabled={busy}
                        onClick={() =>
                          call({
                            action: "addAttendance",
                            studentId,
                            sessionOccurrenceId: targetOcc,
                            status: "PRESENT",
                          })
                        }
                      >
                        mark present
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">pick a track first</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
