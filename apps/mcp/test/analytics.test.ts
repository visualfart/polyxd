/**
 * The hosted server's anonymous analytics (src/analytics.ts): nothing at all without a key, and
 * with one, the right events carrying counts and fixed names only, never what the model sent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import catalog from "@polyxd/spec/catalog/catalog.json" with { type: "json" };
import { createApp, type Env } from "../src/app.ts";
import { componentCounts, eventsFor, posthogConfig, rpcMessages, userAgentProduct } from "../src/analytics.ts";
import type { RequestLog } from "@polyxd/mcp/http";

const view = readFileSync(createRequire(import.meta.url).resolve("@polyxd/mcp/view.html"), "utf8");
const KEY = "phc_testkey0123456789";

/** An app whose PostHog requests are recorded, and a context that collects its after-answer work. */
function harness() {
  const sent: { url: string; body: any }[] = [];
  const logs: RequestLog[] = [];
  const analyticsFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response("{}");
  }) as typeof fetch;
  const app = createApp({ viewHtml: () => view, log: (e) => logs.push(e), analyticsFetch });
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) };
  const settle = async () => {
    while (pending.length) await Promise.all(pending.splice(0));
  };
  return { app, ctx, sent, logs, settle };
}

async function connect(h: ReturnType<typeof harness>, env: Env) {
  const client = new Client({ name: "worker-test", version: "1.2.3" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("https://mcp.polyxd.com/mcp"), {
      fetch: (url, init) => h.app.fetch(new Request(url, init), env, h.ctx),
      requestInit: { headers: { "user-agent": "claude-user/1.0 (+https://example.test; secret-build 42)" } },
    }),
  );
  return client;
}

/**
 * A document and data written so that every string and number in them is unmistakable: if any of
 * them reaches an event, the test finds it.
 */
const SECRET_DOC = {
  specVersion: "0.3.0",
  surface: { id: "zqsurfaceid", title: "Zq Send money to Priya Venkataraman", intent: "zqmoney.zqsend" },
  root: "zqroot",
  components: [
    { id: "zqroot", component: "Form", children: ["zqamount", "zqnote"], submit: { label: "Zq Send it now", action: { event: { name: "zqtransfer.zqsend", context: { amount: { path: "/zqdraft/zqamount" } } } } } },
    { id: "zqamount", component: "TextInput", label: "Zq Amount in pounds", value: { path: "/zqdraft/zqamount" } },
    { id: "zqnote", component: "Text", text: { path: "/zqdraft/zqmemo" } },
  ],
};
const SECRET_DATA = { zqdraft: { zqamount: 987654.321, zqmemo: "Zq dinner at Dishoom, table 12" } };
const SECRET_DIRECTION = { version: "9.8.7", name: "zqdirection", profile: { voice: { tone: ["zqwarm"] } } };

/** Every string and every long number in a value, except the component types, modes and pack names events may carry. */
function leaves(v: unknown, out: string[] = []): string[] {
  const allowed = new Set([...Object.keys((catalog as { components: object }).components), "light", "dark"]);
  if (typeof v === "string" && v.length >= 3 && !allowed.has(v)) out.push(v);
  else if (typeof v === "number" && String(v).replace(/\D/g, "").length >= 5) out.push(String(v));
  else if (Array.isArray(v)) v.forEach((x) => leaves(x, out));
  // Keys are the spec's own field names ("label", "components"), except the ones the data made up (zq…).
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) (k.startsWith("zq") && leaves(k, out), leaves(x, out));
  return out;
}

test("no POSTHOG_KEY: nothing is read, cloned, deferred or sent", async () => {
  const h = harness();
  const deferred: unknown[] = [];
  const realFetch = globalThis.fetch;
  let globalCalls = 0;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => (globalCalls++, realFetch(...args))) as typeof fetch;
  try {
    for (const env of [{}, { POSTHOG_KEY: "" }, { POSTHOG_KEY: "not-a-project-key" }] as Env[]) {
      const client = new Client({ name: "worker-test", version: "0" });
      await client.connect(new StreamableHTTPClientTransport(new URL("https://mcp.polyxd.com/mcp"), { fetch: (url, init) => h.app.fetch(new Request(url, init), env, { waitUntil: (p) => void deferred.push(p) }) }));
      await client.callTool({ name: "polyxd_show", arguments: { document: SECRET_DOC, data: SECRET_DATA } });
      await client.close();
    }
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(h.sent.length, 0);
  assert.equal(globalCalls, 0, "no request leaves the Worker");
  assert.equal(deferred.length, 0, "no work is left running after the answer");
  assert.equal(posthogConfig({}), null);
});

