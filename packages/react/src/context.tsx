import { createContext, useContext, type ReactNode } from "react";
import { resolve, resolveContext, set, absolute, type Data, type Scope } from "./data.ts";
import { formatValue, type Format } from "./format.ts";

export type Node = Record<string, any> & { id: string; component: string };

export interface UIDocument {
  specVersion: string;
  surface: {
    id: string;
    title: string;
    intent?: string;
    pattern?: string;
    journey?: string;
    dismissible?: boolean;
    subtitle?: unknown;
    breadcrumbs?: { label: unknown; action?: any }[];
    badge?: { text: unknown; tone?: string };
    avatar?: unknown;
    /** ActionBar id: what you can do to this record */
    actions?: string;
    presentation?: "page" | "panel";
    origin?: "generated" | "authored";
    /** A shell is the product's frame (a Frame with an Outlet); a surface is a screen inside one. */
    kind?: "surface" | "shell";
  };
  root: string;
  components: Node[];
  data?: Data;
}

export interface ActionEvent {
  /** Capability name, e.g. "transfer.confirm" */
  name: string;
  /** Resolved context values */
  context: Record<string, unknown>;
  /** Id of the component that triggered it */
  source: string;
}

export interface SurfaceContextValue {
  doc: UIDocument;
  byId: Map<string, Node>;
  data: Data;
  setValue: (pointer: string, value: unknown) => void;
  dispatch: (action: { event: { name: string; context?: Record<string, unknown> } } | undefined, scope: Scope, source: string) => void;
  locale: string;
  resolveMedia?: (ref: string) => string | undefined;
  /** Element dialogs portal into, so they stay inside the themed surface */
  portal: HTMLElement | null;
  /** The surface's outer element: shortcuts fire only while focus is inside it, never over the host page */
  root: HTMLElement | null;
  /** Component renderers in use (the default adapter plus any overrides), and the host's own components a Custom names */
  components: Record<string, React.ComponentType<any>>;
  /** Design Direction's profile.disclosure: whether secondary detail starts hidden. */
  disclosure: "progressive" | "show-everything";
}

export const SurfaceContext = createContext<SurfaceContextValue | null>(null);
export const ScopeContext = createContext<Scope>({ pointer: "" });
/** Heading level for the next Section (the surface title is h1). */
export const HeadingContext = createContext(2);
/** Handles ui.back / ui.next inside Steps. */
export const StepsContext = createContext<{ back: () => void; next: () => void } | null>(null);

/* ---- The shell ---- */

export type NavigationPlacement = "side" | "rail" | "bar" | "drawer";

/** What a Frame decided for the width it has, so a host's own screens can adapt with it. */
export interface FrameLayout {
  navigation: NavigationPlacement;
  compact: boolean;
}

/** What the host gives a shell through PolyxdFrame: the screen for the outlet, which item is current, whether one is on its way. */
export interface FrameHost {
  outlet?: ReactNode;
  current?: { key?: string; title?: string };
  loading?: boolean;
}
export const FrameHostContext = createContext<FrameHost | null>(null);

/** What the Frame tells the components inside it. Cleared at the Outlet, so a screen's own Navigation is not the frame's. */
export interface FrameContextValue extends FrameLayout {
  /** The id of the main landmark, for the skip link */
  mainId: string;
  /** The Frame's own Navigation, which takes the placement; any other Navigation renders as it would in a surface */
  navigationId?: string;
  /** The navigation's accessible name, for the menu button that opens it as a drawer */
  navigationLabel?: string;
  current?: { key?: string; title?: string };
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}
export const FrameContext = createContext<FrameContextValue | null>(null);

const NO_FRAME: FrameLayout = { navigation: "side", compact: false };

/** The layout the enclosing Frame chose; outside one, a wide layout with a side navigation. */
export function useFrame(): FrameLayout {
  const f = useContext(FrameContext);
  return f ? { navigation: f.navigation, compact: f.compact } : NO_FRAME;
}

export function useSurface(): SurfaceContextValue {
  const ctx = useContext(SurfaceContext);
  if (!ctx) throw new Error("Polyxd components must be rendered inside <PolyxdSurface>");
  return ctx;
}

/** Binding helpers for the current scope. */
export function useBindings() {
  const s = useSurface();
  const scope = useContext(ScopeContext);
  return {
    scope,
    /** Resolve a literal-or-binding value. */
    value: <T = unknown,>(v: unknown): T => resolve<T>(v, s.data, scope),
    /** Resolve and render as text, applying a format. */
    text: (v: unknown, format?: Format): string => {
      const r = resolve(v, s.data, scope);
      return format ? formatValue(r, resolveFormat(format, s.data, scope), s.locale) : r === undefined || r === null ? "" : String(r);
    },
    /** Absolute pointer of a binding (for inputs that write back). */
    pointer: (v: { path: string }) => absolute(v.path, scope),
    write: (v: { path: string }, value: unknown) => s.setValue(absolute(v.path, scope), value),
    context: (c: Record<string, unknown> | undefined) => resolveContext(c, s.data, scope),
  };
}

/** A format's currency may itself be bound to data (e.g. the account's currency). */
export function resolveFormat(format: Format | undefined, data: unknown, scope: Scope): Format | undefined {
  if (!format?.currency || typeof format.currency === "string") return format;
  return { ...format, currency: resolve<string>(format.currency, data, scope) };
}

export { set, type Data, type Scope, type ReactNode };
