"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QrScanner from "@/components/QrScanner";

interface Session {
  id: string;
  title: string;
  trackId: string;
  track: { id: string; name: string };
}
interface Slot {
  id: string;
  day: number;
  label: string;
  startTime: string;
  endTime: string;
  sessions: Session[];
}

// Slots open for scanning this many minutes before their start time.
const EARLY_OPEN_MINUTES = 30;

function slotWindow(slot: Slot) {
  return {
    opens: new Date(slot.startTime).getTime() - EARLY_OPEN_MINUTES * 60_000,
    ends: new Date(slot.endTime).getTime(),
  };
}

function isSlotLive(slot: Slot, now = Date.now()) {
  const { opens, ends } = slotWindow(slot);
  return now >= opens && now <= ends;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

type Result = { status: string; message: string } | null;

export default function TrackScanPage({ params }: { params: { trackId: string } }) {
  const { trackId } = params;
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch("/api/timeslots", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: Slot[] = d.slots ?? [];
        setSlots(list);
        // Pre-select the slot that is running right now (if any).
        const live = list.find((s) => isSlotLive(s));
        if (live) setSlotId((cur) => cur || live.id);
      });
  }, []);

  const selectedSlot = slots.find((s) => s.id === slotId) ?? null;
  const slotIsLive = selectedSlot ? isSlotLive(selectedSlot) : false;

  // The session occurrence for THIS track in the selected slot.
  const activeSession = useMemo(() => {
    const slot = slots.find((s) => s.id === slotId);
    return slot?.sessions.find((se) => se.trackId === trackId) ?? null;
  }, [slots, slotId, trackId]);

  const trackName = useMemo(() => {
    for (const s of slots) {
      const se = s.sessions.find((x) => x.trackId === trackId);
      if (se) return se.track.name;
    }
    return "Track";
  }, [slots, trackId]);

  const handleScan = useCallback(
    async (qrToken: string) => {
      if (busy || !slotId || !activeSession) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/checkin/${trackId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            qrToken,
            timeSlotId: slotId,
            sessionOccurrenceId: activeSession.id,
          }),
        });
        const data = await res.json();
        setResult({ status: data.status ?? "error", message: data.message ?? data.error });
      } catch {
        setResult({ status: "error", message: "Network error" });
      } finally {
        setTimeout(() => setBusy(false), 1400);
      }
    },
    [busy, slotId, activeSession, trackId]
  );

  async function newTimeSlot() {
    if (!confirm("Start a new time slot? This frees every student to choose any track again.")) return;
    setResetting(true);
    await fetch("/api/timeslots/reset", { method: "POST" });
    setResetting(false);
    alert("All students reset — currentTrack cleared.");
  }

  const color =
    result?.status === "recorded"
      ? "bg-green-50 text-green-800 border-green-200"
      : result?.status === "already"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-red-50 text-red-800 border-red-200";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{trackName} — Workshop Scan</h1>
          <p className="text-sm text-slate-500">Select the active time slot, then scan.</p>
        </div>

        <div className="card space-y-3">
          <div>
            <label className="label">Active Time Slot</label>
            <select className="input" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              <option value="">— choose a slot —</option>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({fmtTime(s.startTime)}){isSlotLive(s) ? " — NOW" : ""}
                </option>
              ))}
            </select>
          </div>
          {slotId && (
            <div className="text-sm">
              {activeSession ? (
                <div className="space-y-1">
                  <span className="text-slate-600">
                    Session: <strong>{activeSession.title}</strong>
                  </span>
                  {selectedSlot && !slotIsLive && (
                    <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
                      ⚠ This slot is not in progress (runs {fmtTime(selectedSlot.startTime)} –{" "}
                      {fmtTime(selectedSlot.endTime)}). Scans will be recorded against it anyway — double-check
                      you picked the right slot.
                    </p>
                  )}
                </div>
              ) : (
                <span className="text-red-600">No session for this track in the selected slot.</span>
              )}
            </div>
          )}
          <button className="btn-secondary" onClick={newTimeSlot} disabled={resetting}>
            {resetting ? "Resetting…" : "Start New Time Slot (reset currentTrack)"}
          </button>
        </div>

        {slotId && activeSession ? (
          <QrScanner onScan={handleScan} paused={busy} />
        ) : (
          <div className="card text-sm text-slate-400">Choose a time slot to enable the scanner.</div>
        )}
      </div>

      <div>
        {result && (
          <div className={`rounded-lg border p-5 ${color}`}>
            <div className="text-xs uppercase tracking-wide opacity-70">{result.status}</div>
            <div className="mt-1 text-lg font-medium">{result.message}</div>
          </div>
        )}
      </div>
    </div>
  );
}
