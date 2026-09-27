/**
 * The document as a tree. A document is a flat list of components that reference each other by
 * id; the editor shows and edits it as the tree those references make. Every function here takes
 * a document and returns a new one, so the editor can keep history by holding on to old ones.
 */
import { COMPONENTS, allowedIn, refProps, skeleton, type Doc, type Node } from "./schema.ts";

export interface Slot {
  prop: string;
  kind: "list" | "single" | "template" | "panels";
  /** Row in a list or panels prop */
  index?: number;
  /** A panel's own label, for the tree */
  label?: string;
}
export interface TreeItem {
  id: string;
  node: Node;
  slot: Slot | null;
  children: TreeItem[];
}

export const byId = (doc: Doc) => new Map(doc.components.map((c) => [c.id, c]));

/** The ids a node references, each with the slot it sits in, in the order the tree shows them. */
export function childSlots(node: Node): { id: string; slot: Slot }[] {
  const out: { id: string; slot: Slot }[] = [];
  for (const r of refProps(node.component)) {
    const v = node[r.prop];
    if (r.kind === "list" && Array.isArray(v)) v.forEach((id: unknown, index: number) => typeof id === "string" && out.push({ id, slot: { prop: r.prop, kind: "list", index } }));
    else if (r.kind === "single" && typeof v === "string") out.push({ id: v, slot: { prop: r.prop, kind: "single" } });
    else if (r.kind === "template" && typeof v?.componentId === "string") out.push({ id: v.componentId, slot: { prop: r.prop, kind: "template" } });
    else if (r.kind === "panels" && Array.isArray(v)) v.forEach((p: any, index: number) => typeof p?.content === "string" && out.push({ id: p.content, slot: { prop: r.prop, kind: "panels", index, label: typeof p.title === "string" ? p.title : typeof p.label === "string" ? p.label : p.key } }));
  }
  return out;
}

/** The tree from the root, plus anything outside it (the header's ActionBar, a Navigation, strays). */
export function buildTree(doc: Doc): { root: TreeItem | null; others: TreeItem[] } {
  const map = byId(doc);
  const seen = new Set<string>();
  const build = (id: string, slot: Slot | null): TreeItem | null => {
    const node = map.get(id);
    if (!node || seen.has(id)) return null;
    seen.add(id);
    return { id, node, slot, children: childSlots(node).map((c) => build(c.id, c.slot)).filter((x): x is TreeItem => !!x) };
  };
  const root = build(doc.root, null);
  const others: TreeItem[] = [];
  if (typeof doc.surface.actions === "string") {
    const t = build(doc.surface.actions, { prop: "surface.actions", kind: "single" });
    if (t) others.push(t);
  }
  for (const c of doc.components) {
    if (seen.has(c.id)) continue;
    const t = build(c.id, null);
    if (t) others.push(t);
  }
  return { root, others };
}

/** Ids in the order the tree lists them, for arrow keys. */
export function visibleOrder(doc: Doc): string[] {
  const { root, others } = buildTree(doc);
  const out: string[] = [];
  const walk = (t: TreeItem) => {
    out.push(t.id);
    t.children.forEach(walk);
  };
  if (root) walk(root);
  others.forEach(walk);
  return out;
}

/** Where a component sits: its parent and slot, or null for the root and strays. */
export function parentOf(doc: Doc, id: string): { parent: Node; slot: Slot } | null {
  for (const c of doc.components) {
    const hit = childSlots(c).find((s) => s.id === id);
    if (hit) return { parent: c, slot: hit.slot };
  }
  return null;
}

const slug = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").replace(/^[^a-z]/, "c-$&") || "c";

/** An id no component has, from a base like "Text" or "metric-2". */
export function uniqueId(doc: Doc, base: string): string {
  const ids = new Set(doc.components.map((c) => c.id));
  const b = slug(base);
  if (!ids.has(b)) return b;
  const stem = b.replace(/-\d+$/, "");
  for (let n = 2; ; n++) if (!ids.has(`${stem}-${n}`)) return `${stem}-${n}`;
}

/**
 * A new component, with the children its required references need (a Collection's template, a
 * Views' first panel). Returns every node made; the first is the one asked for.
 */
