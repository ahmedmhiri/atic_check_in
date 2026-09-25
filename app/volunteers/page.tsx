import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accountSelect } from "@/lib/accounts";
import VolunteerManager from "@/components/VolunteerManager";

export const dynamic = "force-dynamic";

export default async function VolunteersPage() {
  // Middleware already keeps volunteers out; this is defence in depth.
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.revoked || session.user.role !== "ADMIN") redirect("/scan");

  const [accounts, tracks] = await Promise.all([
    prisma.admin.findMany({ select: accountSelect, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.track.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-mist">[ Team access ]</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">
          Volun<span className="pill-word">teers</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-400">
          Give each volunteer their own login instead of sharing the admin one. Volunteers only see the scanners.
        </p>
      </div>
      <VolunteerManager accounts={accounts} tracks={tracks} meId={session.user.id} />
    </div>
  );
}
