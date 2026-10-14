// When a time slot can be scanned. Shared by the scanner page (to pre-select
// and label the live slot) and the check-in API (which enforces it for
// volunteers; admins may still record outside it, e.g. to fix a missed scan).

/** Scanning opens this many minutes before the slot starts… */
export const OPENS_MINUTES_BEFORE = 30;
/** …and stays open this long after it ends, for sessions that overrun. */
export const CLOSES_MINUTES_AFTER = 15;

export function slotWindow(startTime: Date | string, endTime: Date | string) {
  return {
    opens: new Date(startTime).getTime() - OPENS_MINUTES_BEFORE * 60_000,
    closes: new Date(endTime).getTime() + CLOSES_MINUTES_AFTER * 60_000,
  };
}

export function isSlotOpen(startTime: Date | string, endTime: Date | string, now = Date.now()) {
  const { opens, closes } = slotWindow(startTime, endTime);
  return now >= opens && now <= closes;
}
