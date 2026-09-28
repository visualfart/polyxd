import { validateDocument } from "@polyxd/spec/browser";
import { checkCapabilities } from "@polyxd/spec/capabilities";
import { runCheck } from "@polyxd/spec/checks";
import { COMPONENTS, PATTERNS } from "./catalog.generated.ts";
import type { AuditOptions, Direction, Finding, Report } from "./types.ts";

/**
 * The document checks the runtime runs anywhere, with no file system and no browser to render in:
 * the spec validator, the pattern the document declares, the capabilities on offer, and the
 * Design Direction's rules. Check ids and messages match the verifier's `staticAudit`, which adds
 * agent-readiness checks on top and can be passed to the runtime as `audit` in Node.
 */
export function checkDocument(doc: unknown, options: AuditOptions & { missingData?: "warning" | "error" } = {}): Finding[] {
  const out: Finding[] = [];
  const v = validateDocument(doc as any, { emphasisBudget: options.emphasisBudget, missingData: options.missingData });
  for (const i of v.issues) out.push({ severity: i.severity, check: i.code ?? "spec", message: `${i.at}: ${i.message}` });
  // Everything below needs a structurally sound document.
  if (v.issues.some((i) => i.severity === "error" && !i.code)) return out;
  const d = doc as any;
  const patternId = d.surface?.pattern;
  if (patternId) {
    const pattern = PATTERNS.find((p) => p.id === patternId);
    if (!pattern) out.push({ severity: "error", check: "pattern:unknown-pattern", message: `Declared pattern exists: unknown pattern "${patternId}"` });
    else
      for (const r of pattern.checks) {
        const res = runCheck(r.rule, d);
        if (!res.pass) out.push({ severity: r.severity, check: `pattern:${r.id}`, message: `${r.description}: ${res.message}` });
      }
  }
  if (options.registry) for (const i of checkCapabilities(d, options.registry)) out.push({ severity: i.severity, check: "capability", message: `${i.at}: ${i.message}` });
  for (const r of options.rules ?? []) {
    const res = runCheck(r.rule, d);
    if (!res.pass) out.push({ severity: r.severity, check: `rule:${r.id}`, message: `${r.description}: ${res.message}` });
  }
  return out;
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
