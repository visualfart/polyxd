import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("the runtime, its default checks included, loads no file system and no Playwright", () => {
  const code = `
    import { registerHooks } from "node:module";
    const seen = [];
    registerHooks({ resolve(specifier, context, next) { seen.push(specifier); return next(specifier, context); } });
    await import(process.env.ENTRY);
    process.stdout.write(JSON.stringify(seen));
  `;
  const entry = new URL("../src/index.ts", import.meta.url).href;
  const seen: string[] = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", code], { env: { ...process.env, ENTRY: entry }, encoding: "utf8" }));
  assert.ok(seen.includes("@polyxd/verifier/static"));
  assert.deepEqual(seen.filter((s) => /^(node:)?fs(\/promises)?$|^(playwright|playwright-core|axe-core)(\/|$)|^@polyxd\/verifier$/.test(s)), []);
});

test("the runtime generates and checks a document with eval and new Function disabled, as in a Worker", () => {
  const code = `
    import { readFileSync } from "node:fs";
    const { createRuntime, checkDocument } = await import(process.env.ENTRY);
    const refused = (() => { try { new Function("return 1"); return false; } catch (e) { return e instanceof EvalError; } })();
    const doc = JSON.parse(readFileSync(process.env.DOC, "utf8"));
    const runtime = createRuntime({ generator: { name: "fake", generate: async () => JSON.stringify(doc) } });
    const { report } = await runtime.generate({ ask: "Add a task", data: doc.data });
    const broken = checkDocument({ ...doc, components: [{ ...doc.components[0], colour: "red" }, ...doc.components.slice(1)] });
    process.stdout.write(JSON.stringify({ refused, valid: report.valid, broken: broken.filter((f) => f.severity === "error").map((f) => f.check) }));
  `;
  const env = { ...process.env, ENTRY: new URL("../src/index.ts", import.meta.url).href, DOC: new URL("../../spec/examples/tasks-add.json", import.meta.url).pathname };
  const out = JSON.parse(execFileSync(process.execPath, ["--disallow-code-generation-from-strings", "--input-type=module", "-e", code], { env, encoding: "utf8" }));
  assert.equal(out.refused, true, "the child really forbids code generation");
  assert.equal(out.valid, true);
  assert.deepEqual(out.broken, ["spec"]);
});
