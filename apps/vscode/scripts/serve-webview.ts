/**
 * Serves dist/webview/ so the preview panel's page can be looked at in a plain browser, through
 * standalone.html (which fakes the editor's side). Documents from the demos are at /samples/…
 * so the page has something to render: open standalone.html, then in the console
 *
 *   fetch("/samples/halden/authored/screen.budgets.json").then(r => r.json()).then(d => window.postMessage({ type: "document", file: "screen.budgets.json", title: d.title, kind: "intent", document: d.document, dataFrom: "none", version: 1 }))
 *
 *   node scripts/serve-webview.ts [--port 4320]
 */
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const port = Number(process.argv[process.argv.indexOf("--port") + 1]) || 4320;
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".map": "application/json" };

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = path.startsWith("/samples/") ? join(here("../../demos"), path.slice("/samples/".length)) : join(here("../dist/webview"), path === "/" ? "standalone.html" : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": `${types[extname(file)] ?? "application/octet-stream"}; charset=utf-8`, "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`webview at http://localhost:${port}/`));
