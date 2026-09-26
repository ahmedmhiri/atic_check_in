import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { accountSelect, parseRole, parseTrack, passwordError } from "@/lib/accounts";
import { emailConfigError, sendLoginEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/volunteers -> all accounts (admins + volunteer scanners), no hashes.
export async function GET() {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  const accounts = await prisma.admin.findMany({ select: accountSelect, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return NextResponse.json({ accounts });
}

// POST /api/volunteers { name, email, password, role?, assignedTrackId?, sendEmail? }
// sendEmail: also email them the login (the account is created either way).
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const role = parseRole(body.role ?? "SCANNER");
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  if (!role) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  const pwErr = passwordError(body.password);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
  const track = await parseTrack(body.assignedTrackId);
  if (!track.ok) return NextResponse.json({ error: track.error }, { status: 400 });

  try {
    const account = await prisma.admin.create({
      data: {
        name,
        email,
        role,
        password: await bcrypt.hash(body.password, 10),
        // A track lock only makes sense for volunteers.
        assignedTrackId: role === "SCANNER" ? track.id : null,
      },
      select: accountSelect,
    });
    let emailed: boolean | undefined;
    let emailError: string | undefined;
    if (body.sendEmail === true) {
      emailError = emailConfigError() ?? undefined;
      if (!emailError) {
        try {
          await sendLoginEmail({ name, email, password: body.password, role, trackName: account.assignedTrack?.name });
          emailed = true;
        } catch (e: any) {
          emailError = e?.message ?? "Email failed";
        }
      }
      emailed = emailed ?? false;
    }
    return NextResponse.json({ account, emailed, emailError }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
  }
}
