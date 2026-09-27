/**
 * A small virtual DOM: components describe elements, the patcher keeps the real ones in step.
 * It exists so a re-render after every keystroke leaves the element someone is typing in alone
 * (identity, focus and caret survive), the way a React tree does, without a framework.
 */

export type Props = Record<string, unknown>;
export interface VNode {
  tag: string;
  props: Props;
  children: VChild[];
  key?: string | number;
}
/** A host element the renderer adopts as it is (a Frame's outlet, a host component's output). */
export interface Adopted {
  dom: Element;
  key?: string | number;
}
export type VChild = VNode | Adopted | string | number | null | undefined | false | VChild[];

type Handler = (e: Event) => void;
interface Tracked extends Element {
  __vnode?: VNode | Adopted | string;
  __on?: Record<string, Handler>;
  __ref?: (el: Element | null) => void;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(["svg", "path", "circle", "rect", "line", "polyline", "polygon", "g", "text"]);
/** Set as properties, so a controlled input shows the value the document holds. */
const PROPERTIES = new Set(["value", "checked", "selected", "indeterminate", "textContent"]);
/** Set as attributes even though the element has a property of that name (form controls read these from the markup). */
const ATTRIBUTES = new Set(["list", "form", "type", "autocomplete", "for", "role", "tabindex", "lang", "dir", "translate", "spellcheck", "autocapitalize", "autocorrect", "inputmode", "enterkeyhint", "colspan", "rowspan", "scope", "title", "width", "height", "size", "min", "max", "step", "pattern", "placeholder", "maxlength", "minlength", "accept", "alt", "src", "href", "rel", "poster", "controls", "name", "contenteditable", "draggable", "autofocus"]);

export function h(tag: string, props: Props | null, ...children: VChild[]): VNode {
  const p = props ?? {};
  return { tag, props: p, children, key: p.key as string | number | undefined };
}

/** A real element placed in the tree as it is; its inside is the host's business. */
export const adopt = (dom: Element, key?: string | number): Adopted => ({ dom, key });

const isAdopted = (v: unknown): v is Adopted => !!v && typeof v === "object" && "dom" in (v as object);

function flatten(children: VChild[], out: (VNode | Adopted | string)[] = []): (VNode | Adopted | string)[] {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) flatten(c, out);
    else if (typeof c === "number") out.push(String(c));
    else out.push(c);
  }
  return out;
}

function setStyle(el: HTMLElement, value: unknown, previous: unknown) {
  if (typeof value === "string") {
    el.style.cssText = value;
    return;
  }
  const next = (value ?? {}) as Record<string, string | number | undefined>;
  const prev = (typeof previous === "object" && previous) || {};
  for (const k of Object.keys(prev)) if (!(k in next)) k.startsWith("--") ? el.style.removeProperty(k) : ((el.style as any)[k] = "");
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === null) k.startsWith("--") ? el.style.removeProperty(k) : ((el.style as any)[k] = "");
    else if (k.startsWith("--")) el.style.setProperty(k, String(v));
    else (el.style as any)[k] = typeof v === "number" && !/^(opacity|zIndex|flex|lineHeight|fontWeight|order)$/.test(k) ? `${v}px` : String(v);
  }
}

function setProp(el: Tracked, name: string, value: unknown, previous: unknown, svg: boolean) {
  if (name === "key" || name === "children") return;
  if (name === "ref") {
    el.__ref = value as (el: Element | null) => void;
    return;
  }
  if (name.startsWith("on") && (typeof value === "function" || value === undefined)) {
    const event = name.slice(2).toLowerCase();
    const on = (el.__on ??= {});
    if (value && !on[event]) el.addEventListener(event, (e) => el.__on?.[event]?.(e));
    if (value) on[event] = value as Handler;
    else delete on[event];
    return;
  }
  if (name === "style") return setStyle(el as HTMLElement, value, previous);
  if (name === "class" || name === "className") {
    const v = value === undefined || value === null || value === false ? "" : String(value);
    if (svg) v ? el.setAttribute("class", v) : el.removeAttribute("class");
    else if ((el as HTMLElement).className !== v) (el as HTMLElement).className = v;
    return;
  }
  const lower = name.toLowerCase();
  if (!svg && PROPERTIES.has(name)) {
    const v = value === undefined || value === null ? (typeof (el as any)[name] === "boolean" ? false : "") : value;
    if ((el as any)[name] !== v) (el as any)[name] = v;
    return;
  }
  if (!svg && !name.includes("-") && !ATTRIBUTES.has(lower) && name in el && typeof (el as any)[name] !== "function" && typeof (el as any)[name] === "boolean") {
    // disabled, hidden, required, multiple, open, readOnly…: the property mirrors the attribute.
    (el as any)[name] = Boolean(value);
    return;
  }
  // An ARIA state that is false is still a state ("aria-checked=false"); any other false attribute is absent.
  if (value === undefined || value === null || (value === false && !name.startsWith("aria-"))) el.removeAttribute(lower === "classname" ? "class" : name);
  else el.setAttribute(name, value === true ? (name.startsWith("aria-") || name === "draggable" || name === "contenteditable" ? "true" : "") : String(value));
}

