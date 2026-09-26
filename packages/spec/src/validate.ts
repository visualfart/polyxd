import { readFileSync } from "node:fs";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { REFERENCE_TYPES } from "./references.ts";

type Json = unknown;
type Schema = Record<string, any>;

export interface Issue {
  severity: "error" | "warning";
  /** JSON Pointer into the document */
  at: string;
  message: string;
  /** Set on issues a caller may want to weigh on their own; see ValidateOptions.missingData */
  code?: "data:missing-path";
}

export interface ValidationResult {
  valid: boolean;
  issues: Issue[];
}

export const uiSchema: Schema = JSON.parse(readFileSync(new URL("../schema/ui.schema.json", import.meta.url), "utf8"));

const ajv = new Ajv2020({ allErrors: true, discriminator: true, strict: false });
const validateSchema = ajv.compile(uiSchema);

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

/** Props that open a separately visible context (only one panel/step/dialog shows at a time). */
const PANEL_PROPS: Record<string, string[]> = { Views: ["views"], Steps: ["steps"] };

const RENDERER_ACTIONS = new Set(["ui.dismiss", "ui.back", "ui.next", "ui.copy"]);

/** The prop each repeating component iterates over. Its item-scoped props read from each entry. */
const LIST_BINDINGS: Record<string, string> = { Collection: "items", Table: "rows", Comparison: "items", Chart: "data", Choice: "options", Tree: "items", Text: "items", Media: "items" };

/** Components whose `value` binding is state they write, so it needn't exist in data beforehand. */
const INPUTS = new Set(["TextInput", "Choice", "Toggle", "DateInput", "RangeInput", "Rating", "FileInput", "ColorInput", "CodeInput"]);

/**
 * A list relative paths resolve against. `path` is absolute, or relative to each entry of `parent`
 * when a repeated item holds a list of its own.
 */
interface ListScope {
  path: string;
  parent?: ListScope;
}

interface Found {
  ids: { id: string; at: string; prop: string; panel?: string }[];
  paths: { path: string; at: string; itemScoped: boolean; list?: ListScope }[];
  actions: { name: string; at: string }[];
}

const deref = (s: Schema): Schema => {
  let cur = s;
  while (cur?.$ref) cur = uiSchema.$defs[cur.$ref.replace("#/$defs/", "")];
  return cur;
};
const refName = (s: Schema): string | undefined => s?.$ref?.replace("#/$defs/", "");

/** Walks an instance alongside its schema, collecting component references, data paths and action names. */
function walk(schema: Schema, value: Json, at: string, ctx: { prop: string; itemScoped: boolean; panel?: string; list?: ListScope }, found: Found) {
  const name = refName(schema);
  if (name === "Id" && typeof value === "string") return void found.ids.push({ id: value, at, prop: ctx.prop, panel: ctx.panel });
  if (name === "Path" && typeof value === "string") return void found.paths.push({ path: value, at, itemScoped: ctx.itemScoped, list: ctx.itemScoped ? ctx.list : undefined });
  if (name === "Capability" && typeof value === "string") return void found.actions.push({ name: value, at });
  // An Identity group: one list, with paths relative to each entry, like Options.
  if (ctx.prop === "group" && value && !Array.isArray(value) && typeof value === "object" && "path" in (value as object)) {
    const g = value as Record<string, string>;
    found.paths.push({ path: g.path, at: `${at}/path`, itemScoped: ctx.itemScoped });
    for (const k of ["namePath", "imagePath"]) {
      if (g[k]) found.paths.push({ path: g[k], at: `${at}/${k}`, itemScoped: true, list: { path: g.path } });
    }
    return;
  }
  if (name === "Options" && value && !Array.isArray(value) && typeof value === "object") {
    const opts = value as Record<string, string>;
    found.paths.push({ path: opts.path, at: `${at}/path`, itemScoped: ctx.itemScoped });
    for (const k of ["valuePath", "labelPath", "descriptionPath", "avatarPath", "imagePath", "recentPath"]) {
      if (opts[k]) found.paths.push({ path: opts[k], at: `${at}/${k}`, itemScoped: true, list: { path: opts.path } });
    }
    return;
  }
  const s = deref(schema);
  if (!s) return;
  if (s.oneOf) {
    const branch = s.oneOf.find((b: Schema) => {
      const d = deref(b);
      if (Array.isArray(value)) return d.type === "array";
      if (value && typeof value === "object") return d.type === "object";
      return d.type !== "object" && d.type !== "array";
    });
    if (branch) walk(branch, value, at, ctx, found);
    return;
  }
  if (Array.isArray(value) && s.items) {
    value.forEach((v, i) => walk(s.items, v, `${at}/${i}`, ctx, found));
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      const child = s.properties?.[k] ?? (typeof s.additionalProperties === "object" ? s.additionalProperties : undefined);
      if (child) walk(child, v, `${at}/${k}`, ctx, found);
    }
  }
}

