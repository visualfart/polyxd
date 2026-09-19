import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { staticAudit } from "../src/static.ts";
import { load, byId, registry, examplesDir } from "./helpers.ts";

const checks = (doc: any) => staticAudit(doc, { registry }).map((f) => `${f.severity} ${f.check}`);

for (const f of readdirSync(examplesDir).filter((f) => f.endsWith(".json"))) {
  test(`example ${f} passes every static check`, () => assert.deepEqual(staticAudit(load(f.replace(".json", "")), { registry }), []));
}

test("two controls with the same name are ambiguous for agents", () => {
  const d = load("tasks-add");
  byId(d, "notes").label = "Task";
  assert.ok(checks(d).includes("error agent:ambiguous-name"));
});

test("empty visible text is an error", () => {
  const d = load("personal-habits");
  byId(d, "week").summary = " ";
  assert.ok(checks(d).includes("error text:empty"));
});

test("generic button labels are flagged", () => {
  const d = load("personal-reading-log");
  byId(d, "add").label = "OK";
  assert.ok(checks(d).includes("warning copy:generic-label"));
});
