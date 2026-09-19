import { validateDocument } from "@polyxd/spec";
import { checkPattern, evaluateRules, type Rule } from "@polyxd/spec/patterns";
import { checkCapabilities, type CapabilityRegistry } from "@polyxd/spec/capabilities";
import { readingOrder } from "@polyxd/spec/checks";
import type { Finding } from "./rendered.ts";

export interface StaticOptions {
  registry?: CapabilityRegistry;
  /** Design Direction or acceptance rules to hold the document to */
  rules?: Rule[];
}

const INPUTS = new Set(["TextInput", "Choice", "Toggle", "DateInput", "RangeInput"]);
const GENERIC = /^(ok|okay|yes|no|submit|go|click here|here|more|continue|next|done)$/i;
const TEXT_PROPS = ["title", "label", "summary", "caption", "text", "message", "consequence"];

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
