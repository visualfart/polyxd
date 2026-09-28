/**
 * Stripe, through its REST API with fetch (no SDK: a form-encoded POST is all Checkout, the
 * Customer Portal and a seat change need). Checkout makes the subscription; the webhook is the
 * only thing that changes a workspace's plan. Prices and the founding coupon come from env, so
 * test mode and live mode differ only in configuration.
 */
import type { Env } from "./auth.ts";
import { billingOn, editorCount, overQuotaSince, periodOf, type Plan } from "./plans.ts";

export type Interval = "month" | "year";
export const stripeOn = (env: Env) => billingOn(env) && !!env.STRIPE_SECRET_KEY;

export class StripeError extends Error {
  status: number;
  code?: string;
  param?: string;
  constructor(status: number, message: string, code?: string, param?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.param = param;
  }
}

/** Stripe's form encoding: nested objects and lists as metadata[workspace_id], line_items[0][price]. */
export function form(params: Record<string, unknown>, into = new URLSearchParams(), prefix = ""): URLSearchParams {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" && item !== null ? form(item as Record<string, unknown>, into, `${key}[${i}]`) : into.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") form(v as Record<string, unknown>, into, key);
    else into.append(key, String(v));
  }
  return into;
}

export async function stripe<T = Record<string, unknown>>(env: Env, method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<T> {
  const encoded = params ? form(params).toString() : "";
  const url = `https://api.stripe.com/v1${path}${method === "GET" && encoded ? `?${encoded}` : ""}`;
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? encoded : undefined,
  });
  const data = (await r.json().catch(() => ({}))) as { error?: { message?: string; code?: string; param?: string } };
  if (!r.ok) throw new StripeError(r.status, data.error?.message ?? `Stripe answered ${r.status}`, data.error?.code, data.error?.param);
  return data as T;
}

export function priceFor(env: Env, plan: "pro" | "team", interval: Interval): string | undefined {
  return { pro: { month: env.STRIPE_PRICE_PRO_MONTH, year: env.STRIPE_PRICE_PRO_YEAR }, team: { month: env.STRIPE_PRICE_TEAM_MONTH, year: env.STRIPE_PRICE_TEAM_YEAR } }[plan][interval];
}

