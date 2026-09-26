import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { validateDocument } from "../src/validate.ts";
import { buildOutputs } from "../scripts/build-schema.ts";

const examplesDir = new URL("../examples/", import.meta.url);
const load = (name: string) => JSON.parse(readFileSync(new URL(name, examplesDir), "utf8"));

test("generated schema and catalog are up to date (run npm run build:schema)", async () => {
  for (const [path, content] of Object.entries(await buildOutputs())) {
    assert.equal(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), content, `${path} is stale`);
  }
});

for (const file of readdirSync(examplesDir).filter((f) => f.endsWith(".json"))) {
  test(`example ${file} is valid with no warnings`, () => {
    const r = validateDocument(load(file));
    assert.deepEqual(r.issues, []);
  });
}

/** Takes a valid example, applies a mutation, and returns the issue messages. */
const mutate = (file: string, fn: (d: any) => void) => {
  const d = load(file);
  fn(d);
  const r = validateDocument(d);
  return { valid: r.valid, text: r.issues.map((i) => `${i.severity} ${i.at}: ${i.message}`).join("\n") };
};
const byId = (d: any, id: string) => d.components.find((c: any) => c.id === id);

const cases: [string, string, (d: any) => void, RegExp][] = [
  ["unknown component type", "tasks-add.json", (d) => (byId(d, "notes").component = "Textarea"), /unknown or missing component type|unknown component/],
  ["unknown property", "tasks-add.json", (d) => (byId(d, "title").color = "#ff0000"), /unknown property "color"/],
  ["missing required label", "tasks-add.json", (d) => delete byId(d, "title").label, /label/],
  ["dangling child reference", "tasks-add.json", (d) => byId(d, "form").children.push("ghost"), /unknown component "ghost"/],
  ["duplicate id", "tasks-add.json", (d) => d.components.push({ ...byId(d, "title") }), /duplicate id "title"/],
  ["root missing", "tasks-add.json", (d) => (d.root = "nope"), /root "nope"/],
  ["two primary actions at once", "tasks-list.json", (d) => (byId(d, "plan").emphasis = "primary"), /more than one primary action/],
  ["primary action next to a form submit", "tasks-add.json", (d) => {
    d.components.push({ id: "extra", component: "Action", label: "Save draft", emphasis: "primary", action: { event: { name: "task.draft" } } });
    byId(d, "form").children.push("extra");
  }, /more than one primary action/],
  ["relative path outside a repeated item", "tasks-add.json", (d) => (byId(d, "title").value = { path: "draft/title" }), /relative path "draft\/title" used outside a repeated item/],
  ["wrong reference type", "error-load-failed.json", (d) => {
    d.components.push({ id: "txt", component: "Text", text: "hi" });
    byId(d, "root").action = "txt";
  }, /Status\.action must reference Action or ActionBar, not Text/],
  ["non-action in ActionBar", "personal-reading-log.json", (d) => {
    d.components.push({ id: "t", component: "Text", text: "x" });
    byId(d, "bar").children.push("t");
  }, /ActionBar\.children must reference Action/],
  ["cycle", "tasks-list.json", (d) => (byId(d, "list").empty = "root"), /already has parent|cycle|Collection\.empty must reference Status/],
  ["pure cycle back to root", "personal-reading-log.json", (d) => byId(d, "bar").children.push("root"), /cycle|ActionBar\.children must reference Action/],
  ["component used in two places", "travel-booking-review.json", (d) => byId(d, "form").children.push("guest-details"), /already has parent "guest"/],
  ["unknown renderer action", "settings-delete-account.json", (d) => (byId(d, "confirm").cancel.action.event.name = "ui.close"), /"ui\.close" is not a renderer action/],
  ["invalid capability name", "tasks-add.json", (d) => (byId(d, "form").submit.action.event.name = "Save Task"), /pattern/],
  ["hard-coded metric value (data must be bound)", "money-budget-settings.json", (d) => (byId(d, "used").value = 212.5), /must be object|must have required property 'path'/],
  ["image without alt text", "shop-order-status.json", (d) => delete byId(d, "item-img").alt, /Media needs alt text/],
  ["URL instead of host-provided image", "shop-order-status.json", (d) => (byId(d, "item-img").src = "https://example.com/x.png"), /must be object/],
];
for (const [name, file, fn, expected] of cases) {
  test(`rejects: ${name}`, () => {
    const r = mutate(file, fn);
    assert.equal(r.valid, false, `expected invalid, got:\n${r.text}`);
    assert.match(r.text, expected);
  });
}

