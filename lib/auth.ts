import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Sessions are JWTs, so deleting an account or changing its role doesn't reach
// an already signed-in phone by itself. Re-read the account this often.
const RECHECK_MS = 2 * 60 * 1000;

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
        const ok = await bcrypt.compare(credentials.password, admin.password);
        if (!ok) return null;
        return {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          assignedTrackId: admin.assignedTrackId,
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
        token.checkedAt = Date.now();
        return token;
      }
      // Periodic re-check (also upgrades tokens issued before roles existed).
      if (!token.revoked && (!token.role || !token.checkedAt || Date.now() - token.checkedAt > RECHECK_MS)) {
        const acct = token.id
          ? await prisma.admin.findUnique({ where: { id: token.id }, select: { role: true, assignedTrackId: true } })
          : null;
        if (!acct) {
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
