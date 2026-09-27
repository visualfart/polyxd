/**
 * A new component's skeleton: its required props filled with placeholders, an id from its name,
 * and the children a required reference needs, so it is valid the moment it lands in the file.
 * The rules are Studio's (apps/studio/src/screens/schema.ts: defaultFor and skeleton), copied so
 * the editor and Studio start a component the same way; the two aren't sharing code yet.
 */
import schema from "@polyxd/spec/schema/ui.schema.json" with { type: "json" };
import catalog from "@polyxd/spec/catalog/catalog.json" with { type: "json" };
import { REFERENCE_TYPES } from "@polyxd/spec/browser";
import { nodeAtPointer, type JsonNode } from "./json.ts";

export type S = Record<string, any>;
export type Node = Record<string, any> & { id: string; component: string };

const DEFS: Record<string, S> = (schema as S).$defs;
const CATALOG = (catalog as { components: Record<string, { summary: string; category: string }> }).components;

export const refName = (s: S | undefined): string | undefined => (typeof s?.$ref === "string" ? s.$ref.replace("#/$defs/", "") : undefined);
export function deref(s: S | undefined): S {
  let cur = s;
  for (let i = 0; i < 8 && cur?.$ref; i++) cur = DEFS[refName(cur)!];
  return cur ?? {};
}

/** Every component the spec knows, in the schema's order. */
export const COMPONENTS: string[] = (DEFS.Component.oneOf as S[]).map((b) => deref(b).properties.component.const);
export const CATEGORIES = ["structure", "layout", "content", "input", "action", "feedback", "flow"];
export const componentDef = (name: string): S | undefined => DEFS[`Component${name}`];
export const summaryOf = (name: string): string => CATALOG[name]?.summary ?? "";
export const categoryOf = (name: string): string => CATALOG[name]?.category ?? "other";

/** Which component types a reference may point to: the spec's table, or any component. */
const allowedIn = (component: string, prop: string): string[] => (REFERENCE_TYPES as Record<string, string[]>)[`${component}.${prop}`] ?? COMPONENTS;

export const camel = (id: string) => id.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : "")).replace(/^[A-Z]/, (c) => c.toLowerCase()) || "value";
export const snake = (id: string) => id.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^A-Za-z0-9]+/g, "_").toLowerCase().replace(/^[^a-z]+/, "") || "key";
const words = (prop: string) => prop.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

const TEXT: Record<string, string> = { label: "Label", title: "Title", text: "Text", caption: "What this shows", summary: "Summary", name: "Name", message: "", description: "", subtitle: "", help: "", value: "" };

interface DefaultCtx {
  component: string;
  id: string;
  prop: string;
  index?: number;
  makeChild?: (allowed: string[]) => string;
  /** Records a value someone will want to replace, as a pointer relative to the component. */
  placeholder?: (at: string) => void;
  at: string;
}

