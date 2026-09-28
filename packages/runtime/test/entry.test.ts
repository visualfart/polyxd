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
