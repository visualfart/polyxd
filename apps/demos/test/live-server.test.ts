import { test } from "node:test";
import assert from "node:assert/strict";
import type { GenerateRequest, Generator } from "@polyxd/runtime";
import { actionNames, readEvents, type LiveEvent } from "../kit/live.ts";
import { createLiveApi, generatorFromEnv, type LiveApiOptions, type LiveEnv } from "../server/live.ts";
import { cannedDocument, fakeGenerator } from "../server/fake.ts";
import { PRODUCTS } from "../server/products.ts";

/**
 * The live endpoint with a fake generator: no network and no key. What a visitor sees depends on
 * these: 503 with no key (the demos behave as before), a checked document streamed when a model
 * answers well, "not yet" when repair fails, a rate limit, and only the product's own capabilities.
 */

const ORIGIN = "http://localhost:5174";
const KEYED: LiveEnv = { ANTHROPIC_API_KEY: "not-a-real-key" };

function api(generator: (product: string) => Generator | undefined, extra: Partial<LiveApiOptions> = {}) {
  const lines: Record<string, unknown>[] = [];
  const handle = createLiveApi({ generator: (_env, _url, product) => generator(product), log: (l) => lines.push(l), ...extra });
  return { handle, lines };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/demos/api/generate`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, "cf-connecting-ip": "203.0.113.7", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

async function events(res: Response): Promise<LiveEvent[]> {
  assert.equal(res.headers.get("content-type"), "text/event-stream; charset=utf-8");
  const out: LiveEvent[] = [];
  for await (const e of readEvents(res.body!)) out.push(e);
  return out;
}

test("with no key configured, both routes answer 503 { live: false } and no model is built", async () => {
  const handle = createLiveApi({ log: () => undefined });
  for (const env of [{}, { POLYXD_PROVIDER: "openai", POLYXD_API_KEY: "x" } as LiveEnv, { POLYXD_DEMOS_FAKE: "1" } as LiveEnv]) {
    // The fake only answers on a local host; polyxd.com never gets it, whatever the environment says.
    const probe = await handle(new Request("https://polyxd.com/demos/api/live"), env);
    assert.equal(probe.status, 503);
    assert.deepEqual(await probe.json(), { live: false });
    const res = await handle(new Request("https://polyxd.com/demos/api/generate", { method: "POST", body: JSON.stringify({ product: "halden", ask: "anything" }) }), env);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { live: false });
  }
  assert.equal(generatorFromEnv({}, new URL(ORIGIN), "halden"), undefined);
  assert.equal(generatorFromEnv({ POLYXD_DEMOS_FAKE: "1" }, new URL("https://polyxd.com/"), "halden"), undefined);
  assert.equal(generatorFromEnv({ POLYXD_DEMOS_FAKE: "1" }, new URL(ORIGIN), "halden")?.name, "fake");
  assert.equal(generatorFromEnv(KEYED, new URL("https://polyxd.com/"), "halden")?.name, "anthropic");
  // A provider that needs a model gets none without one.
  assert.equal(generatorFromEnv({ POLYXD_PROVIDER: "gemini", POLYXD_API_KEY: "x" }, new URL("https://polyxd.com/"), "halden"), undefined);
});

test("the probe says live when a model is configured", async () => {
  const { handle } = api((p) => fakeGenerator(p));
  const res = await handle(new Request(`${ORIGIN}/demos/api/live`), KEYED);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { live: true });
});

for (const product of Object.keys(PRODUCTS)) {
  test(`${product}: a good generation streams progress and ends with a checked document`, async () => {
    const { handle, lines } = api((p) => fakeGenerator(p));
    const ask = "a question the library has no screen for";
    const res = await handle(post({ product, ask, intent: "live.question_library_screen" }), KEYED);
    assert.equal(res.status, 200);
    const got = await events(res);
    assert.equal(got[0].type, "started");
    assert.ok(got.some((e) => e.type === "progress" && e.chars > 0), "progress is streamed");
    const attempt = got.find((e) => e.type === "attempt");
    assert.ok(attempt && attempt.type === "attempt" && attempt.valid, JSON.stringify(got.filter((e) => e.type !== "progress")));
    const done = got.at(-1)!;
    assert.equal(done.type, "done");
    if (done.type !== "done") return;
    assert.equal(done.intent, "live.question_library_screen");
    assert.equal(done.document.surface.intent, "live.question_library_screen");
    assert.equal(done.document.data, undefined, "the seed snapshot stays on the server");
    for (const name of actionNames(done.document)) assert.ok(done.capabilities.includes(name), name);
    // The log line is counts only: never the ask.
    assert.equal(lines.length, 1);
    assert.equal(lines[0].outcome, "done");
    assert.ok(!JSON.stringify(lines).includes("question"), JSON.stringify(lines));
  });
}

test("a repair that works still ends with the document; the model saw its problems", async () => {
  const seen: GenerateRequest[] = [];
  const { handle } = api((p) => fakeGenerator(p, { behaviour: "fixable", onRequest: (r) => seen.push(r) }));
  const got = await events(await handle(post({ product: "halden", ask: "where does my money go" }), KEYED));
  const attempts = got.filter((e) => e.type === "attempt");
  assert.deepEqual(attempts.map((a) => a.type === "attempt" && a.valid), [false, true]);
  assert.equal(got.at(-1)!.type, "done");
  assert.equal(seen.length, 2);
  assert.match(seen[1].messages.at(-1)!.content, /made\.up|nothing\/here/);
});

test("when repair fails, the stream says not yet and carries no document", async () => {
  const { handle, lines } = api((p) => fakeGenerator(p, { behaviour: "broken" }));
  const got = await events(await handle(post({ product: "quay", ask: "show me something odd" }), KEYED));
  assert.deepEqual(got.at(-1), { type: "not-yet", reason: "invalid" });
  assert.ok(!got.some((e) => e.type === "done"));
  assert.equal(got.filter((e) => e.type === "attempt").length, 2, "one answer and one repair, no more");
  assert.equal(lines[0].outcome, "invalid");
  assert.ok(!JSON.stringify(lines).includes("odd"));
});

test("a generator that throws is not yet too, and nothing it said is logged", async () => {
  const { handle, lines } = api(() => ({
    name: "boom",
    async generate() {
      throw new Error("provider said: the ask was 'secret words'");
    },
  }));
  const got = await events(await handle(post({ product: "wexley", ask: "secret words" }), KEYED));
  assert.deepEqual(got.at(-1), { type: "not-yet", reason: "generator" });
  assert.ok(!JSON.stringify(lines).includes("secret"));
});

test("only the product's own low-risk capabilities are offered, and a narrower list only narrows", async () => {
  const prompts: string[] = [];
  const { handle } = api((p) => fakeGenerator(p, { onRequest: (r) => prompts.push(r.messages[0].content) }));
  let got = await events(await handle(post({ product: "halden", ask: "where does my money go" }), KEYED));
  let done = got.at(-1)!;
  assert.equal(done.type, "done");
  if (done.type !== "done") return;
  const halden = PRODUCTS.halden.registry.capabilities;
  for (const name of done.capabilities) {
    assert.ok(halden[name], `${name} is Halden's`);
    assert.ok(["none", "low"].includes(halden[name].risk), `${name} is low risk`);
  }
  for (const name of ["transfer.confirm", "dispute.raise", "subscription.cancel", "nav.go", "ask.open"]) assert.ok(!done.capabilities.includes(name), `${name} is not offered`);
  const offered = prompts[0].slice(prompts[0].indexOf("Capabilities you may use:"), prompts[0].indexOf("DATA"));
  assert.match(offered, /spend\.category/);
  assert.doesNotMatch(offered, /transfer\.confirm|orders\.fulfill|made\.up/);

  // Asking for another product's capability, or a consequential one, gets nothing extra.
  got = await events(await handle(post({ product: "halden", ask: "where does my money go", capabilities: ["spend.category", "transfer.confirm", "orders.fulfill", "made.up"] }), KEYED));
  done = got.at(-1)!;
  assert.equal(done.type, "done");
  if (done.type === "done") assert.deepEqual(done.capabilities, ["spend.category"]);

  // A document that uses a capability it wasn't offered never reaches the browser.
  const { handle: narrow } = api((p) => fakeGenerator(p));
  got = await events(await narrow(post({ product: "halden", ask: "where does my money go", capabilities: ["card.freeze"] }), KEYED));
  assert.equal(got.at(-1)!.type, "not-yet");
});

