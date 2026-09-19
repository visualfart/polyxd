/**
 * Builds the Polyxd catalog in A2UI v1.0 catalog format from the Polyxd component sources
 * (@polyxd/spec components/*.json + schema/common.defs.json).
 *
 * A2UI catalog rules this follows (A2UI v1.0 protocol, "Catalog Schema Rules and Conventions"):
 *  - top-level keys limited to $schema, $id, protocolVersion, title, description, catalogId, instructions, components, functions, $defs
 *  - $defs holds only anyComponent / anyFunction; no shared helpers, so Polyxd helper types are inlined per prop
 *  - external $refs only to common_types.json ComponentId, ChildList, Dynamic*, AccessibilityAttributes, CheckRule, Checkable, Action
 *  - component ids use ComponentId, child lists and templates use ChildList (validators find links by these refs)
 *  - id / catalogId / accessibility / metadata are envelope-level (ComponentCommon) and are not redeclared
 */
import { readdirSync, readFileSync } from "node:fs";
import { EXTENSION_KEY, POLYXD_CATALOG_ID, type Json } from "./a2ui.ts";
import { REFERENCE_TYPES } from "@polyxd/spec";
import { MAPPING } from "./mapping.ts";

const COMMON = "common_types.json#/$defs/";

/** Polyxd defs that map one-to-one onto an A2UI common type. */
const DIRECT: Record<string, string> = {
  Id: "ComponentId",
  DynamicString: "DynamicString",
  DynamicNumber: "DynamicNumber",
  DynamicBoolean: "DynamicBoolean",
  DynamicValue: "DynamicValue",
  Accessibility: "AccessibilityAttributes",
  Action: "Action",
};

/**
 * A2UI `allowedChildren` for one component: emitted only when EVERY slot that can hold other
 * components is restricted to named types. Derived from the spec's REFERENCE_TYPES, so the two
 * can't drift apart (a component with a free-form `children` list stays unrestricted).
 */
function allowedChildren(c: ComponentSource): string[] | undefined {
  const refOf = (v: unknown) => {
    const ref = (v as Json)?.$ref;
    return typeof ref === "string" ? ref : undefined;
  };
  // A Template holds any component as its repeated item, so it leaves the component unrestricted.
  if (Object.values(c.props).some((v) => refOf(v)?.endsWith("/Template"))) return undefined;
  const slots = Object.entries(c.props)
    .filter(([, v]) => refOf(v)?.endsWith("/Id") || refOf(v)?.endsWith("/ChildList"))
    .map(([k]) => k);
  if (!slots.length) return undefined;
  const types = new Set<string>();
  for (const slot of slots) {
    const allowed = REFERENCE_TYPES[`${c.name}.${slot}`];
    if (!allowed) return undefined;
    for (const t of allowed) types.add(t);
  }
  return [...types].sort();
}

/** Renderer-handled Polyxd actions (`ui.*`), exported as A2UI local function calls. */
export const RENDERER_FUNCTIONS: Record<string, { fn: string; description: string }> = {
  "ui.dismiss": { fn: "dismiss", description: "Closes the surface without doing anything (Polyxd 'ui.dismiss')." },
  "ui.back": { fn: "back", description: "Returns to the previous step or surface (Polyxd 'ui.back')." },
  "ui.next": { fn: "next", description: "Advances to the next step (Polyxd 'ui.next')." },
};

interface ComponentSource {
  name: string;
  category: string;
  summary: string;
  props: Record<string, Json>;
  required: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  accessibility: { role: string; requirements: string[] };
  agent: string;
  rendering: string[];
  a2ui: string;
}

const specRoot = new URL("./", import.meta.resolve("@polyxd/spec/package.json"));
const readSpec = (p: string) => JSON.parse(readFileSync(new URL(p, specRoot), "utf8"));

export function loadPolyxdSources(): { common: Record<string, Json>; components: ComponentSource[] } {
  const files = readdirSync(new URL("components/", specRoot)).filter((f) => f.endsWith(".json")).sort();
  return { common: readSpec("schema/common.defs.json"), components: files.map((f) => readSpec(`components/${f}`)) };
}

/** Rewrites a Polyxd prop schema into an A2UI-catalog-compliant one (allowed $refs only, helpers inlined). */
function convert(schema: unknown, common: Record<string, Json>): any {
  if (Array.isArray(schema)) return schema.map((s) => convert(s, common));
  if (!schema || typeof schema !== "object") return schema;
  const s = schema as Json;
  if (typeof s.$ref === "string") {
    const name = s.$ref.replace("#/$defs/", "");
    const { $ref: _ref, ...siblings } = s;
    const extra = convert(siblings, common);
    if (name === "ChildList") {
      return { $ref: `${COMMON}ChildList`, type: "array", minItems: 1, description: common.ChildList.description, ...extra };
    }
    if (name === "Template") {
      return { $ref: `${COMMON}ChildList`, type: "object", description: common.Template.description, ...extra };
    }
    if (DIRECT[name]) return { $ref: `${COMMON}${DIRECT[name]}`, ...extra };
    const def = common[name];
    if (!def) throw new Error(`unknown Polyxd def ${name}`);
    return { ...convert(def, common), ...extra };
  }
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, k === "enum" || k === "const" || k === "default" ? v : convert(v, common)]));
}

