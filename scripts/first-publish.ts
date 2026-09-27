/**
 * The first publish of a package that isn't on npm yet. Trusted publishing (the release workflow)
 * can only update packages that exist, so a new package is published once from a signed-in
 * machine (2FA prompt), then told to trust the workflow for every release after. Run by a person:
 *
 *   npm run release:first
 *
 * It builds and checks everything through release.ts first, publishes only what npm doesn't have
 * at all, and prints what it did. Nothing else about releases changes.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO = "visualfart/polyxd";

const CORE = ["spec", "core", "ds-kit", "react", "web", "a2ui", "verifier"];
const PACKS = readdirSync(join(ROOT, "packages"))
  .filter((d) => d.startsWith("ds-") && d !== "ds-kit" && existsSync(join(ROOT, "packages", d, "manifest.json")))
  .sort();
const ORDER = [...CORE, ...PACKS, "polyxd"];

const onNpm = (name: string) => {
  const r = spawnSync("npm", ["view", name, "name"], { encoding: "utf8" });
  return r.status === 0;
};

// A first publish needs a signed-in person. An expired token shows up later as a misleading 404
// on PUT ("not found or you do not have permission"), so check it before doing anything.
const who = spawnSync("npm", ["whoami"], { encoding: "utf8" });
if (who.status !== 0) {
  console.error("You're not signed in to npm (npm whoami failed). Run `npm login`, then `npm whoami`, then try again.");
  process.exit(1);
}
console.log(`Signed in to npm as ${who.stdout.trim()}.`);

console.log("Checking every package first (release:check)…");
execFileSync("npm", ["run", "release:check"], { cwd: ROOT, stdio: "inherit" });

const missing = ORDER.filter((name) => !onNpm(JSON.parse(readFileSync(join(ROOT, "packages", name, "package.json"), "utf8")).name));
if (!missing.length) {
  console.log("Every package already exists on npm; the release workflow can publish them all.");
  process.exit(0);
}
console.log(`\n${missing.length} package(s) not on npm yet: ${missing.join(", ")}\nEach publish may ask for your one-time code.\n`);
for (const name of missing) {
  const dir = join(ROOT, "packages", name);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  console.log(`\n→ ${pkg.name}@${pkg.version}`);
  execFileSync("npm", ["publish", "--access", "public", "--ignore-scripts"], { cwd: dir, stdio: "inherit" });
  // From now on the release workflow may publish this package without a token.
  execFileSync("npm", ["trust", "github", pkg.name, "--repo", REPO, "--file", "release.yml", "--allow-publish", "--allow-stage-publish"], { cwd: ROOT, stdio: "inherit" });
}
console.log(`\nDone. Re-run the release workflow for the tag (gh run rerun <run id>) to publish the rest.`);
