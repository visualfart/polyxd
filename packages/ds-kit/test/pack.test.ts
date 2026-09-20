import { test } from "node:test";
import assert from "node:assert/strict";
import { inferMapping } from "../src/infer.ts";

/** A small product's tokens: prefixed, unprefixed, and named nothing like ours. */
const ACME = {
  "--acme-bg": "#ffffff",
  "--acme-bg-subtle": "#f7f7f8",
  "--acme-surface-card": "#ffffff",
  "--acme-text": "#16181d",
  "--acme-text-muted": "#6b7280",
  "--acme-border": "#e4e4e7",
  "--primary": "#2563eb",
  "--primary-foreground": "#ffffff",
  "--destructive": "#dc2626",
  "--success": "#16a34a",
  "--success-bg": "#f0fdf4",
  "--radius-md": "8px",
  "--space-4": "16px",
};

test("a prefixed variable maps as well as a bare one", () => {
  const { mapping } = inferMapping(ACME);
  assert.equal(mapping.tokens["color.surface.default"], "acme-bg");
  assert.equal(mapping.tokens["color.text.default"], "acme-text");
  assert.equal(mapping.tokens["color.border.default"], "acme-border");
  assert.equal(mapping.tokens["color.action.primary.background"], "primary");
});

test("one variable can serve several tokens", () => {
  const { mapping } = inferMapping(ACME);
  assert.equal(mapping.tokens["radius.control"], "radius-md");
  assert.equal(mapping.tokens["radius.default"], "radius-md");
});

test("what one role implies about another is derived and marked as such", () => {
  const { guesses } = inferMapping(ACME);
  const positive = guesses.find((g) => g.token === "color.data.positive");
  assert.equal(positive?.how, "derived");
  assert.match(positive!.why, /success/);
});

test("a value of the wrong kind is never mapped", () => {
  const { mapping } = inferMapping({ "--primary": "16px", "--radius-md": "#ff0000" });
  assert.equal(mapping.tokens["color.action.primary.background"], undefined);
  assert.equal(mapping.tokens["radius.control"], undefined);
});

test("nothing is invented when there is nothing to read", () => {
  const { mapping } = inferMapping({});
  assert.deepEqual(mapping.tokens, {});
});
