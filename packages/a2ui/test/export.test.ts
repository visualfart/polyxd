import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { checkComponentTree, createValidator, exportToA2UI, EXTENSION_KEY, POLYXD_CATALOG_ID, type A2UIMessage, type PolyxdDocument } from "../src/index.ts";

// @polyxd/spec does not export examples/, so read them from the workspace.
const examplesDir = new URL("../../spec/examples/", import.meta.url);
const files = readdirSync(examplesDir).filter((f) => f.endsWith(".json")).sort();
const load = (f: string): PolyxdDocument => JSON.parse(readFileSync(new URL(f, examplesDir), "utf8"));
const validator = createValidator();

const componentsOf = (messages: A2UIMessage[]) =>
  messages.flatMap((m: any) => m.createSurface?.components ?? m.updateComponents?.components ?? []);
const byId = (messages: A2UIMessage[], id: string) => componentsOf(messages).find((c: any) => c.id === id);
const assertValid = (messages: A2UIMessage[]) => {
  messages.forEach((m, i) => assert.deepEqual(validator.message(m), [], `message ${i} (${Object.keys(m).find((k) => k !== "version")})`));
  assert.deepEqual(checkComponentTree(componentsOf(messages)), []);
};

test("there are 28 example UI documents", () => assert.equal(files.length, 28));

for (const file of files) {
  test(`${file} exports to A2UI v1.0 messages that validate against the official schemas`, () => {
    const doc = load(file);
    const inline = exportToA2UI(doc);
    assert.equal(inline.messages.length, 1);
    assertValid(inline.messages);

    const stream = exportToA2UI(doc, { mode: "stream" });
    assert.deepEqual(stream.messages.map((m) => Object.keys(m).find((k) => k !== "version")), ["createSurface", "updateComponents", ...(doc.data ? ["updateDataModel"] : [])]);
    assertValid(stream.messages);

    // Nothing silently dropped: every component survives with its id, and envelope metadata is reported.
    assert.equal(componentsOf(inline.messages).length, doc.components.length);
    assert.ok(inline.lossy.includes("/surface/title"));
    assert.ok(inline.lossy.includes("/specVersion"));
    const keyed = doc.components.flatMap((c, i) => (c.key ? [`/components/${i}/key`] : []));
    for (const k of keyed) assert.ok(inline.lossy.includes(k), k);
  });
}

test("createSurface uses the Polyxd catalog and carries the data model", () => {
  const doc = load("tasks-list.json");
  const [m] = exportToA2UI(doc).messages as any[];
  assert.equal(m.version, "v1.0");
  assert.equal(m.createSurface.surfaceId, "tasks");
  assert.equal(m.createSurface.catalogId, POLYXD_CATALOG_ID);
  assert.deepEqual(m.createSurface.dataModel, doc.data);
  assert.equal(exportToA2UI(doc, { surfaceId: "tasks-42" }).messages.length, 1);
  assert.equal((exportToA2UI(doc, { surfaceId: "tasks-42" }).messages[0] as any).createSurface.surfaceId, "tasks-42");
});

test("ids, templated children, relative bindings and actions survive (tasks-list)", () => {
  const { messages, idMap } = exportToA2UI(load("tasks-list.json"));
  assert.deepEqual(idMap, {});
  assert.deepEqual(byId(messages, "root").children, ["list", "bar"]);
  const list = byId(messages, "list");
  assert.deepEqual(list.items, { path: "/tasks", componentId: "task" });
  assert.deepEqual(list.selected, { path: "/done" });
  assert.equal(list.empty, "none-due");
  const task = byId(messages, "task");
  assert.deepEqual(task.title, { path: "title" });
  assert.deepEqual(task.action, { event: { name: "task.open", context: { id: { path: "id" } } } });
  assert.equal(byId(messages, "none-due").action, "plan");
  assert.deepEqual(byId(messages, "list").metadata, { extensions: { [EXTENSION_KEY]: { key: "tasks" } } });
});

