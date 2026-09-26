import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { read, resolve } from "../src/import/read.ts";
import { scan } from "../src/import/scan.ts";
import { candidatesFor, mapRoles, type Contract } from "../src/import/map.ts";

const fixture = readFileSync(new URL("./fixtures/northwind.tokens.json", import.meta.url), "utf8");
const contract = JSON.parse(readFileSync(new URL("../../../packages/spec/tokens/semantic-contract.json", import.meta.url), "utf8")) as Contract;

test("reads a Tokens Studio file into tiers, modes and issues", () => {
  const g = read(fixture, "northwind.tokens.json");
  assert.equal(g.format, "tokens-studio");
  assert.deepEqual(g.sets, ["primitives", "semantic", "semantic-dark", "components"]);
  assert.deepEqual(g.modes.map((m) => m.name), ["Mode / Light", "Mode / Dark"]);
  const s = scan(g);
  assert.equal(s.byTier.primitive, 16);
  assert.equal(s.byTier.component, 2);
  assert.ok(s.byTier.semantic >= 12);
  const kinds = Object.fromEntries(s.issues.map((i) => [i.kind, i.count]));
  assert.equal(kinds["broken-alias"], 1, "action.primary-hover points at brand/650, which doesn't exist");
  assert.equal(kinds["circular-alias"], 2);
  assert.equal(kinds["deprecated"], 1);
  assert.equal(s.byType[0].type, "color");
});

test("a dark mode's own value wins over the base it draws from", () => {
  const g = read(fixture);
  const [light, dark] = g.modes;
  assert.equal(resolve(g, "bg.default", light).value, "#FFFFFF");
  assert.equal(resolve(g, "bg.default", dark).value, "#101828");
  assert.deepEqual(resolve(g, "bg.default", dark).chain, ["bg.default", "color.gray.900"]);
});

test("roles are mapped from the semantic tier, with alias chains and contrast in every mode", () => {
  const g = read(fixture);
  const rows = mapRoles(g, contract);
  const byRole = Object.fromEntries(rows.map((r) => [r.role, r]));
  assert.equal(byRole["color.surface.default"].token, "bg.default");
  assert.deepEqual(byRole["color.surface.default"].values, { "Mode / Light": "#FFFFFF", "Mode / Dark": "#101828" });
  assert.equal(byRole["color.text.default"].status, "exact");
  assert.deepEqual(byRole["color.text.default"].chain, ["text.default", "color.gray.900"]);
  const muted = byRole["color.text.muted"];
  assert.equal(muted.token, "text.muted");
  assert.equal(muted.status, "fails", "gray/400 on white is 2.6:1");
  assert.ok(muted.contrast.some((c) => c.mode === "Mode / Light" && !c.passes && c.ratio < 3));
  assert.equal(byRole["color.border.focus"].token, "border.focus");
  assert.equal(byRole["radius.control"].token, "radius.control");
  assert.ok(rows.some((r) => r.status === "missing"));
});

test("a person's decision beats the guess; one primitive for both modes is caught by the dark one", () => {
  const g = read(fixture);
  const rows = mapRoles(g, contract, [{ role: "color.text.muted", token: "color.gray.500" }]);
  const muted = rows.find((r) => r.role === "color.text.muted")!;
  assert.equal(muted.how, "manual");
  assert.ok(muted.contrast.every((c) => c.mode !== "Mode / Light" || c.passes), "gray/500 passes on every light surface");
  assert.equal(muted.status, "fails", "and fails on the dark surfaces, because a primitive can't change with the mode");
  assert.ok(muted.contrast.some((c) => c.mode === "Mode / Dark" && !c.passes));
  const cands = candidatesFor(g, contract, mapRoles(g, contract), "color.text.muted", "gray");
  assert.ok(cands.length >= 2);
  assert.ok(cands.every((c) => /^#/.test(c.value ?? "")), "only colours for a colour role");
});

test("reads plain CSS custom properties with a dark block", () => {
  const g = read(":root{--bg:#fff;--text:#111;--brand:#1849a9;--btn-bg:var(--brand)} .dark{--bg:#000;--text:#eee}", "tokens.css");
  assert.equal(g.format, "css");
  assert.deepEqual(g.modes.map((m) => m.name), ["light", "dark"]);
  assert.equal(resolve(g, "btn.bg", g.modes[0]).value, "#1849a9");
  assert.equal(resolve(g, "bg", g.modes[1]).value, "#000");
});
