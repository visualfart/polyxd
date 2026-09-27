/**
 * The tree authoring form (schema/ui-tree.schema.json) and the flat wire form (schema/ui.schema.json)
 * describe the same document. Models author trees (children inline, ids optional); hosts, renderers
 * and A2UI use the flat form. These functions convert between them deterministically.
 */

type Json = any;

/** Props that hold component references, by component (mirrors the reference props in the schema). */
const LIST_REFS: Record<string, string[]> = { Section: ["children"], Group: ["children"], Card: ["children"], Disclosure: ["children"], Form: ["children"], ActionBar: ["children"], FilterPanel: ["children"], Panel: ["children"], ActionMenu: ["children"], Columns: ["children"] };
const SINGLE_REFS: Record<string, string[]> = {
  Card: ["media"],
  Collection: ["empty", "bulkActions"],
  Table: ["empty", "toolbar", "bulkActions", "rowActions", "search", "detail"],
  Status: ["action"],
  Confirm: ["summary"],
  Form: ["aside"],
  FilterPanel: ["results"],
  Panel: ["actions"],
  ActionMenu: ["primary"],
  Split: ["primary", "detail", "empty"],
  // The shell: a Frame's regions in reading order, and what the bars hold.
  Frame: ["banner", "header", "navigation", "main", "aside", "footer"],
  AppBar: ["leading", "search", "actions", "account"],
  Footer: ["aside"],
  Outlet: ["loading"],
  Custom: ["fallback"],
};
const PANEL_REFS: Record<string, string> = { Views: "views", Steps: "steps" };

const ID = /^[A-Za-z][A-Za-z0-9_-]*$/;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^([^a-z])/, "c-$1") || "c";

/** Compiles a tree-form document into the flat form. Ids are kept when valid and unique, otherwise generated. */
export function flattenTree(tree: Json): Json {
  const components: Json[] = [];
  const used = new Set<string>();
  const idFor = (node: Json) => {
    const base = typeof node.id === "string" && ID.test(node.id) ? node.id : slug(node.key ?? node.component ?? "c");
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  const visit = (node: Json): string => {
    if (!node || typeof node !== "object" || typeof node.component !== "string") throw new Error("expected a component object");
    const id = idFor(node);
    const flat: Json = { ...node, id };
    components.push(flat);
    for (const p of LIST_REFS[node.component] ?? []) if (Array.isArray(node[p])) flat[p] = node[p].map(visit);
    for (const p of SINGLE_REFS[node.component] ?? []) if (node[p] && typeof node[p] === "object") flat[p] = visit(node[p]);
    if (node.component === "Collection" && node.items && typeof node.items === "object" && "item" in node.items) {
      flat.items = { path: node.items.path, componentId: visit(node.items.item) };
    }
    const panel = PANEL_REFS[node.component];
    if (panel && Array.isArray(node[panel])) flat[panel] = node[panel].map((x: Json) => ({ ...x, content: x.content && typeof x.content === "object" ? visit(x.content) : x.content }));
    return id;
  };
  const { root, navigation, surface, ...rest } = tree;
  const rootId = visit(root);
  // The product's navigation and the surface's own header actions sit outside the root component.
  const nav = navigation ? visit(navigation) : undefined;
  const out: Json = { ...rest, root: rootId, components };
  if (surface) {
    const actions = surface.actions && typeof surface.actions === "object" ? visit(surface.actions) : surface.actions;
    out.surface = actions === undefined ? surface : { ...surface, actions };
  }
  void nav; // its components are in the flat list; the flat form has no navigation key
  return out;
}

/** The inverse: nests a flat document into tree form (used for round-trip tests and training targets). */
export function toTree(flat: Json): Json {
  const byId = new Map<string, Json>(flat.components.map((c: Json) => [c.id, c]));
  const built = new Set<string>();
  const build = (id: string, seen = new Set<string>()): Json => {
    const c = byId.get(id);
    if (!c) throw new Error(`unknown component "${id}"`);
    if (seen.has(id)) throw new Error(`cycle at "${id}"`);
    const next = new Set(seen).add(id);
    built.add(id);
    const node: Json = { ...c };
    for (const p of LIST_REFS[c.component] ?? []) if (Array.isArray(c[p])) node[p] = c[p].map((x: string) => build(x, next));
    for (const p of SINGLE_REFS[c.component] ?? []) if (typeof c[p] === "string") node[p] = build(c[p], next);
    if (c.component === "Collection" && c.items?.componentId) node.items = { path: c.items.path, item: build(c.items.componentId, next) };
    const panel = PANEL_REFS[c.component];
    if (panel && Array.isArray(c[panel])) node[panel] = c[panel].map((x: Json) => ({ ...x, content: build(x.content, next) }));
    return node;
  };
  const { root, components: _components, surface, ...rest } = flat;
  const out: Json = { ...rest, root: build(root) };
  if (surface) {
    out.surface = typeof surface.actions === "string" ? { ...surface, actions: build(surface.actions) } : surface;
  }
  // A surface's navigation sits outside its root; a shell's is inside the Frame, already built.
  const nav = flat.components.find((c: Json) => c.component === "Navigation" && !built.has(c.id));
  if (nav) out.navigation = build(nav.id);
  return out;
}

/** True when a document is in tree form (its root is a component object, not an id). */
export const isTree = (doc: Json) => !!doc && typeof doc.root === "object" && doc.root !== null;
