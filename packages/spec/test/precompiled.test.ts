/**
 * The schema validators the package runs are compiled ahead of time (scripts/build-validators.ts).
 * These tests hold them to three things: they are up to date with the schemas, they give exactly
 * Ajv's answers and errors, and they run where code generation from strings is forbidden.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { AJV_OPTIONS, validatorOutputs } from "../scripts/build-validators.ts";
import { validateUi } from "../src/ui-validator.generated.ts";
import { validatePattern } from "../src/pattern-validator.generated.ts";
import type { SchemaValidator } from "../src/schema-validator.ts";
import { DOCUMENT_MUTATIONS, PATTERN_MUTATIONS } from "./mutations.ts";

const root = new URL("../", import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const jsonFiles = (dir: string) => readdirSync(new URL(dir, root)).filter((f) => f.endsWith(".json")).sort();

test("the precompiled validators are up to date with the schemas (run npm run build:schema)", async () => {
  for (const [path, content] of Object.entries(await validatorOutputs(json("schema/ui.schema.json")))) {
    assert.ok(readFileSync(new URL(path, root), "utf8") === content, `${path} is stale: run npm run build:schema -w @polyxd/spec`);
  }
});

// ---------- Parity with Ajv compiling the same schemas at run time ----------

const ajv = new Ajv2020(AJV_OPTIONS);
ajv.addSchema(json("schema/check.schema.json"));
const ajvUi = ajv.compile(json("schema/ui.schema.json"));
const ajvPattern = ajv.compile(json("schema/pattern.schema.json"));

const WRONG_VALUES: unknown[] = [null, 7, 1.5, -1, "x", "Textarea", true, [], {}, ["ghost"], { path: 3 }];

/**
 * Broken copies of a value, made mechanically: at every place in it, the value removed, replaced
 * by one of a type it probably isn't, and (for objects) given a key no schema knows. Deterministic,
 * so a failure names the same copy each run.
 */
function mutants(value: unknown): { at: string; value: unknown }[] {
  const out: { at: string; value: unknown }[] = [];
  const places: (string | number)[][] = [];
  const walk = (v: unknown, path: (string | number)[]) => {
    if (path.length) places.push(path);
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i]));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, [...path, k]);
  };
  walk(value, []);
  const edit = (path: (string | number)[], fn: (parent: any, key: string | number) => void) => {
    const copy = structuredClone(value) as any;
    let parent = copy;
    for (const k of path.slice(0, -1)) parent = parent[k];
    fn(parent, path.at(-1)!);
    out.push({ at: `/${path.join("/")}`, value: copy });
  };
  places.forEach((path, n) => {
    edit(path, (p, k) => (Array.isArray(p) ? p.splice(k as number, 1) : delete p[k]));
    edit(path, (p, k) => (p[k] = structuredClone(WRONG_VALUES[n % WRONG_VALUES.length])));
    edit(path, (p, k) => {
      if (p[k] && typeof p[k] === "object" && !Array.isArray(p[k])) p[k].zz = 1;
      else p[k] = typeof p[k] === "string" ? `${p[k]} !` : String(p[k]);
    });
  });
  return out;
}

function same(ours: SchemaValidator, theirs: SchemaValidator, value: unknown, what: string) {
  const a = ours(value);
  const b = theirs(value);
  assert.equal(a, b, `${what}: precompiled says ${a}, Ajv says ${b}`);
  assert.deepEqual(ours.errors ?? null, theirs.errors ?? null, `${what}: the errors differ`);
  return a;
}

test("the precompiled UI validator agrees with Ajv on every example and the tests' broken documents", () => {
  for (const f of jsonFiles("examples/")) assert.equal(same(validateUi, ajvUi, json(`examples/${f}`), f), true, `${f} is valid`);
  for (const [name, file, fn] of [...DOCUMENT_MUTATIONS, ...PATTERN_MUTATIONS]) {
    const d = json(`examples/${file}`);
    fn(d);
    same(validateUi, ajvUi, d, name);
  }
  for (const value of [null, 1, "doc", [], {}, { specVersion: "0.3.0" }]) same(validateUi, ajvUi, value, JSON.stringify(value));
});

test("the precompiled UI validator agrees with Ajv on thousands of mechanically broken examples", () => {
  let invalid = 0;
  for (const f of jsonFiles("examples/")) {
    for (const m of mutants(json(`examples/${f}`))) if (!same(validateUi, ajvUi, m.value, `${f} changed at ${m.at}`)) invalid++;
  }
  assert.ok(invalid > 5000, `only ${invalid} broken copies were invalid`);
});

test("the precompiled pattern validator agrees with Ajv on every pattern, and on broken ones", () => {
  let invalid = 0;
  for (const f of jsonFiles("patterns/")) {
    const p = json(`patterns/${f}`);
    assert.equal(same(validatePattern, ajvPattern, p, f), true, `${f} is valid`);
    for (const m of mutants(p)) if (!same(validatePattern, ajvPattern, m.value, `${f} changed at ${m.at}`)) invalid++;
  }
  assert.ok(invalid > 500, `only ${invalid} broken copies were invalid`);
});

// ---------- Where code generation from strings is forbidden (Workers, strict CSP) ----------

/** Runs an ES module in a fresh Node with eval and new Function disabled, and returns what it prints. */
function withoutCodeGeneration(source: string): unknown {
  const out = execFileSync(process.execPath, ["--disallow-code-generation-from-strings", "--input-type=module", "--eval", source], {
    cwd: fileURLToPath(root),
    encoding: "utf8",
  });
  return JSON.parse(out);
}

const probe = (entry: string) => `
  import { readFileSync } from "node:fs";
  const { validateDocument } = await import(${JSON.stringify(entry)});
  const refused = [() => new Function("return 1"), () => eval("1")].map((f) => { try { f(); return false; } catch (e) { return e instanceof EvalError; } });
  const doc = JSON.parse(readFileSync("examples/tasks-add.json", "utf8"));
  const good = validateDocument(doc);
  doc.components[0].colour = "red";
  const bad = validateDocument(doc);
  console.log(JSON.stringify({ refused, good: good.valid, bad: bad.valid, issues: bad.issues }));
`;

test("the /browser entry validates with eval and new Function disabled", () => {
  const r = withoutCodeGeneration(probe(new URL("../src/browser.ts", import.meta.url).href)) as any;
  assert.deepEqual(r.refused, [true, true], "the child really forbids code generation");
  assert.equal(r.good, true);
  assert.equal(r.bad, false);
  assert.deepEqual(r.issues, [{ severity: "error", at: "/components/0", message: 'unknown property "colour"' }]);
});

const built = existsSync(new URL("../dist/browser.js", import.meta.url));
test("the built package, imported as @polyxd/spec/browser, validates with eval and new Function disabled", { skip: built ? false : "not built" }, () => {
  const r = withoutCodeGeneration(probe("@polyxd/spec/browser")) as any;
  assert.deepEqual(r.refused, [true, true]);
  assert.equal(r.good, true);
  assert.equal(r.bad, false);
});

test("pattern files are checked with eval and new Function disabled", () => {
  const r = withoutCodeGeneration(`
    const { loadPatterns, validatePatternFile } = await import(${JSON.stringify(new URL("../src/patterns.ts", import.meta.url).href)});
    const p = [...loadPatterns().values()][0];
    console.log(JSON.stringify([validatePatternFile(p), validatePatternFile({ ...p, journey: {} })]));
  `);
  assert.deepEqual(r, [true, false]);
});
