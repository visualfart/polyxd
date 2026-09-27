import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDocument } from "@polyxd/spec/browser";
import { parseJson } from "../src/json.ts";
import { COMPONENTS, categoryOf, idFor, insertionPoint, skeleton, summaryOf, toSnippet } from "../src/skeleton.ts";

const SHELL = new Set(["Frame", "AppBar", "Footer", "Outlet", "Custom"]);

test("44 components, each with a category and a summary", () => {
  assert.equal(COMPONENTS.length, 44);
  for (const c of COMPONENTS) {
    assert.ok(summaryOf(c), c);
    assert.notEqual(categoryOf(c), "other", c);
  }
});

test("ids come from the name and stay unique", () => {
  assert.equal(idFor("Action", []), "action");
  assert.equal(idFor("ActionBar", ["action_bar"]), "action_bar_2");
  assert.equal(idFor("TextInput", ["text_input", "text_input_2"]), "text_input_3");
});

test("every component's skeleton is a structurally valid document", () => {
  const failures: string[] = [];
  for (const c of COMPONENTS) {
    const sk = skeleton(c, ["existing"]);
    assert.equal(sk.nodes[0].component, c);
    assert.equal(sk.nodes[0].id, idFor(c, []));
    const shell = SHELL.has(c);
    const doc = {
      specVersion: "0.3.0",
      surface: { id: "s", title: "S", ...(shell ? { kind: "shell", origin: "authored" } : {}) },
      root: shell && c !== "Frame" ? "frame" : sk.nodes[0].id,
      components: shell && c !== "Frame" ? [...skeleton("Frame", sk.nodes.map((n) => n.id)).nodes, ...sk.nodes] : sk.nodes,
    };
    // Frame's own skeleton already carries the regions; the other shell parts get a Frame to sit in.
    const errors = validateDocument(doc, { missingData: "warning" }).issues.filter((i) => i.severity === "error" && i.code !== "shell:structure");
    if (errors.length) failures.push(`${c}: ${errors.map((e) => `${e.at} ${e.message}`).join("; ")}`);
  }
  assert.deepEqual(failures, []);
});

test("a Collection brings the template child it needs; a Form an input", () => {
  const col = skeleton("Collection", []);
  assert.equal(col.nodes.length, 2);
  assert.equal(col.nodes[0].items.componentId, col.nodes[1].id);
  assert.ok(col.placeholders.includes("0/items/path"));
  assert.ok(col.placeholders.includes("0/label"));
  const form = skeleton("Form", []);
  assert.equal(form.nodes[1].component, "TextInput");
});

test("the snippet has a tab stop per placeholder and escapes snippet syntax", () => {
  const sk = skeleton("Action", []);
  const s = toSnippet(sk, "  ", "    ");
  assert.match(s, /"label": "\$\{\d+:Label\}"/);
  assert.match(s, /"name": "\$\{\d+:action\.press\}"/);
  assert.ok(s.startsWith("{\n      \"id\": \"action\""), s);
  assert.ok(s.endsWith("\n    }"), s);
  const custom = toSnippet({ nodes: [{ id: "x", component: "Text", text: "costs $5 {really}" }], placeholders: ["0/text"] }, "  ", "");
  assert.ok(custom.includes('"text": "${1:costs \\$5 {really\\}}"'), custom);
});

const file = `{
  "specVersion": "0.3.0",
  "root": "a",
  "components": [
    { "id": "a", "component": "Text", "text": "A" },
    { "id": "b", "component": "Text", "text": "B" }
  ]
}`;

test("insertion: after the element under the cursor, at a gap, or at the end", () => {
  const root = parseJson(file).root!;
  const inA = insertionPoint(file, root, "/components", file.indexOf('"text": "A"'))!;
  assert.equal(file.slice(inA.offset - 1, inA.offset), "}");
  assert.equal(inA.before, ",\n    ");
  assert.equal(inA.after, "");
  assert.equal(inA.base, "    ");
  assert.equal(inA.indent, "  ");
  const outside = insertionPoint(file, root, "/components", 5)!;
  assert.equal(outside.offset, file.lastIndexOf("}", file.lastIndexOf("]")) + 1);
  const gap = insertionPoint(file, root, "/components", file.indexOf("\n", file.indexOf('"text": "A"')))!;
  assert.equal(gap.offset, inA.offset);
  const atFirst = insertionPoint(file, root, "/components", file.indexOf("[") + 1)!;
  assert.equal(atFirst.offset, file.indexOf('{ "id": "a"'));
  assert.equal(atFirst.after, ",\n    ");
  const empty = `{"components": []}`;
  const e = insertionPoint(empty, parseJson(empty).root!, "/components", 0)!;
  assert.equal(e.offset, empty.indexOf("[") + 1);
  assert.equal(e.before, "\n  ");
  assert.equal(e.after, "\n");
  assert.equal(insertionPoint(file, root, "/nope", 0), undefined);
});
