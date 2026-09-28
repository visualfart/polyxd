/**
 * The first publish of a package that isn't on npm yet. Trusted publishing (the release workflow)
 * can only update packages that exist, so a new package is published once from a signed-in
 * machine (2FA prompt), then told to trust the workflow for every release after. Run by a person:
 *
 *   npm run release:first
 *   npm run release:first -- --trust-only     only the trust step (everything is already published)
 *
 * Trusting a package is an account change, so npm wants a fresh two-factor code for it even when
 * publishing didn't: the script asks for one from your authenticator app, reuses it while npm
 * accepts it, and asks again when it expires.
 * It builds and checks everything through release.ts first, publishes only what npm doesn't have
 * at all, and prints what it did. Nothing else about releases changes.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO = "visualfart/polyxd";

const CORE = ["spec", "core", "ds-kit", "react", "web", "a2ui", "verifier", "runtime", "mcp"];
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

const trustOnly = process.argv.includes("--trust-only");
if (!trustOnly) {
  console.log("Checking every package first (release:check)…");
  execFileSync("npm", ["run", "release:check"], { cwd: ROOT, stdio: "inherit" });
}

const pkgOf = (name: string) => JSON.parse(readFileSync(join(ROOT, "packages", name, "package.json"), "utf8")) as { name: string; version: string };

/**
 * Whether the release workflow is already a trusted publisher of this package. Reading trust is an
 * account operation too: without a recent approval npm refuses (EOTP), which is "can't tell", not
 * "untrusted", so the caller gets a fresh approval and asks again.
 */
const trustState = (name: string): boolean | "ask" => {
  const r = spawnSync("npm", ["trust", "list", name, "--json"], { encoding: "utf8" });
  if (/EOTP|one-time password/i.test(`${r.stdout}${r.stderr}`)) return "ask";
  return r.status === 0 && r.stdout.includes(`"file": "release.yml"`) && r.stdout.includes(REPO);
};
/** One approval in the browser (npm offers to skip the next ones for five minutes). */
const approve = (name: string) => {
  console.log(`\nnpm needs you to approve account changes in the browser. Press Enter when it asks, approve, and tick "skip for 5 minutes" if offered.\n`);
  spawnSync("npm", ["trust", "list", name], { cwd: ROOT, stdio: "inherit" });
};
const trusted = (name: string) => {
  let t = trustState(name);
  if (t === "ask") {
    approve(name);
    t = trustState(name);
  }
  if (t === "ask") throw new Error(`npm still wants approval to read ${name}'s trust settings; run this again and approve in the browser.`);
  return t;
};

/**
 * The packages the signed-in account can write. A package published a minute ago is here straight
 * away, while its public page can keep answering 404 for a while (the CDN caches the old 404).
 */
const owned = () => {
  const r = spawnSync("npm", ["access", "list", "packages", who.stdout.trim(), "--json"], { encoding: "utf8" });
  try {
    return new Set(Object.keys(JSON.parse(r.stdout)));
  } catch {
    return new Set<string>();
  }
};
const exists = (name: string) => owned().has(name) || onNpm(name);

/** A one-time code from the authenticator app, kept while npm keeps accepting it. */
let otp = "";
const ask = async (q: string) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(q)).trim();
  rl.close();
  return a;
};

/**
 * Trust needs two-factor authentication with a typed one-time code: npm answers 400 without one,
 * and an account whose second factor is a passkey or security key has no code to give. So: try once
 * with npm's own prompts; if refused, ask for a code (Enter alone skips); with none, stop trying on
 * the command line and hand over the web steps instead, which work with a passkey.
 */
let web = false;
const trust = async (name: string) => {
  if (web) return false;
  for (let i = 0; i < 3; i++) {
    const args = ["trust", "github", name, "--repo", REPO, "--file", "release.yml", "--yes", ...(otp ? [`--otp=${otp}`] : [])];
    const r = spawnSync("npm", args, { cwd: ROOT, stdio: "inherit" });
    if (r.status === 0 || trustState(name) === true) {
      console.log(`  trusted`);
      return true;
    }
    otp = await ask("  npm refused. If you have an authenticator app for npm, enter a code; if your second factor is a passkey, press Enter: ");
    if (!/^\d{6,8}$/.test(otp)) {
      otp = "";
      web = true;
      return false;
    }
  }
  return false;
};

/** The web steps, one link per package: the settings page takes a passkey. */
const webSteps = (names: string[]) => {
  console.log(`\nSet these up on npmjs.com instead (a passkey works there). For each package: open the link, go to Trusted publishing, choose GitHub Actions, and enter:
  Organization or user: ${REPO.split("/")[0]}
  Repository:           ${REPO.split("/")[1]}
  Workflow filename:    release.yml
  Environment:          (leave empty)
then Set up connection.\n`);
  for (const n of names) console.log(`  https://www.npmjs.com/package/${n}/access`);
  console.log(`\nRun \`npm run release:first -- --trust-only\` afterwards to confirm every package is covered.`);
};

const have = owned();
const missing = trustOnly ? [] : ORDER.filter((name) => !have.has(pkgOf(name).name) && !onNpm(pkgOf(name).name));
if (missing.length) console.log(`\n${missing.length} package(s) not on npm yet: ${missing.join(", ")}\nEach publish may ask you to authenticate.\n`);
for (const name of missing) {
  const dir = join(ROOT, "packages", name);
  const pkg = pkgOf(name);
  console.log(`\n→ ${pkg.name}@${pkg.version}`);
  const r = spawnSync("npm", ["publish", "--access", "public", "--ignore-scripts"], { cwd: dir, stdio: "inherit" });
  // A package published a moment ago can still read as missing; publishing it again fails, which is fine if it's there now.
  if (r.status !== 0 && !exists(pkg.name)) throw new Error(`npm publish failed for ${pkg.name}`);
}

// Every package, new or not, must trust the release workflow, or the next release can't publish it.
// Checking all of them also finishes a run that stopped between a publish and its trust.
const untrusted = ORDER.map((name) => pkgOf(name).name).filter((name) => !trusted(name));
if (untrusted.length) console.log(`\n${untrusted.length} package(s) don't trust the release workflow yet: ${untrusted.join(", ")}\n`);
const left: string[] = [];
for (const name of untrusted) {
  if (!web) console.log(`\n→ trust ${name}`);
  if (!(await trust(name))) left.push(name);
}
if (left.length) {
  webSteps(left);
  process.exit(1);
}

if (!missing.length && !untrusted.length) console.log("\nEvery package is on npm and trusts the release workflow.");
console.log(`\nDone. Re-run the release workflow for the tag (gh run rerun <run id>) to publish the rest.`);
