/**
 * Checks that everything this repository redistributes is accounted for.
 *
 *   npm run check:licences
 *
 * Three things go wrong over time and none of them are visible in a diff: a pack vendors token
 * files and forgets the licence beside them; a manifest records provenance with no licence named;
 * a dependency arrives under terms nobody chose. This fails on each.
 *
 * It is deliberately strict about vendored material, because that is the part this repository
 * actually copies. Dependencies are fetched from npm by whoever builds, so they are reported
 * against an allowlist rather than reproduced.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const problems: string[] = [];
const note = (s: string) => problems.push(s);

/** Licences a dependency may be under without anyone being asked. */
const ALLOWED = /^(MIT|Apache-2\.0|ISC|BSD-[23]-Clause|0BSD|CC0-1\.0|Unlicense|MIT OR Apache-2\.0|MPL-2\.0|\(MIT OR Apache-2\.0\)|\(Apache-2\.0 AND MIT\))$/;
/** Licences that are fine but need saying out loud in NOTICE. */
const NAMED_IN_NOTICE = ["axe-core", "gsap"];

// ---------- Vendored material ----------

const packs = readdirSync(join(REPO, "packages")).filter((d) => d.startsWith("ds-") && existsSync(join(REPO, "packages", d, "manifest.json")));
for (const pack of packs.sort()) {
  const dir = join(REPO, "packages", pack);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const provenance = manifest.provenance ?? [];
  if (!provenance.length) note(`${pack}: manifest records no provenance`);
  for (const p of provenance) {
    if (!p.license) note(`${pack}: provenance "${p.source}" names no licence`);
    if (!p.version && !String(p.source).startsWith("Polyxd")) note(`${pack}: provenance "${p.source}" is not pinned to a version`);
  }
  const sources = join(dir, "scripts/sources");
  if (!existsSync(sources)) {
    // A pack that computes its values (Material 3's tonal palettes) may vendor nothing.
    if (provenance.some((p: any) => !String(p.source).startsWith("Polyxd"))) note(`${pack}: reads upstream sources but vendors none`);
    continue;
  }
  const files = readdirSync(sources, { recursive: true, encoding: "utf8" });
  if (!files.some((f) => /LICEN[CS]E/i.test(f))) note(`${pack}: vendors sources with no licence file beside them`);
}

// ---------- The NOTICE itself ----------

const noticePath = join(REPO, "NOTICE");
if (!existsSync(noticePath)) note("NOTICE is missing");
else {
  const notice = readFileSync(noticePath, "utf8");
  for (const pack of packs) {
    const name = JSON.parse(readFileSync(join(REPO, "packages", pack, "manifest.json"), "utf8")).displayName;
    if (!notice.includes(`@polyxd/${pack}`)) note(`NOTICE does not mention ${pack} (${name})`);
  }
  for (const dep of NAMED_IN_NOTICE) if (!notice.includes(dep)) note(`NOTICE does not explain ${dep}, whose terms are not a plain permissive licence`);
  if (!/not affiliated with/i.test(notice)) note("NOTICE does not disclaim affiliation with the design systems it names");
}

// ---------- Dependencies ----------

const workspaces = ["packages/spec", "packages/core", "packages/react", "packages/web", "packages/verifier", "packages/runtime", "packages/mcp", "packages/server", "packages/a2ui", "packages/ds-kit", "apps/site", "apps/gallery"];
const seen = new Map<string, string>();
for (const w of workspaces) {
  const path = join(REPO, w, "package.json");
  if (!existsSync(path)) continue;
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (name.startsWith("@polyxd/")) continue;
    const installed = join(REPO, "node_modules", name, "package.json");
    if (!existsSync(installed)) continue;
    const licence = JSON.parse(readFileSync(installed, "utf8")).license;
    seen.set(name, typeof licence === "string" ? licence : JSON.stringify(licence ?? "UNSTATED"));
  }
}
for (const [name, licence] of [...seen].sort()) {
  if (ALLOWED.test(licence)) continue;
  if (NAMED_IN_NOTICE.includes(name)) continue;
  note(`${name} is under "${licence}", which is neither allowlisted nor explained in NOTICE`);
}

console.log(`${packs.length} packs, ${seen.size} dependencies checked.`);
if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(`\n${problems.length} problem(s).`);
  process.exit(1);
}
console.log("Everything redistributed is licensed, pinned and named in NOTICE.");