function create(v: VNode | Adopted | string, svg: boolean): Node {
  if (typeof v === "string") {
    const text = document.createTextNode(v) as unknown as Tracked;
    text.__vnode = v;
    return text;
  }
  if (isAdopted(v)) {
    (v.dom as Tracked).__vnode = v;
    return v.dom;
  }
  const isSvg = svg || SVG_TAGS.has(v.tag);
  const el = (isSvg ? document.createElementNS(SVG_NS, v.tag) : document.createElement(v.tag)) as Tracked;
  for (const [k, val] of Object.entries(v.props)) setProp(el, k, val, undefined, isSvg);
  for (const c of flatten(v.children)) el.appendChild(create(c, isSvg));
  el.__vnode = v;
  return el;
}

/** Called once the element is in the document, so a ref may measure it or open it modally. */
function mounted(node: Node) {
  const el = node as Tracked;
  if (el.nodeType !== 1) return;
  el.__ref?.(el);
  for (const c of Array.from(el.childNodes)) if (!(c as Tracked).__vnode || !isAdopted((c as Tracked).__vnode)) mounted(c);
}

function unmounted(node: Node) {
  const el = node as Tracked;
  if (el.nodeType !== 1) return;
  if (isAdopted(el.__vnode)) return;
  el.__ref?.(null);
  for (const c of Array.from(el.childNodes)) unmounted(c);
}

const keyOf = (v: VNode | Adopted | string | undefined) => (v && typeof v === "object" ? v.key : undefined);
const sameKind = (a: VNode | Adopted | string | undefined, b: VNode | Adopted | string) =>
  a !== undefined && typeof a === typeof b && (typeof a === "string" || (isAdopted(a) ? isAdopted(b) && a.dom === b.dom : !isAdopted(b) && (a as VNode).tag === (b as VNode).tag && keyOf(a) === keyOf(b)));

/** Brings an existing element in line with a new description of the same kind. */
function update(node: Node, next: VNode | Adopted | string, svg: boolean) {
  const el = node as Tracked;
  const prev = el.__vnode;
  if (typeof next === "string") {
    if (node.textContent !== next) node.textContent = next;
    el.__vnode = next;
    return;
  }
  if (isAdopted(next)) return;
  const previous = (prev as VNode | undefined)?.props ?? {};
  const isSvg = svg || SVG_TAGS.has(next.tag);
  for (const k of Object.keys(previous)) if (!(k in next.props)) setProp(el, k, undefined, previous[k], isSvg);
  for (const [k, val] of Object.entries(next.props)) if (k === "style" || k === "ref" || previous[k] !== val) setProp(el, k, val, previous[k], isSvg);
  el.__vnode = next;
  reconcile(el, flatten(next.children), isSvg);
}

/** Keyed reconciliation of a parent's children: matched by key, else by position and kind. */
function reconcile(parent: Element, next: (VNode | Adopted | string)[], svg: boolean) {
  const old = Array.from(parent.childNodes) as Tracked[];
  const byKey = new Map<string | number, Tracked>();
  for (const o of old) {
    const k = keyOf(o.__vnode);
    if (k !== undefined) byKey.set(k, o);
  }
  const used = new Set<Tracked>();
  let cursor: Tracked | null = old[0] ?? null;
  for (const n of next) {
    const k = keyOf(n);
    let match: Tracked | undefined;
    if (k !== undefined) match = byKey.get(k);
    else if (cursor && !used.has(cursor) && keyOf(cursor.__vnode) === undefined && sameKind(cursor.__vnode, n)) match = cursor;
    if (match && sameKind(match.__vnode, n)) {
      used.add(match);
      if (match !== cursor) parent.insertBefore(match, cursor);
      else cursor = (cursor.nextSibling as Tracked | null) ?? null;
      update(match, n, svg);
    } else {
      const made = create(n, svg);
      parent.insertBefore(made, cursor);
      mounted(made);
    }
  }
  for (const o of old) {
    if (used.has(o)) continue;
    unmounted(o);
    o.remove();
  }
}

/** Renders children into a container, patching what is already there. */
export function render(container: Element, children: VChild[]): void {
  reconcile(container, flatten(children), false);
}

/** Takes everything down, calling refs so observers and dialogs are released. */
export function unmount(container: Element): void {
  for (const c of Array.from(container.childNodes)) {
    unmounted(c);
    c.remove();
  }
}
