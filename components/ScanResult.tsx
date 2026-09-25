"use client";

import { useEffect } from "react";

export type ScanTone = "ok" | "warn" | "error";

const TONES: Record<ScanTone, string> = {
  ok: "bg-green-600 text-white border-green-700",
  warn: "bg-amber-400 text-amber-950 border-amber-500",
  error: "bg-red-600 text-white border-red-700",
};

/**
 * Big, high-contrast result banner that sits ABOVE the camera so it is visible
 * on a phone without scrolling. Vibrates on Android (no-op on iOS).
 */
export default function ScanResult({
  result,
  tone,
  idleText,
}: {
  result: { status: string; message: string; at: number } | null;
  tone: ScanTone;
  idleText: string;
}) {
  useEffect(() => {
    if (!result) return;
    try {
      navigator.vibrate?.(tone === "ok" ? 80 : tone === "warn" ? [60, 60, 60] : [200, 80, 200]);
    } catch {
      /* unsupported */
    }
  }, [result, tone]);

  if (!result) {
    return (
      <div className="flex min-h-[4.5rem] items-center rounded-lg border border-dashed border-white/15 bg-white/5 px-4 text-sm text-slate-400">
        {idleText}
      </div>
    );
  }

  return (
    <div
      key={result.at}
      role="status"
      aria-live="assertive"
      className={`min-h-[4.5rem] rounded-lg border px-4 py-3 shadow-glass ${TONES[tone]}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{result.status.replace("_", " ")}</div>
      <div className="text-lg font-semibold leading-snug">{result.message}</div>
    </div>
  );
}
