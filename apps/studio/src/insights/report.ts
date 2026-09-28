/**
 * Studio Insights, the reading side: the daily counts D1 holds (src/insights/events.ts made them)
 * summed into what the Insights page shows. Pure functions over the stored rows, shared by the
 * Worker and its tests. Every figure is a count or a sum of counts; the time to complete is a
 * mean and the bucket the median falls in, because the rows hold no single durations.
 */
import { BUCKETS, BUCKET_LABELS, type Source } from "./events.ts";

/** A row as D1 stores it. */
export interface StoredRow {
  day: string;
  intent: string;
  surface: string;
  pattern: string;
  type: string;
  component: string;
  capability: string;
  reason: string;
  source: Source;
  actor: "human" | "agent";
  count: number;
  duration_sum: number;
  duration_count: number;
  d0: number; d1: number; d2: number; d3: number; d4: number; d5: number; d6: number; d7: number;
  rating_sum: number;
  rating_count: number;
}

/** How long aggregates are kept, and the ranges the page offers. No plan has a longer one yet. */
export const RETENTION_DAYS = 90;
export const RANGES = [7, 30, 90] as const;

export interface Time {
  /** How many completions had a duration. */
  count: number;
  meanMs: number;
  /** The bucket the median falls in, e.g. "10–30 s". */
  median: string;
  buckets: number[];
}

export interface Measures {
  shown: number;
  actions: number;
  checkpoints: number;
  completed: number;
  abandoned: number;
  dismissed: number;
  regenerated: number;
  inputErrors: number;
  statusShown: number;
  undo: number;
  /** completed ÷ shown, or null before anything was shown. */
  completionRate: number | null;
  time: Time | null;
  feedback: { count: number; average: number } | null;
}

export interface Ranked {
  key: string;
  count: number;
}

export interface IntentSummary extends Measures {
  intent: string;
  surfaces: string[];
  patterns: string[];
  sources: Source[];
  /** The three most frequent input errors: component key and reason. */
  topInputErrors: { component: string; reason: string; count: number }[];
}

export interface IntentDetail extends IntentSummary {
  series: { day: string; shown: number; completed: number; abandoned: number; inputErrors: number }[];
  /** Shown, then started (completed, or left after interacting), then completed: sessions at each step. */
  funnel: { shown: number; started: number; completed: number };
  inputErrorsByComponent: { component: string; count: number; reasons: Ranked[] }[];
  statuses: Ranked[];
  actionsByCapability: Ranked[];
  abandonReasons: Ranked[];
  dismissReasons: Ranked[];
  bySource: ({ source: Source } & Measures)[];
  byActor: ({ actor: "human" | "agent" } & Measures)[];
  bySurface: { surface: string; shown: number; completed: number }[];
}

const sum = (rows: StoredRow[], type: string) => rows.reduce((n, r) => (r.type === type ? n + r.count : n), 0);

export function measures(rows: StoredRow[]): Measures {
  const shown = sum(rows, "surface.shown");
  const completed = sum(rows, "task.completed");
  const abandoned = sum(rows, "task.abandoned");
  const done = rows.filter((r) => r.type === "task.completed");
  const durationCount = done.reduce((n, r) => n + r.duration_count, 0);
  const buckets = BUCKETS.map((_, i) => done.reduce((n, r) => n + (r[`d${i}` as "d0"] ?? 0), 0));
  let median = "";
  for (let i = 0, seen = 0; i < buckets.length; i++) {
    seen += buckets[i];
    if (seen * 2 >= durationCount && durationCount) {
      median = BUCKET_LABELS[i];
      break;
    }
  }
  const fb = rows.filter((r) => r.type === "feedback");
  const ratingCount = fb.reduce((n, r) => n + r.rating_count, 0);
  return {
    shown,
    actions: sum(rows, "action.taken"),
    checkpoints: sum(rows, "checkpoint.reached"),
    completed,
    abandoned,
    dismissed: sum(rows, "surface.dismissed"),
    regenerated: sum(rows, "surface.regenerated"),
    inputErrors: sum(rows, "input.error"),
    statusShown: sum(rows, "status.shown"),
    undo: sum(rows, "undo"),
    // A screen with no task (an overview, a shell) never completes or abandons: it has no rate, not 0%.
    completionRate: shown && completed + abandoned ? Math.min(1, completed / shown) : null,
    time: durationCount ? { count: durationCount, meanMs: Math.round(done.reduce((n, r) => n + r.duration_sum, 0) / durationCount), median, buckets } : null,
    feedback: ratingCount ? { count: ratingCount, average: fb.reduce((n, r) => n + r.rating_sum, 0) / ratingCount } : null,
  };
}

