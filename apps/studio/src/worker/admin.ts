/**
 * Support, for the people who run this Studio. A super admin can find any workspace or person,
 * set a workspace's plan by hand (a comp, a design partner, an enterprise deal invoiced outside
 * Stripe), hand a workspace to a new owner when the old one has gone, take someone out of a
 * workspace, and read what Stripe says about a customer.
 *
 * Who counts as one is the SUPER_ADMINS secret, a list of email addresses, checked against the
 * signed-in user on every request. It is never a column, so no amount of editing the database
 * grants it. Nothing here writes to Stripe: a plan set by hand and a subscription are separate
 * things, and the webhook leaves `enterprise` alone (billing.ts).
 */
import type { Env, User } from "./auth.ts";
import { stripe, stripeOn } from "./billing.ts";
import { PLANS, planSummary, type Plan } from "./plans.ts";

export const superAdmins = (env: Env): Set<string> =>
  new Set(
    (env.SUPER_ADMINS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

export const isSuperAdmin = (env: Env, user: User | null): boolean => !!user && superAdmins(env).has(user.email.toLowerCase());

export const isPlan = (p: unknown): p is Plan => typeof p === "string" && (PLANS as readonly string[]).includes(p);

/** What changed, who changed it and why. Written before the answer, so a failure is visible. */
export async function audit(
  env: Env,
  adminEmail: string,
  action: string,
  o: { workspaceId?: string | null; userId?: string | null; before?: unknown; after?: unknown; note?: string | null },
): Promise<void> {
  await env.DB.prepare("INSERT INTO admin_actions (id, at, admin_email, action, workspace_id, user_id, before, after, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      adminEmail.toLowerCase(),
      action,
      o.workspaceId ?? null,
      o.userId ?? null,
      o.before === undefined ? null : JSON.stringify(o.before),
      o.after === undefined ? null : JSON.stringify(o.after),
      o.note?.trim() || null,
    )
    .run();
}

export interface AdminWorkspace {
  id: string;
  slug: string;
  name: string;
  plan: string;
  plan_status: string | null;
  seats: number | null;
  stripe_customer_id: string | null;
  created_at: string;
  owner_email: string | null;
  members: number;
}

/** Workspaces by slug, name or the owner's email; the newest first when nothing is searched for. */
export async function searchWorkspaces(env: Env, q: string, limit = 50): Promise<AdminWorkspace[]> {
  const like = `%${q.trim().toLowerCase()}%`;
  const where = q.trim() ? "WHERE lower(w.slug) LIKE ?1 OR lower(w.name) LIKE ?1 OR lower(o.email) LIKE ?1" : "";
  const sql = `SELECT w.id, w.slug, w.name, w.plan, w.plan_status, w.seats, w.stripe_customer_id, w.created_at,
      o.email AS owner_email,
      (SELECT COUNT(*) FROM memberships m WHERE m.workspace_id = w.id) AS members
    FROM workspaces w
    LEFT JOIN memberships mo ON mo.workspace_id = w.id AND mo.role = 'owner'
    LEFT JOIN user o ON o.id = mo.user_id
    ${where}
    ORDER BY w.created_at DESC LIMIT ${Math.min(Math.max(limit, 1), 200)}`;
  const stmt = q.trim() ? env.DB.prepare(sql).bind(like) : env.DB.prepare(sql);
  return (await stmt.all<AdminWorkspace>()).results;
}

export async function searchUsers(env: Env, q: string, limit = 50) {
  const like = `%${q.trim().toLowerCase()}%`;
  const where = q.trim() ? "WHERE lower(u.email) LIKE ?1 OR lower(u.name) LIKE ?1" : "";
  const sql = `SELECT u.id, u.email, u.name, u.emailVerified, u.createdAt,
      (SELECT COUNT(*) FROM memberships m WHERE m.user_id = u.id) AS workspaces
    FROM user u ${where} ORDER BY u.createdAt DESC LIMIT ${Math.min(Math.max(limit, 1), 200)}`;
  const stmt = q.trim() ? env.DB.prepare(sql).bind(like) : env.DB.prepare(sql);
  return (await stmt.all<{ id: string; email: string; name: string; emailVerified: number; createdAt: string; workspaces: number }>()).results;
}

/** One workspace as support needs it: who is in it, what it uses, and what Stripe says. */
export async function workspaceDetail(env: Env, id: string) {
  const w = await env.DB.prepare("SELECT id, slug, name, plan, plan_status, billing_interval, seats, stripe_customer_id, stripe_subscription_id, period_end, created_at FROM workspaces WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!w) return null;
  const members = (
    await env.DB.prepare(
      "SELECT m.user_id AS id, m.role, m.created_at, u.email, u.name FROM memberships m JOIN user u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.email",
    )
      .bind(id)
      .all<{ id: string; role: string; created_at: string; email: string; name: string }>()
  ).results;
  const invites = (
    await env.DB.prepare("SELECT id, email, role, created_at, expires_at FROM invites WHERE workspace_id = ? AND accepted_at IS NULL ORDER BY created_at DESC")
      .bind(id)
      .all<{ id: string; email: string; role: string; created_at: string; expires_at: string }>()
  ).results;
  return {
    workspace: w,
    members,
    invites,
    usage: await planSummary(env, id),
    stripe: await stripeSnapshot(env, w.stripe_customer_id as string | null),
  };
}

/**
 * What Stripe holds for this customer, read only: the subscription and the last few invoices, so a
 * question about a charge can be answered without leaving Studio. Any failure is reported as text
 * rather than thrown: support should still see the rest of the page.
 */
export async function stripeSnapshot(env: Env, customerId: string | null) {
  if (!customerId) return { customer: null as string | null, subscriptions: [], invoices: [], error: null as string | null };
  if (!stripeOn(env)) return { customer: customerId, subscriptions: [], invoices: [], error: "Stripe isn't set up on this Studio" };
  try {
    const subs = await stripe<{ data: { id: string; status: string; cancel_at_period_end?: boolean; items: { data: { quantity?: number; price: { id: string; nickname?: string | null; unit_amount?: number | null; currency?: string } }[] } }[] }>(
      env,
      "GET",
      "/subscriptions",
      { customer: customerId, status: "all", limit: 5 },
    );
    const invoices = await stripe<{ data: { id: string; number?: string | null; status?: string | null; total: number; currency: string; created: number; hosted_invoice_url?: string | null }[] }>(
      env,
      "GET",
      "/invoices",
      { customer: customerId, limit: 10 },
    );
    return {
      customer: customerId,
      subscriptions: subs.data.map((s) => ({
        id: s.id,
        status: s.status,
        cancelAtPeriodEnd: !!s.cancel_at_period_end,
        quantity: s.items.data[0]?.quantity ?? null,
        price: s.items.data[0]?.price.id ?? null,
        amount: s.items.data[0]?.price.unit_amount ?? null,
        currency: s.items.data[0]?.price.currency ?? null,
      })),
      invoices: invoices.data.map((i) => ({ id: i.id, number: i.number ?? null, status: i.status ?? null, total: i.total, currency: i.currency, created: new Date(i.created * 1000).toISOString(), url: i.hosted_invoice_url ?? null })),
      error: null,
    };
  } catch (e) {
    return { customer: customerId, subscriptions: [], invoices: [], error: e instanceof Error ? e.message : "Stripe didn't answer" };
  }
}

/** How many workspaces sit on each plan, and how many people there are: the numbers on the front page. */
export async function overview(env: Env) {
  const plans = (await env.DB.prepare("SELECT plan, COUNT(*) AS n FROM workspaces GROUP BY plan").all<{ plan: string; n: number }>()).results;
  const one = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())?.n ?? 0;
  return {
    plans: Object.fromEntries(plans.map((p) => [p.plan, p.n])),
    workspaces: await one("SELECT COUNT(*) AS n FROM workspaces"),
    users: await one("SELECT COUNT(*) AS n FROM user"),
    subscribed: await one("SELECT COUNT(*) AS n FROM workspaces WHERE stripe_subscription_id IS NOT NULL"),
    overQuota: await one("SELECT COUNT(*) AS n FROM workspaces WHERE over_quota_since IS NOT NULL"),
  };
}

export async function recentActions(env: Env, limit = 50) {
  return (
    await env.DB.prepare(
      `SELECT a.*, w.slug AS workspace_slug FROM admin_actions a LEFT JOIN workspaces w ON w.id = a.workspace_id
       ORDER BY a.at DESC LIMIT ${Math.min(Math.max(limit, 1), 200)}`,
    ).all<Record<string, unknown>>()
  ).results;
}
