import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePack } from "../src/server.ts";
import { PACKS } from "../src/packs.generated.ts";

test("every pack id resolves to itself", () => {
  for (const p of PACKS) assert.equal(resolvePack(p.name)?.name, p.name, p.name);
});

test("the names people write reach the right pack", () => {
  const cases: [string, string][] = [
    ["Carbon", "carbon"], ["IBM Carbon", "carbon"], ["carbon", "carbon"],
    ["shadcn", "shadcn"], ["shadcn/ui", "shadcn"], ["Shadcn UI", "shadcn"],
    ["Material 3", "material3"], ["Material", "material3"], ["material3", "material3"],
    ["GOV.UK", "govuk"], ["GOV.UK Frontend", "govuk"], ["Ant Design", "antd"], ["antd", "antd"],
    ["Fluent", "fluent"], ["Microsoft Fluent 2", "fluent"], ["Polaris", "polaris"], ["Shopify Polaris", "polaris"],
    ["Primer", "primer"], ["GitHub Primer", "primer"], ["Spectrum", "spectrum"], ["Adobe Spectrum 2", "spectrum"],
    ["Bootstrap", "bootstrap"], ["Chakra UI", "chakra"], ["Radix", "radix"], ["Mantine", "mantine"], ["Editorial", "editorial"],
  ];
  for (const [input, id] of cases) assert.equal(resolvePack(input)?.name, id, input);
});

test("names that aren't a pack don't resolve, so nothing falls back to the default", () => {
  for (const input of ["Tailwind UI", "Tailwind", "Apple HIG", "Bootstrap 4", "bootstrap4", "", "ui"]) assert.equal(resolvePack(input), undefined, input);
});
