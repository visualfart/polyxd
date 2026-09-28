import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
const schema = JSON.parse(await readFile(new URL("../schema/design-system.schema.json", import.meta.url), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

test("every pack's manifest satisfies the design-system schema", async () => {
  const dirs = (await readdir(PACKAGES)).filter((d) => d.startsWith("ds-") && existsSync(join(PACKAGES, d, "manifest.json")));
  assert.ok(dirs.length > 0);
  for (const d of dirs) {
    const manifest = JSON.parse(await readFile(join(PACKAGES, d, "manifest.json"), "utf8"));
    const ok = validate(manifest);
    assert.ok(ok, `${d}/manifest.json: ${JSON.stringify(validate.errors)}`);
  }
});

test("a logo needs a file and where it came from", () => {
  const base = { name: "x", version: "0", contractVersion: "0.2.0", license: "MIT", modes: { light: ["a.json"] }, defaultMode: "light" };
  assert.ok(validate({ ...base, logo: { file: "logo.svg", source: "https://example.com/logo.svg", guidelines: "https://example.com/brand" } }));
  assert.ok(!validate({ ...base, logo: { file: "logo.svg" } }), "source is required");
  assert.ok(validate({ ...base, logo: { text: "GOV.UK Design System", note: "The crown is protected." } }), "words may stand in for a protected mark");
  assert.ok(!validate({ ...base, logo: { text: "GOV.UK Design System" } }), "and then the note says why");
  assert.ok(!validate({ ...base, logo: { file: "logo.gif", source: "Polyxd" } }), "SVG or PNG only");
  assert.ok(!validate({ ...base, logo: { file: "logo.svg", source: "Polyxd", colour: "#fff" } }), "no unknown fields");
});
