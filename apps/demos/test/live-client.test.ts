import { test } from "node:test";
import assert from "node:assert/strict";
import { matchAsk } from "../kit/ask.ts";
import { INTENT_KEY, allowAction, createLiveClient, liveIntentKey, readEvents, routeAsk, sse, type LiveEvent, type LiveSpec } from "../kit/live.ts";
import { createLiveApi, type LiveEnv } from "../server/live.ts";
import { cannedDocument, fakeGenerator } from "../server/fake.ts";
import { LIVE as HALDEN } from "../halden/live.ts";
import { seed } from "../halden/seed.ts";
import { surfaceData } from "../halden/views.ts";

/**
 * The browser's side of live generation: the library first, then live only when the endpoint has a
 * model, "not yet" otherwise; the stream read in any chunking; interface memory kept so the same
 * ask again is recognisable; and only offered actions reach the product.
 */

const ORIGIN = "http://localhost:5174";

function storage() {
  const m = new Map<string, string>();
  return { map: m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

/** A fetch that answers from the real endpoint handler, in process. */
function endpoint(env: LiveEnv, behaviour: "ok" | "broken" = "ok") {
  const bodies: any[] = [];
  const handle = createLiveApi({ generator: (_e, _u, product) => (env.ANTHROPIC_API_KEY ? fakeGenerator(product, { behaviour }) : undefined), log: () => undefined });
  const calls: string[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    if (init?.body) bodies.push(JSON.parse(String(init.body)));
    return handle(new Request(new URL(String(input), ORIGIN), { ...init, headers: { ...(init?.headers as Record<string, string>), origin: ORIGIN } }), env);
  }) as typeof fetch;
  return { fetch: f, calls, bodies };
}

const stream = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const s of chunks) c.enqueue(new TextEncoder().encode(s));
      c.close();
    },
  });

test("server-sent events read the same however the bytes are split", async () => {
  const all: LiveEvent[] = [{ type: "started", remembered: false }, { type: "progress", attempt: 1, chars: 120 }, { type: "not-yet", reason: "invalid" }];
  const text = all.map(sse).join("");
  for (const size of [1, 3, 7, 50, text.length]) {
    const chunks = Array.from({ length: Math.ceil(text.length / size) }, (_, i) => text.slice(i * size, (i + 1) * size));
    const got: LiveEvent[] = [];
    for await (const e of readEvents(stream(chunks))) got.push(e);
    assert.deepEqual(got, all, `chunks of ${size}`);
  }
  const crlf: LiveEvent[] = [];
  for await (const e of readEvents(stream(["event: started\r\ndata: {\"remembered\":true}\r\n\r\nevent: bad\r\ndata: {nope\r\n\r\n"]))) crlf.push(e);
  assert.deepEqual(crlf, [{ type: "started", remembered: true }]);
});

test("the library always answers first, and live is only asked when the endpoint has a model", async () => {
  const intents = [{ id: "card.freeze", title: "Freeze", ask: ["freeze my card"] }];
  const match = (t: string) => matchAsk(t, intents);
  let probes = 0;
  const on = { available: async () => (probes++, true) };
  const off = { available: async () => (probes++, false) };
  assert.equal((await routeAsk("freeze my card", match, on)).kind, "library");
  assert.equal(probes, 0, "a library match never waits on the endpoint");
  assert.deepEqual(await routeAsk("book me a flight", match, off), { kind: "miss" });
  assert.deepEqual(await routeAsk("book me a flight", match, on), { kind: "live" });
  assert.deepEqual(await routeAsk("book me a flight", match, null), { kind: "miss" });
});

test("with no key the probe is no, once per page, and a generation is a miss without a stream", async () => {
  const { fetch, calls } = endpoint({});
  const client = createLiveClient({ spec: HALDEN, fetch, storage: storage() });
  assert.equal(await client.available(), false);
  assert.equal(await client.available(), false);
  assert.deepEqual(calls, ["/demos/api/live"]);
  assert.deepEqual(await client.generate("where does my money go"), { kind: "miss", reason: "off" });
});

test("a static host with no endpoint, or no network, reads as no", async () => {
  const notFound = createLiveClient({ spec: HALDEN, fetch: (async () => new Response("<!doctype html>", { status: 404 })) as typeof fetch, storage: storage() });
  assert.equal(await notFound.available(), false);
  const offline = createLiveClient({ spec: HALDEN, fetch: (async () => Promise.reject(new TypeError("offline"))) as typeof fetch, storage: storage() });
  assert.equal(await offline.available(), false);
  assert.deepEqual(await offline.generate("where does my money go"), { kind: "miss", reason: "network" });
});

