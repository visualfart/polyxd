import { readFileSync, readdirSync } from "node:fs";
import { runCheck, type Check } from "./checks.ts";
import { validatePattern } from "./pattern-validator.generated.ts";
import type { SchemaValidator } from "./schema-validator.ts";

export interface Rule {
  id: string;
  description: string;
  severity: "error" | "warning";
  rule: Check;
}

export interface Pattern {
  id: string;
  name: string;
  summary: string;
  checks: Rule[];
  journey: { goal: string; checkpoints: string[]; done: string };
  examples?: string[];
  [key: string]: unknown;
}

export interface RuleResult {
  id: string;
  description: string;
  severity: "error" | "warning";
  pass: boolean;
  message: string;
}

const dir = new URL("../patterns/", import.meta.url);
const readJson = (url: URL) => JSON.parse(readFileSync(url, "utf8"));

/** Checks a pattern file against schema/pattern.schema.json; compiled ahead of time (scripts/build-validators.ts). */
export const validatePatternFile: SchemaValidator = validatePattern;

export function loadPatterns(): Map<string, Pattern> {
  const out = new Map<string, Pattern>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const p = readJson(new URL(f, dir)) as Pattern;
    out.set(p.id, p);
  }
  return out;
}

/** Evaluates a list of rules (a pattern's checks, or Design Direction / acceptance rules) against a document. */
export function evaluateRules(rules: Rule[], doc: any): RuleResult[] {
  return rules.map((r) => ({ id: r.id, description: r.description, severity: r.severity, ...runCheck(r.rule, doc) }));
}

/** Checks a document against the pattern it declares in surface.pattern (or an explicit pattern id). */
export function checkPattern(doc: any, patternId: string | undefined = doc?.surface?.pattern, patterns = loadPatterns()): RuleResult[] {
  if (!patternId) return [];
  const pattern = patterns.get(patternId);
  if (!pattern) return [{ id: "unknown-pattern", description: "Declared pattern exists", severity: "error", pass: false, message: `unknown pattern "${patternId}"` }];
  return evaluateRules(pattern.checks, doc);
}
