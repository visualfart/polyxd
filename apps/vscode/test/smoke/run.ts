/**
 * Activates the built extension (dist/extension.cjs) in Node against a stand-in `vscode` module
 * and walks through what an editor session does: open Halden's authored screens, edit one, move
 * the cursor, open the preview, click a component in it, insert a component, run verify. Checks
 * the wiring between the pure pieces and the API without an editor; the .vsix in a real editor
 * remains the last word. Build first: npm run build -w polyxd-vscode.
 *
 *   node --test test/smoke/run.ts
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import * as stub from "./vscode-stub.ts";

const here = fileURLToPath(new URL("../../", import.meta.url));
const halden = join(here, "../demos/halden");
const bundle = join(here, "dist/extension.cjs");

test("the built extension activates and behaves against a stand-in vscode", { skip: !existsSync(bundle) && "dist/extension.cjs isn't built" }, async () => {
  const load = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
  (Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (request: unknown, ...rest: unknown[]) {
    return request === "vscode" ? stub : load.call(this, request, ...rest);
  };
  stub.setWorkspace([halden]);
  const ext = (Module.createRequire(import.meta.url)(bundle) as { activate: (c: unknown) => void });
  const context = stub.makeContext(here);
  ext.activate(context);

  // Contributions are wired.
  for (const c of ["polyxd.openPreview", "polyxd.verify", "polyxd.insertComponent", "polyxd.openInStudio", "polyxd.pushToStudio", "polyxd.setStudioKey", "polyxd.refreshDocuments"]) assert.ok(stub.recorded.commands.has(c), c);
  assert.ok(stub.recorded.treeProviders.has("polyxd.documents"));

  // Opening an authored screen publishes diagnostics and sets the context key.
  const path = join(halden, "authored/screen.budgets.json");
  const doc = stub.openDocument(path);
  stub.activate(doc);
  await sleep(50);
  assert.equal(stub.recorded.context.get("polyxd.isDocument"), true);
  assert.ok(stub.recorded.diagnostics.has(path));

  // A registry isn't a document: nothing published, context off.
  const registry = stub.openDocument(join(halden, "registry.json"));
  stub.activate(registry);
  await sleep(50);
  assert.equal(stub.recorded.context.get("polyxd.isDocument"), false);
  assert.equal(stub.recorded.diagnostics.has(join(halden, "registry.json")), false);

  // A typo in a path becomes a warning on the right line, after the debounce.
  stub.activate(doc);
  const text = readFileSync(path, "utf8");
  const typo = text.replace('"path": "/budgets/daysLeft"', '"path": "/budgets/daysLef"').replace('"sample": {}', `"sample": {}, "document_data_marker": 1`);
  assert.notEqual(typo, text);
  // Give the document data so bindings are checked: the intent's document gets a data snapshot.
  const withData = typo.replace('"specVersion": "0.2.0",', '"specVersion": "0.2.0", "data": { "budgets": { "daysLeft": 3, "any": true, "rows": [], "used": 1, "budgetedLabel": "x", "ofLabel": "y", "toGoLabel": "z" } },');
  stub.edit(doc, withData);
  await sleep(400);
  const diags = stub.recorded.diagnostics.get(path)!;
  const warning = diags.find((d) => d.message.includes("/budgets/daysLef"));
  assert.ok(warning, diags.map((d) => d.message).join("\n"));
  assert.equal(warning!.severity, stub.DiagnosticSeverity.Warning);
  assert.match(warning!.message, /did you mean "\/budgets\/daysLeft"/);
  assert.ok(withData.split("\n")[warning!.range.start.line].includes("daysLef"));

  // The preview opens beside, gets the document once the page says it's ready, and follows the cursor.
  await stub.recorded.commands.get("polyxd.openPreview")!();
  const panel = stub.recorded.panels[0];
  assert.ok(panel);
  assert.match(panel.webview.html, /polyxd\.js/);
  assert.match(panel.webview.html, /Content-Security-Policy/);
  panel.webview.receive({ type: "ready" });
  await sleep(20);
  const types = panel.webview.posted.map((m) => (m as { type: string }).type);
  assert.deepEqual(types.slice(0, 2), ["init", "document"]);
  const sent = panel.webview.posted[1] as { document: { components: unknown[] }; kind: string; file: string };
  assert.equal(sent.kind, "intent");
  assert.equal(sent.file, "authored/screen.budgets.json");
  assert.ok(sent.document.components.length > 3);
  const line = withData.split("\n").findIndex((l) => l.includes('"id": "days_left"'));
  stub.moveCursor(line, 12);
  const outline = [...panel.webview.posted].reverse().find((m) => (m as { type: string }).type === "outline") as { id?: string };
  assert.equal(outline.id, "days_left");
  stub.moveCursor(0, 1);
  assert.equal((panel.webview.posted.at(-1) as { id?: string }).id, undefined);

  // A click in the preview moves the cursor to that component's "id".
  panel.webview.receive({ type: "select", id: "budget_bar" });
  await sleep(20);
  const at = stub.activeEditor!.selection.active;
  assert.ok(withData.split("\n")[at.line].includes('"id": "budget_bar"'), withData.split("\n")[at.line]);

  // Insert component: a Metric lands after the component under the cursor, as a snippet with tab stops.
  stub.recorded.quickPickAnswer = "Metric";
  stub.moveCursor(line, 12);
  await stub.recorded.commands.get("polyxd.insertComponent")!();
  await sleep(20);
  const snippet = stub.recorded.snippets[0];
  assert.ok(snippet, "no snippet inserted");
  assert.match(snippet.text, /"component": "Metric"/);
  assert.match(snippet.text, /"id": "metric"/);
  assert.match(snippet.text, /\$\{1:/);
  assert.equal(snippet.text.startsWith(",\n"), true);

  // Open in Studio copies the document (not the intent wrapper) and opens the site.
  await stub.recorded.commands.get("polyxd.openInStudio")!();
  assert.equal(JSON.parse(stub.recorded.clipboard).surface.id, "budgets");
  assert.ok(stub.recorded.opened.some((u) => u.includes("studio.polyxd.com")));

  // Verify runs the verifier as a task with all 13 packs; an intent file goes through a temp copy.
  const verifying = stub.recorded.commands.get("polyxd.verify")!() as Promise<void>;
  await sleep(50);
  const task = stub.recorded.tasks.at(-1)!;
  const cmd = (task.execution as { commandLine: string }).commandLine;
  assert.match(cmd, /polyxd-verify/);
  assert.match(cmd, /--themes material3,carbon,antd,fluent,shadcn,bootstrap,mantine,radix,polaris,primer,spectrum,govuk,chakra --modes light,dark --widths 390,1100/);
  assert.match(cmd, /polyxd-vscode-verify-/);
  stub.fire("endTaskProcess", { execution: { task }, exitCode: 0 });
  await verifying;
  assert.ok(stub.recorded.messages.some((m) => m.includes("verified in 13 packs")), stub.recorded.messages.join("\n"));

  // Push to Studio: the key goes through secret storage into the task's environment, not the command line.
  stub.setConfig("polyxd.studio.workspaceUrl", "https://studio.polyxd.com/api/w/halden");
  stub.recorded.inputAnswer = "sk-test-not-real";
  const pushing = stub.recorded.commands.get("polyxd.pushToStudio")!() as Promise<void>;
  await sleep(50);
  const push = stub.recorded.tasks.at(-1)!;
  const pushCmd = (push.execution as { commandLine: string; options: { env: Record<string, string> } });
  assert.match(pushCmd.commandLine, /polyxd studio push .*screen\.budgets\.json --to https:\/\/studio\.polyxd\.com\/api\/w\/halden/);
  assert.equal(pushCmd.options.env.POLYXD_STUDIO_KEY, "sk-test-not-real");
  assert.ok(!pushCmd.commandLine.includes("sk-test"));
  assert.equal(stub.recorded.secrets.get("polyxd.studio.key"), "sk-test-not-real");
  stub.fire("endTaskProcess", { execution: { task: push }, exitCode: 0 });
  await pushing;

  // The documents view lists Halden's folders with status dots.
  const provider = stub.recorded.treeProviders.get("polyxd.documents") as { refresh(): Promise<void>; getChildren(i?: unknown): unknown[]; getTreeItem(i: unknown): stub.TreeItem };
  await provider.refresh();
  const folders = provider.getChildren() as { label: string; documents: unknown[] }[];
  assert.deepEqual(folders.map((f) => f.label), ["authored", "intents"]);
  const first = provider.getTreeItem(provider.getChildren(folders[0])[0]);
  assert.equal(first.label, "Budgets");
  assert.ok((first.iconPath as { id: string }).id === "circle-filled");

  for (const s of context.subscriptions) s.dispose?.();
});
