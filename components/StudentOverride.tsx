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
    await fetch("/api/override", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-500">Manual Override</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hotelCheckedIn}
            disabled={busy}
            onChange={(e) => call({ action: "setHotel", studentId, checkedIn: e.target.checked })}
          />
          Hotel checked in
        </label>
      </div>

      <div className="overflow-auto rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
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
                <tr key={r.slotId} className="border-t border-slate-100">
                  <td className="px-3 py-2">{r.slotLabel}</td>
                  <td className="px-3 py-2">
                    <select
                      className="input"
                      value={r.selectedTrackId ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        call({
                          action: "reassignSlot",
                          studentId,
                          timeSlotId: r.slotId,
                          trackId: e.target.value,
                        })
                      }
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
                        <span className="badge bg-green-100 text-green-700">{r.attendedStatus}</span>
                        <button
                          className="text-xs text-red-600 hover:underline"
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
                        className="text-xs text-teal-600 hover:underline"
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
                      <span className="text-xs text-slate-400">pick a track first</span>
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
