/** Tree: the open part of a hierarchy flattened into rows, and the moves between them. */
import { absolute, asList, childPointer, get, type Scope } from "./data.ts";
import type { Node } from "./document.ts";

/** Beyond this many visible rows the tree renders only the rows in (and just around) its viewport. */
export const VIRTUAL_LIMIT = 200;
/** Rows rendered above and below the viewport so keyboard moves and quick scrolls don't flash blank. */
export const OVERSCAN = 10;
/** Type-ahead resets after this pause. */
export const TYPEAHEAD_MS = 500;

/** One visible row of the flattened tree. */
export interface TreeRow {
  /** Pointer to the node in host data; stable identity for keys and focus. */
  key: string;
  scope: Scope;
  level: number;
  setsize: number;
  posinset: number;
  label: string;
  value: unknown;
  detail: string | undefined;
  hasChildren: boolean;
  expanded: boolean;
  /** Index of the parent row in the flat list, -1 at the top level. */
  parent: number;
}

const asText = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

/** Flatten the open part of the hierarchy, depth first. Without an expanded set, the first level is open. */
export function treeRows(node: Node, data: unknown, scope: Scope, expanded: Set<unknown> | null): { rows: TreeRow[]; indexByKey: Map<string, number>; topValues: unknown[] } {
  const rows: TreeRow[] = [];
  const indexByKey = new Map<string, number>();
  const topValues: unknown[] = [];
  const isExpanded = (value: unknown, level: number) => (expanded ? expanded.has(value) : level === 1);
  const walk = (list: unknown[], pointer: string, level: number, parent: number) => {
    list.forEach((_, i) => {
      const s = { pointer: childPointer(pointer, i) };
      const label = asText(get(data, absolute(node.labelPath, s)));
      const rawValue = node.valuePath ? get(data, absolute(node.valuePath, s)) : label;
      const value = rawValue === undefined || rawValue === null ? label || s.pointer : rawValue;
      const detailRaw = node.detailPath ? get(data, absolute(node.detailPath, s)) : undefined;
      const detail = detailRaw === undefined || detailRaw === null || detailRaw === "" ? undefined : String(detailRaw);
      const children = asList(get(data, absolute(node.childrenPath, s)));
      if (level === 1) topValues.push(value);
      const hasChildren = children.length > 0;
      const open = hasChildren && isExpanded(value, level);
      const index = rows.length;
      indexByKey.set(s.pointer, index);
      rows.push({ key: s.pointer, scope: s, level, setsize: list.length, posinset: i + 1, label, value, detail, hasChildren, expanded: open, parent });
      if (open) walk(children, absolute(node.childrenPath, s), level + 1, index);
    });
  };
  const itemsPointer = absolute(node.items.path, scope);
  walk(asList(get(data, itemsPointer)), itemsPointer, 1, -1);
  return { rows, indexByKey, topValues };
}

/** Type-ahead: the next row whose label starts with what was typed; the same letter repeated cycles. */
export function typeAheadTarget(rows: TreeRow[], from: number, buffer: string): number {
  const find = (prefix: string) => {
    for (let step = 1; step <= rows.length; step++) {
      const j = (from + step) % rows.length;
      if (rows[j].label.toLowerCase().startsWith(prefix)) return j;
    }
    return -1;
  };
  const single = buffer.length > 1 && [...buffer].every((c) => c === buffer[0]);
  let j = single ? find(buffer[0]) : find(buffer);
  if (j < 0 && buffer.length > 1) j = find(buffer[0]);
  return j;
}

/** What a key does in a tree (WAI-ARIA APG tree view): where focus goes, or what toggles. */
export type TreeMove = { focus: number } | { toggle: true } | { activate: true } | { select: true } | { expandSiblings: true } | { typeAhead: string } | undefined;

export function treeKey(rows: TreeRow[], index: number, e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): TreeMove {
  const row = rows[index];
  if (!row) return undefined;
  switch (e.key) {
    case "ArrowDown":
      return { focus: Math.min(rows.length - 1, index + 1) };
    case "ArrowUp":
      return { focus: Math.max(0, index - 1) };
    case "ArrowRight":
      if (row.hasChildren && !row.expanded) return { toggle: true };
      return row.expanded ? { focus: Math.min(rows.length - 1, index + 1) } : undefined;
    case "ArrowLeft":
      if (row.expanded) return { toggle: true };
      return row.parent >= 0 ? { focus: row.parent } : undefined;
    case "Home":
      return { focus: 0 };
    case "End":
      return { focus: rows.length - 1 };
    case "Enter":
      return { activate: true };
    case " ":
      return { select: true };
    case "*":
      return { expandSiblings: true };
    default:
      return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey ? { typeAhead: e.key } : undefined;
  }
}

/** The window of rows to draw when virtualised. */
export function visibleWindow(rowCount: number, scrollTop: number, rowHeight: number, viewportHeight: number): { start: number; end: number } {
  if (rowCount <= VIRTUAL_LIMIT) return { start: 0, end: rowCount };
  return { start: Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN), end: Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + OVERSCAN) };
}
