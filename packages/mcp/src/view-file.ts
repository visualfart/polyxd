/**
 * The MCP App's page, read from dist/view.html in Node. A Worker bundles the same file as text
 * instead (apps/mcp), which is why this lives apart from src/server.ts.
 */
import { readFileSync, existsSync } from "node:fs";

const VIEW_FILE = new URL("../dist/view.html", import.meta.url);
let viewHtml: string | undefined;

/** The self-contained page (renderer, every pack's CSS, the MCP Apps bridge) built by scripts/build-view.ts. */
export function viewHTML(): string {
  if (viewHtml) return viewHtml;
  if (!existsSync(VIEW_FILE)) throw new Error("dist/view.html is missing: run `npm run build -w @polyxd/mcp`");
  return (viewHtml = readFileSync(VIEW_FILE, "utf8"));
}
