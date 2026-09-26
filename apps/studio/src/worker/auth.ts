/**
 * Who is asking. A session cookie for people; a workspace API key for `polyxd studio push`.
 *
 * Sign-in providers: `dev` (email only, local development, DEV_AUTH=1) and WorkOS AuthKit for
 * production, which covers email + password, Google, and SSO for customers that need it. The
 * WorkOS flow here follows their User Management API; confirm the endpoint paths against the
 * WorkOS docs before enabling it.
 */
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sha256 } from "./crypto.ts";

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  APP_URL: string;
  DEV_AUTH?: string;
  SECRETS_KEY?: string;
  WORKOS_CLIENT_ID?: string;
  WORKOS_API_KEY?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export type Ctx = Context<{ Bindings: Env; Variables: { user: User | null; apiWorkspace: string | null } }>;

export const now = () => new Date().toISOString();
const days = (n: number) => new Date(Date.now() + n * 86400e3).toISOString();

export async function userFromRequest(c: Ctx): Promise<{ user: User | null; apiWorkspace: string | null }> {
  const bearer = c.req.header("authorization")?.match(/^Bearer (pxs_[a-f0-9]+)$/)?.[1];
  if (bearer) {
    const hash = await sha256(bearer);
    const key = await c.env.DB.prepare("SELECT id, workspace_id, created_by FROM api_keys WHERE key_hash = ?").bind(hash).first<{ id: string; workspace_id: string; created_by: string }>();
    if (!key) return { user: null, apiWorkspace: null };
    await c.env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(now(), key.id).run();
    const user = await c.env.DB.prepare("SELECT id, email, name FROM users WHERE id = ?").bind(key.created_by).first<User>();
    return { user, apiWorkspace: key.workspace_id };
  }
  const sid = getCookie(c, SID(c.env));
  if (!sid) return { user: null, apiWorkspace: null };
  const user = await c.env.DB.prepare(
    "SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?",
  ).bind(sid, now()).first<User>();
  return { user, apiWorkspace: null };
}

export async function upsertUser(db: D1Database, email: string, name: string): Promise<User> {
  const e = email.trim().toLowerCase();
  const existing = await db.prepare("SELECT id, email, name FROM users WHERE email = ?").bind(e).first<User>();
  if (existing) {
    if (name && !existing.name) await db.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, existing.id).run();
    return { ...existing, name: existing.name || name };
  }
  const user = { id: crypto.randomUUID(), email: e, name: name.trim() };
  await db.prepare("INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)").bind(user.id, user.email, user.name, now()).run();
  return user;
}

const secure = (env: Env) => env.APP_URL.startsWith("https");
const SID = (env: Env) => (secure(env) ? "__Host-sid" : "sid");

export async function startSession(c: Ctx, user: User): Promise<void> {
  // Whatever session the browser had ends first, so a sign-in can't be planted on top of one.
  await endSession(c);
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(id, user.id, days(30)).run();
  setCookie(c, SID(c.env), id, { httpOnly: true, sameSite: "Lax", secure: secure(c.env), path: "/", maxAge: 30 * 86400 });
}

export async function endSession(c: Ctx): Promise<void> {
  const sid = getCookie(c, SID(c.env));
  if (sid) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  deleteCookie(c, SID(c.env), { path: "/" });
}

export function workosStartUrl(env: Env, state: string): string | null {
  if (!env.WORKOS_CLIENT_ID) return null;
  const q = new URLSearchParams({ response_type: "code", client_id: env.WORKOS_CLIENT_ID, redirect_uri: `${env.APP_URL}/api/auth/workos/callback`, provider: "authkit", state });
  return `https://api.workos.com/user_management/authorize?${q}`;
}

/** A one-time value that ties the callback to the browser that started sign-in. */
export function rememberState(c: Ctx): string {
  const state = crypto.randomUUID();
  setCookie(c, "oauth_state", state, { httpOnly: true, sameSite: "Lax", secure: c.env.APP_URL.startsWith("https"), path: "/api/auth", maxAge: 600 });
  return state;
}

export function takeState(c: Ctx): string | undefined {
  const s = getCookie(c, "oauth_state");
  deleteCookie(c, "oauth_state", { path: "/api/auth" });
  return s;
}

export async function workosExchange(env: Env, code: string): Promise<{ email: string; name: string }> {
  const r = await fetch("https://api.workos.com/user_management/authenticate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: env.WORKOS_CLIENT_ID, client_secret: env.WORKOS_API_KEY, grant_type: "authorization_code", code }),
  });
  if (!r.ok) throw new Error(`WorkOS refused the code (${r.status})`);
  const j = (await r.json()) as { user: { email: string; email_verified?: boolean; first_name?: string; last_name?: string } };
  if (j.user.email_verified === false) throw new Error("Verify your email with your sign-in provider first");
  return { email: j.user.email, name: [j.user.first_name, j.user.last_name].filter(Boolean).join(" ") };
}
