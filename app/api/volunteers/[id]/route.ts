import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/guard";
import { accountSelect, parseRole, parseTrack, passwordError } from "@/lib/accounts";

export const runtime = "nodejs";

/** The event must never be left without an account that can manage accounts. */
async function isLastSuperAdmin(id: string) {
  const supers = await prisma.admin.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  return supers.length === 1 && supers[0].id === id;
}

// PATCH /api/volunteers/[id] { name?, email?, password?, role?, assignedTrackId? }
// Super admin only — this is where accounts are edited: name, email, password,
// role and track lock.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSuperAdmin();
  } catch (r) {
    return r as Response;
  }

  const current = await prisma.admin.findUnique({ where: { id: params.id }, select: { id: true, role: true } });
  if (!current) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Prisma.AdminUncheckedUpdateInput = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = name;
  }
  if (body.email !== undefined) {
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    data.email = email;
  }
  if (body.password !== undefined) {
    const pwErr = passwordError(body.password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    data.password = await bcrypt.hash(body.password, 10);
  }
  let role = current.role;
  if (body.role !== undefined) {
    const r = parseRole(body.role);
    if (!r) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    if (r !== "SUPER_ADMIN" && current.role === "SUPER_ADMIN") {
      if (current.id === session.user.id)
        return NextResponse.json({ error: "You can't remove your own super admin rights" }, { status: 400 });
      if (await isLastSuperAdmin(current.id))
        return NextResponse.json({ error: "Keep at least one super admin" }, { status: 400 });
    }
    data.role = role = r;
  }
  // A track lock only means anything for volunteers.
  if (body.assignedTrackId !== undefined || role !== "SCANNER") {
    const track = await parseTrack(role !== "SCANNER" ? null : body.assignedTrackId);
    if (!track.ok) return NextResponse.json({ error: track.error }, { status: 400 });
    data.assignedTrackId = track.id;
  }

  try {
    const account = await prisma.admin.update({ where: { id: current.id }, data, select: accountSelect });
    return NextResponse.json({ account });
  } catch (e) {
    // Email is unique: changing one to an address already in use lands here.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ error: "Could not update account" }, { status: 500 });
  }
}

// DELETE /api/volunteers/[id] — their phone is signed out within ~1-2 minutes.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSuperAdmin();
  } catch (r) {
    return r as Response;
  }
  if (params.id === session.user.id) return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  if (await isLastSuperAdmin(params.id))
    return NextResponse.json({ error: "Keep at least one super admin" }, { status: 400 });

  try {
    await prisma.admin.delete({ where: { id: params.id } });
    return NextResponse.json({ status: "deleted" });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not delete account" }, { status: 500 });
  }
}
