/**
 * A Design Direction as Studio keeps it, shared by the Worker and the app.
 *
 * Studio stores a version as `{ direction, patterns }`: `direction` is the Direction the spec
 * describes (schema/direction.schema.json), with its rules as they were when the version was
 * saved; `patterns` are the team's own pattern files (schema/pattern.schema.json), which the
 * Direction lists in `patterns.custom` by path. `direction.patterns.custom` holds only paths
 * Studio doesn't have the file for (from an imported Direction); the team's own are added when
 * the Direction is exported or fetched, as paths relative to where it is fetched from.
 *
 * Rules are the workspace's (the Rules page): a Direction carries the ones switched on when it
 * is saved. Components (which generators may use, with guidance) are workspace-wide too, and
 * the schema has no place for them, so they stay out of the Direction file.
 */
import confirmDestructive from "@polyxd/spec/patterns/confirm-destructive.json" with { type: "json" };
import compareAndChoose from "@polyxd/spec/patterns/compare-and-choose.json" with { type: "json" };
import filterAndBrowse from "@polyxd/spec/patterns/filter-and-browse.json" with { type: "json" };
import multiStepForm from "@polyxd/spec/patterns/multi-step-form.json" with { type: "json" };
import reviewAndSubmit from "@polyxd/spec/patterns/review-and-submit.json" with { type: "json" };
import undoOverConfirm from "@polyxd/spec/patterns/undo-over-confirm.json" with { type: "json" };

export const DIRECTION_SCHEMA_URL = "https://polyxd.com/schema/0.3/direction.schema.json";

export type Check = { check: string; [k: string]: unknown };
export interface DirectionRule {
  id: string;
  description: string;
  severity: "error" | "warning";
  rule: Check;
}
export interface Profile {
  density?: string;
  emphasisBudget?: number;
  dataDisplay?: string;
  motion?: string;
  disclosure?: string;
  freedom?: string;
}
export interface Voice {
  guidelines?: string[];
  tone?: { formality?: string; energy?: string; warmth?: string; humor?: string };
  person?: string;
  readingLevel?: { maxGrade?: number };
  casing?: string;
  spelling?: string;
  punctuation?: { exclamation?: string; emoji?: string };
  labels?: { maxWords?: number; verbFirst?: boolean };
  glossary?: { use: string; insteadOf?: string[] }[];
  avoid?: string[];
  situations?: Partial<Record<"empty" | "error" | "success" | "confirm" | "loading" | "destructive", string>>;
}
export interface Exemplar {
  request: string;
  document: string;
}
export interface Direction {
  $schema?: string;
  name: string;
  version: string;
  designSystem?: string;
  profile: Profile;
  voice?: Voice;
  patterns?: { prefer?: string[]; disallow?: string[]; custom?: string[] };
  rules?: DirectionRule[];
  exemplars?: Exemplar[];
}
/** A team's own pattern: the spec's pattern format, so it reads like the six that ship. */
export interface CompanyPattern {
  id: string;
  name: string;
  summary: string;
  whenToUse: string[];
  whenNotToUse?: string[];
  structure: string[];
  checks: DirectionRule[];
  journey: { goal: string; checkpoints: string[]; done: string };
}
/** What a version holds. */
export interface Snapshot {
  direction: Direction;
  patterns: CompanyPattern[];
}

export interface CorePattern {
  id: string;
  name: string;
  summary: string;
  whenToUse: string[];
  structure: string[];
}
/** The spec's six patterns, which a Direction can prefer or rule out by id. */
export const CORE_PATTERNS: CorePattern[] = [confirmDestructive, reviewAndSubmit, multiStepForm, compareAndChoose, filterAndBrowse, undoOverConfirm].map((p) => ({ id: p.id, name: p.name, summary: p.summary, whenToUse: p.whenToUse, structure: p.structure }));

/** Where a team pattern's file is, relative to the Direction's own address (…/directions/<key>). */
export const patternPath = (key: string, id: string) => `${key}/patterns/${id}.json`;
/** Where a workspace screen is, relative to the Direction's own address: …/screens/<key>. */
export const screenPath = (key: string) => `../screens/${key}`;
/** The screen key an exemplar points at, when it is one of the workspace's screens. */
export const screenKeyOf = (document: string): string | null => /^\.\.\/screens\/([a-z0-9][a-z0-9-]{0,79})$/.exec(document)?.[1] ?? null;

export const slugOf = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
/** An id the schemas accept (a lower-case letter first), from any name. */
export const idOf = (s: string, fallback = "rule") => {
  const slug = slugOf(s);
  return /^[a-z]/.test(slug) ? slug : `${fallback}-${slug || "1"}`.replace(/-$/, "");
};

/** A new Direction: the schema's defaults written out, so the editor shows what is in force. */
export function blankDirection(key: string, designSystem?: string): Direction {
  return {
    name: key,
    version: "0.1.0",
    ...(designSystem ? { designSystem } : {}),
    profile: { density: "comfortable", emphasisBudget: 1, dataDisplay: "auto", motion: "subtle", disclosure: "progressive", freedom: "guided" },
    voice: {
      guidelines: [],
      tone: { formality: "neutral", energy: "neutral", warmth: "friendly", humor: "none" },
      person: "you",
      casing: "sentence",
      punctuation: { exclamation: "allowed", emoji: "never" },
      labels: { verbFirst: true },
    },
  };
}

