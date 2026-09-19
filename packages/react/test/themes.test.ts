import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { loadContract, loadDesignSystem } from "@polyxd/spec";
import { themeCss, cssVar } from "../scripts/build-themes.ts";

const packages = new URL("../../", import.meta.url);
const packs = readdirSync(packages).filter((d) => d.startsWith("ds-") && existsSync(new URL(`${d}/manifest.json`, packages)));

test("there are at least three design-system packs", () => assert.ok(packs.length >= 3, packs.join(", ")));

for (const pack of packs) {
  test(`${pack} compiles to CSS with every contract token in every mode, and the committed CSS is current`, async () => {
    const contract = await loadContract();
    const { manifest, modes } = await loadDesignSystem(new URL(`${pack}/manifest.json`, packages).pathname);
    const css = themeCss(manifest.name, modes, manifest.defaultMode, Object.keys(contract.tokens));
    for (const mode of modes.keys()) assert.match(css, new RegExp(`data-pxd-mode="${mode}"`));
    for (const [name, spec] of Object.entries(contract.tokens)) {
      const v = spec.type === "typography" ? `${cssVar(name)}-size` : cssVar(name);
      assert.ok(css.includes(`${v}:`), `${pack}: ${v} missing`);
    }
    assert.match(css, /--primary: var\(--pxd-color-action-primary-background\)/);
    const committed = readFileSync(new URL(`../themes/${manifest.name}.css`, import.meta.url), "utf8");
    assert.equal(committed, css, `themes/${manifest.name}.css is stale: run npm run build:themes -w @polyxd/react`);
  });
}

test("the stylesheet only uses semantic token variables that exist in the contract", async () => {
  const contract = await loadContract();
  const known = new Set(
    Object.entries(contract.tokens).flatMap(([name, spec]) =>
      spec.type === "typography" ? ["family", "size", "weight", "line-height", "letter-spacing"].map((p) => `${cssVar(name)}-${p}`) : [cssVar(name)],
    ),
  );
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const used = new Set([...css.matchAll(/var\((--pxd-[a-z0-9-]+)/g)].map((m) => m[1]));
  const unknown = [...used].filter((v) => !known.has(v));
  assert.deepEqual(unknown, []);
});

test("colours only guaranteed for graphics (3:1) are never used for text", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const graphicsOnly = /--pxd-color-(data-[a-z0-9-]+|status-[a-z]+-emphasis|border-[a-z]+)\b/;
  const bad = [...css.matchAll(/(?:^|[;{\s])color:\s*var\((--pxd-[a-z0-9-]+)\)/g)].map((m) => m[1]).filter((v) => graphicsOnly.test(v));
  assert.deepEqual(bad, []);
});
