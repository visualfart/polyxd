/**
 * Studio Insights, the ingest side: what a workspace's products send (the semantic events of
 * packages/spec/schema/event.schema.json, as `toFetch` from @polyxd/analytics posts them) turned
 * into daily counts. Pure functions, shared by the Worker and its tests.
 *
 * 1. `checkEvent` holds each event to the schema, by hand (the schema is small and flat, and a
 *    Worker can't compile a validator at runtime). An event the schema refuses is dropped whole,
 *    so a property it doesn't define (a field value, a label) is never read.
 * 2. `redact` from @polyxd/analytics rebuilds it from the allow-list, as the adapters do.
 * 3. `rowOf` keeps only the dimensions Insights counts by, and only when each is a short code.
 *    The session id, the timestamp, the experiment, the Direction, the generator's name and every
 *    other string are left behind. Nothing of an event is stored but the counts it adds to.
 */
import { EVENT_TYPES, redact, type SemanticEvent, type SemanticEventType } from "@polyxd/analytics";

/** The most events one request may carry, and its largest body. */
export const MAX_EVENTS = 100;
export const MAX_BODY = 64 * 1024;

const EVENT_KEYS = new Set(["type", "timestamp", "sessionId", "surface", "actor", "component", "capability", "checkpoint", "durationMs", "steps", "reason", "rating"]);
const SURFACE_KEYS = new Set(["id", "intent", "pattern", "journey", "specVersion", "generator", "direction", "experiment"]);
const ACTOR_KEYS = new Set(["kind", "assistiveTech"]);
const COMPONENT_KEYS = new Set(["id", "key", "type"]);
/** RFC 3339 date-time, as JSON Schema's "date-time" format means it. */
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const onlyKeys = (o: Record<string, unknown>, allowed: Set<string>) => Object.keys(o).every((k) => allowed.has(k));
const optString = (o: Record<string, unknown>, k: string) => o[k] === undefined || typeof o[k] === "string";
const optCount = (v: unknown) => v === undefined || (typeof v === "number" && Number.isInteger(v) && v >= 0);

/**
 * Whether a value is an event as event.schema.json defines it: the required properties, the
 * right types, and nothing the schema doesn't name (it sets additionalProperties: false at every
 * level). The tests hold this to the schema itself, compiled with Ajv.
 */
export function checkEvent(v: unknown): v is SemanticEvent {
  if (!isObject(v) || !onlyKeys(v, EVENT_KEYS)) return false;
  if (!EVENT_TYPES.includes(v.type as SemanticEventType)) return false;
  if (typeof v.timestamp !== "string" || !DATE_TIME.test(v.timestamp) || typeof v.sessionId !== "string") return false;
  const s = v.surface;
  if (!isObject(s) || !onlyKeys(s, SURFACE_KEYS) || typeof s.id !== "string" || typeof s.intent !== "string") return false;
  if (!["pattern", "journey", "specVersion", "generator", "direction"].every((k) => optString(s, k))) return false;
  if (s.experiment !== undefined && (!isObject(s.experiment) || !Object.values(s.experiment).every((x) => typeof x === "string"))) return false;
  const a = v.actor;
  if (!isObject(a) || !onlyKeys(a, ACTOR_KEYS) || (a.kind !== "human" && a.kind !== "agent")) return false;
  if (a.assistiveTech !== undefined && typeof a.assistiveTech !== "boolean") return false;
  const c = v.component;
  if (c !== undefined && (!isObject(c) || !onlyKeys(c, COMPONENT_KEYS) || !["id", "key", "type"].every((k) => optString(c, k)))) return false;
  if (!["capability", "checkpoint", "reason"].every((k) => optString(v, k))) return false;
  if (!optCount(v.durationMs) || !optCount(v.steps)) return false;
  if (v.rating !== undefined && v.rating !== -1 && v.rating !== 0 && v.rating !== 1) return false;
  return true;
}

/**
 * A code: letters, digits, dots, dashes, underscores and colons, at least one letter, up to 80
 * characters. Intents, surface ids, pattern names, component keys, capabilities and reasons are
 * all codes. Anything else (a sentence, an email address, a card or phone number) is not kept.
 */
