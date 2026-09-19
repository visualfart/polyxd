/**
 * Polyxd UI document → A2UI v1.0 agent-to-renderer message stream.
 *
 * The Polyxd component layer mirrors A2UI's shapes (flat adjacency list, JSON Pointer bindings,
 * `action.event {name, context}`, `accessibility`), and the Polyxd A2UI catalog declares every component
 * with its Polyxd props. So most of the export is an identity projection. The exceptions are:
 *  - the top-level component is renamed to "root" (A2UI mounts the component with id "root"),
 *  - `ui.*` renderer actions become A2UI local function calls (`dismiss` / `back` / `next`),
 *  - Polyxd metadata with no A2UI equivalent (spec version, surface title/intent/pattern/journey/dismissible,
 *    component `key`) is listed in `lossy`. Unless `extensions: false`, it is also carried as opaque
 *    `metadata.extensions.com_polyxd`, which A2UI renderers must ignore.
 */
import { readFileSync } from "node:fs";
import { A2UI_VERSION, EXTENSION_KEY, POLYXD_CATALOG_ID, type Json } from "./a2ui.ts";
import { RENDERER_FUNCTIONS } from "./catalog.ts";

export interface PolyxdComponent {
  id: string;
  component: string;
  key?: string;
  accessibility?: Json;
  [prop: string]: unknown;
}

export interface PolyxdDocument {
  $schema?: string;
  specVersion: string;
  surface: { id: string; title: string; intent?: string; pattern?: string; journey?: string; dismissible?: boolean };
  root: string;
  components: PolyxdComponent[];
  data?: Json;
}

export interface A2UIComponent {
  id: string;
  component: string;
  accessibility?: Json;
  metadata?: { extensions: Json };
  [prop: string]: unknown;
}

export type A2UIMessage =
  | {
      version: typeof A2UI_VERSION;
      createSurface: {
        surfaceId: string;
        catalogId: string;
        sendDataModel?: boolean;
        components?: A2UIComponent[];
        dataModel?: Json;
        metadata?: { extensions: Json };
      };
    }
  | { version: typeof A2UI_VERSION; updateComponents: { surfaceId: string; components: A2UIComponent[] } }
  | { version: typeof A2UI_VERSION; updateDataModel: { surfaceId: string; path?: string; value: unknown } };

export interface ExportOptions {
  /**
   * "inline" (default): one `createSurface` carrying `components` and `dataModel` (allowed by v1.0).
   * "stream": `createSurface`, then `updateComponents`, then `updateDataModel` (only when the document has data).
   */
  mode?: "inline" | "stream";
  /** Override the A2UI surfaceId (must be unique for the renderer's lifetime). Defaults to `surface.id`. */
  surfaceId?: string;
  /** Carry Polyxd-only metadata in `metadata.extensions.com_polyxd` (default true). The fields are listed in `lossy` either way. */
  extensions?: boolean;
  /** Passed through to createSurface.sendDataModel. */
  sendDataModel?: boolean;
}

export interface ExportResult {
  messages: A2UIMessage[];
  /** JSON Pointers into the Polyxd document for every field with no A2UI representation. */
  lossy: string[];
  /** Component ids that were renamed (Polyxd id → A2UI id). Only "root" handling renames. */
  idMap: Record<string, string>;
}

const uiSchema: Json = JSON.parse(readFileSync(new URL(import.meta.resolve("@polyxd/spec/schema/ui.schema.json")), "utf8"));
const defs: Json = uiSchema.$defs;
const refName = (s: Json | undefined) => (typeof s?.$ref === "string" ? s.$ref.replace("#/$defs/", "") : undefined);
const deref = (s: Json | undefined): Json | undefined => {
  let cur = s;
  while (cur && refName(cur)) cur = defs[refName(cur)!];
  return cur;
};
const pointer = (...parts: (string | number)[]) => "/" + parts.map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1")).join("/");
const clone = <T>(v: T): T => structuredClone(v);

/** Fields of the Polyxd envelope that A2UI has no place for. */
const SURFACE_ONLY = ["title", "intent", "pattern", "journey", "dismissible"] as const;

