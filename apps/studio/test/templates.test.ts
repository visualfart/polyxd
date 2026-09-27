/**
 * Templates: a pack becomes a version with a scan and a mapping that needs no hand; the ramp
 * function does what it says; edits follow aliases; and every export format's output, on a
 * template and on the Northwind fixture.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadContract, loadDesignSystem } from "@polyxd/spec";
import { loadExtras, themeCss } from "../../../packages/react/scripts/build-themes.ts";
import { index, read, resolve } from "../src/import/read.ts";
import { scan } from "../src/import/scan.ts";
import { mapRoles, type Contract } from "../src/import/map.ts";
import { packGraph } from "../src/tokens/pack.ts";
import { applyChanges } from "../src/tokens/edit.ts";
import { brandHue, formatOklch, oklchRamp, parseOklch, rebrandChanges, rebrandValue } from "../src/tokens/ramp.ts";
import { BLANK, TEMPLATE_NAMES, TEMPLATE_PACKS, allTemplates, templateGraph, templateSummary } from "../src/templates/index.ts";
import { exportDesignSystem, modeId, resolveRoles, type ExportInput } from "../src/export/index.ts";

const contract = JSON.parse(readFileSync(new URL("../../../packages/spec/tokens/semantic-contract.json", import.meta.url), "utf8")) as Contract & { contractVersion: string };
const northwind = () => read(readFileSync(new URL("./fixtures/northwind.tokens.json", import.meta.url), "utf8"), "northwind.tokens.json");
const ROLES = Object.keys(contract.tokens);

/** The mapping a template lands with: every role on its own semantic token. */
const identity = () => Object.fromEntries(ROLES.map((r) => [r, r]));
const input = (name: string, over: Partial<ExportInput> = {}): ExportInput => ({ name, version: 1, status: "live", graph: over.graph ?? templateGraph(name as any), mapping: identity(), contract, ...over });

test("every template pack becomes a graph with two modes, a clean scan and all 87 roles mapped exactly", () => {
  for (const name of TEMPLATE_NAMES) {
    const g = templateGraph(name);
    const s = scan(g);
    assert.deepEqual([...s.modes.map((m) => m.name)].sort(), ["dark", "light"], name);
    assert.equal(s.modes[0].name, TEMPLATE_PACKS[name].manifest.defaultMode, `${name}: the pack's default mode leads (Terminal is dark-first)`);
    assert.ok(s.total > 150, `${name}: ${s.total} tokens`);
    assert.equal(s.byTier.semantic, ROLES.length, `${name}: the semantic file is the 87 roles`);
    assert.deepEqual(s.issues.filter((i) => i.kind === "broken-alias" || i.kind === "circular-alias"), [], `${name}: aliases resolve`);
    const rows = mapRoles(g, contract);
    const bad = rows.filter((r) => r.status !== "exact" || r.token !== r.role);
    assert.deepEqual(bad.map((r) => `${r.role} → ${r.token} (${r.status})`), [], `${name}: every role reads its own token`);
    assert.ok(rows.every((r) => r.how === "named"), `${name}: matched by name, so accept-exact takes them all`);
    assert.equal(rows.filter((r) => r.status === "fails").length, 0, `${name}: contrast passes in both modes`);
    // Values differ by mode where the pack says so.
    const surface = rows.find((r) => r.role === "color.surface.default")!;
    assert.notEqual(surface.values.light, surface.values.dark, `${name}: the page colour changes with the mode`);
  }
});

