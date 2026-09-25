"use client";

import { useState } from "react";

interface LogRow {
  studentId: string;
  name: string;
  attendancePct: number;
  eligible: boolean;
  status: "sent" | "failed";
  error?: string;
}

export default function FinalizeButton() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [log, setLog] = useState<LogRow[]>([]);

  async function run() {
    if (!confirm("Finalize the event and email ALL students their results? This sends real emails.")) return;
    setLoading(true);
    setSummary(null);
    const res = await fetch("/api/finalize", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    setSummary(data.summary ?? { error: data.error });
    setLog(data.log ?? []);
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-500">Finalize Event</h2>
          <p className="text-xs text-slate-400">Computes attendance % and emails certificates / notices.</p>
        </div>
        <button className="btn-primary" onClick={run} disabled={loading}>
          {loading ? "Sending…" : "Finalize & Send Certificates"}
        </button>
      </div>

      {summary && (
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          {summary.error ? (
            <span className="text-red-600">{summary.error}</span>
          ) : (
            <span>
              Sent <b className="text-green-600">{summary.sent}</b>, failed{" "}
              <b className="text-red-600">{summary.failed}</b> · eligible {summary.eligible}, not eligible{" "}
              {summary.notEligible}
            </span>
          )}
        </div>
      )}

      {log.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">%</th>
                <th className="px-3 py-2">Eligible</th>
                <th className="px-3 py-2">Send</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.studentId} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    {l.name} <span className="text-slate-400">({l.studentId})</span>
                  </td>
                  <td className="px-3 py-1.5">{l.attendancePct}%</td>
                  <td className="px-3 py-1.5">{l.eligible ? "✅" : "—"}</td>
                  <td className="px-3 py-1.5">
                    {l.status === "sent" ? (
                      <span className="text-green-600">sent</span>
                    ) : (
                      <span className="text-red-600" title={l.error}>
                        failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
