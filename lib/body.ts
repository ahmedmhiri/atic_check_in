/** Trimmed string from untrusted JSON; anything that isn't a string becomes "". */
export function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** True for Prisma's unique-constraint violation (a concurrent insert won the race). */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
