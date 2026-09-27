/**
 * Checks a document the way the spec's validateDocument does, without ajv, so it runs in the
 * Worker at save and in the browser as the designer edits (see schema.ts for why). Schema first;
 * when that passes, the rules the schema can't say: references, one parent each, no cycles,
 * primary-action budget, bindings against the sample data, and the workspace's own rules.
 */
import { readingOrder, runCheck, type Check } from "@polyxd/spec/checks";
import { REFERENCE_TYPES, SHELL_COMPONENTS, belongsInShell, componentDef, deref, refName, uiSchema, type Doc, type Node, type S } from "./schema.ts";

export interface Issue {
  severity: "error" | "warning";
  /** JSON Pointer into the document */
  at: string;
  message: string;
  /** As the spec's: a binding that reads nothing, the shell's structure; plus a workspace rule. */
  code?: "data:missing-path" | "shell:structure" | "rule";
}
export interface CheckResult {
  valid: boolean;
  issues: Issue[];
}
export interface Rule {
  name: string;
  severity: "error" | "warning";
  check: Check;
}
export interface CheckOptions {
  /** How a binding that reads nothing from the sample data is reported. Default "warning". */
  missingData?: "warning" | "error";
  emphasisBudget?: number;
  /** The workspace's rules, run as the verifier would. */
  rules?: Rule[];
}

type Json = unknown;
const typeOf = (v: Json) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
const hasType = (v: Json, t: string | string[]) => {
  const ts = Array.isArray(t) ? t : [t];
  const actual = typeOf(v);
  return ts.some((x) => (x === "integer" ? typeof v === "number" && Number.isInteger(v) : x === actual));
};
const describe = (s: S): string => {
  const d = deref(s);
  if (d.enum) return `one of ${d.enum.map((e: unknown) => JSON.stringify(e)).join(", ")}`;
  if (d.const !== undefined) return JSON.stringify(d.const);
  if (d.oneOf) return d.oneOf.map(describe).join(" or ");
  const n = refName(s);
  if (n === "Binding") return "a binding { path }";
  if (n === "Id") return "a component id";
  if (Array.isArray(d.type)) return d.type.join(" or ");
  return d.type ?? "a value";
};

/** JSON Schema, the subset this schema uses: types, enums, required, patterns, bounds, oneOf by type, discriminator. */
function checkSchema(value: Json, s: S, at: string, error: (at: string, m: string) => void): void {
  const d = deref(s);
  if (d.oneOf) {
    const branches: S[] = d.oneOf;
    if (d.discriminator) {
      const key = d.discriminator.propertyName;
      const name = value && typeof value === "object" ? (value as S)[key] : undefined;
      const branch = branches.find((b) => deref(b).properties?.[key]?.const === name);
      if (!branch) return error(`${at}/${key}`, name === undefined ? "missing component type" : `unknown component "${name}"`);
      return checkSchema(value, branch, at, error);
    }
    // Every oneOf here is told apart by JSON type (a string or a binding, a list or a lookup).
    const branch = branches.find((b) => {
      const bd = deref(b);
      return bd.type ? hasType(value, bd.type) : bd.properties ? typeOf(value) === "object" : true;
    });
    if (!branch) return error(at, `expected ${describe(d)}`);
    return checkSchema(value, branch, at, error);
  }
  if (d.const !== undefined) {
    if (value !== d.const) error(at, `must be ${JSON.stringify(d.const)}`);
    return;
  }
  if (d.enum) {
    if (!d.enum.includes(value)) error(at, `must be ${describe(d)}`);
    return;
  }
  if (d.type && !hasType(value, d.type)) return error(at, `expected ${describe(d)}, got ${typeOf(value)}`);
  if (typeof value === "string" && d.pattern && !new RegExp(d.pattern).test(value)) return error(at, patternHint(s, d));
  if (typeof value === "number") {
    if (d.minimum !== undefined && value < d.minimum) error(at, `must be at least ${d.minimum}`);
    if (d.exclusiveMinimum !== undefined && value <= d.exclusiveMinimum) error(at, `must be more than ${d.exclusiveMinimum}`);
    if (d.maximum !== undefined && value > d.maximum) error(at, `must be at most ${d.maximum}`);
  }
  if (Array.isArray(value)) {
    if (d.minItems !== undefined && value.length < d.minItems) error(at, `needs at least ${d.minItems} item${d.minItems === 1 ? "" : "s"}`);
    if (d.maxItems !== undefined && value.length > d.maxItems) error(at, `allows at most ${d.maxItems} items`);
    if (d.items) value.forEach((v, i) => checkSchema(v, d.items, `${at}/${i}`, error));
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, Json>;
    for (const k of (d.required as string[] | undefined) ?? []) if (obj[k] === undefined) error(at, `must have required property "${k}"`);
    for (const [k, v] of Object.entries(obj)) {
      const sub = d.properties?.[k];
      if (sub) checkSchema(v, sub, `${at}/${k}`, error);
      else if (d.additionalProperties === false) error(`${at}/${k}`, `unknown property "${k}"`);
      else if (typeof d.additionalProperties === "object") checkSchema(v, d.additionalProperties, `${at}/${k}`, error);
    }
  }
}

