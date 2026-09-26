import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { emailConfigError } from "@/lib/email";
import { emailFreshLogin } from "@/lib/login-mail";

export const runtime = "nodejs";

// POST /api/volunteers/[id]/send-login — new password, emailed to them.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  const configError = emailConfigError();
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });

  const res = await emailFreshLogin(params.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "Account not found" ? 404 : 502 });
  return NextResponse.json({ status: "sent" });
}
