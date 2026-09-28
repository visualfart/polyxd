/**
 * The Worker behind https://mcp.polyxd.com. The MCP App's page (591 KB of HTML with the renderer
 * and every pack inlined) is bundled as text by wrangler.jsonc's rule for .html files, so nothing
 * is read at run time.
 */
import viewHtml from "@polyxd/mcp/view.html";
import { createApp, type Env } from "./app.ts";

const app = createApp({ viewHtml: () => viewHtml });

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>;
