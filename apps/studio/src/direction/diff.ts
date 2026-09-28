/**
 * What changed between two versions of a Direction, field by field, in the words the editor
 * uses: "Density: Comfortable → Compact", "Words to avoid: added “oops”", "Rule “Money only
 * moves from a confirmation”: severity warning → error". Lists of words are compared as sets,
 * rows (glossary, rules, exemplars, the team's patterns) by what identifies them, and anything
 * the editor has no words for is compared as JSON, so no change goes unreported.
 */
import { CORE_PATTERNS, screenKeyOf, type CompanyPattern, type Direction, type DirectionRule, type Snapshot } from "./model.ts";
import { EMPHASIS, PROFILE_FIELDS, SITUATIONS, TONE_FIELDS, VALUE_LABELS } from "./labels.ts";

export type Section = "Details" | "Profile" | "Voice" | "Patterns" | "Rules" | "Exemplars";
export interface Change {
  section: Section;
  /** What changed, e.g. "Density" or "Rule “Money only moves from a confirmation”" */
  what: string;
  kind: "added" | "removed" | "changed";
  before?: string;
  after?: string;
}
export const SECTIONS: Section[] = ["Details", "Profile", "Voice", "Patterns", "Rules", "Exemplars"];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const NOT_SET = "Not set";
const show = (v: unknown, path?: string): string => {
  if (v === undefined || v === null || v === "") return NOT_SET;
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (typeof v === "string") return (path && VALUE_LABELS[`${path}:${v}`]) || v;
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v.length ? v.join(", ") : "None";
  return JSON.stringify(v);
};
const quote = (s: string) => `“${s}”`;
const patternName = (id: string, own: CompanyPattern[]) => CORE_PATTERNS.find((p) => p.id === id)?.name ?? own.find((p) => p.id === id)?.name ?? id;
const get = (o: unknown, path: string[]): unknown => path.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), o);

