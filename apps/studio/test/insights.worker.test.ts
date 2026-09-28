/**
 * Insights through the Worker itself (test/support/worker.ts): ingest keys, the ingest endpoint
 * (auth, CORS, limits, what is dropped), what D1 ends up holding, and the report Studio reads.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { startWorker, APP_URL } from "./support/worker.ts";
import { LIMITS, MAX_ROWS_PER_DAY } from "../src/worker/insights.ts";

type Worker = Awaited<ReturnType<typeof startWorker>>;
let ip = 0;
/** A fresh address for each caller, so one test's requests don't count against another's limit. */
const address = () => `203.0.113.${++ip % 250}:${ip}`;

/** A product posting events the way toFetch does, from its own origin. */
function product(worker: Worker, slug: string, key: string | null, from = address()) {
  return async (payload: unknown, headers: Record<string, string> = {}) => {
    const res = await worker.app.request(`${APP_URL}/api/w/${slug}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shop.example", "cf-connecting-ip": from, ...(key ? { "x-polyxd-key": key } : {}), ...headers },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }, worker.env);
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
}

const ev = (over: Record<string, unknown> = {}) => ({
  type: "surface.shown",
  timestamp: new Date().toISOString(),
  sessionId: `s_${Math.random().toString(36).slice(2)}`,
  surface: { id: "send", intent: "money.send", pattern: "multi-step-form" },
  actor: { kind: "human" },
  ...over,
});

async function setUp(email = "mira@harbourline.test", workspace = "Harbourline") {
  const worker = await startWorker();
  const mira = await worker.signUp(email, workspace);
  const slug = workspace.toLowerCase();
  const made = await mira.call("POST", `/api/w/${slug}/ingest-keys`, { name: "Web app" });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  return { worker, mira, slug, key: made.body.key as string, keyId: made.body.id as string };
}

/** Everything D1 holds, every table, as one string. */
function everything(worker: Worker): string {
  const db = (worker.env.DB as unknown as { db: { prepare: (s: string) => { all: () => Record<string, unknown>[] } } }).db;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => String(r.name));
  return tables.map((t) => JSON.stringify(db.prepare(`SELECT * FROM "${t}"`).all())).join("\n");
}

test("an ingest key is made, listed and shown again, and revoking it stops it at once", async () => {
  const { worker, mira, slug, key, keyId } = await setUp();
  assert.match(key, /^pxi_[a-f0-9]{48}$/);
  const list = await mira.call("GET", `/api/w/${slug}/ingest-keys`);
  assert.deepEqual(list.body.keys.map((k: { name: string; key: string }) => [k.name, k.key]), [["Web app", key]]);
  const send = product(worker, slug, key);
  assert.equal((await send({ events: [ev()] })).status, 202);
  assert.ok((await mira.call("GET", `/api/w/${slug}/ingest-keys`)).body.keys[0].last_used_at, "last used is recorded");
  assert.equal((await mira.call("DELETE", `/api/w/${slug}/ingest-keys/${keyId}`)).status, 200);
  assert.equal((await send({ events: [ev()] })).status, 401);
});

test("the ingest endpoint: CORS for any origin, a key of this workspace or nothing, and cookies never count", async () => {
  const { worker, mira, slug, key } = await setUp();
  const other = await worker.signUp("leo@northwind.test", "Northwind");
  const otherKey = (await other.call("POST", "/api/w/northwind/ingest-keys", {})).body.key as string;

  const pre = await worker.app.request(`${APP_URL}/api/w/${slug}/events`, { method: "OPTIONS", headers: { origin: "https://shop.example", "access-control-request-method": "POST", "access-control-request-headers": "content-type, x-polyxd-key" } }, worker.env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "*");
  assert.match(pre.headers.get("access-control-allow-headers") ?? "", /x-polyxd-key/);
  assert.match(pre.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.equal(pre.headers.get("access-control-allow-credentials"), null, "no credentials, ever");

  const ok = await product(worker, slug, key)({ events: [ev()] });
  assert.equal(ok.status, 202, "a cross-site POST with an ingest key is taken");
  assert.equal(ok.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(ok.body, { accepted: 1, dropped: 0, why: { invalid: 0, duplicate: 0, uncoded: 0 } });

  for (const [what, k] of [["no key", null], ["a malformed key", "pxi_nope"], ["an API-key-shaped key", "pxs_" + "a".repeat(48)], ["another workspace's key", otherKey], ["an unknown key", "pxi_" + "0".repeat(48)]] as const) {
    const r = await product(worker, slug, k)({ events: [ev()] });
    assert.equal(r.status, 401, what);
    assert.equal(r.headers.get("access-control-allow-origin"), "*", `${what}: the refusal is readable by the page`);
  }
  // The owner's own session cookie opens nothing here: only the key does.
  const withCookie = await product(worker, slug, null)({ events: [ev()] }, { cookie: mira.jar.cookie });
  assert.equal(withCookie.status, 401);
  // Nor does an API key.
  const apiKey = (await mira.call("POST", `/api/w/${slug}/api-keys`, {})).body.key as string;
  assert.equal((await product(worker, slug, null)({ events: [ev()] }, { authorization: `Bearer ${apiKey}` })).status, 401);
});

test("an ingest key can send events and nothing else: it reads nothing and changes nothing", async () => {
  const { worker, mira, slug, key } = await setUp();
  assert.equal((await mira.call("POST", `/api/w/${slug}/screens`, { name: "Send money", key: "send-money" })).status, 201);
  assert.equal((await mira.call("POST", `/api/w/${slug}/screens/send-money/versions/1/publish`)).status, 200);
  const as = async (method: string, path: string, headers: Record<string, string>) => {
    const r = await worker.app.request(`${APP_URL}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: method === "GET" ? undefined : "{}" }, worker.env);
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  for (const headers of [{ "x-polyxd-key": key }, { authorization: `Bearer ${key}` }]) {
    for (const path of [`/api/w/${slug}`, `/api/w/${slug}/insights`, `/api/w/${slug}/insights/money.send`, `/api/w/${slug}/screens`, `/api/w/${slug}/screens/send-money`, `/api/w/${slug}/directions`, `/api/w/${slug}/design-systems`, `/api/w/${slug}/ingest-keys`, `/api/w/${slug}/api-keys`]) {
      const r = await as("GET", path, headers);
      assert.equal(r.status, 401, `GET ${path} with ${Object.keys(headers)[0]}`);
    }
    for (const [method, path] of [["POST", `/api/w/${slug}/ingest-keys`], ["POST", `/api/w/${slug}/api-keys`], ["POST", `/api/w/${slug}/screens`], ["DELETE", `/api/w/${slug}/insights`], ["DELETE", `/api/w/${slug}/screens/send-money`]]) {
      assert.equal((await as(method, path, headers)).status, 401, `${method} ${path}`);
    }
    const me = await as("GET", "/api/me", headers);
    assert.equal(me.body.user, null);
  }
  // And a workspace API key can't read Insights or the ingest keys either: they are for people in Studio.
  const apiKey = (await mira.call("POST", `/api/w/${slug}/api-keys`, {})).body.key as string;
  const machine = worker.client({ key: apiKey });
  assert.equal((await machine.call("GET", `/api/w/${slug}/insights`)).status, 403);
  assert.equal((await machine.call("GET", `/api/w/${slug}/ingest-keys`)).status, 403);
  assert.equal((await machine.call("POST", `/api/w/${slug}/ingest-keys`, {})).status, 403);
});

