/**
 * The renderer: one document walked from the root into a virtual tree, patched into a host
 * element, redrawn whenever the surface's data or a component's own state changes. Component
 * functions take the document node and a context (scope, heading level, the enclosing Steps or
 * Frame) and return elements, the way the React components do with hooks and providers.
 */
import {
  a11yAttributes, absolute, createSurface, mainNavigation, resolve, resolveContext, resolveFormat, formatValue, ROOT_SCOPE,
  type Action, type ActionEvent, type Data, type Format, type Node, type Scope, type Surface, type UIDocument,
} from "@polyxd/core";
import { adopt, h, render as patch, unmount, type VChild, type VNode } from "./dom.ts";
import { registry, type ComponentRenderer } from "./components/index.ts";
import { Avatar } from "./components/avatar.ts";

export type Density = "compact" | "comfortable" | "spacious";
export type Mode = "light" | "dark";

/** What the host passes to a surface (the same props as PolyxdSurface). */
export interface SurfaceProps {
  document: UIDocument;
  data?: Data;
  onAction?: (event: ActionEvent) => void;
  onDataChange?: (data: Data) => void;
  derive?: (data: Data) => Data | void;
  onDismiss?: () => void;
  theme?: string;
  mode?: Mode;
  density?: Density;
  /** Design Direction's profile.disclosure: "show-everything" opens every Disclosure by default. */
  disclosure?: "progressive" | "show-everything";
  locale?: string;
  resolveMedia?: (ref: string) => string | undefined;
  /** Renderer overrides by component name, and the host's own components (namespaced, e.g. "brand.logo") a Custom names. */
  components?: Record<string, ComponentRenderer | HostComponent>;
  className?: string;
  /** For a shell: the screen in the Outlet, which item is current, whether a screen is on its way. */
  outlet?: Element | null;
  current?: { key?: string; title?: string };
  loading?: boolean;
}

/** A host's own component: gets the Custom's resolved props and the node, returns an element (or a description of one). */
export type HostComponent = (props: Record<string, unknown> & { node: Node }) => Element | VNode | null;

/** What the Frame tells the components inside it. */
export interface FrameContextValue {
  navigation: "side" | "rail" | "bar" | "drawer";
  compact: boolean;
  mainId: string;
  navigationId?: string;
  navigationLabel?: string;
  current?: { key?: string; title?: string };
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

/** Binding helpers for one scope, as the React components get from useBindings. */
export interface Bindings {
  scope: Scope;
  value: <T = unknown>(v: unknown) => T;
  text: (v: unknown, format?: Format) => string;
  pointer: (v: { path: string }) => string;
  write: (v: { path: string }, value: unknown) => void;
  context: (c: Record<string, unknown> | undefined) => Record<string, unknown>;
}

/** The context a component renders in: the renderer, the scope, and what its ancestors decided. */
export interface Ctx {
  r: Renderer;
  scope: Scope;
  /** Heading level for the next Section (the surface title is h1). */
  heading: number;
  /** Handles ui.back / ui.next inside Steps. */
  steps?: { back: () => void; next: () => void };
  frame?: FrameContextValue;
  b: Bindings;
  /** A component by id, in this scope (or a new one), with its `visible` honoured. */
  render: (id: string, scope?: Scope) => VChild;
  /** Accessibility props from the node's `accessibility` block, plus which component rendered the element. */
  a11y: (node: Node) => Record<string, unknown>;
  /** A stable element id for this node in this scope, for label/control pairs and live regions. */
  id: (node: Node, suffix?: string) => string;
  /** Local state for this node in this scope, named; a set redraws the surface. */
  state: <T>(node: Node, name: string, initial: T | (() => T)) => [T, (next: T | ((cur: T) => T)) => void];
  /** Runs after the tree has been patched (a layout effect): measure, then set state if it changed. */
  after: (fn: () => void) => void;
  /** Renders into the surface's portal, so dialogs and menus stay inside the themed surface. */
  portal: (child: VChild) => void;
  with: (patch: Partial<Pick<Ctx, "scope" | "heading" | "steps" | "frame">>) => Ctx;
}

export class Renderer {
  surface: Surface;
  props: SurfaceProps;
  host: HTMLElement;
  /** The surface's outer element once drawn: shortcuts fire only while focus is inside it. */
  root: HTMLElement | null = null;
  portalEl: HTMLElement | null = null;
  components: Record<string, ComponentRenderer | HostComponent>;
  private states = new Map<string, unknown>();
  private effects: (() => void)[] = [];
  private portals: VChild[] = [];
  /** Modal dialogs open in this draw: while one is, the surface's other regions are hidden from assistive technology (as Radix hides them). */
  modals = 0;
  private scheduled = false;
  private unsubscribe: () => void;
  private observers = new Map<Element, ResizeObserver>();
  /** Set while patching, so a state change made by an effect schedules another draw instead of nesting. */
  private drawing = false;
  /** Set by the surface once the first draw is done, so shortcut listeners can be attached once. */
  private disposers: (() => void)[] = [];

