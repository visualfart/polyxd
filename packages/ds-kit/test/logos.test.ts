import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDesignSystem } from "@polyxd/spec";
import { fileURLToPath } from "node:url";
import { logoProblems } from "../scripts/pack-logos.ts";
import { templateMark } from "../src/logo.ts";

test("every pack has its logo, recorded in the manifest and shipped, and template marks match their tokens", async () => {
  assert.deepEqual(await logoProblems(), []);
});

test("a template mark is drawn only from the pack's own tokens", async () => {
  const { manifest, modes } = await loadDesignSystem(fileURLToPath(new URL("../../ds-brutalist/manifest.json", import.meta.url)));
  const svg = templateMark(modes.get(manifest.defaultMode)!, "Brutalist");
  assert.match(svg, /^<svg [^>]*viewBox="0 0 32 32"/);
  assert.match(svg, /fill="#ffe600"/, "Brutalist's yellow is its accent");
  assert.match(svg, / rx="0"/, "Brutalist has no radius anywhere");
  assert.equal((svg.match(/<rect /g) ?? []).length, 5, "its hard shadow is cast behind the tile");
  assert.doesNotMatch(svg, /<(script|image|use)\b/);
});
