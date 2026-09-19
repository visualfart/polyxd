import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { evaluateRules } from "../src/patterns.ts";
import { directionRules, compileVoice } from "../src/direction.ts";
import { readingGrade } from "../src/checks.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: false, discriminator: true });
ajv.addSchema(read("../schema/check.schema.json"));
const compile = (s: string) => ajv.compile(read(`../schema/${s}`));
const validators = { journey: compile("journey.schema.json"), direction: compile("direction.schema.json"), event: compile("event.schema.json") };
const listJson = (dir: string) => readdirSync(new URL(dir, import.meta.url)).filter((f) => f.endsWith(".json"));

for (const f of listJson("../examples/journeys/")) {
  test(`journey ${f} is valid`, () => {
    const ok = validators.journey(read(`../examples/journeys/${f}`));
    assert.ok(ok, JSON.stringify(validators.journey.errors));
  });
}
for (const f of listJson("../examples/directions/")) {
  test(`direction ${f} is valid`, () => {
    const ok = validators.direction(read(`../examples/directions/${f}`));
    assert.ok(ok, JSON.stringify(validators.direction.errors));
  });
}
test("event example is valid", () => assert.ok(validators.event(read("../examples/events/action-taken.json")), JSON.stringify(validators.event.errors)));

test("journey acceptance criteria pass on the confirm surface and catch a vague label", () => {
  const journey = read("../examples/journeys/money.send.json");
  const doc = read("../examples/money-send-confirm.json");
  assert.deepEqual(evaluateRules(journey.acceptance, doc).filter((r) => !r.pass), []);
  doc.components[0].confirm.label = "Send money";
  assert.equal(evaluateRules(journey.acceptance, doc).find((r) => r.id === "confirm-names-amount")!.pass, false);
});

test("the same surface can pass one direction and fail another (taste is enforceable)", () => {
  const calm = read("../examples/directions/calm-finance.json");
  const playful = read("../examples/directions/playful-personal.json");
  const overview = read("../examples/money-balance-overview.json");
  const failed = (dir: any, doc: any) => evaluateRules(directionRules(dir), doc).filter((r) => !r.pass).map((r) => r.id);
  // "Recent transactions" breaks calm-finance's glossary; the chart satisfies playful-personal.
  assert.deepEqual(failed(calm, overview), ["voice-glossary-payment"]);
  assert.deepEqual(failed(playful, overview), []);
  assert.deepEqual(failed(playful, read("../examples/tasks-list.json")), ["celebrate-progress"]);
});

const withCopy = (mutate: (d: any) => void) => {
  const d = read("../examples/tasks-add.json");
  mutate(d);
  return d;
};
const voiceFails = (voice: any, doc: any) => evaluateRules(compileVoice({ voice }), doc).filter((r) => !r.pass).map((r) => r.id);

test("copy and tone settings compile into checks that catch what they should", () => {
  const byId = (d: any, id: string) => d.components.find((c: any) => c.id === id);
  assert.deepEqual(voiceFails({ casing: "sentence" }, withCopy((d) => (byId(d, "form").submit.label = "Add New Task"))), ["voice-casing"]);
  assert.deepEqual(voiceFails({ labels: { maxWords: 3 } }, withCopy((d) => (byId(d, "form").submit.label = "Add this task to my list now"))), ["voice-label-length"]);
  assert.deepEqual(voiceFails({ punctuation: { emoji: "never" } }, withCopy((d) => (byId(d, "title").label = "Task ✅"))), ["voice-no-emoji"]);
  assert.deepEqual(voiceFails({ spelling: "en-GB" }, withCopy((d) => (byId(d, "notes").label = "Favorite color"))), ["voice-spelling"]);
  assert.deepEqual(voiceFails({ person: "you" }, withCopy((d) => (byId(d, "notes").label = "What we should know"))), ["voice-person"]);
  assert.deepEqual(voiceFails({ avoid: ["simply"] }, withCopy((d) => (byId(d, "title").label = "Simply type a task"))), ["voice-avoid"]);
  assert.deepEqual(voiceFails({ casing: "sentence", labels: { maxWords: 4 }, spelling: "en-GB", person: "you", avoid: ["simply"] }, read("../examples/tasks-add.json")), []);
});

test("reading level separates plain from dense writing", () => {
  assert.ok(readingGrade("Your card is frozen. You can unfreeze it at any time.") < 6);
  assert.ok(readingGrade("Notwithstanding the aforementioned considerations, reactivation necessitates comprehensive verification of institutional authorisation.") > 14);
});
