"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/scan", label: "Scan" },
  { href: "/import", label: "Import" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-40 border-b border-accent/15 bg-navy-950/80 backdrop-blur-xl">
      {/* Phones: brand + sign-out on the first row, links full-width below. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-3 py-2 sm:px-4 sm:py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label="ATIC Check-In home">
          <Image src="/atic-logo.png" alt="ATIC" width={68} height={34} priority className="h-8 w-auto" />
          <span className="hidden border-l border-white/15 pl-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:inline">
            Check-In
          </span>
        </Link>
        <nav className="order-last flex w-full gap-1 sm:order-none sm:w-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex-1 rounded-full px-4 py-2 text-center text-sm transition sm:flex-none sm:py-1.5 ${
                isActive(pathname, l.href)
                  ? "bg-white/10 font-semibold text-white"
                  : "text-accent hover:bg-white/5 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
          {session?.user?.email && <span className="hidden text-slate-400 md:inline">{session.user.email}</span>}
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
