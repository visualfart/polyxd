/**
 * Plans and their limits (docs/decisions/0004-pricing-and-licensing.md), in one table, and the
 * checks the routes make against it. None of it applies unless BILLING is "on", which only the
 * hosted Studio sets: a self-hosted Studio, free under its licence, has no limits at all.
 *
 * Hard limits (editors, design systems, Directions, published screens, workspaces owned) only
 * stop something new being made. Fetches are soft: going over never breaks a product; after
 * seven days over, editing is locked until the workspace upgrades, and fetches carry on.
 */
import type { Env } from "./auth.ts";

export const PLANS = ["free", "pro", "team", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

/** null is unlimited. */
export interface Limits {
  workspaces: number | null;
  editors: number | null;
  designSystems: number | null;
  directions: number | null;
  publishedScreens: number | null;
  fetches: number | null;
  /** Versions kept per screen, Direction or design system; the published one is always kept. */
  history: number | null;
  privateMcp: boolean;
  approvals: boolean;
  sharedLibraries: boolean;
}

export const LIMITS: Record<Plan, Limits> = {
  free: { workspaces: 1, editors: 2, designSystems: 1, directions: 1, publishedScreens: 10, fetches: 10_000, history: 10, privateMcp: false, approvals: false, sharedLibraries: false },
  pro: { workspaces: 3, editors: 1, designSystems: null, directions: null, publishedScreens: null, fetches: 250_000, history: null, privateMcp: true, approvals: false, sharedLibraries: false },
  team: { workspaces: null, editors: null, designSystems: null, directions: null, publishedScreens: null, fetches: 1_000_000, history: null, privateMcp: true, approvals: true, sharedLibraries: true },
  enterprise: { workspaces: null, editors: null, designSystems: null, directions: null, publishedScreens: null, fetches: 10_000_000, history: null, privateMcp: true, approvals: true, sharedLibraries: true },
};

/** Dollars, for the app to show; Stripe's prices are the ones charged. Team is per editor. */
export const PRICES = { pro: { month: 8, year: 80 }, team: { month: 12, year: 120 } } as const;
export const PLAN_NAMES: Record<Plan, string> = { free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise" };

/** Days a workspace may stay over its fetch quota before editing locks. */
export const GRACE_DAYS = 7;

export const billingOn = (env: Env) => env.BILLING === "on";
export const isPlan = (p: unknown): p is Plan => typeof p === "string" && (PLANS as readonly string[]).includes(p);
export const limitsFor = (plan: string): Limits => LIMITS[isPlan(plan) ? plan : "free"];
/** Viewers are free; every other role takes a seat. */
export const isEditor = (role: string) => role !== "viewer";
/** 'YYYY-MM' in UTC: the period usage is counted in. */
export const periodOf = (d: Date) => d.toISOString().slice(0, 7);

/** A 402 the app turns into an upgrade prompt. */
export class PlanLimit extends Error {
  status = 402;
  data: { code: "plan_limit" | "over_quota"; limit: string; plan: string; current?: number; max?: number | null };
  constructor(message: string, data: PlanLimit["data"]) {
    super(message);
    this.data = data;
  }
}

export interface PlanWorkspace {
  id: string;
  plan: string;
  over_quota_since: string | null;
}

/** People in editor roles, and (with invites) the editor invites still open, which hold a seat too. */
export async function editorCount(env: Env, workspaceId: string, withInvites = false): Promise<number> {
  const r = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM memberships WHERE workspace_id = ? AND role != 'viewer') AS members,
       (SELECT COUNT(*) FROM invites WHERE workspace_id = ? AND role != 'viewer' AND accepted_at IS NULL AND expires_at > ?) AS invited`,
  ).bind(workspaceId, workspaceId, new Date().toISOString()).first<{ members: number; invited: number }>();
  return (r?.members ?? 0) + (withInvites ? (r?.invited ?? 0) : 0);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const upgrade = (plan: string) => (plan === "free" ? "Upgrade to Pro or Team for more." : plan === "pro" ? "Team has no limit." : "");

export type Creatable =
  | { kind: "workspace"; userId: string }
  | { kind: "editors"; adding: number; pending: boolean }
  | { kind: "designSystem" }
  | { kind: "direction" }
  | { kind: "publishedScreen"; screenId: string };

/**
 * Throws a 402 when the workspace's plan has no room for one more of something. Workspaces are
 * counted per owner: the most generous plan among the workspaces a person owns sets how many
 * they may own (a Free person owns one).
 */
export async function assertCanCreate(env: Env, w: PlanWorkspace | null, what: Creatable): Promise<void> {
  if (!billingOn(env)) return;
  const fail = (limit: keyof Limits, plan: string, current: number, max: number, words: string) => {
    throw new PlanLimit(`${PLAN_NAMES[isPlan(plan) ? plan : "free"]} has room for ${words}. ${upgrade(plan)}`.trim(), { code: "plan_limit", limit, plan, current, max });
  };
  if (what.kind === "workspace") {
    const owned = await env.DB.prepare("SELECT w.plan FROM workspaces w JOIN memberships m ON m.workspace_id = w.id WHERE m.user_id = ? AND m.role = 'owner'").bind(what.userId).all<{ plan: string }>();
    const allowances = owned.results.map((r) => limitsFor(r.plan).workspaces);
    const max = allowances.includes(null) ? null : Math.max(LIMITS.free.workspaces!, ...(allowances as number[]));
    const best = owned.results.reduce<string>((b, r) => (PLANS.indexOf(r.plan as Plan) > PLANS.indexOf(b as Plan) ? r.plan : b), "free");
    if (max !== null && owned.results.length >= max) fail("workspaces", best, owned.results.length, max, `${plural(max, "workspace")} of your own`);
    return;
  }
  if (!w) return;
  const limits = limitsFor(w.plan);
  if (what.kind === "editors") {
    if (limits.editors === null) return;
    const current = await editorCount(env, w.id, what.pending);
    if (current + what.adding > limits.editors) fail("editors", w.plan, current, limits.editors, `${plural(limits.editors, "editor")} (viewers are free)`);
    return;
  }
  const count = async (sql: string, ...args: string[]) => (await env.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0;
  if (what.kind === "designSystem" && limits.designSystems !== null) {
    const n = await count("SELECT COUNT(*) AS n FROM design_systems WHERE workspace_id = ?", w.id);
    if (n >= limits.designSystems) fail("designSystems", w.plan, n, limits.designSystems, plural(limits.designSystems, "design system"));
  }
  if (what.kind === "direction" && limits.directions !== null) {
    const n = await count("SELECT COUNT(*) AS n FROM directions WHERE workspace_id = ?", w.id);
    if (n >= limits.directions) fail("directions", w.plan, n, limits.directions, plural(limits.directions, "Direction"));
  }
  if (what.kind === "publishedScreen" && limits.publishedScreens !== null) {
    // Publishing a new version of a screen that is already published adds nothing.
    const n = await count("SELECT COUNT(*) AS n FROM screens WHERE workspace_id = ? AND status = 'published' AND id != ?", w.id, what.screenId);
    if (n >= limits.publishedScreens) fail("publishedScreens", w.plan, n, limits.publishedScreens, plural(limits.publishedScreens, "published screen"));
  }
}

/** When the grace period ends for a workspace over its fetch quota, or null. */
export const lockedFrom = (w: PlanWorkspace): Date | null => (w.over_quota_since ? new Date(Date.parse(w.over_quota_since) + GRACE_DAYS * 86400e3) : null);

/** Throws a 402 once a workspace has been over its fetch quota for longer than the grace period. */
export function assertCanEdit(env: Env, w: PlanWorkspace, at = new Date()): void {
  if (!billingOn(env)) return;
  const from = lockedFrom(w);
  if (from && from <= at) {
    throw new PlanLimit(`This workspace has been over its monthly fetches for more than ${GRACE_DAYS} days, so editing is paused. Products still get their screens. Upgrade to edit again.`, { code: "over_quota", limit: "fetches", plan: w.plan });
  }
}

/**
 * Keeps a Free workspace's history to its last versions, the published or live one always among
 * those kept. Returns the ids removed, so a design system's files can go too.
 */
export async function pruneHistory(env: Env, w: PlanWorkspace, table: "screen_versions" | "direction_versions" | "ds_versions", parentId: string): Promise<string[]> {
  const keep = limitsFor(w.plan).history;
  if (!billingOn(env) || keep === null) return [];
  const parent = table === "screen_versions" ? "screen_id" : table === "direction_versions" ? "direction_id" : "design_system_id";
  const old = await env.DB.prepare(
    `SELECT id FROM ${table} WHERE ${parent} = ? AND status NOT IN ('published', 'live')
       AND number NOT IN (SELECT number FROM ${table} WHERE ${parent} = ? ORDER BY number DESC LIMIT ?)`,
  ).bind(parentId, parentId, keep).all<{ id: string }>();
  const ids = old.results.map((r) => r.id);
  if (ids.length) await env.DB.batch(ids.map((id) => env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id)));
  return ids;
}

// ---------------------------------------------------------------- fetch metering

export const FETCH_DATASET = "polyxd_studio_fetches";

/**
 * Counts one fetch by key (a screen, a Direction, a design system's tokens). One Analytics Engine
 * data point, written without waiting and never to D1; the rollup below adds them up.
 */
export function countFetch(env: Env, workspaceId: string, kind: "screen" | "direction" | "tokens"): void {
  if (!billingOn(env) || !env.FETCHES) return;
  try {
    env.FETCHES.writeDataPoint({ indexes: [workspaceId], blobs: [kind], doubles: [1] });
  } catch (e) {
    console.error("fetch metering", e);
  }
}

const sqlTime = (d: Date) => `toDateTime('${d.toISOString().slice(0, 19).replace("T", " ")}')`;

/** A month's fetches per workspace, read back from Analytics Engine's SQL API. */
export async function readFetches(env: Env, period: string): Promise<Map<string, number>> {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}` },
    // _sample_interval: Analytics Engine may sample at volume; each point stands for that many.
    body: `SELECT index1 AS workspace, SUM(_sample_interval) AS fetches FROM ${FETCH_DATASET} WHERE timestamp >= ${sqlTime(from)} AND timestamp < ${sqlTime(to)} GROUP BY index1`,
  });
  if (!r.ok) throw new Error(`Analytics Engine answered ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const body = (await r.json()) as { data?: { workspace: string; fetches: number | string }[] };
  return new Map((body.data ?? []).map((row) => [row.workspace, Math.round(Number(row.fetches))]));
}

/** Whether a count is over a plan's fetches, and so what over_quota_since should become. */
export const overQuotaSince = (plan: string, count: number, since: string | null, at: Date): string | null => {
  const limit = limitsFor(plan).fetches;
  return limit !== null && count > limit ? (since ?? at.toISOString()) : null;
};

/**
 * The scheduled rollup: this month's (and last month's, which may still be settling) fetches into
 * `usage`, as totals so a run can repeat safely, and over_quota_since set or cleared from this
 * month's. A new month starts from zero, so a lock lifts on the first of the month too.
 * TODO: email owners at 80% and 100% (the Billing page shows both already).
 */
export async function rollUp(env: Env, at = new Date()): Promise<{ workspaces: number; over: number }> {
  if (!billingOn(env) || !env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) return { workspaces: 0, over: 0 };
  const period = periodOf(at);
  const previous = periodOf(new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - 1, 1)));
  const stamp = at.toISOString();
  const statements: D1PreparedStatement[] = [];
  const known = new Set((await env.DB.prepare("SELECT id FROM workspaces").all<{ id: string }>()).results.map((r) => r.id));
  let current = new Map<string, number>();
  for (const p of [previous, period]) {
    const counts = await readFetches(env, p);
    if (p === period) current = counts;
    for (const [id, n] of counts) {
      if (!known.has(id)) continue;
      statements.push(env.DB.prepare("INSERT INTO usage (workspace_id, metric, period, count, updated_at) VALUES (?, 'fetches', ?, ?, ?) ON CONFLICT (workspace_id, metric, period) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at").bind(id, p, n, stamp));
    }
  }
  const rows = await env.DB.prepare("SELECT id, plan, over_quota_since FROM workspaces").all<PlanWorkspace>();
  let over = 0;
  for (const w of rows.results) {
    const next = overQuotaSince(w.plan, current.get(w.id) ?? 0, w.over_quota_since, at);
    if (next) over++;
    if (next !== w.over_quota_since) statements.push(env.DB.prepare("UPDATE workspaces SET over_quota_since = ? WHERE id = ?").bind(next, w.id));
  }
  for (let i = 0; i < statements.length; i += 100) await env.DB.batch(statements.slice(i, i + 100));
  return { workspaces: current.size, over };
}

// ---------------------------------------------------------------- what the app shows

export interface BillingRow extends PlanWorkspace {
  plan_status: string | null;
  billing_interval: string | null;
  seats: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  period_end: string | null;
}

/** A workspace's plan, its limits and how much of each it uses, for the Billing page. */
export async function planSummary(env: Env, workspaceId: string, at = new Date()) {
  const w = await env.DB.prepare("SELECT id, plan, plan_status, billing_interval, seats, stripe_customer_id, stripe_subscription_id, period_end, over_quota_since FROM workspaces WHERE id = ?").bind(workspaceId).first<BillingRow>();
  if (!w) throw new Error("no such workspace");
  const n = async (sql: string) => (await env.DB.prepare(sql).bind(workspaceId).first<{ n: number }>())?.n ?? 0;
  const usage = {
    editors: await editorCount(env, workspaceId),
    pendingEditors: (await editorCount(env, workspaceId, true)) - (await editorCount(env, workspaceId)),
    viewers: await n("SELECT COUNT(*) AS n FROM memberships WHERE workspace_id = ? AND role = 'viewer'"),
    designSystems: await n("SELECT COUNT(*) AS n FROM design_systems WHERE workspace_id = ?"),
    directions: await n("SELECT COUNT(*) AS n FROM directions WHERE workspace_id = ?"),
    publishedScreens: await n("SELECT COUNT(*) AS n FROM screens WHERE workspace_id = ? AND status = 'published'"),
    fetches: (await env.DB.prepare("SELECT count FROM usage WHERE workspace_id = ? AND metric = 'fetches' AND period = ?").bind(workspaceId, periodOf(at)).first<{ count: number }>())?.count ?? 0,
  };
  const limits = limitsFor(w.plan);
  const locked = lockedFrom(w);
  return {
    enabled: true as const,
    plan: isPlan(w.plan) ? w.plan : "free",
    status: w.plan_status,
    interval: w.billing_interval,
    seats: w.seats,
    periodEnd: w.period_end,
    subscribed: !!w.stripe_subscription_id,
    customer: !!w.stripe_customer_id,
    limits,
    usage,
    period: periodOf(at),
    fetchesPercent: limits.fetches ? Math.round((usage.fetches / limits.fetches) * 100) : null,
    overQuotaSince: w.over_quota_since,
    lockedFrom: locked?.toISOString() ?? null,
    locked: !!locked && locked <= at,
    prices: PRICES,
    founding: !!env.STRIPE_COUPON_FOUNDING,
    checkout: !!env.STRIPE_SECRET_KEY,
  };
}
