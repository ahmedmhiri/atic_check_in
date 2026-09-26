"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** (Re)send one student's QR code email — for "I never got my QR" at the desk. */
/** `sentLabel` is pre-formatted on the server (event timezone) so server and browser render the same text. */
export default function ResendQrButton({ id, email, sentLabel }: { id: string; email: string; sentLabel: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    if (!confirm(`Email the QR code to ${email}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/qr-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: "QR code emailed." } : { ok: false, text: data.error ?? `Failed (${res.status})` });
      if (res.ok) router.refresh();
    } catch {
      setMsg({ ok: false, text: "Network error — not sent" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm">
        <div className="eyebrow mb-1">QR Code Email</div>
        <div className="text-slate-400">
          {sentLabel ? `Sent ${sentLabel}` : "Not sent yet"}
        </div>
        {msg && <div className={msg.ok ? "text-emerald-400" : "text-red-400"}>{msg.text}</div>}
      </div>
      <button className="btn-secondary w-full sm:w-auto" onClick={send} disabled={busy}>
        {busy ? "Sending…" : sentLabel ? "Resend QR code" : "Send QR code"}
      </button>
    </div>
  );
}
