/**
 * The Polyxd MCP server. The host's model is the generator: these tools give it the spec, check
 * what it wrote, and show the result to the user as an MCP App (SEP-1865, `io.modelcontextprotocol/ui`).
 *
 * Nothing here touches the file system or Node's APIs, so the same server runs over stdio in Node
 * (src/bin.ts) and over Streamable HTTP in a Cloudflare Worker (src/http.ts, apps/mcp). Where the
 * MCP App's page comes from is the caller's business: src/view-file.ts reads it from dist/view.html,
 * and the Worker bundles it as text.
 */
import { McpServer, fromJsonSchema, type CallToolResult } from "@modelcontextprotocol/server";
import { formatValidation, formatVerify, validate, verify, withData } from "./check.ts";
import { guide, SPEC_VERSION } from "./prompt.ts";
import { PACKS } from "./packs.generated.ts";
import { componentDefinitions, componentNamed, exampleDirections, exampleDocuments } from "./spec.ts";
import { componentsOutput, guideOutput, packsOutput, showOutput, validateOutput, verifyOutput } from "./output-schemas.ts";

export const VERSION = "0.4.1";
/** The MCP App resource every shown screen renders in. */
export const VIEW_URI = "ui://polyxd/surface.html";
/** MCP Apps' HTML profile. */
export const VIEW_MIME_TYPE = "text/html;profile=mcp-app";
export const DEFAULT_PACK = "material3";
/** The origin ChatGPT gives the MCP App's sandbox (`openai/widgetDomain`): unique to this app. */
export const WIDGET_DOMAIN = "https://mcp.polyxd.com";

export interface ServerOptions {
  /** The MCP App's page: the self-contained HTML scripts/build-view.ts writes to dist/view.html. Called when a host reads the resource. */
  viewHtml: () => string | Promise<string>;
  /** The origin ChatGPT should give the MCP App's sandbox. Default {@link WIDGET_DOMAIN}. */
  widgetDomain?: string;
}

const text = (t: string): CallToolResult["content"] => [{ type: "text", text: t }];
const packNames = PACKS.map((p) => p.name);

/** Lower case, letters and digits only: "IBM Carbon" → "ibmcarbon", "GOV.UK" → "govuk". */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const VENDORS = /^(google|ibm|microsoft|shopify|github|adobe)\s+/i;

/**
 * The pack a model means. Models write what people say ("Carbon", "shadcn/ui", "Material 3", "IBM
 * Carbon") as often as the pack's id, and an id-only enum made hosts drop the argument and fall back
 * to the default. Exact names first, then a display name with or without its vendor and version, then
 * an unambiguous prefix. Unknown names are an error, never a silent default.
 */
export function resolvePack(input: string): (typeof PACKS)[number] | undefined {
  const q = squash(input);
  if (!q) return undefined;
  const keys = (p: (typeof PACKS)[number]) => {
    const display = p.displayName.split(/\s+on\s+/i)[0];
    const bare = display.replace(VENDORS, "");
    return [p.name, display, bare, bare.replace(/\s*\d+$/, ""), display.replace(/\s*\d+$/, "")].map(squash);
  };
  const exact = PACKS.filter((p) => keys(p).includes(q));
  if (exact.length === 1) return exact[0];
  // A leading part of a name ("mater", "shad"), never a longer one: "bootstrap4" is not Bootstrap 5.
  const near = PACKS.filter((p) => keys(p).some((k) => q.length >= 4 && k.startsWith(q)));
  return near.length === 1 ? near[0] : undefined;
}

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

const INSTRUCTIONS = `Polyxd turns a small JSON document of meaning into a real screen in a design system. You write the document; this server checks it and shows it to the user. Call polyxd_guide once before writing your first document, polyxd_validate until it is valid, then polyxd_show. Actions the user takes in a shown screen come back to you as chat messages. A button press only tells you what the user chose: it submits, pays or saves nothing, so never say it did.`;

/**
 * The MCP App resource's `_meta`, for Claude and ChatGPT alike. The page loads nothing from anywhere
 * (renderer, styles and themes are inlined), so its Content Security Policy allows no origins at all.
 * `ui.domain` is left out on purpose: each host wants its own format there (Claude a hash of the
 * connector URL, ChatGPT an origin), and a value in the wrong one stops Claude rendering the app.
 * ChatGPT takes its origin from `openai/widgetDomain` instead, which Claude ignores.
 */
