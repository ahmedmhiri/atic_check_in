"use client";

import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Refetching the session re-runs the jwt callback and saves the result in the
  // cookie, so role changes / removed accounts reach signed-in phones within ~1 min.
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      {children}
    </SessionProvider>
  );
}
