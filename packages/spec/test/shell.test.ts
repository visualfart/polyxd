import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateDocument } from "../src/validate.ts";
import { readingOrder } from "../src/checks.ts";
import { flattenTree, toTree } from "../src/tree.ts";
import { SHELL_COMPONENTS } from "../src/ui-schema.generated.ts";

const examplesDir = new URL("../examples/", import.meta.url);
const load = (name: string) => JSON.parse(readFileSync(new URL(name, examplesDir), "utf8"));
const byId = (d: any, id: string) => d.components.find((c: any) => c.id === id);
/** The shell example, mutated, as issue lines with their codes. */
const shell = (fn: (d: any) => void = () => {}) => {
  const d = load("shell-product.json");
  fn(d);
  const r = validateDocument(d);
  return { valid: r.valid, issues: r.issues, text: r.issues.map((i) => `${i.severity} ${i.code ?? ""} ${i.at}: ${i.message}`).join("\n") };
};

test("the shell components are the ones marked shell in components/*.json", () => {
  assert.deepEqual([...SHELL_COMPONENTS].sort(), ["AppBar", "Custom", "Footer", "Frame", "Outlet"]);
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
});

test("a surface has no Outlet", () => {
  const d = load("tasks-add.json");
  d.components.push({ id: "out", component: "Outlet" });
  byId(d, "form").children.push("out");
  const r = validateDocument(d);
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
    d.components = d.components.filter((c: any) => c.id !== "outlet" && c.id !== "loading");
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
});

test("Navigation.placement outside a Frame is a warning, inside one it is not", () => {
  const d = load("crm-accounts-list.json");
  byId(d, "nav").placement = "rail";
  const r = validateDocument(d);
  assert.equal(r.valid, true);
  const w = r.issues.find((i) => i.code === "shell:structure");
  assert.ok(w, "expected a placement warning");
  assert.equal(w!.severity, "warning");
  assert.match(w!.message, /Navigation\.placement only applies to a Frame's navigation/);
  assert.deepEqual(shell((d) => (byId(d, "nav").placement = "rail")).issues, []);
});

test("reading order walks a Frame's regions as banner, header, navigation, main, aside, footer", () => {
  const order = readingOrder(load("shell-product.json")).map((c) => c.id);
  const first = (ids: string[]) => ids.map((id) => order.indexOf(id));
  const [banner, header, nav, main, aside, footer] = first(["banner", "bar", "nav", "outlet", "aside", "footer"]);
  assert.ok(banner < header && header < nav && nav < main && main < aside && aside < footer, order.join(" "));
  // Inside the bar: leading, search, actions, account. The Custom's fallback follows it; the Footer's aside follows the Footer.
  const [search, actions, account] = first(["search", "bar-actions", "me"]);
  assert.ok(header < search && search < actions && actions < account, order.join(" "));
  assert.equal(order.indexOf("logo-image"), order.indexOf("logo") + 1);
  assert.equal(order.indexOf("release"), order.indexOf("footer") + 1);
  assert.equal(order.length, load("shell-product.json").components.length);
});

test("a shell round-trips through the tree form with its navigation inside the Frame", () => {
  const flat = load("shell-product.json");
  const tree = toTree(flat);
  assert.equal(tree.navigation, undefined);
  assert.equal(tree.root.component, "Frame");
  assert.equal(tree.root.navigation.component, "Navigation");
  assert.equal(tree.root.main.component, "Outlet");
  assert.equal(tree.root.aside.children[0].fallback.component, "Media");
  const back = flattenTree(tree);
  assert.equal(back.components.length, flat.components.length);
  assert.deepEqual(validateDocument(back).issues, []);
});
