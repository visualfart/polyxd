/**
 * Builds the MCP App page: one self-contained HTML file with the @polyxd/web renderer, the
 * renderer's stylesheet, every pack's theme and the view's MCP Apps bridge (src/view/app.ts),
 * inlined so the host's default Content Security Policy (no external origins) is all it needs.
 *
 *   node scripts/build-view.ts     writes dist/view.html
 *
 * Like @polyxd/web's preview build, it bundles the workspace sources rather than the dists, and
 * reads the stylesheet and themes from @polyxd/react, where they are authored.
 */
import { build } from "esbuild";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const themes = (await readdir(here("../../react/themes"))).filter((f) => f.endsWith(".css")).sort();

const entry = `
import "../../react/src/styles.css";
${themes.map((t) => `import "../../react/themes/${t}";`).join("\n")}
import "../src/view/app.ts";
`;

const result = await build({
  stdin: { contents: entry, resolveDir: here("."), loader: "ts", sourcefile: "view-entry.ts" },
  bundle: true,
  alias: { "@polyxd/web": here("../../web/src/index.ts"), "@polyxd/core": here("../../core/src/index.ts") },
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  legalComments: "none",
  outdir: here("../dist/view-build"),
  write: false,
  logLevel: "warning",
});

const js = result.outputFiles.find((f) => f.path.endsWith(".js"))!.text;
const css = result.outputFiles.find((f) => f.path.endsWith(".css"))!.text.replace(/\/\*[^*]*\*\/\s*/g, "");
// Inline text must not close its own element early.
const safeJs = js.replace(/<\/(script)/gi, "<\\/$1");
const safeCss = css.replace(/<\/(style)/gi, "<\\/$1");

const html = `<!doctype html>
<html lang="en" data-pxd-theme="material3">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="@polyxd/mcp: @polyxd/web renderer with ${themes.length} packs">
<title>Polyxd</title>
<style>${safeCss}</style>
<style>
html,body{margin:0;background:var(--pxd-color-surface-default,Canvas);color:var(--pxd-color-text-default,CanvasText)}
#root{padding:0}
.pxd-mcp-status{font:14px/1.5 system-ui,sans-serif;padding:16px}
.pxd-mcp-status-title{font-weight:600;margin:0 0 4px}
.pxd-mcp-status ul{margin:4px 0 0;padding-left:20px}
#note{font:12px/1.4 system-ui,sans-serif;color:var(--pxd-color-text-muted,GrayText);margin:0;padding:0 16px 12px}
</style>
</head>
<body>
<main id="root" data-polyxd-mcp-view></main>
<p id="note" role="status" aria-live="polite" hidden></p>
<script>${safeJs}</script>
</body>
</html>
`;

await mkdir(here("../dist"), { recursive: true });
await writeFile(here("../dist/view.html"), html);
console.log(`wrote dist/view.html (${Math.round(Buffer.byteLength(html) / 1024)} KB, ${themes.length} packs)`);