export function planOfPrice(env: Env, price: string): { plan: Plan; interval: Interval } | null {
  const table: [string | undefined, Plan, Interval][] = [
    [env.STRIPE_PRICE_PRO_MONTH, "pro", "month"],
    [env.STRIPE_PRICE_PRO_YEAR, "pro", "year"],
    [env.STRIPE_PRICE_TEAM_MONTH, "team", "month"],
    [env.STRIPE_PRICE_TEAM_YEAR, "team", "year"],
  ];
  const hit = table.find(([id]) => id && id === price);
  return hit ? { plan: hit[1], interval: hit[2] } : null;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Stripe-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.payload">[,v1=…]. Checked with Web
 * Crypto against the endpoint's secret, compared in constant time, and refused when older than
 * the tolerance so a captured request can't be replayed later.
 */
export async function verifySignature(payload: string, header: string | undefined, secret: string, tolerance = 300, nowSec = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !sigs.length || Math.abs(nowSec - t) > tolerance) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  return sigs.some((s) => {
    if (s.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

/** Signs a payload as Stripe would, for tests and for trying the webhook locally. */
export async function signPayload(payload: string, secret: string, t = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `t=${t},v1=${hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)))}`;
}

export interface Subscription {
  id: string;
  customer: string;
  status: string;
  metadata?: Record<string, string>;
  current_period_end?: number;
  items: { data: { id: string; quantity?: number; current_period_end?: number; price: { id: string } }[] };
}

/** Statuses in which the workspace has what it pays for. past_due keeps it while Stripe retries. */
const PAYING = new Set(["active", "trialing", "past_due"]);

/**
 * A subscription as Stripe describes it, onto its workspace: the plan from its price, the status,
 * the interval, the seats and the end of the period. A subscription that has ended puts the
 * workspace back on Free, unless the workspace has since moved to another one.
 */
export async function applySubscription(env: Env, sub: Subscription, workspaceId?: string, ended = false): Promise<string | null> {
  const id =
    workspaceId ??
    sub.metadata?.workspace_id ??
    (await env.DB.prepare("SELECT id FROM workspaces WHERE stripe_subscription_id = ?").bind(sub.id).first<{ id: string }>())?.id ??
    (await env.DB.prepare("SELECT id FROM workspaces WHERE stripe_customer_id = ?").bind(sub.customer).first<{ id: string }>())?.id;
  if (!id) {
    console.error(`Stripe subscription ${sub.id} matches no workspace`);
    return null;
  }
  const w = await env.DB.prepare("SELECT id, plan, stripe_subscription_id, over_quota_since FROM workspaces WHERE id = ?").bind(id).first<{ id: string; plan: string; stripe_subscription_id: string | null; over_quota_since: string | null }>();
  if (!w) return null;
  if (w.stripe_subscription_id && w.stripe_subscription_id !== sub.id && (ended || !PAYING.has(sub.status))) return id;
  const item = sub.items?.data?.[0];
  const priced = item ? planOfPrice(env, item.price.id) : null;
  if (!ended && PAYING.has(sub.status) && !priced) {
    console.error(`Stripe subscription ${sub.id} has price ${item?.price.id}, which no STRIPE_PRICE_* names`);
    return null;
  }
  const paying = !ended && PAYING.has(sub.status) && priced;
  // An enterprise workspace is set by hand and stays so whatever Stripe says.
  const plan = w.plan === "enterprise" ? "enterprise" : paying ? priced.plan : "free";
  const end = sub.current_period_end ?? item?.current_period_end;
  const fetches = (await env.DB.prepare("SELECT count FROM usage WHERE workspace_id = ? AND metric = 'fetches' AND period = ?").bind(id, periodOf(new Date())).first<{ count: number }>())?.count ?? 0;
  await env.DB.prepare(
    "UPDATE workspaces SET plan = ?, plan_status = ?, billing_interval = ?, seats = ?, stripe_customer_id = ?, stripe_subscription_id = ?, period_end = ?, over_quota_since = ? WHERE id = ?",
  ).bind(
    plan,
    ended ? "canceled" : sub.status,
    paying ? priced.interval : null,
    paying ? (item?.quantity ?? 1) : null,
    sub.customer,
    ended ? null : sub.id,
    paying && end ? new Date(end * 1000).toISOString() : null,
    overQuotaSince(plan, fetches, w.over_quota_since, new Date()),
    id,
  ).run();
  return id;
}

/**
 * Team is billed per editor: after someone joins or leaves in an editor role, the subscription's
 * quantity follows, prorated. Never throws; a failed sync is logged and the next change retries.
 */
export async function syncSeats(env: Env, workspaceId: string): Promise<void> {
  if (!stripeOn(env)) return;
  try {
    const w = await env.DB.prepare("SELECT plan, stripe_subscription_id FROM workspaces WHERE id = ?").bind(workspaceId).first<{ plan: string; stripe_subscription_id: string | null }>();
    if (!w?.stripe_subscription_id || w.plan !== "team") return;
    const seats = Math.max(1, await editorCount(env, workspaceId));
    const sub = await stripe<Subscription>(env, "GET", `/subscriptions/${w.stripe_subscription_id}`);
    const item = sub.items.data[0];
    if (!item || item.quantity === seats) return;
    await stripe(env, "POST", `/subscription_items/${item.id}`, { quantity: seats, proration_behavior: "create_prorations" });
    await env.DB.prepare("UPDATE workspaces SET seats = ? WHERE id = ?").bind(seats, workspaceId).run();
  } catch (e) {
    console.error(`seat sync for ${workspaceId}`, e);
  }
}

/** The Checkout parameters for a plan: Team's quantity is the editor count, Pro's is one. */
export function checkoutParams(env: Env, o: { workspaceId: string; slug: string; plan: "pro" | "team"; interval: Interval; seats: number; customer: string | null; email: string; coupon: boolean }) {
  return {
    mode: "subscription",
    line_items: [{ price: priceFor(env, o.plan, o.interval), quantity: o.plan === "team" ? Math.max(1, o.seats) : 1 }],
    client_reference_id: o.workspaceId,
    metadata: { workspace_id: o.workspaceId },
    subscription_data: { metadata: { workspace_id: o.workspaceId } },
    ...(o.customer ? { customer: o.customer } : { customer_email: o.email }),
    ...(o.coupon && env.STRIPE_COUPON_FOUNDING ? { discounts: [{ coupon: env.STRIPE_COUPON_FOUNDING }] } : { allow_promotion_codes: true }),
    success_url: `${env.APP_URL}/w/${o.slug}/billing?upgraded=1`,
    cancel_url: `${env.APP_URL}/w/${o.slug}/billing`,
  };
}

export const isPaidPlan = (p: unknown): p is "pro" | "team" => p === "pro" || p === "team";
