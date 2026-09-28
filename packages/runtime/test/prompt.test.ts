import { test } from "node:test";
import assert from "node:assert/strict";
import { createRuntime, dataPaths, repairPrompt, systemPrompt, userPrompt } from "../src/index.ts";
import { PATTERNS } from "../src/catalog.generated.ts";
import { relevantExemplars, relevantPatterns } from "../src/direction.ts";
import { calmFinance, capabilities, confirmDoc, data, fake, halden, playfulPersonal, resolveFromDirections, snapshot } from "./helpers.ts";

test("the system prompt is built from the spec and never offers a shell component", () => {
  const system = systemPrompt();
  snapshot("system.txt", system);
  assert.equal(systemPrompt(), system, "the same text every time");
  for (const shell of ["Frame", "AppBar", "Footer", "Outlet", "Custom"]) {
    assert.ok(!system.includes(`- ${shell}(`), `${shell} is not in the catalog`);
    assert.match(system, new RegExp(`Never use [^\\n]*\\b${shell}\\b`));
  }
  assert.match(system, /- Confirm\(/);
  for (const p of PATTERNS) assert.ok(system.includes(`- ${p.id}: `), p.id);
});

test("an allow-list narrows the catalog and adds a rule", () => {
  const system = systemPrompt({ components: ["Confirm", "DetailList", "Status"] });
  assert.match(system, /- Confirm\(/);
  assert.ok(!system.includes("- Table("));
  assert.match(system, /15\. Use only the components listed below\./);
});

test("the user turn under calm-finance: capabilities, data paths, profile, voice, rules, patterns and exemplars", async () => {
  const runtime = createRuntime({ generator: fake(["{}"]), direction: calmFinance(), resolveExemplar: resolveFromDirections });
  const ask = { ask: "Send £250 to Alex for the rent", intent: "money.send", capabilities, data };
  const { system, messages } = await runtime.prompt(ask);
  assert.equal(system, systemPrompt());
  assert.equal(messages.length, 1);
  snapshot("user-calm-finance.txt", messages[0].content);
  assert.equal((await runtime.prompt(ask)).messages[0].content, messages[0].content, "the same text every time");
});

test("the user turn under halden, with the screen shown last time and a named pattern", () => {
  const text = userPrompt({ ask: "confirm the rent", intent: "money.send", pattern: "confirm-destructive", capabilities, data, direction: halden(), previous: confirmDoc() });
  snapshot("user-halden-previous.txt", text);
  assert.match(text, /^Pattern: confirm-destructive$/m);
  assert.ok(!text.includes('"data":'), "a remembered document goes in without its data");
});

test("a Direction's disallowed patterns and open freedom", () => {
  const text = userPrompt({ ask: "my habits", intent: "habits.track", direction: { ...playfulPersonal(), patterns: { disallow: ["multi-step-form"] } } });
  assert.match(text, /Never use these patterns: multi-step-form\./);
  assert.match(text, /Freedom: open\./);
  assert.match(text, /Lead with|as a Chart/);
});

test("the repair turn lists errors first and asks for the whole document again", () => {
  const text = repairPrompt([
    { severity: "warning", check: "rule:voice-no-exclamation", message: "No exclamation marks" },
    { severity: "error", check: "spec", message: '/components/0/summary: references unknown component "missing"' },
  ]);
  snapshot("repair.txt", text);
  assert.ok(text.indexOf("[spec]") < text.indexOf("[rule:voice-no-exclamation]"));
});

test("data paths: leaves with their type, lists once with their items' fields, keys escaped", () => {
  assert.deepEqual(dataPaths({ quote: { id: "q", amount: 2 }, books: [{ title: "A", id: 1 }, { author: "B" }], tags: ["x"], "a/b": null }), [
    "/quote/id (string)",
    "/quote/amount (number)",
    "/books (list of 2; each item has title, id, author)",
    "/tags (list of 1; items: string)",
    "/a~1b (null)",
  ]);
  const many = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, i]));
  const paths = dataPaths(many);
  assert.equal(paths.length, 81);
  assert.equal(paths.at(-1), "… and 20 more");
});

test("patterns are chosen by relevance to the ask and the risk on offer", () => {
  const prefer = ["review-and-submit", "confirm-destructive", "compare-and-choose"];
  const risky = relevantPatterns(prefer, PATTERNS, "send the rent", "money.send", capabilities).map((p) => p.id);
  assert.equal(risky[0], "confirm-destructive");
  assert.ok(!risky.includes("compare-and-choose"));
  const choosing = relevantPatterns(prefer, PATTERNS, "compare plans and choose one", "plans.compare").map((p) => p.id);
  assert.equal(choosing[0], "compare-and-choose");
  assert.deepEqual(relevantPatterns(prefer, PATTERNS, "zzz", "qqq"), []);
});

test("exemplars are chosen by shared words, ties in the Direction's order, up to the limit", () => {
  const ex = [{ request: "send Alex the rent" }, { request: "confirm sending £250 to Alex" }, { request: "show my budget" }];
  assert.deepEqual(relevantExemplars(ex, "send Alex £250", "money.send", 2).map((e) => e.request), ["confirm sending £250 to Alex", "send Alex the rent"]);
  assert.deepEqual(relevantExemplars(ex, "budget", "budget.view", 5).map((e) => e.request), ["show my budget"]);
  assert.deepEqual(relevantExemplars(ex, "nothing alike", "x.y", 2), []);
});
