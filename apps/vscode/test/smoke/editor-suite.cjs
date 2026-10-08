// Runs inside VS Code, started by editor.ts with Halden's demo folder open. CommonJS, because
// that is what the editor's test runner loads.
const assert = require("node:assert/strict");
const path = require("node:path");
const vscode = require("vscode");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(what, get, ms = 30_000) {
  const until = Date.now() + ms;
  for (;;) {
    const v = get();
    if (v) return v;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

exports.run = async function run() {
  const ext = vscode.extensions.getExtension("polyxd.polyxd-vscode");
  assert.ok(ext, "the extension isn't loaded");
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  assert.ok(folder, "no workspace folder");

  // An authored screen with a typo in one binding: the static check underlines it.
  const file = path.join(folder, "authored/screen.budgets.json");
  const original = await vscode.workspace.openTextDocument(file);
  const typo = original.getText().replace('"path": "/budgets/daysLeft"', '"path": "/budgets/daysLef"');
  assert.notEqual(typo, original.getText(), "Halden's budgets screen changed; update the typo this test makes");
  const doc = await vscode.workspace.openTextDocument({ language: "json", content: typo });
  await vscode.window.showTextDocument(doc);
  const api = await ext.activate();
  const diagnostics = await waitFor("the static check's diagnostics", () => {
    const d = vscode.languages.getDiagnostics(doc.uri).filter((x) => x.source === "polyxd");
    return d.length ? d : undefined;
  });
  assert.ok(diagnostics.some((d) => d.message.includes("/budgets/daysLef")), diagnostics.map((d) => d.message).join("\n"));

  // The MCP server went in through VS Code's definition provider (registering it throws when the
  // provider id isn't in package.json's contributes).
  assert.equal(api.mcpRoute, "vscode", `VS Code ${vscode.version} has no MCP server definition API`);

  // The bundled schema, through the editor's own JSON support: an intent file with a component
  // that doesn't exist is flagged inside its "document", and the valid intent beside it isn't
  // flagged at all (the spec's schema at an intent's root would call every line of it wrong).
  const others = (uri) => vscode.languages.getDiagnostics(uri).filter((d) => d.source !== "polyxd");
  await vscode.window.showTextDocument(original);
  const brokenFile = path.join(folder, "authored/screen.broken.json");
  const brokenText = original.getText().replace('"component": "Metric"', '"component": "Metrick"');
  assert.notEqual(brokenText, original.getText(), "Halden's budgets screen has no Metric; update the mistake this test makes");
  await vscode.workspace.fs.writeFile(vscode.Uri.file(brokenFile), Buffer.from(brokenText));
  const broken = await vscode.workspace.openTextDocument(brokenFile);
  await vscode.window.showTextDocument(broken);
  const schemaSays = await waitFor("the JSON schema's diagnostics on the broken intent", () => {
    const d = others(broken.uri);
    return d.length ? d : undefined;
  });
  const metrick = broken.getText().split("\n").findIndex((l) => l.includes('"Metrick"'));
  assert.ok(schemaSays.some((d) => d.range.start.line === metrick), schemaSays.map((d) => `${d.range.start.line}: ${d.message}`).join("\n"));
  assert.deepEqual(others(original.uri).map((d) => d.message), [], "the valid intent file has schema diagnostics");
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  await vscode.workspace.fs.delete(vscode.Uri.file(brokenFile));

  // The real file, previewed: the webview renders it under its content-security policy.
  await vscode.window.showTextDocument(original);
  await vscode.commands.executeCommand("polyxd.openPreview");
  const rendered = await waitFor("the preview to render", () => {
    const r = api.previewHealth().rendered;
    return r && r.components > 3 ? r : undefined;
  });
  assert.match(rendered.file, /screen\.budgets\.json$/);
  // Give anything late (a lazy chunk, a validator on first input) a moment to complain.
  await sleep(1000);
  assert.deepEqual(api.previewHealth().problems, [], "the preview page reported problems");

  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
};