/** A flight list whose card template binds its fields in the ways a model gets wrong. */
const flights = (card: Record<string, unknown>, text?: Record<string, unknown>) => ({
  specVersion: "0.1.0",
  surface: { id: "flights", title: "Flights", intent: "travel.search" },
  root: "list",
  data: { route: "LHR → LIS", order: { status: "Shipped" }, flights: [{ airline: "TAP", depart: "07:10" }, { airline: "BA", depart: "08:40" }] },
  components: [
    { id: "list", component: "Collection", label: "Flights", items: { path: "/flights", componentId: "card" } },
    { id: "card", component: "Card", ...card, children: ["line"] },
    { id: "line", component: "Text", text: "Morning", ...text },
  ],
});
const issues = (d: unknown, opts = {}) => validateDocument(d as any, opts).issues.map((i) => `${i.severity} ${i.code ?? ""} ${i.message}`).join("\n");

test("warns: path missing from data", () => {
  const r = mutate("tasks-add.json", (d) => byId(d, "form").children.unshift(d.components.push({ id: "note", component: "Text", text: { path: "/draft/nope" } }) && "note"));
  assert.equal(r.valid, true);
  assert.match(r.text, /warning .*path "\/draft\/nope" does not exist in data/);
});

test("an input's own value needn't exist in data yet, nor what reads it back", () => {
  const r = mutate("tasks-add.json", (d) => (byId(d, "title").value = { path: "/draft/nope" }));
  assert.doesNotMatch(r.text, /nope/);
});

test("missingData: error makes a binding that reads nothing an error, with a code", () => {
  const r = validateDocument(flights({ title: { path: "airline" } }, { text: { path: "/nowhere" } }) as any, { missingData: "error" });
  assert.equal(r.valid, false);
  assert.match(issues(flights({ title: { path: "airline" } }, { text: { path: "/nowhere" } }), { missingData: "error" }), /error data:missing-path path "\/nowhere"/);
});

test("an item field no item has is missing, even deep inside the item template", () => {
  assert.match(issues(flights({ title: { path: "airline" } }, { text: { path: "departs" } })), /"departs" is not a field of the items in \/flights \(they have airline, depart\)/);
  assert.doesNotMatch(issues(flights({ title: { path: "airline" } }, { text: { path: "depart" } })), /missing|not a field/);
});

test("an absolute path inside an item that meant the item's field says so", () => {
  assert.match(issues(flights({ title: { path: "/airline" } })), /the item's own field is "airline", without the slash/);
});

test("a misplaced absolute path points at where the field is", () => {
  assert.match(issues(flights({ title: { path: "airline" } }, { text: { path: "/status" } })), /did you mean "\/order\/status"/);
});

test("a table's columns read from its rows", () => {
  const doc = {
    specVersion: "0.1.0",
    surface: { id: "accounts", title: "Accounts", intent: "accounts.list" },
    root: "t",
    data: { rows: [{ name: "Acme", mrr: 1200 }] },
    components: [{ id: "t", component: "Table", caption: "Accounts", rows: { path: "/rows" }, columns: [{ key: "name", label: "Name", path: "name" }, { key: "plan", label: "Plan", path: "plan" }] }],
  };
  const text = issues(doc);
  assert.match(text, /"plan" is not a field of the items in \/rows/);
  assert.doesNotMatch(text, /"name" is not a field/);
});

test("warns: unreachable component", () => {
  const r = mutate("tasks-add.json", (d) => d.components.push({ id: "orphan", component: "Text", text: "x" }));
  assert.match(r.text, /"orphan" is not reachable/);
});

test("allows one primary per view panel and per step", () => {
  const r = mutate("travel-trip-overview.json", (d) => {
    d.components.push(
      { id: "a1", component: "Action", label: "Add day", emphasis: "primary", action: { event: { name: "trip.addDay" } } },
      { id: "a2", component: "Action", label: "Add booking", emphasis: "primary", action: { event: { name: "trip.addBooking" } } },
      { id: "g1", component: "Group", children: ["itinerary", "a1"] },
      { id: "g2", component: "Group", children: ["bookings", "a2"] },
    );
    byId(d, "views").views[0].content = "g1";
    byId(d, "views").views[1].content = "g2";
  });
  assert.equal(r.valid, true, r.text);
});

test("emphasisBudget: a Design Direction can allow two primary actions in one view", () => {
  const doc = {
    specVersion: "0.1.0",
    surface: { id: "s", title: "Dashboard" },
    root: "bar",
    components: [
      { id: "bar", component: "ActionBar", children: ["a", "b"] },
      { id: "a", component: "Action", label: "Add a task", emphasis: "primary", action: { event: { name: "task.create" } } },
      { id: "b", component: "Action", label: "Start a project", emphasis: "primary", action: { event: { name: "project.create" } } },
    ],
  };
  assert.match(validateDocument(doc).issues.map((i) => i.message).join(), /more than one primary action/);
  assert.deepEqual(validateDocument(doc, { emphasisBudget: 2 }).issues, []);
  assert.match(validateDocument(doc, { emphasisBudget: 1 }).issues.map((i) => i.message).join(), /more than one primary action/);
});