export function makeNodes(doc: Doc, component: string, base = component): Node[] {
  const made: Node[] = [];
  const taken = new Set(doc.components.map((c) => c.id));
  const fresh = (b: string) => {
    let id = slug(b);
    const stem = id.replace(/-\d+$/, "");
    for (let n = 2; taken.has(id); n++) id = `${stem}-${n}`;
    taken.add(id);
    return id;
  };
  const make = (type: string, b: string, depth: number): string => {
    const id = fresh(b);
    // Reserve the place before the children are made, so the one asked for comes first.
    const at = made.length;
    made.push(null as unknown as Node);
    made[at] = skeleton(type, id, depth > 2 ? undefined : (allowed) => make(pick(allowed), `${id}-${pick(allowed).toLowerCase()}`, depth + 1));
    return id;
  };
  make(component, base, 0);
  return made;
}

/** The plainest component a slot allows: something with text, before something with children. */
const pick = (allowed: string[]) => ["Text", "Action", "Group", "Status", "DetailList", "Card", "ActionBar", "TextInput", "Collection"].find((c) => allowed.includes(c)) ?? allowed[0] ?? "Text";

/** Attaches a node id into a parent's slot. A list gets it at `index` (default the end); a single slot is replaced. */
export function attach(doc: Doc, parentId: string, prop: string, id: string, index?: number): Doc {
  return update(doc, parentId, (p) => {
    const r = refProps(p.component).find((x) => x.prop === prop);
    if (!r) return p;
    if (r.kind === "list") {
      const list = Array.isArray(p[prop]) ? [...p[prop]] : [];
      list.splice(index ?? list.length, 0, id);
      return { ...p, [prop]: list };
    }
    if (r.kind === "single") return { ...p, [prop]: id };
    if (r.kind === "template") return { ...p, [prop]: { ...(p[prop] ?? { path: "/items" }), componentId: id } };
    if (r.kind === "panels" && index !== undefined && Array.isArray(p[prop])) {
      const rows = [...p[prop]];
      rows[index] = { ...rows[index], content: id };
      return { ...p, [prop]: rows };
    }
    return p;
  });
}

/** Adds a new component of `component` under `parentId` in `prop`. Returns the document and the new id. */
export function addChild(doc: Doc, parentId: string, prop: string, component: string, index?: number): { doc: Doc; id: string } {
  const nodes = makeNodes(doc, component);
  const withNodes = { ...doc, components: [...doc.components, ...nodes] };
  return { doc: attach(withNodes, parentId, prop, nodes[0].id, index), id: nodes[0].id };
}

export function update(doc: Doc, id: string, fn: (node: Node) => Node): Doc {
  return { ...doc, components: doc.components.map((c) => (c.id === id ? fn(c) : c)) };
}

/** Every id reachable from `id`, itself included. */
export function subtree(doc: Doc, id: string): Set<string> {
  const map = byId(doc);
  const out = new Set<string>();
  const walk = (x: string) => {
    if (out.has(x) || !map.has(x)) return;
    out.add(x);
    for (const c of childSlots(map.get(x)!)) walk(c.id);
  };
  walk(id);
  return out;
}

/** Removes a component and everything only it reaches, and the references that pointed at it. */
export function removeNode(doc: Doc, id: string): Doc {
  if (id === doc.root) return doc;
  const gone = subtree(doc, id);
  const components = doc.components
    .filter((c) => !gone.has(c.id))
    .map((c) => {
      let next = c;
      for (const r of refProps(c.component)) {
        const v = c[r.prop];
        if (r.kind === "list" && Array.isArray(v) && v.some((x: string) => gone.has(x))) next = { ...next, [r.prop]: v.filter((x: string) => !gone.has(x)) };
        else if (r.kind === "single" && typeof v === "string" && gone.has(v)) {
          const { [r.prop]: _, ...rest } = next;
          next = rest as Node;
        } else if (r.kind === "template" && v && gone.has(v.componentId)) {
          const { componentId: _, ...t } = v;
          next = { ...next, [r.prop]: t };
        } else if (r.kind === "panels" && Array.isArray(v) && v.some((p: any) => gone.has(p?.content))) {
          next = { ...next, [r.prop]: v.map((p: any) => (gone.has(p?.content) ? { ...p, content: undefined } : p)) };
        }
      }
      return next;
    });
  const surface = typeof doc.surface.actions === "string" && gone.has(doc.surface.actions) ? { ...doc.surface, actions: undefined } : doc.surface;
  return { ...doc, surface, components };
}

