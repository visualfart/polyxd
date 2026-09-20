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
    const css = themeCss(manifest.name, modes, manifest.defaultMode, Object.keys(contract.tokens), manifest.layout);
    // A pack with one mode (GOV.UK has one theme) renders it whichever mode is asked for, so its
    // selector carries no mode at all; a pack with several names each one.
    if (modes.size === 1) assert.match(css, new RegExp(`\\[data-pxd-theme="${manifest.name}"\\] \\{`));
    else for (const mode of modes.keys()) assert.match(css, new RegExp(`data-pxd-mode="${mode}"`));
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
  // --pxd-layout-* are not contract tokens: they are the few layout decisions a pack may set
  // instead of a value, and the test below is what holds them to their own rule.
  const unknown = [...used].filter((v) => !known.has(v) && !v.startsWith("--pxd-layout-"));
  assert.deepEqual(unknown, []);
});

test("a layout variable a pack may set is always read with a fallback", () => {
  // Only Carbon sets any today. Every other pack sets none, and must still render — so the
  // renderer's own default has to be written at the point of use, not assumed.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const withoutFallback = [...css.matchAll(/var\((--pxd-layout-[a-z0-9-]+)\s*([^)]*)\)/g)]
    .filter((m) => !m[2].trim().startsWith(","))
    .map((m) => m[1]);
  assert.deepEqual(withoutFallback, []);
});

test("colours only guaranteed for graphics (3:1) are never used for text", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const graphicsOnly = /--pxd-color-(data-[a-z0-9-]+|status-[a-z]+-emphasis|border-[a-z]+)\b/;
  const bad = [...css.matchAll(/(?:^|[;{\s])color:\s*var\((--pxd-[a-z0-9-]+)\)/g)].map((m) => m[1]).filter((v) => graphicsOnly.test(v));
  assert.deepEqual(bad, []);
});
