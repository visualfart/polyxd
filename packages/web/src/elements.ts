/**
 * <polyxd-surface> and <polyxd-frame>: custom elements around the renderer. No shadow DOM, so the
 * stylesheet and the themes apply as they are, scoped by data-pxd-theme on the surface. The
 * document and data are properties; the string settings are also attributes; what the surface
 * sends is dispatched as DOM events (polyxd-action, polyxd-datachange, polyxd-dismiss) as well as
 * the on* callback properties.
 */
import type { ActionEvent, Data, UIDocument } from "@polyxd/core";
import { Renderer, type Density, type HostComponent, type Mode, type SurfaceProps } from "./renderer.ts";
import type { ComponentRenderer } from "./components/index.ts";

const STRING_ATTRS = ["theme", "mode", "density", "locale", "disclosure"] as const;

export interface PolyxdEvents {
  "polyxd-action": CustomEvent<ActionEvent>;
  "polyxd-datachange": CustomEvent<Data>;
  "polyxd-dismiss": CustomEvent<void>;
}

/** The properties shared by both elements. */
export class PolyxdSurfaceElement extends HTMLElement {
  static get observedAttributes() {
    return [...STRING_ATTRS];
  }
  #renderer: Renderer | null = null;
  #document: UIDocument | null = null;
  #data: Data | undefined;
  #derive: SurfaceProps["derive"];
  #resolveMedia: SurfaceProps["resolveMedia"];
  #components: SurfaceProps["components"];
  #scheduled = false;

  onAction: ((event: ActionEvent) => void) | null = null;
  onDataChange: ((data: Data) => void) | null = null;
  onDismiss: (() => void) | null = null;

  get document(): UIDocument | null {
    return this.#document;
  }
  set document(doc: UIDocument | null) {
    this.#document = doc;
    this.#update();
  }
  get data(): Data | undefined {
    return this.#data;
  }
  set data(data: Data | undefined) {
    this.#data = data;
    this.#update();
  }
  get derive(): SurfaceProps["derive"] {
    return this.#derive;
  }
  set derive(fn: SurfaceProps["derive"]) {
    this.#derive = fn;
    this.#update();
  }
  get resolveMedia(): SurfaceProps["resolveMedia"] {
    return this.#resolveMedia;
  }
  set resolveMedia(fn: SurfaceProps["resolveMedia"]) {
    this.#resolveMedia = fn;
    this.#update();
  }
  get components(): Record<string, ComponentRenderer | HostComponent> | undefined {
    return this.#components;
  }
  set components(map: Record<string, ComponentRenderer | HostComponent> | undefined) {
    this.#components = map;
    this.#update();
  }
  get theme(): string | undefined {
    return this.getAttribute("theme") ?? undefined;
  }
  set theme(v: string | undefined) {
    v === undefined ? this.removeAttribute("theme") : this.setAttribute("theme", v);
  }
  get mode(): Mode | undefined {
    return (this.getAttribute("mode") as Mode | null) ?? undefined;
  }
  set mode(v: Mode | undefined) {
    v === undefined ? this.removeAttribute("mode") : this.setAttribute("mode", v);
  }
  get density(): Density | undefined {
    return (this.getAttribute("density") as Density | null) ?? undefined;
  }
  set density(v: Density | undefined) {
    v === undefined ? this.removeAttribute("density") : this.setAttribute("density", v);
  }
  get locale(): string | undefined {
    return this.getAttribute("locale") ?? undefined;
  }
  set locale(v: string | undefined) {
    v === undefined ? this.removeAttribute("locale") : this.setAttribute("locale", v);
  }
  get disclosure(): "progressive" | "show-everything" | undefined {
    return (this.getAttribute("disclosure") as "progressive" | "show-everything" | null) ?? undefined;
  }
  set disclosure(v: "progressive" | "show-everything" | undefined) {
    v === undefined ? this.removeAttribute("disclosure") : this.setAttribute("disclosure", v);
  }

  /** The current data, as the surface holds it (inputs write here). */
  get surfaceData(): Data | undefined {
    return this.#renderer?.data;
  }

  connectedCallback() {
    this.#update();
  }
  disconnectedCallback() {
    this.#renderer?.dispose();
    this.#renderer = null;
  }
  attributeChangedCallback() {
    this.#update();
  }

