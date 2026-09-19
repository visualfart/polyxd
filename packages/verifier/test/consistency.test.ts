import { test } from "node:test";
import assert from "node:assert/strict";
import { compare } from "../src/consistency.ts";
import { load, byId } from "./helpers.ts";

const variant = (fn: (d: any) => void) => {
  const d = load("money-send-form");
  fn(d);
  return d;
};

test("a surface is fully consistent with itself", () => {
  const d = load("money-send-form");
  assert.equal(compare(d, d).score, 1);
});

test("relabelling, reordering, swapping components and changing pattern each lower the score", () => {
  const base = load("money-send-form");
  const relabelled = variant((d) => (byId(d, "amount").label = "How much?"));
  const reordered = variant((d) => (byId(d, "form").children = ["amount", "recipient", "reference", "fees"]));
  const swapped = variant((d) => Object.assign(byId(d, "recipient"), { component: "TextInput", options: undefined, kind: "text" }));
  const repatterned = variant((d) => (d.surface.pattern = "review-and-submit"));
  for (const [name, v] of Object.entries({ relabelled, reordered, swapped, repatterned })) {
    const c = compare(base, v);
    assert.ok(c.score < 1, `${name} should lower the score`);
    assert.ok(c.differences.length > 0, `${name} should explain itself`);
  }
  assert.match(compare(base, relabelled).differences.join("\n"), /"amount" relabelled: "Amount" → "How much\?"/);
  assert.match(compare(base, swapped).differences.join("\n"), /"recipient" changed from Choice to TextInput/);
});

test("scores rank variants the way a person would: small drift beats big drift", () => {
  const base = load("money-send-form");
  const one = variant((d) => (byId(d, "reference").label = "Note"));
  const two = variant((d) => {
    byId(d, "reference").label = "Note";
    byId(d, "form").children = ["amount", "recipient", "reference", "fees"];
  });
  const three = variant((d) => {
    byId(d, "reference").label = "Note";
    byId(d, "form").children = ["amount", "recipient", "reference", "fees"];
    d.surface.pattern = "review-and-submit";
    delete byId(d, "fee-details").items[1].key;
  });
  const s = [one, two, three].map((v) => compare(base, v).score);
  assert.ok(s[0] > s[1] && s[1] > s[2], `expected decreasing, got ${s}`);
});

test("a different surface for the same intent scores below small drift, but shares its keys", () => {
  const base = load("money-send-form");
  const drift = compare(base, variant((d) => (byId(d, "reference").label = "Note"))).score;
  const other = compare(base, load("money-send-confirm"));
  assert.ok(other.score < drift && other.score < 0.6, `got ${other.score}`);
  // Steps of one journey keep their keys, so memory can carry labels and order between them.
  assert.ok(other.parts.coverage >= 0.75);
});
