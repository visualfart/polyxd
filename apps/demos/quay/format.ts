/* Formatting shared by the screens and the data views. No React here, so Node scripts can use it. */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** "$1,240"; with cents when they matter, which in a store is nearly always: "$28.00". */
export const money = (n: number, opts: { cents?: boolean } = {}) => (opts.cents === false ? usd : usdCents).format(n);
/** "$1.2k" for dense cells and cards. */
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (Math.abs(n) >= 10_000) return `$${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return usd.format(n);
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(new Date(iso).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
export const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const dateOnly = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
export const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
/** "YYYY-MM-DD" in local time, for date inputs and day keys. */
export const isoDay = (iso: string | Date) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** A local-time date from a "YYYY-MM-DD" key, at noon so DST never moves the day. */
export const fromDay = (day: string) => new Date(`${day}T12:00:00`);
/** "Sep 21–25" or "Sep 28 – Oct 2": a span of days. */
export function dayRange(from: string, to: string): string {
  const a = fromDay(from);
  const b = fromDay(to);
  if (from === to) return shortDate(a.toISOString());
  if (a.getMonth() === b.getMonth()) return `${a.toLocaleDateString("en-US", { month: "short" })} ${a.getDate()}–${b.getDate()}`;
  return `${shortDate(a.toISOString())} – ${shortDate(b.toISOString())}`;
}

/** "in 3 days", "2h ago", "yesterday": the admin's sense of time. */
export function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  const m = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  let s: string;
  if (m < 1) return "now";
  else if (m < 60) s = `${m}m`;
  else if (hrs < 24) s = `${hrs}h`;
  else if (days === 1) return past ? "yesterday" : "tomorrow";
  else if (days < 30) s = `${days}d`;
  else if (days < 365) s = `${Math.round(days / 30.4)}mo`;
  else s = `${(days / 365).toFixed(1)}y`;
  return past ? `${s} ago` : `in ${s}`;
}

/** "in 21 days" / "3 days ago" / "today", in words. */
export function daysWord(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export const percent = (fraction: number, digits = 0) => `${(fraction * 100).toFixed(digits)}%`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const round2 = (n: number) => Math.round(n * 100) / 100;
