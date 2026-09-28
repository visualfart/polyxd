/** The Worker: its config, its two crons, /health, and the token-guarded /run. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { COLLECT_CRON, createWorker, HISTORY_CRON, type Env } from "../src/index.ts";
import { PACKAGES } from "../src/packages.ts";
import { MemoryStore } from "../src/store.ts";
import { fakeNetwork, NIGHT } from "./helpers.ts";

const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n"),
);

test("wrangler.jsonc: no public address, the two crons, a STATS namespace, and no platform logs beyond the Worker's own line", () => {
  assert.equal(config.name, "polyxd-stats");
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.routes, undefined);
  assert.equal(config.route, undefined);
  assert.deepEqual(config.triggers, { crons: [HISTORY_CRON, COLLECT_CRON] });
  assert.deepEqual(config.kv_namespaces.map((n: any) => n.binding), ["STATS"]);
  assert.equal(config.vars.POSTHOG_KEY, undefined, "the key is a secret, not a var");
  assert.equal(config.observability.logs.invocation_logs, false);
  assert.equal(config.observability.traces.enabled, false);
  assert.equal(config.observability.issues.enabled, false);
});

test("src/packages.ts lists exactly the packages this repository publishes", () => {
  const root = new URL("../../../packages/", import.meta.url);
  const published = readdirSync(root)
    .map((dir) => {
      try {
        return JSON.parse(readFileSync(new URL(`${dir}/package.json`, root), "utf8"));
      } catch {
        return null;
      }
    })
    .filter((pkg) => pkg && !pkg.private && (pkg.name === "polyxd" || pkg.name?.startsWith("@polyxd/")))
    .map((pkg) => pkg.name as string)
    .sort();
  assert.deepEqual([...PACKAGES].sort(), published);
});

function worker(network = fakeNetwork()) {
  const lines: string[] = [];
  const w = createWorker({ fetch: network.fetch, now: () => NIGHT, log: (line) => lines.push(line) });
  // Every run the Worker starts goes through waitUntil; the tests wait for them.
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) };
  const settle = () => Promise.all(pending);
  return { w, ctx, settle, lines, network };
}

test("the 02:00 cron collects and sends; the 01:30 cron only caches histories", async () => {
  const { w, ctx, settle, lines, network } = worker();
  const env: Env = { STATS: new MemoryStore(), POSTHOG_KEY: "phc_test", POSTHOG_HOST: "https://eu.i.posthog.com" };

  await w.scheduled({ cron: HISTORY_CRON }, env, ctx);
  await settle();
  assert.equal(network.posthogCalls().length, 0);
  assert.match(lines.at(-1)!, /^adoption history: cached \d+ of \d+ packages$/);

  await w.scheduled({ cron: COLLECT_CRON }, env, ctx);
  await settle();
  assert.equal(network.posthogCalls().length, 1);
  assert.equal(network.posthogCalls()[0].url, "https://eu.i.posthog.com/batch/");
  assert.match(lines.at(-1)!, /^adoption: npm \d+ packages through 2026-09-27 · \d+ new events · 0 already sent · sent \d+$/);
});

test("without the STATS namespace the Worker sends nothing, even with a key, rather than risk counting twice", async () => {
  const { w, ctx, settle, lines, network } = worker();
  await w.scheduled({ cron: COLLECT_CRON }, { POSTHOG_KEY: "phc_test" }, ctx);
  await settle();
  assert.equal(network.posthogCalls().length, 0);
  assert.match(lines[0], /no STATS KV binding/);
  assert.match(lines.at(-1)!, /not sent \(no STATS binding\)$/);
});

test("/health answers; /run is 404 without ADMIN_TOKEN, 401 with the wrong one, and runs a backfill with the right one", async () => {
  const { w, network } = worker();
  const at = (path: string, init?: RequestInit) => new Request(`https://stats.invalid${path}`, init);
  const store = new MemoryStore();

  const health = await w.fetch(at("/health"), {});
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  assert.equal((await w.fetch(at("/"), {})).status, 404);
  assert.equal((await w.fetch(at("/run?backfill=30", { method: "POST" }), { STATS: store })).status, 404, "no token set, no route");

  const env: Env = { STATS: store, POSTHOG_KEY: "phc_test", ADMIN_TOKEN: "s3cret" };
  assert.equal((await w.fetch(at("/run", { method: "POST" }), env)).status, 401);
  assert.equal((await w.fetch(at("/run", { method: "POST", headers: { authorization: "Bearer nope" } }), env)).status, 401);
  const auth = { authorization: "Bearer s3cret" };
  assert.equal((await w.fetch(at("/run", { headers: auth }), env)).status, 405);
  assert.equal((await w.fetch(at("/run?backfill=0", { method: "POST", headers: auth }), env)).status, 400);
  assert.equal((await w.fetch(at("/run?backfill=abc", { method: "POST", headers: auth }), env)).status, 400);
  assert.equal(network.calls.length, 0, "nothing fetched for a refused request");

  const history = await w.fetch(at("/run?step=history", { method: "POST", headers: auth }), env);
  assert.match((await history.json()).summary, /^adoption history: cached/);

  const response = await w.fetch(at("/run?backfill=30", { method: "POST", headers: auth }), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.errors.length, 0);
  assert.ok(body.sent > 0);
  assert.equal(body.sent, body.events);
  const range = network.calls.find((c) => c.url.includes("/downloads/range/"));
  assert.match(range!.url, /\/downloads\/range\/2026-08-29:2026-09-27\//, "30 days ending on npm's last counted day");
});
