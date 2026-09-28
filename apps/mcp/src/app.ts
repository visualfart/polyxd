/**
 * The hosted Polyxd MCP server, https://mcp.polyxd.com. Its routes:
 *
 *   /mcp      the server over Streamable HTTP (@polyxd/mcp/http), with no authentication: every
 *             tool is read-only and touches no account and no personal data
 *   /health   a small JSON answer for uptime checks
 *   /         a redirect to the docs
 *   /.well-known/openai-apps-challenge   OpenAI's domain-verification token, when one is set
 *   /favicon.ico, /favicon.svg, /icon-512.png   redirects to polyxd.com's copies, so apps that look
 *             up a host's icon find the Polyxd mark
 *
 * The page the MCP App shows is passed in (src/index.ts bundles it as text), so the tests can run
 * this in Node.
 */
import { createHttpHandler, rateLimiter, VERSION, type RequestLog } from "@polyxd/mcp/http";

const ICONS = new Map([["/favicon.ico", "/favicon.ico"], ["/favicon.svg", "/favicon.svg"], ["/icon-512.png", "/icon-512.png"], ["/apple-touch-icon.png", "/icon-180.png"]]);

export const DOCS_URL = "https://polyxd.com/docs/mcp/";
/** Requests per minute from one IP address. Claude and ChatGPT call from their own servers, so one address can carry many people; keep this generous. */
export const RATE_LIMIT = 600;

/** The bindings wrangler.jsonc declares. */
export interface Env {
  /** Cloudflare's rate limiting binding: counts per location, so it is a guard against floods, not an exact quota. */
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** OpenAI's domain-verification token for the app directory, set with `wrangler secret put OPENAI_APPS_CHALLENGE`. */
  OPENAI_APPS_CHALLENGE?: string;
}

export interface AppOptions {
  viewHtml: () => string;
  log?: (entry: RequestLog) => void;
}

const clientIp = (request: Request) => request.headers.get("cf-connecting-ip") ?? "unknown";

export function createApp(options: AppOptions) {
  const log = options.log ?? ((entry: RequestLog) => console.log(JSON.stringify(entry)));
  // Where the binding is missing (a test, or a config without it), a per-isolate count stands in: best effort only.
  const fallback = rateLimiter({ limit: RATE_LIMIT, windowMs: 60_000, key: clientIp });
  // One handler per set of bindings. A Worker's env is the same object for every request an isolate serves.
  const handlers = new WeakMap<Env, (request: Request) => Promise<Response>>();
  const handlerFor = (env: Env) => {
    let handler = handlers.get(env);
    if (!handler) {
      const binding = env.RATE_LIMITER;
      handler = createHttpHandler({
        viewHtml: options.viewHtml,
        log,
        rateLimit: binding ? async (request) => (await binding.limit({ key: clientIp(request) })).success : fallback,
      });
      handlers.set(env, handler);
    }
    return handler;
  };

  return {
    async fetch(request: Request, env: Env = {}): Promise<Response> {
      const { pathname } = new URL(request.url);
      if (pathname === "/mcp") return handlerFor(env)(request);

      const started = Date.now();
      let response: Response;
      if (pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
        response = Response.redirect(DOCS_URL, 302);
      } else if (ICONS.has(pathname) && (request.method === "GET" || request.method === "HEAD")) {
        response = new Response(null, { status: 301, headers: { location: `https://polyxd.com${ICONS.get(pathname)}`, "cache-control": "public, max-age=86400" } });
      } else if (pathname === "/.well-known/openai-apps-challenge" && env.OPENAI_APPS_CHALLENGE) {
        response = new Response(env.OPENAI_APPS_CHALLENGE.trim(), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
      } else if (pathname === "/health") {
        response = Response.json({ ok: true, name: "polyxd", version: VERSION, endpoint: "/mcp" }, { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
      } else {
        response = new Response(`Not found. The MCP endpoint is /mcp; the docs are at ${DOCS_URL}\n`, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      log({ method: request.method, path: pathname.slice(0, 200), status: response.status, ms: Date.now() - started });
      return response;
    },
  };
}
