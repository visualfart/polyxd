/**
 * polyxd.com Worker: serves the static site from ./dist, handles the early-access waitlist, and
 * answers the demos' live endpoint (/demos/api/*, apps/demos/server/live.ts).
 * Waitlist entries are stored in KV keyed by email; nothing else about the visitor is kept.
 */
import type { LiveEnv } from "../../demos/server/live.ts";

interface Env extends LiveEnv {
  ASSETS: Fetcher;
  WAITLIST: KVNamespace;
}

/**
 * The demos' live endpoint, loaded on its first request so the rest of the site never evaluates it.
 * It is off (503) until a model key is set as a secret: `wrangler secret put ANTHROPIC_API_KEY`.
 */
let live: Promise<(request: Request, env: LiveEnv, ctx: ExecutionContext) => Promise<Response>> | undefined;
const off = () => json({ live: false }, 503);
async function demosApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // No key, no fake: answer without loading the endpoint at all.
  if (!env.ANTHROPIC_API_KEY && !env.POLYXD_API_KEY && env.POLYXD_DEMOS_FAKE !== "1") return off();
  live ??= import("../../demos/server/live.ts").then((m) => m.createLiveApi());
  try {
    return await (await live)(request, env, ctx);
  } catch (err) {
    // The endpoint couldn't load or failed before streaming: the demos fall back to their library.
    // Only the error's name and message are logged; the request body is never read here.
    console.error(JSON.stringify({ at: "demos.live", outcome: "unavailable", error: `${(err as Error)?.name}: ${(err as Error)?.message}` }));
    live = undefined;
    return off();
  }
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function waitlist(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: "Cross-site requests aren't allowed." }, 403);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Send the form as form data." }, 400);
  }
  // Honeypot: people never see this field; bots fill it in. Pretend it worked.
  if (String(form.get("company") ?? "").trim()) return json({ ok: true });
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 320) return json({ error: "That doesn't look like an email address." }, 400);
  const key = `email:${email}`;
  if (!(await env.WAITLIST.get(key))) await env.WAITLIST.put(key, JSON.stringify({ at: new Date().toISOString() }));
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/waitlist") return waitlist(request, env);
    if (url.pathname.startsWith("/demos/api/")) return demosApi(request, env, ctx);
    if (url.hostname === "www.polyxd.com") return Response.redirect(`https://polyxd.com${url.pathname}${url.search}`, 301);
    // Studio's sign-up links to /privacy and /terms without the slash; send them to the pages for good.
    if (url.pathname === "/privacy" || url.pathname === "/terms") return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301);
    const response = await env.ASSETS.fetch(request);
    // The demo products route on the client: any path under /demos/<name>/ is that product's page.
    const demo = response.status === 404 && /^\/demos\/([a-z]+)\/./.exec(url.pathname);
    if (demo) return env.ASSETS.fetch(new Request(new URL(`/demos/${demo[1]}/`, url), request));
    return response;
  },
} satisfies ExportedHandler<Env>;
