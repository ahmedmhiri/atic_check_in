"use client";

import { useCallback, useEffect, useState } from "react";
import QrScanner from "@/components/QrScanner";

type Result = { status: string; message: string } | null;

export default function HotelScanPage() {
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{ hotelCheckedIn: number; notArrived: number; totalStudents: number } | null>(null);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/stats", { cache: "no-store" });
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 5000);
    return () => clearInterval(t);
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
        const data = await res.json();
        setResult({ status: data.status ?? (res.ok ? "ok" : "error"), message: data.message ?? data.error });
        loadStats();
      } catch {
        setResult({ status: "error", message: "Network error" });
      } finally {
        setTimeout(() => setBusy(false), 1200);
      }
    },
    [busy, loadStats]
  );

  const color =
    result?.status === "checked_in"
      ? "bg-green-50 text-green-800 border-green-200"
      : result?.status === "already"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-red-50 text-red-800 border-red-200";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Hotel Check-In</h1>
        <QrScanner onScan={handleScan} paused={busy} />
      </div>

      <div className="space-y-4">
        {result && (
          <div className={`rounded-lg border p-4 ${color}`}>
            <div className="text-xs uppercase tracking-wide opacity-70">{result.status}</div>
            <div className="text-lg font-medium">{result.message}</div>
          </div>
        )}

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">Live Arrivals</h2>
          {stats ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Arrived" value={stats.hotelCheckedIn} tone="text-green-600" />
              <Stat label="Not yet" value={stats.notArrived} tone="text-amber-600" />
              <Stat label="Total" value={stats.totalStudents} tone="text-slate-700" />
            </div>
          ) : (
            <p className="text-sm text-slate-400">Loading…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
