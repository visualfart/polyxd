/**
 * The server over Streamable HTTP, in process: the official SDK client talking to the fetch
 * handler that https://mcp.polyxd.com/mcp runs, plus raw requests for what a client library
 * would never send (bad JSON, oversize bodies, too many requests, preflights).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createHttpHandler, rateLimiter, viewHTML, VIEW_URI, VIEW_MIME_TYPE, appResourceMeta, type HttpHandlerOptions, type RequestLog } from "../src/index.ts";
import { exampleFiles, loadExample, textOf } from "./helpers.ts";

const URL_ = "https://mcp.polyxd.test/mcp";
const TOOLS = ["polyxd_guide", "polyxd_validate", "polyxd_verify", "polyxd_show", "polyxd_packs", "polyxd_components"];

function handler(options: Partial<HttpHandlerOptions> = {}) {
  const logs: RequestLog[] = [];
  const handle = createHttpHandler({ viewHtml: viewHTML, log: (e) => logs.push(e), ...options });
  return { handle, logs };
}

/** The SDK client over HTTP, its requests going straight to the handler. */
async function client(handle: (r: Request) => Promise<Response>, negotiation?: { mode: { pin: string } }) {
  const c = new Client(
    { name: "http-test-host", version: "0.0.0" },
    { capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: [VIEW_MIME_TYPE] } } }, ...(negotiation ? { versionNegotiation: negotiation } : {}) } as any,
  );
  const transport = new StreamableHTTPClientTransport(new URL(URL_), { fetch: (url, init) => handle(new Request(url, init)) });
  await c.connect(transport);
  return c;
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** A response's JSON-RPC messages, whether it came back as JSON or as an SSE stream. */
async function messages(res: Response): Promise<any[]> {
  const text = await res.text();
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    return text.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5)));
  }
  return text ? [JSON.parse(text)] : [];
}

const initialize = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "raw", version: "0.0.0" } } };

test("the SDK client initializes over Streamable HTTP, lists the tools and calls every one", async () => {
  const { handle, logs } = handler();
  const c = await client(handle);
  try {
    assert.equal(c.getServerVersion()?.name, "polyxd");
    assert.match(c.getInstructions() ?? "", /polyxd_guide/);
    const { tools } = await c.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOLS].sort());

    assert.match(textOf(await c.callTool({ name: "polyxd_guide", arguments: {} })), /How this works over MCP/);
    const doc = loadExample("tasks-add.json");
    const v: any = await c.callTool({ name: "polyxd_validate", arguments: { document: doc } });
    assert.equal(v.structuredContent.valid, true, textOf(v));
    const r: any = await c.callTool({ name: "polyxd_verify", arguments: { document: doc, direction: "calm-finance" } });
    assert.equal(r.structuredContent.direction, "calm-finance");
    const s: any = await c.callTool({ name: "polyxd_show", arguments: { document: doc, pack: "carbon" } });
    assert.equal(s.structuredContent.shown, true);
    assert.equal(s.structuredContent.pack, "carbon");
    assert.deepEqual(s._meta?.ui, { resourceUri: VIEW_URI });
    const p: any = await c.callTool({ name: "polyxd_packs", arguments: {} });
    assert.equal(p.structuredContent.default, "material3");
    const one: any = await c.callTool({ name: "polyxd_components", arguments: { name: "Choice" } });
    assert.equal(one.structuredContent.component.name, "Choice");

    const bad: any = await c.callTool({ name: "polyxd_show", arguments: { document: { ...doc, root: "missing" } } });
    assert.equal(bad.isError, true);
    assert.match(textOf(bad), /^Not shown/);

    const { resources } = await c.listResources();
    assert.equal(resources.length, exampleFiles.length + 3, "the view, every example and both directions");
    const view = await c.readResource({ uri: VIEW_URI });
    const content = view.contents[0] as any;
    assert.equal(content.mimeType, VIEW_MIME_TYPE);
    assert.deepEqual(content._meta, appResourceMeta());
    assert.equal(content.text, viewHTML());
    const example = await c.readResource({ uri: "polyxd://examples/tasks-list.json" });
    assert.deepEqual(JSON.parse((example.contents[0] as any).text), loadExample("tasks-list.json"));
  } finally {
    await c.close();
  }
  assert.ok(logs.length >= 10);
  for (const entry of logs) assert.deepEqual(Object.keys(entry).sort(), ["method", "ms", "path", "status"]);
});

test("a 2026-07-28 client, which sends the protocol version with every request, is served too", async () => {
  const { handle } = handler();
  const c = await client(handle, { mode: { pin: "2026-07-28" } });
  try {
    const { tools } = await c.listTools();
    assert.equal(tools.length, 6);
    const s: any = await c.callTool({ name: "polyxd_show", arguments: { document: loadExample("tasks-list.json") } });
    assert.equal(s.structuredContent.shown, true, textOf(s));
    const view = await c.readResource({ uri: VIEW_URI });
    assert.equal((view.contents[0] as any).mimeType, VIEW_MIME_TYPE);
  } finally {
    await c.close();
  }
});

