/**
 * polyxd.com Worker: serves the static site from ./dist and handles the early-access waitlist.
 * Waitlist entries are stored in KV keyed by email; nothing else about the visitor is kept.
 */
interface Env {
  ASSETS: Fetcher;
  WAITLIST: KVNamespace;
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/waitlist") return waitlist(request, env);
    if (url.hostname === "www.polyxd.com") return Response.redirect(`https://polyxd.com${url.pathname}${url.search}`, 301);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
