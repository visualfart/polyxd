/**
 * Who is asking. People sign in through better-auth (open source, running in this Worker on D1):
 * email and password with verification, password reset, Google when a client is configured, and
 * later two-step verification and SAML/OIDC single sign-on through its plugins. `polyxd studio
 * push` uses a workspace API key instead.
 */
import type { Context } from "hono";
import { betterAuth } from "better-auth";
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
}

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

const page = (title: string, body: string, cta?: { text: string; url: string }) =>
  `<div style="font-family: 'Hanken Grotesk', 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #141413;"><h2 style="font-size: 20px; margin: 0 0 12px;">${title}</h2><p style="font-size: 15px; line-height: 22px; margin: 0 0 20px;">${body}</p>${cta ? `<p><a href="${cta.url}" style="display: inline-block; background: #FF6E40; color: #141413; padding: 12px 22px; border-radius: 999px; text-decoration: none; font-weight: 600;">${cta.text}</a></p><p style="font-size: 12px; color: #5E5A52;">Or paste this into your browser: ${cta.url}</p>` : ""}</div>`;

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
        await sendEmail(env, user.email, "Reset your Studio password", page("Choose a new password", "Someone asked to reset the password for this email on Polyxd Studio. If it wasn't you, ignore this; nothing changes.", { text: "Reset password", url }));
      },
    },
    emailVerification: {
      sendOnSignUp: !local,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(env, user.email, "Verify your email for Studio", page("Verify your email", "One click and you're in. The link works for an hour.", { text: "Verify email", url }));
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
    const key = await c.env.DB.prepare("SELECT id, workspace_id, created_by FROM api_keys WHERE key_hash = ?").bind(hash).first<{ id: string; workspace_id: string; created_by: string }>();
    if (!key) return { user: null, apiWorkspace: null };
    await c.env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(now(), key.id).run();
    const user = await c.env.DB.prepare("SELECT id, email, name FROM user WHERE id = ?").bind(key.created_by).first<User>();
    return { user, apiWorkspace: key.workspace_id };
  }
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!s) return { user: null, apiWorkspace: null };
  return { user: { id: s.user.id, email: s.user.email.toLowerCase(), name: s.user.name ?? "" }, apiWorkspace: null };
}
