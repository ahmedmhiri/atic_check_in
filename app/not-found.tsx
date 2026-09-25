import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="text-4xl">
        Page <span className="text-accent">not found</span>
      </h1>
      <p className="text-sm text-slate-400">That page doesn&apos;t exist — maybe a student or track was removed.</p>
      <Link href="/" className="btn-primary mt-2">
        Back to dashboard
      </Link>
    </div>
  );
}
