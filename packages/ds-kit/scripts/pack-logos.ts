#!/usr/bin/env node
/**
 * Pack logos: writes every template pack's mark from its tokens, and checks every pack's logo.
 *
 *   node packages/ds-kit/scripts/pack-logos.ts           # (re)write the template marks
 *   node packages/ds-kit/scripts/pack-logos.ts --check   # fail if anything is missing or stale
 *
 * A design-system pack's logo is its owner's official file, downloaded once and recorded in the
 * manifest (`logo.source`, `logo.guidelines`); this script never writes those, only checks that
 * they are there, recorded and shipped. A template's mark is Polyxd's, drawn by `templateMark`
 * from the pack's own tokens, so it is regenerated here and a stale one is a failure.
 */
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDesignSystem } from "@polyxd/spec";
import { templateMark } from "../src/logo.ts";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));

interface PackEntry {
  dir: string;
  manifest: any;
  template: boolean;
}

export async function packs(): Promise<PackEntry[]> {
  const dirs = (await readdir(PACKAGES)).filter((d) => d.startsWith("ds-") && existsSync(join(PACKAGES, d, "manifest.json"))).sort();
  return Promise.all(
    dirs.map(async (d) => {
      const manifest = JSON.parse(await readFile(join(PACKAGES, d, "manifest.json"), "utf8"));
      return { dir: join(PACKAGES, d), manifest, template: manifest.template === true };
    }),
  );
}

/** The mark a template pack should have, from the tokens of its default mode. */
export async function markFor(dir: string): Promise<string> {
  const { manifest, modes } = await loadDesignSystem(join(dir, "manifest.json"));
  const tokens = modes.get(manifest.defaultMode);
  if (!tokens) throw new Error(`${dir}: no tokens for default mode ${manifest.defaultMode}`);
  const name = (manifest as { displayName?: string }).displayName ?? manifest.name;
  return templateMark(tokens, `${name}, a Polyxd template`);
}

/** Everything wrong with the packs' logos; empty when all is well. */
export async function logoProblems(): Promise<string[]> {
  const problems: string[] = [];
  for (const { dir, manifest, template } of await packs()) {
    const name = manifest.name;
    const logo = manifest.logo;
    if (!logo) {
      problems.push(`${name}: manifest has no logo`);
      continue;
    }
    const readme = await readFile(join(dir, "README.md"), "utf8");
    if (!/^## Logo$/m.test(readme)) problems.push(`${name}: README has no Logo section`);
    if (!logo.file) {
      // A protected mark: the words stand in for it, and the manifest says why and whose rules.
      if (!logo.text || !logo.note || !/^https:\/\//.test(logo.guidelines ?? "")) problems.push(`${name}: a logo without a file needs text, a note saying why, and the guidelines`);
      continue;
    }
    if (!existsSync(join(dir, logo.file))) problems.push(`${name}: ${logo.file} is missing`);
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    if (!pkg.files?.includes(logo.file)) problems.push(`${name}: package.json "files" does not ship ${logo.file}`);
    for (const extra of logo.dark ? [logo.dark] : []) {
      if (!existsSync(join(dir, extra))) problems.push(`${name}: ${extra} is missing`);
      if (!pkg.files?.includes(extra)) problems.push(`${name}: package.json "files" does not ship ${extra}`);
    }
    if (template) {
      if (logo.source !== "Polyxd") problems.push(`${name}: a template's mark is Polyxd's own; logo.source should be "Polyxd"`);
      if (existsSync(join(dir, logo.file)) && (await readFile(join(dir, logo.file), "utf8")) !== (await markFor(dir)))
        problems.push(`${name}: ${logo.file} no longer matches the pack's tokens; run node packages/ds-kit/scripts/pack-logos.ts`);
    } else {
      if (!/^https:\/\//.test(logo.source ?? "")) problems.push(`${name}: logo.source should be the official URL the file came from`);
      if (!/^https:\/\//.test(logo.guidelines ?? "")) problems.push(`${name}: logo.guidelines should link the owner's brand or trademark guidelines`);
    }
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--check")) {
    const problems = await logoProblems();
    for (const p of problems) console.error(p);
    console.log(problems.length ? `\n${problems.length} problem(s)` : "Every pack has its logo, recorded and shipped; the template marks match their tokens.");
    process.exit(problems.length ? 1 : 0);
  }
  for (const { dir, manifest, template } of await packs()) {
    if (!template) continue;
    await writeFile(join(dir, manifest.logo?.file ?? "logo.svg"), await markFor(dir));
    console.log(`wrote ${manifest.name} mark`);
  }
}
