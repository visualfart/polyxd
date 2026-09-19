/**
 * Assembles the per-component source files into:
 *  - schema/ui.schema.json   one self-contained JSON Schema for a UI document (validation + constrained decoding)
 *  - catalog/catalog.json    usage guidance, accessibility, rendering rules and platform mappings per component
 * Run with `npm run build:schema`. The test suite fails if the outputs are stale.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = async (p: string) => JSON.parse(await readFile(new URL(p, root), "utf8"));

export const SPEC_VERSION = "0.1.0";

interface ComponentSource {
  name: string;
  category: string;
  summary: string;
  props: Record<string, unknown>;
  required: string[];
  [meta: string]: unknown;
}

export async function loadComponentSources(): Promise<ComponentSource[]> {
  const files = (await readdir(new URL("components/", root))).filter((f) => f.endsWith(".json")).sort();
  return Promise.all(files.map((f) => read(`components/${f}`)));
}

export function buildUiSchema(common: Record<string, unknown>, components: ComponentSource[]) {
  const defs: Record<string, unknown> = { ...common };
  delete defs.$comment;
  for (const c of components) {
    defs[`Component${c.name}`] = {
      type: "object",
      description: c.summary,
      required: ["id", "component", ...c.required],
      properties: {
        id: { $ref: "#/$defs/Id" },
        component: { const: c.name },
        key: { $ref: "#/$defs/Key" },
        accessibility: { $ref: "#/$defs/Accessibility" },
        visible: { $ref: "#/$defs/DynamicBoolean", description: "Hide the component when false" },
        ...c.props,
      },
      additionalProperties: false,
    };
  }
  defs.Component = {
    type: "object",
    required: ["component"],
    discriminator: { propertyName: "component" },
    oneOf: components.map((c) => ({ $ref: `#/$defs/Component${c.name}` })),
  };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://polixd.dev/schema/0.1/ui.schema.json",
    title: "Polixd UI document",
    description:
      "A just-in-time interface: a flat list of semantic components (A2UI-style adjacency list) plus the surface it belongs to. Data comes from the host via bindings; actions are declared capability intents. Generated file: edit components/*.json and schema/common.defs.json instead.",
    type: "object",
    required: ["specVersion", "surface", "root", "components"],
    properties: {
      $schema: { type: "string" },
      specVersion: { type: "string", pattern: "^0\\.1\\.[0-9]+$" },
      surface: {
        type: "object",
        required: ["id", "title"],
        properties: {
          id: { $ref: "#/$defs/Id" },
          title: { type: "string", description: "Short title for the surface (page title / dialog title)" },
          intent: { $ref: "#/$defs/Key", description: "What the user is trying to do, as a stable key (e.g. 'money.send'); memory is organised by intent" },
          pattern: { type: "string", description: "Id of the pattern this surface follows, when one applies" },
          journey: { type: "string", description: "Id of the journey this surface is a step of, when one applies" },
          dismissible: { type: "boolean", default: true },
        },
        additionalProperties: false,
      },
      root: { $ref: "#/$defs/Id", description: "Id of the top-level component" },
      components: { type: "array", minItems: 1, items: { $ref: "#/$defs/Component" } },
      data: { type: "object", description: "Host data snapshot. Supplied by the host (or a test fixture), never by the model." },
    },
    additionalProperties: false,
    $defs: defs,
  };
}

export function buildCatalog(components: ComponentSource[]) {
  return {
    catalogId: "https://polixd.dev/catalog/0.1",
    specVersion: SPEC_VERSION,
    description: "Polixd semantic component catalog: when to use each component, accessibility and agent requirements, rendering rules and platform mappings. Generated file.",
    components: Object.fromEntries(components.map(({ name, props: _p, required: _r, ...meta }) => [name, meta])),
  };
}

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

export async function buildOutputs() {
  const [common, components] = await Promise.all([read("schema/common.defs.json"), loadComponentSources()]);
  return {
    "schema/ui.schema.json": json(buildUiSchema(common, components)),
    "catalog/catalog.json": json(buildCatalog(components)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [path, content] of Object.entries(await buildOutputs())) {
    await writeFile(new URL(path, root), content);
    console.log(`wrote ${path}`);
  }
}
