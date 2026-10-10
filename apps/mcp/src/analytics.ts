/**
 * Anonymous product analytics for the hosted MCP server, sent to PostHog (US cloud) after the
 * answer has gone out. Off unless the Worker has POSTHOG_KEY: with no key nothing is read, cloned
 * or sent, and the server behaves exactly as before.
 *
 * What an event may carry is decided here and nowhere else, and it is only ever counts and names
 * from fixed lists:
 *
 *   mcp_initialize    the client's name and version (from clientInfo), the protocol version
 *   mcp_tool_called   the tool, whether it worked, a class of error, the pack and mode (for
 *                     polyxd_show), how many of each component type the document used, how many
 *                     errors and warnings came back, how long it took, and the client's product
 *                     name from its User-Agent
 *
 * Never the document, its data, a Direction, a registry, any text a person or model wrote, a
 * header other than the User-Agent's first word, or an IP address. Each request gets a fresh
 * random id, so no two requests can be linked, and PostHog makes no person profile from it.
 * Only @polyxd/mcp's hosted copy does this: the npm package and `npx @polyxd/mcp` send nothing.
 */
import catalog from "@polyxd/spec/catalog/catalog.json" with { type: "json" };

export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/** The Worker's settings: POSTHOG_KEY (the project's public key, phc_…) turns this on. */
export interface AnalyticsEnv {
  POSTHOG_KEY?: string;
  POSTHOG_HOST?: string;
}

export interface PostHogConfig {
  key: string;
  host: string;
}

/** The config, or null when analytics are off (no key, or a value that isn't a project key). */
export function posthogConfig(env: AnalyticsEnv): PostHogConfig | null {
  const key = env.POSTHOG_KEY?.trim();
  if (!key || !/^phc_[A-Za-z0-9_-]{8,}$/.test(key)) return null;
  const host = (env.POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(host)) return null;
  return { key, host };
}

export interface AnalyticsEvent {
  event: "mcp_initialize" | "mcp_tool_called";
  properties: Record<string, string | number | boolean | Record<string, number>>;
}

/** Sends events to PostHog's capture endpoint, one request each. Never throws. */
export async function sendEvents(config: PostHogConfig, events: AnalyticsEvent[], fetcher: typeof fetch = fetch): Promise<void> {
  await Promise.all(
    events.map(async (e) => {
      try {
        await fetcher(`${config.host}/i/v0/e/`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            api_key: config.key,
            event: e.event,
            // A fresh id per event: nothing links one request to another, or to a person.
            distinct_id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            properties: { ...e.properties, $process_person_profile: false, $geoip_disable: true, $ip: null, $lib: "polyxd-mcp-worker" },
          }),
        });
      } catch {
        // Analytics never break or slow the server.
      }
    }),
  );
}

const TOOLS = new Set(["polyxd_guide", "polyxd_validate", "polyxd_verify", "polyxd_show", "polyxd_packs", "polyxd_components", "polyxd_docs"]);
/** Component types the spec defines. Anything else in a document (a custom component's name) is counted as "Other". */
const COMPONENTS = new Set(Object.keys((catalog as { components: Record<string, unknown> }).components));
const RPC_ERRORS: Record<number, string> = { [-32700]: "parse_error", [-32600]: "invalid_request", [-32601]: "method_not_found", [-32602]: "invalid_params", [-32603]: "internal_error", [-32000]: "server_error" };

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

/** A short name from a fixed alphabet, or nothing: client names and versions are the client's own words. */
function label(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, max);
  return /^[A-Za-z0-9][A-Za-z0-9 ._@/:+()-]*$/.test(s) ? s : undefined;
}

/** The product in a User-Agent ("claude-user/1.0 (…)" → "claude-user"), never the rest of it. */
export function userAgentProduct(ua: string | null): string {
  const m = /^\s*([A-Za-z][A-Za-z0-9._-]{0,39})/.exec(ua ?? "");
  return m ? m[1] : "unknown";
}

/** How many of each component type a document uses, by type name only. */
export function componentCounts(document: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  const list = isObject(document) ? document.components : undefined;
  const items = Array.isArray(list) ? list : isObject(list) ? Object.values(list) : [];
  for (const c of items.slice(0, 2000)) {
    const type = isObject(c) && typeof c.component === "string" && COMPONENTS.has(c.component) ? c.component : "Other";
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

/** The JSON-RPC messages in a body: one, a batch, or a server-sent event stream of them. */
export function rpcMessages(text: string, contentType = ""): any[] {
  const parse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : [v];
    } catch {
      return [];
    }
  };
  if (!contentType.includes("text/event-stream")) return parse(text);
  const out: any[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""))
      .join("\n");
    if (data) out.push(...parse(data));
  }
  return out;
}

