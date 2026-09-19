import { useCallback, useContext, useMemo, useState, type ComponentType } from "react";
import { SurfaceContext, ScopeContext, StepsContext, useSurface, type ActionEvent, type Node, type UIDocument, type SurfaceContextValue } from "./context.tsx";
import { resolve, resolveContext, set, type Data, type Scope } from "./data.ts";
import { registry, type ComponentRenderer } from "./components/index.ts";

export interface PolyxdSurfaceProps {
  document: UIDocument;
  /** Host data. Defaults to document.data. The surface keeps its own copy as inputs change. */
  data?: Data;
  /** Called for every capability action the user triggers. */
  onAction?: (event: ActionEvent) => void;
  /** Called with the new data whenever an input changes it. */
  onDataChange?: (data: Data) => void;
  /** Called for ui.dismiss (Cancel on a dialog, closing the surface). */
  onDismiss?: () => void;
  /** Design-system pack name, e.g. "material3" (matching a loaded theme CSS file). */
  theme?: string;
  mode?: "light" | "dark";
  locale?: string;
  /** Turns a host media reference into a URL. Generated UIs never contain URLs. */
  resolveMedia?: (ref: string) => string | undefined;
  /** Renderer adapter overrides: replace any component's renderer (e.g. with Astryx or your own). */
  components?: Partial<Record<string, ComponentRenderer>>;
  className?: string;
}

/** Renders one Polyxd UI document. */
export function PolyxdSurface({ document: doc, data: initial, onAction, onDataChange, onDismiss, theme, mode, locale = "en-GB", resolveMedia, components: overrides, className }: PolyxdSurfaceProps) {
  const [data, setData] = useState<Data>(() => initial ?? doc.data ?? {});
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const byId = useMemo(() => new Map(doc.components.map((c) => [c.id, c])), [doc]);
  const components = useMemo(() => ({ ...registry, ...overrides }) as Record<string, ComponentRenderer>, [overrides]);

  const setValue = useCallback(
    (pointer: string, value: unknown) =>
      setData((d) => {
        const next = set(d, pointer, value);
        onDataChange?.(next);
        return next;
      }),
    [onDataChange],
  );

  const dispatch = useCallback<SurfaceContextValue["dispatch"]>(
    (action, scope, source) => {
      if (!action) return;
      const { name, context } = action.event;
      if (name === "ui.dismiss") return onDismiss?.();
      onAction?.({ name, context: resolveContext(context, data, scope), source });
    },
    [data, onAction, onDismiss],
  );

  const value: SurfaceContextValue = { doc, byId, data, setValue, dispatch, locale, resolveMedia, portal, components };
  const rootIsDialog = byId.get(doc.root)?.component === "Confirm";

  return (
    <SurfaceContext.Provider value={value}>
      <div
        className={["pxd-surface", className].filter(Boolean).join(" ")}
        data-pxd-theme={theme}
        data-pxd-mode={mode}
        data-pxd-surface={doc.surface.id}
        lang={locale}
      >
        {!rootIsDialog && <h1 className="pxd-surface-title">{doc.surface.title}</h1>}
        <Render id={doc.root} />
        <div ref={setPortal} className="pxd-portal" />
      </div>
    </SurfaceContext.Provider>
  );
}

/** Renders a component by id in the current scope. */
export function Render({ id, scope }: { id: string; scope?: Scope }) {
  const s = useSurface();
  const current = useContext(ScopeContext);
  const node = s.byId.get(id);
  if (!node) return null;
  const effective = scope ?? current;
  if (node.visible !== undefined && resolve(node.visible, s.data, effective) === false) return null;
  const Component = s.components[node.component] as ComponentType<{ node: Node }> | undefined;
  const body = Component ? <Component node={node} /> : <UnknownComponent node={node} />;
  return scope ? <ScopeContext.Provider value={scope}>{body}</ScopeContext.Provider> : body;
}

function UnknownComponent({ node }: { node: Node }) {
  return (
    <div className="pxd-unknown" role="note">
      Unsupported component “{node.component}”
    </div>
  );
}

/** Accessibility props from a node's `accessibility` block. */
export function useA11y(node: Node) {
  const s = useSurface();
  const scope = useContext(ScopeContext);
  const a = node.accessibility;
  if (!a) return {};
  const text = (v: unknown) => {
    const r = resolve(v, s.data, scope);
    return r === undefined ? undefined : String(r);
  };
  return {
    "aria-label": a.label !== undefined ? text(a.label) : undefined,
    "aria-description": a.description !== undefined ? text(a.description) : undefined,
    "aria-live": a.live,
    "aria-hidden": a.hidden || undefined,
  } as Record<string, unknown>;
}

export { StepsContext };
