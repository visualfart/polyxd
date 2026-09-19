/**
 * Phase 3 exit criterion: inject 20 known defects into valid documents; the verifier must catch at
 * least 90% (an error, or a failed agent task). They span every layer: schema, structure,
 * patterns, capabilities, copy, accessibility after rendering, layout, and agent operability.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Browser } from "playwright";
import { launch, verifyDocument } from "../src/index.ts";
import { load, byId, registry, tasks } from "./helpers.ts";

const DEFECTS: { name: string; doc: string; mutate: (d: any) => void }[] = [
  { name: "two primary actions at once", doc: "tasks-list", mutate: (d) => (byId(d, "plan").emphasis = "primary") },
  { name: "destructive capability outside a confirmation", doc: "tasks-list", mutate: (d) => (byId(d, "add").action = { event: { name: "project.delete", context: { id: "pr_7" } } }) },
  { name: "consequential capability without review", doc: "travel-booking-review", mutate: (d) => delete d.surface.pattern },
  { name: "generic confirm label", doc: "money-send-confirm", mutate: (d) => (byId(d, "confirm").confirm.label = "OK") },
  { name: "confirmation without consequence", doc: "money-send-confirm", mutate: (d) => delete byId(d, "confirm").consequence },
  { name: "results before filters", doc: "shop-browse-filter", mutate: (d) => (byId(d, "root").children = ["results", "filters"]) },
  { name: "results without an empty state", doc: "shop-browse-filter", mutate: (d) => delete byId(d, "results").empty },
  {
    name: "eight inputs in one view",
    doc: "tasks-add",
    mutate: (d) => {
      for (let i = 0; i < 4; i++) d.components.push({ id: `x${i}`, component: "TextInput", label: `Extra field ${i}`, value: { path: `/draft/x${i}` } });
      byId(d, "form").children.push("x0", "x1", "x2", "x3");
    },
  },
  { name: "image without alt text", doc: "shop-order-status", mutate: (d) => delete byId(d, "item-img").alt },
  { name: "chart without a text summary", doc: "personal-habits", mutate: (d) => (byId(d, "week").summary = "") },
  { name: "table without a caption", doc: "travel-flight-results", mutate: (d) => (byId(d, "root").caption = "") },
  { name: "empty section heading", doc: "settings-notifications", mutate: (d) => (byId(d, "channels").title = "") },
  { name: "two fields with the same name", doc: "tasks-add", mutate: (d) => (byId(d, "notes").label = "Task") },
  { name: "invented data (hard-coded balance)", doc: "money-balance-overview", mutate: (d) => (byId(d, "balance").value = 9999) },
  { name: "relative data path outside a list", doc: "tasks-add", mutate: (d) => (byId(d, "title").value = { path: "draft/title" }) },
  { name: "reference to a missing component", doc: "tasks-add", mutate: (d) => byId(d, "form").children.push("ghost") },
  { name: "unregistered capability", doc: "tasks-add", mutate: (d) => (byId(d, "form").submit.action.event.name = "task.saveEverything") },
  { name: "unknown renderer action", doc: "settings-delete-account", mutate: (d) => (byId(d, "confirm").cancel.action.event.name = "ui.close") },
  { name: "required field removed (task can't be done)", doc: "money-send-form", mutate: (d) => (byId(d, "form").children = ["recipient", "reference", "fees"]) },
  {
    name: "unbreakable text overflows on a phone",
    doc: "error-load-failed",
    mutate: (d) => (byId(d, "root").message = "Reference:" + "X".repeat(120)),
  },
];

let browser: Browser;
before(async () => (browser = await launch()));
after(async () => browser.close());

const caught: string[] = [];
for (const defect of DEFECTS) {
  test(`catches: ${defect.name}`, async () => {
    const d = load(defect.doc);
    defect.mutate(d);
    const r = await verifyDocument(d, {
      browser,
      registry,
      tasks: tasks.filter((t) => t.document === defect.doc),
      modes: ["light"],
      widths: [390],
    });
    const failedTasks = r.agentRuns - r.agentSuccess;
    if (r.errors > 0 || failedTasks > 0) caught.push(defect.name);
    assert.ok(r.errors > 0 || failedTasks > 0, `not caught; findings: ${JSON.stringify([...r.static, ...r.targets.flatMap((t) => t.findings)])}`);
    assert.ok(r.score < 100);
  });
}

test("catch rate is at least 90% of 20 defects", () => {
  assert.equal(DEFECTS.length, 20);
  assert.ok(caught.length / DEFECTS.length >= 0.9, `caught ${caught.length}/20`);
});
