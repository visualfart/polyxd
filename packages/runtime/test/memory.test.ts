import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStore, storageStore, type StorageLike } from "../src/index.ts";
import { confirmDoc } from "./helpers.ts";

/** A stand-in for `localStorage`. */
function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

test("the in-memory store keeps a copy per intent", async () => {
  const store = memoryStore();
  const doc = confirmDoc();
  await store.set("money.send", doc);
  doc.surface.title = "changed after storing";
  assert.deepEqual(await store.get("money.send"), confirmDoc(), "a copy, not a reference");
  assert.equal(await store.get("money.request"), undefined);
  await store.delete("money.send");
  assert.equal(await store.get("money.send"), undefined);
});

test("the storage store writes JSON under a prefix", async () => {
  const storage = fakeStorage();
  const store = storageStore(storage);
  await store.set("money.send", confirmDoc());
  assert.deepEqual([...storage.map.keys()], ["polyxd:memory:money.send"]);
  assert.deepEqual(await storageStore(storage).get("money.send"), confirmDoc(), "a new store on the same storage reads it back");
  await store.delete("money.send");
  assert.equal(storage.map.size, 0);
});

test("the storage store takes its own prefix and reads a corrupt entry as nothing", async () => {
  const storage = fakeStorage();
  const store = storageStore(storage, { prefix: "halden:" });
  storage.setItem("halden:a", "{not json");
  storage.setItem("halden:b", "[1,2]");
  assert.equal(await store.get("a"), undefined);
  assert.equal(await store.get("b"), undefined);
  await store.set("c", confirmDoc());
  assert.ok(storage.map.has("halden:c"));
});
