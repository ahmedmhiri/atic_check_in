import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Returns the session if authenticated, otherwise null. */
export async function getAdminSession() {
  return getServerSession(authOptions);
}

/** Throws a Response(401) if not authenticated. Use inside route handlers. */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session?.user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return session;
}
