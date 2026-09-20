import { validateDocument } from "@polyxd/spec";
import { checkPattern, evaluateRules, type Rule } from "@polyxd/spec/patterns";
import { checkCapabilities, type CapabilityRegistry } from "@polyxd/spec/capabilities";
import { readingOrder, runCheck } from "@polyxd/spec/checks";
import type { Finding } from "./rendered.ts";

export interface StaticOptions {
  registry?: CapabilityRegistry;
  /** Design Direction or acceptance rules to hold the document to */
  rules?: Rule[];
  /** Primary actions allowed in one view (Design Direction's profile.emphasisBudget) */
  emphasisBudget?: number;
}

const INPUTS = new Set(["TextInput", "Choice", "Toggle", "DateInput", "RangeInput"]);
const GENERIC = /^(ok|okay|yes|no|submit|go|click here|here|more|continue|next|done)$/i;
const TEXT_PROPS = ["title", "label", "summary", "caption", "text", "message", "consequence"];

/** Reads a JSON Pointer out of the document's data snapshot, when there is one. */
function valueAt(data: unknown, pointer?: string): unknown {
  if (!pointer || data === undefined) return undefined;
  let cur: any = data;
  for (const part of pointer.replace(/^\//, "").split("/")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[part.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return cur;
}

/**
 * The first item a component renders, when it is a collection's template rather than a component
 * in its own right: a Card inside a Collection reads its bindings from each item, so a path like
 * `progress` means the item's progress, not the document's.
 */
function itemScope(doc: any, node: any): unknown {
  const owner = (doc.components ?? []).find((c: any) => c.items?.componentId === node.id);
  const items = owner ? valueAt(doc.data, owner.items.path) : undefined;
  return Array.isArray(items) ? items[0] : undefined;
}

/** An item-scoped path has no leading slash; make it a pointer either way. */
const pointerIn = (path?: string) => (path === undefined ? undefined : path.startsWith("/") ? path : `/${path}`);

/**
 * Document-level checks that need no rendering: the spec validator, the declared pattern,
 * capabilities, direction/acceptance rules, plus agent-readiness heuristics.
 */
export function staticAudit(doc: any, opts: StaticOptions = {}): Finding[] {
  const out: Finding[] = [];
  const v = validateDocument(doc, { emphasisBudget: opts.emphasisBudget });
  for (const i of v.issues) out.push({ severity: i.severity, check: "spec", message: `${i.at}: ${i.message}` });
  if (!v.valid) return out;

  for (const r of checkPattern(doc)) if (!r.pass) out.push({ severity: r.severity, check: `pattern:${r.id}`, message: `${r.description}: ${r.message}` });
  if (opts.registry) for (const i of checkCapabilities(doc, opts.registry)) out.push({ severity: i.severity, check: "capability", message: `${i.at}: ${i.message}` });
  if (opts.rules) for (const r of evaluateRules(opts.rules, doc)) if (!r.pass) out.push({ severity: r.severity, check: `rule:${r.id}`, message: `${r.description}: ${r.message}` });

  // Short views everywhere, not only in surfaces that declare the multi-step-form pattern.
  if (doc.surface?.pattern !== "multi-step-form") {
    const r = runCheck({ check: "maxInputsPerView", max: 6 }, doc);
    if (!r.pass) out.push({ severity: "error", check: "load:inputs-per-view", message: r.message });
  }

  const order = readingOrder(doc);
  // Visible text must say something.
  for (const c of order) {
    for (const p of TEXT_PROPS) {
      if (typeof c[p] === "string" && c[p].trim() === "") out.push({ severity: "error", check: "text:empty", message: `${c.id}.${p} is empty` });
    }
  }
  // Controls in one view need distinct names, or neither people nor agents can tell them apart.
  const names = new Map<string, string[]>();
  const named = (id: string, label: unknown) => typeof label === "string" && names.set(label.toLowerCase(), [...(names.get(label.toLowerCase()) ?? []), id]);
  for (const c of order) {
    if (INPUTS.has(c.component) || c.component === "Action") named(c.id, c.label);
    for (const p of ["submit", "cancel", "confirm", "finish"]) if (c[p]) named(`${c.id}.${p}`, c[p].label);
  }
  for (const [label, ids] of names) {
    if (ids.length > 1) out.push({ severity: "error", check: "agent:ambiguous-name", message: `"${label}" names ${ids.length} controls (${ids.join(", ")})` });
  }
  // Who or what the task is about comes before its details: who before how much, who before when.
  const detail = (c: any) => (c.component === "TextInput" && ["currency", "number"].includes(c.kind)) || c.component === "DateInput" || c.component === "RangeInput";
  // The entity is a picker of people or things from host data: faces, or a "who is this for" label.
  const WHO = /\b(who|whom|recipient|payee|person|people|contact|customer|account|guest|attendee|member|supplier|client)\b/i;
  const entity = (c: any) =>
    c.component === "Choice" && !Array.isArray(c.options) && (!!c.options?.avatarPath || !!c.options?.imagePath || (typeof c.label === "string" && WHO.test(c.label)));
  const firstDetail = order.findIndex(detail);
  const firstEntity = order.findIndex(entity);
  if (firstEntity > -1 && firstDetail > -1 && firstEntity > firstDetail) {
    out.push({
      severity: "warning",
      check: "flow:entity-first",
      message: `"${order[firstEntity].id}" names who this is for but comes after "${order[firstDetail].id}": ask who before how much`,
    });
  }

  // A typed confirmation is for irreversible, high-impact actions. Asking for it elsewhere
  // teaches people to type past it.
  for (const c of order) {
    if (c.component === "Confirm" && c.typeToConfirm !== undefined && c.severity !== "destructive") {
      out.push({ severity: "warning", check: "safety:typed-confirm", message: `${c.id} asks people to type "${c.typeToConfirm}" for an action that is not destructive` });
    }
  }

  // Exactly one option may be recommended, or the recommendation means nothing.
  for (const c of order) {
    if (c.component !== "Comparison" || c.recommended === undefined) continue;
    const items = valueAt(doc.data, c.items?.path);
    if (!Array.isArray(items)) continue;
    const wanted = typeof c.recommended === "string" ? c.recommended : valueAt(doc.data, c.recommended.path);
    const matches = items.filter((it: any) => String(valueAt(it, "/" + c.itemTitle) ?? "") === String(wanted ?? ""));
    if (matches.length !== 1) {
      out.push({ severity: matches.length ? "error" : "warning", check: "choice:one-recommendation", message: `${c.id} recommends "${wanted}", which matches ${matches.length} of ${items.length} options` });
    }
  }

  // A whole-card click has no label of its own: its accessible name is the card's title, which
  // says what the thing is, not what pressing it does. Opening something that way is fine (risk
  // "none"); inviting people to a meeting is not. A card opens a thing, a button does a thing.
  if (opts.registry) {
    for (const c of order) {
      if (c.component !== "Card" && c.component !== "Collection") continue;
      const event = c.action?.event?.name;
      const risk = event ? opts.registry.capabilities[event]?.risk : undefined;
      if (risk && risk !== "none") {
        out.push({
          severity: "error",
          check: "flow:unnamed-commit",
          message: `${c.id} runs ${event} (${risk}) when the whole card is clicked: a card opens a thing, a button does a thing`,
        });
      }
    }
  }

  // A progress bar is a fraction of something finished. Bound to an amount of money, or to a
  // field that isn't there, it draws a bar whose length means nothing.
  for (const c of order) {
    if (!c.progress) continue;
    const value = typeof c.progress.value === "number" ? c.progress.value : valueAt(itemScope(doc, c) ?? doc.data, pointerIn(c.progress.value?.path));
    if (typeof value !== "number" || Number.isNaN(value)) {
      out.push({ severity: "error", check: "data:progress-not-a-fraction", message: `${c.id}.progress reads ${c.progress.value?.path ?? "a value"}, which isn't a number` });
    } else if (value < 0 || value > 1) {
      out.push({ severity: "error", check: "data:progress-not-a-fraction", message: `${c.id}.progress is ${value}: progress runs from 0 to 1, so this bar's length means nothing` });
    }
  }

  // A description under a label has to add something. "Email → Receive email alerts" is the label
  // again with filler around it, and it costs a line of reading for nothing.
  const FILLER = /^(receive|get|send|show|enable|allow|turn|on|off|and|or|the|a|an|your|you|via|by|to|for|of|with|in|me|us|notification|notifications|alert|alerts|email|emails|message|messages|update|updates|setting|settings)$/i;
  const words = (s: string) => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  for (const c of order) {
    const label = typeof c.label === "string" ? c.label : typeof c.title === "string" ? c.title : undefined;
    const description = typeof c.description === "string" ? c.description : typeof c.subtitle === "string" ? c.subtitle : undefined;
    if (!label || !description) continue;
    const inLabel = new Set(words(label));
    const extra = words(description).filter((w) => !inLabel.has(w) && !FILLER.test(w));
    if (extra.length === 0) {
      out.push({ severity: "warning", check: "copy:empty-description", message: `${c.id}: "${description}" is "${label}" again — a description has to say something the label doesn't` });
    }
  }

  // A template the model has no engine for. "{{budget}}" reaches the screen verbatim.
  for (const c of order) {
    for (const [prop, value] of Object.entries(c)) {
      if (typeof value !== "string") continue;
      const found = value.match(/\{\{[^}]*\}\}|\$\{[^}]*\}/)?.[0];
      if (found) out.push({ severity: "error", check: "text:template-placeholder", message: `${c.id}.${prop}: "${found}" is a template placeholder, not text — bind the value instead` });
    }
  }

  // A binding that resolves to an object or an array where text belongs prints "[object Object]".
  const TEXT_BINDINGS: [string, (c: any) => { where: string; path?: string }[]][] = [
    ["items", (c) => (Array.isArray(c.items) ? c.items.flatMap((i: any, n: number) => [{ where: `items[${n}].value`, path: i.value?.path }]) : [])],
    ["value", (c) => [{ where: "value", path: c.value?.path }]],
    ["text", (c) => [{ where: "text", path: c.text?.path }]],
    ["title", (c) => [{ where: "title", path: c.title?.path }]],
    ["subtitle", (c) => [{ where: "subtitle", path: c.subtitle?.path }]],
  ];
  for (const c of order) {
    // An input's `value` is its state, not text: a multi-select holds a list, a range holds a pair.
    if (INPUTS.has(c.component)) continue;
    for (const [, read] of TEXT_BINDINGS) {
      for (const { where, path } of read(c)) {
        if (!path) continue;
        const value = valueAt(itemScope(doc, c) ?? doc.data, pointerIn(path));
        if (value !== null && typeof value === "object") {
          out.push({ severity: "error", check: "data:not-text", message: `${c.id}.${where} reads ${path}, which is ${Array.isArray(value) ? "a list" : "an object"}: it would print as [object Object]` });
        }
      }
    }
  }

  // An internal id is not a name. "pr_1" tells a person nothing about which project they are
  // deleting, and the record it came from usually carries the name right next to it.
  const ID = /^[a-z]{1,4}[-_]?\d+$/i;
  for (const c of order) {
    // Same reason: the value an input holds is a key, and a key is allowed to look like one.
    if (INPUTS.has(c.component)) continue;
    const scope = itemScope(doc, c) ?? doc.data;
    const shown: { where: string; path?: string }[] = [
      ...(Array.isArray(c.items) ? c.items.map((i: any, n: number) => ({ where: `items[${n}]`, path: i.value?.path })) : []),
      { where: "value", path: c.value?.path },
      { where: "title", path: c.title?.path },
    ];
    for (const { where, path } of shown) {
      if (!path) continue;
      const value = valueAt(scope, pointerIn(path));
      if (typeof value !== "string" || !ID.test(value)) continue;
      // Only a problem when the same record offers something readable instead.
      const record = valueAt(scope, pointerIn(path.replace(/\/[^/]+$/, ""))) as any;
      const better = record && typeof record === "object" ? ["name", "title", "label"].find((k) => typeof record[k] === "string") : undefined;
      if (better) out.push({ severity: "warning", check: "copy:raw-identifier", message: `${c.id}.${where} shows "${value}", an internal id, where ${path.replace(/\/[^/]+$/, "")}/${better} is a name` });
    }
  }

  // Action labels should say what happens.
  for (const c of order) {
    const labels: [string, unknown][] = [[c.id, c.component === "Action" ? c.label : undefined], ...["submit", "confirm", "finish"].map((p): [string, unknown] => [`${c.id}.${p}`, c[p]?.label])];
    for (const [where, label] of labels) {
      if (typeof label !== "string") continue;
      if (GENERIC.test(label.trim()) && !(where.endsWith(".submit") && c.component === "Form" && doc.surface?.pattern === "multi-step-form" && /^continue$/i.test(label))) {
        out.push({ severity: "warning", check: "copy:generic-label", message: `${where}: "${label}" doesn't say what happens` });
      }
      if (label.length > 40) out.push({ severity: "warning", check: "copy:long-label", message: `${where}: ${label.length}-character button label` });
    }
  }
  return out;
}
