/**
 * The Polyxd MCP server. The host's model is the generator: these tools give it the spec, check
 * what it wrote, and show the result to the user as an MCP App (SEP-1865, `io.modelcontextprotocol/ui`).
 */
import { readFileSync, existsSync } from "node:fs";
import { McpServer, fromJsonSchema, type CallToolResult } from "@modelcontextprotocol/server";
import { formatValidation, formatVerify, validate, verify, withData } from "./check.ts";
import { guide, SPEC_VERSION } from "./prompt.ts";
import { PACKS } from "./packs.generated.ts";
import { componentDefinitions, componentNamed, exampleDirections, exampleDocuments } from "./spec.ts";

export const VERSION = "0.3.0";
/** The MCP App resource every shown screen renders in. */
export const VIEW_URI = "ui://polyxd/surface.html";
/** MCP Apps' HTML profile. */
export const VIEW_MIME_TYPE = "text/html;profile=mcp-app";
export const DEFAULT_PACK = "material3";

const VIEW_FILE = new URL("../dist/view.html", import.meta.url);
let viewHtml: string | undefined;
/** The self-contained page (renderer, every pack's CSS, the MCP Apps bridge) built by scripts/build-view.ts. */
export function viewHTML(): string {
  if (viewHtml) return viewHtml;
  if (!existsSync(VIEW_FILE)) throw new Error("dist/view.html is missing: run `npm run build -w @polyxd/mcp`");
  return (viewHtml = readFileSync(VIEW_FILE, "utf8"));
}

const text = (t: string): CallToolResult["content"] => [{ type: "text", text: t }];
const packNames = PACKS.map((p) => p.name);

const documentSchema = {
  type: "object",
  description: "A Polyxd UI document: {specVersion, surface, root, components, data?}. polyxd_guide explains the format.",
  additionalProperties: true,
} as const;
const dataSchema = {
  type: "object",
  description: "The values the screen shows, bound by {\"path\": \"/pointer\"}. Replaces the document's own \"data\" when given.",
  additionalProperties: true,
} as const;

type DocArgs = { document: Record<string, unknown>; data?: Record<string, unknown> };

const INSTRUCTIONS = `Polyxd turns a small JSON document of meaning into a real screen in a design system. You write the document; this server checks it and shows it to the user. Call polyxd_guide once before writing your first document, polyxd_validate until it is valid, then polyxd_show. Actions the user takes in a shown screen come back to you as chat messages.`;

