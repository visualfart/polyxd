import { test } from "node:test";
import assert from "node:assert/strict";
import { inferMapping } from "../src/infer.ts";

/** A small product's tokens: prefixed, unprefixed, and named nothing like ours. */
const ACME = {
  "--acme-bg": "#ffffff",
  "--acme-bg-subtle": "#f7f7f8",
  "--acme-surface-card": "#ffffff",
  "--acme-text": "#16181d",
  "--acme-text-muted": "#6b7280",
  "--acme-border": "#e4e4e7",
  "--primary": "#2563eb",
  "--primary-foreground": "#ffffff",
  "--destructive": "#dc2626",
  "--success": "#16a34a",
  "--success-bg": "#f0fdf4",
  "--radius-md": "8px",
  "--space-4": "16px",
};

test("a prefixed variable maps as well as a bare one", () => {
  const { mapping } = inferMapping(ACME);
  assert.equal(mapping.tokens["color.surface.default"], "acme-bg");
  assert.equal(mapping.tokens["color.text.default"], "acme-text");
  assert.equal(mapping.tokens["color.border.default"], "acme-border");
  assert.equal(mapping.tokens["color.action.primary.background"], "primary");
});

test("one variable can serve several tokens", () => {
  const { mapping } = inferMapping(ACME);
  assert.equal(mapping.tokens["radius.control"], "radius-md");
  assert.equal(mapping.tokens["radius.default"], "radius-md");
});

test("what one role implies about another is derived and marked as such", () => {
  const { guesses } = inferMapping(ACME);
  const positive = guesses.find((g) => g.token === "color.data.positive");
  assert.equal(positive?.how, "derived");
  assert.match(positive!.why, /success/);
});

test("a value of the wrong kind is never mapped", () => {
  const { mapping } = inferMapping({ "--primary": "16px", "--radius-md": "#ff0000" });
  assert.equal(mapping.tokens["color.action.primary.background"], undefined);
  assert.equal(mapping.tokens["radius.control"], undefined);
});

test("nothing is invented when there is nothing to read", () => {
  const { mapping } = inferMapping({});
  assert.deepEqual(mapping.tokens, {});
});

test("splitModes keeps each mode's own values out of the shared file, and one mode is all shared", async () => {
  const { splitModes } = await import("../src/index.ts");
  const token = (v: string) => ({ $value: v, $type: "color" });
  const light = { color: { surface: { default: token("#ffffff") }, brand: token("#1d4ed8") }, shape: { control: { $value: { value: 8, unit: "px" }, $type: "dimension" } } };
  const dark = { color: { surface: { default: token("#0b0c0f") }, brand: token("#1d4ed8") }, shape: { control: { $value: { value: 8, unit: "px" }, $type: "dimension" } } };
  const split = splitModes(light, dark);
  assert.deepEqual(split.light, { color: { surface: { default: token("#ffffff") } } });
  assert.deepEqual(split.dark, { color: { surface: { default: token("#0b0c0f") } } });
  assert.deepEqual(split.semantic, { color: { brand: token("#1d4ed8") }, shape: light.shape }, "only what both modes share");
  assert.deepEqual(splitModes(light), { light: {}, dark: {}, semantic: light });
});

test("polyxd pack --dark: the dark mode renders dark (semantic.json no longer overwrites it)", async () => {
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const { loadDesignSystem } = await import("@polyxd/spec");
  const dir = await mkdtemp(join(tmpdir(), "polyxd-pack-dark-"));
  await writeFile(join(dir, "acme.css"), ":root { --acme-bg: #ffffff; --acme-text: #16181d; --primary: #1d4ed8; --primary-foreground: #ffffff; --radius-md: 8px; }");
  await writeFile(join(dir, "acme-dark.css"), ":root { --acme-bg: #0b0c0f; --acme-text: #f4f4f5; --primary: #93c5fd; --primary-foreground: #0b0c0f; --radius-md: 8px; }");
  execFileSync(process.execPath, [new URL("../src/polyxd.ts", import.meta.url).pathname, "pack", "./acme.css", "--dark", "./acme-dark.css", "--name", "acme"], { cwd: dir, stdio: "ignore" });
  const { modes } = await loadDesignSystem(join(dir, "ds-acme/manifest.json"));
  const value = (mode: string, key: string) => (modes.get(mode) as any).get(key)?.$value ?? (modes.get(mode) as any).get(key)?.value;
  assert.equal(value("light", "color.surface.default"), "#ffffff");
  assert.equal(value("dark", "color.surface.default"), "#0b0c0f");
  assert.equal(value("dark", "color.text.default"), "#f4f4f5");
  assert.equal(value("dark", "color.action.primary.background"), "#93c5fd");
  assert.equal(value("light", "color.action.primary.background"), "#1d4ed8");
});