test("raw JSON-RPC: initialize answers, a notification is accepted with 202 and no body", async () => {
  const { handle } = handler();
  const res = await handle(post(initialize));
  assert.equal(res.status, 200);
  const [init] = await messages(res);
  assert.equal(init.id, 1);
  assert.equal(init.result.serverInfo.name, "polyxd");
  assert.ok(init.result.capabilities.tools && init.result.capabilities.resources);
  assert.equal(res.headers.get("mcp-session-id"), null, "stateless: no session");

  const note = await handle(post({ jsonrpc: "2.0", method: "notifications/initialized" }, { "mcp-protocol-version": "2025-11-25" }));
  assert.equal(note.status, 202);
  assert.equal(await note.text(), "");

  // Stateless: a request works without an initialize before it on the same connection.
  const list = await handle(post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, { "mcp-protocol-version": "2025-11-25" }));
  assert.equal(list.status, 200);
  assert.equal((await messages(list))[0].result.tools.length, 6);
});

test("GET and DELETE answer 405: no standalone stream and no sessions to end", async () => {
  const { handle } = handler();
  const get = await handle(new Request(URL_, { headers: { accept: "text/event-stream", "mcp-protocol-version": "2025-11-25" } }));
  assert.equal(get.status, 405);
  assert.ok((get.headers.get("allow") ?? "").includes("POST"), get.headers.get("allow") ?? "no Allow header");
  const del = await handle(new Request(URL_, { method: "DELETE", headers: { "mcp-protocol-version": "2025-11-25" } }));
  assert.equal(del.status, 405);
});

test("a body that is not JSON is a JSON-RPC parse error", async () => {
  const { handle } = handler();
  const res = await handle(post("{not json"));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, -32700);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});

test("an oversize body is refused with 413, by its Content-Length or as it is read", async () => {
  const { handle } = handler({ maxBodyBytes: 10_000 });
  const big = JSON.stringify({ ...initialize, params: { ...initialize.params, padding: "x".repeat(20_000) } });
  const declared = await handle(post(big, { "content-length": String(big.length) }));
  assert.equal(declared.status, 413);
  assert.match((await declared.json()).error.message, /larger than 10000 bytes/);
  const undeclared = await handle(post(big));
  assert.equal(undeclared.status, 413);
  // Under the limit is fine.
  assert.equal((await handle(post(initialize))).status, 200);
});

test("the rate limit answers 429 with Retry-After once a client has used its allowance", async () => {
  const limit = rateLimiter({ limit: 2, windowMs: 60_000 });
  const { handle } = handler({ rateLimit: limit });
  const from = (ip: string) => post(initialize, { "cf-connecting-ip": ip });
  assert.equal((await handle(from("192.0.2.1"))).status, 200);
  assert.equal((await handle(from("192.0.2.1"))).status, 200);
  const third = await handle(from("192.0.2.1"));
  assert.equal(third.status, 429);
  assert.equal(third.headers.get("retry-after"), "60");
  assert.equal(third.headers.get("access-control-allow-origin"), "*", "a browser client can read why");
  assert.equal((await third.json()).error.code, -32000);
  assert.equal((await handle(from("192.0.2.2"))).status, 200, "another address has its own allowance");
  // A preflight is not counted.
  assert.equal((await handle(new Request(URL_, { method: "OPTIONS", headers: { "cf-connecting-ip": "192.0.2.1" } }))).status, 204);
});

test("CORS: a preflight allows any origin and the headers it asks for; responses expose the MCP headers", async () => {
  const { handle } = handler();
  const pre = await handle(
    new Request(URL_, {
      method: "OPTIONS",
      headers: { origin: "https://inspector.example", "access-control-request-method": "POST", "access-control-request-headers": "content-type, mcp-protocol-version, mcp-param-region" },
    }),
  );
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "*");
  assert.match(pre.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.match(pre.headers.get("access-control-allow-methods") ?? "", /GET/);
  assert.equal(pre.headers.get("access-control-allow-headers"), "content-type, mcp-protocol-version, mcp-param-region");
  const bare = await handle(new Request(URL_, { method: "OPTIONS" }));
  assert.match(bare.headers.get("access-control-allow-headers") ?? "", /Mcp-Protocol-Version/);

  const res = await handle(post(initialize, { origin: "https://inspector.example" }));
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.match(res.headers.get("access-control-expose-headers") ?? "", /Mcp-Session-Id/);
});

