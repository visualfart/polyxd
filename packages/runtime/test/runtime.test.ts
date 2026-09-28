import { test } from "node:test";
import assert from "node:assert/strict";
import { staticAudit } from "@polyxd/verifier";
import { createRuntime, GeneratorError, memoryStore, type Progress } from "../src/index.ts";
import { brokenDoc, calmFinance, capabilities, confirmDoc, data, fake, fenced } from "./helpers.ts";

const ask = { ask: "Send £250 to Alex for the rent", intent: "money.send", capabilities, data };

test("a valid first answer is accepted without a repair", async () => {
  const generator = fake([fenced(confirmDoc())]);
  const result = await createRuntime({ generator, direction: calmFinance() }).generate(ask);
  assert.equal(result.attempts, 1);
  assert.equal(result.report.valid, true);
  assert.deepEqual(result.document, confirmDoc());
  assert.equal(generator.requests.length, 1);
  assert.equal(result.usage.inputTokens, 100);
  assert.ok(result.usage.outputTokens > 0);
});

test("a broken answer goes back with its errors, and the repair is accepted", async () => {
  const generator = fake([JSON.stringify(brokenDoc()), JSON.stringify(confirmDoc())]);
  const result = await createRuntime({ generator, direction: calmFinance() }).generate(ask);
  assert.equal(result.attempts, 2);
  assert.equal(result.report.valid, true);
  assert.equal(result.usage.inputTokens, 200, "usage adds up across attempts");
  const second = generator.requests[1].messages;
  assert.deepEqual(second.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(second[0].content, generator.requests[0].messages[0].content, "the original turn is kept");
  assert.equal(second[1].content, JSON.stringify(brokenDoc()), "the model sees what it wrote");
  assert.match(second[2].content, /\[spec\] \/components\/0\/summary: references unknown component "missing"/);
});

test("an answer that isn't JSON is repaired like any other failure", async () => {
  const generator = fake(["Sorry, I can't do JSON today.", fenced(confirmDoc())]);
  const result = await createRuntime({ generator }).generate(ask);
  assert.equal(result.attempts, 2);
  assert.match(generator.requests[1].messages[2].content, /\[json:parse\] the answer is not valid JSON/);
});

test("after the last repair it gives up: the last document, its report, and no memory written", async () => {
  const memory = memoryStore();
  const generator = fake([JSON.stringify(brokenDoc())]);
  const events: string[] = [];
  const result = await createRuntime({ generator, memory, maxRepairs: 2, onEvent: (e) => events.push(e.type) }).generate(ask);
  assert.equal(result.attempts, 3);
  assert.equal(result.report.valid, false);
  assert.deepEqual(result.document, brokenDoc());
  assert.ok(result.report.findings.some((f) => f.check === "spec" && f.severity === "error"));
  assert.equal(await memory.get("money.send"), undefined);
  assert.equal(events.at(-1), "error");
  assert.ok(!events.includes("done"));
});

test("maxRepairs 0 means one attempt", async () => {
  const result = await createRuntime({ generator: fake([JSON.stringify(brokenDoc())]), maxRepairs: 0 }).generate(ask);
  assert.equal(result.attempts, 1);
  assert.equal(result.report.valid, false);
});

test("the Direction's rules are checked: an error rule triggers a repair, a voice warning doesn't", async () => {
  const outside = confirmDoc();
  // Money moving from a plain button rather than the Confirm breaks "money-moves-in-confirm".
  outside.root = "wrap";
  outside.components.push({ id: "wrap", component: "Group", children: ["confirm", "go"] }, { id: "go", component: "Action", label: "Send £250", action: { event: { name: "transfer.confirm", context: { quoteId: { path: "/quote/id" } } } } });
  const loud = confirmDoc();
  (loud.components[0] as any).confirm.label = "Send £250.00!";
  const generator = fake([JSON.stringify(outside), JSON.stringify(loud)]);
  const result = await createRuntime({ generator, direction: calmFinance() }).generate(ask);
  assert.match(generator.requests[1].messages[2].content, /\[rule:money-moves-in-confirm\]/);
  assert.equal(result.attempts, 2);
  assert.equal(result.report.valid, true);
  assert.deepEqual(result.report.findings.map((f) => f.check), ["rule:voice-no-exclamation"]);
});

test("repairWarnings sends warnings back too, but accepts a warning-only document on the last attempt", async () => {
  const loud = confirmDoc();
  (loud.components[0] as any).confirm.label = "Send £250.00!";
  const generator = fake([JSON.stringify(loud)]);
  const result = await createRuntime({ generator, direction: calmFinance(), repairWarnings: true, maxRepairs: 1 }).generate(ask);
  assert.equal(result.attempts, 2);
  assert.match(generator.requests[1].messages[2].content, /\[rule:voice-no-exclamation\]/);
  assert.equal(result.report.valid, true);
  assert.equal(result.report.warnings, 1);
});

test("generated documents are held to the generated-only checks", async () => {
  const shell = confirmDoc();
  (shell.surface as any).kind = "shell";
  const disallowed = confirmDoc();
  const generator = fake([JSON.stringify(shell), JSON.stringify(disallowed)]);
  const runtime = createRuntime({ generator, direction: { name: "x", patterns: { disallow: ["confirm-destructive"] } }, components: ["Confirm", "DetailList"] });
  const result = await runtime.generate(ask);
  assert.match(generator.requests[1].messages[2].content, /\[generated:shell\]/);
  assert.match(generator.requests[2].messages[2].content, /\[direction:pattern-disallowed\]/);
  assert.equal(result.report.valid, false);
});

test("an allow-list of components is enforced", async () => {
  const generator = fake([JSON.stringify(confirmDoc())]);
  const result = await createRuntime({ generator, components: ["Confirm"], maxRepairs: 0 }).generate(ask);
  assert.deepEqual(result.report.findings.map((f) => f.check), ["generated:component"]);
  assert.match(result.report.findings[0].message, /summary: DetailList is not one of the components this product allows/);
});

test("bindings are checked against the host's data", async () => {
  const doc = confirmDoc();
  const result = await createRuntime({ generator: fake([JSON.stringify(doc)]), maxRepairs: 0 }).generate({ ...ask, data: { quote: { id: "q" } } });
  assert.equal(result.report.valid, false);
  assert.ok(result.report.findings.some((f) => f.check === "data:missing-path"));
});

test("stream yields started, text in order, attempt, repaired, done", async () => {
  const first = JSON.stringify(brokenDoc());
  const second = fenced(confirmDoc());
  const runtime = createRuntime({ generator: fake([first, second], { chunk: 13 }) });
  const seen: Progress[] = [];
  for await (const p of runtime.stream(ask)) seen.push(p);
  const types = seen.map((p) => (p.type === "text" || p.type === "attempt" || p.type === "repaired" ? `${p.type}:${p.attempt}` : p.type));
  const collapsed = types.filter((t, i) => t !== types[i - 1]);
  assert.deepEqual(collapsed, ["started", "text:1", "attempt:1", "text:2", "attempt:2", "repaired:2", "done"]);
  const text1 = seen.filter((p): p is Extract<Progress, { type: "text" }> => p.type === "text" && p.attempt === 1).map((p) => p.text).join("");
  assert.equal(text1, first, "the pieces join up to the answer");
  const done = seen.at(-1) as Extract<Progress, { type: "done" }>;
  assert.deepEqual(done.result.document, confirmDoc());
});

test("onProgress sees the same sequence as the stream", async () => {
  const seen: string[] = [];
  await createRuntime({ generator: fake([fenced(confirmDoc())]) }).generate(ask, { onProgress: (p) => seen.push(p.type) });
  assert.deepEqual(seen.filter((t, i) => t !== seen[i - 1]), ["started", "text", "attempt", "done"]);
});

test("a generator that doesn't stream still yields its text once", async () => {
  const seen: Progress[] = [];
  await createRuntime({ generator: fake([JSON.stringify(confirmDoc())], { stream: false, usage: false }) }).generate(ask, { onProgress: (p) => seen.push(p) });
  const texts = seen.filter((p) => p.type === "text");
  assert.equal(texts.length, 1);
});

test("a generator failure ends the stream with an error and rejects generate", async () => {
  const boom = () => {
    throw new GeneratorError("fake", "fake answered 529", 529);
  };
  const runtime = createRuntime({ generator: fake([boom]) });
  const seen: Progress[] = [];
  for await (const p of runtime.stream(ask)) seen.push(p);
  assert.deepEqual(seen.map((p) => p.type), ["started", "error"]);
  assert.equal((seen[1] as Extract<Progress, { type: "error" }>).reason, "generator");
  await assert.rejects(runtime.generate(ask), GeneratorError);
});

test("an abort stops generation and reports it as aborted", async () => {
  const controller = new AbortController();
  const wait = (req: { signal?: AbortSignal }) =>
    new Promise<string>((_, reject) => {
      req.signal?.addEventListener("abort", () => reject(req.signal!.reason));
      controller.abort(new DOMException("stop", "AbortError"));
    });
  const reasons: string[] = [];
  const runtime = createRuntime({ generator: fake([wait]), onEvent: (e) => e.type === "error" && reasons.push(e.reason) });
  await assert.rejects(runtime.generate({ ...ask, signal: controller.signal }), { name: "AbortError" });
  assert.deepEqual(reasons, ["aborted"]);
});

test("leaving a stream early aborts the model call", async () => {
  let signal: AbortSignal | undefined;
  const slow = (req: { signal?: AbortSignal; onText?: (t: string) => void }) =>
    new Promise<string>((_, reject) => {
      signal = req.signal;
      req.onText?.("{");
      req.signal?.addEventListener("abort", () => reject(req.signal!.reason));
    });
  const runtime = createRuntime({ generator: fake([slow], { stream: false }) });
  for await (const p of runtime.stream(ask)) if (p.type === "text") break;
  assert.equal(signal?.aborted, true);
});

test("memory: the accepted screen is remembered by intent, without its data, and fed back next time", async () => {
  const memory = memoryStore();
  const withData = { ...confirmDoc(), data };
  const generator = fake([JSON.stringify(withData), JSON.stringify(confirmDoc())]);
  const runtime = createRuntime({ generator, memory });
  const first = await runtime.generate(ask);
  assert.ok(!generator.requests[0].messages[0].content.includes("Last time"));
  assert.equal("data" in first.document!, true, "the result is what the model wrote");
  const stored = await memory.get("money.send");
  assert.deepEqual(stored, confirmDoc(), "stored without data");
  const started: boolean[] = [];
  await runtime.generate(ask, { onProgress: (p) => p.type === "started" && started.push(p.remembered) });
  assert.deepEqual(started, [true]);
  const turn = generator.requests[1].messages[0].content;
  assert.match(turn, /Last time, this intent showed the screen below/);
  assert.ok(turn.includes(JSON.stringify(confirmDoc())));
  assert.equal(await memory.get("tasks.create"), undefined, "other intents are untouched");
});

test("a memory store that fails to write doesn't lose a good document", async () => {
  const memory = { get: () => undefined, set: () => Promise.reject(new Error("quota")), delete: () => {} };
  const result = await createRuntime({ generator: fake([JSON.stringify(confirmDoc())]), memory }).generate(ask);
  assert.equal(result.report.valid, true);
});

test("exemplars given as paths are skipped without a resolver, and used with one", async () => {
  const generator = fake([JSON.stringify(confirmDoc())]);
  const direction = { name: "x", exemplars: [{ request: "send Alex the rent", document: "send.json" }, { request: "send money inline", document: confirmDoc() }] };
  await createRuntime({ generator, direction }).generate(ask);
  const without = generator.requests[0].messages[0].content;
  assert.equal(without.match(/^Request: /gm)?.length, 2, "the ask and the inline exemplar");
  const paths: string[] = [];
  await createRuntime({ generator, direction, resolveExemplar: (p) => (paths.push(p), confirmDoc()) }).generate(ask);
  assert.deepEqual(paths, ["send.json"]);
  assert.equal(generator.requests[1].messages[0].content.match(/^Request: /gm)?.length, 3);
});

test("the verifier's staticAudit can replace the built-in checks", async () => {
  const seen: unknown[] = [];
  const audit = (doc: any, options: any) => {
    seen.push(options);
    return staticAudit(doc, options);
  };
  const generator = fake([JSON.stringify(brokenDoc()), JSON.stringify(confirmDoc())]);
  const result = await createRuntime({ generator, direction: calmFinance(), audit }).generate(ask);
  assert.equal(result.attempts, 2);
  assert.equal(result.report.valid, true);
  const options = seen[0] as any;
  assert.deepEqual(Object.keys(options.registry.capabilities), ["transfer.confirm"]);
  assert.ok(options.rules.some((r: any) => r.id === "money-moves-in-confirm"));
  assert.ok(options.rules.some((r: any) => r.id === "voice-no-exclamation"));
  assert.equal(options.emphasisBudget, 1);
});