const bullets = (items: string[]) => items.map((x) => `  - ${x}`).join("\n");

export function buildInstructions(components: ComponentSource[]): string {
  const head = `# Polyxd catalog for A2UI

Semantic components for just-in-time interfaces. The renderer maps each one onto its own native, design-system components and tokens. Pick components by meaning, not by look. Never send colours, sizes or fonts.

## Rules for every surface

1. The top-level component has \`"id": "root"\`. Children are referenced by id (flat adjacency list), never nested inline.
2. Data always comes from the host through JSON Pointer bindings \`{"path": "/..."}\`. Never invent data or pre-format numbers and dates into strings. Set \`format\` instead.
3. Inside a templated list (\`Collection.items\`), relative paths such as \`{"path": "title"}\` resolve against the current item. Absolute paths start with \`/\`.
4. Actions are declared capability intents: \`{"event": {"name": "transfer.confirm", "context": {...}}}\`. Use \`{"functionCall": {"call": "dismiss" | "back" | "next"}}\` for navigation the renderer handles itself.
5. At most one primary action is visible at a time. A Form's submit and a Steps finish count as primary.
6. Destructive or consequential actions go through \`Confirm\`.
7. Components carry their own roles and names. Use \`accessibility\` only to add to them.

## Components
`;
  const body = components.map((c) =>
    [
      `### ${c.name}`,
      "",
      c.summary,
      "",
      `- **Use when:**\n${bullets(c.whenToUse)}`,
      `- **Don't use when:**\n${bullets(c.whenNotToUse)}`,
      `- **Rendering:**\n${bullets(c.rendering)}`,
      `- **Accessibility** (role: ${c.accessibility.role}):\n${bullets(c.accessibility.requirements)}`,
      `- **Agents:** ${c.agent}`,
    ].join("\n"),
  );
  return head + "\n" + body.join("\n\n") + "\n";
}

export function buildCatalog(): Json {
  const { common, components } = loadPolyxdSources();
  const defs: Json = {};
  for (const c of components) {
    const decision = MAPPING[c.name];
    if (!decision) throw new Error(`no A2UI mapping decision for ${c.name} (add it to src/mapping.ts)`);
    const props: Json = {
      component: { const: c.name },
      visible: { $ref: `${COMMON}DynamicBoolean`, description: "Hide the component when false" },
    };
    for (const [k, v] of Object.entries(c.props)) props[k] = convert(v, common);
    defs[c.name] = {
      type: "object",
      description: c.summary,
      properties: props,
      required: ["component", ...c.required],
      ...(allowedChildren(c) ? { allowedChildren: allowedChildren(c) } : {}),
      metadata: {
        extensions: {
          [EXTENSION_KEY]: { category: c.category, target: decision.target, basicAnalog: decision.basicAnalog, why: decision.why },
        },
      },
    };
  }
  const functions: Json = {};
  for (const { fn, description } of Object.values(RENDERER_FUNCTIONS)) {
    functions[fn] = {
      type: "object",
      description,
      returnType: "void",
      allowedCallers: "rendererOnly",
      properties: { call: { const: fn } },
      required: ["call"],
    };
  }
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: POLYXD_CATALOG_ID,
    protocolVersion: "1.0",
    title: "Polyxd catalog",
    description:
      "Polyxd semantic components as an A2UI v1.0 catalog. Every component is a faithful projection of the Polyxd component with the same name and props. Generated from @polyxd/spec components/*.json by @polyxd/a2ui (npm run build:catalog).",
    catalogId: POLYXD_CATALOG_ID,
    instructions: buildInstructions(components),
    components: defs,
    functions,
    $defs: {
      anyComponent: {
        oneOf: components.map((c) => ({ $ref: `#/components/${c.name}` })),
        discriminator: { propertyName: "component" },
      },
      anyFunction: { oneOf: Object.keys(functions).map((f) => ({ $ref: `#/functions/${f}` })) },
    },
  };
}

export const catalogJson = () => JSON.stringify(buildCatalog(), null, 2) + "\n";

export const CATALOG_FILE = new URL("../catalog/catalog.json", import.meta.url);

/** The committed catalog (catalog/catalog.json). */
export const loadPolyxdCatalog = (): Json => JSON.parse(readFileSync(CATALOG_FILE, "utf8"));