function resolvePointer(data: Json, path: string): Json | undefined {
  if (!path.startsWith("/")) return undefined;
  let cur: any = data;
  for (const part of path.slice(1).split("/").map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))) {
    if (cur === null || typeof cur !== "object" || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** The entries a list scope repeats over: the array at its path, or at that field of each parent entry. */
function itemsOf(data: Json, list: ListScope): Json[] {
  const within = list.path.startsWith("/") ? [data] : list.parent ? itemsOf(data, list.parent) : [];
  const pointer = list.path.startsWith("/") ? list.path : `/${list.path}`;
  return within.flatMap((w) => {
    const v = resolvePointer(w, pointer);
    return Array.isArray(v) ? v : [];
  });
}

/** Pointers in `data`, outside arrays, whose last segment is `field`: where a misplaced path probably meant. */
function pointersEndingIn(data: Json, field: string, at = "", depth = 0): string[] {
  if (depth > 4 || !data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data).flatMap(([k, v]) => [...(k === field ? [`${at}/${k}`] : []), ...pointersEndingIn(v as Json, field, `${at}/${k}`, depth + 1)]);
}

const schemaMessage = (e: ErrorObject) => {
  if (e.keyword === "additionalProperties") return `unknown property "${e.params.additionalProperty}"`;
  if (e.keyword === "const" && e.instancePath.endsWith("/component")) return `unknown component "${e.data}"`;
  if (e.keyword === "discriminator") return `unknown or missing component type`;
  return e.message ?? e.keyword;
};

/** Validates a UI document: JSON Schema first, then structural and design rules the schema can't express. */
export interface ValidateOptions {
  /** Primary actions allowed in one view (Design Direction's profile.emphasisBudget). Default 1. */
  emphasisBudget?: number;
  /**
   * How to report a binding that reads nothing from the document's data: an absolute path that
   * isn't there, or an item's field that no item has. Default "warning", since data given with a
   * document may be a sample. The verifier uses "error": against the data a screen will be shown
   * with, such a binding renders as a blank.
   */
  missingData?: "warning" | "error";
}

export function validateDocument(doc: Json, opts: ValidateOptions = {}): ValidationResult {
  const issues: Issue[] = [];
  const error = (at: string, message: string) => issues.push({ severity: "error", at, message });
  const warn = (at: string, message: string) => issues.push({ severity: "warning", at, message });

  if (!validateSchema(doc)) {
    // oneOf/discriminator produce cascades; keep the most specific errors.
    const errs = validateSchema.errors ?? [];
    const deepest = errs.filter((e) => !errs.some((o) => o !== e && o.instancePath.startsWith(e.instancePath + "/")));
    const seen = new Set<string>();
    for (const e of deepest) {
      const msg = `${e.instancePath || "/"}: ${schemaMessage(e)}`;
      if (!seen.has(msg)) (seen.add(msg), error(e.instancePath || "/", schemaMessage(e)));
    }
    return { valid: false, issues };
  }

  const d = doc as { root: string; components: Array<Record<string, any>>; data?: Json; surface?: Record<string, any> };
  const byId = new Map<string, { c: Record<string, any>; index: number }>();
  d.components.forEach((c, index) => {
    if (byId.has(c.id)) error(`/components/${index}/id`, `duplicate id "${c.id}"`);
    else byId.set(c.id, { c, index });
  });
  if (!byId.has(d.root)) error("/root", `root "${d.root}" is not a component id`);

  // Collect references per component.
  const refs = new Map<string, Found>();
  for (const [id, { c, index }] of byId) {
    const found: Found = { ids: [], paths: [], actions: [] };
    const compSchema = uiSchema.$defs[`Component${c.component}`];
    for (const [prop, value] of Object.entries(c)) {
      if (prop === "id" || prop === "component") continue;
      const itemScoped = ITEM_SCOPED[c.component]?.includes(prop) ?? false;
      const listPath = c[LIST_BINDINGS[c.component]]?.path;
      const list = itemScoped && typeof listPath === "string" ? { path: listPath } : undefined;
      const panelled = PANEL_PROPS[c.component]?.includes(prop);
      if (panelled && Array.isArray(value)) {
        value.forEach((panel, i) =>
          walk(compSchema.properties[prop].items, panel, `/components/${index}/${prop}/${i}`, { prop, itemScoped, panel: `${id}#${i}`, list }, found),
        );
      } else {
        walk(compSchema.properties[prop], value, `/components/${index}/${prop}`, { prop, itemScoped, list }, found);
      }
    }
    // A Template's componentId is a reference too; its subtree is item-scoped.
    refs.set(id, found);
  }

  // Reference integrity and allowed types.
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
      if (allowed && !allowed.includes(target.c.component)) {
        error(r.at, `${owner.component}.${r.prop} must reference ${allowed.join(" or ")}, not ${target.c.component}`);
      }
    }
    for (const a of found.actions) {
      if (a.name.startsWith("ui.") && !RENDERER_ACTIONS.has(a.name)) error(a.at, `"${a.name}" is not a renderer action (${[...RENDERER_ACTIONS].join(", ")})`);
    }
  }

  // Rules the schema states in prose.
  for (const [, { c, index }] of byId) {
    if (c.component === "TextInput" && c.placeholder !== undefined && c.kind !== "search") warn(`/components/${index}/placeholder`, "placeholders are only for search fields; use the label and help text");
    if (c.component === "Media" && !c.decorative && c.alt === undefined) error(`/components/${index}`, "Media needs alt text unless it is decorative");
  }

  // Tree walk from root: cycles, single parent, reachability, item scope, primary-action contexts.
  const parent = new Map<string, string>();
  const reached = new Set<string>();
  const itemScopedIds = new Set<string>();
  /** For each component inside a repeated item, the list it repeats over. */
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
      // A Collection's item template and a Table's row-action menu and row detail all render once per row.
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
  // The surface's own header actions and the product's navigation sit outside the root component.
  if (typeof d.surface?.actions === "string" && byId.has(d.surface.actions)) visit(d.surface.actions, [], false, []);
  for (const [id, { c }] of byId) if (c.component === "Navigation" && !reached.has(id)) visit(id, [], false, []);

  for (const [id, { index }] of byId) {
    if (!reached.has(id)) warn(`/components/${index}`, `"${id}" is not reachable from root "${d.root}"`);
  }

  // How many primary actions may share a view: one by default, more only if the Design Direction
  // says so (profile.emphasisBudget). Two primaries share a view when one context contains the other.
  const budget = Math.max(1, opts.emphasisBudget ?? 1);
  const isPrefix = (a: string[], b: string[]) => a.every((x, i) => b[i] === x);
  const together = (a: { stack: string[] }, b: { stack: string[] }) => isPrefix(a.stack, b.stack) || isPrefix(b.stack, a.stack);
  for (let i = 0; i < primaries.length; i++) {
    const group = primaries.filter((p, j) => j >= i && together(primaries[i], p));
    if (group.length > budget) {
      const last = group[budget];
      error(last.at, budget === 1 ? `more than one primary action visible at once (also ${group[0].at})` : `more than ${budget} primary actions visible at once (also ${group.slice(0, budget).map((p) => p.at).join(", ")})`);
      break;
    }
  }

  // A binding that a component repeats over has to point at a list. A model that points one at an
  // object gives the renderer something it can't iterate: schema-valid, and impossible to display.
  if (d.data !== undefined) {
    for (const [, { c, index }] of byId) {
      const prop = LIST_BINDINGS[c.component];
      const path = prop && c[prop] && typeof c[prop] === "object" ? c[prop].path : undefined;
      if (typeof path !== "string" || !path.startsWith("/")) continue;
      const value = resolvePointer(d.data, path);
      if (value !== undefined && !Array.isArray(value)) {
        error(`/components/${index}/${prop}/path`, `${c.component}.${prop} must point at a list; "${path}" is ${value === null ? "null" : typeof value} in data`);
      }
    }
  }

  // Relative paths only where an item is in scope. With data given, every binding should read
  // something: an absolute path that isn't there, or an item field no item has, renders a blank.
  const missing = (at: string, message: string) => issues.push({ severity: opts.missingData ?? "warning", at, message, code: "data:missing-path" });
  // What an input writes needn't exist yet; neither does anything that reads it back.
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
        const elsewhere = inItem ? undefined : pointersEndingIn(d.data, field).slice(0, 1)[0];
        missing(
          p.at,
          `path "${p.path}" does not exist in data` +
            (inItem ? `: inside a repeated item, the item's own field is "${field}", without the slash` : elsewhere ? ` (did you mean "${elsewhere}"?)` : ""),
        );
      }
    }
  }

  return { valid: !issues.some((i) => i.severity === "error"), issues };
}
