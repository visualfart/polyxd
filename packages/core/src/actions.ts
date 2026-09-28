/** What an action does when it fires: the renderer's own names, and everything else to the host. */
import { absolute, isBinding, resolve, resolveContext, type Scope } from "./data.ts";
import type { Action, ActionEvent, Node } from "./document.ts";
import { RENDERER_ACTIONS } from "./document.ts";
import type { SurfaceEvents } from "./events.ts";

export interface DispatchHandlers {
  onAction?: (event: ActionEvent) => void;
  onDismiss?: () => void;
  /** The surface's semantic events, when the host asked for them: told about every action first. */
  events?: SurfaceEvents;
}

export const isRendererAction = (name: string): boolean => (RENDERER_ACTIONS as readonly string[]).includes(name);

/**
 * ui.dismiss closes the surface (the host's onDismiss); every other action reaches onAction with
 * its context resolved in the scope it fired from. ui.back and ui.next are a Steps' to handle
 * before this; ui.copy copies first and then reaches the host like any action.
 */
export function dispatchAction(action: Action | undefined, scope: Scope, source: string, data: unknown, handlers: DispatchHandlers): void {
  if (!action) return;
  const { name, context } = action.event;
  handlers.events?.action(action, source);
  if (name === "ui.dismiss") return handlers.onDismiss?.();
  handlers.onAction?.({ name, context: resolveContext(context, data, scope), source });
}

/**
 * An input's action, with the value it just wrote applied wherever the context binds to the
 * input's own path, so the event carries the change rather than the value still in host data
 * (Toggle, Rating, CodeInput).
 */
export function contextWithValue(node: Node, data: unknown, scope: Scope, next: unknown): Record<string, unknown> {
  const ptr = absolute(node.value.path, scope);
  return Object.fromEntries(
    Object.entries(node.action?.event?.context ?? {}).map(([k, v]: [string, any]) => [k, isBinding(v) && absolute(v.path, scope) === ptr ? next : resolve(v, data, scope)]),
  );
}

/** What ui.copy puts on the clipboard: the Action's `copy`, else the context's `text`. */
export function copyText(node: Node, data: unknown, scope: Scope, text: (v: unknown) => string): string {
  return node.copy !== undefined ? text(node.copy) : String(resolveContext(node.action?.event?.context, data, scope).text ?? "");
}

/** The 'Change' link of a DetailList row: the row's key travels with the context. */
export const rowChangeAction = (rowAction: Action, key: string): Action => ({ event: { name: rowAction.event.name, context: { key, ...(rowAction.event.context ?? {}) } } });