test("the data is the product's seed, whatever the request carries", async () => {
  const prompts: string[] = [];
  const { handle } = api((p) => fakeGenerator(p, { onRequest: (r) => prompts.push(r.messages[0].content) }));
  await events(await handle(post({ product: "halden", ask: "where does my money go", data: { balance: { amount: 1e9 } } }), KEYED));
  const data = JSON.parse(prompts[0].split("\n")[prompts[0].split("\n").indexOf("DATA (bind to it with JSON Pointers; do not copy values into text):") + 1]);
  assert.deepEqual(Object.keys(data).sort(), Object.keys(PRODUCTS.halden.spec.data).sort());
  assert.notEqual(data.balance.amount, 1e9);
  assert.deepEqual(data, JSON.parse(JSON.stringify(PRODUCTS.halden.data(), (k, v) => (k === "asOf" ? data.balance.asOf : v))));
});

test("a remembered screen is passed to the model as last time's", async () => {
  const prompts: string[] = [];
  const { handle } = api((p) => fakeGenerator(p, { onRequest: (r) => prompts.push(r.messages[0].content) }));
  const previous = cannedDocument("halden", "live.money_go");
  const got = await events(await handle(post({ product: "halden", ask: "where does my money go", intent: "live.money_go", previous }), KEYED));
  assert.deepEqual(got[0], { type: "started", remembered: true });
  assert.match(prompts[0], /Last time, this intent showed the screen below/);
  // Junk in place of a document is ignored, not an error.
  const again = await events(await handle(post({ product: "halden", ask: "where does my money go", intent: "live.money_go", previous: { nope: true } }), KEYED));
  assert.deepEqual(again[0], { type: "started", remembered: false });
});

