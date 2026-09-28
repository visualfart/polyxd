/** Whole runs against the recorded network: what is collected, what is sent, and what is never sent twice. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DISTINCT_ID, stableUuid } from "../src/events.ts";
import { delta, refreshHistories, run, type RunOptions } from "../src/run.ts";
import { MemoryStore } from "../src/store.ts";
import { fakeNetwork, fixture, jsonResponse, NIGHT, noSleep, PACKAGES, quiet, type Override } from "./helpers.ts";

const KEY = { key: "phc_test", host: "https://eu.i.posthog.com/" };

function setup(override?: Override, extra: Partial<RunOptions> = {}) {
  const network = fakeNetwork(override);
  const store = new MemoryStore();
  const options: RunOptions = { fetch: network.fetch, store, now: NIGHT, packages: PACKAGES, posthog: KEY, sleep: noSleep, log: quiet, ...extra };
  return { network, store, options };
}

test("a night's run: one npm event per package per counted day, and one reading of each store, GitHub and the registry", async () => {
  const { options } = setup();
  const result = await run({ ...options, days: 30 });
  assert.deepEqual(result.errors, []);
  assert.equal(result.npmThrough, "2026-09-27");

  const npm = result.events.filter((e) => e.event === "adoption_npm_daily");
  // Both packages were created on 2026-09-26: the 28 days before get no event.
  assert.deepEqual(npm.map((e) => [e.properties.package, e.properties.day]), [
    ["polyxd", "2026-09-26"],
    ["polyxd", "2026-09-27"],
    ["@polyxd/spec", "2026-09-26"],
    ["@polyxd/spec", "2026-09-27"],
  ]);
  assert.deepEqual(npm[2].properties, { package: "@polyxd/spec", day: "2026-09-26", downloads: 547, release_day: true, versions_published: ["0.1.0", "0.1.1", "0.2.0"] });
  assert.deepEqual(npm[1].properties, { package: "polyxd", day: "2026-09-27", downloads: 494, release_day: true, versions_published: ["0.2.1", "0.2.2", "0.3.0"] });

  const rest = result.events.filter((e) => e.event !== "adoption_npm_daily");
  assert.deepEqual(rest, [
    { event: "adoption_vscode_daily", properties: { store: "open-vsx", metric: "downloads", day: "2026-09-27", total: 80, delta: null, delta_days: null } },
    { event: "adoption_vscode_daily", properties: { store: "vs-marketplace", metric: "installs", day: "2026-09-27", total: 42, delta: null, delta_days: null } },
    { event: "adoption_vscode_daily", properties: { store: "vs-marketplace", metric: "downloads", day: "2026-09-27", total: 13, delta: null, delta_days: null } },
    { event: "adoption_github_daily", properties: { day: "2026-09-27", stars: 0, forks: 0, watchers: 0, open_issues: 0 } },
    { event: "adoption_registry", properties: { day: "2026-09-27", listed: true, version: "0.4.0" } },
  ]);
});

test("PostHog gets one batch: the project key, a fixed distinct id, no person profile, noon on the day described, a stable uuid", async () => {
  const { options, network } = setup();
  const result = await run(options);
  assert.equal(result.sent, result.events.length);
  const [call] = network.posthogCalls();
  assert.equal(network.posthogCalls().length, 1);
  assert.equal(call.url, "https://eu.i.posthog.com/batch/", "POSTHOG_HOST, trailing slash or not");
  assert.equal(call.method, "POST");
  assert.equal(call.body.api_key, "phc_test");
  assert.equal(call.body.batch.length, result.events.length);

  const spec = call.body.batch.find((e: any) => e.event === "adoption_npm_daily" && e.properties.package === "@polyxd/spec" && e.properties.day === "2026-09-27");
  assert.deepEqual(spec, {
    event: "adoption_npm_daily",
    timestamp: "2026-09-27T12:00:00.000Z",
    uuid: await stableUuid("2026-09-27:adoption_npm_daily:@polyxd/spec"),
    properties: { distinct_id: DISTINCT_ID, $process_person_profile: false, package: "@polyxd/spec", day: "2026-09-27", downloads: 651, release_day: true, versions_published: ["0.2.1", "0.2.2", "0.3.0"] },
  });
  for (const e of call.body.batch) {
    assert.equal(e.properties.distinct_id, "polyxd-adoption");
    assert.equal(e.properties.$process_person_profile, false);
    assert.equal(e.timestamp, `${e.properties.day}T12:00:00.000Z`);
    assert.match(e.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
  assert.equal(new Set(call.body.batch.map((e: any) => e.uuid)).size, call.body.batch.length, "every fact its own id");
  assert.deepEqual(Object.keys(call.body.batch.find((e: any) => e.event === "adoption_github_daily").properties).sort(), ["$process_person_profile", "day", "distinct_id", "forks", "open_issues", "stars", "watchers"]);
  assert.deepEqual(Object.keys(call.body.batch.find((e: any) => e.event === "adoption_registry").properties).sort(), ["$process_person_profile", "day", "distinct_id", "listed", "version"]);
});

test("idempotent: a rerun, or a backfill over days already sent, sends nothing twice", async () => {
  const { options, network, store } = setup();
  const first = await run(options);
  assert.ok(first.sent > 0);
  assert.deepEqual(JSON.parse((await store.get("sent:2026-09-27"))!), [
    "adoption_github_daily",
    "adoption_npm_daily:@polyxd/spec",
    "adoption_npm_daily:polyxd",
    "adoption_registry",
    "adoption_vscode_daily:open-vsx:downloads",
    "adoption_vscode_daily:vs-marketplace:downloads",
    "adoption_vscode_daily:vs-marketplace:installs",
  ]);

  const again = await run(options);
  assert.equal(again.sent, 0);
  assert.equal(again.events.length, 0);
  assert.equal(again.skipped, first.sent);
  assert.equal(network.posthogCalls().length, 1, "no second request");

  const backfill = await run({ ...options, days: 30 });
  assert.equal(backfill.sent, 0, "the backfill found only days already sent");
});

test("deltas: the change since the last reading sent, over however many days that was", async () => {
  assert.deepEqual(delta(null, "2026-09-27", 80), { delta: null, delta_days: null });
  assert.deepEqual(delta({ day: "2026-09-26", total: 70 }, "2026-09-27", 80), { delta: 10, delta_days: 1 });
  assert.deepEqual(delta({ day: "2026-09-27", total: 80 }, "2026-09-27", 80), { delta: null, delta_days: null });

  let downloads = 80;
  const { options, store } = setup((url) => (url.includes("open-vsx.org") ? jsonResponse({ ...fixture("openvsx.json"), downloadCount: downloads }) : undefined));
  await run(options);
  assert.deepEqual(JSON.parse((await store.get("total:open-vsx:downloads"))!), { day: "2026-09-27", total: 80 });

  downloads = 95;
  const next = await run({ ...options, now: new Date("2026-09-29T02:00:00Z") });
  const openVsx = next.events.find((e) => e.event === "adoption_vscode_daily" && e.properties.store === "open-vsx");
  assert.deepEqual(openVsx?.properties, { store: "open-vsx", metric: "downloads", day: "2026-09-28", total: 95, delta: 15, delta_days: 1 });

  // The run on the 30th failed; the one on the 31st covers two days.
  downloads = 101;
  const later = await run({ ...options, now: new Date("2026-10-01T02:00:00Z") });
  const after = later.events.find((e) => e.event === "adoption_vscode_daily" && e.properties.store === "open-vsx");
  assert.deepEqual(after?.properties, { store: "open-vsx", metric: "downloads", day: "2026-09-30", total: 101, delta: 6, delta_days: 2 });
});

test("no POSTHOG_KEY: one summary line, nothing sent, nothing remembered", async () => {
  const lines: string[] = [];
  const { options, network, store } = setup(undefined, { posthog: null, log: (line) => lines.push(line) });
  const result = await run(options);
  assert.ok(result.events.length > 0);
  assert.equal(result.sent, 0);
  assert.equal(network.posthogCalls().length, 0);
  assert.equal(store.data.size, 0);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^adoption: npm 2 packages through 2026-09-27 · 9 new events · 0 already sent · not sent \(no POSTHOG_KEY\)$/);

  const emptyKey = setup(undefined, { posthog: { key: "" } });
  await run(emptyKey.options);
  assert.equal(emptyKey.network.posthogCalls().length, 0);
});

test("a source that fails costs only its own events, which go on the next run", async () => {
  let githubUp = false;
  const { options, network } = setup((url) => (url.includes("api.github.com") && !githubUp ? jsonResponse({ message: "down" }, 500) : undefined));
  const first = await run(options);
  assert.deepEqual(first.errors, ["GitHub: GET https://api.github.com/repos/visualfart/polyxd: HTTP 500"]);
  assert.ok(!first.events.some((e) => e.event === "adoption_github_daily"));
  assert.ok(first.sent > 0);

  githubUp = true;
  const second = await run(options);
  assert.deepEqual(second.events.map((e) => e.event), ["adoption_github_daily"]);
  assert.equal(second.sent, 1);
  assert.equal(network.posthogCalls().length, 2);
});

test("PostHog refusing the batch leaves the ledger alone, so the next run sends it all", async () => {
  let refuse = true;
  const { options, store } = setup((url) => (url.endsWith("/batch/") && refuse ? new Response("bad key", { status: 401 }) : undefined));
  const first = await run(options);
  assert.equal(first.sent, 0);
  assert.match(first.errors.join(), /PostHog https:\/\/eu\.i\.posthog\.com\/batch\/: HTTP 401 bad key/);
  assert.equal(await store.get("sent:2026-09-27"), null);
  assert.equal(await store.get("total:open-vsx:downloads"), null);

  refuse = false;
  const second = await run(options);
  assert.equal(second.sent, first.events.length);
});

test("a package npm has not counted yet gives no events and no error; the package list is the repo's plus the search's", async () => {
  const { options, network } = setup(undefined, { packages: undefined, posthog: null });
  const result = await run(options);
  assert.deepEqual(result.errors, []);
  const packages = new Set(result.events.filter((e) => e.event === "adoption_npm_daily").map((e) => e.properties.package));
  assert.deepEqual([...packages].sort(), ["@polyxd/spec", "polyxd"], "only the two with recorded downloads");
  assert.ok(network.calls.some((c) => c.url.endsWith("/downloads/range/2026-09-25:2026-09-27/@polyxd/brand-new")), "the search's extra package is asked about");
  assert.ok(network.calls.some((c) => c.url.endsWith("/downloads/range/2026-09-25:2026-09-27/@polyxd/ds-carbon")), "src/packages.ts is asked about");
});

test("the 01:30 refresh caches publish histories, so the 02:00 run does not fetch them again", async () => {
  const { options, network, store } = setup();
  const refreshed = await refreshHistories({ ...options, now: new Date("2026-09-28T01:30:00Z") });
  assert.equal(refreshed, "adoption history: cached 2 of 2 packages");
  assert.ok(await store.get("cache:npm-history:@polyxd/spec"));
  const before = network.calls.length;
  await run(options);
  const registryDocs = network.calls.slice(before).filter((c) => /^https:\/\/registry\.npmjs\.org\/(polyxd|@polyxd%2f)/.test(c.url));
  assert.equal(registryDocs.length, 0);

  // A day-old cache is not trusted.
  const tomorrow = await run({ ...options, now: new Date("2026-09-29T02:00:00Z") });
  assert.deepEqual(tomorrow.errors, []);
  assert.ok(network.calls.some((c) => c.url === "https://registry.npmjs.org/@polyxd%2fspec"));
});

test("npm answering 429 is waited out, not counted as a failure", async () => {
  let busy = 1;
  const waits: number[] = [];
  const { options } = setup((url) => (url.includes("/downloads/range/") && busy-- > 0 ? new Response("", { status: 429, headers: { "retry-after": "1" } }) : undefined), {
    sleep: async (ms) => void waits.push(ms),
  });
  const result = await run(options);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(waits, [1000]);
  assert.equal(result.events.filter((e) => e.event === "adoption_npm_daily").length, 4);
});
