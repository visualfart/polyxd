/**
 * Just enough DOM for the renderer to draw a document in Node: elements with attributes, classes,
 * styles, children and a serialiser. No layout, no events, no selectors beyond what the renderer
 * uses after a draw (which then finds nothing and skips its measurements). What it produces is
 * the same tree the browser would get, so the tests can read it as HTML.
 */

const VOID = new Set(["input", "img", "br", "hr", "meta", "link"]);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class FakeNode {
  parentNode: FakeElement | null = null;
  nodeType = 3;
  // A getter pair rather than a field, so an element's own textContent (its children) is not shadowed.
  private text: string;
  constructor(textContent = "") {
    this.text = textContent;
  }
  get textContent(): string {
    return this.text;
  }
  set textContent(v: string) {
    this.text = v;
  }
  get isConnected() {
    return this.parentNode?.isConnected ?? false;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  get nextSibling(): FakeNode | null {
    const p = this.parentNode;
    if (!p) return null;
    return p.childNodes[p.childNodes.indexOf(this) + 1] ?? null;
  }
  toString() {
    return esc(this.textContent);
  }
}

export class FakeStyle {
  private props = new Map<string, string>();
  cssText = "";
  setProperty(k: string, v: string) {
    this.props.set(k, v);
  }
  removeProperty(k: string) {
    this.props.delete(k);
  }
  toString() {
    return [...this.props].map(([k, v]) => `${k}: ${v}`).join("; ");
  }
}

const styleProxy = (): FakeStyle =>
  new Proxy(new FakeStyle(), {
    set(target, key, value) {
      if (typeof key === "string" && !(key in target)) {
        const k = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        value === "" ? target.removeProperty(k) : target.setProperty(k, String(value));
        return true;
      }
      (target as any)[key] = value;
      return true;
    },
  });

export class FakeElement extends FakeNode {
  nodeType = 1;
  attributes = new Map<string, string>();
  childNodes: FakeNode[] = [];
  style = styleProxy();
  dataset: Record<string, string> = {};
  value = "";
  checked = false;
  selected = false;
  indeterminate = false;
  disabled = false;
  hidden = false;
  required = false;
  multiple = false;
  open = false;
  readOnly = false;
  autofocus = false;
  controls = false;
  private listeners: Record<string, ((e: unknown) => void)[]> = {};
  tagName: string;
  namespaceURI: string;
  constructor(tagName: string, namespaceURI = "http://www.w3.org/1999/xhtml") {
    super();
    this.tagName = tagName;
    this.namespaceURI = namespaceURI;
  }
  get className() {
    return this.attributes.get("class") ?? "";
  }
  set className(v: string) {
    v ? this.attributes.set("class", v) : this.attributes.delete("class");
  }
  get id() {
    return this.attributes.get("id") ?? "";
  }
  get classList() {
    return { contains: (c: string) => this.className.split(/\s+/).includes(c) };
  }
  get children(): FakeElement[] {
    return this.childNodes.filter((c): c is FakeElement => c instanceof FakeElement);
  }
  get childElementCount() {
    return this.children.length;
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get isConnected(): boolean {
    return this.tagName === "#document" ? true : (this.parentNode?.isConnected ?? false);
  }
  setAttribute(k: string, v: string) {
    this.attributes.set(k, v);
    if (k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  getAttribute(k: string) {
    return this.attributes.has(k) ? this.attributes.get(k)! : null;
  }
  hasAttribute(k: string) {
    return this.attributes.has(k);
  }
  removeAttribute(k: string) {
    this.attributes.delete(k);
  }
  appendChild(n: FakeNode) {
    n.parentNode?.removeChild(n);
    n.parentNode = this;
    this.childNodes.push(n);
    return n;
  }
  append(...nodes: FakeNode[]) {
    nodes.forEach((n) => this.appendChild(n));
  }
  insertBefore(n: FakeNode, ref: FakeNode | null) {
    if (!ref) return this.appendChild(n);
    n.parentNode?.removeChild(n);
    n.parentNode = this;
    this.childNodes.splice(this.childNodes.indexOf(ref), 0, n);
    return n;
  }
  removeChild(n: FakeNode) {
    const i = this.childNodes.indexOf(n);
    if (i >= 0) this.childNodes.splice(i, 1);
    n.parentNode = null;
    return n;
  }
  replaceChildren(...nodes: FakeNode[]) {
    for (const c of [...this.childNodes]) this.removeChild(c);
    this.append(...nodes);
  }
  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join("");
  }
  set textContent(v: string) {
    this.replaceChildren(new FakeNode(v));
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener() {}
  dispatch(type: string, event: Record<string, unknown> = {}) {
    for (const fn of this.listeners[type] ?? []) fn({ type, target: this, currentTarget: this, preventDefault() {}, stopPropagation() {}, ...event });
  }
  focus() {}
  setCustomValidity() {}
  closest(selector: string): FakeElement | null {
    let cur: FakeElement | null = this;
    while (cur && cur.tagName !== "#document") {
      if (cur.matches(selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
  /** Tag and class selectors only, which is all the renderer asks after a draw. */
  matches(selector: string): boolean {
    const parts = selector.split(",").map((s) => s.trim());
    return parts.some((sel) => {
      const m = /^([a-z0-9#-]+)?((?:\.[\w-]+)*)$/i.exec(sel);
      if (!m) return false;
      const [, tag, classes] = m;
      if (tag && tag !== this.tagName) return false;
      return (classes ?? "").split(".").filter(Boolean).every((c) => this.classList.contains(c));
    });
  }
  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  querySelectorAll(selector: string): FakeElement[] {
    const scoped = selector.startsWith(":scope > ");
    const sel = scoped ? selector.slice(9) : selector;
    const out: FakeElement[] = [];
    const walk = (el: FakeElement) => {
      for (const c of el.children) {
        if (c.matches(sel)) out.push(c);
        if (!scoped) walk(c);
      }
    };
    walk(this);
    return out;
  }
  getBoundingClientRect() {
    return { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0, x: 0, y: 0 };
  }
  get outerHTML(): string {
    const attrs = [...this.attributes].map(([k, v]) => ` ${k}="${esc(v)}"`).join("");
    const style = String(this.style);
    const props = [
      style ? ` style="${esc(style)}"` : "",
      this.value ? ` value="${esc(this.value)}"` : "",
      ...(["checked", "disabled", "hidden", "required", "multiple", "open", "autofocus", "controls"] as const).map((p) => (this[p] ? ` ${p}=""` : "")),
    ].join("");
    if (VOID.has(this.tagName)) return `<${this.tagName}${attrs}${props}>`;
    return `<${this.tagName}${attrs}${props}>${this.innerHTML}</${this.tagName}>`;
  }
  get innerHTML(): string {
    return this.childNodes.map((c) => (c instanceof FakeElement ? c.outerHTML : String(c))).join("");
  }
  set innerHTML(html: string) {
    this.replaceChildren(new FakeNode(html.replace(/<[^>]+>/g, "")));
  }
  toString() {
    return this.outerHTML;
  }
}

class FakeDocument extends FakeElement {
  activeElement: FakeElement | null = null;
  title = "";
  constructor() {
    super("#document");
  }
  createElement(tag: string) {
    return new FakeElement(tag.toLowerCase());
  }
  createElementNS(ns: string, tag: string) {
    return new FakeElement(tag, ns);
  }
  createTextNode(text: string) {
    return new FakeNode(text);
  }
  getElementById(id: string) {
    return this.querySelectorAll("*").find((e) => e.id === id) ?? null;
  }
  getAnimations() {
    return [];
  }
}

/** Puts the fake DOM on the global scope, the way a browser would; returns a fresh container. */
export function install(): FakeElement {
  const g = globalThis as any;
  const doc = new FakeDocument();
  g.document = doc;
  g.window = g;
  g.Element = FakeElement;
  g.HTMLElement = FakeElement;
  g.HTMLDialogElement = FakeElement;
  g.Node = FakeNode;
  g.CSS = { escape: (s: string) => s.replace(/([^\w-])/g, "\\$1") };
  Object.defineProperty(g, "navigator", { value: { platform: "Win32", clipboard: undefined }, configurable: true });
  g.requestAnimationFrame = (fn: () => void) => setTimeout(fn, 0);
  g.getComputedStyle = () => ({ flexDirection: "row", columnGap: "0", direction: "ltr", getPropertyValue: () => "" });
  const container = new FakeElement("main");
  doc.appendChild(container);
  return container;
}

/** The `matches` above accepts "*" for getElementById's walk. */
const anyMatch = FakeElement.prototype.matches;
FakeElement.prototype.matches = function (selector: string) {
  return selector === "*" || anyMatch.call(this, selector);
};
