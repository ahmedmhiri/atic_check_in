import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminOrAbove } from "@/lib/accounts";

/** Returns the session if authenticated, otherwise null. */
export async function getAdminSession() {
  return getServerSession(authOptions);
}

function deny(status: 401 | 403, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });
}

/**
 * Signed-in, still-existing account of any role (admins and volunteer scanners).
 * getServerSession runs the jwt callback, which re-reads the account from the
 * DB every couple of minutes, so a deleted volunteer is rejected here quickly.
 */
export async function requireStaff() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw deny(401, "Unauthorized");
  if (session.user.revoked) throw deny(401, "Account removed — sign in again");
  return session;
}

/**
 * Throws a Response (401/403) unless the caller runs the event — ADMIN or
 * SUPER_ADMIN. Use inside route handlers.
 */
export async function requireAdmin() {
  const session = await requireStaff();
  if (!isAdminOrAbove(session.user.role)) throw deny(403, "Admins only");
  return session;
}

/**
 * Throws a Response (401/403) unless the caller is a SUPER_ADMIN. Guards every
 * account mutation: creating and deleting accounts, changing roles, and
 * setting or resetting passwords.
 */
export async function requireSuperAdmin() {
  const session = await requireStaff();
  if (session.user.role !== "SUPER_ADMIN") throw deny(403, "Super admins only");
  return session;
}
