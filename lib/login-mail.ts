import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generatePassword } from "@/lib/accounts";
import { sendLoginEmail } from "@/lib/email";

/**
 * Give an account a fresh password and email it to them. Passwords are only
 * stored hashed, so an existing one can't be re-sent. If the email fails, the
 * previous password is restored so nobody is locked out by a failed send.
 */
export async function emailFreshLogin(accountId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const acct = await prisma.admin.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, email: true, role: true, password: true, assignedTrack: { select: { name: true } } },
  });
  if (!acct) return { ok: false, error: "Account not found" };

  const password = generatePassword();
  await prisma.admin.update({ where: { id: acct.id }, data: { password: await bcrypt.hash(password, 10) } });
  try {
    await sendLoginEmail({ name: acct.name, email: acct.email, password, role: acct.role, trackName: acct.assignedTrack?.name });
    return { ok: true };
  } catch (e: any) {
    await prisma.admin.update({ where: { id: acct.id }, data: { password: acct.password } });
    return { ok: false, error: e?.message ?? "Email failed" };
  }
}
