/**
 * The document schema, read without a schema library. `@polyxd/spec/browser` compiles it with
 * ajv at load, and Workers refuse code generated from strings, so Studio walks the JSON itself:
 * here for the shapes (what a component's props are, which hold children), in validate.ts for
 * the checking. Everything the editor knows about a component comes from this file.
 */
import schema from "@polyxd/spec/schema/ui.schema.json" with { type: "json" };

export type S = Record<string, any>;
export type Node = Record<string, any> & { id: string; component: string };
export interface Doc {
  specVersion: string;
  surface: Record<string, any> & { id: string; title: string };
  root: string;
  components: Node[];
  data?: Record<string, unknown>;
  [k: string]: unknown;
}

export const uiSchema: S = schema;
const DEFS: Record<string, S> = uiSchema.$defs;

/** The name a $ref points at, if the node is one. */
export const refName = (s: S | undefined): string | undefined => (typeof s?.$ref === "string" ? s.$ref.replace("#/$defs/", "") : undefined);
export function deref(s: S | undefined): S {
  let cur = s;
  for (let i = 0; i < 8 && cur?.$ref; i++) cur = DEFS[refName(cur)!];
  return cur ?? {};
}
export const def = (name: string): S => DEFS[name];

/** Every component the spec knows, in the schema's order. */
export const COMPONENTS: string[] = (DEFS.Component.oneOf as S[]).map((b) => deref(b).properties.component.const);

export const componentDef = (name: string): S | undefined => DEFS[`Component${name}`];

/** Props every component carries, shown apart from its own. */
export const COMMON_PROPS = new Set(["id", "component", "key", "accessibility", "visible"]);

/**
 * Which component types a reference may point to. Copied from the spec's references.ts: its
 * entry modules can't load in a Worker (see the top of this file), and this table is the grammar.
 */
export const REFERENCE_TYPES: Record<string, string[]> = {
  "Card.media": ["Media"],
  "Card.children": ["Text", "Metric", "DetailList", "Group", "Media", "Status", "Toggle", "Action", "ActionBar", "Tag", "Identity", "Progress", "Rating", "Code", "ActionMenu"],
  "Collection.empty": ["Status"],
  "Table.empty": ["Status"],
  "Status.action": ["Action", "ActionBar"],
  "Form.aside": ["DetailList", "Card", "Group"],
  "FilterPanel.children": ["Choice", "RangeInput", "Toggle", "DateInput", "TextInput", "Rating", "ColorInput"],
  "FilterPanel.results": ["Collection", "Table"],
  "ActionBar.children": ["Action"],
  "Confirm.summary": ["DetailList"],
  "Table.toolbar": ["ActionBar"],
  "Table.bulkActions": ["ActionBar"],
  "Table.rowActions": ["ActionBar"],
  "Table.detail": ["DetailList", "Group", "Card", "Text", "Metric", "Status", "Media", "Collection"],
  "Collection.bulkActions": ["ActionBar"],
  "Table.search": ["TextInput"],
  "Surface.actions": ["ActionBar"],
  "Panel.children": ["Section", "Group", "Text", "Metric", "DetailList", "Media", "Status", "Form", "Choice", "TextInput", "Toggle", "DateInput", "RangeInput", "Collection", "Table", "Tree", "Tag", "Identity", "Progress", "Rating", "Code", "FileInput", "ColorInput", "CodeInput", "Disclosure", "Views", "Card"],
  "Panel.actions": ["ActionBar"],
  "ActionMenu.children": ["Action"],
  "ActionMenu.primary": ["Action"],
};

/** What a slot may hold: the reference table's list, or any component. */
export const allowedIn = (component: string, prop: string): string[] => REFERENCE_TYPES[`${component}.${prop}`] ?? COMPONENTS;

/** A prop that holds other components. */
export interface RefProp {
  prop: string;
  /** list: ordered ids; single: one id; template: {path, componentId}; panels: rows with a content id */
  kind: "list" | "single" | "template" | "panels";
  required: boolean;
}

const refPropsCache = new Map<string, RefProp[]>();
/** The props of a component that reference other components, in schema order. */
export function refProps(component: string): RefProp[] {
  const cached = refPropsCache.get(component);
  if (cached) return cached;
  const d = componentDef(component);
  const out: RefProp[] = [];
  for (const [prop, s] of Object.entries<S>(d?.properties ?? {})) {
    const required = (d!.required as string[]).includes(prop);
    const name = refName(s);
    if (name === "ChildList") out.push({ prop, kind: "list", required });
    else if (name === "Id") out.push({ prop, kind: "single", required });
    else if (name === "Template") out.push({ prop, kind: "template", required });
    else if (s.type === "array" && refName(s.items?.properties?.content) === "Id") out.push({ prop, kind: "panels", required });
  }
  refPropsCache.set(component, out);
  return out;
}

