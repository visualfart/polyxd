/**
 * The shell rules, as packages/spec/test/shell.test.ts states them, run through Studio's own
 * checker; and an agreement test that puts every mutation through both validators and expects
 * the same shell issues, so the editor never says something the verifier wouldn't.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateDocument } from "@polyxd/spec/browser";
import { SHELL_COMPONENTS as SPEC_SHELL } from "../../../packages/spec/src/ui-schema.generated.ts";
import { checkDocument } from "../src/screens/validate.ts";
import { FRAME_REGIONS, SHELL_COMPONENTS, belongsInShell, pickableIn, refProps, type Doc } from "../src/screens/schema.ts";
import { buildTree } from "../src/screens/tree.ts";

const examples = new URL("../../../packages/spec/examples/", import.meta.url);
const load = (name: string): Doc => JSON.parse(readFileSync(new URL(name, examples), "utf8"));
const byId = (d: Doc, id: string) => d.components.find((c) => c.id === id)!;
/** The shell example, mutated, as issue lines with their codes. */
const shell = (fn: (d: Doc) => void = () => {}) => {
  const d = load("shell-product.json");
  fn(d);
  const r = checkDocument(d);
  return { valid: r.valid, issues: r.issues, text: r.issues.map((i) => `${i.severity} ${i.code ?? ""} ${i.at}: ${i.message}`).join("\n") };
};

test("the shell components are the ones the spec marks shell", () => {
  assert.deepEqual([...SHELL_COMPONENTS], ["AppBar", "Custom", "Footer", "Frame", "Outlet"]);
  assert.deepEqual([...SHELL_COMPONENTS], [...SPEC_SHELL].sort());
});

test("a shell document validates: kind shell, origin authored, a Frame at the root with one Outlet", () => {
  const r = shell();
  assert.equal(r.valid, true, r.text);
  assert.deepEqual(r.issues, []);
});

test("a surface containing a Frame fails: shell components belong in a shell document", () => {
  const r = shell((d) => (d.surface.kind = "surface"));
  assert.equal(r.valid, false);
  assert.match(r.text, /error shell:structure \/components\/0: Frame belongs in a shell document: set surface\.kind to "shell"/);
  for (const name of ["AppBar", "Outlet", "Custom", "Footer"]) assert.match(r.text, new RegExp(`${name} belongs in a shell document`));
  // The same when kind is left out: a document is a surface by default.
  assert.match(shell((d) => delete d.surface.kind).text, /Frame belongs in a shell document/);
  // The picker says the same thing before it happens.
  assert.equal(belongsInShell("Frame"), 'Frame belongs in a shell document: set surface.kind to "shell"');
});

test("a surface has no Outlet", () => {
  const d = load("tasks-add.json");
  d.components.push({ id: "out", component: "Outlet" });
  byId(d, "form").children.push("out");
  const r = checkDocument(d);
  assert.equal(r.valid, false);
  assert.match(r.issues.map((i) => i.message).join("\n"), /Outlet belongs in a shell document: set surface\.kind to "shell"/);
});

test("a generated shell fails: a shell is authored", () => {
  for (const origin of ["generated", undefined]) {
    const r = shell((d) => (origin ? (d.surface.origin = origin) : delete d.surface.origin));
    assert.equal(r.valid, false, r.text);
    assert.match(r.text, /error shell:structure \/surface\/origin: a shell is authored; set surface\.origin to "authored"/);
  }
});

