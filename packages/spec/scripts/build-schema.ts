/**
 * Assembles the per-component source files into:
 *  - schema/ui.schema.json   one self-contained JSON Schema for a UI document (validation + constrained decoding)
 *  - catalog/catalog.json    usage guidance, accessibility, rendering rules and platform mappings per component
 *  - docs/components.md      the same, as a readable reference with the platform mapping table
 *  - schema/ui-tree.schema.json  the model's authoring format: the same document, with child components
 *                            written inline instead of referenced by id (compiled to the flat form by src/tree.ts)
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
    $id: "https://polyxd.com/schema/0.1/ui.schema.json",
    title: "Polyxd UI document",
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
    catalogId: "https://polyxd.com/catalog/0.1",
    specVersion: SPEC_VERSION,
    description: "Polyxd semantic component catalog: when to use each component, accessibility and agent requirements, rendering rules and platform mappings. Generated file.",
    components: Object.fromEntries(components.map(({ name, props: _p, required: _r, ...meta }) => [name, meta])),
  };
}

const cell = (s: unknown) => String(s).replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildComponentDocs(components: ComponentSource[]) {
  const order = ["structure", "content", "feedback", "input", "action", "flow"];
  const sorted = [...components].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
  const m = (c: ComponentSource) => c.mappings as Record<string, string>;
  const list = (items: unknown) => (items as string[]).map((x) => `- ${x}`).join("\n");
  const lines = [
    "# Polyxd components",
    "",
    `Generated from \`components/*.json\` (spec ${SPEC_VERSION}). The model chooses these semantic components; each platform renders them with its own native parts.`,
    "",
    "## Platform mapping",
    "",
    "| Component | Category | Web (shadcn/Radix) | iOS (SwiftUI) | Android (Compose M3) | A2UI |",
    "|---|---|---|---|---|---|",
    ...sorted.map((c) => `| [${c.name}](#${c.name.toLowerCase()}) | ${c.category} | ${cell(m(c).web)} | ${cell(m(c).ios)} | ${cell(m(c).android)} | ${cell(c.a2ui)} |`),
  ];
  for (const c of sorted) {
    const a11y = c.accessibility as { role: string; requirements: string[] };
    lines.push(
      "",
      `## ${c.name}`,
      "",
      c.summary,
      "",
      `**Required props:** ${c.required.map((r) => `\`${r}\``).join(", ")}. **Optional:** ${Object.keys(c.props).filter((p) => !c.required.includes(p)).map((p) => `\`${p}\``).join(", ") || "none"}.`,
      "",
      "**Use when**",
      list(c.whenToUse),
      "",
      "**Don't use when**",
      list(c.whenNotToUse),
      "",
      `**Accessibility** (role: ${a11y.role})`,
      list(a11y.requirements),
      "",
      `**Agents:** ${c.agent}`,
      "",
      "**Rendering rules**",
      list(c.rendering),
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * The authoring ("tree") schema: identical components, but every component reference (children lists,
 * single references, templates, view/step content) holds the child component itself, and ids are optional.
 * Small models write nested trees reliably and flat id tables poorly; see research/report.md.
 */
export function buildTreeSchema(flat: any) {
  const defs: Record<string, any> = structuredClone(flat.$defs);
  const node = { $ref: "#/$defs/Node" };
  const replace = (s: any, isComponentId = false): any => {
    if (!s || typeof s !== "object") return s;
    if (Array.isArray(s)) return s.map((x) => replace(x));
    if (s.$ref === "#/$defs/ChildList") return { type: "array", minItems: 1, items: node, ...(s.description ? { description: s.description } : {}) };
    if (s.$ref === "#/$defs/Template")
      return { type: "object", required: ["path", "item"], properties: { path: { $ref: "#/$defs/Path" }, item: node }, additionalProperties: false, description: "Array in host data to repeat over, and the component rendered for each item" };
    if (s.$ref === "#/$defs/Id" && !isComponentId) return { ...node, ...(s.description ? { description: s.description } : {}) };
    return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, replace(v)]));
  };
  for (const [name, d] of Object.entries(defs)) {
    if (!name.startsWith("Component") || name === "Component") continue;
    const { id, ...props } = d.properties;
    defs[name] = { ...d, required: d.required.filter((r: string) => r !== "id"), properties: { id: replace(id, true), ...Object.fromEntries(Object.entries(props).map(([k, v]) => [k, replace(v)])) } };
  }
  const { Component, ...rest } = defs;
  return {
    $schema: flat.$schema,
    $id: "https://polyxd.com/schema/0.1/ui-tree.schema.json",
    title: "Polyxd UI document (tree authoring form)",
    description: "The same document as ui.schema.json, with child components written inline. Generated; compile with flattenTree().",
    type: "object",
    required: ["specVersion", "surface", "root"],
    properties: { $schema: flat.properties.$schema, specVersion: flat.properties.specVersion, surface: flat.properties.surface, root: node, data: flat.properties.data },
    additionalProperties: false,
    $defs: { ...rest, Node: { ...Component } },
  };
}

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

export async function buildOutputs() {
  const [common, components] = await Promise.all([read("schema/common.defs.json"), loadComponentSources()]);
  return {
    "schema/ui.schema.json": json(buildUiSchema(common, components)),
    "schema/ui-tree.schema.json": json(buildTreeSchema(buildUiSchema(common, components))),
    "catalog/catalog.json": json(buildCatalog(components)),
    "docs/components.md": buildComponentDocs(components),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [path, content] of Object.entries(await buildOutputs())) {
    await writeFile(new URL(path, root), content);
    console.log(`wrote ${path}`);
  }
}
