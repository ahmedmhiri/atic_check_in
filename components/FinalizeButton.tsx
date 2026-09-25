"use client";

import { useState } from "react";

interface LogRow {
  id: string;
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

  // The server sends one time-boxed batch per call; keep calling until done.
  // Students already emailed are skipped server-side, so re-running is safe.
  async function run() {
    if (
      !confirm(
        "Finalize the event and email students their results? This sends real emails. " +
          "Students who were already emailed are skipped."
      )
    )
      return;
    setLoading(true);
    setSummary(null);
    setLog([]);

    const all: LogRow[] = [];
    const failedIds: string[] = [];
    let last: any = null;
    try {
      while (true) {
        const res = await fetch("/api/finalize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ skipIds: failedIds }),
        });
        const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        if (!res.ok || !data.summary) {
          last = { error: data.error ?? `Server error (${res.status})` };
          break;
        }
        const batch: LogRow[] = data.log ?? [];
        all.push(...batch);
        failedIds.push(...batch.filter((l) => l.status === "failed").map((l) => l.id));
        last = data.summary;
        setLog([...all]);
        setSummary({ ...totals(all), remaining: last.remaining, alreadySent: last.alreadySent, running: true });
        if (last.remaining === 0 || batch.length === 0) break;
      }
    } catch {
      last = { error: "Network error — re-run Finalize to continue (already-emailed students are skipped)." };
    }

    setLoading(false);
    setSummary(last?.error ? { ...totals(all), error: last.error } : { ...last, ...totals(all), running: false });
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
          {summary.error && <div className="text-red-600">{summary.error}</div>}
          <span>
            Sent <b className="text-green-600">{summary.sent}</b>, failed{" "}
            <b className="text-red-600">{summary.failed}</b> · eligible {summary.eligible}, not eligible{" "}
            {summary.notEligible}
            {summary.running && <> · {summary.remaining} remaining…</>}
            {!summary.running && summary.alreadySent !== undefined && (
              <> · {summary.alreadySent} students emailed in total</>
            )}
          </span>
          {!summary.running && summary.failed > 0 && (
            <div className="text-xs text-slate-500">Run Finalize again to retry the failed ones.</div>
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
                <tr key={l.id} className="border-t border-slate-100">
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

function totals(rows: LogRow[]) {
  return {
    sent: rows.filter((l) => l.status === "sent").length,
    failed: rows.filter((l) => l.status === "failed").length,
    eligible: rows.filter((l) => l.eligible).length,
    notEligible: rows.filter((l) => !l.eligible).length,
  };
}
