import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson, parseDocument } from "../src/index.ts";

const doc = '{"a":{"b":[1,2]}}';

test("bare JSON comes back as it is", () => {
  assert.equal(extractJson(doc), doc);
  assert.deepEqual(parseDocument(`  ${doc}\n`).document, { a: { b: [1, 2] } });
});

test("code fences are stripped, with or without a language, with prose around them", () => {
  assert.equal(extractJson("```json\n" + doc + "\n```"), doc);
  assert.equal(extractJson("```\n" + doc + "\n```"), doc);
  assert.equal(extractJson("Here it is:\n\n```JSON\n" + doc + "\n```\nHope that helps."), doc);
  assert.equal(extractJson("```json " + doc + "```"), doc);
});

test("the first fenced block that holds an object wins", () => {
  assert.equal(extractJson("```text\nnot this\n```\n```json\n" + doc + "\n```"), doc);
});

test("a fence that never closes, and prose with no fence", () => {
  assert.equal(extractJson("```json\n" + doc), doc);
  assert.equal(extractJson("Sure! " + doc + " Let me know."), doc);
});

test("what isn't one JSON object says why", () => {
  assert.match(parseDocument("").error!, /empty/);
  assert.match(parseDocument("no json here").error!, /not valid JSON/);
  assert.match(parseDocument('{"a":').error!, /not valid JSON/);
  assert.match(parseDocument("[1,2]").error!, /not one object/);
  assert.match(parseDocument("```json\n[1]\n```").error!, /not/);
});
