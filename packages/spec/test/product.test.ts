import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { evaluateRules } from "../src/patterns.ts";

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
  const failed = (dir: any, doc: any) => evaluateRules(dir.rules, doc).filter((r) => !r.pass).map((r) => r.id);
  // "Recent transactions" breaks calm-finance's glossary; the chart satisfies playful-personal.
  assert.deepEqual(failed(calm, overview), ["say-payment"]);
  assert.deepEqual(failed(playful, overview), []);
  const tasks = read("../examples/tasks-list.json");
  assert.deepEqual(failed(playful, tasks), ["celebrate-progress"]);
});
