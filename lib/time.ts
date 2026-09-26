// Server code runs in UTC on Vercel; show event times in the venue's zone.
const EVENT_TZ = process.env.EVENT_TIMEZONE || "Africa/Tunis";

export function formatEventTime(d: Date): string {
  return d.toLocaleString("en-GB", { timeZone: EVENT_TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
