/** Collection decisions: item values, people's order, the calendar's month. */
import type { Node } from "./document.ts";

/** Stable value used for selecting an item: its id when present, else its index. */
export const collectionItemValue = (item: unknown, index: number): unknown => (item && typeof item === "object" && "id" in item ? (item as any).id : index);

/** Grid for visual items (a Card with media), list otherwise, unless the document says which. */
export function collectionLayout(node: Node, template: Node | undefined): { grid: boolean; timeline: boolean; carousel: boolean; calendar: boolean } {
  const layout: string = node.layout ?? "auto";
  return { grid: layout === "grid" || (layout === "auto" && template?.component === "Card" && !!template.media), timeline: layout === "timeline", carousel: layout === "carousel", calendar: layout === "calendar" };
}

/** Items in the order people put them ('order' holds item values); unknown values keep host order at the end. */
export function orderedIndices(values: unknown[], order: unknown): number[] {
  const indices = values.map((_, i) => i);
  if (!Array.isArray(order)) return indices;
  const rank = (i: number) => {
    const r = order.indexOf(values[i]);
    return r < 0 ? order.length + i : r;
  };
  return indices.sort((a, c) => rank(a) - rank(c));
}

/** Moves one position to another; the new order as item values. */
export function moveItem(indices: number[], values: unknown[], from: number, to: number): unknown[] | undefined {
  if (to < 0 || to >= indices.length || from === to) return undefined;
  const next = [...indices];
  next.splice(to, 0, ...next.splice(from, 1));
  return next.map((i) => values[i]);
}

/** ISO date → UTC parts, or undefined when it isn't one. */
export function dateParts(v: unknown): { y: number; m: number; d: number } | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

export interface CalendarMonth {
  y: number;
  m: number;
  monthName: string;
  weekdays: string[];
  /** Rows of seven: a day of the month, or null outside it */
  weeks: (number | null)[][];
}

/** The month shown starts at the first dated item (or today). */
export const monthToShow = (chosen: { y: number; m: number } | null, first: { y: number; m: number } | undefined, today = new Date()): { y: number; m: number } =>
  chosen ?? (first ? { y: first.y, m: first.m } : { y: today.getUTCFullYear(), m: today.getUTCMonth() });

export function shiftMonth(shown: { y: number; m: number }, by: number): { y: number; m: number } {
  const d = new Date(Date.UTC(shown.y, shown.m + by, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}

/** The grid of one month; weeks start on Monday (2024-01-01 was one). */
export function calendarMonth(shown: { y: number; m: number }, locale: string): CalendarMonth {
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(shown.y, shown.m, 1)));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))));
  const firstDay = (new Date(Date.UTC(shown.y, shown.m, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(shown.y, shown.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  return { ...shown, monthName, weekdays, weeks };
}

/** Which slide is in view: the one whose left edge is nearest the scroll position. */
export function nearestSlide(offsets: number[], scrollLeft: number): number {
  let best = 0;
  offsets.forEach((o, i) => {
    if (Math.abs(o - scrollLeft) < Math.abs(offsets[best] - scrollLeft)) best = i;
  });
  return best;
}
