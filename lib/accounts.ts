import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MIN_PASSWORD_LENGTH = 8;

/** Fields safe to send to the browser (never the password hash). */
export const accountSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  assignedTrackId: true,
  assignedTrack: { select: { name: true } },
  createdAt: true,
} satisfies Prisma.AdminSelect;

export type Role = "ADMIN" | "SCANNER";

export function parseRole(v: unknown): Role | null {
  return v === "ADMIN" || v === "SCANNER" ? v : null;
}

/** null/"" clears the lock; otherwise the track must exist. */
export async function parseTrack(v: unknown): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (v === null || v === undefined || v === "") return { ok: true, id: null };
  if (typeof v !== "string") return { ok: false, error: "Invalid track" };
  const t = await prisma.track.findUnique({ where: { id: v }, select: { id: true } });
  return t ? { ok: true, id: t.id } : { ok: false, error: "Track not found" };
}

export function passwordError(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD_LENGTH)
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  return null;
}
