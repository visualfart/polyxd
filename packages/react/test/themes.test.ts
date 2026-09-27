import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { loadContract, loadDesignSystem } from "@polyxd/spec";
import { themeCss, cssVar, checkExtras, loadExtras } from "../scripts/build-themes.ts";

const packages = new URL("../../", import.meta.url);
const packs = readdirSync(packages).filter((d) => d.startsWith("ds-") && existsSync(new URL(`${d}/manifest.json`, packages)));
const manifestPath = (pack: string) => new URL(`${pack}/manifest.json`, packages).pathname;

test("there are at least three design-system packs", () => assert.ok(packs.length >= 3, packs.join(", ")));

for (const pack of packs) {
  test(`${pack} compiles to CSS with every contract token in every mode, and the committed CSS is current`, async () => {
    const contract = await loadContract();
    const { manifest, modes } = await loadDesignSystem(manifestPath(pack));
    const css = themeCss(manifest.name, modes, manifest.defaultMode, Object.keys(contract.tokens), manifest.layout, await loadExtras(manifestPath(pack), manifest));
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

// The two hand-drawn templates are the only packs that need CSS tokens can't express.
const WITH_EXTRAS = ["ds-sketch", "ds-wireframe"];

test("an extras stylesheet is appended for the two sketch packs and no other", async () => {
  for (const pack of packs) {
    const manifest = JSON.parse(readFileSync(manifestPath(pack), "utf8"));
    const extras = await loadExtras(manifestPath(pack), manifest);
    const committed = readFileSync(new URL(`../themes/${manifest.name}.css`, import.meta.url), "utf8");
    const marker = `/* Extras from the ${manifest.name} pack's manifest`;
    if (WITH_EXTRAS.includes(pack)) {
      assert.ok(extras, `${pack} names no extras stylesheet`);
      assert.ok(committed.includes(marker), `${pack}: extras not appended to themes/${manifest.name}.css`);
      assert.ok(committed.trimEnd().endsWith(extras!.trim()), `${pack}: extras are not appended verbatim`);
    } else {
      assert.equal(extras, undefined, `${pack} names an extras stylesheet; only ${WITH_EXTRAS.join(" and ")} may`);
      assert.ok(!committed.includes("/* Extras from"), `${pack}: theme carries extras it shouldn't`);
    }
  }
});

test("an extras stylesheet is scoped to its pack and names no colour of its own", async () => {
  const contract = await loadContract();
  const known = new Set(
    Object.entries(contract.tokens).flatMap(([name, spec]) =>
      spec.type === "typography" ? ["family", "size", "weight", "line-height", "letter-spacing"].map((p) => `${cssVar(name)}-${p}`) : [cssVar(name)],
    ),
  );
  for (const pack of WITH_EXTRAS) {
    const manifest = JSON.parse(readFileSync(manifestPath(pack), "utf8"));
    const extras = (await loadExtras(manifestPath(pack), manifest))!;
    assert.deepEqual(checkExtras(manifest.name, extras), [], pack);
    // The same audit the renderer's stylesheet is held to: every variable read is a contract token,
    // or one the extras define themselves (sketch's tilt), so a colour literal can't hide in a var().
    const defined = new Set([...extras.matchAll(/(--pxd-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const used = [...extras.matchAll(/var\((--pxd-[a-z0-9-]+)/g)].map((m) => m[1]);
    assert.deepEqual(used.filter((v) => !known.has(v) && !defined.has(v)), [], pack);
  }
});

test("the compiler rejects extras that are unscoped or carry a colour literal", async () => {
  const contract = await loadContract();
  const { manifest, modes } = await loadDesignSystem(manifestPath("ds-sketch"));
  const build = (extras: string) => themeCss(manifest.name, modes, manifest.defaultMode, Object.keys(contract.tokens), manifest.layout, extras);
  assert.throws(() => build(`.pxd-card { border-style: dashed; }`), /not scoped/);
  assert.throws(() => build(`[data-pxd-theme="sketch"] .pxd-card { border-color: #333; }`), /colour literal/);
  assert.throws(() => build(`[data-pxd-theme="sketch"] .pxd-card { background: rgb(0 0 0 / 0.5); }`), /colour literal/);
  assert.throws(() => build(`[data-pxd-theme="other"] .pxd-card { border-style: dashed; }`), /not scoped/);
  assert.doesNotThrow(() => build(`@media (prefers-reduced-motion: reduce) { [data-pxd-theme="sketch"] .pxd-card { transform: none; } }`));
});

test("colours only guaranteed for graphics (3:1) are never used for text", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const graphicsOnly = /--pxd-color-(data-[a-z0-9-]+|status-[a-z]+-emphasis|border-[a-z]+)\b/;
  const bad = [...css.matchAll(/(?:^|[;{\s])color:\s*var\((--pxd-[a-z0-9-]+)\)/g)].map((m) => m[1]).filter((v) => graphicsOnly.test(v));
  assert.deepEqual(bad, []);
});