/** Why a tool call failed, as a class from a fixed list. */
function errorClass(tool: string, response: any, status: number): string | undefined {
  if (status === 504) return "timeout";
  if (!response) return status >= 400 ? `http_${status}` : "no_response";
  if (isObject(response.error)) return RPC_ERRORS[response.error.code] ?? "rpc_error";
  const result = response.result;
  if (!isObject(result) || result.isError !== true) return undefined;
  // Arguments that miss the tool's input schema (probes often send `{}`): the SDK answers before the tool runs.
  const text = Array.isArray(result.content) && isObject(result.content[0]) ? result.content[0].text : undefined;
  if (typeof text === "string" && text.startsWith("Input validation error")) return "invalid_arguments";
  if (tool === "polyxd_show") return isObject(result.structuredContent) && result.structuredContent.shown === false ? "invalid_document" : "unknown_pack";
  if (tool === "polyxd_components") return "unknown_component";
  if (tool === "polyxd_verify") return "unknown_direction";
  if (tool === "polyxd_docs") return "unknown_page";
  return "tool_error";
}

/** Errors and warnings a tool reported, when it reports them. */
function issueCounts(tool: string, result: any): { errors?: number; warnings?: number } {
  const s = isObject(result) ? result.structuredContent : undefined;
  if (!isObject(s)) return {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : undefined);
  if (tool === "polyxd_validate" || tool === "polyxd_verify") return { errors: n(s.errors), warnings: n(s.warnings) };
  if (tool === "polyxd_show" && Array.isArray(s.issues)) {
    const errors = s.issues.filter((i: any) => isObject(i) && i.severity === "error").length;
    return { errors, warnings: s.issues.length - errors };
  }
  return {};
}

export interface Exchange {
  /** The request's JSON-RPC messages. */
  requests: any[];
  /** The response's JSON-RPC messages. */
  responses: any[];
  status: number;
  ms: number;
  userAgent: string | null;
  protocolHeader: string | null;
}

/** The events one request/response pair makes: one per initialize and one per tool call. Nothing else counts. */
export function eventsFor(x: Exchange): AnalyticsEvent[] {
  const byId = new Map<unknown, any>();
  for (const r of x.responses) if (isObject(r) && r.id !== undefined && r.id !== null) byId.set(r.id, r);
  const client_product = userAgentProduct(x.userAgent);
  const protocol = label(x.protocolHeader, 20);
  const events: AnalyticsEvent[] = [];
  for (const m of x.requests) {
    if (!isObject(m) || typeof m.method !== "string") continue;
    if (m.method === "initialize") {
      const p = isObject(m.params) ? m.params : {};
      const info = isObject(p.clientInfo) ? p.clientInfo : {};
      const props: AnalyticsEvent["properties"] = { client_name: label(info.name, 64) ?? "unknown", client_product, status: x.status };
      const version = label(info.version, 32);
      if (version) props.client_version = version;
      const pv = label(p.protocolVersion, 20) ?? protocol;
      if (pv) props.protocol_version = pv;
      events.push({ event: "mcp_initialize", properties: props });
    } else if (m.method === "tools/call") {
      const p = isObject(m.params) ? m.params : {};
      const tool = typeof p.name === "string" && TOOLS.has(p.name) ? p.name : "unknown";
      const args = isObject(p.arguments) ? p.arguments : {};
      const response = byId.get(m.id);
      const error = errorClass(tool, response, x.status);
      const props: AnalyticsEvent["properties"] = { tool, ok: !error, duration_ms: Math.max(0, Math.round(x.ms)), client_product };
      if (error) props.error = error;
      if (protocol) props.protocol_version = protocol;
      if (tool === "polyxd_validate" || tool === "polyxd_verify" || tool === "polyxd_show") {
        props.components = componentCounts(args.document);
        props.has_data = isObject(args.data);
        const counts = issueCounts(tool, response?.result);
        if (counts.errors !== undefined) props.errors = counts.errors;
        if (counts.warnings !== undefined) props.warnings = counts.warnings;
      }
      if (tool === "polyxd_verify") {
        props.has_direction = args.direction !== undefined;
        props.has_registry = args.registry !== undefined;
      }
      if (tool === "polyxd_show") {
        const shown = isObject(response?.result?.structuredContent) ? response.result.structuredContent : {};
        // The pack as the server resolved it, one of its fixed ids; never what the model typed.
        if (shown.shown === true && typeof shown.pack === "string" && /^[a-z0-9]{2,20}$/.test(shown.pack)) props.pack = shown.pack;
        props.mode = args.mode === "light" || args.mode === "dark" ? args.mode : "auto";
      }
      events.push({ event: "mcp_tool_called", properties: props });
    }
  }
  return events;
}