export function exportToA2UI(doc: PolyxdDocument, options: ExportOptions = {}): ExportResult {
  const { mode = "inline", extensions = true } = options;
  const surfaceId = options.surfaceId ?? doc.surface.id;
  const lossy: string[] = [];

  // A2UI mounts the component with id "root". Rename the Polyxd root, moving any other "root" out of the way.
  const ids = new Set(doc.components.map((c) => c.id));
  const idMap: Record<string, string> = {};
  if (doc.root !== "root") {
    if (ids.has("root")) {
      let n = 2;
      while (ids.has(`root_${n}`)) n++;
      idMap.root = `root_${n}`;
    }
    idMap[doc.root] = "root";
  }
  const mapId = (id: string) => idMap[id] ?? id;

  /** Copies a prop value, rewriting component ids and renderer actions where the Polyxd schema says they are. */
  const project = (schema: Json | undefined, value: unknown, at: string): unknown => {
    const name = refName(schema);
    if (name === "Id" && typeof value === "string") return mapId(value);
    if (name === "Action" && value && typeof value === "object") return projectAction(value as Json, at);
    if (name === "Template" && value && typeof value === "object") {
      const t = value as Json;
      return { ...clone(t), componentId: mapId(t.componentId) };
    }
    const s = deref(schema);
    if (!s || s.oneOf || value === null || typeof value !== "object") return clone(value);
    if (Array.isArray(value)) return value.map((v, i) => project(s.items, v, `${at}/${i}`));
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, project(s.properties?.[k], v, `${at}/${k}`)]));
  };

  const projectAction = (action: Json, at: string): Json => {
    const fn = RENDERER_FUNCTIONS[action.event?.name];
    if (!fn) return clone(action);
    if (action.event.context) lossy.push(`${at}/event/context`);
    return { functionCall: { call: fn.fn } };
  };

  const components: A2UIComponent[] = doc.components.map((c, i) => {
    const compSchema: Json | undefined = defs[`Component${c.component}`];
    const out: A2UIComponent = { id: mapId(c.id), component: c.component };
    for (const [prop, value] of Object.entries(c)) {
      if (prop === "id" || prop === "component") continue;
      if (prop === "key") {
        lossy.push(pointer("components", i, "key"));
        continue;
      }
      out[prop] = project(compSchema?.properties?.[prop], value, pointer("components", i, prop));
    }
    if (extensions && c.key !== undefined) out.metadata = { extensions: { [EXTENSION_KEY]: { key: c.key } } };
    return out;
  });

  // Envelope fields.
  const surfaceExt: Json = {};
  if (doc.$schema !== undefined) lossy.push("/$schema");
  if (doc.specVersion !== undefined) (lossy.push("/specVersion"), (surfaceExt.specVersion = doc.specVersion));
  for (const f of SURFACE_ONLY) {
    if (doc.surface[f] !== undefined) (lossy.push(`/surface/${f}`), (surfaceExt[f] = doc.surface[f]));
  }
  if (doc.root !== "root") surfaceExt.root = doc.root;

  const createSurface: Extract<A2UIMessage, { createSurface: unknown }>["createSurface"] = { surfaceId, catalogId: POLYXD_CATALOG_ID };
  if (options.sendDataModel !== undefined) createSurface.sendDataModel = options.sendDataModel;
  if (extensions && Object.keys(surfaceExt).length) createSurface.metadata = { extensions: { [EXTENSION_KEY]: surfaceExt } };

  const messages: A2UIMessage[] = [];
  if (mode === "inline") {
    createSurface.components = components;
    if (doc.data !== undefined) createSurface.dataModel = clone(doc.data);
    messages.push({ version: A2UI_VERSION, createSurface });
  } else {
    messages.push({ version: A2UI_VERSION, createSurface });
    messages.push({ version: A2UI_VERSION, updateComponents: { surfaceId, components } });
    if (doc.data !== undefined) messages.push({ version: A2UI_VERSION, updateDataModel: { surfaceId, value: clone(doc.data) } });
  }
  return { messages, lossy, idMap };
}
