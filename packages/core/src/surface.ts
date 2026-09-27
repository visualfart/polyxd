/**
 * The headless surface: one document, its data, and the semantics every renderer shares, with no
 * DOM and no framework. A renderer walks `byId` from `document.root`, reads values through
 * `resolve` and `text`, writes inputs through `setValue`, sends actions through `dispatch`, and
 * redraws on `subscribe`.
 */
import { dispatchAction } from "./actions.ts";
import { ROOT_SCOPE, absolute, resolve, resolveContext, set, type Data, type Scope } from "./data.ts";
import type { Action, ActionEvent, Node, UIDocument } from "./document.ts";
import { indexById } from "./document.ts";
import { formatValue, resolveFormat, type Format } from "./format.ts";

export interface SurfaceOptions {
  /** Host data. Defaults to document.data. */
  data?: Data;
  locale?: string;
  /**
   * Derived data: called after every input change with the new data and may return a replacement,
   * so a receipt, a total or a filtered list can follow what the person types. Pure.
   */
  derive?: (data: Data) => Data | void;
  /** Called for every capability action the user triggers. */
  onAction?: (event: ActionEvent) => void;
  /** Called with the new data whenever an input changes it. */
  onDataChange?: (data: Data) => void;
  /** Called for ui.dismiss (Cancel on a dialog, closing the surface). */
  onDismiss?: () => void;
}

export interface Surface {
  document: UIDocument;
  byId: Map<string, Node>;
  /** The current data; a new object after every change. */
  readonly data: Data;
  locale: string;
  /** Writes an input's value at an absolute pointer, derives, and tells the host and the subscribers. */
  setValue: (pointer: string, value: unknown) => void;
  /** Replaces the data wholesale (a shell adopting the host's new copy). */
  replaceData: (data: Data) => void;
  dispatch: (action: Action | undefined, scope: Scope, source: string) => void;
  /** Called after every change to the data; returns the unsubscribe. */
  subscribe: (listener: (data: Data) => void) => () => void;
  /** A literal or binding, resolved in a scope (the root scope by default). */
  resolve: <T = unknown>(value: unknown, scope?: Scope) => T;
  /** A literal or binding as text, formatted when a format is given. */
  text: (value: unknown, format?: Format, scope?: Scope) => string;
  /** The absolute pointer of a binding in a scope. */
  pointer: (binding: { path: string }, scope?: Scope) => string;
  /** Writes a binding's value in a scope. */
  write: (binding: { path: string }, value: unknown, scope?: Scope) => void;
  /** An action context with its bindings resolved in a scope. */
  context: (context: Record<string, unknown> | undefined, scope?: Scope) => Record<string, unknown>;
  /** Whether a node is visible in a scope: its `visible` binding, when it has one. */
  visible: (node: Node, scope?: Scope) => boolean;
}

export function createSurface(document: UIDocument, options: SurfaceOptions = {}): Surface {
  let data: Data = options.data ?? document.data ?? {};
  const listeners = new Set<(data: Data) => void>();
  const locale = options.locale ?? "en-GB";
  const notify = () => listeners.forEach((l) => l(data));
  const surface: Surface = {
    document,
    byId: indexById(document),
    get data() {
      return data;
    },
    locale,
    setValue(pointer, value) {
      const written = set(data, pointer, value);
      data = options.derive?.(written) ?? written;
      options.onDataChange?.(data);
      notify();
    },
    replaceData(next) {
      data = next;
      notify();
    },
    dispatch: (action, scope, source) => dispatchAction(action, scope, source, data, options),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resolve: <T,>(value: unknown, scope: Scope = ROOT_SCOPE) => resolve<T>(value, data, scope),
    text(value, format, scope = ROOT_SCOPE) {
      const r = resolve(value, data, scope);
      return format ? formatValue(r, resolveFormat(format, data, scope), locale) : r === undefined || r === null ? "" : String(r);
    },
    pointer: (binding, scope = ROOT_SCOPE) => absolute(binding.path, scope),
    write: (binding, value, scope = ROOT_SCOPE) => surface.setValue(absolute(binding.path, scope), value),
    context: (context, scope = ROOT_SCOPE) => resolveContext(context, data, scope),
    visible: (node, scope = ROOT_SCOPE) => node.visible === undefined || resolve(node.visible, data, scope) !== false,
  };
  return surface;
}

/** Accessibility attributes from a node's `accessibility` block, plus which component rendered the element. */
export function a11yAttributes(node: Node, resolveText: (v: unknown) => string | undefined): Record<string, unknown> {
  const ids: Record<string, unknown> = { "data-pxd-id": node.id, "data-pxd-component": node.component };
  const a = node.accessibility;
  if (!a) return ids;
  return {
    ...ids,
    "aria-label": a.label !== undefined ? resolveText(a.label) : undefined,
    "aria-description": a.description !== undefined ? resolveText(a.description) : undefined,
    "aria-live": a.live,
    "aria-hidden": a.hidden || undefined,
  };
}
