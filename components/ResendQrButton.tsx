"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** (Re)send one student's QR code email — for "I never got my QR" at the desk. */
export default function ResendQrButton({ id, email, sentAt }: { id: string; email: string; sentAt: string | null }) {
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
        <div className="font-semibold text-slate-500">QR Code Email</div>
        <div className="text-slate-500">
          {sentAt ? `Sent ${new Date(sentAt).toLocaleString()}` : "Not sent yet"}
        </div>
        {msg && <div className={msg.ok ? "text-green-600" : "text-red-600"}>{msg.text}</div>}
      </div>
      <button className="btn-secondary w-full sm:w-auto" onClick={send} disabled={busy}>
        {busy ? "Sending…" : sentAt ? "Resend QR code" : "Send QR code"}
      </button>
    </div>
  );
}
