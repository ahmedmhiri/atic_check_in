import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Event Attendance Admin",
  description: "Admin-only attendance system for the 2-day workshop event",
};

// Explicit so phones render at device width; zoom stays allowed for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d9488",
};

// This app is entirely behind admin auth and reads the live DB — nothing
// should be statically pre-rendered at build time. Forcing dynamic rendering
// also avoids evaluating client auth code (NextAuth) during the build.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