test("a request that takes longer than the timeout gets a JSON-RPC error, not a hung connection", async () => {
  const slow = () => new Promise<string>((r) => setTimeout(() => r("<!doctype html>"), 500));
  const { handle } = handler({ timeoutMs: 50, viewHtml: slow });
  const read = { jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri: VIEW_URI } };
  const started = Date.now();
  // A 2025-era answer is a stream whose headers go out at once; the error arrives on it, for the request's id.
  const res = await handle(post(read, { "mcp-protocol-version": "2025-11-25" }));
  const [late] = await messages(res);
  assert.ok(Date.now() - started < 400, "answered at the deadline, not when the work finished");
  assert.equal(late.id, 3);
  assert.equal(late.error.code, -32603);
  assert.match(late.error.message, /within 50 ms/);
  // A client that takes only JSON gets a 504 when nothing was ready.
  const json = await handle(post(read, { "mcp-protocol-version": "2025-11-25", accept: "application/json" }));
  if (json.status !== 406) {
    const body = await json.json();
    assert.equal(json.status, 504);
    assert.match(body.error.message, /within 50 ms/);
  }
  // Fast requests are unaffected by a short deadline.
  const quick = await handle(post(initialize));
  assert.equal((await messages(quick))[0].result.serverInfo.name, "polyxd");
});

test("the only thing logged is one line per request: method, path, status and duration", async () => {
  const { handle, logs } = handler();
  const secret = "Ssh-this-is-private-7f3a";
  const printed: string[] = [];
  const original = { log: console.log, error: console.error, warn: console.warn, info: console.info, debug: console.debug };
  for (const level of Object.keys(original) as (keyof typeof original)[]) console[level] = (...args: unknown[]) => void printed.push(args.map(String).join(" "));
  try {
    await handle(post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "polyxd_validate", arguments: { document: { secret } } } }, { "mcp-protocol-version": "2025-11-25", "cf-connecting-ip": "192.0.2.9" }));
    await handle(post(`{"broken": "${secret}`));
    await handle(post({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "no_such_tool", arguments: { secret } } }, { "mcp-protocol-version": "2025-11-25" }));
    await handle(new Request(`${URL_}?q=${secret}`, { method: "DELETE" }));
  } finally {
    Object.assign(console, original);
  }
  assert.deepEqual(printed, [], "nothing else reaches the console, not even errors");
  assert.equal(logs.length, 4);
  assert.deepEqual(logs.map((l) => [l.method, l.path, l.status]), [["POST", "/mcp", 200], ["POST", "/mcp", 400], ["POST", "/mcp", 200], ["DELETE", "/mcp", 405]]);
  for (const entry of logs) assert.deepEqual(Object.keys(entry).sort(), ["method", "ms", "path", "status"]);
  for (const line of logs.map((l) => JSON.stringify(l))) assert.ok(!line.includes(secret) && !line.includes("192.0.2.9"), line);

  // With no log function given, the line goes to console.log as JSON, and that is all.
  const lines: string[] = [];
  const log = console.log;
  console.log = (line: string) => void lines.push(line);
  try {
    await createHttpHandler({ viewHtml: viewHTML })(post(initialize));
  } finally {
    console.log = log;
  }
  assert.equal(lines.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(lines[0])).sort(), ["method", "ms", "path", "status"]);
});

test("the HTTP entry bundles for a Worker (no Node built-ins, no file system) and its results pass the Worker's output-schema checks", async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("../src/http.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    conditions: ["workerd", "worker", "import"],
    mainFields: ["module", "main"],
    logLevel: "silent",
  });
  assert.equal(result.errors.length, 0);
  const js = result.outputFiles[0].text;
  assert.doesNotMatch(js, /from ["']node:|require\(["']node:/);

  // The bundle runs: the SDK's Worker build checks each result against its output schema with
  // @cfworker/json-schema, not Ajv, so every tool is called through it on every example.
  assert.ok(js.includes("CfWorkerJsonSchemaValidator"), "the Worker build validates with @cfworker/json-schema");
  const bundled = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  const handle = bundled.createHttpHandler({ viewHtml: () => "<!doctype html>", log: () => {} });
  const c = await client(handle);
  try {
    const { tools } = await c.listTools();
    assert.equal(tools.filter((t) => t.outputSchema).length, 6);
    const ok = async (name: string, args: Record<string, unknown> = {}) => {
      const r: any = await c.callTool({ name, arguments: args });
      assert.notEqual(r.isError, true, `${name}: ${textOf(r)}`);
      assert.ok(r.structuredContent, name);
      return r;
    };
    await ok("polyxd_guide");
    await ok("polyxd_packs");
    await ok("polyxd_components");
    await ok("polyxd_components", { name: "Choice" });
    for (const f of exampleFiles) {
      const document = loadExample(f);
      await ok("polyxd_validate", { document });
      await ok("polyxd_validate", { document, data: {} });
      await ok("polyxd_verify", { document });
      await ok("polyxd_verify", { document, direction: "calm-finance" });
      await ok("polyxd_show", { document, pack: "carbon", mode: "dark" });
    }
    const bad: any = await c.callTool({ name: "polyxd_show", arguments: { document: { ...loadExample("tasks-add.json"), root: "missing" } } });
    assert.equal(bad.isError, true);
    assert.equal(bad.structuredContent.shown, false);
  } finally {
    await c.close();
  }
});
