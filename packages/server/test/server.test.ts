import { test } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { readFileSync } from "node:fs";
import { GeneratorError } from "@polyxd/runtime";
import { askBody, brokenDoc, calmFinance, confirmDoc, data, events, fake, hang, json, start, until } from "./helpers.ts";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("health answers without a token, with the version", async () => {
  const s = await start({ generator: fake([]), token: "secret" });
  try {
    const res = await fetch(`${s.url}/v1/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok", version: pkg.version });
  } finally {
    await s.close();
  }
});

test("generate returns the document, its report, the attempts and the usage", async () => {
  const generator = fake([JSON.stringify(confirmDoc())]);
  const s = await start({ generator });
  try {
    const res = await fetch(`${s.url}/v1/generate`, json(askBody));
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type")!, /^application\/json/);
    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), ["attempts", "document", "report", "usage"]);
    assert.deepEqual(body.document, confirmDoc());
    assert.equal(body.report.valid, true);
    assert.equal(body.attempts, 1);
    assert.equal(body.usage.inputTokens, 100);
    // The capability was offered by name, from the registry.
    assert.match(generator.requests[0].messages[0].content, /transfer\.confirm/);
  } finally {
    await s.close();
  }
});

test("a broken answer is repaired before it is returned", async () => {
  const generator = fake([JSON.stringify(brokenDoc()), JSON.stringify(confirmDoc())]);
  const s = await start({ generator });
  try {
    const body = await (await fetch(`${s.url}/v1/generate`, json(askBody))).json();
    assert.equal(body.attempts, 2);
    assert.equal(body.report.valid, true);
    assert.equal(generator.requests.length, 2);
    assert.match(generator.requests[1].messages[2].content, /missing/);
  } finally {
    await s.close();
  }
});

test("when every repair fails, the answer is 422 with the last document and its report", async () => {
  const s = await start({ generator: fake([JSON.stringify(brokenDoc())]), maxRepairs: 1 });
  try {
    const res = await fetch(`${s.url}/v1/generate`, json(askBody));
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.attempts, 2);
    assert.equal(body.report.valid, false);
    assert.deepEqual(body.document, brokenDoc());
    assert.equal(body.error.code, "invalid");
  } finally {
    await s.close();
  }
});

test("with Accept: text/event-stream, generate streams the runtime's progress", async () => {
  const s = await start({ generator: fake([JSON.stringify(brokenDoc()), JSON.stringify(confirmDoc())]) });
  try {
    const res = await fetch(`${s.url}/v1/generate`, json(askBody, { accept: "text/event-stream" }));
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type")!, /^text\/event-stream/);
    const list = await events(res);
    const order = list.map((e) => e.event).filter((e, i, a) => e !== "text" || a[i - 1] !== "text");
    assert.deepEqual(order, ["started", "text", "attempt", "text", "attempt", "repaired", "done"]);
    assert.deepEqual(list[0].data, { remembered: false, exemplars: 0 });
    const text = list.filter((e) => e.event === "text" && e.data.attempt === 2).map((e) => e.data.text).join("");
    assert.deepEqual(JSON.parse(text), confirmDoc());
    assert.equal(list.find((e) => e.event === "attempt")!.data.report.valid, false);
    const done = list.at(-1)!.data;
    assert.deepEqual(done.document, confirmDoc());
    assert.equal(done.attempts, 2);
  } finally {
    await s.close();
  }
});

test("a provider failure is 502, or a stream's error event, with its status and none of its words", async () => {
  const refuse = () => Promise.reject(new GeneratorError("anthropic", "anthropic answered 429: secret detail from upstream", 429));
  const s = await start({ generator: fake([refuse]) });
  try {
    const res = await fetch(`${s.url}/v1/generate`, json(askBody));
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.deepEqual(body.error, { code: "generator", message: "The model provider (anthropic) failed with HTTP 429.", provider: "anthropic", status: 429 });

    const list = await events(await fetch(`${s.url}/v1/generate`, json(askBody, { accept: "text/event-stream" })));
    assert.deepEqual(list.map((e) => e.event), ["started", "error"]);
    assert.equal(list[1].data.code, "generator");
    assert.equal(list[1].data.status, 429);
    assert.doesNotMatch(JSON.stringify(list), /secret detail/);
  } finally {
    await s.close();
  }
});

test("a request that isn't right is a 400, 415 or 404 that says what to fix", async () => {
  const s = await start({ generator: fake([JSON.stringify(confirmDoc())]) });
  try {
    const post = async (body: unknown, init: RequestInit = json(body)) => {
      const res = await fetch(`${s.url}/v1/generate`, init);
      return { status: res.status, error: (await res.json()).error };
    };
    assert.deepEqual((await post({ intent: "money.send" })).status, 400);
    assert.match((await post({ ask: "x" })).error.message, /intent/);
    assert.match((await post({ ...askBody, capabilites: [] })).error.message, /Unknown field "capabilites"/);
    assert.match((await post({ ...askBody, capabilities: ["money.steal"] })).error.message, /No capability named "money.steal"/);
    assert.match((await post({ ...askBody, capabilities: "transfer.confirm" })).error.message, /list of names/);
    assert.equal((await post(null, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" })).error.code, "bad_request");
    assert.equal((await post(null, { method: "POST", headers: { "content-type": "text/plain" }, body: "hi" })).status, 415);

    const missing = await fetch(`${s.url}/v1/nothing`);
    assert.equal(missing.status, 404);
    const wrong = await fetch(`${s.url}/v1/generate`);
    assert.equal(wrong.status, 405);
    assert.equal(wrong.headers.get("allow"), "POST, OPTIONS");
  } finally {
    await s.close();
  }
});

test("capabilities can be sent in full instead of by name", async () => {
  const generator = fake([JSON.stringify(confirmDoc())]);
  const s = await start({ generator, registry: undefined });
  try {
    const capabilities = { "transfer.confirm": { description: "Send money for a reviewed quote", risk: "consequential" } };
    const res = await fetch(`${s.url}/v1/generate`, json({ ...askBody, capabilities }));
    assert.equal(res.status, 200);
    assert.match(generator.requests[0].messages[0].content, /Send money for a reviewed quote/);
  } finally {
    await s.close();
  }
});

test("validate runs the spec validator, and verify the verifier's document checks with the Direction", async () => {
  const s = await start({ generator: fake([]), direction: calmFinance() });
  try {
    const ok = await (await fetch(`${s.url}/v1/validate`, json({ document: confirmDoc(), data }))).json();
    assert.deepEqual(ok, { valid: true, errors: 0, warnings: 0, issues: [] });
    const broken = await (await fetch(`${s.url}/v1/validate`, json({ document: brokenDoc(), data }))).json();
    assert.equal(broken.valid, false);
    assert.ok(broken.issues.some((i: any) => i.at.startsWith("/components/0") && i.severity === "error"));

    const verified = await (await fetch(`${s.url}/v1/verify`, json({ document: confirmDoc(), data }))).json();
    assert.deepEqual(verified, { valid: true, errors: 0, warnings: 0, findings: [] });
    const loud = confirmDoc();
    loud.components[0].confirm.label = "Send now!";
    const checked = await (await fetch(`${s.url}/v1/verify`, json({ document: loud, data, capabilities: ["transfer.confirm"] }))).json();
    assert.ok(checked.findings.some((f: any) => f.check === "rule:voice-no-exclamation"), "the Direction's voice is checked");

    const notADocument = await fetch(`${s.url}/v1/verify`, json({ document: [] }));
    assert.equal(notADocument.status, 400);
  } finally {
    await s.close();
  }
});

test("spec lists the version, the components a generated screen may use, the patterns and the capabilities", async () => {
  const s = await start({ generator: fake([]), direction: calmFinance() });
  try {
    const body = await (await fetch(`${s.url}/v1/spec`)).json();
    assert.equal(body.version, pkg.version);
    assert.equal(body.specVersion, "0.3.0");
    const names = body.components.map((c: any) => c.name);
    assert.ok(names.includes("Confirm") && names.includes("Action"));
    assert.ok(!names.includes("Frame") && !names.includes("AppBar"), "shell components are authored, never generated");
    assert.ok(body.patterns.includes("confirm-destructive"));
    assert.equal(body.direction, "calm-finance");
    assert.ok(body.capabilities.includes("transfer.confirm"));
  } finally {
    await s.close();
  }
});

test("with a token, every endpoint but health needs it", async () => {
  const s = await start({ generator: fake([JSON.stringify(confirmDoc())]), token: "s3cret" });
  try {
    const none = await fetch(`${s.url}/v1/generate`, json(askBody));
    assert.equal(none.status, 401);
    assert.equal(none.headers.get("www-authenticate"), "Bearer");
    assert.equal((await fetch(`${s.url}/v1/spec`)).status, 401);
    assert.equal((await fetch(`${s.url}/v1/generate`, json(askBody, { authorization: "Bearer wrong" }))).status, 401);
    assert.equal((await fetch(`${s.url}/v1/generate`, json(askBody, { authorization: "Basic s3cret" }))).status, 401);
    assert.equal((await fetch(`${s.url}/v1/generate`, json(askBody, { authorization: "Bearer s3cret" }))).status, 200);
    assert.equal((await fetch(`${s.url}/v1/spec`, { headers: { authorization: "bearer s3cret" } })).status, 200);
  } finally {
    await s.close();
  }
});

test("CORS: allowed origins get the headers and a preflight, others are refused, and no origin needs none", async () => {
  const s = await start({ generator: fake([JSON.stringify(confirmDoc())]), corsOrigins: ["https://app.example"], token: "t" });
  try {
    const preflight = await fetch(`${s.url}/v1/generate`, {
      method: "OPTIONS",
      headers: { origin: "https://app.example", "access-control-request-method": "POST", "access-control-request-headers": "authorization, content-type" },
    });
    assert.equal(preflight.status, 204, "a preflight needs no token");
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://app.example");
    assert.match(preflight.headers.get("access-control-allow-headers")!, /authorization/);
    assert.match(preflight.headers.get("access-control-allow-methods")!, /POST/);
    assert.equal(preflight.headers.get("vary"), "Origin");

    const allowed = await fetch(`${s.url}/v1/generate`, json(askBody, { origin: "https://app.example", authorization: "Bearer t" }));
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://app.example");

    const refused = await fetch(`${s.url}/v1/generate`, json(askBody, { origin: "https://evil.example", authorization: "Bearer t" }));
    assert.equal(refused.status, 403);
    assert.equal(refused.headers.get("access-control-allow-origin"), null);
    assert.equal((await fetch(`${s.url}/v1/health`, { headers: { origin: "https://evil.example" } })).status, 403);

    const plain = await fetch(`${s.url}/v1/health`);
    assert.equal(plain.headers.get("access-control-allow-origin"), null);
  } finally {
    await s.close();
  }
  const any = await start({ generator: fake([]), corsOrigins: ["*"] });
  try {
    const res = await fetch(`${any.url}/v1/health`, { headers: { origin: "https://anywhere.example" } });
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
  } finally {
    await any.close();
  }
});

/** A raw POST, so the body can be sent without a Content-Length, in pieces. */
function rawPost(url: string, chunks: string[], headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(`${url}/v1/generate`, { method: "POST", headers: { "content-type": "application/json", ...headers } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode!, body }));
    });
    req.on("error", reject);
    for (const c of chunks) req.write(c);
    req.end();
  });
}

test("a body over the limit is refused with 413, whether or not it says its length", async () => {
  const generator = fake([JSON.stringify(confirmDoc())]);
  const s = await start({ generator, maxBodyBytes: 300 });
  try {
    const big = { ...askBody, ask: "x".repeat(400) };
    const declared = await fetch(`${s.url}/v1/generate`, json(big));
    assert.equal(declared.status, 413);
    assert.equal((await declared.json()).error.code, "too_large");

    const text = JSON.stringify(big);
    const streamed = await rawPost(s.url, [text.slice(0, 200), text.slice(200)]);
    assert.equal(streamed.status, 413);
    assert.equal(generator.requests.length, 0);

    const small = await fetch(`${s.url}/v1/generate`, json({ ask: "Send £250 to Alex", intent: "money.send" }));
    assert.notEqual(small.status, 413);
  } finally {
    await s.close();
  }
});

test("a caller that goes away aborts the model call, in JSON and in a stream", async () => {
  for (const accept of ["application/json", "text/event-stream"]) {
    const generator = fake([hang]);
    const s = await start({ generator });
    try {
      const req = request(`${s.url}/v1/generate`, { method: "POST", headers: { "content-type": "application/json", accept } });
      req.on("error", () => {});
      req.end(JSON.stringify(askBody));
      await until(() => generator.requests.length === 1);
      assert.equal(generator.requests.length, 1, accept);
      req.destroy();
      await generator.aborted;
      await until(() => s.logs.length === 1);
      assert.equal(s.logs[0].status, 499, accept);
    } finally {
      await s.close();
    }
  }
});

test("a generation that takes too long ends with 504, or a timeout event", async () => {
  const s = await start({ generator: fake([hang]), timeoutMs: 50 });
  try {
    const res = await fetch(`${s.url}/v1/generate`, json(askBody));
    assert.equal(res.status, 504);
    assert.equal((await res.json()).error.code, "timeout");
    const list = await events(await fetch(`${s.url}/v1/generate`, json(askBody, { accept: "text/event-stream" })));
    assert.deepEqual(list.map((e) => e.event), ["started", "error"]);
    assert.equal(list[1].data.code, "timeout");
  } finally {
    await s.close();
  }
});

test("a stream sends keep-alive comments while the model thinks", async () => {
  const slow = () => new Promise<string>((r) => setTimeout(() => r(JSON.stringify(confirmDoc())), 120));
  const s = await start({ generator: fake([slow]), heartbeatMs: 20 });
  try {
    const text = await (await fetch(`${s.url}/v1/generate`, json(askBody, { accept: "text/event-stream" }))).text();
    assert.match(text, /^: keep-alive$/m);
    assert.match(text, /^event: done$/m);
  } finally {
    await s.close();
  }
});

test("the log has the method, path, status and duration of each request, and nothing from its body", async () => {
  const s = await start({ generator: fake([JSON.stringify(confirmDoc())]) });
  try {
    await fetch(`${s.url}/v1/generate?user=alex`, json(askBody));
    await fetch(`${s.url}/v1/verify`, json({ document: confirmDoc(), data }));
    await until(() => s.logs.length === 2);
    assert.deepEqual(s.logs.map((e) => Object.keys(e).sort()), [["method", "ms", "path", "status"], ["method", "ms", "path", "status"]]);
    assert.deepEqual(s.logs.map(({ method, path, status }) => ({ method, path, status })), [
      { method: "POST", path: "/v1/generate", status: 200 },
      { method: "POST", path: "/v1/verify", status: 200 },
    ]);
    const logged = JSON.stringify(s.logs);
    for (const secret of ["Alex", "rent", "250", "alex", "transfer"]) assert.ok(!logged.includes(secret), secret);
  } finally {
    await s.close();
  }
});