function defaultFor(s: S, ctx: DefaultCtx, depth = 0): unknown {
  const name = refName(s);
  const d = deref(s);
  const n = ctx.index === undefined ? "" : ` ${ctx.index + 1}`;
  const mark = () => ctx.placeholder?.(ctx.at);
  if (name === "Id") return ctx.makeChild?.(allowedIn(ctx.component, ctx.prop)) ?? "";
  if (name === "ChildList") return ctx.makeChild ? [ctx.makeChild(ctx.component === "Form" ? ["TextInput"] : allowedIn(ctx.component, ctx.prop))] : [];
  if (name === "Template") {
    ctx.placeholder?.(`${ctx.at}/path`);
    return { path: "/items", componentId: ctx.makeChild?.(COMPONENTS) ?? "" };
  }
  if (name === "Binding") {
    ctx.placeholder?.(`${ctx.at}/path`);
    return { path: `/${camel(["value", "rows", "items", "data", "current", "selected"].includes(ctx.prop) ? ctx.id : ctx.prop)}` };
  }
  if (name === "Path") return mark(), ctx.prop.replace(/Path$/, "") || "name";
  if (name === "Key") return snake(ctx.prop === "key" ? ctx.id : ctx.prop) + (n ? `_${ctx.index! + 1}` : "");
  if (name === "Capability") return mark(), `${camel(ctx.id)}.${ctx.prop === "action" ? "press" : snake(ctx.prop).replace(/_/g, "")}`;
  if (name === "Options") return [{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }];
  if (name === "Action") return { event: { name: defaultFor({ $ref: "#/$defs/Capability" }, { ...ctx, at: `${ctx.at}/event/name` }) } };
  if (name === "ActionSpec") {
    ctx.placeholder?.(`${ctx.at}/label`);
    return { label: ctx.prop === "cancel" ? "Cancel" : ctx.prop === "confirm" ? "Confirm" : ctx.prop === "finish" ? "Finish" : "Continue", action: defaultFor({ $ref: "#/$defs/Action" }, { ...ctx, at: `${ctx.at}/action` }) };
  }
  if (d.const !== undefined) return d.const;
  if (d.enum) return d.enum[0];
  if (typeof d.pattern === "string" && d.type === "string") {
    // A constrained name (a Custom's "brand.logo"): something of the component's own that fits.
    const candidate = `${camel(ctx.id).toLowerCase()}.${ctx.prop.toLowerCase()}`;
    if (new RegExp(d.pattern).test(candidate)) return mark(), candidate;
  }
  if (name === "DynamicString" || d.type === "string") return mark(), (TEXT[ctx.prop] ?? words(ctx.prop)) + (TEXT[ctx.prop] ? n : "");
  if (d.oneOf) return defaultFor(d.oneOf[0], ctx, depth);
  if (d.type === "number" || d.type === "integer") return ctx.prop === "max" ? 100 : (d.minimum ?? 0);
  if (d.type === "boolean") return false;
  if (d.type === "array") {
    const count = d.minItems ?? (deref(d.items).type === "object" ? 1 : 0);
    return Array.from({ length: count }, (_, index) => defaultFor(d.items ?? {}, { ...ctx, index, at: `${ctx.at}/${index}` }, depth + 1));
  }
  if (d.type === "object" || d.properties) {
    if (depth > 4) return {};
    const out: Record<string, unknown> = {};
    for (const k of (d.required as string[] | undefined) ?? []) {
      if (d.properties?.[k]) out[k] = defaultFor(d.properties[k], { ...ctx, prop: k, at: `${ctx.at}/${k}` }, depth + 1);
    }
    return out;
  }
  return "";
}

export interface Skeleton {
  /** The component asked for, first, then the children its required references needed. */
  nodes: Node[];
  /** Pointers (relative to each node, by index) of values to replace: "0/label", "1/items/path". */
  placeholders: string[];
}

