/**
 * Checks, and optionally publishes, every package this repository releases to npm.
 *
 *   npm run release:check     build everything and inspect each tarball; publishes nothing
 *   npm run release:publish   the same, then publish whatever isn't on npm at this version yet
 *
 * The check exists because the failures here are invisible from inside the monorepo. Node won't
 * strip types from a file in node_modules, so a package whose entry point is `.ts` works in every
 * local test and fails on its first install. A file the build produces and git ignores — the
 * verifier's rendering harness — never reaches the tarball. A pack that ships tokens derived from
 * an MIT or Apache design system without that licence is out of compliance. Each of those was
 * true of this repository on the day it went public. So every tarball is opened and checked
 * against its own package.json before anything is published, and publishing is skipped entirely
 * if any check fails.
 */
import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const publish = process.argv.includes("--publish");

/** Dependency order: nothing is published before what it depends on. */
const CORE = ["spec", "ds-kit", "react", "a2ui", "verifier"];
const PACKS = readdirSync(join(ROOT, "packages"))
  .filter((d) => d.startsWith("ds-") && d !== "ds-kit" && existsSync(join(ROOT, "packages", d, "manifest.json")))
  .sort();
const ORDER = [...CORE, ...PACKS, "polyxd"];

const run = (cmd: string, args: string[], cwd: string) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** Every file path a package.json promises: main, bin, and each export target. */
function promised(pkg: any): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  if (pkg.main) out.push(pkg.main);
  walk(pkg.bin);
  walk(pkg.exports);
  // Wildcard exports ("./themes/*") promise a directory, not a file; they're checked by prefix.
  return [...new Set(out.map((p) => p.replace(/^\.\//, "")))];
}

const problems: string[] = [];
const rows: string[] = [];

for (const name of ORDER) {
  const dir = join(ROOT, "packages", name);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  // The Apache licence and the NOTICE travel with every copy, and npm only picks up a LICENSE
  // from the package's own directory.
  copyFileSync(join(ROOT, "LICENSE"), join(dir, "LICENSE"));
  copyFileSync(join(ROOT, "NOTICE"), join(dir, "NOTICE"));

  if (pkg.scripts?.build) run("npm", ["run", "build"], dir);
  if (pkg.scripts?.["build:harness"]) run("npm", ["run", "build:harness"], dir);

  const [packed] = JSON.parse(run("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], dir));
  const files = new Set<string>(packed.files.map((f: { path: string }) => f.path));
  const mine: string[] = [];

  if (pkg.private) mine.push("still marked private");
  for (const target of promised(pkg)) {
    if (target.endsWith(".ts") && !target.endsWith(".d.ts")) mine.push(`points at TypeScript (${target}); Node won't run it from node_modules`);
    if (target.includes("*")) {
      const prefix = target.split("*")[0];
      if (![...files].some((f) => f.startsWith(prefix))) mine.push(`promises ${target} but ships nothing under ${prefix}`);
    } else if (!files.has(target)) mine.push(`promises ${target} but the tarball doesn't contain it`);
  }
  if (!files.has("LICENSE")) mine.push("ships without LICENSE");
  if (PACKS.includes(name)) {
    const vendored = run("git", ["ls-files", "scripts/sources"], dir).split("\n").filter((f) => /LICEN[CS]E/i.test(f));
    for (const licence of vendored) if (!files.has(licence)) mine.push(`derived from a source whose licence (${licence}) doesn't ship with it`);
  }
  if (name === "verifier" && ![...files].some((f) => f.startsWith("harness-dist/"))) mine.push("ships without harness-dist, so it can't render");

  let onNpm = false;
  try {
    run("npm", ["view", `${pkg.name}@${pkg.version}`, "version"], dir);
    onNpm = true;
  } catch {
    // A 404 means this version isn't published yet, which is the case publishing is for.
  }

  rows.push(`${mine.length ? "✗" : "✓"} ${`${pkg.name}@${pkg.version}`.padEnd(30)} ${String(packed.entryCount).padStart(4)} files ${`${Math.round(packed.unpackedSize / 1024)} KB`.padStart(8)}${onNpm ? "   already on npm" : ""}`);
  for (const m of mine) problems.push(`${pkg.name}: ${m}`);
  (pkg as any).__onNpm = onNpm;
  (pkg as any).__dir = dir;
  if (publish) (globalThis as any).__queue = [...((globalThis as any).__queue ?? []), pkg];
}

console.log(rows.join("\n"));
if (problems.length) {
  console.log(`\n${problems.length} problem(s) — nothing will be published until they're fixed:`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`\nAll ${ORDER.length} tarballs contain what their package.json promises.`);

if (publish) {
  for (const pkg of (globalThis as any).__queue as any[]) {
    if (pkg.__onNpm) {
      console.log(`  skip    ${pkg.name}@${pkg.version} (already published)`);
      continue;
    }
    // Scripts already ran above; provenance comes from publishConfig when run in CI.
    run("npm", ["publish", "--ignore-scripts"], pkg.__dir);
    console.log(`  publish ${pkg.name}@${pkg.version}`);
  }
}
