/**
 * What a product's seed is built with: deterministic numbers, readable ids and dates relative to
 * today. No React here, so the seed builds in a Worker as well as in the browser.
 */
/** Deterministic pseudo-random numbers, so a seed is the same for everyone. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable id from a counter, readable in devtools ("txn_0042"). */
export function ids(prefix: string) {
  let n = 0;
  return () => `${prefix}_${String(++n).padStart(4, "0")}`;
}

/** ISO date `days` before (negative) or after today at a fixed hour; demos should look current. */
export function daysFromNow(days: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