function patternHint(s: S, d: S): string {
  switch (refName(s)) {
    case "Id": return "an id starts with a letter and has only letters, digits, _ and -";
    case "Key": return "a key is lower-case words joined by _ and ., like fee or recipient.name";
    case "Path": return "a path is a JSON Pointer: /account/balance, or name inside a repeated item";
    case "Capability": return "a capability is dotted lower-case words, like transfer.confirm";
    default: return `must match ${d.pattern}`;
  }
}

// ---- The structural rules, kept in step with the spec's validate.ts.

/** Props whose paths resolve against the current item of a repeated structure. */
const ITEM_SCOPED: Record<string, string[]> = {
  Table: ["columns", "rowAction", "rowValuePath"],
  Tree: ["labelPath", "childrenPath", "valuePath", "detailPath", "action"],
  Chart: ["x", "series"],
  Comparison: ["itemTitle", "attributes", "choose"],
  Collection: ["datePath"],
  Text: ["itemPath"],
  Media: ["imagePath", "altPath"],
  DetailList: ["rowAction"],
};
const PANEL_PROPS: Record<string, string[]> = { Views: ["views"], Steps: ["steps"] };
const RENDERER_ACTIONS = new Set(["ui.dismiss", "ui.back", "ui.next", "ui.copy"]);
const LIST_BINDINGS: Record<string, string> = { Collection: "items", Table: "rows", Comparison: "items", Chart: "data", Choice: "options", Tree: "items", Text: "items", Media: "items" };
const INPUTS = new Set(["TextInput", "Choice", "Toggle", "DateInput", "RangeInput", "Rating", "FileInput", "ColorInput", "CodeInput"]);

interface ListScope {
  path: string;
  parent?: ListScope;
}
interface Found {
  ids: { id: string; at: string; prop: string; panel?: string }[];
  paths: { path: string; at: string; itemScoped: boolean; list?: ListScope }[];
  actions: { name: string; at: string }[];
}

