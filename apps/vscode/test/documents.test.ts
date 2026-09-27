import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { classify, discoverDocuments, groupByFolder, loadDocument, siblingDataPath } from "../src/documents.ts";
import { rangeForPointer } from "../src/json.ts";

const halden = fileURLToPath(new URL("../../demos/halden/", import.meta.url));

const doc = (extra: Record<string, unknown> = {}) => ({
  specVersion: "0.3.0",
  surface: { id: "s", title: "S" },
  root: "t",
  components: [{ id: "t", component: "Text", text: { path: "/greeting" } }],
  ...extra,
});

test("classify: bare documents, intent files, and neither", () => {
  assert.equal(classify(doc())!.kind, "document");
  assert.equal(classify(doc())!.prefix, "");
  const intent = classify({ id: "screen.x", title: "X", document: doc() })!;
  assert.equal(intent.kind, "intent");
  assert.equal(intent.prefix, "/document");
  assert.equal(intent.id, "s");
  assert.equal(classify({ name: "pkg", components: {} }), undefined);
  assert.equal(classify([1, 2]), undefined);
  assert.equal(classify(null), undefined);
});

test("loadDocument: embedded data, sibling data, none; missing paths are warnings", () => {
  const embedded = loadDocument(JSON.stringify(doc({ data: { greeting: "hi" } })))!;
  assert.equal(embedded.dataFrom, "embedded");
  assert.equal(embedded.check.errors, 0);
  assert.equal(embedded.check.warnings, 0);
  const sibling = loadDocument(JSON.stringify(doc()), JSON.stringify({ greeting: "hi" }))!;
  assert.equal(sibling.dataFrom, "sibling");
  assert.equal(sibling.check.warnings, 0);
  const none = loadDocument(JSON.stringify(doc()))!;
  assert.equal(none.dataFrom, "none");
  assert.equal(none.check.errors, 0);
  // Without data there is nothing to check bindings against: no warnings, rather than one per path.
  assert.equal(none.check.warnings, 0);
  const wrong = loadDocument(JSON.stringify(doc({ data: { hello: "hi" } })))!;
  assert.equal(wrong.check.warnings, 1);
  assert.equal(wrong.check.issues[0].code, "data:missing-path");
  const half = loadDocument(JSON.stringify(doc()), "{ not json")!;
  assert.equal(half.dataFrom, "none");
  assert.equal(loadDocument("{ broken"), undefined);
  assert.equal(loadDocument('{"a": 1}'), undefined);
});

test("a structural issue is an error and its pointer lands on the right line", () => {
  const text = JSON.stringify(doc({ components: [{ id: "t", component: "Text", text: { path: "/greeting" }, tone: "loud" }], data: { greeting: "hi" } }), null, 2);
  const loaded = loadDocument(text)!;
  assert.ok(loaded.check.errors >= 1, JSON.stringify(loaded.check.issues));
  const issue = loaded.check.issues.find((i) => i.severity === "error")!;
  const { range, exact } = rangeForPointer(text, loaded.root, issue.at);
  assert.equal(exact, true);
  // ajv reports a bad prop against the component (its oneOf branch), so the range is the element's first line.
  const line = text.split("\n")[range.start.line];
  assert.ok(line.includes("loud") || line.trim() === "{", `${issue.at} → line ${range.start.line}: ${line}`);
  assert.equal(range.end.line, range.start.line);
});

test("a 'did you mean' for a path near a real one, from the validator or by edit distance", () => {
  const typo = loadDocument(JSON.stringify(doc({ components: [{ id: "t", component: "Text", text: { path: "/greting" } }], data: { greeting: "hi" } })))!;
  assert.equal(typo.check.warnings, 1);
  assert.match(typo.check.issues[0].message, /did you mean "\/greeting"\?/);
  const elsewhere = loadDocument(JSON.stringify(doc({ components: [{ id: "t", component: "Text", text: { path: "/greeting" } }], data: { user: { greeting: "hi" } } })))!;
  assert.match(elsewhere.check.issues[0].message, /did you mean "\/user\/greeting"\?/);
  assert.equal((elsewhere.check.issues[0].message.match(/did you mean/g) ?? []).length, 1);
  const far = loadDocument(JSON.stringify(doc({ components: [{ id: "t", component: "Text", text: { path: "/totalBalance" } }], data: { greeting: "hi" } })))!;
  assert.doesNotMatch(far.check.issues[0].message, /did you mean/);
});

test("Halden's authored screens load as intent files with pointers under /document", async () => {
  const text = await readFile(join(halden, "authored/screen.budgets.json"), "utf8");
  const loaded = loadDocument(text)!;
  assert.equal(loaded.classified.kind, "intent");
  assert.equal(loaded.classified.title, "Budgets");
  assert.equal(loaded.check.errors, 0);
  // The intent file carries no data, so every binding is a warning — and every one points at real JSON.
  for (const issue of loaded.check.issues) {
    const { exact } = rangeForPointer(text, loaded.root, loaded.classified.prefix + issue.at);
    assert.equal(exact, true, issue.at);
  }
});

test("discovery: documents and intent files, not data files or other JSON, grouped by folder", async () => {
  const dir = await mkdtemp(join(tmpdir(), "polyxd-vscode-"));
  await mkdir(join(dir, "screens"), { recursive: true });
  await mkdir(join(dir, "node_modules/x"), { recursive: true });
  await writeFile(join(dir, "screens/home.json"), JSON.stringify(doc()));
  await writeFile(join(dir, "screens/home.data.json"), JSON.stringify({ greeting: "hi" }));
  await writeFile(join(dir, "screens/settings.json"), JSON.stringify({ id: "i", document: doc({ components: [{ id: "t", component: "Text" }] }) }));
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: "x", components: [] }));
  await writeFile(join(dir, "broken.json"), "{ nope");
  await writeFile(join(dir, "node_modules/x/screen.json"), JSON.stringify(doc()));
  await writeFile(join(dir, "top.json"), JSON.stringify(doc({ data: { greeting: "x" } })));
  const found = await discoverDocuments(dir);
  // Entries in name order, folders recursed where they fall: what `polyxd dev` lists.
  assert.deepEqual(found.map((d) => d.file), ["screens/home.json", "screens/settings.json", "top.json"]);
  const home = found[0];
  assert.equal(home.dataFrom, "sibling");
  assert.equal(home.check.warnings, 0);
  assert.equal(found[1].kind, "intent");
  assert.ok(found[1].check.errors >= 1);
  assert.deepEqual(groupByFolder(found).map((g) => [g.folder, g.documents.length]), [["", 1], ["screens", 2]]);
  assert.equal(siblingDataPath("/a/b/home.json"), "/a/b/home.data.json");
});

test("discovery over the Halden demo finds its authored screens and intents", async () => {
  const found = await discoverDocuments(halden);
  const files = found.map((d) => d.file);
  assert.ok(files.includes("authored/screen.budgets.json"));
  assert.ok(files.includes("authored/shell.json"));
  assert.ok(files.includes("intents/money.send.json"));
  assert.ok(!files.includes("registry.json"));
  assert.ok(!files.includes("direction.json"));
});