  constructor(host: HTMLElement, props: SurfaceProps) {
    this.host = host;
    this.props = props;
    this.components = { ...registry, ...(props.components ?? {}) };
    this.surface = this.makeSurface(props);
    this.unsubscribe = this.surface.subscribe(() => this.schedule());
  }

  private makeSurface(props: SurfaceProps): Surface {
    return createSurface(props.document, {
      data: props.data,
      locale: props.locale ?? "en-GB",
      derive: props.derive,
      onAction: (e) => this.props.onAction?.(e),
      onDataChange: (d) => this.props.onDataChange?.(d),
      onDismiss: () => this.props.onDismiss?.(),
    });
  }

  get locale(): string {
    return this.surface.locale;
  }
  get doc(): UIDocument {
    return this.surface.document;
  }
  get data(): Data {
    return this.surface.data;
  }
  get byId(): Map<string, Node> {
    return this.surface.byId;
  }
  get disclosure(): "progressive" | "show-everything" {
    return this.props.disclosure ?? "progressive";
  }

  /** New props: a new document remounts; a shell adopts the host's new data; anything else redraws. */
  update(props: SurfaceProps) {
    const previous = this.props;
    this.props = props;
    this.components = { ...registry, ...(props.components ?? {}) };
    if (props.document !== previous.document || (props.locale ?? "en-GB") !== previous.locale) {
      this.unsubscribe();
      this.states.clear();
      this.surface = this.makeSurface(props);
      this.unsubscribe = this.surface.subscribe(() => this.schedule());
    } else if (props.data && props.data !== previous.data && props.document.surface.kind === "shell") {
      // A shell lives as long as the product does, and its host data moves under it.
      this.surface.replaceData(props.data);
      return;
    }
    this.schedule();
  }

  dispose() {
    this.unsubscribe();
    for (const d of this.disposers) d();
    for (const o of this.observers.values()) o.disconnect();
    unmount(this.host);
  }