test("the body: at most 100 events and 64 KB, JSON with an events list", async () => {
  const { worker, slug, key } = await setUp();
  const send = product(worker, slug, key);
  assert.equal((await send({ events: Array.from({ length: 101 }, () => ev()) })).status, 413);
  assert.equal((await send({ events: Array.from({ length: 100 }, () => ev()) })).status, 202);
  assert.equal((await send({ events: [ev({ sessionId: "x".repeat(70_000) })] })).status, 413);
  assert.equal((await send("{not json")).status, 400);
  assert.equal((await send({ event: ev() })).status, 400);
  assert.equal((await send([ev()])).status, 400);
  const empty = await send({ events: [] });
  assert.equal(empty.status, 202);
  assert.equal(empty.body.accepted, 0);
});

test("invalid events are dropped and counted, the rest are counted", async () => {
  const { worker, slug, key } = await setUp();
  const same = ev();
  const r = await product(worker, slug, key)({ events: [ev(), same, same, ev({ type: "made.up" }), ev({ extra: 1 }), 42, ev({ surface: { id: "x", intent: "Not a code" } })] });
  assert.equal(r.status, 202);
  assert.deepEqual(r.body, { accepted: 2, dropped: 5, why: { invalid: 3, duplicate: 1, uncoded: 1 } });
});

