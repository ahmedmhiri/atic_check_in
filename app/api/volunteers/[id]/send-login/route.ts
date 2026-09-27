import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { emailConfigError } from "@/lib/email";
import { emailFreshLogin } from "@/lib/login-mail";
import { passwordError } from "@/lib/accounts";

export const runtime = "nodejs";

// POST /api/volunteers/[id]/send-login { password? } — set the password (the
// one chosen by the admin, or a random one) and email it to them.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  const configError = emailConfigError();
  if (configError) return NextResponse.json({ error: configError }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  let chosen: string | undefined;
  if (body.password !== undefined) {
    const pwErr = passwordError(body.password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    chosen = body.password;
  }

  const res = await emailFreshLogin(params.id, chosen);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "Account not found" ? 404 : 502 });
  return NextResponse.json({ status: "sent" });
}