/** Moves a child one place up or down within its parent's list. */
export function moveNode(doc: Doc, id: string, by: -1 | 1): Doc {
  const at = parentOf(doc, id);
  if (!at || at.slot.kind !== "list" || at.slot.index === undefined) return doc;
  const from = at.slot.index;
  const to = from + by;
  return update(doc, at.parent.id, (p) => {
    const list = [...p[at.slot.prop]];
    if (to < 0 || to >= list.length) return p;
    list.splice(from, 1);
    list.splice(to, 0, id);
    return { ...p, [at.slot.prop]: list };
  });
}

/** Reorders a parent's list slot: the child at `from` lands at `to`. */
export function reorder(doc: Doc, parentId: string, prop: string, from: number, to: number): Doc {
  return update(doc, parentId, (p) => {
    const list = Array.isArray(p[prop]) ? [...p[prop]] : [];
    if (from < 0 || from >= list.length || to < 0 || to >= list.length) return p;
    const [x] = list.splice(from, 1);
    list.splice(to, 0, x);
    return { ...p, [prop]: list };
  });
}

/** Copies a component and its subtree with new ids, placed after the original in its parent's list. */
export function duplicateNode(doc: Doc, id: string): { doc: Doc; id: string } | null {
  const at = parentOf(doc, id);
  if (!at || at.slot.kind !== "list" || at.slot.index === undefined) return null;
  const ids = [...subtree(doc, id)];
  const map = byId(doc);
  const taken = new Set(doc.components.map((c) => c.id));
  const renamed = new Map<string, string>();
  for (const old of ids) {
    let n = 2;
    const stem = old.replace(/-\d+$/, "");
    while (taken.has(`${stem}-${n}`)) n++;
    renamed.set(old, `${stem}-${n}`);
    taken.add(`${stem}-${n}`);
  }
  const copies = ids.map((old) => rewriteIds(map.get(old)!, renamed));
  const next = { ...doc, components: [...doc.components, ...copies] };
  return { doc: attach(next, at.parent.id, at.slot.prop, renamed.get(id)!, at.slot.index + 1), id: renamed.get(id)! };
}

/** A node with every reference (and its own id) mapped through `renamed`. */
function rewriteIds(node: Node, renamed: Map<string, string>): Node {
  const out: Node = { ...node, id: renamed.get(node.id) ?? node.id };
  for (const r of refProps(node.component)) {
    const v = node[r.prop];
    if (r.kind === "list" && Array.isArray(v)) out[r.prop] = v.map((x: string) => renamed.get(x) ?? x);
    else if (r.kind === "single" && typeof v === "string") out[r.prop] = renamed.get(v) ?? v;
    else if (r.kind === "template" && v?.componentId) out[r.prop] = { ...v, componentId: renamed.get(v.componentId) ?? v.componentId };
    else if (r.kind === "panels" && Array.isArray(v)) out[r.prop] = v.map((p: any) => (p?.content ? { ...p, content: renamed.get(p.content) ?? p.content } : p));
  }
  return out;
}

/** Renames a component, updating the root, the surface and every reference. */
export function renameNode(doc: Doc, from: string, to: string): Doc {
  if (from === to || doc.components.some((c) => c.id === to)) return doc;
  const renamed = new Map([[from, to]]);
  return {
    ...doc,
    root: doc.root === from ? to : doc.root,
    surface: doc.surface.actions === from ? { ...doc.surface, actions: to } : doc.surface,
    components: doc.components.map((c) => rewriteIds(c, renamed)),
  };
}

/** A blank screen: a Group with one line of text, so the preview says something. */
export function blankDocument(title: string, intent: string): Doc {
  return {
    specVersion: "0.2.0",
    surface: { id: slug(title) || "screen", title, ...(intent ? { intent } : {}), origin: "authored" },
    root: "root",
    components: [
      { id: "root", component: "Group", children: ["intro"] },
      { id: "intro", component: "Text", text: "Add components from the tree on the left, and bind them to the sample data." },
    ],
    data: {},
  };
}

/** Every JSON Pointer in the sample data, for the binding picker. */
export function pointers(data: unknown, at = "", out: { pointer: string; value: unknown }[] = [], depth = 0): { pointer: string; value: unknown }[] {
  if (depth > 5 || !data || typeof data !== "object") return out;
  if (Array.isArray(data)) {
    // One entry stands for the list's items, so the picker shows the fields without every index.
    if (data.length) pointers(data[0], `${at}/0`, out, depth + 1);
    return out;
  }
  for (const [k, v] of Object.entries(data)) {
    const p = `${at}/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`;
    out.push({ pointer: p, value: v });
    pointers(v, p, out, depth + 1);
  }
  return out;
}

export { COMPONENTS, allowedIn };