test("counts add up across requests, and the report reads them back by intent, source and component", async () => {
  const { worker, mira, slug, key } = await setUp();
  assert.equal((await mira.call("POST", `/api/w/${slug}/screens`, { name: "Send money", key: "send-money", intent: "money.send" })).status, 201);
  const send = product(worker, slug, key);
  const gen = { id: "send-gen", intent: "money.send", pattern: "multi-step-form", generator: "polyxd-3b@0.1.0" };
  const batch = (session: string, surface = ev().surface, finish = true) => [
    ev({ sessionId: session, surface }),
    ev({ sessionId: session, surface, type: "input.error", component: { id: "amount-field", key: "amount", type: "TextInput" }, reason: "required", durationMs: 900, steps: 1 }),
    ev({ sessionId: session, surface, type: "action.taken", component: { id: "form", type: "Form" }, capability: "transfer.review", durationMs: 4000, steps: 3 }),
    finish
      ? ev({ sessionId: session, surface, type: "task.completed", component: { id: "form", type: "Form" }, capability: "transfer.review", durationMs: 4000, steps: 3 })
      : ev({ sessionId: session, surface, type: "task.abandoned", reason: "dismiss", durationMs: 7000, steps: 2 }),
  ];
  await send({ events: [...batch("a"), ...batch("b"), ...batch("c", undefined, false)] });
  await send({ events: [...batch("d", gen), ...batch("e", gen, false), ev({ type: "feedback", rating: 1, surface: gen }), ev({ type: "feedback", rating: -1, surface: gen })] });
  await send({ events: [ev({ surface: { id: "track", intent: "orders.track" } })] });

  const all = await mira.call("GET", `/api/w/${slug}/insights?days=7`);
  assert.equal(all.status, 200, JSON.stringify(all.body));
  assert.equal(all.body.retentionDays, 90);
  assert.equal(all.body.ingestKeys, 1);
  assert.deepEqual(all.body.intents.map((i: { intent: string }) => i.intent), ["money.send", "orders.track"]);
  const m = all.body.intents[0];
  assert.equal(m.shown, 5);
  assert.equal(m.completed, 3);
  assert.equal(m.abandoned, 2);
  assert.equal(m.completionRate, 0.6);
  assert.equal(m.inputErrors, 5);
  assert.deepEqual(m.topInputErrors, [{ component: "amount", reason: "required", count: 5 }]);
  assert.equal(m.time.meanMs, 4000);
  assert.equal(m.time.median, "2–5 s");
  assert.deepEqual(m.feedback, { count: 2, average: 0 });
  assert.deepEqual(m.sources, ["authored", "generated"]);
  assert.deepEqual(all.body.screens["money.send"], [{ key: "send-money", name: "Send money" }]);

  const one = await mira.call("GET", `/api/w/${slug}/insights/money.send?days=30`);
  assert.equal(one.status, 200);
  assert.equal(one.body.series.length, 30);
  assert.deepEqual(one.body.series.at(-1), { day: new Date().toISOString().slice(0, 10), shown: 5, completed: 3, abandoned: 2, inputErrors: 5 });
  assert.deepEqual(one.body.funnel, { shown: 5, started: 5, completed: 3 });
  assert.deepEqual(one.body.bySource.map((s: { source: string; shown: number; completed: number }) => [s.source, s.shown, s.completed]), [["authored", 3, 2], ["generated", 2, 1]]);
  assert.deepEqual(one.body.inputErrorsByComponent[0], { component: "amount", count: 5, reasons: [{ key: "required", count: 5 }] });
  assert.deepEqual(one.body.bySurface.map((s: { surface: string }) => s.surface), ["send", "send-gen"]);
  assert.deepEqual(one.body.screens, [{ key: "send-money", name: "Send money" }]);
  assert.equal((await mira.call("GET", `/api/w/${slug}/insights?days=365`)).status, 400);

  // Deleting them is the owner's.
  const del = await mira.call("DELETE", `/api/w/${slug}/insights`);
  assert.equal(del.status, 200);
  assert.equal((await mira.call("GET", `/api/w/${slug}/insights`)).body.intents.length, 0);
});

