"use client";

import { useCallback, useEffect, useState } from "react";
import QrScanner from "@/components/QrScanner";
import ScanResult, { ScanTone } from "@/components/ScanResult";

type Result = { status: string; message: string; at: number } | null;

export default function HotelScanPage() {
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{ hotelCheckedIn: number; notArrived: number; totalStudents: number } | null>(null);

  const loadStats = useCallback(async () => {
    if (document.hidden) return; // don't poll from a locked phone
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (res.ok) setStats(await res.json());
    } catch {
      /* offline — keep last numbers */
    }
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 5000);
    document.addEventListener("visibilitychange", loadStats);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", loadStats);
    };
  }, [loadStats]);

  const handleScan = useCallback(
    async (qrToken: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await fetch("/api/checkin/hotel", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ qrToken }),
        });
        const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        setResult({
          status: data.status ?? (res.ok ? "ok" : "error"),
          message: data.message ?? data.error,
          at: Date.now(),
        });
        loadStats();
      } catch {
        setResult({ status: "error", message: "Network error — check your connection", at: Date.now() });
      } finally {
        setTimeout(() => setBusy(false), 1200);
      }
    },
    [busy, loadStats]
  );

  const tone: ScanTone =
    result?.status === "checked_in" ? "ok" : result?.status === "already" ? "warn" : "error";

  return (
    <div className="mx-auto max-w-lg space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl">Hotel Check-In</h1>
        {stats && (
          <span className="text-sm text-slate-400">
            <b className="text-emerald-400">{stats.hotelCheckedIn}</b> / {stats.totalStudents} arrived
          </span>
        )}
      </div>

      <ScanResult result={result} tone={tone} idleText="Point the camera at a student's QR badge." />

      <QrScanner onScan={handleScan} paused={busy} />

      <div className="card">
        <h2 className="mb-3 eyebrow">Live Arrivals</h2>
        {stats ? (
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            <Stat label="Arrived" value={stats.hotelCheckedIn} tone="text-emerald-400" />
            <Stat label="Not yet" value={stats.notArrived} tone="text-amber-300" />
            <Stat label="Total" value={stats.totalStudents} tone="text-slate-100" />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-white/5 p-3">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
