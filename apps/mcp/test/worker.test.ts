/**
 * The Worker's routes, run in Node with the view read from disk (a Worker gets it bundled as text).
 * `wrangler dev` exercises the real bundle; see packages/mcp/README.md.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createApp, DOCS_URL, RATE_LIMIT, type Env } from "../src/app.ts";

const viewPath = createRequire(import.meta.url).resolve("@polyxd/mcp/view.html");
const view = readFileSync(viewPath, "utf8");
const app = createApp({ viewHtml: () => view, log: () => {} });
const at = (path: string, init?: RequestInit) => new Request(`https://mcp.polyxd.com${path}`, init);

const initialize = (ip = "198.51.100.7") =>
  at("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "cf-connecting-ip": ip },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "0" } } }),
  });

test("wrangler.jsonc: mcp.polyxd.com only, a rate limit, and no platform logs beyond the Worker's own line", () => {
  const text = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(text.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"));
  assert.deepEqual(config.routes, [{ pattern: "mcp.polyxd.com", custom_domain: true }]);
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.deepEqual(config.ratelimits, [{ name: "RATE_LIMITER", namespace_id: config.ratelimits[0].namespace_id, simple: { limit: RATE_LIMIT, period: 60 } }]);
  // The privacy policy says the hosted server logs method, path, status and duration only.
  assert.equal(config.observability.logs.invocation_logs, false);
  assert.equal(config.observability.traces.enabled, false);
  assert.equal(config.observability.issues.enabled, false);
  assert.equal(config.observability.redact_query_string, true);
});

test("/ redirects to the docs, /health answers, anything else is 404", async () => {
  const home = await app.fetch(at("/"));
  assert.equal(home.status, 302);
  assert.equal(home.headers.get("location"), DOCS_URL);
  assert.equal(DOCS_URL, "https://polyxd.com/docs/mcp/");

  const health = await app.fetch(at("/health"));
  assert.equal(health.status, 200);
  const body = await health.json();
  assert.equal(body.ok, true);
  assert.equal(body.endpoint, "/mcp");
  assert.match(body.version, /^\d+\.\d+\.\d+/);

  for (const [path, target] of [["/favicon.ico", "/favicon.ico"], ["/favicon.svg", "/favicon.svg"], ["/apple-touch-icon.png", "/icon-180.png"]]) {
    const icon = await app.fetch(at(path));
    assert.equal(icon.status, 301, path);
    assert.equal(icon.headers.get("location"), `https://polyxd.com${target}`);
  }

  assert.equal((await app.fetch(at("/.well-known/openai-apps-challenge"))).status, 404, "no token, no challenge");
  const challenge = await app.fetch(at("/.well-known/openai-apps-challenge"), { OPENAI_APPS_CHALLENGE: "token-123\n" });
  assert.equal(challenge.status, 200);
  assert.equal(await challenge.text(), "token-123");

  assert.equal((await app.fetch(at("/mcp/extra"))).status, 404);
  assert.equal((await app.fetch(at("/.well-known/oauth-authorization-server"))).status, 404, "no authentication to discover");
});

test("/mcp serves the SDK client: tools, a shown screen and the MCP App page", async () => {
  const client = new Client({ name: "worker-test", version: "0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("https://mcp.polyxd.com/mcp"), { fetch: (url, init) => app.fetch(new Request(url, init)) }));
  try {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 7);
    const doc = JSON.parse(readFileSync(new URL("../../../packages/spec/examples/tasks-add.json", import.meta.url), "utf8"));
    const shown: any = await client.callTool({ name: "polyxd_show", arguments: { document: doc } });
    assert.equal(shown.structuredContent.shown, true);
    const page = await client.readResource({ uri: "ui://polyxd/surface.html" });
    assert.equal((page.contents[0] as any).text, view);
  } finally {
    await client.close();
  }
});

test("the rate limit is Cloudflare's binding, keyed on the client's IP", async () => {
  const keys: string[] = [];
  const env: Env = { RATE_LIMITER: { limit: async ({ key }) => (keys.push(key), { success: key !== "203.0.113.9" }) } };
  assert.equal((await app.fetch(initialize("198.51.100.7"), env)).status, 200);
  const limited = await app.fetch(initialize("203.0.113.9"), env);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.deepEqual(keys, ["198.51.100.7", "203.0.113.9"]);
  // /health and / are not counted.
  await app.fetch(at("/health", { headers: { "cf-connecting-ip": "203.0.113.9" } }), env);
  assert.equal(keys.length, 2);
});

test("without the binding, a per-isolate count stands in", async () => {
  const local = createApp({ viewHtml: () => view, log: () => {} });
  const env: Env = {};
  let status = 0;
  for (let i = 0; i <= RATE_LIMIT; i++) status = (await local.fetch(initialize("192.0.2.50"), env)).status;
  assert.equal(status, 429);
  assert.equal((await local.fetch(initialize("192.0.2.51"), env)).status, 200);
});
