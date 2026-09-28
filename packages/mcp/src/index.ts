import type { McpServer } from "@modelcontextprotocol/server";
import { createServer as createServerWith, type ServerOptions } from "./server.ts";
import { viewHTML } from "./view-file.ts";

/** The Polyxd MCP server, its MCP App page read from dist/view.html unless you pass `viewHtml`. */
export function createServer(options: Partial<ServerOptions> = {}): McpServer {
  return createServerWith({ viewHtml: viewHTML, ...options });
}

export { viewHTML };
export { appResourceMeta, VERSION, VIEW_URI, VIEW_MIME_TYPE, DEFAULT_PACK, WIDGET_DOMAIN, type ServerOptions } from "./server.ts";
export { createHttpHandler, rateLimiter, type HttpHandlerOptions, type RequestLog } from "./http.ts";
export { validate, verify, formatValidation, formatVerify, hintFor, type ReportedIssue, type ValidationReport, type VerifyReport } from "./check.ts";
export { guide, MCP_NOTES, SYSTEM_PROMPT, SPEC_VERSION } from "./prompt.ts";
export { PACKS, type Pack } from "./packs.generated.ts";
export { componentDefinitions, exampleDocuments, exampleDirections, type ComponentDefinition, type Example } from "./spec.ts";
