import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadPatterns, validatePatternFile, checkPattern } from "../src/patterns.ts";

const patterns = loadPatterns();
const load = (name: string) => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8"));
const failures = (doc: any, id?: string) => checkPattern(doc, id).filter((r) => !r.pass);
const byId = (d: any, id: string) => d.components.find((c: any) => c.id === id);

test("there are 6 core patterns", () => assert.equal(patterns.size, 6));

for (const [id, p] of patterns) {
  test(`pattern ${id} is a valid pattern file`, () => {
    assert.ok(validatePatternFile(p), JSON.stringify(validatePatternFile.errors, null, 2));
  });
  for (const ex of p.examples ?? []) {
    test(`example ${ex} declares and fully satisfies ${id}`, () => {
      const doc = load(ex);
      assert.equal(doc.surface.pattern, id);
      assert.deepEqual(failures(doc), []);
    });
  }
}

const cases: [string, string, (d: any) => void, string][] = [
  ["generic confirm label", "money-send-confirm.json", (d) => (byId(d, "confirm").confirm.label = "OK"), "specific-confirm-label"],
  ["no consequence", "money-send-confirm.json", (d) => delete byId(d, "confirm").consequence, "states-consequence"],
  ["destructive without typed confirmation", "tasks-delete-project.json", (d) => delete byId(d, "confirm").typeToConfirm, "typed-for-destructive"],
  ["too many inputs in one view", "money-send-form.json", (d) => {
    for (let i = 0; i < 4; i++) d.components.push({ id: `x${i}`, component: "TextInput", label: `Extra ${i}`, value: { path: `/draft/x${i}` } });
    byId(d, "form").children.push("x0", "x1", "x2", "x3");
  }, "short-views"],
  ["results before filters", "shop-browse-filter.json", (d) => (byId(d, "root").children = ["results", "filters"]), "filters-first"],
  ["no empty state", "shop-browse-filter.json", (d) => delete byId(d, "results").empty, "empty-state"],
  ["comparison without choose", "shop-compare-plans.json", (d) => delete byId(d, "root").choose, "can-choose"],
  ["'Submit' on a review", "travel-booking-review.json", (d) => (byId(d, "form").submit.label = "Submit"), "commitment-label"],
];
for (const [name, file, fn, rule] of cases) {
  test(`pattern check fails: ${name}`, () => {
    const d = load(file);
    fn(d);
    assert.ok(failures(d).some((f) => f.id === rule), `expected ${rule} to fail; got ${JSON.stringify(failures(d))}`);
  });
}

test("unknown pattern is reported", () => {
  assert.equal(failures({ surface: { pattern: "nope" }, root: "a", components: [] })[0].id, "unknown-pattern");
});
