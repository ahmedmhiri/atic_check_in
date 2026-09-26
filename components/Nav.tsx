"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const ADMIN_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/scan", label: "Scan" },
  { href: "/import", label: "Import" },
  { href: "/volunteers", label: "Team" },
];
// Volunteers can only reach the scanners.
const SCANNER_LINKS = [{ href: "/scan", label: "Scan" }];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (pathname === "/login") return null;
  const isAdmin = session?.user?.role === "ADMIN";
  // Until the session loads we don't know the role: show no links rather than
  // flashing the volunteer menu to an admin.
  const links = status === "loading" ? [] : isAdmin ? ADMIN_LINKS : SCANNER_LINKS;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/80 backdrop-blur-xl">
      {/* Phones: brand + sign-out on the first row, links full-width below. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-1 px-3 py-2.5 sm:px-4 sm:py-3">
        <Link href={isAdmin ? "/" : "/scan"} className="flex items-center gap-3" aria-label="ATIC Check-In home">
          <Image src="/atic-logo.png" alt="ATIC" width={339} height={172} priority className="h-9 w-auto" />
          <span className="hidden font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-mist sm:inline">
            [ Check-In ]
          </span>
        </Link>
        <nav className="order-last flex w-full sm:order-none sm:w-auto sm:gap-6">
          {links.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex-1 py-2.5 text-center font-mono text-[13px] font-medium uppercase tracking-[0.06em] transition sm:flex-none sm:py-1 ${
                  active ? "text-accent" : "text-mist hover:text-white"
                }`}
              >
                {l.label}
                {active && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded bg-accent sm:inset-x-0 sm:-bottom-1.5" />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {session?.user?.email && (
            <span className="hidden font-mono text-xs text-slate-500 md:inline">
              {session.user.email}
              {!isAdmin && " · volunteer"}
            </span>
          )}
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary !min-h-0 px-3.5 py-1.5 text-xs">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
