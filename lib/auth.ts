import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Sessions are JWTs, so deleting an account or changing its role doesn't reach
// an already signed-in phone by itself. Re-read the account this often.
const RECHECK_MS = 2 * 60 * 1000;

// Brute-force protection: this many wrong passwords in a row locks the account
// for LOCK_MS. Each attempt is counted in the DB *before* the password is
// checked, so a burst of parallel guesses can't slip past the limit.
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
export const LOCKED_MESSAGE = "Too many wrong passwords — this account is locked for 15 minutes. An admin can unlock it by setting a new password.";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const admin = await prisma.admin.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!admin) return null;

        // An expired lock starts a fresh count.
        await prisma.admin.updateMany({
          where: { id: admin.id, lockedUntil: { lte: new Date() } },
          data: { failedLogins: 0, lockedUntil: null },
        });
        const claimed = await prisma.admin.updateMany({
          where: { id: admin.id, failedLogins: { lt: MAX_FAILED_LOGINS } },
          data: { failedLogins: { increment: 1 } },
        });
        if (claimed.count === 0) {
          // Out of tries. Make sure a lock (with an end) exists, even if the
          // request that used the last try died before setting it.
          await prisma.admin.updateMany({
            where: { id: admin.id, lockedUntil: null },
            data: { lockedUntil: new Date(Date.now() + LOCK_MS) },
          });
          throw new Error(LOCKED_MESSAGE);
        }

        const ok = await bcrypt.compare(credentials.password, admin.password);
        if (!ok) {
          // That was the last allowed try: start the lock.
          await prisma.admin.updateMany({
            where: { id: admin.id, failedLogins: { gte: MAX_FAILED_LOGINS }, lockedUntil: null },
            data: { lockedUntil: new Date(Date.now() + LOCK_MS) },
          });
          return null;
        }
        await prisma.admin.update({ where: { id: admin.id }, data: { failedLogins: 0, lockedUntil: null } });
        return {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          assignedTrackId: admin.assignedTrackId,
          sessionVersion: admin.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.assignedTrackId = user.assignedTrackId ?? null;
        token.sessionVersion = user.sessionVersion;
        token.checkedAt = Date.now();
        return token;
      }
      // Periodic re-check (also upgrades tokens issued before roles existed).
      // Deleted account, or password changed since sign-in -> revoked.
      if (!token.revoked && (!token.role || !token.checkedAt || Date.now() - token.checkedAt > RECHECK_MS)) {
        const acct = token.id
          ? await prisma.admin.findUnique({
              where: { id: token.id },
              select: { role: true, assignedTrackId: true, sessionVersion: true },
            })
          : null;
        if (!acct || (token.sessionVersion ?? 0) !== acct.sessionVersion) {
          token.revoked = true;
        } else {
          token.role = acct.role;
          token.assignedTrackId = acct.assignedTrackId;
          token.checkedAt = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        // Tokens from before roles existed belong to the original admin account(s);
        // the jwt callback upgrades them from the DB on first use.
        session.user.role = token.role ?? "SCANNER";
        session.user.revoked = token.revoked === true;
        session.user.assignedTrackId = token.assignedTrackId ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
