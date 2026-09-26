/**
 * A blind review of two models against the approved flow designs.
 *
 * The verifier scores what can be checked; it can't tell whether a screen looks like the one the
 * designer approved. So for every benchmark request with an approved design (bench/design-set.json),
 * this renders each model's answer in Material 3 (the designs' system) at phone and desktop width,
 * screenshots the design's artboards beside them, and labels the two answers X and Y in an order
 * shuffled per request. A reviewer rates X against Y against the design and writes verdicts.json;
 * --tally then unshuffles the verdicts with the key, which lives outside the review folder.
 *
 *   node packages/verifier/scripts/design-review.ts prepare --a <run dir> --b <run dir> --out <dir> --key <file>
 *   node packages/verifier/scripts/design-review.ts tally --out <dir> --key <file>
 *
 * A run dir is model/runs/<run>; answers come from its requests/ and requests-b2b/ folders.
 * Reviewing is not training: the designs never reach a model (design/flows/README.md).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { flattenTree, isTree } from "@polyxd/spec";
import { launch, renderPage } from "../src/browser.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const DESIGNS = join(ROOT, "design/flows/out/project");
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { a: { type: "string" }, b: { type: "string" }, out: { type: "string" }, key: { type: "string" }, seed: { type: "string" } },
});
const [mode] = positionals;
const out = resolve(values.out ?? "");
const keyFile = resolve(values.key ?? "");
if (!values.out || !values.key || (mode !== "prepare" && mode !== "tally")) {
  console.error("usage: design-review.ts prepare --a <run> --b <run> --out <dir> --key <file> | tally --out <dir> --key <file>");
  process.exit(2);
}

const set: { id: string; fit: string; artboards: string[] }[] = readJson(join(ROOT, "bench/design-set.json")).requests;
const requests = new Map<string, any>(
  [...readJson(join(ROOT, "bench/requests.json")).requests, ...readJson(join(ROOT, "bench/requests-b2b.json")).requests].map((r: any) => [r.id, r]),
);

if (mode === "tally") {
  const key: Record<string, { X: string; Y: string }> = readJson(keyFile);
  const verdicts: { id: string; winner: "X" | "Y" | "tie"; reason?: string }[] = readJson(join(out, "verdicts.json"));
  const tally: Record<string, number> = { a: 0, b: 0, tie: 0 };
  const rows = verdicts.map((v) => {
    const side = v.winner === "tie" ? "tie" : key[v.id]?.[v.winner];
    tally[side ?? "tie"]++;
    return { id: v.id, winner: side, reason: v.reason };
  });
  writeFileSync(join(out, "result.json"), JSON.stringify({ tally, rows }, null, 2) + "\n");
  console.log(JSON.stringify(tally));
  process.exit(0);
}

// A small seeded shuffle, so a review can be rebuilt exactly.
let seed = Number(values.seed ?? Date.now()) >>> 0;
const coin = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) < 0.5;

const answer = (run: string, id: string) => {
  for (const dir of ["requests", "requests-b2b"]) {
    const f = join(resolve(run), dir, `${id}.json`);
    if (!existsSync(f)) continue;
    const doc = readJson(f).doc;
    if (!doc) return undefined;
    try {
      return { ...(isTree(doc) ? flattenTree(doc) : doc), data: requests.get(id)?.data ?? {} };
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const canvas = readJson(join(DESIGNS, "canvas.json")).boards as Record<string, { w: number; h: number; title: string }>;
mkdirSync(out, { recursive: true });
const browser = await launch();
const key: Record<string, { X: string; Y: string }> = {};
const manifest: any[] = [];
try {
  for (const item of set) {
    const req = requests.get(item.id);
    if (!req) continue;
    const dir = join(out, item.id);
    mkdirSync(dir, { recursive: true });

    const designs: string[] = [];
    for (const board of item.artboards) {
      const size = canvas[`${board}.dc.html`];
      const page = await browser.newPage({ viewport: { width: size?.w ?? 390, height: size?.h ?? 844 } });
      await page.goto(`file://${join(DESIGNS, `${board}.dc.html`)}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      const file = `design-${board}.png`;
      await page.screenshot({ path: join(dir, file), fullPage: true });
      await page.close();
      designs.push(file);
    }

    const flip = coin();
    key[item.id] = flip ? { X: "b", Y: "a" } : { X: "a", Y: "b" };
    const sides: Record<string, string[]> = { X: [], Y: [] };
    for (const label of ["X", "Y"] as const) {
      const doc = answer(key[item.id][label] === "a" ? values.a! : values.b!, item.id);
      if (!doc) continue; // no answer at all: the review says so, and that side loses
      for (const width of [390, 1100]) {
        const { page } = await renderPage(browser, doc, { theme: "material3", mode: "light", width });
        const file = `${label}-${width}.png`;
        await page.screenshot({ path: join(dir, file), fullPage: true });
        await page.close();
        sides[label].push(file);
      }
    }
    manifest.push({ id: item.id, request: req.request, fit: item.fit, data: req.data, designs, X: sides.X, Y: sides.Y });
    console.log(`${item.id}: ${designs.length} design(s), X ${sides.X.length ? "rendered" : "missing"}, Y ${sides.Y.length ? "rendered" : "missing"}`);
  }
} finally {
  await browser.close();
}
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(keyFile, JSON.stringify(key, null, 2) + "\n");
console.log(`${manifest.length} requests → ${out}`);
