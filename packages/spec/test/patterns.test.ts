import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadPatterns, validatePatternFile, checkPattern } from "../src/patterns.ts";
import { PATTERN_MUTATIONS } from "./mutations.ts";

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

for (const [name, file, fn, rule] of PATTERN_MUTATIONS) {
  test(`pattern check fails: ${name}`, () => {
    const d = load(file);
    fn(d);
    assert.ok(failures(d).some((f) => f.id === rule), `expected ${rule} to fail; got ${JSON.stringify(failures(d))}`);
  });
}

test("unknown pattern is reported", () => {
  assert.equal(failures({ surface: { pattern: "nope" }, root: "a", components: [] })[0].id, "unknown-pattern");
});