/** Walks a value alongside its schema, collecting component references, data paths and action names. */
function walk(schema: S, value: Json, at: string, ctx: { prop: string; itemScoped: boolean; panel?: string; list?: ListScope }, found: Found) {
  const name = refName(schema);
  if (name === "Id" && typeof value === "string") return void found.ids.push({ id: value, at, prop: ctx.prop, panel: ctx.panel });
  if (name === "Path" && typeof value === "string") return void found.paths.push({ path: value, at, itemScoped: ctx.itemScoped, list: ctx.itemScoped ? ctx.list : undefined });
  if (name === "Capability" && typeof value === "string") return void found.actions.push({ name: value, at });
  if (ctx.prop === "group" && value && !Array.isArray(value) && typeof value === "object" && "path" in (value as object)) {
    const g = value as Record<string, string>;
    found.paths.push({ path: g.path, at: `${at}/path`, itemScoped: ctx.itemScoped });
    for (const k of ["namePath", "imagePath"]) if (g[k]) found.paths.push({ path: g[k], at: `${at}/${k}`, itemScoped: true, list: { path: g.path } });
    return;
  }
  if (name === "Options" && value && !Array.isArray(value) && typeof value === "object") {
    const opts = value as Record<string, string>;
    found.paths.push({ path: opts.path, at: `${at}/path`, itemScoped: ctx.itemScoped });
    for (const k of ["valuePath", "labelPath", "descriptionPath", "avatarPath", "imagePath", "recentPath"]) if (opts[k]) found.paths.push({ path: opts[k], at: `${at}/${k}`, itemScoped: true, list: { path: opts.path } });
    return;
  }
  const s = deref(schema);
  if (!s) return;
  if (s.oneOf) {
    const branch = s.oneOf.find((b: S) => {
      const d = deref(b);
      if (Array.isArray(value)) return d.type === "array";
      if (value && typeof value === "object") return d.type === "object";
      return d.type !== "object" && d.type !== "array";
    });
    if (branch) walk(branch, value, at, ctx, found);
    return;
  }
  if (Array.isArray(value) && s.items) value.forEach((v, i) => walk(s.items, v, `${at}/${i}`, ctx, found));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const child = s.properties?.[k] ?? (typeof s.additionalProperties === "object" ? s.additionalProperties : undefined);
      if (child) walk(child, v, `${at}/${k}`, ctx, found);
    }
  }
}

