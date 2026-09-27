/**
 * The Web Components harness: harness-web/index.html beside @polyxd/web's preview bundle, which
 * already speaks the harness protocol (harness/README.md). Copied, not built, so the verifier
 * checks the bundle the package ships.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const out = here("../harness-web-dist");
const web = dirname(createRequire(import.meta.url).resolve("@polyxd/web/package.json"));
// A fresh checkout has no preview bundle yet; the web package builds it from its sources.
if (!existsSync(join(web, "preview", "polyxd-web.js"))) execFileSync("node", ["scripts/build-preview.ts"], { cwd: web, stdio: "inherit" });
await mkdir(out, { recursive: true });
await copyFile(here("../harness-web/index.html"), join(out, "index.html"));
for (const f of ["polyxd-web.js", "polyxd-web.css"]) await copyFile(join(web, "preview", f), join(out, f));
console.log(`harness-web-dist: index.html + @polyxd/web preview bundle`);
