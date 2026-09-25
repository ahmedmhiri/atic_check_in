"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-[88vh] flex-col items-center justify-center gap-7 py-6">
      <div className="w-full max-w-sm">
        <Image src="/atic-logo.png" alt="ATIC — AfroTech Intelligence Congress" width={339} height={172} priority className="h-16 w-auto" />
        <div className="mt-5 flex flex-wrap justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mist">
          <span>[ 2nd edition ]</span>
          <span>AfroTech Intelligence Congress</span>
        </div>
        <h1 className="mt-3 text-[2.6rem] sm:text-5xl">
          Check-
          <span className="pill-word">In</span>
        </h1>
      </div>

      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 !bg-navy-900 !shadow-block">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">(01) Admin sign in</p>
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="flex flex-col items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Organised by</span>
        <span className="rounded-[10px] bg-white px-3 py-1.5">
          <Image src="/ieee-cs-iit.png" alt="IEEE Computer Society — IIT Student Branch Chapter" width={700} height={327} className="h-9 w-auto" />
        </span>
      </div>
    </div>
  );
}
