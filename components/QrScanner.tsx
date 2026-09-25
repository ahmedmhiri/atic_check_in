"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onScan: (token: string) => void;
  // When true, scanning is suspended (e.g. while showing a result).
  paused?: boolean;
}

const REGION_ID = "qr-reader-region";

export default function QrScanner({ onScan, paused }: Props) {
  const scannerRef = useRef<any>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(REGION_ID, false);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            const now = Date.now();
            // debounce repeat reads of the same code within 2.5s
            if (decodedText === lastScanRef.current.text && now - lastScanRef.current.at < 2500) return;
            lastScanRef.current = { text: decodedText, at: now };
            onScan(decodedText.trim());
          },
          () => {}
        );
        if (!cancelled) setRunning(true);
      } catch (e: any) {
        setError(e?.message ?? "Could not start camera. Use manual entry below.");
      }
    }

    start();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [onScan]);

  // Pause/resume the live camera when result is shown.
  useEffect(() => {
    const s = scannerRef.current;
    if (!s || !running) return;
    try {
      if (paused) s.pause(true);
      else s.resume();
    } catch {
      /* pause() throws if not scanning; ignore */
    }
  }, [paused, running]);

  return (
    <div className="space-y-3">
      <div id={REGION_ID} className="overflow-hidden rounded-lg border border-slate-300 bg-black" />
      {error && <p className="text-sm text-amber-600">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) {
            onScan(manual.trim());
            setManual("");
          }
        }}
        className="flex gap-2"
      >
        <input
          className="input"
          placeholder="Manual token entry (fallback)"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button className="btn-secondary shrink-0">Submit</button>
      </form>
    </div>
  );
}