export function createServer(): McpServer {
  const server = new McpServer({ name: "polyxd", title: "Polyxd", version: VERSION }, { instructions: INSTRUCTIONS });
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  server.registerTool(
    "polyxd_guide",
    {
      title: "Polyxd guide",
      description:
        "Returns the instructions for writing a Polyxd UI document: the document shape, the rules for generated screens, bindings, actions, every component with its props, and the patterns. Call this once before writing your first document.",
      inputSchema: fromJsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      annotations: readOnly,
    },
    async () => ({ content: text(guide()) }),
  );

  server.registerTool(
    "polyxd_validate",
    {
      title: "Validate a Polyxd document",
      description:
        "Checks a Polyxd UI document against the spec: the schema, ids and references, bindings against the data, actions, and the rules for generated screens. Returns every issue with its JSON Pointer, the component it is in, and a hint saying what to change. Call it after writing or changing a document, and fix every error before showing it.",
      inputSchema: fromJsonSchema<DocArgs>({
        type: "object",
        properties: { document: documentSchema, data: dataSchema },
        required: ["document"],
      }),
      annotations: readOnly,
    },
    async ({ document, data }) => {
      const report = validate(document, data);
      return { content: text(formatValidation(report)), structuredContent: { ...report } };
    },
  );

  server.registerTool(
    "polyxd_verify",
    {
      title: "Verify a Polyxd document",
      description: `Runs the Polyxd verifier's document checks: the spec validator, the pattern the surface declares, readable and distinct labels, one primary action per view, at most six inputs per view, entity-first flows, confirmations, and, when you pass one, a Design Direction's rules and voice. Returns a compact report. Example directions by name: ${exampleDirections().map((d) => d.name).join(", ")}.`,
      inputSchema: fromJsonSchema<DocArgs & { direction?: string | Record<string, unknown>; registry?: Record<string, unknown> }>({
        type: "object",
        properties: {
          document: documentSchema,
          data: dataSchema,
          direction: {
            description: "A Design Direction to hold the document to: the direction object, or the name of an example direction.",
            oneOf: [{ type: "string" }, { type: "object", additionalProperties: true }],
          },
          registry: {
            type: "object",
            description: "A capability registry ({capabilities: [...]}) to check the document's actions against. Leave out when there is none.",
            additionalProperties: true,
          },
        },
        required: ["document"],
      }),
      annotations: readOnly,
    },
    async ({ document, data, direction, registry }) => {
      try {
        const report = verify(document, { data, direction, registry });
        return { content: text(formatVerify(report)), structuredContent: { ...report } };
      } catch (e) {
        return { isError: true, content: text((e as Error).message) };
      }
    },
  );

  server.registerTool(
    "polyxd_show",
    {
      title: "Show a Polyxd screen",
      description: `Validates a Polyxd UI document and shows it to the user as an interactive screen, drawn by the Polyxd renderer in the design-system pack you choose (default ${DEFAULT_PACK}). Shows nothing if the document has errors; fix them first with polyxd_validate. When the user presses an action in the screen, you receive a chat message from the user naming the action and its context. Packs: ${packNames.join(", ")}.`,
      inputSchema: fromJsonSchema<DocArgs & { pack?: string; mode?: "light" | "dark" }>({
        type: "object",
        properties: {
          document: documentSchema,
          data: dataSchema,
          pack: { type: "string", enum: packNames, description: `The design-system pack to draw the screen in. Default ${DEFAULT_PACK}.` },
          mode: { type: "string", enum: ["light", "dark"], description: "Light or dark. Leave out to follow the host's theme." },
        },
        required: ["document"],
      }),
      annotations: readOnly,
      // The flat key is the deprecated form; the official ext-apps helper still sets both, for hosts that read only it.
      _meta: { ui: { resourceUri: VIEW_URI }, "ui/resourceUri": VIEW_URI },
    },
    async ({ document, data, pack = DEFAULT_PACK, mode }) => {
      const chosen = PACKS.find((p) => p.name === pack);
      if (!chosen) return { isError: true, content: text(`No pack named "${pack}". Packs: ${packNames.join(", ")}.`) };
      const report = validate(document, data);
      const meta = { ui: { resourceUri: VIEW_URI } };
      if (!report.valid) {
        return {
          isError: true,
          content: text(`Not shown. ${formatValidation(report)}`),
          structuredContent: { shown: false, issues: report.issues },
          _meta: meta,
        };
      }
      const doc = withData(document, data) as Record<string, any>;
      const title = doc.surface?.title ?? doc.surface?.id ?? "the screen";
      const others = packNames.filter((n) => n !== chosen.name).join(", ");
      const summary = [
        `Showing "${title}" to the user in ${chosen.displayName} (pack "${chosen.name}")${mode ? `, ${mode} mode` : ""}.`,
        report.warnings ? `${report.warnings} warning${report.warnings === 1 ? "" : "s"}: ${report.issues.map((i) => `${i.pointer}: ${i.message}`).join("; ")}.` : "",
        "When the user presses an action, it arrives as a chat message from the user naming the action and its context.",
        `Other packs: ${others}.`,
      ]
        .filter(Boolean)
        .join("\n");
      return {
        content: text(summary),
        structuredContent: { shown: true, document: doc, pack: chosen.name, packName: chosen.displayName, ...(mode ? { mode } : {}), specVersion: SPEC_VERSION },
        _meta: meta,
      };
    },
  );

  server.registerTool(
    "polyxd_packs",
    {
      title: "List Polyxd packs",
      description: "Lists the design-system packs polyxd_show can draw a screen in: published design systems (Material 3, Carbon, GOV.UK and others) and original templates. The same document looks native in each.",
      inputSchema: fromJsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      annotations: readOnly,
    },
    async () => {
      const line = (p: (typeof PACKS)[number]) => `- ${p.name}: ${p.displayName}${p.name === DEFAULT_PACK ? " (default)" : ""}. ${p.description}.`;
      const systems = PACKS.filter((p) => !p.template);
      const templates = PACKS.filter((p) => p.template);
      return {
        content: text([`Design systems (${systems.length}):`, ...systems.map(line), "", `Templates (${templates.length}):`, ...templates.map(line)].join("\n")),
        structuredContent: { default: DEFAULT_PACK, packs: PACKS },
      };
    },
  );

  server.registerTool(
    "polyxd_components",
    {
      title: "List Polyxd components",
      description:
        "Lists the semantic components a Polyxd document can use, with a one-line summary each. Pass \"name\" for one component's full definition: every prop and its type, which are required, when to use it and when not to, and how it renders.",
      inputSchema: fromJsonSchema<{ name?: string }>({
        type: "object",
        properties: { name: { type: "string", description: "A component name, e.g. \"Choice\", for its full definition." } },
      }),
      annotations: readOnly,
    },
    async ({ name }) => {
      if (name) {
        const def = componentNamed(name);
        if (!def) return { isError: true, content: text(`No component named "${name}". Components: ${componentDefinitions().map((c) => c.name).join(", ")}.`) };
        return { content: text(JSON.stringify(def, null, 2)), structuredContent: { component: def } };
      }
      const all = componentDefinitions();
      const rows = all.filter((c) => !c.shell).map((c) => `- ${c.name} (${c.category}): ${c.summary}`);
      const shell = all.filter((c) => c.shell).map((c) => c.name);
      return {
        content: text([`${rows.length} components for generated screens:`, ...rows, "", `Shell components, authored once per product and never generated: ${shell.join(", ")}.`].join("\n")),
        structuredContent: { components: all.map((c) => ({ name: c.name, category: c.category, summary: c.summary, shell: c.shell === true })) },
      };
    },
  );

  // The MCP App: one page for every shown screen, the document arriving in the tool result.
  const viewMeta = { ui: { prefersBorder: true } };
  server.registerResource(
    "polyxd-surface",
    VIEW_URI,
    {
      title: "Polyxd screen",
      description: "Renders a Polyxd UI document with the Polyxd Web Components renderer in any design-system pack, and sends the user's actions back to the chat.",
      mimeType: VIEW_MIME_TYPE,
      _meta: viewMeta,
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: VIEW_MIME_TYPE, text: viewHTML(), _meta: viewMeta }] }),
  );

  for (const ex of [...exampleDocuments(), ...exampleDirections()]) {
    server.registerResource(ex.name, ex.uri, { title: ex.title, description: ex.description, mimeType: "application/json" }, async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: ex.json }],
    }));
  }

  return server;
}