export function diffDirections(before: Snapshot | null, after: Snapshot): Change[] {
  const a: Direction = before?.direction ?? ({ profile: {} } as Direction);
  const b = after.direction;
  const out: Change[] = [];
  const scalar = (section: Section, what: string, path: string[], labelPath?: string) => {
    const x = get(a, path);
    const y = get(b, path);
    if (same(x, y)) return;
    out.push({ section, what, kind: x === undefined ? "added" : y === undefined ? "removed" : "changed", before: show(x, labelPath), after: show(y, labelPath) });
  };
  const words = (section: Section, what: string, x: string[] = [], y: string[] = [], name: (s: string) => string = quote) => {
    for (const w of y) if (!x.includes(w)) out.push({ section, what, kind: "added", after: name(w) });
    for (const w of x) if (!y.includes(w)) out.push({ section, what, kind: "removed", before: name(w) });
    if (x.length === y.length && x.every((w) => y.includes(w)) && !same(x, y)) out.push({ section, what, kind: "changed", before: "In the old order", after: "Reordered" });
  };
  const rows = <T,>(section: Section, x: T[] = [], y: T[] = [], id: (r: T) => string, label: (r: T) => string, fields: (r0: T, r1: T) => void) => {
    const xs = new Map(x.map((r) => [id(r), r]));
    const ys = new Map(y.map((r) => [id(r), r]));
    for (const [k, r] of ys) if (!xs.has(k)) out.push({ section, what: label(r), kind: "added" });
    for (const [k, r] of xs) if (!ys.has(k)) out.push({ section, what: label(r), kind: "removed" });
    for (const [k, r] of ys) if (xs.has(k) && !same(xs.get(k), r)) fields(xs.get(k)!, r);
  };

  scalar("Details", "Version", ["version"]);
  scalar("Details", "Design system", ["designSystem"]);

  for (const f of PROFILE_FIELDS) scalar("Profile", f.label, ["profile", f.key], `profile.${f.key}`);
  scalar("Profile", EMPHASIS.label, ["profile", "emphasisBudget"]);

  const va = a.voice ?? {};
  const vb = b.voice ?? {};
  words("Voice", "Guidelines", va.guidelines, vb.guidelines);
  for (const f of TONE_FIELDS) scalar("Voice", `Tone: ${f.label}`, ["voice", "tone", f.key], `voice.tone.${f.key}`);
  scalar("Voice", "Person", ["voice", "person"], "voice.person");
  scalar("Voice", "Reading level (highest grade)", ["voice", "readingLevel", "maxGrade"]);
  scalar("Voice", "Casing", ["voice", "casing"], "voice.casing");
  scalar("Voice", "Spelling", ["voice", "spelling"], "voice.spelling");
  scalar("Voice", "Exclamation marks", ["voice", "punctuation", "exclamation"], "voice.punctuation.exclamation");
  scalar("Voice", "Emoji", ["voice", "punctuation", "emoji"], "voice.punctuation.emoji");
  scalar("Voice", "Longest button label (words)", ["voice", "labels", "maxWords"]);
  scalar("Voice", "Buttons start with a verb", ["voice", "labels", "verbFirst"]);
  rows("Voice", va.glossary, vb.glossary, (g) => g.use, (g) => `Say ${quote(g.use)}${g.insteadOf?.length ? ` instead of ${g.insteadOf.map(quote).join(" or ")}` : ""}`, (g0, g1) =>
    out.push({ section: "Voice", what: `Say ${quote(g1.use)} instead of`, kind: "changed", before: show(g0.insteadOf ?? []), after: show(g1.insteadOf ?? []) }));
  words("Voice", "Words to avoid", va.avoid, vb.avoid);
  for (const s of SITUATIONS) scalar("Voice", `Situation: ${s.label}`, ["voice", "situations", s.key]);
  for (const k of new Set([...Object.keys(va), ...Object.keys(vb)])) {
    if (!["guidelines", "tone", "person", "readingLevel", "casing", "spelling", "punctuation", "labels", "glossary", "avoid", "situations"].includes(k)) scalar("Voice", k, ["voice", k]);
  }

  const own0 = before?.patterns ?? [];
  const own1 = after.patterns;
  const both = [...own0, ...own1];
  words("Patterns", "Preferred", a.patterns?.prefer, b.patterns?.prefer, (id) => patternName(id, both));
  words("Patterns", "Avoided", a.patterns?.disallow, b.patterns?.disallow, (id) => patternName(id, both));
  words("Patterns", "Pattern files kept as paths", a.patterns?.custom, b.patterns?.custom);
  rows("Patterns", own0, own1, (p) => p.id, (p) => `Your pattern ${quote(p.name || p.id)}`, (p0, p1) => {
    const what = `Your pattern ${quote(p1.name || p1.id)}`;
    const field = (label: string, x: unknown, y: unknown) => !same(x, y) && out.push({ section: "Patterns", what: `${what}: ${label}`, kind: "changed", before: show(x), after: show(y) });
    field("name", p0.name, p1.name);
    field("guidance", p0.summary, p1.summary);
    field("when to use it", p0.whenToUse, p1.whenToUse);
    field("when not to", p0.whenNotToUse ?? [], p1.whenNotToUse ?? []);
    field("preferred components", p0.structure.join(" → "), p1.structure.join(" → "));
    field("goal", p0.journey.goal, p1.journey.goal);
    field("done when", p0.journey.done, p1.journey.done);
    field("checks", p0.checks, p1.checks);
  });

  rows<DirectionRule>("Rules", a.rules, b.rules, (r) => r.id, (r) => `Rule ${quote(r.description)} (${r.severity})`, (r0, r1) => {
    const what = `Rule ${quote(r1.description)}`;
    if (r0.description !== r1.description) out.push({ section: "Rules", what, kind: "changed", before: quote(r0.description), after: quote(r1.description) });
    if (r0.severity !== r1.severity) out.push({ section: "Rules", what: `${what}: severity`, kind: "changed", before: r0.severity, after: r1.severity });
    if (!same(r0.rule, r1.rule)) out.push({ section: "Rules", what: `${what}: its check`, kind: "changed", before: JSON.stringify(r0.rule), after: JSON.stringify(r1.rule) });
  });

  const exemplarName = (d: string) => (screenKeyOf(d) ? `screen ${screenKeyOf(d)}` : d);
  const counted = out.length;
  rows("Exemplars", a.exemplars, b.exemplars, (e) => e.document, (e) => `Exemplar: ${exemplarName(e.document)}${e.request ? `, for ${quote(e.request)}` : ""}`, (e0, e1) =>
    out.push({ section: "Exemplars", what: `Exemplar: ${exemplarName(e1.document)}, the request it answers`, kind: "changed", before: quote(e0.request), after: quote(e1.request) }));
  if (out.length === counted && !same(a.exemplars ?? [], b.exemplars ?? [])) out.push({ section: "Exemplars", what: "Order", kind: "changed", before: "In the old order", after: "Reordered" });

  // Whatever else a file carried, compared whole.
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!["$schema", "name", "version", "designSystem", "profile", "voice", "patterns", "rules", "exemplars"].includes(k)) scalar("Details", k, [k]);
  }
  for (const k of new Set([...Object.keys(a.profile ?? {}), ...Object.keys(b.profile ?? {})])) {
    if (!PROFILE_FIELDS.some((f) => f.key === k) && k !== "emphasisBudget") scalar("Profile", k, ["profile", k]);
  }
  return out;
}

/** "3 changes: 1 to the profile, 2 to the voice" */
export function summarise(changes: Change[]): string {
  if (!changes.length) return "No changes";
  const by = SECTIONS.map((s) => [s, changes.filter((c) => c.section === s).length] as const).filter(([, n]) => n);
  return `${changes.length} change${changes.length === 1 ? "" : "s"}: ${by.map(([s, n]) => `${n} to ${s === "Details" ? "the details" : s === "Profile" || s === "Voice" ? `the ${s.toLowerCase()}` : s.toLowerCase()}`).join(", ")}`;
}
