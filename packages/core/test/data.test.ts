import { test } from "node:test";
import assert from "node:assert/strict";
import { absolute, asList, childPointer, get, isBinding, itemScopes, resolve, resolveContext, resolveDeep, set, ROOT_SCOPE } from "../src/index.ts";

const data = { quote: { amount: 40, currency: "GBP" }, payees: [{ id: "p1", name: "Alex" }, { id: "p2", name: "Sam" }], "a/b": { "~": 1 } };

test("get reads JSON Pointers, including escaped segments and the root", () => {
  assert.equal(get(data, "/quote/amount"), 40);
  assert.equal(get(data, "/payees/1/name"), "Sam");
  assert.equal(get(data, "/a~1b/~0"), 1);
  assert.equal(get(data, ""), data);
  assert.equal(get(data, "/quote/missing/deeper"), undefined);
  assert.equal(get(null, "/x"), undefined);
});

test("set writes immutably and creates arrays for numeric keys", () => {
  const next = set(data, "/quote/amount", 50);
  assert.equal(next.quote && (next.quote as any).amount, 50);
  assert.equal((data.quote as any).amount, 40, "the original is untouched");
  assert.notEqual(next.payees, undefined);
  const made = set({}, "/draft/items/0/name", "x");
  assert.deepEqual(made, { draft: { items: [{ name: "x" }] } });
  const escaped = set({}, "/a~1b/~0", 2);
  assert.deepEqual(escaped, { "a/b": { "~": 2 } });
});

test("relative paths resolve in the item's scope; absolute ones ignore it", () => {
  const scope = { pointer: "/payees/1" };
  assert.equal(absolute("name", scope), "/payees/1/name");
  assert.equal(absolute("/quote/amount", scope), "/quote/amount");
  assert.equal(childPointer("/payees", 0), "/payees/0");
  assert.equal(childPointer("", "a/b"), "/a~1b");
  assert.equal(resolve({ path: "name" }, data, scope), "Sam");
  assert.equal(resolve("literal", data, scope), "literal");
  assert.equal(resolve({ path: "/quote/currency" }, data, ROOT_SCOPE), "GBP");
});

test("isBinding tells a binding from a literal object", () => {
  assert.ok(isBinding({ path: "/x" }));
  assert.ok(!isBinding({ value: 1 }));
  assert.ok(!isBinding(["/x"]));
  assert.ok(!isBinding(null));
});

test("contexts resolve every value; deep resolution reaches inside arrays and objects", () => {
  assert.deepEqual(resolveContext({ id: { path: "id" }, kind: "person" }, data, { pointer: "/payees/0" }), { id: "p1", kind: "person" });
  assert.deepEqual(resolveContext(undefined, data, ROOT_SCOPE), {});
  assert.deepEqual(resolveDeep({ who: { path: "/payees/0/name" }, list: [{ path: "/quote/amount" }, 1] }, data, ROOT_SCOPE), { who: "Alex", list: [40, 1] });
});

test("lists: a non-array is an empty list; item scopes follow the list's pointer", () => {
  assert.deepEqual(asList({ a: 1 }), []);
  assert.deepEqual(asList([1]), [1]);
  assert.deepEqual(itemScopes(data, "/payees", ROOT_SCOPE), [{ pointer: "/payees/0" }, { pointer: "/payees/1" }]);
  assert.deepEqual(itemScopes(data, "/quote", ROOT_SCOPE), []);
});
