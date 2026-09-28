import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/check.ts";

const doc = (satisfaction: number, change: number) => ({
  specVersion: "0.3.0",
  surface: { id: "week", title: "Support this week" },
  root: "root",
  components: [
    { id: "root", component: "Group", children: ["sat"] },
    { id: "sat", component: "Metric", label: "Satisfaction", value: { path: "/sat" }, format: { type: "percent" }, change: { value: { path: "/change" }, format: { type: "percent" } } },
  ],
  data: { sat: satisfaction, change },
});

test("a percent written as a whole number is a warning with the fraction to use", () => {
  const r = validate(doc(94, 2));
  const found = r.issues.filter((i) => /"percent" format/.test(i.message));
  assert.equal(found.length, 2, JSON.stringify(r.issues, null, 2));
  assert.ok(found.every((i) => i.severity === "warning"));
  assert.match(found.find((i) => i.pointer === "/components/1/value")!.hint!, /store 0\.94 at \/sat/);
  assert.equal(r.valid, true, "a warning, not an error");
});

test("fractions pass without a percent warning", () => {
  const r = validate(doc(0.94, 0.02));
  assert.equal(r.issues.filter((i) => /"percent" format/.test(i.message)).length, 0);
});
