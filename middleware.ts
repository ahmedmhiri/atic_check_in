import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Everything a volunteer (SCANNER) account may reach. Anything else is admin-only.
const SCANNER_ALLOWED = [
  /^\/scan(\/|$)/, // scan hub, hotel desk, track scanners
  /^\/api\/checkin\//, // hotel + workshop check-in
  /^\/api\/timeslots$/, // slot list for the track scanner (not /reset)
  /^\/api\/stats$/, // live arrival counts on the hotel page
];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    // Tokens issued before roles existed can only belong to admin accounts.
    const role = token?.role ?? "ADMIN";
    if (role !== "ADMIN" && !SCANNER_ALLOWED.some((r) => r.test(path))) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "Admins only" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/scan", req.url));
    }
    return NextResponse.next();
  },
  {
    // No token, or the account was deleted since sign-in -> back to /login.
    callbacks: { authorized: ({ token }) => !!token && !token.revoked },
  }
);

// Protect everything except the login page, the NextAuth endpoints,
// Next.js internals and public image files (the logo shows on /login).
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
