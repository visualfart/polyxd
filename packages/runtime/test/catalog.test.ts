import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { directionRules as specDirectionRules } from "@polyxd/spec";
import { catalogSource } from "../scripts/build-catalog.ts";
import { directionRules } from "../src/direction.ts";
import { calmFinance, halden, playfulPersonal } from "./helpers.ts";

test("the catalog is up to date with the spec (npm run build:catalog -w @polyxd/runtime)", async () => {
  const committed = readFileSync(new URL("../src/catalog.generated.ts", import.meta.url), "utf8");
  assert.equal(committed, await catalogSource());
});

test("the browser-safe Direction rules match the spec's directionRules", () => {
  for (const d of [calmFinance(), playfulPersonal(), halden(), { name: "empty" }]) assert.deepEqual(directionRules(d as any), specDirectionRules(d), (d as any).name);
  assert.deepEqual(directionRules(undefined), []);
});
