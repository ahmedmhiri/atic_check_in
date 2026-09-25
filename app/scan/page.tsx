import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Scanner hub: big tap targets so volunteers on phones reach their scanner in one tap.
export default async function ScanHubPage() {
  const tracks = await prisma.track.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <p className="eyebrow">Volunteer scanners</p>
        <h1 className="mt-1 text-3xl">Scan</h1>
      </div>

      <Link
        href="/scan/hotel"
        className="block rounded-2xl bg-gradient-to-r from-brand via-brand to-brand-600 p-5 text-white shadow-glow transition hover:brightness-110 active:brightness-95"
      >
        <div className="font-display text-xl font-black">Hotel Check-In</div>
        <div className="text-sm text-sky-100/80">Arrival desk →</div>
      </Link>

      <div>
        <h2 className="eyebrow mb-2">Workshop tracks</h2>
        <div className="grid grid-cols-2 gap-3">
          {tracks.map((t) => (
            <Link
              key={t.id}
              href={`/scan/${t.id}`}
              className="rounded-2xl border border-accent/20 bg-navy-950/60 p-5 text-center shadow-glass backdrop-blur-xl transition hover:border-accent/50 active:bg-accent/10"
            >
              <div className="font-display text-lg font-black text-white">{t.name}</div>
              <div className="text-xs text-accent">Open scanner →</div>
            </Link>
          ))}
        </div>
        {tracks.length === 0 && <p className="text-sm text-slate-500">No tracks defined.</p>}
      </div>
    </div>
  );
}
