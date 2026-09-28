/**
 * Docs drift is a build failure. This checks the things that go stale quietly: every component
 * the spec defines is on the components docs page, every exported renderer API and every CLI
 * command is mentioned somewhere in the docs, every demo product is linked, and the counts the
 * prose states match the repo. Run by `npm run build` before anything is written, and by CI.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const isTemplate = (m: any) => m?.template === true || (Array.isArray(m.provenance) ? m.provenance : [m.provenance]).some((e: any) => e?.template === true || /^Original template/.test(String(e?.notes ?? "")));
const DOCS = join(REPO, "apps/site/content/docs");
const read = (p: string) => readFile(join(REPO, p), "utf8");

// The roadmap records history ("24 components" in v0), so it is read for links but not for counts.
const files = (await readdir(DOCS)).filter((f) => f.endsWith(".md"));
const docs = (await Promise.all(files.filter((f) => f !== "roadmap.md").map((f) => readFile(join(DOCS, f), "utf8")))).join("\n");
const readme = await read("README.md");
const all = docs + "\n" + readme;
const problems: string[] = [];

// Components: every definition is documented by name on the concepts page.
const components = (await readdir(join(REPO, "packages/spec/components"))).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
const conceptsPage = await read("apps/site/content/docs/components.md");
for (const c of components) if (!new RegExp(`\\b${c}\\b`).test(conceptsPage)) problems.push(`components.md does not mention ${c}`);
const stated = [...all.matchAll(/\b(\d+) (?:semantic )?components\b/g)].map((m) => Number(m[1]));
for (const n of new Set(stated)) if (n !== components.length && n > 20) problems.push(`prose says "${n} components" but the spec has ${components.length}`);

// Renderer exports. Value exports only: the types ride along with them.
const valueExports = (src: string) => [...src.matchAll(/export \{([^}]+)\}/g)].flatMap((m) => m[1].split(",").map((s) => s.trim())).filter((s) => s && !s.startsWith("type ")).map((s) => s.split(" as ").pop()!.trim());
const exported = valueExports(await read("packages/react/src/index.ts")).filter((n) => /^[A-Z]|^use[A-Z]/.test(n));
for (const name of exported) if (!all.includes(name)) problems.push(`renderer export ${name} is not mentioned in the docs`);
// Every public export of @polyxd/core, @polyxd/web, @polyxd/runtime and @polyxd/server, whatever its case: a renderer, runtime or server user reads about it here.
const shared: string[] = [];
for (const pkg of ["core", "web", "runtime", "server"]) {
  for (const name of valueExports(await read(`packages/${pkg}/src/index.ts`))) {
    shared.push(name);
    if (!new RegExp(`\\b${name}\\b`).test(all)) problems.push(`@polyxd/${pkg} export ${name} is not mentioned in the docs`);
  }
}

// CLI commands: whatever polyxd.ts's usage text lists.
const cli = await read("packages/ds-kit/src/polyxd.ts");
for (const cmd of ["pack", "check", "studio push", "dev"]) if (!cli.includes(cmd)) problems.push(`polyxd.ts no longer has "${cmd}"; update this check`);
for (const cmd of ["polyxd pack", "polyxd check", "polyxd studio push", "polyxd dev"]) if (!all.includes(cmd)) problems.push(`docs do not mention "${cmd}"`);

// Demo products: every product folder is linked from the docs.
const demos = (await readdir(join(REPO, "apps/demos"), { withFileTypes: true })).filter((d) => d.isDirectory() && !["kit", "scripts", "test", "public", "node_modules", "dist"].includes(d.name)).map((d) => d.name);
for (const d of demos) if (!all.includes(`/demos/${d}/`)) problems.push(`docs do not link /demos/${d}/`);

// Packs: the number of real design-system packs stated in the docs.
const packs = (await readdir(join(REPO, "packages"))).filter((p) => p.startsWith("ds-") && p !== "ds-kit");
// A template pack's provenance names Polyxd as the source; a real system's names the system.
const templates = await Promise.all(packs.map(async (p) => (isTemplate(JSON.parse(await read(`packages/${p}/manifest.json`))) ? p : null)));
const real = packs.length - templates.filter(Boolean).length;
const packWords = [...all.matchAll(/\b(\d+|thirteen|twelve|fourteen|fifteen) (?:real )?(?:design[- ]system )?packs\b/gi)];
const words: Record<string, number> = { thirteen: 13, twelve: 12, fourteen: 14, fifteen: 15 };
for (const m of packWords) {
  const n = words[m[1].toLowerCase()] ?? Number(m[1]);
  if (n !== real && n !== packs.length) problems.push(`prose says "${m[0]}" but there are ${real} real packs (${packs.length} with templates)`);
}

if (problems.length) {
  console.error(`Docs are out of date:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`docs check: ${components.length} components, ${exported.length} renderer exports, ${shared.length} core, web, runtime and server exports, 4 CLI commands, ${demos.length} demos, ${real} packs all documented`);
