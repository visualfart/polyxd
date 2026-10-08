/**
 * polyxd.com's own analytics, in PostHog (US cloud). Off unless the Worker has POSTHOG_KEY, the
 * project's public key (phc_…), set with `wrangler secret put POSTHOG_KEY`. With no key, /ingest/*
 * is a 404 and nothing is sent from here.
 *
 *   /ingest/*   a first-party proxy to PostHog's ingest host (and its assets host for /static/ and
 *               /array/), as PostHog's Cloudflare guide sets it up: the pages' events go to
 *               polyxd.com, not a third-party address. Cookies and credentials are dropped both
 *               ways, and nothing about the request is logged.
 *   demo_live_generation   one server-side event per live generation in the demos: the product,
 *               the outcome and counts, never the ask (apps/demos/server/live.ts).
 *
 * The pages' own script (scripts/analytics.ts) is only built into them when POSTHOG_KEY is set at
 * build time.
 */
export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

export interface AnalyticsEnv {
  POSTHOG_KEY?: string;
  /** PostHog's ingest host. Default https://us.i.posthog.com; https://eu.i.posthog.com for the EU cloud. */
  POSTHOG_HOST?: string;
}

export interface PostHogConfig {
  key: string;
  host: string;
  /** Where posthog-js's static files live: us-assets.i.posthog.com beside us.i.posthog.com. */
  assets: string;
}

export function posthogConfig(env: AnalyticsEnv): PostHogConfig | null {
  const key = env.POSTHOG_KEY?.trim();
  if (!key || !/^phc_[A-Za-z0-9_-]{8,}$/.test(key)) return null;
  const host = (env.POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(host)) return null;
  return { key, host, assets: host.replace(/^https:\/\/(us|eu)\.i\.posthog\.com$/, "https://$1-assets.i.posthog.com") };
}

/** The request headers PostHog needs. Everything else (cookies, credentials, Cloudflare's own) stays here. */
const FORWARD = ["content-type", "content-encoding", "accept", "user-agent"];
const MAX_BODY = 1024 * 1024;

/**
 * The visitor's country as Cloudflare resolved it (two letters), or null. PostHog can't: in
 * cookieless mode it drops the address before its GeoIP step runs (PostHog/posthog#48660).
 */
export function countryOf(request: Request): string | null {
  const cc = ((request as { cf?: { country?: unknown } }).cf?.country ?? request.headers.get("cf-ipcountry")) as string | null;
  // XX: unknown; T1: Tor.
  return typeof cc === "string" && /^[A-Z]{2}$/.test(cc) && cc !== "XX" && cc !== "T1" ? cc : null;
}

const COUNTRY_NAMES = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

/**
 * The page's events with `$geoip_country_code` and `$geoip_country_name` added (only the country:
 * no city, region or coordinates), or null to forward the body as it came. Only for an
 * uncompressed JSON body on an event endpoint; the page's script turns compression off for this.
 */
export function withCountry(body: ArrayBuffer, url: URL, country: string | null): string | null {
  if (!country || url.searchParams.has("compression")) return null;
  if (!/^\/(e|batch|i\/v0\/e)\/?$/.test(url.pathname.replace(/^\/ingest/, ""))) return null;
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return null;
  }
  const list = Array.isArray(json) ? json : json && typeof json === "object" && Array.isArray((json as { batch?: unknown }).batch) ? (json as { batch: unknown[] }).batch : [json];
  const name = COUNTRY_NAMES?.of(country) ?? country;
  for (const event of list) {
    const props = event && typeof event === "object" ? (event as { properties?: unknown }).properties : null;
    if (!props || typeof props !== "object" || "$geoip_country_code" in props) continue;
    Object.assign(props, { $geoip_country_code: country, $geoip_country_name: name });
  }
  return JSON.stringify(json);
}

/** /ingest/* → PostHog. A 404 when analytics are off. */
export async function ingest(request: Request, env: AnalyticsEnv): Promise<Response> {
  const config = posthogConfig(env);
  if (!config) return new Response("Not found.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (request.method !== "GET" && request.method !== "POST" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD, POST" } });
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/ingest/, "") || "/";
  const target = `${path.startsWith("/static/") || path.startsWith("/array/") ? config.assets : config.host}${path}${url.search}`;
  const headers = new Headers();
  for (const h of FORWARD) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  // PostHog makes its daily cookieless visitor hash from the address, then discards it (see
  // docs/analytics.md); without this it would see only Cloudflare's. The country comes from
  // Cloudflare instead (withCountry), because cookieless mode drops the address before GeoIP.
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);
  let body: ArrayBuffer | string | undefined;
  if (request.method === "POST") {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return new Response(null, { status: 413 });
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY) return new Response(null, { status: 413 });
    body = withCountry(body, url, countryOf(request)) ?? body;
  }
  let upstream: Response;
  try {
    upstream = await fetch(target, { method: request.method, headers, body, redirect: "manual" });
  } catch {
    return new Response(null, { status: 502 });
  }
  const out = new Headers(upstream.headers);
  out.delete("set-cookie");
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}

/** One server-side event with no person behind it: a fresh id, no profile, no location. Never throws. */
export async function capture(config: PostHogConfig, event: string, properties: Record<string, string | number | boolean>, fetcher: typeof fetch = fetch): Promise<void> {
  try {
    await fetcher(`${config.host}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: config.key,
        event,
        distinct_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        properties: { ...properties, $process_person_profile: false, $geoip_disable: true, $ip: null, $lib: "polyxd-site-worker" },
      }),
    });
  } catch {
    // Analytics never affect the site.
  }
}

/** What the demos' live endpoint reports about a generation (apps/demos/server/live.ts). Counts only. */
export interface GenerationSummary {
  product: string;
  outcome: string;
  attempts?: number;
  inputTokens?: number;
  outputTokens?: number;
  ms: number;
}

const count = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

/** demo_live_generation, when POSTHOG_KEY is set. */
export function demoGeneration(env: AnalyticsEnv, s: GenerationSummary, fetcher?: typeof fetch): Promise<void> | undefined {
  const config = posthogConfig(env);
  if (!config) return undefined;
  const attempts = count(s.attempts);
  const input = count(s.inputTokens);
  const output = count(s.outputTokens);
  return capture(
    config,
    "demo_live_generation",
    {
      product: /^[a-z]{1,20}$/.test(s.product) ? s.product : "other",
      outcome: /^[a-z-]{1,24}$/.test(s.outcome) ? s.outcome : "other",
      attempts,
      repaired: attempts > 1,
      tokens: input + output,
      input_tokens: input,
      output_tokens: output,
      ms: count(s.ms),
    },
    fetcher,
  );
}
