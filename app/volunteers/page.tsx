import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accountSelect, isAdminOrAbove } from "@/lib/accounts";
import VolunteerManager from "@/components/VolunteerManager";

export const dynamic = "force-dynamic";

export default async function VolunteersPage() {
  // Middleware already keeps volunteers out; this is defence in depth.
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.revoked || !isAdminOrAbove(session.user.role)) redirect("/scan");
  // Admins see the team; only a super admin gets the controls that change it.
  const canManage = session.user.role === "SUPER_ADMIN";

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
          {canManage
            ? "Give each person their own login instead of sharing one. Volunteers only see the scanners; admins run the event; super admins manage accounts."
            : "The event team. Only a super admin can add accounts, change roles or reset passwords."}
        </p>
      </div>
      <VolunteerManager accounts={accounts} tracks={tracks} meId={session.user.id} canManage={canManage} />
    </div>
  );
}
