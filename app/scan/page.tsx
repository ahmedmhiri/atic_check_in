import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Scanner hub: big tap targets so volunteers on phones reach their scanner in one tap.
export default async function ScanHubPage() {
  const tracks = await prisma.track.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-mist">[ Volunteer scanners ]</p>
        <h1 className="mt-2 text-4xl">
          Scan <span className="pill-word">QR</span>
        </h1>
      </div>

      <Link
        href="/scan/hotel"
        className="block rounded-lg bg-accent p-5 text-navy-950 shadow-block transition hover:-translate-y-0.5 active:translate-y-0"
      >
        <div className="font-mono text-[11px] font-semibold opacity-70">/01 · Arrival desk</div>
        <div className="mt-1 font-display text-2xl font-black uppercase">Hotel check-in ↗</div>
      </Link>

      <div>
        <h2 className="eyebrow mb-2">(02) Workshop tracks</h2>
        <div className="grid grid-cols-2 gap-3">
          {tracks.map((t) => (
            <Link
              key={t.id}
              href={`/scan/${t.id}`}
              className="rounded-lg border border-white/15 bg-navy-900 p-5 text-center transition hover:border-white hover:shadow-block active:bg-navy-800"
            >
              <div className="font-display text-lg font-black uppercase text-white">{t.name}</div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-accent">Open scanner ↗</div>
            </Link>
          ))}
        </div>
        {tracks.length === 0 && <p className="text-sm text-slate-500">No tracks defined.</p>}
      </div>
    </div>
  );
}
