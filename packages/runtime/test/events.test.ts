import { test } from "node:test";
import assert from "node:assert/strict";
import { createRuntime, GeneratorError, memoryStore, type RuntimeEvent } from "../src/index.ts";
import { brokenDoc, calmFinance, capabilities, confirmDoc, data, fake } from "./helpers.ts";

const SECRET_ASK = "Send £250 to Alex Kim, sort code 12-34-56, for the flat on Lark Lane";
const ask = { ask: SECRET_ASK, intent: "money.send", capabilities, data };

/** Every string a document, the ask or the data holds, long enough to mean something. */
function contentStrings(): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string" && v.length > 3) out.add(v);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(confirmDoc().components);
  walk(confirmDoc().surface.title);
  walk(data);
  out.add(SECRET_ASK);
  for (const w of ["Alex Kim", "12-34-56", "Lark Lane", "Rent share", "q_91"]) out.add(w);
  return [...out];
}

const ALLOWED: Record<string, string[]> = {
  started: ["type", "maxAttempts", "exemplars", "remembered", "promptChars"],
  text: ["type", "attempt", "chars"],
  attempt: ["type", "attempt", "ms", "chars", "valid", "errors", "warnings", "checks", "inputTokens", "outputTokens"],
  repaired: ["type", "attempt"],
  done: ["type", "attempts", "ms", "warnings", "checks", "inputTokens", "outputTokens"],
  error: ["type", "reason", "attempts", "ms", "status", "checks"],
};

/** Only allowed fields, and every value a number, a boolean, or a check id or event name. */
function assertSafe(events: RuntimeEvent[]) {
  const json = JSON.stringify(events);
  for (const s of contentStrings()) assert.ok(!json.includes(s), `an event carries content: ${JSON.stringify(s)}`);
  for (const e of events) {
    for (const [k, v] of Object.entries(e)) {
      assert.ok(ALLOWED[e.type].includes(k), `${e.type}.${k} is not an allowed field`);
      if (k === "checks") for (const id of v as string[]) assert.match(id, /^[a-z]+(:[a-z0-9-]+)?$/, `check id ${id}`);
      else if (k === "type" || k === "reason") assert.match(v as string, /^[a-z]+$/);
      else assert.ok(typeof v === "number" || typeof v === "boolean", `${e.type}.${k} is ${typeof v}`);
    }
  }
}

test("a repaired run's events are counts, timings, validity and check ids only", async () => {
  const events: RuntimeEvent[] = [];
  const memory = memoryStore();
  await memory.set("money.send", confirmDoc());
  const loud = confirmDoc();
  (loud.components[0] as any).confirm.label = "Send £250.00 to Alex Kim!";
  const runtime = createRuntime({ generator: fake([JSON.stringify(brokenDoc()), JSON.stringify(loud)]), direction: calmFinance(), memory, onEvent: (e) => events.push(e) });
  await runtime.generate(ask);
  assertSafe(events);
  const types = events.map((e) => e.type).filter((t, i, all) => t !== all[i - 1]);
  assert.deepEqual(types, ["started", "text", "attempt", "text", "attempt", "repaired", "done"]);
  const [started] = events as Extract<RuntimeEvent, { type: "started" }>[];
  assert.equal(started.remembered, true);
  assert.equal(started.maxAttempts, 3);
  const attempts = events.filter((e) => e.type === "attempt") as Extract<RuntimeEvent, { type: "attempt" }>[];
  assert.deepEqual(attempts.map((a) => a.valid), [false, true]);
  assert.deepEqual(attempts[0].checks, ["spec"]);
  assert.ok(attempts[1].checks.includes("rule:voice-no-exclamation"), "the finding's message quotes the label; the event has only the id");
  const done = events.at(-1) as Extract<RuntimeEvent, { type: "done" }>;
  assert.equal(done.attempts, 2);
  assert.equal(done.inputTokens, 200);
});

test("giving up and failing are reported the same way", async () => {
  const events: RuntimeEvent[] = [];
  await createRuntime({ generator: fake(["not json, but it mentions Alex Kim and Lark Lane"]), maxRepairs: 1, onEvent: (e) => events.push(e) }).generate(ask);
  const boom = () => {
    throw new GeneratorError("fake", `fake answered 400: your prompt "${SECRET_ASK}" is too long`, 400);
  };
  await assert.rejects(createRuntime({ generator: fake([boom]), onEvent: (e) => events.push(e) }).generate(ask));
  assertSafe(events);
  const errors = events.filter((e) => e.type === "error") as Extract<RuntimeEvent, { type: "error" }>[];
  assert.deepEqual(errors.map((e) => [e.reason, e.status, e.checks]), [["invalid", undefined, ["json:parse"]], ["generator", 400, undefined]]);
});

test("a hook that throws never breaks generation", async () => {
  const result = await createRuntime({
    generator: fake([JSON.stringify(confirmDoc())]),
    onEvent: () => {
      throw new Error("analytics down");
    },
  }).generate(ask);
  assert.equal(result.report.valid, true);
});
