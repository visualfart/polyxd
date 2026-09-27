import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { validateDocument } from "@polyxd/spec/browser";
import { checkDocument, issueIndex } from "../src/screens/validate.ts";
import { addChild, blankDocument, buildTree, duplicateNode, makeNodes, parentOf, removeNode, renameNode, reorder, visibleOrder } from "../src/screens/tree.ts";
import { COMPONENTS, skeleton, type Doc } from "../src/screens/schema.ts";

const examples = new URL("../../../packages/spec/examples/", import.meta.url);
const load = (name: string): Doc => JSON.parse(readFileSync(new URL(name, examples), "utf8"));
const send = () => load("money-send-form.json");

/** Every reference points at a component that exists, and no component is listed twice. */
const consistent = (doc: Doc) => {
  const ids = doc.components.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  const r = checkDocument(doc);
  assert.deepEqual(r.issues.filter((i) => /unknown component|already has parent|cycle/.test(i.message)), [], "references are intact");
  return r;
};

test("every spec example passes, and Studio's checker agrees with the spec's", () => {
  for (const file of readdirSync(examples).filter((f) => f.endsWith(".json"))) {
    const doc = load(file);
    const ours = checkDocument(doc);
    const theirs = validateDocument(doc);
    assert.equal(ours.valid, theirs.valid, `${file}: valid`);
    assert.ok(ours.valid, `${file}: ${ours.issues.map((i) => i.message).join("; ")}`);
    // The same bindings are flagged as reading nothing from the sample data.
    const missing = (r: { issues: { code?: string; at: string }[] }) => r.issues.filter((i) => i.code === "data:missing-path").map((i) => i.at).sort();
    assert.deepEqual(missing(ours), missing(theirs), `${file}: missing paths`);
  }
});

test("a binding at a missing path is a warning, or an error when asked", () => {
  const doc = send();
  doc.components[4].items[1].value = { path: "/quot/fee" };
  const r = checkDocument(doc);
  assert.ok(r.valid);
  const hit = r.issues.find((i) => i.code === "data:missing-path")!;
  assert.equal(hit.at, "/components/4/items/1/value/path");
  assert.match(hit.message, /did you mean "\/quote\/fee"/);
  assert.equal(issueIndex(hit.at), 4);
  // What an input writes needn't exist yet.
  const input = send();
  input.components[2].value = { path: "/draft/tip" };
  assert.ok(!checkDocument(input).issues.some((i) => i.code === "data:missing-path"));
  assert.equal(checkDocument(doc, { missingData: "error" }).valid, false);
});

test("a reference to a missing or wrong component is an error", () => {
  const doc = send();
  doc.components[0].children = ["recipient", "nowhere"];
  const r = checkDocument(doc);
  assert.equal(r.valid, false);
  assert.ok(r.issues.some((i) => i.at === "/components/0/children/1" && /unknown component "nowhere"/.test(i.message)));
  const wrong = send();
  wrong.components[0].aside = "amount";
  assert.ok(checkDocument(wrong).issues.some((i) => /Form\.aside must reference DetailList or Card or Group, not TextInput/.test(i.message)));
});

test("schema errors: unknown component, missing required prop, unknown prop, bad enum", () => {
  const doc = send();
  doc.components.push({ id: "x", component: "Widget" });
  assert.ok(checkDocument(doc).issues.some((i) => i.at === "/components/5/component" && /unknown component "Widget"/.test(i.message)));
  const noLabel = send();
  delete noLabel.components[2].label;
  assert.ok(checkDocument(noLabel).issues.some((i) => i.at === "/components/2" && /required property "label"/.test(i.message)));
  const extra = send();
  extra.components[2].colour = "red";
  assert.ok(checkDocument(extra).issues.some((i) => i.at === "/components/2/colour" && /unknown property/.test(i.message)));
  const badEnum = send();
  badEnum.components[2].kind = "money";
  assert.ok(checkDocument(badEnum).issues.some((i) => i.at === "/components/2/kind" && /one of/.test(i.message)));
  const twoPrimaries = send();
  twoPrimaries.components.push({ id: "go", component: "Action", label: "Go", emphasis: "primary", action: { event: { name: "go.now" } } });
  twoPrimaries.components[0].children.push("go");
  assert.ok(checkDocument(twoPrimaries).issues.some((i) => /more than one primary action/.test(i.message)));
});

test("a workspace rule runs and reports with its severity", () => {
  const r = checkDocument(send(), { rules: [{ name: "Never ask are you sure", severity: "warning", check: { check: "noLabelMatches", pattern: "are you sure" } }, { name: "Two inputs at most", severity: "error", check: { check: "maxInputsPerView", max: 2 } }] });
  assert.equal(r.valid, false);
  assert.deepEqual(r.issues.filter((i) => i.code === "rule").map((i) => i.severity), ["error"]);
});

test("a skeleton of every component is schema-valid once it has its children", () => {
  for (const component of COMPONENTS) {
    const doc = blankDocument("Test", "");
    const nodes = makeNodes(doc, component);
    const withNodes: Doc = { ...doc, components: [...doc.components, ...nodes] };
    withNodes.components[0].children = ["intro", nodes[0].id];
    const r = checkDocument(withNodes);
    // Missing sample data is expected (there is none); structure and schema must hold.
    const hard = r.issues.filter((i) => i.severity === "error" && !/primary action/.test(i.message));
    assert.deepEqual(hard, [], `${component}: ${hard.map((i) => `${i.at} ${i.message}`).join("; ")}`);
  }
  assert.equal(skeleton("Metric", "m").value.path, "/m");
});

test("tree: add, reorder, duplicate, rename and remove keep the flat list consistent", () => {
  let doc = send();
  const added = addChild(doc, "form", "children", "Text");
  doc = added.doc;
  assert.equal(added.id, "text");
  assert.deepEqual(doc.components[0].children, ["recipient", "amount", "reference", "fee-details", "text"]);
  consistent(doc);

  doc = reorder(doc, "form", "children", 4, 0);
  assert.equal(doc.components[0].children[0], "text");
  assert.deepEqual(visibleOrder(doc).slice(0, 2), ["form", "text"]);

  const dup = duplicateNode(doc, "amount")!;
  doc = dup.doc;
  assert.equal(dup.id, "amount-2");
  assert.deepEqual(doc.components[0].children, ["text", "recipient", "amount", "amount-2", "reference", "fee-details"]);
  assert.equal(parentOf(doc, "amount-2")?.slot.index, 3);
  consistent(doc);

  doc = renameNode(doc, "amount-2", "tip");
  assert.ok(doc.components.some((c) => c.id === "tip"));
  assert.ok(doc.components[0].children.includes("tip") && !doc.components[0].children.includes("amount-2"));

  doc = removeNode(doc, "tip");
  doc = removeNode(doc, "text");
  assert.deepEqual(doc.components[0].children, ["recipient", "amount", "reference", "fee-details"]);
  assert.equal(doc.components.length, 5);
  assert.equal(removeNode(doc, "form"), doc, "the root stays");
  consistent(doc);
});

test("tree: a Collection comes with its template, and removing it takes the subtree along", () => {
  const doc = blankDocument("List", "things.list");
  const { doc: withList, id } = addChild(doc, "root", "children", "Collection");
  const tree = buildTree(withList);
  const coll = tree.root!.children.find((c) => c.id === id)!;
  assert.equal(coll.children.length, 1);
  assert.equal(coll.children[0].slot?.kind, "template");
  const after = removeNode(withList, id);
  assert.equal(after.components.length, 2);
  consistent(after);
});
