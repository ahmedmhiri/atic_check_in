"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface Account {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SCANNER";
  assignedTrackId: string | null;
  assignedTrack: { name: string } | null;
}
interface Track {
  id: string;
  name: string;
}

// No 0/O/1/l/I — passwords get read aloud or typed from a screenshot.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generatePassword(len = 10) {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export default function VolunteerManager({ accounts, tracks, meId }: { accounts: Account[]; tracks: Track[]; meId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SCANNER", assignedTrackId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Shown once after create / reset so the admin can pass the login on.
  const [share, setShare] = useState<{ title: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/volunteers", "POST", { ...form, assignedTrackId: form.assignedTrackId || null });
      setShare({ title: `Account created for ${form.name}`, email: form.email.toLowerCase().trim(), password: form.password });
      setCopied(false);
      setForm({ name: "", email: "", password: "", role: "SCANNER", assignedTrackId: "" });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function update(a: Account, patch: Record<string, unknown>) {
    setError("");
    try {
      await api(`/api/volunteers/${a.id}`, "PATCH", patch);
      router.refresh();
    } catch (err: any) {
      setError(`${a.name}: ${err.message}`);
    }
  }

  async function resetPassword(a: Account) {
    const password = generatePassword();
    if (!confirm(`Set a new password for ${a.name}? Their current password stops working.`)) return;
    try {
      await api(`/api/volunteers/${a.id}`, "PATCH", { password });
      setShare({ title: `New password for ${a.name}`, email: a.email, password });
      setCopied(false);
    } catch (err: any) {
      setError(`${a.name}: ${err.message}`);
    }
  }

  async function remove(a: Account) {
    if (!confirm(`Remove ${a.name} (${a.email})? Their phone is signed out within about 2 minutes.`)) return;
    try {
      await api(`/api/volunteers/${a.id}`, "DELETE");
      router.refresh();
    } catch (err: any) {
      setError(`${a.name}: ${err.message}`);
    }
  }

  async function copyShare() {
    if (!share) return;
    const text = `ATIC 2.0 check-in — ${location.origin}/login\nEmail: ${share.email}\nPassword: ${share.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {share && (
        <div className="card !border-accent/60 space-y-3">
          <p className="eyebrow">{share.title}</p>
          <div className="rounded border border-white/10 bg-navy-950 p-3 font-mono text-sm leading-relaxed text-white">
            <div>Email: {share.email}</div>
            <div>
              Password: <span className="text-accent">{share.password}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">Send this to the volunteer now — the password isn&apos;t shown again.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={copyShare}>
              {copied ? "Copied ✓" : "Copy login"}
            </button>
            <button className="btn-secondary" onClick={() => setShare(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <form onSubmit={create} className="card space-y-4 !shadow-block">
        <h2 className="eyebrow">(01) Add account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="v-name">Name</label>
            <input id="v-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="v-email">Email</label>
            <input
              id="v-email"
              className="input"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="v-pass">Password</label>
            <div className="flex gap-2">
              <input
                id="v-pass"
                className="input font-mono"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="min 8 characters"
                required
              />
              <button type="button" className="btn-secondary shrink-0" onClick={() => setForm({ ...form, password: generatePassword() })}>
                Generate
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="v-role">Role</label>
              <select id="v-role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="SCANNER">Volunteer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="v-track">Track lock</label>
              <select
                id="v-track"
                className="input"
                value={form.role === "ADMIN" ? "" : form.assignedTrackId}
                disabled={form.role === "ADMIN"}
                onChange={(e) => setForm({ ...form, assignedTrackId: e.target.value })}
              >
                <option value="">Any track</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} only
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          <b className="text-slate-200">Volunteers</b> can only use the Scan pages (hotel desk + workshop scanners).{" "}
          <b className="text-slate-200">Admins</b> can do everything, including deleting students and sending certificates.
        </p>
        <button className="btn-primary w-full sm:w-auto" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <div className="card">
        <h2 className="eyebrow mb-3">(02) Accounts · {accounts.length}</h2>
        <ul className="divide-y divide-white/10">
          {accounts.map((a) => {
            const isMe = a.id === meId;
            return (
              <li key={a.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{a.name}</span>
                    <span className={`badge ${a.role === "ADMIN" ? "bg-accent text-navy-950" : "bg-brand text-white"}`}>
                      {a.role === "ADMIN" ? "Admin" : "Volunteer"}
                    </span>
                    {isMe && <span className="badge border border-white/30 text-slate-300">You</span>}
                  </div>
                  <div className="truncate font-mono text-xs text-slate-400">{a.email}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.role === "SCANNER" && (
                    <select
                      className="input !w-auto !min-h-0 py-1.5 text-sm"
                      aria-label={`Track lock for ${a.name}`}
                      value={a.assignedTrackId ?? ""}
                      onChange={(e) => update(a, { assignedTrackId: e.target.value || null })}
                    >
                      <option value="">Any track</option>
                      {tracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} only
                        </option>
                      ))}
                    </select>
                  )}
                  {!isMe && (
                    <select
                      className="input !w-auto !min-h-0 py-1.5 text-sm"
                      aria-label={`Role for ${a.name}`}
                      value={a.role}
                      onChange={(e) => update(a, { role: e.target.value })}
                    >
                      <option value="SCANNER">Volunteer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  )}
                  <button className="btn-secondary !min-h-0 px-3 py-1.5 text-xs" onClick={() => resetPassword(a)}>
                    New password
                  </button>
                  {!isMe && (
                    <button className="btn-danger !min-h-0 px-3 py-1.5 text-xs" onClick={() => remove(a)}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
