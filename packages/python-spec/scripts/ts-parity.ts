/**
 * What the TypeScript validator says about every example and fixture, for the Python parity test.
 *
 *   node packages/python-spec/scripts/ts-parity.ts           write tests/fixtures/parity.json
 *   node packages/python-spec/scripts/ts-parity.ts --stdout  print it instead
 *
 * Each case is an example from packages/spec/examples, changed by a few JSON Patch operations
 * (or a small document written out in full), with the issues validateDocument reports for it.
 * The cases are the ones packages/spec/test runs, plus a sweep of common mistakes over every
 * example. tests/test_parity.py applies the same patches in Python and expects the same verdict,
 * the same paths and the same messages. Run this after changing the TypeScript validator.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { validateDocument } from "../../spec/src/validate.ts";
import { REFERENCE_TYPES } from "../../spec/src/references.ts";
import { SHELL_COMPONENTS } from "../../spec/src/ui-schema.generated.ts";
import { SPEC_VERSION } from "../../spec/src/version.ts";

const SPEC = new URL("../../spec/", import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, SPEC), "utf8"));
const load = (name: string) => read(`examples/${name}.json`);
const examples = readdirSync(new URL("examples/", SPEC))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();
const directions = readdirSync(new URL("examples/directions/", SPEC))
  .filter((f) => f.endsWith(".json"))
  .map((f) => `directions/${f.replace(/\.json$/, "")}`)
  .sort();

type Op = { op: "add" | "remove" | "replace"; path: string; value?: unknown };
type Options = { emphasisBudget?: number; missingData?: "warning" | "error" };
interface Case {
  name: string;
  kind: "document" | "direction";
  example?: string;
  ops?: Op[];
  doc?: unknown;
  options?: Options;
}

// JSON Patch (RFC 6902): add, remove, replace. tests/test_parity.py applies them the same way.
const unescape = (s: string) => s.replace(/~1/g, "/").replace(/~0/g, "~");
function applyOps(doc: any, ops: Op[]) {
  for (const { op, path, value } of ops) {
    const parts = path.slice(1).split("/").map(unescape);
    const last = parts.pop()!;
    const parent = parts.reduce((o, p) => o[Array.isArray(o) ? Number(p) : p], doc);
    const clone = structuredClone(value);
    if (Array.isArray(parent)) {
      const i = last === "-" ? parent.length : Number(last);
      if (op === "add") parent.splice(i, 0, clone);
      else if (op === "remove") parent.splice(i, 1);
      else parent[i] = clone;
    } else if (op === "remove") delete parent[last];
    else parent[last] = clone;
  }
  return doc;
}

const at = (example: string, id: string) => {
  const i = load(example).components.findIndex((c: any) => c.id === id);
  if (i < 0) throw new Error(`${example} has no component "${id}"`);
  return `/components/${i}`;
};
const comp = (example: string, id: string) => load(example).components.find((c: any) => c.id === id);

const cases: Case[] = [];
const doc = (name: string, example: string, ops: Op[] = [], options?: Options) => cases.push({ name, kind: "document", example, ops, ...(options ? { options } : {}) });

// 1. Every example as it is.
for (const e of examples) doc(`example ${e}`, e);

// 2. The cases in packages/spec/test/validate.test.ts and shell.test.ts.
doc("unknown component type", "tasks-add", [{ op: "replace", path: `${at("tasks-add", "notes")}/component`, value: "Textarea" }]);
doc("unknown property", "tasks-add", [{ op: "add", path: `${at("tasks-add", "title")}/color`, value: "#ff0000" }]);
doc("missing required label", "tasks-add", [{ op: "remove", path: `${at("tasks-add", "title")}/label` }]);
doc("dangling child reference", "tasks-add", [{ op: "add", path: `${at("tasks-add", "form")}/children/-`, value: "ghost" }]);
doc("duplicate id", "tasks-add", [{ op: "add", path: "/components/-", value: comp("tasks-add", "title") }]);
doc("root missing", "tasks-add", [{ op: "replace", path: "/root", value: "nope" }]);
doc("two primary actions at once", "tasks-list", [{ op: "add", path: `${at("tasks-list", "plan")}/emphasis`, value: "primary" }]);
doc("primary action next to a form submit", "tasks-add", [
  { op: "add", path: "/components/-", value: { id: "extra", component: "Action", label: "Save draft", emphasis: "primary", action: { event: { name: "task.draft" } } } },
  { op: "add", path: `${at("tasks-add", "form")}/children/-`, value: "extra" },
]);
doc("relative path outside a repeated item", "tasks-add", [{ op: "replace", path: `${at("tasks-add", "title")}/value`, value: { path: "draft/title" } }]);
doc("wrong reference type", "error-load-failed", [
  { op: "add", path: "/components/-", value: { id: "txt", component: "Text", text: "hi" } },
  { op: "add", path: `${at("error-load-failed", "root")}/action`, value: "txt" },
]);
doc("non-action in ActionBar", "personal-reading-log", [
  { op: "add", path: "/components/-", value: { id: "t", component: "Text", text: "x" } },
  { op: "add", path: `${at("personal-reading-log", "bar")}/children/-`, value: "t" },
]);
doc("cycle", "tasks-list", [{ op: "add", path: `${at("tasks-list", "list")}/empty`, value: "root" }]);
doc("pure cycle back to root", "personal-reading-log", [{ op: "add", path: `${at("personal-reading-log", "bar")}/children/-`, value: "root" }]);
doc("component used in two places", "travel-booking-review", [{ op: "add", path: `${at("travel-booking-review", "form")}/children/-`, value: "guest-details" }]);
doc("unknown renderer action", "settings-delete-account", [{ op: "replace", path: `${at("settings-delete-account", "confirm")}/cancel/action/event/name`, value: "ui.close" }]);
doc("invalid capability name", "tasks-add", [{ op: "replace", path: `${at("tasks-add", "form")}/submit/action/event/name`, value: "Save Task" }]);
doc("hard-coded metric value", "money-budget-settings", [{ op: "replace", path: `${at("money-budget-settings", "used")}/value`, value: 212.5 }]);
doc("image without alt text", "shop-order-status", [{ op: "remove", path: `${at("shop-order-status", "item-img")}/alt` }]);
doc("URL instead of host-provided image", "shop-order-status", [{ op: "replace", path: `${at("shop-order-status", "item-img")}/src`, value: "https://example.com/x.png" }]);
doc("path missing from data", "tasks-add", [
  { op: "add", path: "/components/-", value: { id: "note", component: "Text", text: { path: "/draft/nope" } } },
  { op: "add", path: `${at("tasks-add", "form")}/children/0`, value: "note" },
]);
doc("an input's own value needn't exist in data yet", "tasks-add", [{ op: "replace", path: `${at("tasks-add", "title")}/value`, value: { path: "/draft/nope" } }]);
doc("unreachable component", "tasks-add", [{ op: "add", path: "/components/-", value: { id: "orphan", component: "Text", text: "x" } }]);
{
  const views = at("travel-trip-overview", "views");
  doc("one primary per view panel", "travel-trip-overview", [
    { op: "add", path: "/components/-", value: { id: "a1", component: "Action", label: "Add day", emphasis: "primary", action: { event: { name: "trip.addDay" } } } },
    { op: "add", path: "/components/-", value: { id: "a2", component: "Action", label: "Add booking", emphasis: "primary", action: { event: { name: "trip.addBooking" } } } },
    { op: "add", path: "/components/-", value: { id: "g1", component: "Group", children: ["itinerary", "a1"] } },
    { op: "add", path: "/components/-", value: { id: "g2", component: "Group", children: ["bookings", "a2"] } },
    { op: "replace", path: `${views}/views/0/content`, value: "g1" },
    { op: "replace", path: `${views}/views/1/content`, value: "g2" },
  ]);
}
const flights = (card: Record<string, unknown>, text?: Record<string, unknown>) => ({
  specVersion: "0.2.0",
  surface: { id: "flights", title: "Flights", intent: "travel.search" },
  root: "list",
  data: { route: "LHR → LIS", order: { status: "Shipped" }, flights: [{ airline: "TAP", depart: "07:10" }, { airline: "BA", depart: "08:40" }] },
  components: [
    { id: "list", component: "Collection", label: "Flights", items: { path: "/flights", componentId: "card" } },
    { id: "card", component: "Card", ...card, children: ["line"] },
    { id: "line", component: "Text", text: "Morning", ...text },
  ],
});
cases.push(
  { name: "missingData error", kind: "document", doc: flights({ title: { path: "airline" } }, { text: { path: "/nowhere" } }), options: { missingData: "error" } },
  { name: "item field no item has", kind: "document", doc: flights({ title: { path: "airline" } }, { text: { path: "departs" } }) },
  { name: "item field every item has", kind: "document", doc: flights({ title: { path: "airline" } }, { text: { path: "depart" } }) },
  { name: "absolute path meant the item's field", kind: "document", doc: flights({ title: { path: "/airline" } }) },
  { name: "misplaced absolute path", kind: "document", doc: flights({ title: { path: "airline" } }, { text: { path: "/status" } }) },
  {
    name: "a table's columns read from its rows",
    kind: "document",
    doc: {
      specVersion: "0.2.0",
      surface: { id: "accounts", title: "Accounts", intent: "accounts.list" },
      root: "t",
      data: { rows: [{ name: "Acme", mrr: 1200 }] },
      components: [{ id: "t", component: "Table", caption: "Accounts", rows: { path: "/rows" }, columns: [{ key: "name", label: "Name", path: "name" }, { key: "plan", label: "Plan", path: "plan" }] }],
    },
  },
);
const twoPrimaries = {
  specVersion: "0.2.0",
  surface: { id: "s", title: "Dashboard" },
  root: "bar",
  components: [
    { id: "bar", component: "ActionBar", children: ["a", "b"] },
    { id: "a", component: "Action", label: "Add a task", emphasis: "primary", action: { event: { name: "task.create" } } },
    { id: "b", component: "Action", label: "Start a project", emphasis: "primary", action: { event: { name: "project.create" } } },
  ],
};
cases.push(
  { name: "two primaries, default budget", kind: "document", doc: twoPrimaries },
  { name: "two primaries, emphasisBudget 2", kind: "document", doc: twoPrimaries, options: { emphasisBudget: 2 } },
  { name: "three primaries, emphasisBudget 2", kind: "document", doc: applyOps(structuredClone(twoPrimaries), [
    { op: "add", path: "/components/-", value: { id: "c", component: "Action", label: "Invite", emphasis: "primary", action: { event: { name: "team.invite" } } } },
    { op: "add", path: "/components/0/children/-", value: "c" },
  ]), options: { emphasisBudget: 2 } },
);

const S = "shell-product";
doc("shell: a surface containing a Frame", S, [{ op: "replace", path: "/surface/kind", value: "surface" }]);
doc("shell: kind left out", S, [{ op: "remove", path: "/surface/kind" }]);
doc("shell: a surface has no Outlet", "tasks-add", [
  { op: "add", path: "/components/-", value: { id: "out", component: "Outlet" } },
  { op: "add", path: `${at("tasks-add", "form")}/children/-`, value: "out" },
]);
doc("shell: generated", S, [{ op: "replace", path: "/surface/origin", value: "generated" }]);
doc("shell: origin left out", S, [{ op: "remove", path: "/surface/origin" }]);
doc("shell: root is not a Frame", S, [{ op: "replace", path: "/root", value: "aside" }]);
doc("shell: Custom without a fallback", S, [{ op: "remove", path: `${at(S, "logo")}/fallback` }]);
doc("shell: Custom fallback is a shell component", S, [
  { op: "add", path: "/components/-", value: { id: "bar2", component: "AppBar", title: "Second bar" } },
  { op: "replace", path: `${at(S, "logo")}/fallback`, value: "bar2" },
]);
doc("shell: two Outlets", S, [
  { op: "add", path: "/components/-", value: { id: "outlet-2", component: "Outlet" } },
  { op: "add", path: `${at(S, "aside")}/children/-`, value: "outlet-2" },
]);
{
  const shell = load(S);
  const drop = shell.components.map((c: any, i: number) => (c.id === "outlet" || c.id === "loading" ? i : -1)).filter((i: number) => i >= 0).reverse();
  const frame = at(S, "frame");
  // Remove from the end first so the earlier indices hold; then point at the frame by its new index.
  const frameIndex = Number(frame.split("/").pop()) - drop.filter((i: number) => i < Number(frame.split("/").pop())).length;
  doc("shell: no Outlet", S, [
    ...drop.map((i: number) => ({ op: "remove" as const, path: `/components/${i}` })),
    { op: "replace", path: `/components/${frameIndex}/main`, value: "aside" },
    { op: "remove", path: `/components/${frameIndex}/aside` },
  ]);
}
doc("shell: Outlet outside the Frame's main", S, [
  { op: "replace", path: `${at(S, "frame")}/main`, value: "aside" },
  { op: "replace", path: `${at(S, "frame")}/aside`, value: "outlet" },
]);
doc("shell: Frame.banner holds a Status", S, [{ op: "replace", path: `${at(S, "frame")}/banner`, value: "bar-actions" }]);
doc("shell: Frame.navigation holds a Navigation", S, [{ op: "replace", path: `${at(S, "frame")}/navigation`, value: "release" }]);
doc("Navigation.placement outside a Frame", "crm-accounts-list", [{ op: "add", path: `${at("crm-accounts-list", "nav")}/placement`, value: "rail" }]);
doc("Navigation.placement inside a Frame", S, [{ op: "add", path: `${at(S, "nav")}/placement`, value: "rail" }]);

// 3. A sweep of common mistakes over every example.
for (const e of examples) {
  const d = load(e);
  const n = d.components.length;
  const last = `/components/${n - 1}`;
  if ("data" in d) {
    doc(`${e}: without data`, e, [{ op: "remove", path: "/data" }]);
    doc(`${e}: empty data, missing data as errors`, e, [{ op: "replace", path: "/data", value: {} }], { missingData: "error" });
  }
  doc(`${e}: unknown component type`, e, [{ op: "replace", path: `${last}/component`, value: "Nope" }]);
  doc(`${e}: component type left out`, e, [{ op: "remove", path: `${last}/component` }]);
  doc(`${e}: unknown props`, e, [{ op: "add", path: "/components/0/colour", value: "red" }, { op: "add", path: "/surface/theme", value: "dark" }]);
  doc(`${e}: no surface`, e, [{ op: "remove", path: "/surface" }]);
  doc(`${e}: bad spec version`, e, [{ op: "replace", path: "/specVersion", value: "1.0" }]);
  doc(`${e}: root not a component`, e, [{ op: "replace", path: "/root", value: "nowhere" }]);
  doc(`${e}: duplicate id`, e, [{ op: "replace", path: `${last}/id`, value: d.components[0].id }]);
  doc(`${e}: bad id`, e, [{ op: "replace", path: `${last}/id`, value: "9 lives" }]);
  doc(`${e}: components not a list`, e, [{ op: "replace", path: "/components", value: {} }]);
  doc(`${e}: a component that is a string`, e, [{ op: "replace", path: last, value: "Text" }]);
  const actions = d.components.map((c: any, i: number) => (c.component === "Action" ? i : -1)).filter((i: number) => i >= 0);
  if (actions.length) doc(`${e}: every action primary`, e, actions.map((i: number) => ({ op: "add" as const, path: `/components/${i}/emphasis`, value: "primary" })));
  if (actions.length > 1) doc(`${e}: every action primary, budget 3`, e, actions.map((i: number) => ({ op: "add" as const, path: `/components/${i}/emphasis`, value: "primary" })), { emphasisBudget: 3 });
  // Each component with its required props taken away, one component at a time (the first six).
  d.components.slice(0, 6).forEach((c: any, i: number) => {
    const def = read(`components/${c.component}.json`);
    const required = (def.required ?? []).filter((p: string) => p in c);
    if (required.length) doc(`${e}: ${c.id} without ${required.join(", ")}`, e, required.map((p: string) => ({ op: "remove" as const, path: `/components/${i}/${p}` })));
  });
  // Every binding's path made absolute where it was relative, and relative where it was absolute.
  const flips: Op[] = [];
  const flip = (v: any, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => flip(x, `${path}/${i}`));
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        const p = `${path}/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`;
        if (k === "path" && typeof x === "string" && Object.keys(v).length === 1) flips.push({ op: "replace", path: p, value: x.startsWith("/") ? x.slice(1) : `/${x}` });
        else flip(x, p);
      }
    }
  };
  flip(d.components, "/components");
  if (flips.length) doc(`${e}: bindings flipped between absolute and relative`, e, flips);
  // Values of the wrong type and shape: a number for a label (a oneOf of text or binding), an
  // emphasis outside its enum, too many breadcrumbs, a binding with an extra key.
  const labelled = d.components.findIndex((c: any) => "label" in c);
  const wrong: Op[] = [
    { op: "add", path: "/surface/breadcrumbs", value: ["a", "b", "c", "d", "e"].map((label) => ({ label })) },
    { op: "replace", path: "/surface/title", value: null },
  ];
  if (labelled >= 0) wrong.push({ op: "replace", path: `/components/${labelled}/label`, value: 42 });
  if (actions.length) wrong.push({ op: "add", path: `/components/${actions[0]}/emphasis`, value: "loud" });
  doc(`${e}: values of the wrong type`, e, wrong);
  if (labelled >= 0) doc(`${e}: a binding with an extra key`, e, [{ op: "replace", path: `/components/${labelled}/label`, value: { path: "/x", format: "upper" } }]);
  // Every list binding pointed at an object in data.
  const listProps: Record<string, string> = { Collection: "items", Table: "rows", Comparison: "items", Chart: "data", Choice: "options", Tree: "items", Text: "items", Media: "items" };
  const toObject: Op[] = [];
  for (const c of d.components) {
    const p = c[listProps[c.component]]?.path;
    if (typeof p !== "string" || !p.startsWith("/") || !d.data) continue;
    const exists = p.slice(1).split("/").map(unescape).reduce((o: any, k: string) => (o && typeof o === "object" && k in o ? o[k] : undefined), d.data);
    if (exists !== undefined && !toObject.some((o) => o.path === `/data${p}`)) toObject.push({ op: "replace", path: `/data${p}`, value: { count: 3 } });
  }
  if (toObject.length) doc(`${e}: list bindings pointed at objects`, e, toObject);
}
doc("a component that references itself", "personal-reading-log", [{ op: "add", path: `${at("personal-reading-log", "bar")}/children/-`, value: "bar" }]);
doc("a placeholder outside a search field", "tasks-add", [{ op: "add", path: `${at("tasks-add", "title")}/placeholder`, value: "Buy milk" }]);
doc("a search field's placeholder", "tasks-add", [{ op: "add", path: `${at("tasks-add", "title")}/placeholder`, value: "Buy milk" }, { op: "add", path: `${at("tasks-add", "title")}/kind`, value: "search" }]);
doc("a decorative image needs no alt", "shop-order-status", [{ op: "remove", path: `${at("shop-order-status", "item-img")}/alt` }, { op: "add", path: `${at("shop-order-status", "item-img")}/decorative`, value: true }]);
doc("a list binding pointed at null", "tasks-list", [{ op: "replace", path: `/data${comp("tasks-list", "list").items.path}`, value: null }]);
doc("a list binding pointed at a string", "tasks-list", [{ op: "replace", path: `/data${comp("tasks-list", "list").items.path}`, value: "none" }]);

// 4. Design Directions.
const dir = (name: string, example: string, ops: Op[] = []) => cases.push({ name, kind: "direction", example, ops });
for (const e of directions) {
  dir(`direction ${e}`, e);
  dir(`${e}: without name and profile`, e, [{ op: "remove", path: "/name" }, { op: "remove", path: "/profile" }]);
  dir(`${e}: unknown property`, e, [{ op: "add", path: "/mood", value: "sunny" }]);
  dir(`${e}: version not a string`, e, [{ op: "replace", path: "/version", value: 2 }]);
  dir(`${e}: a rule with an unknown check`, e, [{ op: "add", path: "/rules", value: [{ id: "r", description: "x", severity: "error", rule: { check: "nope" } }] }]);
  dir(`${e}: a rule with no check`, e, [{ op: "add", path: "/rules", value: [{ id: "r", description: "x", severity: "error", rule: {} }] }]);
}

// Run the TypeScript validators.
const ajv = new Ajv2020({ strict: false, discriminator: true, allErrors: true });
ajv.addSchema(read("schema/check.schema.json"));
const validateDirection = ajv.compile(read("schema/direction.schema.json"));

const out = cases.map((c) => {
  const input = c.doc !== undefined ? structuredClone(c.doc) : applyOps(load(c.example!), c.ops ?? []);
  if (c.kind === "direction") {
    const valid = validateDirection(input) as boolean;
    const issues = (validateDirection.errors ?? []).map((e) => ({ severity: "error", at: e.instancePath || "/", message: e.message ?? e.keyword }));
    return { ...c, expected: { valid, issues } };
  }
  const r = validateDocument(input, c.options ?? {});
  return { ...c, expected: { valid: r.valid, issues: r.issues.map((i) => ({ severity: i.severity, at: i.at, message: i.message, ...(i.code ? { code: i.code } : {}) })) } };
});

const head = {
  about: "Generated by packages/python-spec/scripts/ts-parity.ts from the TypeScript validator. Do not edit.",
  specVersion: SPEC_VERSION,
  referenceTypes: REFERENCE_TYPES,
  shellComponents: SHELL_COMPONENTS,
};
// One case per line, so a change in the TypeScript validator shows up as a readable diff.
const text = `{\n${Object.entries(head).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n")}\n  "cases": [\n${out.map((c) => `    ${JSON.stringify(c)}`).join(",\n")}\n  ]\n}\n`;
if (process.argv.includes("--stdout")) process.stdout.write(text);
else {
  writeFileSync(new URL("../tests/fixtures/parity.json", import.meta.url), text);
  const invalid = out.filter((c) => !c.expected.valid).length;
  console.log(`wrote tests/fixtures/parity.json: ${out.length} cases (${invalid} invalid, ${out.length - invalid} valid)`);
}
