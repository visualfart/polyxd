/* Formatting shared by the screens and the data views. No React here, so Node scripts can use it. */

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const gbpWhole = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

/** "£1,932.48"; whole: "£85". */
export const money = (n: number, opts: { whole?: boolean } = {}) => (opts.whole && Number.isInteger(n) ? gbpWhole : gbp).format(Math.abs(n));

/** "Thursday 2 October 2026": how a council writes a date. */
export const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
/** "2 October 2026" */
export const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
/** "Thursday 2 October" */
export const dayDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
/** "2 Oct" */
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "YYYY-MM-DD" in the person's own time zone, for date inputs. */
export function isoDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const today = () => isoDay(new Date().toISOString());

/** "1st", "15th", "28th" */
export const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** "in 5 days", "today", "3 days ago" */
export function relativeDays(iso: string): string {
  const days = Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
