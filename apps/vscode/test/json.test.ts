import assert from "node:assert/strict";
import { test } from "node:test";
import { nodeAtOffset, nodeAtPointer, parseJson, positions, rangeForPointer } from "../src/json.ts";

const text = `{
  "specVersion": "0.3.0",
  "root": "page",
  "components": [
    { "id": "page", "component": "Group", "children": ["t"] },
    {
      "id": "t",
      "component": "Text",
      "text": { "path": "/greeting" }
    }
  ]
}
`;

test("parses to the same value as JSON.parse, with offsets", () => {
  const r = parseJson(text);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.value, JSON.parse(text));
  assert.equal(r.root!.offset, 0);
  assert.equal(r.root!.length, text.trimEnd().length);
  const components = r.root!.children!.find((c) => c.key === "components")!;
  assert.equal(components.type, "array");
  assert.equal(components.children!.length, 2);
  assert.equal(text.slice(components.keyOffset, components.keyOffset! + components.keyLength!), '"components"');
});

test("a pointer finds its node, or the nearest ancestor", () => {
  const r = parseJson(text);
  const { node, exact } = nodeAtPointer(r.root!, "/components/1/text/path");
  assert.equal(exact, true);
  assert.equal(node.value, "/greeting");
  const miss = nodeAtPointer(r.root!, "/components/1/label");
  assert.equal(miss.exact, false);
  assert.equal(miss.node.key, undefined);
  assert.equal(miss.node.type, "object");
  assert.equal(nodeAtPointer(r.root!, "/").node, r.root);
});

test("an offset maps back to the deepest pointer", () => {
  const r = parseJson(text);
  const at = text.indexOf('"/greeting"') + 3;
  assert.equal(nodeAtOffset(r.root!, at).pointer, "/components/1/text/path");
  // On a key, the member it names.
  assert.equal(nodeAtOffset(r.root!, text.indexOf('"component": "Text"') + 2).pointer, "/components/1/component");
  assert.equal(nodeAtOffset(r.root!, 1).pointer, "");
});

test("ranges: scalars whole, containers by key, root by first line", () => {
  const r = parseJson(text);
  const pos = positions(text);
  const scalar = rangeForPointer(text, r.root!, "/components/1/text/path").range;
  assert.deepEqual(scalar.start, pos(text.indexOf('"/greeting"')));
  const container = rangeForPointer(text, r.root!, "/components/1/text").range;
  assert.equal(container.start.line, 8);
  assert.equal(container.end.character - container.start.character, '"text"'.length);
  const element = rangeForPointer(text, r.root!, "/components/0").range;
  assert.equal(element.start.line, 4);
  assert.equal(element.end.line, 4);
  const root = rangeForPointer(text, r.root!, "/").range;
  assert.deepEqual(root, { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } });
});

test("positions are lines and UTF-16 columns", () => {
  const pos = positions("ab\ncd\n\nef");
  assert.deepEqual(pos(0), { line: 0, character: 0 });
  assert.deepEqual(pos(3), { line: 1, character: 0 });
  assert.deepEqual(pos(4), { line: 1, character: 1 });
  assert.deepEqual(pos(6), { line: 2, character: 0 });
  assert.deepEqual(pos(8), { line: 3, character: 1 });
});

test("tolerates comments and trailing commas, reports the first real error", () => {
  const ok = parseJson(`{ // a\n "a": [1, 2,], /* b */ "b": true, }`);
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.value, { a: [1, 2], b: true });
  const bad = parseJson(`{ "a": [1, 2 "x"] }`);
  assert.ok(bad.error);
  assert.equal(bad.error!.offset, 13);
  const unterminated = parseJson(`{ "a": "oops\n}`);
  assert.equal(unterminated.error!.message, "unterminated string");
  assert.deepEqual(parseJson(`"\\u00e9\\n"`).value, "é\n");
});
