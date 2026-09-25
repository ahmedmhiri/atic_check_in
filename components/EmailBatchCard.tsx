"use client";

import { useState } from "react";

interface LogRow {
  id: string;
  studentId: string;
  name: string;
  status: "sent" | "failed";
  error?: string;
  attendancePct?: number;
  eligible?: boolean;
}

interface Props {
  endpoint: string;
  title: string;
  description: string;
  buttonLabel: string;
  confirmText: string;
  /** Show attendance % / eligibility columns (finalize only). */
  showEligibility?: boolean;
}

/**
 * Runs a batched email job. The server sends one time-boxed batch per call;
 * keep calling until done. Already-emailed students are skipped server-side,
 * so re-running is safe.
 */
export default function EmailBatchCard({ endpoint, title, description, buttonLabel, confirmText, showEligibility }: Props) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [log, setLog] = useState<LogRow[]>([]);

  async function run() {
    if (!confirm(`${confirmText} Students who were already emailed are skipped.`)) return;
    setLoading(true);
    setSummary(null);
    setLog([]);

    const all: LogRow[] = [];
    const failedIds: string[] = [];
    let last: any = null;
    try {
      while (true) {
        const res = await fetch(endpoint, {
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
        if (last.stopped) {
          // Login rejected / daily limit — every further call would fail the same way.
          last = { ...last, error: last.stopped };
          break;
        }
        if (last.remaining === 0 || batch.length === 0) break;
      }
    } catch {
      last = { error: "Network error — run it again to continue (already-emailed students are skipped)." };
    }

    setLoading(false);
    setSummary(
      last?.error
        ? { ...totals(all), alreadySent: last.alreadySent, error: last.error }
        : { ...last, ...totals(all), running: false }
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="eyebrow">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <button className="btn-primary w-full sm:w-auto" onClick={run} disabled={loading}>
          {loading ? "Sending…" : buttonLabel}
        </button>
      </div>

      {summary && (
        <div className="rounded-lg bg-white/5 p-3 text-sm">
          {summary.error && <div className="text-red-400">{summary.error}</div>}
          <span>
            Sent <b className="text-emerald-400">{summary.sent}</b>, failed <b className="text-red-400">{summary.failed}</b>
            {showEligibility && (
              <>
                {" "}
                · eligible {summary.eligible}, not eligible {summary.notEligible}
              </>
            )}
            {summary.running && <> · {summary.remaining} remaining…</>}
            {!summary.running && summary.alreadySent !== undefined && (
              <> · {summary.alreadySent} students emailed in total</>
            )}
          </span>
          {!summary.running && summary.failed > 0 && (
            <div className="text-xs text-slate-400">Run it again to retry the failed ones.</div>
          )}
        </div>
      )}

      {log.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-navy-900 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2">Student</th>
                {showEligibility && (
                  <>
                    <th className="px-3 py-2">%</th>
                    <th className="px-3 py-2">Eligible</th>
                  </>
                )}
                <th className="px-3 py-2">Send</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className="border-t border-white/5 align-top">
                  <td className="px-3 py-1.5">
                    {l.name} <span className="text-slate-500">({l.studentId})</span>
                    {/* Inline, not a tooltip — tooltips don't exist on touch screens. */}
                    {l.error && <div className="text-xs text-red-400">{l.error}</div>}
                  </td>
                  {showEligibility && (
                    <>
                      <td className="px-3 py-1.5">{l.attendancePct}%</td>
                      <td className="px-3 py-1.5">{l.eligible ? "✅" : "—"}</td>
                    </>
                  )}
                  <td className="px-3 py-1.5">
                    {l.status === "sent" ? (
                      <span className="text-emerald-400">sent</span>
                    ) : (
                      <span className="text-red-400">failed</span>
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
    notEligible: rows.filter((l) => l.eligible === false).length,
  };
}
