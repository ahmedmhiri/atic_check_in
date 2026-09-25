"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onScan: (token: string) => void;
  // When true, scanning is suspended (e.g. while showing a result).
  paused?: boolean;
}

const REGION_ID = "qr-reader-region";

const IN_APP_HINT =
  "If you opened this link from WhatsApp, Instagram, Messenger or similar, open it in Chrome or Safari instead.";

/** Turn getUserMedia / html5-qrcode failures into something a volunteer can act on. */
function cameraErrorMessage(e: unknown): string {
  const raw = `${(e as any)?.name ?? ""} ${(e as any)?.message ?? e ?? ""}`;
  if (/NotAllowed|Permission|denied/i.test(raw))
    return "Camera permission was denied. Allow camera access for this site in your browser settings, then reload the page.";
  if (/NotFound|DevicesNotFound|no camera/i.test(raw)) return "No camera found on this device.";
  if (/NotReadable|TrackStart|Could not start video source/i.test(raw))
    return "The camera is being used by another app. Close other camera apps and reload the page.";
  if (/Overconstrained/i.test(raw)) return "This camera isn't supported. Try another browser.";
  return `Could not start the camera. ${IN_APP_HINT}`;
}

export default function QrScanner({ onScan, paused }: Props) {
  const scannerRef = useRef<any>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [running, setRunning] = useState(false);

  // Parents recreate onScan whenever their state changes (e.g. `busy`).
  // Read it through a ref so the camera is started once, not on every scan.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let disposed = false;
    let scanner: any = null;
    let wakeLock: any = null;

    // html5-qrcode throws if start/stop overlap, so run them strictly in order.
    let queue: Promise<void> = Promise.resolve();
    const enqueue = (fn: () => Promise<void>) => {
      queue = queue.then(fn, fn);
    };

    async function acquireWakeLock() {
      // Keep the screen on while scanning (Android Chrome, iOS 16.4+).
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        }
      } catch {
        /* not supported / not allowed — harmless */
      }
    }

    async function stop() {
      const s = scanner;
      scanner = null;
      scannerRef.current = null;
      setRunning(false);
      wakeLock?.release?.().catch(() => {});
      wakeLock = null;
      if (!s) return;
      try {
        await s.stop();
      } catch {
        /* already stopped */
      }
      try {
        s.clear();
      } catch {
        /* ignore */
      }
    }

    async function start() {
      if (disposed || scanner || document.hidden) return;
      if (!window.isSecureContext) {
        setError("The camera only works over HTTPS. Open the https:// address of this site.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(`This browser can't access the camera. ${IN_APP_HINT} You can still type tokens below.`);
        return;
      }
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (disposed) return;
        const s = new Html5Qrcode(REGION_ID, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          // Native BarcodeDetector (most Android phones) is much faster than the JS decoder.
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scanner = s;
        scannerRef.current = s;
        await s.start(
          { facingMode: "environment" },
          {
            fps: 10,
            // Scan box scales with the screen instead of a fixed 250px.
            qrbox: (w: number, h: number) => {
              const size = Math.max(150, Math.floor(Math.min(w, h) * 0.7));
              return { width: size, height: size };
            },
          },
          (decodedText: string) => {
            const now = Date.now();
            // debounce repeat reads of the same code within 2.5s
            if (decodedText === lastScanRef.current.text && now - lastScanRef.current.at < 2500) return;
            lastScanRef.current = { text: decodedText, at: now };
            onScanRef.current(decodedText.trim());
          },
          () => {}
        );
        if (disposed || document.hidden) {
          await stop();
          return;
        }
        setError("");
        setRunning(true);
        acquireWakeLock();
      } catch (e) {
        scanner = null;
        scannerRef.current = null;
        setRunning(false);
        setError(cameraErrorMessage(e));
      }
    }

    // Phones kill the camera stream when the screen locks or the app is
    // switched; iOS then shows a frozen/black video. Stop on hide, restart on show.
    function onVisibility() {
      if (document.hidden) enqueue(stop);
      else enqueue(start);
    }

    // The library sizes the video and scan box in pixels at start, so a
    // rotation (width change) needs a restart to stay aligned.
    let lastWidth = window.innerWidth;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth === lastWidth) return; // ignore mobile URL-bar height changes
        lastWidth = window.innerWidth;
        enqueue(stop);
        enqueue(start);
      }, 400);
    }

    enqueue(start);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      enqueue(stop);
    };
  }, []);

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
      <div
        id={REGION_ID}
        className="min-h-[12rem] w-full overflow-hidden rounded-2xl border border-accent/25 bg-black shadow-glass"
      />
      {error && <p className="rounded-md bg-amber-400/10 p-3 text-sm text-amber-200">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // During the post-scan cooldown the parent ignores scans, so keep
          // the typed token instead of clearing it into the void.
          if (paused || !manual.trim()) return;
          onScan(manual.trim());
          setManual("");
        }}
        className="flex gap-2"
      >
        <input
          className="input font-mono"
          placeholder="Manual token entry (fallback)"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <button className="btn-secondary shrink-0" disabled={paused}>
          {paused ? "Wait…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