const CODE = /^(?=.*[A-Za-z])[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
export const code = (v: unknown): string => (typeof v === "string" && CODE.test(v) ? v : "");

/** Where a surface came from: generated when the event names a generator (`events.generator`), authored when it doesn't. */
export type Source = "generated" | "authored";

/** What one event adds to: the row's key, and its measures. */
export interface Row {
  intent: string;
  surface: string;
  pattern: string;
  type: SemanticEventType;
  component: string;
  capability: string;
  reason: string;
  source: Source;
  actor: "human" | "agent";
}

export interface Measures {
  count: number;
  /** task.completed only: the sum of durationMs (each capped at a day), how many had one, and a histogram. */
  durationSum: number;
  durationCount: number;
  buckets: number[];
  /** feedback only: the sum of ratings and how many there were. */
  ratingSum: number;
  ratingCount: number;
}

/** Upper bounds, in ms, of the time-to-complete buckets; the last is open. */
export const BUCKETS = [2_000, 5_000, 10_000, 30_000, 60_000, 120_000, 300_000, Infinity] as const;
export const BUCKET_LABELS = ["under 2 s", "2–5 s", "5–10 s", "10–30 s", "30–60 s", "1–2 min", "2–5 min", "over 5 min"] as const;
const DAY_MS = 86_400_000;
export const bucketOf = (ms: number): number => BUCKETS.findIndex((b) => ms < b);

/** Which dimensions each event type is counted by; the rest are left empty so a row stays general. */
const DIMENSIONS: Record<SemanticEventType, ("component" | "capability" | "reason")[]> = {
  "surface.shown": [],
  "surface.dismissed": ["reason"],
  "surface.regenerated": ["reason"],
  "action.taken": ["component", "capability"],
  "checkpoint.reached": ["capability"],
  "task.completed": ["capability"],
  "task.abandoned": ["reason"],
  "input.error": ["component", "reason"],
  "status.shown": ["component", "reason"],
  undo: ["component", "capability"],
  feedback: ["reason"],
};

/**
 * Where the renderers only ever send a reason from a fixed list, only that list is kept: an
 * input error's validity code, a Status's kind, how a surface was left. A reason the host makes up
 * (feedback, a regeneration) is kept when it is a code.
 */
const REASONS: Partial<Record<SemanticEventType, Set<string>>> = {
  "input.error": new Set(["required", "type", "pattern", "too-short", "too-long", "too-low", "too-high", "step", "bad-input", "custom", "invalid", "file-too-large", "file-type"]),
  "status.shown": new Set(["info", "success", "warning", "error", "empty", "loading", "undo"]),
  "task.abandoned": new Set(["dismiss", "unmount"]),
  "surface.dismissed": new Set(["dismiss", "unmount"]),
};
const reasonOf = (type: SemanticEventType, reason: unknown): string => {
  const r = code(reason);
  const known = REASONS[type];
  return known && !known.has(r) ? "" : r;
};

/** The row an event counts in, or undefined when its intent isn't a code (there is nothing to file it under). */
export function rowOf(e: SemanticEvent): Row | undefined {
  const intent = code(e.surface.intent);
  if (!intent) return undefined;
  const dims = DIMENSIONS[e.type];
  return {
    intent,
    surface: code(e.surface.id),
    pattern: code(e.surface.pattern),
    type: e.type,
    // The component's stable semantic key when the document gives one, else its id.
    component: dims.includes("component") ? code(e.component?.key) || code(e.component?.id) : "",
    capability: dims.includes("capability") ? code(e.capability) : "",
    reason: dims.includes("reason") ? reasonOf(e.type, e.reason) : "",
    source: e.surface.generator ? "generated" : "authored",
    actor: e.actor.kind === "agent" ? "agent" : "human",
  };
}

export const rowKey = (r: Row): string => [r.intent, r.surface, r.pattern, r.type, r.component, r.capability, r.reason, r.source, r.actor].join("\u0000");

export interface Aggregate {
  rows: { row: Row; m: Measures }[];
  accepted: number;
  dropped: { invalid: number; duplicate: number; uncoded: number };
}

/**
 * A request's events, counted. Each is checked against the schema, redacted, and filed under its
 * row. An exact repeat within the request (a retried beacon) counts once: this is the only use of
 * the session id, and it goes no further than this function.
 */
export function aggregate(events: unknown[]): Aggregate {
  const out = new Map<string, { row: Row; m: Measures }>();
  const seen = new Set<string>();
  const dropped = { invalid: 0, duplicate: 0, uncoded: 0 };
  let accepted = 0;
  for (const raw of events) {
    const e = checkEvent(raw) ? redact(raw) : undefined;
    if (!e) {
      dropped.invalid++;
      continue;
    }
    const identity = JSON.stringify(e);
    if (seen.has(identity)) {
      dropped.duplicate++;
      continue;
    }
    seen.add(identity);
    const row = rowOf(e);
    if (!row) {
      dropped.uncoded++;
      continue;
    }
    const k = rowKey(row);
    let hit = out.get(k);
    if (!hit) out.set(k, (hit = { row, m: { count: 0, durationSum: 0, durationCount: 0, buckets: BUCKETS.map(() => 0), ratingSum: 0, ratingCount: 0 } }));
    hit.m.count++;
    if (e.type === "task.completed" && typeof e.durationMs === "number") {
      const ms = Math.min(e.durationMs, DAY_MS);
      hit.m.durationSum += ms;
      hit.m.durationCount++;
      hit.m.buckets[bucketOf(ms)]++;
    }
    if (e.type === "feedback" && typeof e.rating === "number") {
      hit.m.ratingSum += e.rating;
      hit.m.ratingCount++;
    }
    accepted++;
  }
  return { rows: [...out.values()], accepted, dropped };
}

/** The intent a workspace's events are filed under once it is over its daily limit of rows. */
export const OTHER = "(other)";
/** A row with every dimension but its type, source and actor folded away, for a workspace over that limit. */
export const folded = (r: Row): Row => ({ ...r, intent: OTHER, surface: "", pattern: "", component: "", capability: "", reason: "" });
