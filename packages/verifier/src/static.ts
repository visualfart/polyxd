import { validateDocument } from "@polyxd/spec";
import { checkPattern, evaluateRules, type Rule } from "@polyxd/spec/patterns";
import { checkCapabilities, type CapabilityRegistry } from "@polyxd/spec/capabilities";
import { readingOrder, runCheck } from "@polyxd/spec/checks";
import type { Finding } from "./rendered.ts";

export interface StaticOptions {
  registry?: CapabilityRegistry;
  /** Design Direction or acceptance rules to hold the document to */
  rules?: Rule[];
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
 * Document-level checks that need no rendering: the spec validator, the declared pattern,
 * capabilities, direction/acceptance rules, plus agent-readiness heuristics.
 */
export function staticAudit(doc: any, opts: StaticOptions = {}): Finding[] {
  const out: Finding[] = [];
  const v = validateDocument(doc);
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
