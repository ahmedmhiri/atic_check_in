"use client";

/** The student's check-in QR, with Print (badge only — see .print-area in globals.css) and PNG download. */
export default function QrCard({ src, name, studentId }: { src: string; name: string; studentId: string }) {
  const file = `${studentId}_${name}`.replace(/[^a-z0-9_\-]+/gi, "_").slice(0, 80) + ".png";

  return (
    <div className="card flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="print-area flex flex-col items-center gap-2 text-center">
        <img src={src} alt={`Check-in QR code for ${name}`} width={224} height={224} className="rounded bg-white p-1 print:h-auto print:w-[7cm]" />
        <div className="hidden print:block">
          <div className="text-xl font-bold">{name}</div>
          <div className="font-mono text-sm">{studentId}</div>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto">
        <div className="eyebrow">Check-In QR Code</div>
        <p className="text-sm text-slate-400">Same code as in the email. Print it as a badge or save the image.</p>
        <button className="btn-primary w-full sm:w-auto" onClick={() => window.print()}>
          Print
        </button>
        <a href={src} download={file} className="btn-secondary w-full sm:w-auto">
          Download PNG
        </a>
      </div>
    </div>
  );
}
