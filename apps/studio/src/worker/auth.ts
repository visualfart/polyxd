/**
 * Who is asking. People sign in through better-auth (open source, running in this Worker on D1):
 * email and password with verification, password reset, Google when a client is configured, and
 * later two-step verification and SAML/OIDC single sign-on through its plugins. `polyxd studio
 * push` uses a workspace API key instead.
 */
import type { Context } from "hono";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { D1Dialect } from "kysely-d1";
import { sha256 } from "./crypto.ts";
import type { AnalyticsEnv } from "./analytics.ts";

export interface Env extends AnalyticsEnv {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  APP_URL: string;
  /** Signs sessions and tokens. Any long random string; set with `wrangler secret put`. */
  AUTH_SECRET?: string;
  SECRETS_KEY?: string;
  /** Sends verification, reset and invite emails when set; otherwise links are logged (dev). */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /**
   * "on" only on the hosted Studio: plans, limits, fetch metering and Stripe (src/worker/plans.ts,
   * billing.ts). Unset, as on every self-hosted Studio, there are no limits and no billing.
   */
  BILLING?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO_MONTH?: string;
  STRIPE_PRICE_PRO_YEAR?: string;
  STRIPE_PRICE_TEAM_MONTH?: string;
  STRIPE_PRICE_TEAM_YEAR?: string;
  /** The founding offer: a coupon at 50% off, forever, for at most 100 redemptions. */
  STRIPE_COUPON_FOUNDING?: string;
  /** Workers Analytics Engine: one data point per fetch by key, rolled up by the cron. */
  FETCHES?: AnalyticsEngineDataset;
  /** For the rollup to read Analytics Engine back: the account, and a token with Account Analytics Read. */
  CF_ACCOUNT_ID?: string;
  CF_ANALYTICS_TOKEN?: string;
  /** Who may use /admin: email addresses, separated by commas. Never a column, so no row grants it. */
  SUPER_ADMINS?: string;
  /**
   * "closed" turns away new accounts, by email or Google, until the hosted Studio opens. People
   * who already have one still sign in. Unset, as on every self-hosted Studio, anyone may sign up.
   */
  SIGNUPS?: string;
  /** While sign-ups are closed, who may still make an account: email addresses, separated by commas. */
  SIGNUP_ALLOW?: string;
}

export const signupsOpen = (env: Env) => env.SIGNUPS !== "closed";

/** Whether this email may make a new account: always while sign-ups are open; while closed, only the listed, the super admins, and anyone with a pending invite. */
export async function maySignUp(env: Env, email: string): Promise<boolean> {
  if (signupsOpen(env)) return true;
  const e = email.trim().toLowerCase();
  const listed = `${env.SIGNUP_ALLOW ?? ""},${env.SUPER_ADMINS ?? ""}`.split(",").map((x) => x.trim().toLowerCase());
  if (listed.includes(e)) return true;
  const invite = await env.DB.prepare("SELECT 1 AS ok FROM invites WHERE lower(email) = ? AND accepted_at IS NULL AND expires_at > ?").bind(e, now()).first();
  return !!invite;
}

export const SIGNUPS_CLOSED = "Studio isn't open for new accounts yet. It's coming soon.";

export interface User {
  id: string;
  email: string;
  name: string;
}

export type Ctx = Context<{ Bindings: Env; Variables: { user: User | null; apiWorkspace: string | null } }>;

export const now = () => new Date().toISOString();
export const isLocal = (env: Env) => !env.APP_URL.startsWith("https");

/** An email through Resend, or to the log when no key is set. Never throws: a lost email is reported, not fatal. */
export async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email to ${to}] ${subject}\n${html.replace(/<[^>]+>/g, "")}`);
    return false;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM ?? "Polyxd Studio <studio@polyxd.com>", to, subject, html }),
  });
  if (!r.ok) console.error(`Resend answered ${r.status} for ${subject}`);
  return r.ok;
}

/**
 * One email, laid out the way email actually works: tables, inline styles, no web fonts and no
 * image that has to load before it makes sense. The mark is two squares drawn with table cells,
 * so it survives a blocked-images inbox. The site's paper, ink and signal orange.
 */
const EMAIL = { ground: "#F4F1EA", paper: "#FFFFFF", ink: "#141413", muted: "#5E5A52", line: "#E3DED2", signal: "#FF5A1F" };

/** "Hi Neel," reads better than "Hi," and better than the whole name; nothing at all is fine too. */
export const firstName = (name?: string | null): string => (name ?? "").trim().split(/\s+/)[0] ?? "";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function page(o: { title: string; body: string; name?: string | null; cta?: { text: string; url: string }; note?: string; preview?: string }): string {
  const hello = firstName(o.name);
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(o.title)}</title></head>
<body style="margin:0;padding:0;background:${EMAIL.ground};">
<div style="display:none;font-size:1px;color:${EMAIL.ground};max-height:0;overflow:hidden;">${escapeHtml(o.preview ?? o.body)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL.ground};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px;max-width:100%;">
<tr><td style="padding:0 0 20px 4px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="22" height="22" style="background:${EMAIL.signal};border-radius:6px;"></td>
    <td style="padding-left:10px;font-family:${font};font-size:17px;font-weight:700;color:${EMAIL.ink};letter-spacing:-0.02em;">polyxd <span style="font-weight:400;color:${EMAIL.muted};">Studio</span></td>
  </tr></table>
</td></tr>
<tr><td style="background:${EMAIL.paper};border:1px solid ${EMAIL.line};border-radius:16px;padding:32px;">
  <h1 style="margin:0 0 14px;font-family:${font};font-size:22px;line-height:1.25;font-weight:700;color:${EMAIL.ink};">${escapeHtml(o.title)}</h1>
  ${hello ? `<p style="margin:0 0 10px;font-family:${font};font-size:15px;line-height:1.55;color:${EMAIL.ink};">Hi ${escapeHtml(hello)},</p>` : ""}
  <p style="margin:0 0 24px;font-family:${font};font-size:15px;line-height:1.55;color:${EMAIL.ink};">${o.body}</p>
  ${o.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${EMAIL.signal};border-radius:999px;">
    <a href="${o.cta.url}" style="display:inline-block;padding:13px 26px;font-family:${font};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">${escapeHtml(o.cta.text)}</a>
  </td></tr></table>
  <p style="margin:20px 0 0;font-family:${font};font-size:12px;line-height:1.5;color:${EMAIL.muted};word-break:break-all;">Or paste this into your browser:<br><a href="${o.cta.url}" style="color:${EMAIL.muted};">${o.cta.url}</a></p>` : ""}
  ${o.note ? `<p style="margin:20px 0 0;font-family:${font};font-size:13px;line-height:1.5;color:${EMAIL.muted};">${o.note}</p>` : ""}
