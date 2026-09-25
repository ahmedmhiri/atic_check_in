import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Montserrat, Unbounded } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Nav from "@/components/Nav";

// Mockup fonts, self-hosted by next/font at build time (no runtime Google
// Fonts request — matters on shaky venue Wi-Fi).
const unbounded = Unbounded({ subsets: ["latin"], weight: ["600", "800", "900"], variable: "--font-unbounded", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-montserrat", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "ATIC 2.0 Check-In",
  description: "Check-in & attendance for ATIC 2.0 — AfroTech Intelligence Congress",
  icons: { icon: "/atic-logo-black.png" },
};

// Explicit so phones render at device width; zoom stays allowed for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b12",
};

// This app is entirely behind admin auth and reads the live DB — nothing
// should be statically pre-rendered at build time. Forcing dynamic rendering
// also avoids evaluating client auth code (NextAuth) during the build.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${unbounded.variable} ${montserrat.variable} ${jetbrains.variable}`}>
      <body>
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