  /** What the renderer is given: subclasses add the frame's props. */
  protected props(): SurfaceProps | null {
    if (!this.#document) return null;
    return {
      document: this.#document,
      data: this.#data,
      derive: this.#derive,
      resolveMedia: this.#resolveMedia,
      components: this.#components,
      theme: this.theme,
      mode: this.mode,
      density: this.density,
      locale: this.locale,
      disclosure: this.disclosure,
      onAction: (e) => {
        this.onAction?.(e);
        this.dispatchEvent(new CustomEvent("polyxd-action", { detail: e, bubbles: true, composed: true }));
      },
      onDataChange: (d) => {
        this.onDataChange?.(d);
        this.dispatchEvent(new CustomEvent("polyxd-datachange", { detail: d, bubbles: true, composed: true }));
      },
      onDismiss: () => {
        this.onDismiss?.();
        this.dispatchEvent(new CustomEvent("polyxd-dismiss", { bubbles: true, composed: true }));
      },
    };
  }

  /** Several property sets in one tick draw once. */
  #update() {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      if (!this.isConnected) return;
      const props = this.props();
      if (!props) return;
      if (this.#renderer) this.#renderer.update(props);
      else {
        this.#renderer = new Renderer(this, props);
        this.#renderer.draw();
      }
    });
  }

  /** Redraws now rather than on the next tick (tests and hosts that measure right away). */
  flush() {
    const props = this.props();
    if (!props || !this.isConnected) return;
    this.#scheduled = false;
    if (this.#renderer) {
      this.#renderer.update(props);
      this.#renderer.draw();
    } else {
      this.#renderer = new Renderer(this, props);
      this.#renderer.draw();
    }
  }
}

/**
 * Renders a shell document (surface.kind "shell": a Frame with an Outlet) around the host's
 * current screen: the element's light-DOM children at connection time, or the `outlet` property.
 * `current` marks the navigation item and titles the page; `loading` shows a skeleton.
 */
export class PolyxdFrameElement extends PolyxdSurfaceElement {
  #outlet: Element | null = null;
  #current: { key?: string; title?: string } | undefined;
  #loading = false;

  get outlet(): Element | null {
    return this.#outlet;
  }
  set outlet(el: Element | null) {
    this.#outlet = el;
    this.flushSoon();
  }
  get current(): { key?: string; title?: string } | undefined {
    return this.#current;
  }
  set current(v: { key?: string; title?: string } | undefined) {
    this.#current = v;
    this.flushSoon();
  }
  get loading(): boolean {
    return this.#loading;
  }
  set loading(v: boolean) {
    this.#loading = v;
    this.flushSoon();
  }

  connectedCallback() {
    // The screen the host wrote inside the element becomes the outlet's content.
    if (!this.#outlet && this.childElementCount > 0 && !this.querySelector(":scope > .pxd-surface")) {
      const holder = document.createElement("div");
      holder.append(...Array.from(this.childNodes));
      this.#outlet = holder;
    }
    super.connectedCallback();
  }

  private flushSoon() {
    queueMicrotask(() => this.isConnected && this.flush());
  }

  protected props(): SurfaceProps | null {
    const base = super.props();
    if (!base) return null;
    // The document title follows the current screen, as the Frame's accessibility requires.
    const product = base.document.surface.title;
    if (this.#current && product) document.title = this.#current.title ? `${this.#current.title} · ${product}` : product;
    return { ...base, outlet: this.#outlet, current: this.#current, loading: this.#loading };
  }
}

/** Registers both elements once; safe to call again. */
export function defineElements(): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("polyxd-surface")) customElements.define("polyxd-surface", PolyxdSurfaceElement);
  if (!customElements.get("polyxd-frame")) customElements.define("polyxd-frame", PolyxdFrameElement);
}

export interface Mounted {
  update: (props: Partial<SurfaceProps>) => void;
  unmount: () => void;
  readonly data: Data;
}

/**
 * Renders a document into any element without the custom elements (hosts whose DOM is owned by
 * something else). Returns a handle to update the props or take it down.
 */
export function mount(el: HTMLElement, props: SurfaceProps): Mounted {
  const renderer = new Renderer(el, props);
  renderer.draw();
  let current = props;
  return {
    update: (patch) => {
      current = { ...current, ...patch };
      renderer.update(current);
      renderer.draw();
    },
    unmount: () => renderer.dispose(),
    get data() {
      return renderer.data;
    },
  };
}
