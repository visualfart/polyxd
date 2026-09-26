import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { staticAudit } from "../src/static.ts";
import { load, byId, registry, examplesDir } from "./helpers.ts";

const checks = (doc: any) => staticAudit(doc, { registry }).map((f) => `${f.severity} ${f.check}`);

for (const f of readdirSync(examplesDir).filter((f) => f.endsWith(".json"))) {
  test(`example ${f} passes every static check`, () => assert.deepEqual(staticAudit(load(f.replace(".json", "")), { registry }), []));
}

test("two controls with the same name are ambiguous for agents", () => {
  const d = load("tasks-add");
  byId(d, "notes").label = "Task";
  assert.ok(checks(d).includes("error agent:ambiguous-name"));
});

test("empty visible text is an error", () => {
  const d = load("personal-habits");
  byId(d, "week").summary = " ";
  assert.ok(checks(d).includes("error text:empty"));
});

test("generic button labels are flagged", () => {
  const d = load("personal-reading-log");
  byId(d, "add").label = "OK";
  assert.ok(checks(d).includes("warning copy:generic-label"));
});

/** A list of flights; `card` and `line` are spread into its item template and a line inside it. */
const flights = (card: Record<string, unknown> = {}, line: Record<string, unknown> = {}) => ({
  specVersion: "0.1.0",
  surface: { id: "flights", title: "Flights to Lisbon", intent: "travel.search" },
  root: "list",
  data: { route: "LHR → LIS", share: 0.4, order: { status: "Shipped" }, flights: [{ id: "f1", name: "TP1351", airline: "TAP", depart: "07:10", seats: 0.5 }] },
  components: [
    { id: "list", component: "Collection", label: "Flights", items: { path: "/flights", componentId: "card" } },
    { id: "card", component: "Card", title: { path: "airline" }, children: ["line"], ...card },
    { id: "line", component: "Text", text: { path: "depart" }, ...line },
  ],
});
const found = (doc: any) => staticAudit(doc).map((f) => `${f.severity} ${f.check} ${f.message}`).join("\n");

test("a well-bound list passes", () => assert.equal(found(flights()), ""));

test("a binding that reads nothing is an error of its own, and the other checks still run", () => {
  const out = found(flights({}, { text: { path: "departs" } }));
  assert.match(out, /error data:missing-path .*"departs" is not a field of the items in \/flights/);
  assert.doesNotMatch(out, /error spec /);
  assert.match(found(flights({ title: { path: "/airline" } }, { text: "Departs:" })), /text:dangling-label/);
});

test("an absolute path inside an item template reads the top of the data, as the renderer does", () => {
  // /route exists at the top, so it isn't missing; /seats doesn't, even though every item has one.
  assert.equal(found(flights({ title: { path: "/route" } })), "");
  assert.match(found(flights({ progress: { value: { path: "/seats" } } })), /the item's own field is "seats"/);
  assert.equal(found(flights({ progress: { value: { path: "seats" } } })), "");
  assert.equal(found(flights({ progress: { value: { path: "/share" } } })), "");
});

test("a label with nothing after it is an error; a sentence ending in a colon isn't", () => {
  assert.match(found(flights({}, { text: "Departs: " })), /error text:dangling-label line reads "Departs:"/);
  assert.doesNotMatch(found(flights({}, { text: "These leave before ten in the morning:" })), /dangling-label/);
});

test("a progress bar bound to something that isn't a fraction is an error", () => {
  assert.match(found(flights({ progress: { value: { path: "airline" } } })), /error data:progress-not-a-fraction/);
  const percent = { ...flights({ progress: { value: { path: "pct" } } }), data: { flights: [{ airline: "TAP", depart: "07:10", pct: 40 }] } };
  assert.match(found(percent), /progress is 40/);
});

test("a template placeholder and a raw id are caught inside items", () => {
  assert.match(found(flights({}, { text: "Departs {{depart}}" })), /error text:template-placeholder/);
  assert.match(found(flights({}, { text: "Plan: {plan}" })), /"\{plan\}" is a template placeholder/);
  assert.match(found(flights({ title: { path: "id" } })), /warning copy:raw-identifier card.title shows "f1", an internal id, where name is a name/);
});
