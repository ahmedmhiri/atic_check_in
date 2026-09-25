"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QrScanner from "@/components/QrScanner";
import ScanResult, { ScanTone } from "@/components/ScanResult";

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

type Result = { status: string; message: string; at: number } | null;

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
        const data = await res.json().catch(() => ({ message: `Server error (${res.status})` }));
        setResult({ status: data.status ?? "error", message: data.message ?? data.error, at: Date.now() });
      } catch {
        setResult({ status: "error", message: "Network error — check your connection", at: Date.now() });
      } finally {
        setTimeout(() => setBusy(false), 1400);
      }
    },
    [busy, slotId, activeSession, trackId]
  );

  async function newTimeSlot() {
    if (!confirm("Start a new time slot? This frees every student to choose any track again.")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/timeslots/reset", { method: "POST" });
      alert(res.ok ? "All students reset — currentTrack cleared." : `Reset failed (${res.status})`);
    } catch {
      alert("Network error — reset not applied");
    } finally {
      setResetting(false);
    }
  }

  const tone: ScanTone =
    result?.status === "recorded" ? "ok" : result?.status === "already" ? "warn" : "error";

  // Single column on every screen: slot picker, result banner, camera. On a
  // phone the result must sit above the camera to be visible without scrolling.
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h1 className="text-2xl sm:text-3xl">{trackName} — Workshop Scan</h1>

      <div className="card space-y-2">
        <label className="label" htmlFor="slot">
          Active Time Slot
        </label>
        <select id="slot" className="input" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
          <option value="">— choose a slot —</option>
          {slots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({fmtTime(s.startTime)}){isSlotLive(s) ? " — NOW" : ""}
            </option>
          ))}
        </select>
        {slotId && !activeSession && (
          <p className="text-sm text-red-400">No session for this track in the selected slot.</p>
        )}
        {activeSession && selectedSlot && !slotIsLive && (
          <p className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-sm text-amber-200">
            ⚠ This slot is not in progress (runs {fmtTime(selectedSlot.startTime)} –{" "}
            {fmtTime(selectedSlot.endTime)}). Scans will be recorded against it anyway — double-check you picked
            the right slot.
          </p>
        )}
      </div>

      {slotId && activeSession ? (
        <>
          <ScanResult result={result} tone={tone} idleText={`Scanning for ${activeSession.title}`} />
          <QrScanner onScan={handleScan} paused={busy} />
        </>
      ) : (
        <div className="card text-sm text-slate-500">Choose a time slot to enable the scanner.</div>
      )}

      {/* Kept at the bottom, away from the scan area, so it isn't hit by accident. */}
      <div className="pt-4">
        <button className="btn-secondary w-full" onClick={newTimeSlot} disabled={resetting}>
          {resetting ? "Resetting…" : "Start New Time Slot (reset currentTrack)"}
        </button>
      </div>
    </div>
  );
}
