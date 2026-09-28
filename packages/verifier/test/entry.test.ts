import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadPatterns } from "@polyxd/spec/patterns";
import { patternsSource } from "../scripts/build-patterns.ts";
import { PATTERN_CHECKS } from "../src/patterns.generated.ts";
import { staticAudit, PATTERN_IDS } from "../src/static.ts";
import { load, registry } from "./helpers.ts";

/** Every module specifier a fresh Node resolves while importing `entry`, through import or require. */
function resolvedBy(entry: URL): string[] {
  const code = `
    import { registerHooks } from "node:module";
    const seen = [];
    registerHooks({ resolve(specifier, context, next) { seen.push(specifier); return next(specifier, context); } });
    await import(process.env.ENTRY);
    process.stdout.write(JSON.stringify(seen));
  `;
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", code], { env: { ...process.env, ENTRY: entry.href }, encoding: "utf8" });
  return JSON.parse(out);
}

const heavy = (specifiers: string[]) => specifiers.filter((s) => /^(playwright|playwright-core|axe-core)(\/|$)/.test(s));
const fileSystem = (specifiers: string[]) => specifiers.filter((s) => /^(node:)?fs(\/promises)?$/.test(s));

test("the inlined pattern checks are up to date with the spec (npm run build:patterns -w @polyxd/verifier)", async () => {
  const committed = readFileSync(new URL("../src/patterns.generated.ts", import.meta.url), "utf8");
  assert.equal(committed, await patternsSource());
  const fromDisk = loadPatterns();
  assert.deepEqual(PATTERN_IDS.sort(), [...fromDisk.keys()].sort());
  for (const [id, p] of fromDisk) assert.deepEqual(PATTERN_CHECKS[id], p.checks, id);
});

test("@polyxd/verifier/static is a package export of its own", () => {
  const resolved = fileURLToPath(import.meta.resolve("@polyxd/verifier/static"));
  assert.match(resolved, /packages[/\\]verifier[/\\]dist[/\\]static\.js$/);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies.playwright, undefined, "playwright is not a dependency");
  assert.equal(pkg.peerDependenciesMeta?.playwright?.optional, true, "playwright is an optional peer");
});

test("importing the static checks loads no Playwright, no axe-core and no file system", () => {
  const seen = resolvedBy(new URL("../src/static.ts", import.meta.url));
  assert.ok(seen.includes("@polyxd/spec/browser"), "it did load the validator");
  assert.deepEqual(heavy(seen), []);
  assert.deepEqual(fileSystem(seen), []);
  assert.ok(!seen.includes("@polyxd/spec") && !seen.includes("@polyxd/spec/patterns"), "the spec's file-reading entries stay out");
});

test("the main entry doesn't load Playwright until launch() is called", () => {
  const seen = resolvedBy(new URL("../src/index.ts", import.meta.url));
  assert.ok(seen.includes("./static.ts"));
  assert.deepEqual(heavy(seen), []);
});

test("missingData: \"warning\" reports a blank binding as a warning, the default as an error", () => {
  const doc = load("money-send-confirm");
  delete doc.data.quote.recipientAccount;
  const at = (severity: string) => staticAudit(doc, { registry, ...(severity === "warning" ? { missingData: "warning" as const } : {}) }).filter((f) => f.check === "data:missing-path");
  assert.ok(at("error").length > 0 && at("error").every((f) => f.severity === "error"));
  assert.ok(at("warning").length > 0 && at("warning").every((f) => f.severity === "warning"));
});
