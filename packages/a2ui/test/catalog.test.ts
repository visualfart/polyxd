import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { a2uiSchemas, catalogJson, CATALOG_FILE, createValidator, loadPolyxdCatalog, MAPPING, POLYXD_CATALOG_ID } from "../src/index.ts";
import { loadPolyxdSources } from "../src/catalog.ts";

const catalog = loadPolyxdCatalog();
const validator = createValidator();
const { components: sources } = loadPolyxdSources();

test("catalog/catalog.json is up to date (run npm run build:catalog)", () => {
  assert.equal(readFileSync(CATALOG_FILE, "utf8"), catalogJson());
});

test("Polyxd catalog validates against the official A2UI catalog_definition.json", () => {
  assert.deepEqual(validator.catalogDefinition(catalog), []);
});

test("sanity: the official Basic catalog validates against catalog_definition.json, a broken catalog does not", () => {
  assert.deepEqual(validator.catalogDefinition(a2uiSchemas.basicCatalog()), []);
  assert.notDeepEqual(validator.catalogDefinition({ ...catalog, theme: {} }), []);
  assert.notDeepEqual(validator.catalogDefinition({ ...catalog, components: { Surface: { type: "object" } } }), []);
});

test("catalog id, protocol version and $id", () => {
  assert.equal(catalog.catalogId, POLYXD_CATALOG_ID);
  assert.equal(catalog.$id, POLYXD_CATALOG_ID);
  assert.equal(catalog.protocolVersion, "1.0");
});

test("every Polyxd component is in the catalog, with a recorded mapping decision", () => {
  const names = sources.map((c) => c.name);
  assert.equal(names.length, 44);
  assert.deepEqual(Object.keys(catalog.components).sort(), [...names].sort());
  assert.deepEqual(Object.keys(MAPPING).sort(), [...names].sort());
  for (const n of names) {
    assert.equal(catalog.components[n].properties.component.const, n);
    assert.ok(catalog.components[n].required.includes("component"));
    for (const p of sources.find((s) => s.name === n)!.required) assert.ok(catalog.components[n].required.includes(p), `${n}.${p} required`);
  }
});

test("instructions carry whenToUse / whenNotToUse / rendering for every component a generator may use", () => {
  for (const c of sources.filter((c) => !c.shell)) {
    assert.ok(catalog.instructions.includes(`### ${c.name}`), c.name);
    for (const line of [...c.whenToUse, ...c.whenNotToUse, ...c.rendering]) assert.ok(catalog.instructions.includes(line), `${c.name}: ${line}`);
  }
});

test("the shell components are in the catalog and out of the generator's instructions", () => {
  const shell = sources.filter((c) => c.shell).map((c) => c.name);
  assert.deepEqual(shell.sort(), ["AppBar", "Custom", "Footer", "Frame", "Outlet"]);
  for (const n of shell) {
    assert.ok(catalog.components[n], `${n} is in the catalog`);
    assert.ok(!catalog.instructions.includes(`### ${n}`), `${n} is not described to the generator`);
  }
  assert.match(catalog.instructions, /Never use AppBar, Custom, Footer, Frame or Outlet: the product's shell is authored/);
  assert.equal(MAPPING.Columns.target, "basic");
  assert.equal(catalog.components.Frame.metadata.extensions.com_polyxd.target, "custom");
});

test("catalog follows A2UI v1.0 schema rules (keys, $defs, $ref targets, discriminator, UAX #31 names)", () => {
  const TOP = ["$schema", "$id", "protocolVersion", "title", "description", "catalogId", "instructions", "components", "functions", "$defs"];
  for (const k of Object.keys(catalog)) assert.ok(TOP.includes(k), `top-level key ${k}`);
  assert.deepEqual(Object.keys(catalog.$defs).sort(), ["anyComponent", "anyFunction"]);

  const ALLOWED_REFS = ["ComponentId", "ChildList", "DynamicString", "DynamicNumber", "DynamicBoolean", "DynamicStringList", "DynamicValue", "AccessibilityAttributes", "CheckRule", "Checkable", "Action"];
  const uax31 = /^[\p{XID_Start}_][\p{XID_Continue}]*$/u;
  const walk = (s: unknown, at: string) => {
    if (Array.isArray(s)) return s.forEach((x, i) => walk(x, `${at}/${i}`));
    if (!s || typeof s !== "object") return;
    for (const [k, v] of Object.entries(s)) {
      if (k === "$ref") {
        const ok = /^#\/(components|functions)\/[^/]+$/.test(v as string) || ALLOWED_REFS.some((r) => v === `common_types.json#/$defs/${r}`);
        assert.ok(ok, `${at}: $ref ${v} is not an allowed target`);
      }
      if (k === "properties") for (const name of Object.keys(v as object)) assert.match(name, uax31, `${at}: property ${name}`);
      if (k !== "enum" && k !== "const" && k !== "default") walk(v, `${at}/${k}`);
    }
  };
  walk(catalog, "");
  for (const n of [...Object.keys(catalog.components), ...Object.keys(catalog.functions)]) assert.match(n, uax31);
  assert.deepEqual(
    catalog.$defs.anyComponent.oneOf.map((r: { $ref: string }) => r.$ref),
    Object.keys(catalog.components).map((n) => `#/components/${n}`),
  );
  // Envelope-level fields must not be redeclared by catalog components.
  for (const [n, def] of Object.entries<any>(catalog.components)) {
    for (const p of ["id", "catalogId", "accessibility", "metadata"]) assert.ok(!(p in def.properties), `${n} redeclares ${p}`);
    assert.ok(!("additionalProperties" in def), `${n}: unknown props are rejected by the envelope's unevaluatedProperties`);
  }
});

test("component references use ComponentId / ChildList so A2UI validators see the links", () => {
  const c = catalog.components;
  assert.equal(c.Group.properties.children.$ref, "common_types.json#/$defs/ChildList");
  assert.equal(c.Collection.properties.items.$ref, "common_types.json#/$defs/ChildList");
  assert.equal(c.Collection.properties.empty.$ref, "common_types.json#/$defs/ComponentId");
  assert.equal(c.Card.properties.media.$ref, "common_types.json#/$defs/ComponentId");
  assert.equal(c.Views.properties.views.items.properties.content.$ref, "common_types.json#/$defs/ComponentId");
  assert.equal(c.Steps.properties.steps.items.properties.content.$ref, "common_types.json#/$defs/ComponentId");
  assert.equal(c.Action.properties.action.$ref, "common_types.json#/$defs/Action");
  assert.deepEqual(c.ActionBar.allowedChildren, ["Action"]);
});
