import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { checkCapabilities } from "../src/capabilities.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const registry = read("../examples/registry/capabilities.json");
const examples = readdirSync(new URL("../examples/", import.meta.url)).filter((f) => f.endsWith(".json"));
const load = (f: string) => read(`../examples/${f}`);
const byId = (d: any, id: string) => d.components.find((c: any) => c.id === id);

test("demo registry is valid", () => {
  const validate = new Ajv2020({ strict: false }).compile(read("../schema/capabilities.schema.json"));
  assert.ok(validate(registry), JSON.stringify(validate.errors));
});

for (const f of examples) {
  test(`example ${f} only uses registered capabilities, safely`, () => assert.deepEqual(checkCapabilities(load(f), registry), []));
}

test("unregistered capability", () => {
  const d = load("tasks-add.json");
  byId(d, "form").submit.action.event.name = "task.saveEverything";
  assert.match(checkCapabilities(d, registry)[0].message, /not a registered capability/);
});

test("destructive capability outside Confirm", () => {
  const d = load("tasks-list.json");
  byId(d, "add").action = { event: { name: "project.delete", context: { id: "pr_7" } } };
  assert.match(checkCapabilities(d, registry).map((i) => i.message).join("\n"), /destructive and must be triggered from a Confirm/);
});

test("consequential capability without review or Confirm", () => {
  const d = load("travel-booking-review.json");
  delete d.surface.pattern;
  assert.match(checkCapabilities(d, registry)[0].message, /consequential and needs a Confirm or a review step/);
});

test("checkout finish is allowed because the last step is a review", () => {
  const d = load("shop-checkout.json");
  assert.deepEqual(checkCapabilities(d, registry), []);
  byId(d, "steps").steps.pop();
  assert.match(checkCapabilities(d, registry)[0].message, /consequential/);
});

test("flagged-off capability", () => {
  assert.match(checkCapabilities(load("personal-reading-log.json"), registry, { "reading-import": false })[0].message, /switched off by flag/);
});

test("undeclared and missing inputs are warnings", () => {
  const d = load("tasks-add.json");
  const ctx = byId(d, "form").submit.action.event.context;
  delete ctx.title;
  ctx.colour = "red";
  const text = checkCapabilities(d, registry).map((i) => `${i.severity}: ${i.message}`).join("\n");
  assert.match(text, /warning: "task.save" does not declare input "colour"/);
  assert.match(text, /warning: "task.save" requires input "title"/);
});
