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
        <h1 className="text-xl font-semibold">Spreadsheet Import</h1>
        <p className="text-sm text-slate-500">
          Upload a .xlsx or .csv with columns: <code>name</code>, <code>email</code>, <code>studentId</code>.
          QR tokens are auto-generated. Duplicates are skipped.
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="card space-y-4">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 sm:gap-3">
            <Tile label="Total rows" value={summary.total} tone="text-slate-700" />
            <Tile label="Created" value={summary.created} tone="text-green-600" />
            <Tile label="Skipped" value={summary.skipped} tone="text-amber-600" />
            <Tile label="Errors" value={summary.errors} tone="text-red-600" />
          </div>

          <div className="max-h-80 overflow-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Student ID</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {summary.details.map((d, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">{d.row}</td>
                    <td className="px-3 py-1.5">{d.studentId ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`badge ${
                          d.status === "created"
                            ? "bg-green-100 text-green-700"
                            : d.status === "skipped"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">{d.reason ?? ""}</td>
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
    <div className="rounded-md bg-slate-50 p-3">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