/** An id for a component of `type` that no component in `taken` has: "action", then "action_2". */
export function idFor(type: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = snake(type);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}_${n}`)) return `${base}_${n}`;
}

/** A fresh component with its required props filled in, plus the children it needs. */
export function skeleton(component: string, taken: Iterable<string>, id = idFor(component, taken)): Skeleton {
  const used = new Set(taken);
  used.add(id);
  const nodes: Node[] = [];
  const placeholders: string[] = [];
  const make = (type: string, own: string, depth: number): Node => {
    const d = componentDef(type);
    const node: Node = { id: own, component: type };
    const index = nodes.length;
    nodes.push(node);
    // Text can sit almost anywhere and never needs children of its own: the child of choice.
    const makeChild = depth < 3 ? (allowed: string[]) => {
      const childType = allowed.includes("Text") ? "Text" : allowed[0];
      const childId = idFor(childType, used);
      used.add(childId);
      make(childType, childId, depth + 1);
      return childId;
    } : undefined;
    for (const prop of (d?.required as string[] | undefined) ?? []) {
      if (prop === "id" || prop === "component") continue;
      node[prop] = defaultFor(d!.properties[prop], { component: type, id: own, prop, makeChild, at: `${index}/${prop}`, placeholder: (at) => placeholders.push(at) });
    }
    // A Media needs alt text unless decorative; a new one says so rather than failing.
    if (type === "Media") {
      node.alt = "What the picture shows";
      placeholders.push(`${index}/alt`);
    }
    return node;
  };
  make(component, id, 0);
  return { nodes, placeholders };
}

const SNIPPET_ESCAPE = /[$}\\]/g;
const esc = (s: string) => s.replace(SNIPPET_ESCAPE, (c) => `\\${c}`);

/**
 * The skeleton as VS Code snippet text (tab stops on every placeholder), one component per element,
 * indented by `indent` per level from `base`. Keys stay in the order the schema lists them.
 */
export function toSnippet(sk: Skeleton, indent: string, base: string): string {
  const stops = new Map(sk.placeholders.map((p, i) => [p, i + 1]));
  const write = (v: unknown, at: string, level: number): string => {
    const pad = base + indent.repeat(level);
    const inner = base + indent.repeat(level + 1);
    if (Array.isArray(v)) return v.length ? `[\n${v.map((x, i) => inner + write(x, `${at}/${i}`, level + 1)).join(",\n")}\n${pad}]` : "[]";
    if (v && typeof v === "object") {
      const entries = Object.entries(v as Record<string, unknown>);
      return entries.length ? `{\n${entries.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${write(x, `${at}/${k}`, level + 1)}`).join(",\n")}\n${pad}}` : "{}";
    }
    const literal = esc(JSON.stringify(v));
    const stop = stops.get(at);
    // The tab stop sits inside the quotes so typing replaces the placeholder and keeps the string.
    return stop && typeof v === "string" ? `"\${${stop}:${esc(String(v))}}"` : literal;
  };
  return sk.nodes.map((n, i) => write(n, String(i), 0)).join(`,\n${base}`);
}

export interface Insertion {
  /** Where the new text goes. */
  offset: number;
  /** Text before the skeleton (a comma, a line break, indentation) and after it. */
  before: string;
  after: string;
  /** Indentation of an element of the array, and of one level inside it. */
  base: string;
  indent: string;
}

/**
 * Where a new element goes in the `components` array (at `pointer`) for a cursor at `offset`:
 * after the element the cursor is in, at the cursor's gap between elements, or at the end when
 * the cursor is elsewhere. The array's own indentation is kept.
 */
export function insertionPoint(text: string, root: JsonNode, pointer: string, offset: number): Insertion | undefined {
  const { node, exact } = nodeAtPointer(root, pointer);
  if (!exact || node.type !== "array") return undefined;
  const children = node.children ?? [];
  const lineIndent = (at: number) => {
    const lineStart = text.lastIndexOf("\n", at - 1) + 1;
    return /^[ \t]*/.exec(text.slice(lineStart, at))![0];
  };
  const arrayIndent = lineIndent(node.keyOffset ?? node.offset);
  const first = children[0];
  const indent = first ? lineIndent(first.offset).slice(arrayIndent.length) || "  " : "  ";
  const base = arrayIndent + indent;
  if (!children.length) {
    return { offset: node.offset + 1, before: `\n${base}`, after: `\n${arrayIndent}`, base, indent };
  }
  const inside = offset > node.offset && offset < node.offset + node.length;
  let index = children.length; // append
  if (inside) {
    const hit = children.findIndex((c) => offset >= c.offset && offset <= c.offset + c.length);
    if (hit >= 0) index = hit + 1;
    else {
      const next = children.findIndex((c) => c.offset > offset);
      index = next < 0 ? children.length : next;
    }
  }
  if (index === 0) return { offset: first.offset, before: "", after: `,\n${base}`, base, indent };
  const prev = children[index - 1];
  return { offset: prev.offset + prev.length, before: `,\n${base}`, after: "", base, indent };
}