test("D1 keeps counts and nothing else: no value, text, session id or timestamp from a hostile event", async () => {
  const { worker, slug, key } = await setUp();
  const secrets = ["priya.shah@example.com", "4111111111111111", "0412 345 678", "Send £40 to Priya", "s_secret_session_9f3", "2026-09-29T10:11:12.345Z", "calm-finance@0.1.0", "model-x@9", "variant-b-secret", "Priya"];
  const [email, card, phone, text, session, stamp, direction, generator, variant] = secrets;
  const events = [
    // Extra properties: the whole event is refused.
    ev({ value: card, data: { email }, surface: { id: "send", intent: "money.send", title: text } }),
    ev({ component: { id: "amount", key: "amount", value: card } }),
    ev({ actor: { kind: "human", name: "Priya" } }),
    // Valid events carrying values where codes belong, and things Insights never keeps.
    ev({ sessionId: session, timestamp: stamp, surface: { id: "send", intent: "money.send", direction, generator, experiment: { copy: variant }, journey: email } }),
    ev({ type: "action.taken", capability: email, component: { id: card, key: phone, type: text } }),
    ev({ type: "input.error", reason: `Card ${card} declined`, component: { key: email } }),
    ev({ type: "feedback", rating: 1, reason: text }),
    ev({ type: "checkpoint.reached", checkpoint: email, capability: "transfer.review" }),
    ev({ type: "status.shown", reason: phone, component: { id: "status", type: "Status" } }),
    ev({ type: "task.abandoned", reason: "Priya", durationMs: 99 }),
    ev({ surface: { id: email, intent: "money.send", pattern: text } }),
  ];
  const r = await product(worker, slug, key)({ events });
  assert.equal(r.status, 202);
  assert.equal(r.body.why.invalid, 3);
  const db = everything(worker);
  for (const s of secrets) assert.ok(!db.includes(s), `D1 holds no trace of ${s}`);
  // What it does hold: the intent, and counts.
  assert.ok(db.includes("money.send"));
});

test("requests are limited per address and per key, with a Retry-After", async () => {
  const { worker, slug, key } = await setUp();
  const one = product(worker, slug, key, "198.51.100.7");
  for (let i = 0; i < LIMITS.address; i++) assert.equal((await one({ events: [] })).status, 202, `request ${i + 1}`);
  const limited = await one({ events: [] });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) >= 1);
  assert.equal(limited.headers.get("access-control-allow-origin"), "*");
  // Another address is fine, until the key itself has had its fill.
  let n = LIMITS.address;
  let status = 202;
  for (let i = 0; status === 202 && i < LIMITS.key + 10; i++) {
    status = (await product(worker, slug, key)({ events: [] })).status;
    if (status === 202) n++;
  }
  assert.equal(status, 429);
  assert.equal(n, LIMITS.key, "the key's limit counts every address");
});

test("counts older than 90 days are cleared, and a workspace past its daily rows is folded into (other)", async () => {
  const { worker, mira, slug, key } = await setUp();
  const me = (await mira.call("GET", "/api/me")).body;
  const wsId = me.workspaces[0].id as string;
  const db = (worker.env.DB as unknown as { db: { exec: (s: string) => void; prepare: (s: string) => { all: (...a: unknown[]) => Record<string, unknown>[] } } }).db;
  const old = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  db.exec(`INSERT INTO insight_counts (workspace_id, day, intent, type, count) VALUES ('${wsId}', '${old}', 'money.send', 'surface.shown', 5)`);
  // A day's worth of distinct rows, at the limit.
  db.exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${MAX_ROWS_PER_DAY}) INSERT INTO insight_counts (workspace_id, day, intent, type, count) SELECT '${wsId}', '${today}', 'intent.' || i, 'surface.shown', 1 FROM n`);
  const r = await product(worker, slug, key)({ events: [ev({ surface: { id: "fresh", intent: "brand.new" } })] });
  assert.equal(r.status, 202);
  assert.equal(r.body.folded, true);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM insight_counts WHERE day = ?").all(old)[0].n, 0, "the old day is gone");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM insight_counts WHERE intent = 'brand.new'").all()[0].n, 0);
  assert.equal(db.prepare("SELECT count FROM insight_counts WHERE intent = '(other)'").all()[0].count, 1);
});
