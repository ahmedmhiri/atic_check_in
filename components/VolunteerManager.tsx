"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface Account {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "SCANNER";
  assignedTrackId: string | null;
  assignedTrack: { name: string } | null;
}
const ROLE_LABEL: Record<Account["role"], string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  SCANNER: "Volunteer",
};

const ROLE_BADGE: Record<Account["role"], string> = {
  SUPER_ADMIN: "bg-white text-navy-950",
  ADMIN: "bg-accent text-navy-950",
  SCANNER: "bg-brand text-white",
};

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface BulkResult {
  line: number;
  name: string;
  email: string;
  status: "ok" | "error";
  msg: string;
}

/** "Track B" / "b" / "any" -> track id (null = any track). undefined = no match. */
function matchTrack(v: string, tracks: Track[]): string | null | undefined {
  const norm = (x: string) => x.toLowerCase().replace(/^track\s*/, "").trim();
  if (!v || /^(any|all|-)$/i.test(v)) return null;
  return tracks.find((t) => norm(t.name) === norm(v))?.id;
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

export default function VolunteerManager({
  accounts,
  tracks,
  meId,
  canManage,
}: {
  accounts: Account[];
  tracks: Track[];
  meId: string;
  /** Only a super admin may create accounts, change roles or set passwords. */
  canManage: boolean;
}) {
  const router = useRouter();
  const emptyForm = { name: "", email: "", password: "", role: "SCANNER", assignedTrackId: "", sendEmail: true };
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkEmail, setBulkEmail] = useState(true);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkTitle, setBulkTitle] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Shown once after create / reset so the admin can pass the login on.
  const [share, setShare] = useState<{ title: string; email: string; password: string; note?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await api("/api/volunteers", "POST", { ...form, assignedTrackId: form.assignedTrackId || null });
      const note = !form.sendEmail
        ? undefined
        : res.emailed
          ? `✓ Login emailed to ${form.email.trim()}`
          : `⚠ Account created, but the email failed: ${res.emailError ?? "unknown error"}. Share the login below instead.`;
      setShare({ title: `Account created for ${form.name}`, email: form.email.toLowerCase().trim(), password: form.password, note });
      setCopied(false);
      setForm(emptyForm);
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

  async function emailLogin(a: Account) {
    if (!confirm(`Email ${a.name} a new login at ${a.email}? Their current password stops working.`)) return;
    setError("");
    setNotice("");
    try {
      await api(`/api/volunteers/${a.id}/send-login`, "POST");
      setNotice(`✓ New login emailed to ${a.name} (${a.email}).`);
    } catch (err: any) {
      setError(`${a.name}: ${err.message}`);
    }
  }

  // One request per person, sent in sequence: progress is visible and a long
  // list can never hit a server timeout.
  async function runBulkAdd() {
    const lines = bulkText.split(/\r?\n/).map((l, i) => ({ n: i + 1, raw: l.trim() })).filter((l) => l.raw);
    if (!lines.length) return;
    if (!confirm(`Create ${lines.length} account(s)${bulkEmail ? " and email each person their login" : ""}?`)) return;
    setBulkRunning(true);
    setBulkTitle("Adding accounts");
    setBulkResults([]);
    const results: BulkResult[] = [];
    for (const { n, raw } of lines) {
      const [name = "", email = "", third = "", fourth = ""] = raw.split(/[,;\t]/).map((x) => x.trim());
      const isAdmin = [third, fourth].some((x) => /^admin$/i.test(x));
      const trackField = [third, fourth].find((x) => x && !/^(admin|volunteer|scanner)$/i.test(x)) ?? "";
      const trackId = isAdmin ? null : matchTrack(trackField, tracks);
      const fail = (msg: string) => results.push({ line: n, name, email, status: "error", msg });
      if (!name || !EMAIL_RE.test(email)) fail("Needs: name, email");
      else if (trackId === undefined) fail(`Unknown track "${trackField}"`);
      else {
        try {
          const res = await api("/api/volunteers", "POST", {
            name,
            email,
            password: generatePassword(),
            role: isAdmin ? "ADMIN" : "SCANNER",
            assignedTrackId: trackId,
            sendEmail: bulkEmail,
          });
          results.push({
            line: n,
            name,
            email,
            status: !bulkEmail || res.emailed ? "ok" : "error",
            msg: !bulkEmail ? "Created (not emailed)" : res.emailed ? "Created + login emailed" : `Created, email failed: ${res.emailError}`,
          });
        } catch (err: any) {
          fail(err.message);
        }
        if (bulkEmail) await sleep(700); // be gentle with Gmail's sending limits
      }
      setBulkResults([...results]);
    }
    setBulkRunning(false);
    if (results.every((r) => r.status === "ok")) setBulkText("");
    router.refresh();
  }

  async function emailAllVolunteers() {
    const targets = accounts.filter((a) => a.role === "SCANNER" && a.id !== meId);
    if (!targets.length) return;
    if (!confirm(`Email a NEW login to all ${targets.length} volunteers? Their current passwords stop working.`)) return;
    setBulkRunning(true);
    setBulkTitle("Emailing new logins");
    setBulkResults([]);
    const results: BulkResult[] = [];
    for (const [i, a] of targets.entries()) {
      try {
        await api(`/api/volunteers/${a.id}/send-login`, "POST");
        results.push({ line: i + 1, name: a.name, email: a.email, status: "ok", msg: "New login emailed" });
      } catch (err: any) {
        results.push({ line: i + 1, name: a.name, email: a.email, status: "error", msg: err.message });
      }
      setBulkResults([...results]);
      await sleep(700);
    }
    setBulkRunning(false);
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
      {notice && <p className="rounded border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300">{notice}</p>}

      {share && (
        <div className="card !border-accent/60 space-y-3">
          <p className="eyebrow">{share.title}</p>
          <div className="rounded border border-white/10 bg-navy-950 p-3 font-mono text-sm leading-relaxed text-white">
            <div>Email: {share.email}</div>
            <div>
              Password: <span className="text-accent">{share.password}</span>
            </div>
          </div>
          {share.note && (
            <p className={`text-sm ${share.note.startsWith("✓") ? "text-emerald-300" : "text-amber-300"}`}>{share.note}</p>
          )}
          <p className="text-xs text-slate-400">
            {share.note?.startsWith("✓") ? "You can also copy it here as a backup" : "Send this to the volunteer now"} — the password
            isn&apos;t shown again.
          </p>
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

      {canManage && (
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
                <option value="SUPER_ADMIN">Super admin</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="v-track">Track lock</label>
              <select
                id="v-track"
                className="input"
                value={form.role === "SCANNER" ? form.assignedTrackId : ""}
                disabled={form.role !== "SCANNER"}
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
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            className="h-5 w-5 accent-accent"
            checked={form.sendEmail}
            onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })}
          />
          Email the login to this person
        </label>
        <button className="btn-primary w-full sm:w-auto" disabled={busy}>
          {busy ? "Creating…" : form.sendEmail ? "Create & email login" : "Create account"}
        </button>
      </form>
      )}

      {canManage && (
      <div className="card space-y-3">
        <h2 className="eyebrow">(02) Add many at once</h2>
        <p className="text-sm text-slate-400">
          One person per line: <span className="font-mono text-slate-200">name, email, track</span>. Track is optional
          (<span className="font-mono">A</span>, <span className="font-mono">Track B</span>, or leave empty for any track); write{" "}
          <span className="font-mono">admin</span> instead of a track for an admin. Each person gets their own random password.
        </p>
        <textarea
          className="input min-h-[8rem] font-mono"
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"Amira Ben Salah, amira@gmail.com, Track A\nYoussef Sahnoun, youssef@gmail.com, B\nSara Trabelsi, sara@gmail.com, admin"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={bulkRunning}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" className="h-5 w-5 accent-accent" checked={bulkEmail} onChange={(e) => setBulkEmail(e.target.checked)} />
          Email each person their login
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary w-full sm:w-auto" onClick={runBulkAdd} disabled={bulkRunning || !bulkText.trim()}>
            {bulkRunning ? "Working…" : "Add accounts"}
          </button>
          <button
            className="btn-secondary w-full sm:w-auto"
            onClick={emailAllVolunteers}
            disabled={bulkRunning || !accounts.some((a) => a.role === "SCANNER")}
          >
            Email new logins to all volunteers
          </button>
        </div>
        {bulkResults.length > 0 && (
          <div className="rounded border border-white/10">
            <div className="border-b border-white/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-mist">
              {bulkTitle} · {bulkResults.filter((r) => r.status === "ok").length} ok,{" "}
              {bulkResults.filter((r) => r.status === "error").length} failed{bulkRunning ? " · working…" : ""}
            </div>
            <ul className="max-h-64 divide-y divide-white/5 overflow-auto text-sm">
              {bulkResults.map((r) => (
                <li key={`${r.line}-${r.email}`} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="text-white">{r.name || "(no name)"}</span>{" "}
                    <span className="font-mono text-xs text-slate-500">{r.email}</span>
                  </span>
                  <span className={r.status === "ok" ? "text-emerald-300" : "text-red-300"}>{r.msg}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      )}

      <div className="card">
        <h2 className="eyebrow mb-3">(03) Accounts · {accounts.length}</h2>
        <ul className="divide-y divide-white/10">
          {accounts.map((a) => {
            const isMe = a.id === meId;
            return (
              <li key={a.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{a.name}</span>
                    <span className={`badge ${ROLE_BADGE[a.role]}`}>{ROLE_LABEL[a.role]}</span>
                    {isMe && <span className="badge border border-white/30 text-slate-300">You</span>}
                  </div>
                  <div className="truncate font-mono text-xs text-slate-400">{a.email}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canManage && a.role === "SCANNER" && (
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
                  {canManage && !isMe && (
                    <select
                      className="input !w-auto !min-h-0 py-1.5 text-sm"
                      aria-label={`Role for ${a.name}`}
                      value={a.role}
                      onChange={(e) => update(a, { role: e.target.value })}
                    >
                      <option value="SCANNER">Volunteer</option>
                      <option value="ADMIN">Admin</option>
                      <option value="SUPER_ADMIN">Super admin</option>
                    </select>
                  )}
                  {canManage && (
                    <>
                      <button className="btn-secondary !min-h-0 px-3 py-1.5 text-xs" onClick={() => emailLogin(a)}>
                        Email login
                      </button>
                      <button className="btn-secondary !min-h-0 px-3 py-1.5 text-xs" onClick={() => resetPassword(a)}>
                        New password
                      </button>
                      {!isMe && (
                        <button className="btn-danger !min-h-0 px-3 py-1.5 text-xs" onClick={() => remove(a)}>
                          Remove
                        </button>
                      )}
                    </>
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
