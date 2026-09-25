import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Scanner hub: big tap targets so volunteers on phones reach their scanner in one tap.
export default async function ScanHubPage() {
  const tracks = await prisma.track.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Scan</h1>

      <Link
        href="/scan/hotel"
        className="block rounded-lg border border-teal-200 bg-teal-600 p-5 text-white shadow-sm active:bg-teal-700"
      >
        <div className="text-lg font-semibold">Hotel Check-In</div>
        <div className="text-sm text-teal-100">Arrival desk</div>
      </Link>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">Workshop tracks</h2>
        <div className="grid grid-cols-2 gap-3">
          {tracks.map((t) => (
            <Link
              key={t.id}
              href={`/scan/${t.id}`}
              className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm active:bg-teal-50"
            >
              <div className="text-base font-semibold text-teal-700">{t.name}</div>
              <div className="text-xs text-slate-500">Open scanner</div>
            </Link>
          ))}
        </div>
        {tracks.length === 0 && <p className="text-sm text-slate-400">No tracks defined.</p>}
      </div>
    </div>
  );
}
