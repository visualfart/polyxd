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
  Chart: ["x", "series"],
  Comparison: ["itemTitle", "attributes", "choose"],
};

/** Props that open a separately visible context (only one panel/step/dialog shows at a time). */
const PANEL_PROPS: Record<string, string[]> = { Views: ["views"], Steps: ["steps"] };

const RENDERER_ACTIONS = new Set(["ui.dismiss", "ui.back", "ui.next"]);

interface Found {
  ids: { id: string; at: string; prop: string; panel?: string }[];
  paths: { path: string; at: string; itemScoped: boolean }[];
  actions: { name: string; at: string }[];
}

const deref = (s: Schema): Schema => {
  let cur = s;
  while (cur?.$ref) cur = uiSchema.$defs[cur.$ref.replace("#/$defs/", "")];
  return cur;
};
const refName = (s: Schema): string | undefined => s?.$ref?.replace("#/$defs/", "");

/** Walks an instance alongside its schema, collecting component references, data paths and action names. */
function walk(schema: Schema, value: Json, at: string, ctx: { prop: string; itemScoped: boolean; panel?: string }, found: Found) {
  const name = refName(schema);
  if (name === "Id" && typeof value === "string") return void found.ids.push({ id: value, at, prop: ctx.prop, panel: ctx.panel });
  if (name === "Path" && typeof value === "string") return void found.paths.push({ path: value, at, itemScoped: ctx.itemScoped });
  if (name === "Capability" && typeof value === "string") return void found.actions.push({ name: value, at });
  if (name === "Options" && value && !Array.isArray(value) && typeof value === "object") {
    const opts = value as Record<string, string>;
    found.paths.push({ path: opts.path, at: `${at}/path`, itemScoped: ctx.itemScoped });
    for (const k of ["valuePath", "labelPath", "descriptionPath", "avatarPath", "imagePath", "recentPath"]) {
      if (opts[k]) found.paths.push({ path: opts[k], at: `${at}/${k}`, itemScoped: true });
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
      const panelled = PANEL_PROPS[c.component]?.includes(prop);
      if (panelled && Array.isArray(value)) {
        value.forEach((panel, i) =>
          walk(compSchema.properties[prop].items, panel, `/components/${index}/${prop}/${i}`, { prop, itemScoped, panel: `${id}#${i}` }, found),
        );
      } else {
        walk(compSchema.properties[prop], value, `/components/${index}/${prop}`, { prop, itemScoped }, found);
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
  const primaries: { at: string; stack: string[] }[] = [];

  const visit = (id: string, stack: string[], inTemplate: boolean, trail: string[]) => {
    const entry = byId.get(id);
    if (!entry) return;
    if (trail.includes(id)) return error(`/components/${entry.index}`, `cycle: ${[...trail, id].join(" → ")}`);
    reached.add(id);
    if (inTemplate) itemScopedIds.add(id);
    const { c, index } = entry;

    let ctx = stack;
    if (c.component === "Confirm") ctx = [...stack, `${id}#dialog`];
    if (c.component === "Action" && c.emphasis === "primary") primaries.push({ at: `/components/${index}`, stack: ctx });
    if (c.component === "Form") primaries.push({ at: `/components/${index}/submit`, stack: ctx });
    if (c.component === "Steps") primaries.push({ at: `/components/${index}/finish`, stack: [...ctx, `${id}#${c.steps.length - 1}`] });

    for (const r of refs.get(id)!.ids) {
      if (!byId.has(r.id) || r.id === id) continue;
      // A Collection's item template and a Table's row-action menu both render once per row.
      const isTemplate = (r.prop === "items" && c.component === "Collection") || (r.prop === "rowActions" && c.component === "Table");
      const prev = parent.get(r.id);
      if (prev && prev !== id) {
        error(r.at, `"${r.id}" already has parent "${prev}"; a component can appear in only one place`);
        continue;
      }
      parent.set(r.id, id);
      visit(r.id, r.panel ? [...ctx, r.panel] : ctx, inTemplate || isTemplate, [...trail, id]);
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

  // Relative paths only where an item is in scope; absolute paths should resolve when data is given.
  for (const [id, found] of refs) {
    const scoped = itemScopedIds.has(id);
    for (const p of found.paths) {
      if (!p.path.startsWith("/")) {
        if (!p.itemScoped && !scoped) error(p.at, `relative path "${p.path}" used outside a repeated item`);
      } else if (d.data !== undefined && resolvePointer(d.data, p.path) === undefined) {
        warn(p.at, `path "${p.path}" does not exist in data`);
      }
    }
  }

  return { valid: !issues.some((i) => i.severity === "error"), issues };
}
