/**
 * Certificate eligibility threshold (percent).
 * `Number("")` is 0, which would make everyone eligible, so empty, invalid or
 * out-of-range values fall back to 70.
 */
export function eligibilityThreshold(): number {
  const raw = process.env.ELIGIBILITY_THRESHOLD?.replace(/["'\s\uFEFF]/g, "");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : 70;
}
