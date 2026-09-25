"use client";

import { useState } from "react";
import EmailBatchCard from "@/components/EmailBatchCard";

interface Summary {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  details: { row: number; studentId?: string; status: string; reason?: string }[];
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setSummary(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
      if (!res.ok) setError(data.error ?? "Import failed");
      else setSummary(data);
    } catch {
      setError("Network error — check your connection and try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Spreadsheet Import</h1>
        <p className="text-sm text-slate-400">
          Upload the <b className="text-slate-200">Google Form responses</b> export (.csv or .xlsx). Only the{" "}
          <b className="text-slate-200">name</b> and <b className="text-slate-200">email</b> columns are used — everything else is
          ignored. Students get IDs <code>ATIC-0001</code>, <code>ATIC-0002</code>… (or your own if the sheet has a Student ID
          column). If someone answered twice, their latest response is used. Re-upload the updated sheet any time: only new
          people are added.
        </p>
      </div>

      <form onSubmit={upload} className="card flex flex-wrap items-end gap-3">
        <div className="w-full grow sm:w-auto">
          <label className="label">File</label>
          <input
            type="file"
            // MIME types too: some Android file pickers grey out files matched by extension only.
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="input"
          />
        </div>
        <button className="btn-primary w-full sm:w-auto" disabled={!file || loading}>
          {loading ? "Importing…" : "Import"}
        </button>
        <a href="/api/qr" className="btn-secondary w-full sm:w-auto">
          Download QR ZIP
        </a>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {summary && (
        <div className="card space-y-4">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 sm:gap-3">
            <Tile label="Total rows" value={summary.total} tone="text-slate-100" />
            <Tile label="Created" value={summary.created} tone="text-emerald-400" />
            <Tile label="Skipped" value={summary.skipped} tone="text-amber-300" />
            <Tile label="Errors" value={summary.errors} tone="text-red-400" />
          </div>

          <div className="max-h-80 overflow-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-navy-900 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Student ID</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {summary.details.map((d, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-1.5">{d.row}</td>
                    <td className="px-3 py-1.5">{d.studentId ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`badge ${
                          d.status === "created"
                            ? "bg-emerald-400/15 text-emerald-300"
                            : d.status === "skipped"
                            ? "bg-amber-400/15 text-amber-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">{d.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EmailBatchCard
        endpoint="/api/qr-email"
        title="Email QR Codes to Students"
        description="Sends each student their personal check-in QR code. Only students who haven't received it yet are emailed — safe to run again after importing more."
        buttonLabel="Email QR Codes"
        confirmText="Email every student their check-in QR code? This sends real emails."
      />
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-white/5 p-3">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
