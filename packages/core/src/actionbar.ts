/**
 * ActionBar folding and ActionMenu ordering. Children are in order of importance; in the wide
 * (row) layout, actions that would wrap onto a second line fold into a "More actions" menu,
 * least important first. The first child never folds, two actions never fold.
 */
import type { Node } from "./document.ts";

/** What the overflow control is called; also what a task runner looks for. */
export const MORE_ACTIONS = "More actions";
/** The trigger's width before it has been drawn: size.target.min in every pack. */
export const TRIGGER_FALLBACK = 44;

/** Only a trailing run of Actions can fold; anything else (a menu, a split) stays put. */
export function minShown(ids: string[], byId: Map<string, Node>): number {
  for (let i = ids.length - 1; i > 0; i--) if (byId.get(ids[i])?.component !== "Action") return i + 1;
  return 1;
}

/** How many children fit as buttons in `room`, with a trigger for the rest. An unmeasured child counts as nothing wide. */
export function fitActions(ids: string[], width: (id: string) => number, gap: number, room: number, triggerWidth: number, floor: number): number {
  if (ids.length <= 2) return ids.length;
  let used = 0;
  let n = 0;
  while (n < ids.length && used + (n ? gap : 0) + width(ids[n]) <= room) used += (n ? gap : 0) + width(ids[n++]);
  if (n < ids.length) {
    // Make room for the trigger itself, giving up the least important buttons first.
    while (n > floor && used + gap + triggerWidth > room) used -= gap + width(ids[--n]);
    n = Math.max(n, floor);
  }
  return n;
}

/** Menu items in order: the usual ones, then a divider, then danger last. */
export function menuOrder(actions: Node[]): { usual: Node[]; danger: Node[]; divider: boolean } {
  const usual = actions.filter((a) => a.tone !== "danger");
  const danger = actions.filter((a) => a.tone === "danger");
  return { usual, danger, divider: danger.length > 0 && usual.length > 0 };
}
