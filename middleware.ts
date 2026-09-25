export { default } from "next-auth/middleware";

// Protect everything except the login page, the NextAuth endpoints,
// and Next.js internals/static assets.
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
