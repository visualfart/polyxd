import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio } from "../src/color.ts";
import { flatten, resolveAliases, checkContract, loadContract } from "../src/tokens.ts";

test("contrast ratio matches WCAG reference values", () => {
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(1), "21.0");
  assert.equal(contrastRatio("#777777", "#ffffff").toFixed(2), "4.48");
  assert.equal(contrastRatio({ colorSpace: "srgb", components: [1, 1, 1] }, "#ffffff"), 1);
});

test("flatten inherits group $type and resolves aliases, including inside composites", () => {
  const raw = flatten({
    blue: { $type: "color", 600: { $value: "#2563eb" } },
    color: { action: { primary: { background: { $value: "{blue.600}" } } } },
    type: { body: { $type: "typography", $value: { fontFamily: "Inter", fontSize: "{base.size}", fontWeight: 400, lineHeight: 1.5 } } },
    base: { size: { $type: "dimension", $value: { value: 16, unit: "px" } } },
  });
  const set = resolveAliases(raw);
  assert.deepEqual(set.get("color.action.primary.background"), { type: "color", value: "#2563eb" });
  assert.deepEqual((set.get("type.body") as { value: { fontSize: unknown } }).value.fontSize, { value: 16, unit: "px" });
});

test("circular aliases are reported", () => {
  assert.throws(() => resolveAliases(flatten({ a: { $value: "{b}" }, b: { $value: "{a}" } })), /Circular/);
});

test("contract check reports missing tokens, low contrast and constraint violations", async () => {
  const contract = await loadContract();
  const set = resolveAliases(flatten({
    color: {
      $type: "color",
      text: { default: { $value: "#aaaaaa" } },
      surface: { default: { $value: "#ffffff" } },
    },
    type: { body: { default: { $type: "typography", $value: { fontFamily: "x", fontSize: { value: 14, unit: "px" }, fontWeight: 400, lineHeight: 1.4 } } } },
  }));
  const issues = checkContract(set, contract);
  const text = issues.map((i) => `${i.token}: ${i.message}`).join("\n");
  assert.match(text, /color\.surface\.raised: missing/);
  assert.match(text, /color\.text\.default: contrast 2\.32:1 against color\.surface\.default/);
  assert.match(text, /type\.body\.default: 14 is below the minimum 16/);
});
