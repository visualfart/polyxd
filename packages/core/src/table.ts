/** Table decisions: when it stacks, which columns are numbers, what a stacked row shows, paging. */
import { absolute, childPointer, get, type Scope } from "./data.ts";
import type { Node } from "./document.ts";

/** Below this width a table becomes a list of rows. */
export const TABLE_COMPACT_PX = 720;
export const PAGE_SIZES = [10, 25, 50, 100];
const NUMERIC = new Set(["number", "currency", "percent", "duration"]);

export const isNumericColumn = (c: any): boolean => c.align === "end" || (c.align !== "start" && (c.kind === "number" || c.kind === "currency" || NUMERIC.has(c.format?.type)));

/** A stacked row: the first column as its title, one status badge, and up to three details. */
export function stackedColumns(columns: any[]): { first: any; status: any | undefined; details: any[] } {
  const [first, ...rest] = columns;
  return { first, status: rest.find((c) => c.kind === "status"), details: rest.filter((c) => c.kind !== "status").slice(0, 3) };
}

/** The value a row is selected and expanded by: rowValuePath, else the row's id, else its index. */
export const rowValue = (node: Node, rows: unknown[], i: number, data: unknown, scope: Scope): unknown =>
  node.rowValuePath ? get(data, absolute(node.rowValuePath, scope)) : ((rows[i] as { id?: unknown })?.id ?? i);

export const rowScopes = (pointer: string, rows: unknown[]): Scope[] => rows.map((_, i) => ({ pointer: childPointer(pointer, i) }));

/** Toggles a value in a selection list. */
export const toggleValue = (list: unknown[], v: unknown): unknown[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Sorting a column again flips it; sorting another starts ascending. */
export const nextSort = (key: string, column: string | undefined, direction: string | undefined): "ascending" | "descending" => (key === column && direction === "ascending" ? "descending" : "ascending");

/** How many cells a row has, for a detail row that spans them. */
export const columnCount = (node: Node, expandable: boolean, selectable: boolean): number => node.columns.length + (expandable ? 1 : 0) + (selectable ? 1 : 0) + (node.rowActions || node.rowAction ? 1 : 0);

export interface PagingState {
  index: number;
  size: number;
  total: number;
  pages: number;
  from: number;
  to: number;
  /** The sizes offered, always including the current one */
  sizes: number[];
}

/** Rows per page, the range shown, and how many pages there are. */
export function paging(index: unknown, size: unknown, total: unknown, rows: number): PagingState {
  const i = typeof index === "number" ? index : 1;
  const s = typeof size === "number" ? size : rows;
  const t = typeof total === "number" ? total : rows;
  const pages = Math.max(1, Math.ceil(t / (s || 1)));
  return { index: i, size: s, total: t, pages, from: t === 0 ? 0 : (i - 1) * s + 1, to: Math.min(i * s, t), sizes: [...new Set([...PAGE_SIZES, s])].sort((a, c) => a - c) };
}
