/**
 * A Direction checked against the spec's schema, without ajv (Workers refuse code generated from
 * strings; see src/screens/schema.ts). It walks direction.schema.json, and check.schema.json for
 * the rules, with the subset of JSON Schema they use: types, required, properties, closed
 * objects, enums, consts, patterns, bounds, list sizes, $ref, and the checks' discriminated
 * oneOf. The Worker runs it on save; the editor runs it on every change and puts each problem
 * beside its control. The tests hold it to ajv's verdict.
 */
import directionSchema from "@polyxd/spec/schema/direction.schema.json" with { type: "json" };
import checkSchema from "@polyxd/spec/schema/check.schema.json" with { type: "json" };
import patternSchema from "@polyxd/spec/schema/pattern.schema.json" with { type: "json" };
import { fieldLabel } from "./labels.ts";
import { toExport, toStored, type DirectionRule, type Snapshot } from "./model.ts";

type S = Record<string, any>;
export interface Problem {
  /** JSON Pointer into the Direction (or pattern) */
  at: string;
  message: string;
}

const FILES: Record<string, S> = { "direction.schema.json": directionSchema, "check.schema.json": checkSchema, "pattern.schema.json": patternSchema };

/** The schema a $ref names, and the file it is in (for the refs inside it). */
function resolve(ref: string, file: S): { s: S; file: S } {
  const [path, pointer = ""] = ref.split("#");
  const target = path ? FILES[path] : file;
  if (!target) throw new Error(`Unknown schema ${path}`);
  let s: S = target;
  for (const part of pointer.split("/").slice(1)) s = s[part];
  return { s, file: target };
}

const escape = (k: string) => k.replace(/~/g, "~0").replace(/\//g, "~1");
const typeOf = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
const TYPE_WORDS: Record<string, string> = { string: "text", array: "a list", object: "a set of fields", integer: "a whole number", number: "a number", boolean: "on or off" };
const list = (xs: unknown[]) => xs.map((x) => `“${x}”`).join(", ");
const PATTERN_WORDS: Record<string, string> = { "^[a-z0-9][a-z0-9-]*$": "lower-case letters, digits and dashes", "^[a-z][a-z0-9-]*$": "lower-case letters, digits and dashes, starting with a letter" };

function walk(v: unknown, s: S, file: S, at: string, out: Problem[]): void {
  if (s.$ref) {
    const r = resolve(s.$ref, file);
    return walk(v, r.s, r.file, at, out);
  }
  const say = (message: string, where = at): void => void out.push({ at: where || "/", message });
  if (s.oneOf) {
    const key = s.discriminator?.propertyName;
    if (key && v && typeof v === "object" && !Array.isArray(v)) {
      const name = (v as S)[key];
      const branch = (s.oneOf as S[]).find((b) => b.properties?.[key]?.const === name);
      if (!branch) {
        const known = (s.oneOf as S[]).map((b) => b.properties?.[key]?.const).filter(Boolean);
        return say(name === undefined ? `needs a “${key}”` : `“${name}” isn't a check Polyxd knows; one of ${known.join(", ")}`, `${at}/${key}`);
      }
      return walk(v, { ...s, oneOf: undefined, discriminator: undefined, ...branch }, file, at, out);
    }
    const ok = (s.oneOf as S[]).some((b) => {
      const inner: Problem[] = [];
      walk(v, b, file, at, inner);
      return !inner.length;
    });
    if (!ok) say("doesn't match any of the shapes it can take");
    return;
  }
  if (s.type) {
    const t = s.type as string;
    const fits = t === "integer" ? typeof v === "number" && Number.isInteger(v) : t === "number" ? typeof v === "number" && Number.isFinite(v) : typeOf(v) === t;
    if (!fits) return say(`must be ${TYPE_WORDS[t] ?? t}`);
  }
  if (s.const !== undefined && v !== s.const) return say(`must be “${s.const}”`);
  if (s.enum && !(s.enum as unknown[]).includes(v)) return say(`must be one of ${list(s.enum)}`);
  if (typeof v === "string" && s.pattern && !new RegExp(s.pattern, "u").test(v)) say(`must be ${PATTERN_WORDS[s.pattern] ?? `text matching ${s.pattern}`}`);
  if (typeof v === "number") {
    if (s.minimum !== undefined && s.maximum !== undefined && (v < s.minimum || v > s.maximum)) say(`must be from ${s.minimum} to ${s.maximum}`);
    else if (s.minimum !== undefined && v < s.minimum) say(`must be at least ${s.minimum}`);
    else if (s.maximum !== undefined && v > s.maximum) say(`must be at most ${s.maximum}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) say(s.minItems === 1 ? "needs at least one" : `needs at least ${s.minItems}`);
    if (s.maxItems !== undefined && v.length > s.maxItems) say(`takes at most ${s.maxItems}`);
    if (s.items) v.forEach((x, i) => walk(x, s.items, file, `${at}/${i}`, out));
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as S;
    for (const r of (s.required as string[] | undefined) ?? []) if (!(r in o)) say("is required", `${at}/${r}`);
    const props = (s.properties ?? {}) as S;
    for (const [k, x] of Object.entries(o)) {
      if (props[k]) walk(x, props[k], file, `${at}/${escape(k)}`, out);
      else if (s.additionalProperties === false) say("isn't a setting Polyxd knows", `${at}/${escape(k)}`);
    }
  }
}

/** Every way the value departs from direction.schema.json, each with its place and a sentence. */
export function validateDirection(v: unknown): Problem[] {
  const out: Problem[] = [];
  walk(v, directionSchema as S, directionSchema as S, "", out);
  return out.map((p) => ({ at: p.at || "/", message: `${fieldLabel(p.at)} ${p.message}` }));
}

/** Every way a team pattern departs from pattern.schema.json. */
export function validatePattern(v: unknown): Problem[] {
  const out: Problem[] = [];
  walk(v, patternSchema as S, patternSchema as S, "", out);
  return out.map((p) => ({ at: p.at || "/", message: `${PATTERN_FIELDS[p.at.split("/")[1] ?? ""] ?? `“${p.at.split("/").pop()}”`} ${p.message}` }));
}

const PATTERN_FIELDS: Record<string, string> = { "": "The pattern", id: "Id", name: "Name", summary: "Guidance", whenToUse: "When to use it", whenNotToUse: "When not to", structure: "Preferred components", checks: "Checks", journey: "Goal and done" };

export interface DirectionIssue extends Problem {
  /** The team pattern it is in, when it is in one */
  pattern?: string;
}

/**
 * A version as it would be stored, and everything in it the schemas refuse: the Direction as a
 * product would get it, and each of the team's patterns. The Worker refuses to save while there
 * are any; the editor shows them as they appear.
 */
export function checkDirection(s: Snapshot, key: string, rules: DirectionRule[]): { stored: Snapshot; issues: DirectionIssue[] } {
  const stored = toStored(s, key, rules);
  const issues: DirectionIssue[] = validateDirection(toExport(stored, key));
  const seen = new Set<string>();
  (Array.isArray(stored.patterns) ? stored.patterns : []).forEach((p, i) => {
    const id = typeof p?.id === "string" && p.id ? p.id : `#${i + 1}`;
    for (const x of validatePattern(p)) issues.push({ ...x, pattern: id });
    if (seen.has(id)) issues.push({ at: "/id", message: `Two of your patterns have the id “${id}”`, pattern: id });
    seen.add(id);
  });
  return { stored, issues };
}