test("a live answer becomes an intent the product renders with its own data, and is remembered", async () => {
  const { fetch, bodies } = endpoint({ ANTHROPIC_API_KEY: "not-a-real-key" });
  const store = storage();
  const client = createLiveClient({ spec: HALDEN, fetch, storage: store });
  assert.equal(await client.available(), true);
  const seen: LiveEvent["type"][] = [];
  const out = await client.generate("where does my money go", { onEvent: (e) => seen.push(e.type) });
  assert.equal(out.kind, "live");
  if (out.kind !== "live") return;
  assert.deepEqual([seen[0], seen.at(-1)], ["started", "done"]);
  assert.match(out.intent.id, INTENT_KEY);
  assert.equal(out.intent.document.surface.title, "Where your money goes");
  assert.equal(out.intent.document.data, undefined);
  assert.deepEqual(out.intent.data, HALDEN.data);
  // The product builds the surface's data from its own store, with the same views the server used.
  const data = surfaceData(seed(), out.intent, {});
  assert.deepEqual(Object.keys(data).sort(), Object.keys(HALDEN.data).sort());
  assert.ok(out.capabilities.includes("spend.category"));
  // Nothing but the ask, the product and the intent key goes up.
  assert.deepEqual(Object.keys(bodies[0]).sort(), ["ask", "intent", "product"]);

  // Asked again in other words: the same intent, with last time's screen sent back.
  const again = await client.generate("where did my money go");
  assert.equal(again.kind, "live");
  assert.equal(bodies[1].intent, bodies[0].intent);
  assert.deepEqual(bodies[1].previous, out.intent.document);
  assert.ok([...store.map.keys()].some((k) => k.startsWith("polyxd-demo:halden:live:screen:")));
});

test("when the checks fail, the client gets a miss, not a screen", async () => {
  const { fetch } = endpoint({ ANTHROPIC_API_KEY: "not-a-real-key" }, "broken");
  const client = createLiveClient({ spec: HALDEN, fetch, storage: storage() });
  assert.deepEqual(await client.generate("where does my money go"), { kind: "miss", reason: "invalid" });
});

test("a malformed or mismatched done is a miss; too long an ask never leaves the browser", async () => {
  const spec: LiveSpec = HALDEN;
  const reply = (e: LiveEvent) => (async () => new Response(sse({ type: "started", remembered: false }) + sse(e), { headers: { "content-type": "text/event-stream" } })) as typeof fetch;
  const doc = cannedDocument("halden", "live.where_money_go");
  let client = createLiveClient({ spec, fetch: reply({ type: "done", intent: "live.something_else", document: doc, capabilities: [], attempts: 1, warnings: 0 }), storage: storage() });
  assert.deepEqual(await client.generate("where does my money go"), { kind: "miss", reason: "malformed" });
  client = createLiveClient({ spec, fetch: reply({ type: "done", intent: "live.money_go", document: { nope: 1 } as never, capabilities: [], attempts: 1, warnings: 0 }), storage: storage() });
  assert.deepEqual(await client.generate("where does my money go"), { kind: "miss", reason: "malformed" });
  let called = false;
  client = createLiveClient({ spec, fetch: (async () => ((called = true), new Response())) as typeof fetch, storage: storage() });
  assert.deepEqual(await client.generate("x".repeat(201)), { kind: "miss", reason: "too-long" });
  assert.equal(called, false);
});

test("storage that throws loses memory, never the screen", async () => {
  const { fetch } = endpoint({ ANTHROPIC_API_KEY: "not-a-real-key" });
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("blocked"); } };
  const client = createLiveClient({ spec: HALDEN, fetch, storage: broken });
  assert.equal((await client.generate("where does my money go")).kind, "live");
});

test("intent keys are stable, spec-valid, and reused for the same ask in other words", () => {
  const a = liveIntentKey("Where does my money go?");
  assert.equal(a, liveIntentKey("where does my money go"));
  assert.match(a, INTENT_KEY);
  assert.match(liveIntentKey("2024 taxes, £300!"), INTENT_KEY);
  assert.match(liveIntentKey("?!"), INTENT_KEY);
  assert.match(liveIntentKey("a ".repeat(100) + "very long ask about everything under the sun and more"), INTENT_KEY);
  const known = [{ id: a, title: "Where your money goes", ask: ["where does my money go"] }];
  assert.equal(liveIntentKey("where did my money go", known), a);
  assert.notEqual(liveIntentKey("book a flight to Lisbon", known), a);
});

test("an action from a generated screen reaches the product only when it was offered", () => {
  const offered = ["spend.category", "card.freeze"];
  assert.equal(allowAction({ name: "spend.category" }, offered), true);
  assert.equal(allowAction({ name: "ui.dismiss" }, offered), true);
  assert.equal(allowAction({ name: "transfer.confirm" }, offered), false);
  assert.equal(allowAction({ name: "made.up" }, offered), false);
});
