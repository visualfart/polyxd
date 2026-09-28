/**
 * Studio's own analytics, in PostHog (US cloud). Off unless the Worker has POSTHOG_KEY, the
 * project's public key (phc_…): with no key /ingest/* is a 404, /api/me offers the app no
 * analytics, and nothing is sent from here.
 *
 * What goes to PostHog is tied to a person's user id (a random id Studio made, never their name or
 * email) and their workspace's id (never its name or address). Never a token, a document, a
 * Direction, a design system's contents or anything a person typed.
 *
 * Server-side events, from the Worker, because they are the ones that must be exact:
 *   signed_up            { method }                                     distinct id: the user id
 *   screen_published     { version, kind, warnings }                    the user id, workspace group
 *   direction_published  { version }                                    the user id, workspace group
 *   api_fetch            { kind, status }  a product fetching a published screen, Direction or
 *                        pattern with a workspace API key; no person: the workspace group only
 *
 * The app's own events (src/app/analytics.ts) go through the /ingest/* proxy below.
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
  assets: string;
  /** PostHog's app, for the toolbar's links: us.posthog.com beside us.i.posthog.com. */
  ui: string;
}

export function posthogConfig(env: AnalyticsEnv): PostHogConfig | null {
  const key = env.POSTHOG_KEY?.trim();
  if (!key || !/^phc_[A-Za-z0-9_-]{8,}$/.test(key)) return null;
  const host = (env.POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(host)) return null;
  const region = /^https:\/\/(us|eu)\.i\.posthog\.com$/.exec(host)?.[1];
  return { key, host, assets: region ? `https://${region}-assets.i.posthog.com` : host, ui: region ? `https://${region}.posthog.com` : host };
}

export type Properties = Record<string, string | number | boolean>;

/**
 * One event from the Worker. `distinctId` is a user id, or none for an event no person made (a
 * product's API call), which then makes no person profile. `workspace` is the workspace's id.
 * Never throws.
 */
export async function capture(env: AnalyticsEnv, event: string, { distinctId, workspace, properties = {} }: { distinctId?: string; workspace?: string; properties?: Properties }, fetcher: typeof fetch = fetch): Promise<void> {
  const config = posthogConfig(env);
  if (!config) return;
  try {
    await fetcher(`${config.host}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: config.key,
        event,
        distinct_id: distinctId ?? (workspace ? `workspace:${workspace}` : crypto.randomUUID()),
        timestamp: new Date().toISOString(),
        properties: {
          ...properties,
          ...(workspace ? { $groups: { workspace } } : {}),
          ...(distinctId ? {} : { $process_person_profile: false }),
          // The Worker's address, not the person's: no location from it, and none stored.
          $geoip_disable: true,
          $ip: null,
          $lib: "polyxd-studio-worker",
        },
      }),
    });
  } catch {
    // Analytics never affect Studio.
  }
}

/** The request headers PostHog needs. Cookies (Studio's session among them) and credentials stay here. */
const FORWARD = ["content-type", "content-encoding", "accept", "user-agent"];
const MAX_BODY = 1024 * 1024;

/** /ingest/* → PostHog, as PostHog's Cloudflare guide sets it up. A 404 when analytics are off. */
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
  // PostHog works out the country from the address, then discards it (docs/analytics.md).
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);
  let body: ArrayBuffer | undefined;
  if (request.method === "POST") {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return new Response(null, { status: 413 });
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY) return new Response(null, { status: 413 });
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