export function resolvePointer(data: Json, path: string): Json | undefined {
  if (!path.startsWith("/")) return undefined;
  let cur: any = data;
  for (const part of path.slice(1).split("/").map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    if (cur === null || typeof cur !== "object" || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function itemsOf(data: Json, list: ListScope): Json[] {
  const within = list.path.startsWith("/") ? [data] : list.parent ? itemsOf(data, list.parent) : [];
  const pointer = list.path.startsWith("/") ? list.path : `/${list.path}`;
  return within.flatMap((w) => {
    const v = resolvePointer(w, pointer);
    return Array.isArray(v) ? v : [];
  });
}

function pointersEndingIn(data: Json, field: string, at = "", depth = 0): string[] {
  if (depth > 4 || !data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data).flatMap(([k, v]) => [...(k === field ? [`${at}/${k}`] : []), ...pointersEndingIn(v as Json, field, `${at}/${k}`, depth + 1)]);
}

export function checkDocument(doc: Json, opts: CheckOptions = {}): CheckResult {
  const issues: Issue[] = [];
  const error = (at: string, message: string) => issues.push({ severity: "error", at, message });
  const warn = (at: string, message: string) => issues.push({ severity: "warning", at, message });

  checkSchema(doc, uiSchema, "", (at, m) => error(at || "/", m));
  if (issues.length) return { valid: false, issues };

  const d = doc as Doc;
  const byId = new Map<string, { c: Node; index: number }>();
  d.components.forEach((c, index) => {
    if (byId.has(c.id)) error(`/components/${index}/id`, `duplicate id "${c.id}"`);
    else byId.set(c.id, { c, index });
  });
  if (!byId.has(d.root)) error("/root", `root "${d.root}" is not a component id`);

  const refs = new Map<string, Found>();
  for (const [id, { c, index }] of byId) {
    const found: Found = { ids: [], paths: [], actions: [] };
    const compSchema = componentDef(c.component)!;
    for (const [prop, value] of Object.entries(c)) {
      if (prop === "id" || prop === "component") continue;
      const itemScoped = ITEM_SCOPED[c.component]?.includes(prop) ?? false;
      const listPath = c[LIST_BINDINGS[c.component]]?.path;
      const list = itemScoped && typeof listPath === "string" ? { path: listPath } : undefined;
      if (PANEL_PROPS[c.component]?.includes(prop) && Array.isArray(value)) {
        value.forEach((panel, i) => walk(compSchema.properties[prop].items, panel, `/components/${index}/${prop}/${i}`, { prop, itemScoped, panel: `${id}#${i}`, list }, found));
      } else {
        walk(compSchema.properties[prop], value, `/components/${index}/${prop}`, { prop, itemScoped, list }, found);
      }
    }
    refs.set(id, found);
  }
  // The surface's header actions are a reference too.
  const surfaceActions = typeof d.surface.actions === "string" ? d.surface.actions : undefined;
  if (surfaceActions !== undefined) {
    const target = byId.get(surfaceActions);
    if (!target) error("/surface/actions", `references unknown component "${surfaceActions}"`);
    else if (target.c.component !== "ActionBar") error("/surface/actions", `surface.actions must reference ActionBar, not ${target.c.component}`);
  }

  for (const [id, found] of refs) {
    const owner = byId.get(id)!.c;
    for (const r of found.ids) {
      const target = byId.get(r.id);
      if (!target) {
        error(r.at, `references unknown component "${r.id}"`);
        continue;
      }
      if (r.id === id) error(r.at, "component references itself");
      const allowed = REFERENCE_TYPES[`${owner.component}.${r.prop}`];
      if (allowed && !allowed.includes(target.c.component)) error(r.at, `${owner.component}.${r.prop} must reference ${allowed.join(" or ")}, not ${target.c.component}`);
    }
    for (const a of found.actions) {
      if (a.name.startsWith("ui.") && !RENDERER_ACTIONS.has(a.name)) error(a.at, `"${a.name}" is not a renderer action (${[...RENDERER_ACTIONS].join(", ")})`);
    }
  }

  for (const [, { c, index }] of byId) {
    if (c.component === "TextInput" && c.placeholder !== undefined && c.kind !== "search") warn(`/components/${index}/placeholder`, "placeholders are only for search fields; use the label and help text");
    if (c.component === "Media" && !c.decorative && c.alt === undefined) error(`/components/${index}`, "Media needs alt text unless it is decorative");
  }

  // Tree walk from root: cycles, single parent, reachability, item scope, primary-action contexts.
  const parent = new Map<string, string>();
  const reached = new Set<string>();
  const itemScopedIds = new Set<string>();
  const templateList = new Map<string, ListScope>();
  const primaries: { at: string; stack: string[] }[] = [];
  const visit = (id: string, stack: string[], inTemplate: boolean, trail: string[], list?: ListScope) => {
    const entry = byId.get(id);
    if (!entry) return;
    if (trail.includes(id)) return error(`/components/${entry.index}`, `cycle: ${[...trail, id].join(" → ")}`);
    reached.add(id);
    if (inTemplate) itemScopedIds.add(id);
    if (list) templateList.set(id, list);
    const { c, index } = entry;
    let ctx = stack;
    if (c.component === "Confirm") ctx = [...stack, `${id}#dialog`];
    if (c.component === "Action" && c.emphasis === "primary") primaries.push({ at: `/components/${index}`, stack: ctx });
    if (c.component === "Form") primaries.push({ at: `/components/${index}/submit`, stack: ctx });
    if (c.component === "Steps") primaries.push({ at: `/components/${index}/finish`, stack: [...ctx, `${id}#${c.steps.length - 1}`] });
    for (const r of refs.get(id)!.ids) {
      if (!byId.has(r.id) || r.id === id) continue;
      const isTemplate = (r.prop === "items" && c.component === "Collection") || ((r.prop === "rowActions" || r.prop === "detail") && c.component === "Table");
      const prev = parent.get(r.id);
      if (prev && prev !== id) {
        error(r.at, `"${r.id}" already has parent "${prev}"; a component can appear in only one place`);
        continue;
      }
      parent.set(r.id, id);
      const repeats = isTemplate ? c[c.component === "Table" ? "rows" : "items"]?.path : undefined;
      const childList = typeof repeats === "string" ? { path: repeats, parent: repeats.startsWith("/") ? undefined : list } : list;
      visit(r.id, r.panel ? [...ctx, r.panel] : ctx, inTemplate || isTemplate, [...trail, id], childList);
    }
  };
  if (byId.has(d.root)) visit(d.root, [], false, []);
  if (surfaceActions && byId.has(surfaceActions)) visit(surfaceActions, [], false, []);
  for (const [id, { c }] of byId) if (c.component === "Navigation" && !reached.has(id)) visit(id, [], false, []);
  for (const [id, { index }] of byId) if (!reached.has(id)) warn(`/components/${index}`, `"${id}" is not reachable from root "${d.root}"`);

  // The shell, as the spec's validate.ts checks it. Frame, AppBar, Footer, Outlet and Custom are
  // the product's frame around its screens: they live only in a shell document (surface.kind
  // "shell"), and a shell is always authored. A shell is one Frame at the root with exactly one
  // Outlet under its main; a surface has none.
  const shell = (severity: "error" | "warning", at: string, message: string) => issues.push({ severity, at, message, code: "shell:structure" });
  const isShellDoc = d.surface.kind === "shell";
  const shellParts = [...byId].filter(([, { c }]) => SHELL_COMPONENTS.includes(c.component));
  if (!isShellDoc) {
    for (const [, { c, index }] of shellParts) shell("error", `/components/${index}`, belongsInShell(c.component));
  } else {
    if (d.surface.origin !== "authored") shell("error", "/surface/origin", 'a shell is authored; set surface.origin to "authored"');
    const rootComponent = byId.get(d.root)?.c.component;
    if (rootComponent && rootComponent !== "Frame") shell("error", "/root", `a shell's root is a Frame, not ${rootComponent}`);
    const outlets = [...byId].filter(([, { c }]) => c.component === "Outlet");
    if (outlets.length === 0) shell("error", "/components", "a shell has exactly one Outlet, reachable from the Frame's main; this one has none");
    for (const [, { index }] of outlets.slice(1)) shell("error", `/components/${index}`, "a shell has exactly one Outlet; this is another");
    // The Outlet is where screens render: it sits under the Frame's main, not in a bar or an aside.
    const underMain = new Set<string>();
    const main = rootComponent === "Frame" ? byId.get(d.root)!.c.main : undefined;
    const walkMain = (id: string) => {
      if (typeof id !== "string" || underMain.has(id) || !byId.has(id)) return;
      underMain.add(id);
      for (const r of refs.get(id)!.ids) walkMain(r.id);
    };
    if (typeof main === "string") walkMain(main);
    for (const [id, { index }] of outlets.slice(0, 1)) {
      if (typeof main === "string" && !underMain.has(id)) shell("error", `/components/${index}`, `the Outlet "${id}" is not reachable from the Frame's main "${main}"`);
    }
  }
  // Navigation.placement is where a Frame puts its main navigation; outside a Frame nothing reads it.
  for (const [id, { c, index }] of byId) {
    if (c.component !== "Navigation" || c.placement === undefined) continue;
    const owner = parent.get(id);
    if (!owner || byId.get(owner)?.c.component !== "Frame") shell("warning", `/components/${index}/placement`, "Navigation.placement only applies to a Frame's navigation; here nothing reads it");
  }

  const budget = Math.max(1, opts.emphasisBudget ?? 1);
  const isPrefix = (a: string[], b: string[]) => a.every((x, i) => b[i] === x);
  const together = (a: { stack: string[] }, b: { stack: string[] }) => isPrefix(a.stack, b.stack) || isPrefix(b.stack, a.stack);
  for (let i = 0; i < primaries.length; i++) {
    const group = primaries.filter((p, j) => j >= i && together(primaries[i], p));
    if (group.length > budget) {
      const last = group[budget];
      error(last.at, budget === 1 ? `more than one primary action visible at once (also ${group[0].at})` : `more than ${budget} primary actions visible at once`);
      break;
    }
  }

  if (d.data !== undefined) {
    for (const [, { c, index }] of byId) {
      const prop = LIST_BINDINGS[c.component];
      const path = prop && c[prop] && typeof c[prop] === "object" ? c[prop].path : undefined;
      if (typeof path !== "string" || !path.startsWith("/")) continue;
      const value = resolvePointer(d.data, path);
      if (value !== undefined && !Array.isArray(value)) error(`/components/${index}/${prop}/path`, `${c.component}.${prop} must point at a list; "${path}" is ${value === null ? "null" : typeof value} in data`);
    }
  }

  const missing = (at: string, message: string) => issues.push({ severity: opts.missingData ?? "warning", at, message, code: "data:missing-path" });
  const written: string[] = [];
  for (const [, { c }] of byId) if (INPUTS.has(c.component) && typeof c.value?.path === "string" && c.value.path.startsWith("/")) written.push(c.value.path);
  const isWritten = (path: string) => written.some((w) => w === path || w.startsWith(`${path}/`) || path.startsWith(`${w}/`));
  for (const [id, found] of refs) {
    const scoped = itemScopedIds.has(id);
    for (const p of found.paths) {
      if (!p.path.startsWith("/")) {
        if (!p.itemScoped && !scoped) {
          error(p.at, `relative path "${p.path}" used outside a repeated item`);
          continue;
        }
        const list = p.list ?? templateList.get(id);
        if (d.data === undefined || !list) continue;
        const items = itemsOf(d.data, list);
        if (items.length && items.every((item) => resolvePointer(item, `/${p.path}`) === undefined)) {
          const fields = Object.keys(items.find((i) => i && typeof i === "object") ?? {});
          missing(p.at, `"${p.path}" is not a field of the items in ${list.path}${fields.length ? ` (they have ${fields.join(", ")})` : ""}`);
        }
      } else if (d.data !== undefined && resolvePointer(d.data, p.path) === undefined && !isWritten(p.path)) {
        const list = scoped ? templateList.get(id) : undefined;
        const field = p.path.slice(p.path.lastIndexOf("/") + 1);
        const inItem = list && itemsOf(d.data, list).some((item) => resolvePointer(item, `/${field}`) !== undefined);
        const elsewhere = inItem ? undefined : pointersEndingIn(d.data, field)[0];
        missing(p.at, `path "${p.path}" does not exist in data` + (inItem ? `: inside a repeated item, the item's own field is "${field}", without the slash` : elsewhere ? ` (did you mean "${elsewhere}"?)` : ""));
      }
    }
  }

  // The workspace's rules, as the verifier runs them. A rule speaks about the screen, not a pointer.
  for (const rule of opts.rules ?? []) {
    let r;
    try {
      r = runCheck(rule.check, d);
    } catch {
      continue; // a malformed rule is the Rules page's problem, not this screen's
    }
    if (!r.pass) issues.push({ severity: rule.severity, at: "/", message: `${rule.name}: ${r.message}`, code: "rule" });
  }

  // Issues in the order a person reads the screen, so the list tracks the preview top to bottom.
  const order = new Map(readingOrder(d).map((c, i) => [`/components/${byId.get(c.id)!.index}`, i]));
  const rank = (i: Issue) => {
    const m = /^\/components\/\d+/.exec(i.at);
    return m ? (order.get(m[0]) ?? 9e6) : i.at === "/" ? 9e7 : -1;
  };
  issues.sort((a, b) => rank(a) - rank(b));
  return { valid: !issues.some((i) => i.severity === "error"), issues };
}

/** The index in `components` an issue points at, if it points at a component. */
export const issueIndex = (at: string): number | null => {
  const m = /^\/components\/(\d+)/.exec(at);
  return m ? Number(m[1]) : null;
};
