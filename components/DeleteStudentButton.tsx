"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Danger-zone card: permanently delete a student and all their records. */
export default function DeleteStudentButton({ id, name, studentId }: { id: string; name: string; studentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    // Type-to-confirm: a single tap on a phone shouldn't be enough to wipe someone.
    const typed = prompt(
      `Delete ${name} (${studentId})?\n\nThis permanently removes their hotel check-in, track choices and attendance. It cannot be undone.\n\nType the student ID to confirm:`
    );
    if (typed === null) return;
    if (typed.trim() !== studentId) {
      setError("Student ID didn't match — nothing was deleted.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Delete failed (${res.status})`);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — nothing was deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-red-400/30">
      <div className="text-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Danger zone</div>
        <div className="mt-1 text-slate-400">Permanently delete this student and all their records.</div>
        {error && <div className="mt-1 text-red-400">{error}</div>}
      </div>
      <button className="btn-danger w-full sm:w-auto" onClick={remove} disabled={busy}>
        {busy ? "Deleting…" : "Delete student"}
      </button>
    </div>
  );
}
