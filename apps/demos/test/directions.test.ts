import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";

// Every demo's Design Direction must fit the schema, or Studio won't import it and the runtime can't use it.
const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: false, discriminator: true });
ajv.addSchema(read("../../../packages/spec/schema/check.schema.json"));
const validate = ajv.compile(read("../../../packages/spec/schema/direction.schema.json"));

for (const product of ["halden", "foundry", "wexley", "quay"]) {
  test(`${product}'s direction.json fits the Direction schema`, () => {
    const ok = validate(read(`../${product}/direction.json`));
    assert.ok(ok, JSON.stringify(validate.errors, null, 2));
  });
}