export const camel = (id: string) => id.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : "")).replace(/^[A-Z]/, (c) => c.toLowerCase()) || "value";
export const snake = (id: string) => id.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^A-Za-z0-9]+/g, "_").toLowerCase().replace(/^[^a-z]+/, "") || "key";
const words = (prop: string) => prop.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** Placeholder text by prop name; anything else gets its own name, spelt out. */
const TEXT: Record<string, string> = { label: "Label", title: "Title", text: "Text", caption: "What this shows", summary: "Summary", name: "Name", message: "", description: "", subtitle: "", help: "", value: "" };

export interface DefaultCtx {
  component: string;
  id: string;
  prop: string;
  /** Row number when the value sits in an array, so panels read "Step 1", "Step 2". */
  index?: number;
  /** Makes a child component of one of the allowed types and returns its id. */
  makeChild?: (allowed: string[]) => string;
}

/**
 * A value that satisfies a schema node, for a new component or a newly added prop. Children a
 * required reference needs come from `makeChild`, so a Collection gets its template and a Views
 * its first panel rather than an error the moment it exists.
 */
export function defaultFor(s: S, ctx: DefaultCtx, depth = 0): unknown {
  const name = refName(s);
  const d = deref(s);
  const n = ctx.index === undefined ? "" : ` ${ctx.index + 1}`;
  if (name === "Id") return ctx.makeChild?.(allowedIn(ctx.component, ctx.prop)) ?? "";
  // A container starts with one child, so it is valid the moment it exists; a Form's is an input.
  if (name === "ChildList") return ctx.makeChild ? [ctx.makeChild(ctx.component === "Form" ? ["TextInput"] : allowedIn(ctx.component, ctx.prop))] : [];
  if (name === "Template") return { path: "/items", componentId: ctx.makeChild?.(COMPONENTS) ?? "" };
  if (name === "Binding") return { path: `/${camel(["value", "rows", "items", "data", "current", "selected"].includes(ctx.prop) ? ctx.id : ctx.prop)}` };
  if (name === "Path") return ctx.prop.replace(/Path$/, "") || "name";
  if (name === "Key") return snake(ctx.prop === "key" ? ctx.id : ctx.prop) + (n ? `_${ctx.index! + 1}` : "");
  if (name === "Capability") return `${camel(ctx.id)}.${ctx.prop === "action" ? "press" : snake(ctx.prop).replace(/_/g, "")}`;
  if (name === "Options") return [{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }];
  if (name === "Action") return { event: { name: defaultFor({ $ref: "#/$defs/Capability" }, ctx) } };
  if (name === "ActionSpec") return { label: ctx.prop === "cancel" ? "Cancel" : ctx.prop === "confirm" ? "Confirm" : ctx.prop === "finish" ? "Finish" : "Continue", action: defaultFor({ $ref: "#/$defs/Action" }, ctx) };
  if (d.const !== undefined) return d.const;
  if (d.enum) return d.enum[0];
  if (name === "DynamicString" || d.type === "string") return (TEXT[ctx.prop] ?? words(ctx.prop)) + (TEXT[ctx.prop] ? n : "");
  if (d.oneOf) return defaultFor(d.oneOf[0], ctx, depth);
  if (d.type === "number" || d.type === "integer") return ctx.prop === "max" ? 100 : (d.minimum ?? 0);
  if (d.type === "boolean") return false;
  if (d.type === "array") {
    const count = d.minItems ?? (deref(d.items).type === "object" ? 1 : 0);
    return Array.from({ length: count }, (_, index) => defaultFor(d.items ?? {}, { ...ctx, index }, depth + 1));
  }
  if (d.type === "object" || d.properties) {
    if (depth > 4) return {};
    const out: Record<string, unknown> = {};
    for (const k of (d.required as string[] | undefined) ?? []) {
      if (d.properties?.[k]) out[k] = defaultFor(d.properties[k], { ...ctx, prop: k }, depth + 1);
    }
    return out;
  }
  return "";
}

/** A fresh component with its required props filled in. Children it needs come from `makeChild`. */
export function skeleton(component: string, id: string, makeChild?: (allowed: string[]) => string): Node {
  const d = componentDef(component);
  const node: Node = { id, component };
  for (const prop of (d?.required as string[] | undefined) ?? []) {
    if (prop === "id" || prop === "component") continue;
    node[prop] = defaultFor(d!.properties[prop], { component, id, prop, makeChild });
  }
  // A Media needs alt text unless decorative; a new one says so rather than failing.
  if (component === "Media") node.alt = "What the picture shows";
  return node;
}