test("per-client rate limit: the seventh ask in a minute is refused with Retry-After", async () => {
  let t = 1_000_000;
  const { handle } = api((p) => fakeGenerator(p), { now: () => t, rateLimit: { max: 6, windowMs: 60_000 } });
  for (let i = 0; i < 6; i++) assert.equal((await handle(post({ product: "halden", ask: `ask ${i}` }), KEYED)).status, 200);
  const res = await handle(post({ product: "halden", ask: "one more" }), KEYED);
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get("retry-after")) > 0);
  // Another client isn't affected, and the window moves on.
  assert.equal((await handle(post({ product: "halden", ask: "mine" }, { "cf-connecting-ip": "198.51.100.2" }), KEYED)).status, 200);
  t += 60_001;
  assert.equal((await handle(post({ product: "halden", ask: "later" }), KEYED)).status, 200);
});

test("bad requests are refused before any model is called", async () => {
  let calls = 0;
  const { handle } = api((p) => {
    const g = fakeGenerator(p);
    return { name: g.name, generate: (r) => (calls++, g.generate(r)) };
  });
  const cases: [Request, number][] = [
    [post({ product: "halden", ask: "x".repeat(201) }), 400],
    [post({ product: "halden", ask: "   " }), 400],
    [post({ product: "nowhere", ask: "hello" }), 404],
    [post({ product: "__proto__", ask: "hello" }), 404],
    [post("{not json"), 400],
    [post({ product: "halden", ask: "hello" }, { origin: "https://elsewhere.example" }), 403],
    [new Request(`${ORIGIN}/demos/api/generate`), 405],
    [new Request(`${ORIGIN}/demos/api/other`), 404],
  ];
  for (const [req, status] of cases) {
    const res = await handle(req, KEYED);
    assert.equal(res.status, status, `${req.method} ${req.url}`);
  }
  assert.equal(calls, 0);
});

test("each generation is reported to onGeneration as counts only, and the site sends it to PostHog only with a key", async () => {
  const { demoGeneration } = await import("../../site/worker/analytics.ts");
  const reported: Record<string, unknown>[] = [];
  const waited: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void waited.push(p) };
  const { handle } = api((p) => fakeGenerator(p), { onGeneration: (s) => void reported.push({ ...s }) });
  const ask = "zq split the dinner with Priya Venkataraman";
  await events(await handle(post({ product: "halden", ask }), KEYED, ctx));
  await Promise.all(waited);
  assert.equal(reported.length, 1);
  const summary = reported[0];
  assert.deepEqual(Object.keys(summary).sort(), ["attempts", "inputTokens", "ms", "outcome", "outputTokens", "product"]);
  assert.equal(summary.product, "halden");
  assert.equal(summary.outcome, "done");
  assert.ok(!JSON.stringify(summary).includes("zq"), "never the ask");

  // The site's Worker: nothing without a key, one anonymous event with one.
  const sent: { url: string; body: any }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => (sent.push({ url: String(url), body: JSON.parse(String(init?.body)) }), new Response("{}"))) as typeof fetch;
  assert.equal(demoGeneration({}, summary as never, fetcher), undefined);
  await demoGeneration({ POSTHOG_KEY: "phc_testkey0123456789" }, summary as never, fetcher);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "https://us.i.posthog.com/i/v0/e/");
  assert.equal(sent[0].body.event, "demo_live_generation");
  const props = sent[0].body.properties;
  assert.deepEqual(
    { product: props.product, outcome: props.outcome, attempts: props.attempts, repaired: props.repaired, anonymous: props.$process_person_profile, geo: props.$geoip_disable },
    { product: "halden", outcome: "done", attempts: summary.attempts, repaired: (summary.attempts as number) > 1, anonymous: false, geo: true },
  );
  assert.equal(props.tokens, props.input_tokens + props.output_tokens);
  assert.equal(typeof props.ms, "number");
  assert.ok(!JSON.stringify(sent[0].body).includes("zq"), "never the ask");
});
