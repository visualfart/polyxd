import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialSplit, initialStep, isLastStep, selectedView, splitPanes, splitReducer, splitSelection, stepsProgress, stepsReducer, tasklistProgress, tasklistReducer, taskStatus, viewsReducer,
  SHARE_MAX, SHARE_MIN, ROOT_SCOPE, indexById, type UIDocument,
} from "../src/index.ts";

test("steps move one at a time and never past either end", () => {
  let s = initialStep(undefined, 3);
  assert.deepEqual(s, { index: 0, total: 3 });
  assert.equal(stepsProgress(s), "Step 1 of 3");
  s = stepsReducer(s, { type: "back" });
  assert.equal(s.index, 0);
  s = stepsReducer(s, { type: "next" });
  s = stepsReducer(s, { type: "next" });
  assert.ok(isLastStep(s));
  s = stepsReducer(s, { type: "next" });
  assert.equal(s.index, 2, "does not run past the last step");
  assert.equal(stepsReducer(s, { type: "go", index: -4 }).index, 0);
  assert.equal(initialStep(7, 3).index, 2, "a bound step is clamped");
  assert.equal(initialStep("2", 3).index, 0, "a non-number starts at the first");
});

test("task lists open one task at a time and know their statuses", () => {
  assert.equal(tasklistReducer(null, "a"), "a");
  assert.equal(tasklistReducer("a", "b"), "b");
  assert.equal(tasklistReducer("b", "b"), null);
  assert.deepEqual(taskStatus("done"), { label: "Completed", tone: "success" });
  assert.deepEqual(taskStatus(undefined), { label: "Not started", tone: "neutral" });
  assert.deepEqual(taskStatus("nonsense"), { label: "Not started", tone: "neutral" });
  assert.equal(tasklistProgress(2, 5), "2 of 5 tasks completed");
});

test("views: the binding wins, then the local choice, then the first view", () => {
  const views = [{ key: "all" }, { key: "mine" }];
  assert.equal(selectedView(views, undefined, undefined), "all");
  assert.equal(selectedView(views, undefined, "mine"), "mine");
  assert.equal(selectedView(views, "mine", "all"), "mine");
  assert.equal(selectedView(views, "", "all"), "all", "an empty binding is no choice");
  assert.equal(viewsReducer("all", "mine"), "mine");
});

test("split: compact below 640px, the detail takes the screen until Back, the share stays in bounds", () => {
  let s = initialSplit("balanced");
  assert.equal(s.share, 50);
  assert.deepEqual(splitPanes(s, true), { showList: true, showDetail: true });
  s = splitReducer(s, { type: "measure", width: 500 });
  assert.ok(s.compact);
  assert.deepEqual(splitPanes(s, false), { showList: true, showDetail: false });
  assert.deepEqual(splitPanes(s, true), { showList: false, showDetail: true });
  s = splitReducer(s, { type: "back" });
  assert.deepEqual(splitPanes(s, true), { showList: true, showDetail: false });
  s = splitReducer(s, { type: "selected" });
  assert.deepEqual(splitPanes(s, true), { showList: false, showDetail: true });
  s = splitReducer(s, { type: "key", key: "ArrowLeft", shift: true });
  assert.equal(s.share, 40);
  s = splitReducer(s, { type: "key", key: "End" });
  assert.equal(s.share, SHARE_MAX);
  s = splitReducer(s, { type: "share", value: 5 });
  assert.equal(s.share, SHARE_MIN);
  assert.equal(splitReducer(s, { type: "key", key: "x" }), s, "other keys change nothing");
  assert.equal(initialSplit(undefined).share, 33.333);
});

test("split selection finds the item the primary selects, its scope and its name", () => {
  const doc: UIDocument = {
    specVersion: "0.3.0",
    surface: { id: "s", title: "T" },
    root: "split",
    components: [
      { id: "split", component: "Split", primary: "list", detail: "detail", selected: { path: "/selected" } },
      { id: "list", component: "Collection", label: "Tickets", items: { path: "/tickets", componentId: "row" }, selection: "single", selected: { path: "/selected" } },
      { id: "row", component: "Card", title: { path: "title" } },
      { id: "detail", component: "Text", text: { path: "body" } },
    ],
  };
  const byId = indexById(doc);
  const data = { tickets: [{ id: "t1", title: "Login broken" }, { id: "t2", title: "Slow" }], selected: "t2" };
  const sel = splitSelection(byId.get("split")!, byId, data, ROOT_SCOPE);
  assert.deepEqual(sel, { has: true, index: 1, scope: { pointer: "/tickets/1" }, name: "Slow" });
  assert.deepEqual(splitSelection(byId.get("split")!, byId, { ...data, selected: null }, ROOT_SCOPE), { has: false, index: -1, scope: undefined, name: undefined });
  // A Table primary selects by rowValuePath.
  const table = { ...doc, components: [{ ...doc.components[0] }, { id: "list", component: "Table", rows: { path: "/tickets" }, rowValuePath: "title", columns: [] }, ...doc.components.slice(2)] };
  const t = splitSelection(table.components[0], indexById(table), { ...data, selected: "Slow" }, ROOT_SCOPE);
  assert.equal(t.index, 1);
  assert.equal(t.name, "Slow");
});