export function appResourceMeta(widgetDomain: string = WIDGET_DOMAIN) {
  return {
    ui: { prefersBorder: true, csp: { connectDomains: [] as string[], resourceDomains: [] as string[] } },
    "openai/widgetDescription": "An interactive screen the assistant wrote as a Polyxd document, drawn in a design-system pack. Pressing an action in it sends the assistant a chat message naming the action and what the user entered.",
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": { connect_domains: [] as string[], resource_domains: [] as string[] },
    "openai/widgetDomain": widgetDomain,
  };
}

/**
 * Every tool is a pure function of its arguments: it reads nothing but the spec, writes nothing,
 * reaches no other system and gives the same answer twice. The annotations say so, with the title
 * repeated inside them for hosts that read it only there.
 */
const readOnly = (title: string) => ({ title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });

export function createServer(options: ServerOptions): McpServer {
  const server = new McpServer(
    {
      name: "polyxd",
      title: "Polyxd",
      version: VERSION,
      websiteUrl: "https://polyxd.com/docs/mcp/",
      icons: [{ src: "https://polyxd.com/icon-512.png", mimeType: "image/png", sizes: ["512x512"] }],
    },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "polyxd_guide",
    {
      title: "Polyxd guide",
      description:
        "Returns the instructions for writing a Polyxd UI document: the document shape, the rules for generated screens, bindings, actions, every component with its props, and the patterns. Call this once before writing your first document.",
      inputSchema: fromJsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      outputSchema: fromJsonSchema(guideOutput),
      annotations: readOnly("Polyxd guide"),
    },
    async () => {
      const g = guide();
      return { content: text(g), structuredContent: { specVersion: SPEC_VERSION, guide: g } };
    },
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
      outputSchema: fromJsonSchema(validateOutput),
      annotations: readOnly("Validate a Polyxd document"),
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
      outputSchema: fromJsonSchema(verifyOutput),
      annotations: readOnly("Verify a Polyxd document"),
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
      description: `Validates a Polyxd UI document and shows it to the user as an interactive screen, drawn by the Polyxd renderer in the design-system pack you choose (default ${DEFAULT_PACK}). Shows nothing if the document has errors; fix them first with polyxd_validate. When the user presses an action in the screen, you receive a chat message from the user naming the action and its context; that only tells you their choice, and nothing has been submitted or paid. Packs: ${packNames.join(", ")}.`,
      inputSchema: fromJsonSchema<DocArgs & { pack?: string; mode?: "light" | "dark" }>({
        type: "object",
        properties: {
          document: documentSchema,
          data: dataSchema,
          pack: { type: "string", description: `The design-system pack to draw the screen in, by id: ${packNames.join(", ")}. Names like "Carbon" or "shadcn/ui" work too. Pass it whenever the user names a design system. Default ${DEFAULT_PACK}.` },
          mode: { type: "string", enum: ["light", "dark"], description: "Light or dark. Leave out to follow the host's theme." },
        },
        required: ["document"],
      }),
      outputSchema: fromJsonSchema(showOutput),
      annotations: readOnly("Show a Polyxd screen"),
      _meta: {
        ui: { resourceUri: VIEW_URI },
        // The flat key is the deprecated form; the official ext-apps helper still sets both, for hosts that read only it.
        "ui/resourceUri": VIEW_URI,
        // ChatGPT honours ui.resourceUri; these are its compatibility alias and its status lines while the tool runs.
        "openai/outputTemplate": VIEW_URI,
        "openai/toolInvocation/invoking": "Drawing the screen",
        "openai/toolInvocation/invoked": "Screen shown",
      },
    },
    async ({ document, data, pack = DEFAULT_PACK, mode }) => {
      const chosen = resolvePack(pack);
      if (!chosen) return { isError: true, content: text(`No pack named "${pack}". Packs: ${packNames.join(", ")}. Ask the user which to use, or pick the nearest and say so.`) };
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
      outputSchema: fromJsonSchema(packsOutput),
      annotations: readOnly("List Polyxd packs"),
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
      outputSchema: fromJsonSchema(componentsOutput),
      annotations: readOnly("List Polyxd components"),
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
  const viewMeta = appResourceMeta(options.widgetDomain ?? WIDGET_DOMAIN);
  server.registerResource(
    "polyxd-surface",
    VIEW_URI,
    {
      title: "Polyxd screen",
      description: "Renders a Polyxd UI document with the Polyxd Web Components renderer in any design-system pack, and sends the user's actions back to the chat.",
      mimeType: VIEW_MIME_TYPE,
      _meta: viewMeta,
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: VIEW_MIME_TYPE, text: await options.viewHtml(), _meta: viewMeta }] }),
  );

  for (const ex of [...exampleDocuments(), ...exampleDirections()]) {
    server.registerResource(ex.name, ex.uri, { title: ex.title, description: ex.description, mimeType: "application/json" }, async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: ex.json }],
    }));
  }

  return server;
}