test("the Polyxd root is renamed to 'root' and every reference follows (money-send-form)", () => {
  const doc = load("money-send-form.json");
  const { messages, idMap, lossy } = exportToA2UI(doc);
  assert.deepEqual(idMap, { form: "root" });
  const root = byId(messages, "root");
  assert.equal(root.component, "Form");
  assert.deepEqual(root.children, ["recipient", "amount", "reference", "fee-details"]);
  assert.deepEqual(root.submit.action.event.context, {
    recipient: { path: "/draft/recipient" },
    amount: { path: "/draft/amount" },
    reference: { path: "/draft/reference" },
  });
  assert.equal(byId(messages, "form"), undefined);
  assert.deepEqual(byId(messages, "amount").value, { path: "/draft/amount" });
  assert.deepEqual(byId(messages, "amount").validation, { min: 0.01, max: 5000, message: "Enter an amount between £0.01 and £5,000" });
  // Format details are representable in the Polyxd catalog, so they are not lossy.
  assert.deepEqual(byId(messages, "fee-details").items[0].format, { type: "currency", currency: "GBP" });
  assert.ok(!lossy.some((p) => p.includes("format")));
  assert.deepEqual(lossy.filter((p) => p.startsWith("/surface")).sort(), ["/surface/intent", "/surface/pattern", "/surface/title"]);
  const ext = (messages[0] as any).createSurface.metadata.extensions[EXTENSION_KEY];
  assert.deepEqual(ext, { specVersion: "0.2.0", title: "Send money", intent: "money.send", pattern: "multi-step-form", root: "form" });
});

test("Views and Steps panel references are remapped (travel-trip-overview, shop-checkout)", () => {
  for (const [file, comp, list] of [["travel-trip-overview.json", "Views", "views"], ["shop-checkout.json", "Steps", "steps"]] as const) {
    const doc = load(file);
    const { messages } = exportToA2UI(doc);
    const original = doc.components.find((c) => c.id === doc.root)!;
    const root = byId(messages, "root");
    assert.equal(root.component, comp);
    assert.deepEqual(root[list].map((v: any) => v.content), (original[list] as any[]).map((v) => v.content));
  }
});

test("renderer actions (ui.*) become A2UI local function calls from the Polyxd catalog", () => {
  const { messages, lossy } = exportToA2UI(load("settings-delete-account.json"));
  assert.deepEqual(byId(messages, "root").cancel.action, { functionCall: { call: "dismiss" } });
  assert.ok(!lossy.some((p) => p.includes("context")));

  const doc = load("settings-delete-account.json");
  (doc.components[0] as any).cancel.action.event.context = { reason: "x" };
  const r = exportToA2UI(doc);
  assert.ok(r.lossy.includes("/components/0/cancel/action/event/context"));
  assertValid(r.messages);
});

test("accessibility maps onto the A2UI accessibility block", () => {
  const doc = load("tasks-list.json");
  doc.components[0].accessibility = { label: "Today's tasks", description: { path: "/summary" }, live: "polite", hidden: false };
  const { messages } = exportToA2UI(doc);
  assert.deepEqual(byId(messages, "root").accessibility, doc.components[0].accessibility);
  assertValid(messages);
});

test("a non-root component already called 'root' is moved out of the way", () => {
  const doc: PolyxdDocument = {
    specVersion: "0.2.0",
    surface: { id: "s", title: "S" },
    root: "top",
    components: [
      { id: "top", component: "Group", children: ["root"] },
      { id: "root", component: "Text", text: "hi" },
    ],
  };
  const { messages, idMap } = exportToA2UI(doc);
  assert.deepEqual(idMap, { top: "root", root: "root_2" });
  assert.deepEqual(byId(messages, "root").children, ["root_2"]);
  assert.equal(byId(messages, "root_2").text, "hi");
  assertValid(messages);
});

test("extensions: false drops the opaque metadata but still reports it as lossy", () => {
  const { messages, lossy } = exportToA2UI(load("money-send-form.json"), { extensions: false });
  assert.equal((messages[0] as any).createSurface.metadata, undefined);
  assert.ok(componentsOf(messages).every((c: any) => c.metadata === undefined));
  assert.ok(lossy.includes("/surface/intent") && lossy.includes("/components/1/key"));
  assertValid(messages);
});

test("the export does not mutate its input", () => {
  const doc = load("money-send-form.json");
  const before = JSON.stringify(doc);
  exportToA2UI(doc);
  exportToA2UI(doc, { mode: "stream" });
  assert.equal(JSON.stringify(doc), before);
});

test("the validator rejects messages that break the official schemas", () => {
  const [m] = exportToA2UI(load("settings-delete-account.json")).messages as any[];
  const broken: ((m: any) => void)[] = [
    (m) => delete m.version,
    (m) => (m.createSurface.components[0].component = "Button"),
    (m) => (m.createSurface.components[0].color = "red"),
    (m) => delete m.createSurface.components[0].severity,
    (m) => (m.createSurface.components[0].cancel.action = { functionCall: { call: "openUrl" } }),
    (m) => (m.createSurface.metadata = { extensions: { "not-an-identifier": 1 } }),
  ];
  for (const fn of broken) {
    const c = structuredClone(m);
    fn(c);
    assert.notDeepEqual(validator.message(c), []);
  }
});