  onDispose(fn: () => void) {
    this.disposers.push(fn);
  }

  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.draw();
    });
  }

  /** Watches an element's width; the callback runs with each new width and may set state. */
  observeWidth(el: Element | null, key: string, fn: (width: number) => void) {
    if (!el) return;
    if (this.observers.has(el)) return;
    if (typeof ResizeObserver === "undefined") return;
    const measure = () => fn(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    this.observers.set(el, ro);
    void key;
    measure();
  }
  unobserve(el: Element) {
    this.observers.get(el)?.disconnect();
    this.observers.delete(el);
  }

  bindings(scope: Scope): Bindings {
    const s = this.surface;
    return {
      scope,
      value: <T,>(v: unknown): T => resolve<T>(v, s.data, scope),
      text: (v, format) => {
        const r = resolve(v, s.data, scope);
        return format ? formatValue(r, resolveFormat(format, s.data, scope), s.locale) : r === undefined || r === null ? "" : String(r);
      },
      pointer: (v) => absolute(v.path, scope),
      write: (v, value) => s.setValue(absolute(v.path, scope), value),
      context: (c) => resolveContext(c, s.data, scope),
    };
  }

  dispatch(action: Action | undefined, scope: Scope, source: string) {
    this.surface.dispatch(action, scope, source);
  }

  ctx(base: { scope: Scope; heading: number; steps?: Ctx["steps"]; frame?: FrameContextValue }): Ctx {
    const r = this;
    const key = (node: Node, name: string) => `${base.scope.pointer}#${node.id}:${name}`;
    const ctx: Ctx = {
      r,
      scope: base.scope,
      heading: base.heading,
      steps: base.steps,
      frame: base.frame,
      b: r.bindings(base.scope),
      render: (id, scope) => r.renderNode(id, scope ? ctx.with({ scope }) : ctx),
      a11y: (node) => a11yAttributes(node, (v) => {
        const x = resolve(v, r.data, base.scope);
        return x === undefined ? undefined : String(x);
      }),
      id: (node, suffix = "") => `pxd-${(base.scope.pointer + "-" + node.id + (suffix ? "-" + suffix : "")).replace(/[^A-Za-z0-9_-]+/g, "_")}`,
      state: <T,>(node: Node, name: string, initial: T | (() => T)) => {
        const k = key(node, name);
        if (!r.states.has(k)) r.states.set(k, typeof initial === "function" ? (initial as () => T)() : initial);
        const set = (next: T | ((cur: T) => T)) => {
          const cur = r.states.get(k) as T;
          const value = typeof next === "function" ? (next as (cur: T) => T)(cur) : next;
          if (Object.is(value, cur)) return;
          r.states.set(k, value);
          r.schedule();
        };
        return [r.states.get(k) as T, set];
      },
      after: (fn) => r.effects.push(fn),
      portal: (child) => r.portals.push(child),
      with: (patchCtx) => r.ctx({ ...base, ...patchCtx }),
    };
    return ctx;
  }

  /** Renders a component by id in a context, honouring `visible`; unknown components say so. */
  renderNode(id: string, ctx: Ctx): VChild {
    const node = this.byId.get(id);
    if (!node) return null;
    if (node.visible !== undefined && resolve(node.visible, this.data, ctx.scope) === false) return null;
    const Component = this.components[node.component] as ComponentRenderer | undefined;
    if (!Component) return h("div", { class: "pxd-unknown", role: "note" }, `Unsupported component “${node.component}”`);
    const out = Component(node, ctx);
    return out instanceof Element ? adopt(out, node.id) : out;
  }

  draw() {
    if (this.drawing) return this.schedule();
    this.drawing = true;
    this.effects = [];
    this.portals = [];
    this.modals = 0;
    try {
      const tree = this.surfaceTree();
      patch(this.host, [tree]);
      this.root = this.host.querySelector<HTMLElement>(":scope > .pxd-surface");
      this.portalEl = this.root?.querySelector<HTMLElement>(":scope > .pxd-portal") ?? null;
      const effects = this.effects;
      this.effects = [];
      for (const e of effects) e();
    } finally {
      this.drawing = false;
    }
  }

  private surfaceTree(): VNode {
    const doc = this.doc;
    const p = this.props;
    const ctx = this.ctx({ scope: ROOT_SCOPE, heading: 2 });
    const rootIsDialog = this.byId.get(doc.root)?.component === "Confirm";
    // A shell has no surface header and places its own navigation: the Frame draws the regions.
    const shell = doc.surface.kind === "shell";
    const nav = mainNavigation(doc);
    const main = shell ? ctx.render(doc.root) : h("div", { class: "pxd-surface-main" }, !rootIsDialog && this.header(ctx), ctx.render(doc.root));
    const navTree = nav ? ctx.render(nav.id) : null;
    // Overlays render after the tree, collected while it was built, into the portal inside the surface.
    const portal = h("div", { class: "pxd-portal" }, ...this.portals);
    // A modal in the portal hides the rest of the surface from assistive technology while it is open.
    const hidden = this.modals > 0 ? "true" : undefined;
    for (const region of [navTree, main]) if (region && typeof region === "object" && "props" in region) region.props["aria-hidden"] = hidden;
    return h(
      "div",
      {
        class: ["pxd-surface", shell ? "pxd-surface-shell" : null, doc.surface.presentation === "panel" ? "pxd-surface-panel" : null, nav ? "pxd-surface-with-nav" : null, p.className].filter(Boolean).join(" "),
        "data-pxd-theme": p.theme,
        "data-pxd-mode": p.mode,
        "data-pxd-density": p.density,
        "data-pxd-surface": doc.surface.id,
        lang: this.locale,
      },
      navTree,
      main,
      portal,
    );
  }

  /** Title, and on a record page: where it sits, what state it's in, and what you can do to it. */
  private header(ctx: Ctx): VChild {
    const { title, subtitle, breadcrumbs, badge, avatar, actions } = this.doc.surface;
    const text = (v: unknown) => String(resolve(v, this.data, ROOT_SCOPE) ?? "");
    const plain = !subtitle && !breadcrumbs && !badge && !avatar && !actions;
    if (plain) return h("h1", { class: "pxd-surface-title" }, title);
    return h(
      "header",
      { class: "pxd-page-header" },
      breadcrumbs &&
        h(
          "nav",
          { class: "pxd-breadcrumbs", "aria-label": "Breadcrumb" },
          h(
            "ol",
            null,
            breadcrumbs.map((c: any, i: number) =>
              h("li", { key: i }, c.action ? h("button", { type: "button", class: "pxd-link", onClick: () => this.dispatch(c.action, ROOT_SCOPE, this.doc.surface.id) }, text(c.label)) : text(c.label)),
            ),
          ),
        ),
      h(
        "div",
        { class: "pxd-page-header-main" },
        avatar !== undefined && Avatar(ctx, { value: text(avatar), name: title, size: 48 }),
        h(
          "div",
          { class: "pxd-page-header-text" },
          h("h1", { class: "pxd-surface-title" }, title, badge && h("span", { class: `pxd-badge pxd-tone-${badge.tone ?? "neutral"}` }, text(badge.text))),
          subtitle !== undefined && h("p", { class: "pxd-surface-subtitle" }, text(subtitle)),
        ),
        actions && h("div", { class: "pxd-page-header-actions" }, ctx.render(actions)),
      ),
    );
  }
}
