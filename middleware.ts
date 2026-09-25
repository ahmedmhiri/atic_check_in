export { default } from "next-auth/middleware";

// Protect everything except the login page, the NextAuth endpoints,
// Next.js internals and public image files (the logo shows on /login).
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
