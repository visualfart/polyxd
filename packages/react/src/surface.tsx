import { useCallback, useContext, useEffect, useMemo, useState, type ComponentType } from "react";
import { SurfaceContext, ScopeContext, StepsContext, useSurface, type ActionEvent, type Node, type UIDocument, type SurfaceContextValue } from "./context.tsx";
import { ROOT_SCOPE, resolve, resolveContext, set, type Data, type Scope } from "./data.ts";
import { registry, type ComponentRenderer } from "./components/index.ts";
import { Avatar } from "./components/avatar.tsx";

export interface PolyxdSurfaceProps {
  document: UIDocument;
  /** Host data. Defaults to document.data. The surface keeps its own copy as inputs change; a shell adopts each new copy the host passes. */
  data?: Data;
  /** Called for every capability action the user triggers. */
  onAction?: (event: ActionEvent) => void;
  /** Called with the new data whenever an input changes it. */
  onDataChange?: (data: Data) => void;
  /**
   * Derived data: called after every input change with the new data and may return a replacement,
   * so a receipt, a total or a filtered list can follow what the person types without the host
   * remounting the surface. Pure: same data in, same data out.
   */
  derive?: (data: Data) => Data | void;
  /** Called for ui.dismiss (Cancel on a dialog, closing the surface). */
  onDismiss?: () => void;
  /** Design-system pack name, e.g. "material3" (matching a loaded theme CSS file). */
  theme?: string;
  /** Design Direction's profile.density. Sets row heights and spacing; compact is for pointer surfaces. */
  density?: "compact" | "comfortable" | "spacious";
  /** Design Direction's profile.disclosure. "show-everything" opens every Disclosure by default. */
  disclosure?: "progressive" | "show-everything";
  mode?: "light" | "dark";
  locale?: string;
  /** Turns a host media reference into a URL. Generated UIs never contain URLs. */
  resolveMedia?: (ref: string) => string | undefined;
  /**
   * Renderer adapter overrides: replace any component's renderer (e.g. with Astryx or your own).
   * Namespaced keys ("brand.logo") are the host's own components, which a Custom renders by name.
   */
  components?: Partial<Record<string, ComponentRenderer | ComponentType<any>>>;
  className?: string;
}

/** Renders one Polyxd UI document. */
export function PolyxdSurface({ document: doc, data: initial, onAction, onDataChange, derive, onDismiss, theme, mode, density, disclosure = "progressive", locale = "en-GB", resolveMedia, components: overrides, className }: PolyxdSurfaceProps) {
  const [data, setData] = useState<Data>(() => initial ?? doc.data ?? {});
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const byId = useMemo(() => new Map(doc.components.map((c) => [c.id, c])), [doc]);
  const components = useMemo(() => ({ ...registry, ...overrides }) as Record<string, ComponentRenderer>, [overrides]);

  const setValue = useCallback(
    (pointer: string, value: unknown) =>
      setData((d) => {
        const written = set(d, pointer, value);
        const next = derive?.(written) ?? written;
        onDataChange?.(next);
        return next;
      }),
    [onDataChange, derive],
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

  const value: SurfaceContextValue = { doc, byId, data, setValue, dispatch, locale, resolveMedia, portal, root, components, disclosure };
  const rootIsDialog = byId.get(doc.root)?.component === "Confirm";
  // A shell has no surface header and places its own navigation: the Frame draws the regions.
  const shell = doc.surface.kind === "shell";
  // A shell lives as long as the product does, and its host data moves under it (a badge count,
  // the signed-in person), so each new copy the host passes is adopted rather than remounted.
  useEffect(() => {
    if (shell && initial) setData(initial);
  }, [shell, initial]);
  const nav = shell ? undefined : doc.components.find((c) => c.component === "Navigation" && (!c.kind || c.kind === "main"));

  return (
    <SurfaceContext.Provider value={value}>
      <div
        ref={setRoot}
        className={["pxd-surface", shell ? "pxd-surface-shell" : null, doc.surface.presentation === "panel" ? "pxd-surface-panel" : null, nav ? "pxd-surface-with-nav" : null, className].filter(Boolean).join(" ")}
        data-pxd-theme={theme}
        data-pxd-mode={mode}
        data-pxd-density={density}
        data-pxd-surface={doc.surface.id}
        lang={locale}
      >
        {nav && <Render id={nav.id} />}
        {shell ? (
          <Render id={doc.root} />
        ) : (
          <div className="pxd-surface-main">
            {!rootIsDialog && <SurfaceHeader />}
            <Render id={doc.root} />
          </div>
        )}
        <div ref={setPortal} className="pxd-portal" />
      </div>
    </SurfaceContext.Provider>
  );
}

/** Title, and on a record page: where it sits, what state it's in, and what you can do to it. */
function SurfaceHeader() {
  const s = useSurface();
  const { title, subtitle, breadcrumbs, badge, avatar, actions } = s.doc.surface;
  const text = (v: unknown) => String(resolve(v, s.data, ROOT_SCOPE) ?? "");
  const plain = !subtitle && !breadcrumbs && !badge && !avatar && !actions;
  if (plain) return <h1 className="pxd-surface-title">{title}</h1>;
  return (
    <header className="pxd-page-header">
      {breadcrumbs && (
        <nav className="pxd-breadcrumbs" aria-label="Breadcrumb">
          <ol>
            {breadcrumbs.map((c: any, i: number) => (
              <li key={i}>
                {c.action ? (
                  <button type="button" className="pxd-link" onClick={() => s.dispatch(c.action, ROOT_SCOPE, s.doc.surface.id)}>
                    {text(c.label)}
                  </button>
                ) : (
                  text(c.label)
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="pxd-page-header-main">
        {avatar !== undefined && <Avatar value={text(avatar)} name={title} size={48} />}
        <div className="pxd-page-header-text">
          <h1 className="pxd-surface-title">
            {title}
            {badge && <span className={`pxd-badge pxd-tone-${badge.tone ?? "neutral"}`}>{text(badge.text)}</span>}
          </h1>
          {subtitle !== undefined && <p className="pxd-surface-subtitle">{text(subtitle)}</p>}
        </div>
        {actions && (
          <div className="pxd-page-header-actions">
            <Render id={actions} />
          </div>
        )}
      </div>
    </header>
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
  // Which component rendered this element: for annotation, devtools and tests.
  const ids = { "data-pxd-id": node.id, "data-pxd-component": node.component } as Record<string, unknown>;
  if (!a) return ids;
  const text = (v: unknown) => {
    const r = resolve(v, s.data, scope);
    return r === undefined ? undefined : String(r);
  };
  return {
    ...ids,
    "aria-label": a.label !== undefined ? text(a.label) : undefined,
    "aria-description": a.description !== undefined ? text(a.description) : undefined,
    "aria-live": a.live,
    "aria-hidden": a.hidden || undefined,
  } as Record<string, unknown>;
}

export { StepsContext };
