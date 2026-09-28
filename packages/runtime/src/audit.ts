import { staticAudit } from "@polyxd/verifier/static";
import { COMPONENTS } from "./catalog.generated.ts";
import type { AuditOptions, Direction, Finding, Report } from "./types.ts";

/**
 * The document checks the runtime runs by default: the verifier's `staticAudit`, from its
 * `@polyxd/verifier/static` entry, which needs no file system and no browser. That is the spec
 * validator (with the Direction's `emphasisBudget`, and bindings checked against the data), the
 * pattern the document declares, the capabilities on offer, the Design Direction's rules, and the
 * verifier's agent-readiness checks. A binding that reads nothing is a warning unless `missingData`
 * says otherwise; the runtime makes it an error when the ask carries data.
 */
export function checkDocument(doc: unknown, options: AuditOptions = {}): Finding[] {
  return staticAudit(doc, { ...options, missingData: options.missingData ?? "warning" });
}

const SHELL = new Set(COMPONENTS.filter((c) => c.shell).map((c) => c.name));

/**
 * What only a generated document is held to: it is never the product's shell, uses only the
 * components the host allows, and follows none of the patterns the Direction disallows.
 */
export function generatedChecks(doc: any, direction?: Direction, components?: string[]): Finding[] {
  const out: Finding[] = [];
  if (doc?.surface?.kind === "shell") out.push({ severity: "error", check: "generated:shell", message: "surface.kind is \"shell\": the product's shell is authored, and a generated surface renders inside it" });
  const allowed = components ? new Set(components) : undefined;
  for (const c of Array.isArray(doc?.components) ? doc.components : []) {
    if (SHELL.has(c?.component)) continue; // the validator and the shell check above already report these
    if (allowed && typeof c?.component === "string" && !allowed.has(c.component)) out.push({ severity: "error", check: "generated:component", message: `${c.id}: ${c.component} is not one of the components this product allows` });
  }
  const pattern = doc?.surface?.pattern;
  if (pattern && direction?.patterns?.disallow?.includes(pattern)) out.push({ severity: "error", check: "direction:pattern-disallowed", message: `surface.pattern "${pattern}" is a pattern the design direction disallows` });
  return out;
}

/** Findings, with the same finding reported once. */
export function toReport(findings: Finding[]): Report {
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const k = `${f.severity}\u0000${f.check}\u0000${f.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const errors = unique.filter((f) => f.severity === "error").length;
  return { valid: errors === 0, errors, warnings: unique.length - errors, findings: unique };
}