</td></tr>
<tr><td style="padding:18px 4px 0;font-family:${font};font-size:12px;line-height:1.5;color:${EMAIL.muted};">
  Polyxd Studio · <a href="https://polyxd.com" style="color:${EMAIL.muted};">polyxd.com</a><br>
  Interfaces that show up when you need them.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/**
 * One auth instance per request: the D1 binding is per request on Workers. `onSignUp` hears of
 * each new account, by its id and how it was made (the analytics' signed_up).
 */
export function makeAuth(env: Env, hooks: { onSignUp?: (userId: string, method: "email" | "google") => void } = {}) {
  const local = isLocal(env);
  return betterAuth({
    databaseHooks: {
      user: {
        create: {
          // Every new account comes through here, by email or Google, so this is the one place sign-ups close.
          before: async (user) => {
            if (!(await maySignUp(env, user.email))) throw new APIError("FORBIDDEN", { message: SIGNUPS_CLOSED });
          },
          after: async (user, ctx) => {
            try {
              hooks.onSignUp?.(user.id, /google|callback/.test(ctx?.path ?? "") ? "google" : "email");
            } catch {
              // Counting never stops a sign-up.
            }
          },
        },
      },
    },
    baseURL: env.APP_URL,
    basePath: "/api/auth",
    secret: env.AUTH_SECRET ?? (local ? "dev-only-not-a-secret-change-me" : undefined),
    trustedOrigins: [env.APP_URL],
    database: { dialect: new D1Dialect({ database: env.DB }), type: "sqlite" },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      // Locally, no email goes out, so a sign-up works without a click on a link.
      requireEmailVerification: !local,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(
          env,
          user.email,
          "Reset your Studio password",
          page({
            title: "Choose a new password",
            name: user.name,
            body: "Someone asked to reset the password for this email on Polyxd Studio.",
            cta: { text: "Reset password", url },
            note: "If it wasn't you, ignore this and nothing changes. The link works for an hour.",
            preview: "Reset the password for your Polyxd Studio account.",
          }),
        );
      },
    },
    emailVerification: {
      sendOnSignUp: !local,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(
          env,
          user.email,
          "Verify your email for Studio",
          page({
            title: "Verify your email",
            name: user.name,
            body: "One click and your Studio account is ready. Then you can make a workspace, bring in your design system and start publishing screens.",
            cta: { text: "Verify email", url },
            note: "The link works for an hour.",
            preview: "One click and your Polyxd Studio account is ready.",
          }),
        );
      },
    },
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } } : {},
    session: { expiresIn: 30 * 86400, updateAge: 86400, cookieCache: { enabled: true, maxAge: 300 } },
    advanced: { useSecureCookies: !local, cookiePrefix: "studio" },
    user: { deleteUser: { enabled: true } },
  });
}

export type Auth = ReturnType<typeof makeAuth>;

export async function userFromRequest(c: Ctx, auth: Auth): Promise<{ user: User | null; apiWorkspace: string | null }> {
  const bearer = c.req.header("authorization")?.match(/^Bearer (pxs_[a-f0-9]+)$/)?.[1];
  if (bearer) {
    const hash = await sha256(bearer);
    const key = await c.env.DB.prepare("SELECT id, workspace_id, created_by, last_used_at FROM api_keys WHERE key_hash = ?").bind(hash).first<{ id: string; workspace_id: string; created_by: string; last_used_at: string | null }>();
    if (!key) return { user: null, apiWorkspace: null };
    // A product fetches by key on every request; "last used" to the hour is enough, and saves a write each time.
    if (!key.last_used_at || Date.parse(key.last_used_at) < Date.now() - 3600e3) await c.env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(now(), key.id).run();
    const user = await c.env.DB.prepare("SELECT id, email, name FROM user WHERE id = ?").bind(key.created_by).first<User>();
    return { user, apiWorkspace: key.workspace_id };
  }
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!s) return { user: null, apiWorkspace: null };
  return { user: { id: s.user.id, email: s.user.email.toLowerCase(), name: s.user.name ?? "" }, apiWorkspace: null };
}
