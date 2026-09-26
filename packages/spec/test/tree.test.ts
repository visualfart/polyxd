import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { flattenTree, toTree, isTree } from "../src/tree.ts";
import { validateDocument } from "../src/validate.ts";

const dir = new URL("../examples/", import.meta.url);
const treeSchema = JSON.parse(readFileSync(new URL("../schema/ui-tree.schema.json", import.meta.url), "utf8"));
const validateTree = new Ajv2020({ strict: false, discriminator: true }).compile(treeSchema);

for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  test(`${f}: flat → tree → flat round-trips and stays valid`, () => {
    const flat = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    const tree = toTree(flat);
    assert.ok(isTree(tree));
    assert.ok(validateTree(tree), JSON.stringify(validateTree.errors?.slice(0, 3)));
    const back = flattenTree(tree);
    assert.deepEqual(validateDocument(back).issues, []);
    assert.equal(back.components.length, flat.components.length);
  });
}

test("a tree without ids gets unique ids from keys and component names", () => {
  const flat = flattenTree({
    specVersion: "0.2.0",
    surface: { id: "s", title: "T" },
    root: {
      component: "Group",
      children: [
        { component: "Text", text: "a" },
        { component: "Text", text: "b" },
        { component: "Metric", key: "balance", label: "Balance", value: { path: "/b" } },
      ],
    },
  });
  assert.deepEqual(flat.components.map((c: any) => c.id), ["group", "text", "text-2", "balance"]);
  assert.equal(flat.root, "group");
  assert.deepEqual(validateDocument(flat).issues.filter((i) => i.severity === "error"), []);
});

test("invalid or duplicate ids from a model are replaced, never trusted", () => {
  const flat = flattenTree({ specVersion: "0.2.0", surface: { id: "s", title: "T" }, root: { id: "x", component: "Group", children: [{ id: "x", component: "Text", text: "a" }, { id: "9bad", component: "Text", text: "b" }] } });
  assert.deepEqual(flat.components.map((c: any) => c.id), ["x", "x-2", "text"]);
});
