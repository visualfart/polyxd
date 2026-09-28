import { useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentType, type Ref } from "react";
import { SurfaceContext, ScopeContext, StepsContext, useSurface, type ActionEvent, type Node, type UIDocument, type SurfaceContextValue } from "./context.tsx";
import { createSurfaceEvents, dispatchAction, validityReason, type EventRating, type SemanticEvent, type SurfaceEventOptions } from "@polyxd/core";
import { ROOT_SCOPE, resolve, set, type Data, type Scope } from "./data.ts";
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
  /**
   * Semantic analytics events (schema/event.schema.json): shown, actions, checkpoints, completion,
   * abandonment, input errors, statuses, undo. Keys and codes only, never what anyone typed. Off
   * unless this is passed. They go to this handler and nowhere else.
   */
  onEvent?: (event: SemanticEvent) => void;
  /** What the events say beyond the document: a session id, the actor, the journey, the generator, the Direction, experiment variants. Read when the surface is shown. */
  events?: SurfaceEventOptions;
  /** The host's side of the events: a rating, or that the person asked for this surface again. */
  ref?: Ref<PolyxdSurfaceHandle>;
}

/** What a host can tell a surface's events from outside it. Does nothing while events are off. */
export interface PolyxdSurfaceHandle {
  /** The events' session id, while events are on. */
  readonly sessionId: string | undefined;
  /** feedback: the person rated this surface -1, 0 or 1, with an optional reason code. */
  feedback: (rating: EventRating, reason?: string) => void;
  /** surface.regenerated: the person asked again, and this surface is being replaced. */
  regenerated: (reason?: string) => void;
}

/** Renders one Polyxd UI document. */
export function PolyxdSurface({ document: doc, data: initial, onAction, onDataChange, derive, onDismiss, theme, mode, density, disclosure = "progressive", locale = "en-GB", resolveMedia, components: overrides, className, onEvent, events: eventOptions, ref }: PolyxdSurfaceProps) {
  const [data, setData] = useState<Data>(() => initial ?? doc.data ?? {});
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const byId = useMemo(() => new Map(doc.components.map((c) => [c.id, c])), [doc]);
  const components = useMemo(() => ({ ...registry, ...overrides }) as Record<string, ComponentRenderer>, [overrides]);

  // Semantic events: one emitter per document while the host listens; none at all otherwise.
  const listener = useRef(onEvent);
  listener.current = onEvent;
  const options = useRef(eventOptions);
  options.current = eventOptions;
  const listening = Boolean(onEvent);
  const events = useMemo(() => (listening ? createSurfaceEvents(doc, (e) => listener.current?.(e), options.current) : undefined), [doc, listening]);
  const previous = useRef<typeof events>(undefined);
  useEffect(() => {
    if (!events) return;
    // A new document: the last surface's ending is said before this one is shown.
    if (previous.current !== events) previous.current?.unmounted(false);
    previous.current = events;
    events.shown();
    // Deferred: a remount in the same tick (StrictMode) calls shown() again, which cancels it.
    return () => events.unmounted();
  }, [events]);
  // Every control that fails validation fires 'invalid' (a Form's checkValidity, a Steps' submit): heard once, at the surface.
  useEffect(() => {
    if (!events || !root) return;
    const invalid = (e: Event) => {
      const control = e.target as (Element & { validity?: ValidityState }) | null;
      const id = control?.closest?.("[data-pxd-id]")?.getAttribute("data-pxd-id");
      if (id) events.inputError(byId.get(id) ?? id, validityReason(control?.validity));
    };
    root.addEventListener("invalid", invalid, true);
    return () => root.removeEventListener("invalid", invalid, true);
  }, [events, root, byId]);
  useImperativeHandle(ref, () => ({ sessionId: events?.sessionId, feedback: (rating, reason) => events?.feedback(rating, reason), regenerated: (reason) => events?.regenerated(reason) }), [events]);

  const setValue = useCallback(
    (pointer: string, value: unknown) => {
      events?.edited(pointer);
      setData((d) => {
        const written = set(d, pointer, value);
        const next = derive?.(written) ?? written;
        onDataChange?.(next);
        return next;
      });
    },
    [onDataChange, derive, events],
  );

  const dispatch = useCallback<SurfaceContextValue["dispatch"]>(
    (action, scope, source) => dispatchAction(action, scope, source, data, { onAction, onDismiss, events }),
    [data, onAction, onDismiss, events],
  );

  const value: SurfaceContextValue = { doc, byId, data, setValue, dispatch, locale, resolveMedia, portal, root, components, disclosure, events };
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