test("with a key: one event per initialize and per tool call, with counts and fixed names only", async () => {
  const h = harness();
  const env: Env = { POSTHOG_KEY: KEY };
  const client = await connect(h, env);
  const calls = [
    { name: "polyxd_guide", arguments: {} },
    { name: "polyxd_validate", arguments: { document: SECRET_DOC, data: SECRET_DATA } },
    { name: "polyxd_verify", arguments: { document: SECRET_DOC, data: SECRET_DATA, direction: SECRET_DIRECTION } },
    { name: "polyxd_show", arguments: { document: SECRET_DOC, data: SECRET_DATA, pack: "Carbon", mode: "dark" } },
    { name: "polyxd_show", arguments: { document: SECRET_DOC, pack: "zq-no-such-pack" } },
    { name: "polyxd_show", arguments: { document: { ...SECRET_DOC, root: "zqmissing" }, data: SECRET_DATA } },
    { name: "polyxd_components", arguments: { name: "ZqNoSuchComponent" } },
  ];
  try {
    for (const c of calls) await client.callTool(c);
  } finally {
    await client.close();
  }
  await h.settle();

  assert.ok(h.sent.every((s) => s.url === "https://us.i.posthog.com/i/v0/e/"), "the US cloud by default");
  const events = h.sent.map((s) => s.body);
  const init = events.filter((e) => e.event === "mcp_initialize");
  const tools = events.filter((e) => e.event === "mcp_tool_called");
  assert.equal(init.length, 1);
  assert.equal(tools.length, calls.length);
  assert.deepEqual(new Set(events.map((e) => e.event)), new Set(["mcp_initialize", "mcp_tool_called"]));

  for (const e of events) {
    assert.equal(e.api_key, KEY);
    assert.match(e.distinct_id, /^[0-9a-f-]{36}$/);
    assert.equal(e.properties.$process_person_profile, false);
    assert.equal(e.properties.$geoip_disable, true);
    assert.equal(e.properties.$ip, null);
    assert.equal(e.properties.client_product, "claude-user", "the User-Agent's product name, and nothing after it");
  }
  assert.equal(new Set(events.map((e) => e.distinct_id)).size, events.length, "no two events share an id");

  assert.equal(init[0].properties.client_name, "worker-test");
  assert.equal(init[0].properties.client_version, "1.2.3");
  assert.match(init[0].properties.protocol_version, /^\d{4}-\d{2}-\d{2}$/);

  const [guide, validate, verify, shown, badPack, invalid, component] = tools.map((e) => e.properties);
  assert.deepEqual([guide.tool, guide.ok], ["polyxd_guide", true]);
  assert.equal(guide.components, undefined);
  assert.deepEqual(validate.components, { Form: 1, TextInput: 1, Text: 1 });
  assert.equal(validate.has_data, true);
  assert.equal(typeof validate.errors, "number");
  assert.equal(typeof validate.warnings, "number");
  assert.equal(verify.has_direction, true);
  assert.equal(verify.has_registry, false);
  assert.equal(shown.ok, true);
  assert.equal(shown.pack, "carbon", "the pack the server resolved, not what the model typed");
  assert.equal(shown.mode, "dark");
  assert.deepEqual([badPack.ok, badPack.error, badPack.pack, badPack.mode], [false, "unknown_pack", undefined, "auto"]);
  assert.deepEqual([invalid.ok, invalid.error], [false, "invalid_document"]);
  assert.ok(invalid.errors > 0);
  assert.deepEqual([component.tool, component.ok, component.error], ["polyxd_components", false, "unknown_component"]);
  for (const t of tools) assert.equal(typeof t.properties.duration_ms, "number");

  // The test that matters: nothing the model sent is in any event, in any form.
  const sentText = JSON.stringify(events.map((e) => ({ event: e.event, properties: e.properties })));
  for (const leaf of new Set(leaves(calls.map((c) => c.arguments)))) assert.ok(!sentText.includes(leaf), `an event carries "${leaf}" from the tool call`);
  assert.ok(!sentText.includes("secret-build"), "nothing after the User-Agent's product name");
});

test("with a key, the log line is still method, path, status and duration, and floods are not counted", async () => {
  const h = harness();
  const env: Env = { POSTHOG_KEY: KEY, POSTHOG_HOST: "https://eu.i.posthog.com/", RATE_LIMITER: { limit: async () => ({ success: false }) } };
  const limited = await h.app.fetch(new Request("https://mcp.polyxd.com/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "polyxd_guide", arguments: {} } }) }), env, h.ctx);
  assert.equal(limited.status, 429);
  await h.settle();
  assert.equal(h.sent.length, 0);
  for (const line of h.logs) assert.deepEqual(Object.keys(line).sort(), ["method", "ms", "path", "status"]);

  const open = harness();
  const client = await connect(open, { POSTHOG_KEY: KEY, POSTHOG_HOST: "https://eu.i.posthog.com/" });
  await client.callTool({ name: "polyxd_packs", arguments: {} });
  await client.close();
  await open.settle();
  assert.ok(open.sent.length >= 2);
  assert.ok(open.sent.every((s) => s.url === "https://eu.i.posthog.com/i/v0/e/"), "POSTHOG_HOST picks the region");
  for (const line of open.logs) assert.deepEqual(Object.keys(line).sort(), ["method", "ms", "path", "status"]);
});

test("the pieces: SSE bodies, User-Agents, component counts and unknown tools", () => {
  assert.deepEqual(rpcMessages('event: message\ndata: {"jsonrpc":"2.0","id":3,"result":{}}\n\n', "text/event-stream"), [{ jsonrpc: "2.0", id: 3, result: {} }]);
  assert.deepEqual(rpcMessages("not json"), []);
  assert.equal(userAgentProduct("openai-mcp/1.0.0 (+https://openai.com)"), "openai-mcp");
  assert.equal(userAgentProduct(null), "unknown");
  assert.equal(userAgentProduct("  "), "unknown");
  assert.deepEqual(componentCounts({ components: [{ component: "Choice" }, { component: "Choice" }, { component: "acme:OrderTimeline" }, "junk"] }), { Choice: 2, Other: 2 });
  assert.deepEqual(componentCounts("not a document"), {});
  const [e] = eventsFor({ requests: [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "zq_private_tool_name", arguments: {} } }], responses: [], status: 504, ms: 15000, userAgent: null, protocolHeader: null });
  assert.deepEqual(e.properties, { tool: "unknown", ok: false, duration_ms: 15000, client_product: "unknown", error: "timeout" });
  assert.deepEqual(eventsFor({ requests: [{ jsonrpc: "2.0", id: 1, method: "tools/list" }], responses: [], status: 200, ms: 1, userAgent: null, protocolHeader: null }), [], "only initialize and tool calls count");
});
