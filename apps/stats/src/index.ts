/**
 * The Worker. It has no public address (wrangler.jsonc: no routes, workers_dev and preview URLs
 * off) and does its work on two cron triggers:
 *
 *   every 15 minutes in hour 1 (01:00 to 01:45): each caches a quarter of the packages' npm publish
 *     histories and download counts into KV
 *   0 2 * * *    collect yesterday's numbers (npm from that cache) and send them to PostHog
 *
 * Workers Free allows 50 subrequests an invocation, retries included; one run doing all of npm
 * went over it on most days, and then the send failed too. The shards keep each run far under.
 *
 * Its fetch handler answers /health, and POST /run for a manual run or a backfill when a request
 * carries `Authorization: Bearer <ADMIN_TOKEN>` (404 when no ADMIN_TOKEN is set). It is reachable
 * only through `wrangler dev` unless a route is added; the backfill script (scripts/backfill.ts) is
 * the usual way to fill in past days.
 */
import { MAX_DAYS, refreshHistories, run, SHARDS, SUBREQUEST_LIMIT } from "./run.ts";
import type { Fetch } from "./sources.ts";
import { MemoryStore, type Store } from "./store.ts";

export const HISTORY_CRON = "*/15 1 * * *";
export const COLLECT_CRON = "0 2 * * *";

/** The bindings wrangler.jsonc declares and the secrets set with `wrangler secret put`. */
export interface Env {
  /** Remembers what was sent. Without it the Worker sends nothing, rather than risk counting a day twice. */
  STATS?: Store;
  /** The PostHog project API key (phc_...). Unset: runs log what they would send and send nothing. */
  POSTHOG_KEY?: string;
  /** Defaults to https://us.i.posthog.com; https://eu.i.posthog.com for an EU project. */
  POSTHOG_HOST?: string;
  /** Optional. GitHub's unauthenticated limit (60 an hour) is plenty for one call a day. */
  GITHUB_TOKEN?: string;
  /** Enables POST /run. */
  ADMIN_TOKEN?: string;
}

export interface WorkerDeps {
  fetch?: Fetch;
  now?: () => Date;
  log?: (line: string) => void;
}

async function sameSecret(a: string, b: string): Promise<boolean> {
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body, null, 2), { status, headers: { "content-type": "application/json" } });

export function createWorker(deps: WorkerDeps = {}) {
  const fetch: Fetch = deps.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((line: string) => console.log(line));

  // Cron runs get the Workers Free subrequest budget; /run is for wrangler dev and backfills, which have none.
  const options = (env: Env, days?: number, subrequests?: number) => {
    const store = env.STATS;
    if (!store) log("adoption: no STATS KV binding, so nothing will be sent (see apps/stats/README.md)");
    return {
      fetch,
      store: store ?? new MemoryStore(),
      now: now(),
      days,
      posthog: store && env.POSTHOG_KEY ? { key: env.POSTHOG_KEY, host: env.POSTHOG_HOST } : null,
      notSending: store ? undefined : "no STATS binding",
      githubToken: env.GITHUB_TOKEN || undefined,
      log,
      subrequests,
    };
  };

  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === "/health") return json({ ok: true });
      if (url.pathname === "/run" && env.ADMIN_TOKEN) {
        const auth = request.headers.get("authorization") ?? "";
        if (!(await sameSecret(auth, `Bearer ${env.ADMIN_TOKEN}`))) return json({ error: "unauthorized" }, 401);
        if (request.method !== "POST") return json({ error: "POST /run" }, 405);
        if (url.searchParams.get("step") === "history") return json({ summary: await refreshHistories(options(env)) });
        const backfill = url.searchParams.get("backfill");
        const days = backfill === null ? undefined : Number(backfill);
        if (days !== undefined && !(Number.isInteger(days) && days >= 1 && days <= MAX_DAYS)) return json({ error: `backfill must be a whole number of days, 1 to ${MAX_DAYS}` }, 400);
        const result = await run(options(env, days));
        return json({ summary: result.summary, sent: result.sent, skipped: result.skipped, errors: result.errors, events: result.events.length });
      }
      return json({ error: "not found" }, 404);
    },

    async scheduled(controller: { cron: string; scheduledTime?: number }, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<void> {
      if (controller.cron !== HISTORY_CRON) return ctx.waitUntil(run(options(env, undefined, SUBREQUEST_LIMIT)));
      // :00 is shard 0, :15 shard 1, and so on.
      const shard = Math.floor(new Date(controller.scheduledTime ?? now().getTime()).getUTCMinutes() / 15) % SHARDS;
      ctx.waitUntil(refreshHistories({ ...options(env), shard }));
    },
  };
}

export default createWorker() satisfies ExportedHandler<Env>;
