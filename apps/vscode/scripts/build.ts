/**
 * Builds the extension: src/extension.ts bundled for the extension host (CommonJS, with the spec's
 * validator and the pack compiler inside), the preview page's script for the webview, the
 * renderer bundle copied from @polyxd/react/preview, and the spec's schema copied to schema/ for
 * the jsonValidation contribution. Nothing is fetched at run time.
 *
 *   node scripts/build.ts            once
 *   node scripts/build.ts --watch    rebuild on change
 *
 * It also writes dist/webview/standalone.html: the preview page with a fake acquireVsCodeApi, so
 * the panel can be looked at in a plain browser (npx serve dist/webview).
 */
import { build, context, type BuildOptions, type Plugin } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { previewPage } from "../src/webview/page.ts";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const watch = process.argv.includes("--watch");

/** A package file by its export path; the monorepo's checkout when installed from it. */
const resolveFile = (specifier: string) => fileURLToPath(import.meta.resolve(specifier));

// Inside the monorepo, bundle the spec's source rather than its dist, so a build never waits on a
// stale `tsc -b` there (the renderer's preview build does the same).
const specSrc = here("../../../packages/spec/src");
const specSource: Plugin = {
  name: "spec-source",
  setup(b) {
    if (!existsSync(specSrc)) return;
    b.onResolve({ filter: /^@polyxd\/spec(\/browser)?$/ }, (args) => ({ path: join(specSrc, args.path.endsWith("/browser") ? "browser.ts" : "index.ts") }));
  },
};

const extension: BuildOptions = {
  entryPoints: [here("../src/extension.ts")],
  outfile: here("../dist/extension.cjs"),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: ["node20"],
  external: ["vscode"],
  plugins: [specSource],
  sourcemap: true,
  minify: !watch,
  legalComments: "none",
  // The spec's Node entry reads two JSON files by import.meta.url on paths the extension never
  // calls (patterns, the token contract); a string keeps esbuild from warning about it.
  define: { "import.meta.url": '"file:///polyxd-vscode/dist/extension.cjs"' },
  logLevel: "warning",
};

const webview: BuildOptions = {
  entryPoints: [here("../src/webview/main.ts")],
  outfile: here("../dist/webview/main.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  sourcemap: !watch,
  minify: !watch,
  legalComments: "none",
  logLevel: "warning",
};

async function copyAssets() {
  await mkdir(here("../dist/webview"), { recursive: true });
  await mkdir(here("../schema"), { recursive: true });
  let js: string;
  try {
    js = resolveFile("@polyxd/react/preview/polyxd.js");
    if (!existsSync(js)) throw new Error("missing");
  } catch {
    throw new Error("The renderer's browser bundle isn't built: npm run build:preview -w @polyxd/react");
  }
  await copyFile(js, here("../dist/webview/polyxd.js"));
  await copyFile(js.replace(/\.js$/, ".css"), here("../dist/webview/polyxd.css"));
  await copyFile(resolveFile("@polyxd/spec/schema/ui.schema.json"), here("../schema/ui.schema.json"));
  // The files jsonValidation matches are bare documents or intent files (authored/ and intents/
  // hold intents, whose document sits under "document"). The spec's schema at the root of an
  // intent would call every intent file broken, so the root gets this: the spec's schema for a
  // bare document, and for an intent's "document". The $ref is relative, so nothing is fetched.
  await writeFile(
    here("../schema/file.schema.json"),
    JSON.stringify(
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: "Polyxd document or intent file",
        description: "A Polyxd UI document, or an intent file whose `document` is one.",
        if: { type: "object", required: ["document"] },
        then: { properties: { document: { $ref: "ui.schema.json" } } },
        else: { $ref: "ui.schema.json" },
      },
      null,
      2,
    ) + "\n",
  );
  const prelude = `window.acquireVsCodeApi = function () { var s; return { postMessage: function (m) { console.log("to extension", JSON.stringify(m)); window.__toExtension = (window.__toExtension || []).concat([m]); }, getState: function () { return s; }, setState: function (v) { s = v; } }; };`;
  await writeFile(here("../dist/webview/standalone.html"), previewPage({ polyxdJs: "polyxd.js", polyxdCss: "polyxd.css", mainJs: "main.js", cspSource: "'self'", nonce: "standalone", prelude }));
}

await copyAssets();
if (watch) {
  const [a, b] = await Promise.all([context(extension), context(webview)]);
  await Promise.all([a.watch(), b.watch()]);
  console.log("watching src/ …");
} else {
  await Promise.all([build(extension), build(webview)]);
  const size = async (p: string) => `${Math.round((await readFile(p)).byteLength / 1024)} KB`;
  console.log(`wrote dist/extension.cjs (${await size(here("../dist/extension.cjs"))}), dist/webview/main.js (${await size(here("../dist/webview/main.js"))}), dist/webview/polyxd.js (${await size(here("../dist/webview/polyxd.js"))}), schema/ui.schema.json, schema/file.schema.json`);
}
