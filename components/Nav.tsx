"use client";

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
    <header className="border-b border-slate-200 bg-white">
      {/* Phones: brand + sign-out on the first row, links full-width below. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-3 py-2 sm:px-4 sm:py-3">
        <span className="text-base font-semibold text-teal-700">Event Attendance</span>
        <nav className="order-last flex w-full gap-1 sm:order-none sm:w-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex-1 rounded-md px-3 py-2 text-center text-sm sm:flex-none sm:py-1.5 ${
                isActive(pathname, l.href) ? "bg-teal-50 font-medium text-teal-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
          {session?.user?.email && <span className="hidden md:inline">{session.user.email}</span>}
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