test("a template's summary has a character line, swatches from its own tokens, a radius and a face", () => {
  const sketch = templateSummary("sketch");
  assert.match(sketch.character, /^Hand-drawn/);
  assert.ok(sketch.swatches.length >= 8);
  assert.ok(sketch.swatches.every((s) => /^(#|oklch|rgb)/i.test(s.value)), sketch.swatches.map((s) => s.value).join(" "));
  assert.ok(sketch.extras, "the sketch pack carries an extras stylesheet");
  assert.ok(sketch.font, "a display face");
  assert.match(sketch.radius, /px$/);
  const all = allTemplates();
  assert.equal(all.length, 13);
  assert.equal(all[0].name, BLANK);
  assert.ok(all.every((t) => t.character && t.swatches.length >= 8));
});

test("blank is Mono with a grey brand ramp: same structure, chroma 0, contrast still passing", () => {
  const g = templateGraph(BLANK);
  const mono = templateGraph("mono");
  assert.equal(g.tokens.length, mono.tokens.length);
  const brand = g.tokens.filter((t) => /brand-\d+$/.test(t.path) && !t.alias);
  assert.ok(brand.length >= 20);
  for (const t of brand) assert.equal(parseOklch(t.value)!.c, 0, `${t.set} ${t.path} is grey`);
  assert.equal(mapRoles(g, contract).filter((r) => r.status === "fails").length, 0);
  assert.equal(brandHue(g)!.chroma, 0);
});

test("the ramp: twelve steps at a hue, and a rebrand keeps lightness and chroma and turns only the hue", () => {
  const ramp = oklchRamp(30);
  assert.equal(Object.keys(ramp).length, 12);
  assert.deepEqual(Object.keys(ramp).slice(0, 3), ["25", "50", "100"]);
  for (const v of Object.values(ramp)) assert.equal(parseOklch(v)!.h, 30);
  assert.ok(parseOklch(ramp["25"])!.l > parseOklch(ramp["950"])!.l, "light to dark");
  assert.equal(rebrandValue("oklch(48% 0.21 275)", 30), "oklch(48% 0.21 30)");
  assert.equal(rebrandValue("oklch(48% 0.21 275 / 0.5)", 30, 0.5), "oklch(48% 0.105 30 / 0.5)");
  assert.equal(rebrandValue("#ffffff", 30), "#ffffff", "a hex white is not a ramp step");
  assert.equal(formatOklch({ l: 0.5, c: 0.2, h: 390 }), "oklch(50% 0.2 30)");

  const mono = templateGraph("mono");
  const before = brandHue(mono)!;
  assert.equal(before.hue, 275);
  const changes = rebrandChanges(mono, 150);
  assert.ok(changes.every((c) => /brand-\d+$/.test(c.path)), "only brand steps change");
  assert.ok(new Set(changes.map((c) => c.set)).size >= 2, "in both modes");
  const after = applyChanges(mono, changes);
  assert.equal(brandHue(after)!.hue, 150);
  const success = after.tokens.find((t) => /success-600$/.test(t.path) && t.set === "system.light")!;
  assert.equal(parseOklch(success.value)!.h, 150, "the success ramp keeps its own hue");
  assert.equal(mapRoles(after, contract).filter((r) => r.status === "fails").length, 0, "at hue 150 every pair still passes");
  // Honest about what it does: lightness is kept, so contrast is re-measured, not assumed. These hues all pass.
  for (const hue of [0, 30, 60, 200, 320]) assert.equal(mapRoles(applyChanges(mono, rebrandChanges(mono, hue)), contract).filter((r) => r.status === "fails").length, 0, `hue ${hue}`);
});

test("an edit changes one primitive and every alias that resolves through it, and reports what it breaks", () => {
  const g = templateGraph("mono");
  const [light] = g.modes;
  const byPath = index(g);
  const before = resolve(g, "color.action.primary.background", light, byPath);
  assert.equal(before.value, "oklch(48% 0.21 275)");
  assert.ok(before.chain.includes("mono.palette.brand-600"));
  const after = applyChanges(g, [{ path: "mono.palette.brand-600", set: "system.light", value: "#123456" }]);
  assert.equal(resolve(after, "color.action.primary.background", light).value, "#123456");
  assert.equal(resolve(after, "color.text.link", light).value, "#123456", "every alias through brand-600 moved");
  assert.equal(resolve(after, "color.action.primary.background", g.modes[1]).value, resolve(g, "color.action.primary.background", g.modes[1]).value, "the dark set is its own token, untouched");
  assert.equal(g.tokens.find((t) => t.path === "mono.palette.brand-600" && t.set === "system.light")!.value, "oklch(48% 0.21 275)", "the original graph is untouched");
  // A contrast reading moves with the edit: a pale primary fails on white.
  const pale = applyChanges(g, [{ path: "mono.palette.brand-600", set: "system.light", value: "#dddddd" }]);
  const rows = mapRoles(pale, contract);
  assert.equal(rows.find((r) => r.role === "color.text.link")!.status, "fails");
  // Pointing a token at something that isn't there is a broken alias, reported like an import's.
  const broken = applyChanges(g, [{ path: "mono.sys.text-link", set: "system.light", value: "{mono.palette.brand-650}" }]);
  assert.ok(broken.issues.some((i) => i.kind === "broken-alias" && i.path === "mono.sys.text-link"));
  assert.equal(after.issues.length, g.issues.length, "a good edit adds no issue");
});

test("css: exactly what build-themes.ts emits for the pack, shadcn names included, extras appended and rescoped", async () => {
  const spec = await loadContract();
  for (const name of ["mono", "sketch"] as const) {
    const manifestPath = new URL(`../../../packages/ds-${name}/manifest.json`, import.meta.url).pathname;
    const { manifest, modes } = await loadDesignSystem(manifestPath);
    const extras = await loadExtras(manifestPath, manifest);
    const expected = themeCss(manifest.name, modes, manifest.defaultMode, Object.keys(spec.tokens), manifest.layout, extras);
    const ours = exportDesignSystem("css", input(name, { extras })).body;
    // The first line names who generated it; everything after is the same file.
    const strip = (s: string) => s.split("\n").slice(1).join("\n");
    assert.equal(strip(ours), strip(expected), name);
    assert.ok(ours.includes("--primary: var(--pxd-color-action-primary-background);"));
  }
  // A design system named otherwise gets its own theme name, and the extras follow it.
  const renamed = exportDesignSystem("css", input("Acme Sketch", { graph: templateGraph("sketch"), extras: TEMPLATE_PACKS.sketch.manifest.extras ? readFileSync(new URL("../../../packages/ds-sketch/tokens/extras.css", import.meta.url), "utf8") : "" })).body;
  assert.ok(renamed.includes('[data-pxd-theme="acme-sketch"]:not([data-pxd-mode])'));
  assert.ok(!renamed.includes('[data-pxd-theme="sketch"]'), "no selector still names the pack");
  assert.equal(exportDesignSystem("css", input("mono")).fileName, "mono.css");
});

test("a draft carries a banner at the top of every format; a published version doesn't", () => {
  for (const format of ["css", "dtcg", "tailwind", "style-dictionary", "swift", "compose"] as const) {
    const live = exportDesignSystem(format, input("mono")).body;
    const draft = exportDesignSystem(format, input("mono", { status: "draft", version: 2 })).body;
    assert.ok(!live.includes("DRAFT"), `${format}: live has no banner`);
    const head = draft.split("\n").slice(0, 4).join("\n");
    assert.match(head, /DRAFT: v2 of mono is not published/, `${format}: the banner is at the top`);
    if (format === "dtcg" || format === "style-dictionary") assert.equal(Object.keys(JSON.parse(draft))[0], "$draft");
  }
});

test("dtcg: the pack as one bundle, whose manifest and files read back as the same design system", () => {
  const bundle = JSON.parse(exportDesignSystem("dtcg", input("mono")).body);
  assert.equal(bundle.manifest.name, "mono");
  assert.equal(bundle.manifest.contractVersion, contract.contractVersion);
  assert.deepEqual(bundle.manifest.modes.light, ["tokens/system.json", "tokens/system-light.json", "tokens/semantic.json"]);
  assert.equal(bundle.manifest.defaultMode, "light");
  const back = packGraph({ name: "mono", modes: bundle.manifest.modes, defaultMode: bundle.manifest.defaultMode, files: bundle.files });
  const a = resolveRoles(input("mono"));
  const b = resolveRoles(input("mono", { graph: back }));
  for (const m of a.modes) assert.deepEqual([...b.values.get(m.name)!.entries()], [...a.values.get(m.name)!.entries()], m.name);
  assert.equal(back.tokens.length, templateGraph("mono").tokens.length);
  // Types and descriptions survive.
  assert.equal(bundle.files["tokens/system-light.json"].mono.palette["brand-600"].$type, "color");
  assert.equal(bundle.files["tokens/system-light.json"].mono.sys["surface-default"].$description, "Main page background");
});

test("tailwind: a theme extension whose values are the CSS variables, annotated with what they resolve to", () => {
  const js = exportDesignSystem("tailwind", input("mono")).body;
  assert.ok(js.startsWith("/**"));
  assert.ok(js.includes("module.exports = {"));
  assert.match(js, /colors: \{\n\s+surface: \{\n\s+DEFAULT: "var\(--pxd-color-surface-default\)", \/\/ oklch\(99% 0\.006 275\)/);
  assert.match(js, /borderRadius: \{[\s\S]*DEFAULT: "var\(--pxd-radius-default\)", \/\/ \d+px/);
  assert.match(js, /spacing: \{[\s\S]*"inset-default": "var\(--pxd-space-inset-default\)", \/\/ 16px/);
  assert.match(js, /fontSize: \{[\s\S]*"body-default": \["var\(--pxd-type-body-default-size\)", \{/);
  assert.match(js, /transitionTimingFunction: \{[\s\S]*standard: "var\(--pxd-motion-easing-standard\)"/);
  assert.match(js, /boxShadow: \{[\s\S]*raised: "var\(--pxd-shadow-raised\)"/);
  // It is JavaScript: the object parses once the comments are gone.
  const obj = new Function(`const module = {}; ${js} return module.exports;`)();
  assert.equal(obj.theme.extend.colors.action.primary.background, "var(--pxd-color-action-primary-background)");
  assert.equal(Object.keys(obj.theme.extend.colors.status).length, 4);
});

test("style-dictionary: a v4 DTCG source with one tree per mode and every role typed", () => {
  const sd = JSON.parse(exportDesignSystem("style-dictionary", input("mono")).body);
  assert.deepEqual(Object.keys(sd).filter((k) => !k.startsWith("$")), ["light", "dark"]);
  assert.deepEqual(sd.light.color.surface.default, { $type: "color", $value: "oklch(99% 0.006 275)" });
  assert.equal(sd.dark.color.surface.default.$value, "oklch(17% 0.035 275)");
  assert.deepEqual(sd.light.radius.default, { $type: "dimension", $value: { value: 8, unit: "px" } });
  assert.equal(sd.light.type.body.default.$type, "typography");
  assert.equal(sd.light.type.body.default.$value.fontSize.value, 16, "aliases inside the composite are resolved");
  const count = (t: any): number => (t && typeof t === "object" && "$value" in t ? 1 : Object.values(t ?? {}).reduce((n: number, v) => n + count(v), 0));
  assert.equal(count(sd.light), ROLES.length);
});

test("swift: an enum per mode with Color and CGFloat values; compose: an object per mode with Color(0xFF…) and .dp", () => {
  const swift = exportDesignSystem("swift", input("mono")).body;
  assert.ok(swift.includes("import SwiftUI"));
  assert.ok(swift.includes("public enum MonoTokens {"));
  assert.ok(swift.includes("    public enum Light {") && swift.includes("    public enum Dark {"));
  assert.match(swift, /public static let colorActionPrimaryForeground: Color = Color\(red: 1\.000, green: 1\.000, blue: 1\.000\)  \/\/ #ffffff/);
  assert.match(swift, /public static let colorScrim: Color = Color\(red: [\d.]+, green: [\d.]+, blue: [\d.]+, opacity: 0\.500\)/);
  assert.match(swift, /public static let radiusDefault: CGFloat = 8/);
  assert.match(swift, /public static let motionDurationShort: TimeInterval = 0\.15/);
  assert.match(swift, /public static let motionEasingStandard: \[Double\] = \[[\d., ]+\]/);
  assert.match(swift, /public static let typeBodyDefault: Typography = Typography\(family: "[^"]+", size: 16, weight: 400, lineHeight: 1\.5, letterSpacing: 0\)/);
  assert.match(swift, /public static let shadowRaised: \[Shadow\] = \[Shadow\(x: 0, y: 1, blur: 3, spread: 0, color: Color\(/);
  assert.equal(exportDesignSystem("swift", input("mono")).fileName, "MonoTokens.swift");

  const kt = exportDesignSystem("compose", input("mono")).body;
  assert.ok(kt.includes("import androidx.compose.ui.graphics.Color"));
  assert.ok(kt.includes("object MonoTokens {") && kt.includes("    object Light {") && kt.includes("    object Dark {"));
  assert.match(kt, /val colorActionPrimaryForeground = Color\(0xFFFFFFFF\)  \/\/ #ffffff/);
  assert.match(kt, /val colorScrim = Color\(0x80[0-9A-F]{6}\)/);
  assert.match(kt, /val radiusDefault = 8\.dp/);
  assert.match(kt, /val motionDurationShort = 150/);
  assert.match(kt, /val motionEasingStandard = CubicBezierEasing\([\d.f, ]+\)/);
  assert.match(kt, /val typeBodyDefault = Typography\(family = "[^"]+", size = 16\.sp, weight = 400, lineHeight = 1\.5f, letterSpacing = 0\.sp\)/);
  assert.match(kt, /val shadowRaised = listOf\(Shadow\(x = 0\.dp, y = 1\.dp, blur = 3\.dp, spread = 0\.dp, color = Color\(0x/);
  assert.equal(exportDesignSystem("compose", input("mono")).fileName, "MonoTokens.kt");
});

test("exports of an imported design system: modes read as light and dark, unmapped roles are said, not invented", () => {
  const g = northwind();
  const rows = mapRoles(g, contract);
  const mapping = Object.fromEntries(rows.map((r) => [r.role, r.token]));
  const nw: ExportInput = { name: "Northwind", version: 3, status: "draft", graph: g, mapping, contract };
  assert.equal(modeId("Mode / Light"), "light");
  assert.equal(modeId("Mode / Dark"), "dark");
  const css = exportDesignSystem("css", nw).body;
  assert.ok(css.includes('[data-pxd-theme="northwind"]:not([data-pxd-mode]),\n[data-pxd-theme="northwind"][data-pxd-mode="light"] {'));
  assert.ok(css.includes('[data-pxd-theme="northwind"][data-pxd-mode="dark"] {'));
  assert.ok(css.includes("--pxd-color-surface-default: #FFFFFF;"));
  assert.ok(css.includes("  /* --pxd-color-scrim: unmapped in Studio */") || css.includes("unmapped in Studio"));
  assert.ok(css.includes("--pxd-radius-control: 8px;"));
  const r = resolveRoles(nw);
  assert.ok(r.unmapped.length > 0 && r.unmapped.length < ROLES.length);
  const swift = exportDesignSystem("swift", nw).body;
  assert.ok(swift.includes("// Unmapped in Studio, so absent here:"));
  assert.ok(swift.includes("public enum NorthwindTokens {"));
  const sd = JSON.parse(exportDesignSystem("style-dictionary", nw).body);
  assert.equal(sd.light.color.surface.default.$value, "#FFFFFF");
  assert.equal(sd.dark.color.surface.default.$value, "#101828");
  const dtcg = JSON.parse(exportDesignSystem("dtcg", nw).body);
  assert.deepEqual(Object.keys(dtcg.files).sort(), ["tokens/components.json", "tokens/primitives.json", "tokens/semantic-dark.json", "tokens/semantic.json"]);
});