test("a shell's root is a Frame", () => {
  const r = shell((d) => (d.root = "aside"));
  assert.match(r.text, /error shell:structure \/root: a shell's root is a Frame, not Group/);
});

test("a Custom without a fallback fails, and its fallback is never a shell component", () => {
  const missing = shell((d) => delete byId(d, "logo").fallback);
  assert.equal(missing.valid, false);
  assert.match(missing.text, /fallback/);
  const bar = shell((d) => {
    d.components.push({ id: "bar2", component: "AppBar", title: "Second bar" });
    byId(d, "logo").fallback = "bar2";
  });
  assert.equal(bar.valid, false);
  assert.match(bar.text, /Custom\.fallback must reference Text or Media or .*, not AppBar/);
});

test("two Outlets fail; none fails; an Outlet outside the Frame's main fails", () => {
  const two = shell((d) => {
    d.components.push({ id: "outlet-2", component: "Outlet" });
    byId(d, "aside").children.push("outlet-2");
  });
  assert.equal(two.valid, false);
  assert.match(two.text, /error shell:structure \/components\/\d+: a shell has exactly one Outlet; this is another/);

  const none = shell((d) => {
    d.components = d.components.filter((c) => c.id !== "outlet" && c.id !== "loading");
    byId(d, "frame").main = "aside";
    delete byId(d, "frame").aside;
  });
  assert.equal(none.valid, false);
  assert.match(none.text, /a shell has exactly one Outlet, reachable from the Frame's main; this one has none/);

  const misplaced = shell((d) => {
    byId(d, "frame").main = "aside";
    byId(d, "frame").aside = "outlet";
  });
  assert.equal(misplaced.valid, false);
  assert.match(misplaced.text, /the Outlet "outlet" is not reachable from the Frame's main "aside"/);
});

test("Frame regions hold what the spec says", () => {
  const r = shell((d) => (byId(d, "frame").banner = "bar-actions"));
  assert.match(r.text, /Frame\.banner must reference Status, not ActionBar/);
  const nav = shell((d) => (byId(d, "frame").navigation = "release"));
  assert.match(nav.text, /Frame\.navigation must reference Navigation, not Tag/);
  // The seven reference tables the shell brought: the editor's slots read the same lists.
  assert.deepEqual(FRAME_REGIONS.map((r) => r.prop), ["banner", "header", "navigation", "main", "aside", "footer"]);
  assert.deepEqual(refProps("Frame").map((r) => r.prop).sort(), [...FRAME_REGIONS.map((r) => r.prop)].sort());
});

test("Navigation.placement outside a Frame is a warning, inside one it is not", () => {
  const d = load("crm-accounts-list.json");
  byId(d, "nav").placement = "rail";
  const r = checkDocument(d);
  assert.equal(r.valid, true);
  const w = r.issues.find((i) => i.code === "shell:structure");
  assert.ok(w, "expected a placement warning");
  assert.equal(w!.severity, "warning");
  assert.match(w!.message, /Navigation\.placement only applies to a Frame's navigation/);
  assert.deepEqual(shell((d) => (byId(d, "nav").placement = "rail")).issues, []);
});

test("the picker refuses shell components in a surface and offers them in a shell", () => {
  const surface = load("tasks-add.json");
  const all = ["Group", "Frame", "AppBar", "Outlet", "Custom", "Footer", "Text"];
  assert.deepEqual(pickableIn(surface, all), ["Group", "Text"]);
  assert.deepEqual(pickableIn(load("shell-product.json"), all), all);
});

test("the tree shows a Frame's regions as slots, in reading order", () => {
  const tree = buildTree(load("shell-product.json"));
  assert.equal(tree.root!.node.component, "Frame");
  assert.deepEqual(tree.root!.children.map((c) => c.slot?.prop), ["banner", "header", "navigation", "main", "aside", "footer"]);
  assert.deepEqual(tree.others, []);
});

test("Studio's checker agrees with the spec's on every shell mutation", () => {
  const mutations: [string, (d: Doc) => void][] = [
    ["as is", () => {}],
    ["kind surface", (d) => (d.surface.kind = "surface")],
    ["no kind", (d) => delete d.surface.kind],
    ["origin generated", (d) => (d.surface.origin = "generated")],
    ["no origin", (d) => delete d.surface.origin],
    ["root not a Frame", (d) => (d.root = "aside")],
    ["fallback is an AppBar", (d) => { d.components.push({ id: "bar2", component: "AppBar", title: "Second bar" }); byId(d, "logo").fallback = "bar2"; }],
    ["two outlets", (d) => { d.components.push({ id: "outlet-2", component: "Outlet" }); byId(d, "aside").children.push("outlet-2"); }],
    ["no outlet", (d) => { d.components = d.components.filter((c) => c.id !== "outlet" && c.id !== "loading"); byId(d, "frame").main = "aside"; delete byId(d, "frame").aside; }],
    ["outlet in the aside", (d) => { byId(d, "frame").main = "aside"; byId(d, "frame").aside = "outlet"; }],
    ["banner is an ActionBar", (d) => (byId(d, "frame").banner = "bar-actions")],
    ["placement on the frame's nav", (d) => (byId(d, "nav").placement = "rail")],
    ["placement on a stray nav", (d) => { d.components.push({ id: "nav2", component: "Navigation", label: "Other", kind: "main", placement: "bar", items: [{ key: "a", label: "A", action: { event: { name: "nav.go" } } }] }); }],
  ];
  const lines = (issues: { severity: string; code?: string; at: string; message: string }[]) =>
    issues.filter((i) => i.code === "shell:structure" || /must reference/.test(i.message)).map((i) => `${i.severity} ${i.code ?? ""} ${i.at}: ${i.message}`).sort();
  for (const [name, fn] of mutations) {
    const ours = load("shell-product.json");
    fn(ours);
    const theirs = structuredClone(ours);
    const a = checkDocument(ours);
    const b = validateDocument(theirs);
    assert.equal(a.valid, b.valid, `${name}: valid`);
    assert.deepEqual(lines(a.issues), lines(b.issues), `${name}: shell issues`);
  }
});
