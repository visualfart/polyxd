/**
 * Master and detail. Wide: two panes. Compact: the list, then the detail as a page with a Back
 * control. The decisions live here so every renderer shows the same pane at the same width.
 */
import { absolute, asList, childPointer, get, resolve, type Scope } from "./data.ts";
import type { Node } from "./document.ts";

/** Below this surface width the detail replaces the list instead of sitting beside it. */
export const SPLIT_COMPACT_PX = 640;
/** The list's share of the width, by ratio, and how far a resizable handle may move it. */
export const SHARE: Record<string, number> = { narrow: 33.333, balanced: 50, wide: 66.667 };
export const SHARE_MIN = 20;
export const SHARE_MAX = 80;

export interface SplitState {
  compact: boolean;
  /** Back on compact shows the list again without dropping the selection. */
  listShown: boolean;
  share: number;
}

export type SplitAction =
  | { type: "measure"; width: number }
  | { type: "back" }
  | { type: "selected" }
  | { type: "share"; value: number }
  | { type: "key"; key: string; shift?: boolean };

export const initialSplit = (ratio: string | undefined): SplitState => ({ compact: false, listShown: false, share: SHARE[ratio ?? "narrow"] ?? SHARE.narrow });

export const clampShare = (v: number): number => Math.min(SHARE_MAX, Math.max(SHARE_MIN, v));

export function splitReducer(state: SplitState, action: SplitAction): SplitState {
  switch (action.type) {
    case "measure":
      return { ...state, compact: action.width < SPLIT_COMPACT_PX };
    case "back":
      return { ...state, listShown: true };
    // A new selection shows its detail; on compact it takes the screen.
    case "selected":
      return { ...state, listShown: false };
    case "share":
      return { ...state, share: clampShare(action.value) };
    case "key": {
      const step = action.shift ? 10 : 5;
      const next = action.key === "ArrowLeft" ? state.share - step : action.key === "ArrowRight" ? state.share + step : action.key === "Home" ? SHARE_MIN : action.key === "End" ? SHARE_MAX : undefined;
      return next === undefined ? state : { ...state, share: clampShare(next) };
    }
  }
}

/** Which panes show: both when wide; on compact, the detail once something is selected, until Back. */
export function splitPanes(state: SplitState, hasSelection: boolean): { showList: boolean; showDetail: boolean } {
  const showDetail = !state.compact || (hasSelection && !state.listShown);
  return { showList: !state.compact || !showDetail, showDetail };
}

/** The value the primary selects an item by: its id when it has one, else its index (as Collection and Table do). */
export const splitItemValue = (item: unknown, index: number, valuePath: string | undefined, data: unknown, pointer: string): unknown =>
  valuePath ? get(data, absolute(valuePath, { pointer })) : item && typeof item === "object" && "id" in item ? (item as { id: unknown }).id : index;

export interface SplitSelection {
  has: boolean;
  index: number;
  /** The selected item's scope, so the detail's relative bindings read that item */
  scope?: Scope;
  /** The item's name, for the announcement: what the list shows as its title, else a name-like field */
  name?: string;
}

/** What is selected in the primary, found the way the primary itself selects. */
export function splitSelection(node: Node, byId: Map<string, Node>, data: unknown, scope: Scope): SplitSelection {
  const selected = resolve<unknown>(node.selected, data, scope);
  const has = selected !== undefined && selected !== null && selected !== "";
  const primary = byId.get(node.primary);
  const listPath: unknown = primary?.component === "Table" ? primary.rows?.path : primary?.items?.path;
  const pointer = typeof listPath === "string" ? absolute(listPath, scope) : undefined;
  const items = pointer ? asList(get(data, pointer)) : [];
  const index = pointer ? items.findIndex((item, i) => splitItemValue(item, i, primary?.rowValuePath, data, childPointer(pointer, i)) === selected) : -1;
  const itemScope = pointer && index >= 0 ? { pointer: childPointer(pointer, index) } : undefined;
  const template = primary?.items?.componentId ? byId.get(primary.items.componentId) : undefined;
  const item = index >= 0 ? (items[index] as Record<string, unknown> | undefined) : undefined;
  const titled = itemScope && template?.title !== undefined ? resolve(template.title, data, itemScope) : undefined;
  const name = has ? String(titled ?? item?.name ?? item?.title ?? item?.label ?? selected) : undefined;
  return { has, index, scope: itemScope, name };
}