export function blankPattern(name: string, existing: string[]): CompanyPattern {
  let id = idOf(name, "pattern");
  for (let n = 2; existing.includes(id); n++) id = `${idOf(name, "pattern")}-${n}`;
  return { id, name, summary: "", whenToUse: [], structure: [], checks: [], journey: { goal: "", checkpoints: [], done: "" } };
}

export interface WorkspaceRule {
  name: string;
  severity: "error" | "warning";
  check: Check;
  enabled: number | boolean;
  created_at: string;
}

/** The workspace's rules that are on, as a Direction's rules: oldest first, each with an id from its name. */
export function rulesFromWorkspace(rules: WorkspaceRule[]): DirectionRule[] {
  const used = new Set<string>();
  return [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => {
      let id = idOf(r.name);
      for (let n = 2; used.has(id); n++) id = `${idOf(r.name)}-${n}`;
      used.add(id);
      return { id, description: r.name, severity: r.severity, rule: r.check };
    });
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Drops what says nothing: empty text, empty lists of text, and objects left empty. Lists of objects are kept whole, so a half-filled row is reported rather than lost. */
function prune(v: unknown): unknown {
  if (Array.isArray(v)) return v.every((x) => typeof x === "string") ? v.map((x) => (x as string).trim()).filter(Boolean) : v;
  if (!isObj(v)) return typeof v === "string" ? v.trim() : v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    const p = prune(x);
    if (p === undefined || p === "" || (Array.isArray(p) && !p.length) || (isObj(p) && !Object.keys(p).length)) continue;
    out[k] = p;
  }
  return out;
}

/**
 * The Direction a product gets: what the version holds, named by its key, with the team's pattern
 * files listed where they are fetched from, in the schema's key order. Rules, when given, replace
 * the version's (the editor passes the workspace's current ones).
 */
export function toExport(s: Snapshot, key: string, rules?: DirectionRule[]): Direction {
  const d = s.direction;
  const custom = [...(d.patterns?.custom ?? []), ...s.patterns.map((p) => patternPath(key, p.id))];
  const patterns = prune({ prefer: d.patterns?.prefer, disallow: d.patterns?.disallow, custom }) as Direction["patterns"];
  const voice = prune(d.voice ?? {}) as Voice;
  const outRules = rules ?? d.rules ?? [];
  const ds = typeof d.designSystem === "string" ? d.designSystem.trim() : d.designSystem;
  const out = { $schema: DIRECTION_SCHEMA_URL, name: key, version: typeof d.version === "string" ? d.version.trim() : d.version, ...(ds ? { designSystem: ds } : {}), profile: (isObj(d.profile) ? prune(d.profile) : d.profile) as Profile } as Direction;
  if (Object.keys(voice).length) out.voice = voice;
  if (patterns && Object.keys(patterns).length) out.patterns = patterns;
  if (outRules.length) out.rules = outRules;
  if (d.exemplars?.length) out.exemplars = d.exemplars;
  // Anything else the file carried stays, so the schema can say it doesn't belong.
  for (const [k, v] of Object.entries(d)) if (!(k in out) && !["$schema", "name", "version", "designSystem", "profile", "voice", "patterns", "rules", "exemplars"].includes(k)) (out as unknown as Record<string, unknown>)[k] = v;
  return out;
}

/** What a version stores, from the editor's state: the Direction without the team's own pattern paths, named by its key. */
export function toStored(s: Snapshot, key: string, rules: DirectionRule[]): Snapshot {
  const exported = toExport({ direction: s.direction, patterns: [] }, key, rules);
  const { $schema: _, ...direction } = exported;
  return { direction: direction as Direction, patterns: s.patterns };
}

export interface Imported {
  snapshot: Snapshot;
  /** Rules in the file that the workspace doesn't have, by id. */
  newRules: DirectionRule[];
  /** Paths to pattern files Studio doesn't have; kept, and listed as such. */
  external: string[];
}

/**
 * A Direction file as the editor's state. The team's own patterns that the file still lists
 * (by the path Studio gives them) are kept; any other pattern path is kept as a path. The
 * file's rules aren't taken over: rules live on the Rules page, and the ones the workspace
 * lacks come back to be added there. The result is checked like any edit, so a file that
 * doesn't fit the schema shows where.
 */
export function fromImport(raw: unknown, key: string, current: CompanyPattern[], workspaceRules: DirectionRule[]): Imported {
  if (!isObj(raw)) throw new Error("A Direction is a JSON object with a name, a version and a profile");
  const { $schema: _, ...rest } = raw as unknown as Direction;
  const d = structuredClone(rest) as Direction;
  const listed = new Set(Array.isArray(d.patterns?.custom) ? d.patterns!.custom : []);
  const patterns = current.filter((p) => listed.has(patternPath(key, p.id)));
  const own = new Set(patterns.map((p) => patternPath(key, p.id)));
  const external = [...listed].filter((p) => !own.has(p));
  if (isObj(d.patterns)) {
    if (external.length) d.patterns.custom = external;
    else delete d.patterns.custom;
  }
  const have = new Set(workspaceRules.map((r) => JSON.stringify([r.severity, r.rule])));
  const ids = new Set(workspaceRules.map((r) => r.id));
  const newRules = (Array.isArray(d.rules) ? d.rules : []).filter((r) => isObj(r) && !ids.has(r.id) && !have.has(JSON.stringify([r.severity, r.rule])));
  d.name = key;
  return { snapshot: { direction: d, patterns }, newRules, external };
}