/** Counts of one event type by one dimension, biggest first; empty values left out. */
function rank(rows: StoredRow[], type: string, dim: "component" | "capability" | "reason"): Ranked[] {
  const m = new Map<string, number>();
  for (const r of rows) if (r.type === type && r[dim]) m.set(r[dim], (m.get(r[dim]) ?? 0) + r.count);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

const distinct = <T extends string>(xs: T[]): T[] => [...new Set(xs.filter(Boolean))].sort();

function summary(intent: string, rows: StoredRow[]): IntentSummary {
  const errors = new Map<string, { component: string; reason: string; count: number }>();
  for (const r of rows) {
    if (r.type !== "input.error") continue;
    const k = `${r.component}\u0000${r.reason}`;
    const e = errors.get(k) ?? { component: r.component, reason: r.reason, count: 0 };
    e.count += r.count;
    errors.set(k, e);
  }
  return {
    intent,
    surfaces: distinct(rows.map((r) => r.surface)),
    patterns: distinct(rows.map((r) => r.pattern)),
    sources: distinct(rows.map((r) => r.source)),
    ...measures(rows),
    topInputErrors: [...errors.values()].sort((a, b) => b.count - a.count).slice(0, 3),
  };
}

const byIntent = (rows: StoredRow[]) => {
  const m = new Map<string, StoredRow[]>();
  for (const r of rows) m.set(r.intent, [...(m.get(r.intent) ?? []), r]);
  return m;
};

/** Every intent in the range, most shown first. */
export function summarise(rows: StoredRow[]): { totals: Measures; intents: IntentSummary[] } {
  const intents = [...byIntent(rows).entries()].map(([intent, rs]) => summary(intent, rs));
  intents.sort((a, b) => b.shown - a.shown || b.completed - a.completed || a.intent.localeCompare(b.intent));
  // The workspace's rate is over the intents that have a task, so an overview shown often doesn't pull it down.
  const tasked = intents.filter((i) => i.completionRate !== null);
  const totals = measures(rows);
  const shownTasked = tasked.reduce((n, i) => n + i.shown, 0);
  totals.completionRate = shownTasked ? Math.min(1, totals.completed / shownTasked) : null;
  return { totals, intents };
}

/** The UTC days from `from` to `to`, both included, as YYYY-MM-DD. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** One intent in detail: its days, funnel, errors, and the generated and authored screens side by side. */
export function detail(intent: string, rows: StoredRow[], from: string, to: string): IntentDetail {
  const mine = rows.filter((r) => r.intent === intent);
  const base = summary(intent, mine);
  const days = new Map(daysBetween(from, to).map((d) => [d, { day: d, shown: 0, completed: 0, abandoned: 0, inputErrors: 0 }]));
  for (const r of mine) {
    const d = days.get(r.day);
    if (!d) continue;
    if (r.type === "surface.shown") d.shown += r.count;
    else if (r.type === "task.completed") d.completed += r.count;
    else if (r.type === "task.abandoned") d.abandoned += r.count;
    else if (r.type === "input.error") d.inputErrors += r.count;
  }
  const components = rank(mine, "input.error", "component").map(({ key, count }) => ({ component: key, count, reasons: rank(mine.filter((r) => r.component === key), "input.error", "reason") }));
  const unkeyed = mine.filter((r) => r.type === "input.error" && !r.component).reduce((n, r) => n + r.count, 0);
  if (unkeyed) components.push({ component: "", count: unkeyed, reasons: rank(mine.filter((r) => !r.component), "input.error", "reason") });
  const split = <K extends "source" | "actor">(k: K) => distinct(mine.map((r) => r[k])).map((v) => ({ [k]: v, ...measures(mine.filter((r) => r[k] === v)) }) as { [P in K]: StoredRow[K] } & Measures);
  const surfaces = distinct(mine.map((r) => r.surface)).map((s) => ({ surface: s, shown: sum(mine.filter((r) => r.surface === s), "surface.shown"), completed: sum(mine.filter((r) => r.surface === s), "task.completed") }));
  return {
    ...base,
    series: [...days.values()],
    // task.abandoned needs an interaction, and task.completed is one: together, the sessions that got going.
    funnel: { shown: base.shown, started: Math.min(base.shown || Infinity, base.completed + base.abandoned), completed: base.completed },
    inputErrorsByComponent: components,
    statuses: rank(mine, "status.shown", "reason"),
    actionsByCapability: rank(mine, "action.taken", "capability"),
    abandonReasons: rank(mine, "task.abandoned", "reason"),
    dismissReasons: rank(mine, "surface.dismissed", "reason"),
    bySource: split("source"),
    byActor: split("actor"),
    bySurface: surfaces.sort((a, b) => b.shown - a.shown),
  };
}

/** The first and last day of a range ending today (UTC). */
export function range(days: number, today = new Date()): { from: string; to: string } {
  const to = today.toISOString().slice(0, 10);
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}
