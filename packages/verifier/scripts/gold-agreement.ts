/**
 * Ranking agreement: does the verifier rank UIs the way a designer does?
 *
 * Verifies every document in the set (3 design systems, light mode, 390 and 1100 px), ranks each
 * group's variants by score, and — when the set's ranking.json has humanRank filled in — reports
 * how often the verifier's ordering matches the designer's, and the mean Kendall tau-b.
 *
 *   npm run gold -w @polyxd/verifier              the hand-made gold set (bench/gold)
 *   npm run gold -w @polyxd/verifier -- --model   the model's own options (bench/rank-set)
 */
import { readFileSync } from "node:fs";
import { launch, verifyDocument, type Report } from "../src/index.ts";

const SET = process.argv.includes("--model") ? "rank-set" : "gold";
const GOLD = new URL(`../../../bench/${SET}/`, import.meta.url);
const registry = JSON.parse(readFileSync(new URL("../../spec/examples/registry/capabilities.json", import.meta.url), "utf8"));
const ranking: { groups: { id: string; variants: string[]; humanRank: string[] | null }[] } = JSON.parse(
  readFileSync(new URL("ranking.json", GOLD), "utf8"),
);
const MATRIX = { themes: ["material3", "carbon", "antd"], modes: ["light" as const], widths: [390, 1100] };

/** Kendall tau-b between two rankings given as maps item → position (lower is better; equal = tie). */
export function kendallTauB(x: Map<string, number>, y: Map<string, number>): number {
  const items = [...x.keys()];
  let concordant = 0, discordant = 0, tiesX = 0, tiesY = 0, pairs = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs++;
      const dx = Math.sign(x.get(items[i])! - x.get(items[j])!);
      const dy = Math.sign(y.get(items[i])! - y.get(items[j])!);
      if (dx === 0) tiesX++;
      if (dy === 0) tiesY++;
      if (dx !== 0 && dy !== 0) dx === dy ? concordant++ : discordant++;
    }
  }
  const denom = Math.sqrt((pairs - tiesX) * (pairs - tiesY));
  return denom === 0 ? 0 : (concordant - discordant) / denom;
}

/** Positions from scores: higher score = better = lower position; equal scores share a position. */
const positionsFromScores = (scores: Map<string, number>) => new Map([...scores].map(([k, s]) => [k, -s]));
const positionsFromRank = (rank: string[]) => new Map(rank.map((k, i) => [k, i]));

/** The human order is matched when every pair the human orders is ordered the same way (strictly) by the verifier. */
function matches(human: Map<string, number>, verifier: Map<string, number>): boolean {
  const items = [...human.keys()];
  for (const a of items) for (const b of items) if (human.get(a)! < human.get(b)! && !(verifier.get(a)! < verifier.get(b)!)) return false;
  return true;
}

const resolve = (group: { variants: string[] }, name: string) => group.variants.find((v) => v === name || v.endsWith(`-${name}`)) ?? name;

const browser = await launch();
const reports = new Map<string, Report>();
try {
  for (const g of ranking.groups) {
    for (const v of g.variants) {
      const doc = JSON.parse(readFileSync(new URL(`${v}.json`, GOLD), "utf8"));
      reports.set(v, await verifyDocument(doc, { ...MATRIX, browser, registry }));
    }
  }
} finally {
  await browser.close();
}

const rows: { id: string; order: string; tau?: number; match?: boolean }[] = [];
let intended = 0;
for (const g of ranking.groups) {
  const scores = new Map(g.variants.map((v) => [v, reports.get(v)!.score]));
  const verifier = positionsFromScores(scores);
  const sorted = [...g.variants].sort((a, b) => scores.get(b)! - scores.get(a)!);
  const order = sorted.map((v, i) => `${v.slice(g.id.length + 1)} (${scores.get(v)})${i < sorted.length - 1 ? (scores.get(v) === scores.get(sorted[i + 1]) ? " = " : " > ") : ""}`).join("");
  if (matches(positionsFromRank(g.variants), verifier)) intended++;
  if (g.humanRank?.length) {
    const human = positionsFromRank(g.humanRank.map((n) => resolve(g, n)));
    rows.push({ id: g.id, order, tau: kendallTauB(human, verifier), match: matches(human, verifier) });
  } else {
    rows.push({ id: g.id, order });
  }
}

console.log(`Verifier ranking (score, ${MATRIX.themes.length} themes × light × ${MATRIX.widths.join("/")} px):\n`);
for (const r of rows) {
  const human = ranking.groups.find((g) => g.id === r.id)!.humanRank;
  const extra = r.tau === undefined ? "" : `   human: ${human!.join(" > ")}   tau ${r.tau.toFixed(2)}${r.match ? "" : "   (disagrees)"}`;
  console.log(`  ${r.id.padEnd(16)} ${r.order}${extra}`);
  for (const v of ranking.groups.find((g) => g.id === r.id)!.variants) {
    const rep = reports.get(v)!;
    const checks = [...new Set([...rep.static, ...rep.targets.flatMap((t) => t.findings)].map((f) => `${f.severity}:${f.check}`))];
    if (checks.length) console.log(`      ${v}: ${checks.join(", ")}`);
  }
}
console.log(`\nVerifier orders a > b > c (the intended order) in ${intended}/${ranking.groups.length} groups.`);

const rated = rows.filter((r) => r.tau !== undefined);
if (!rated.length) {
  console.log("Human ranking pending: fill humanRank in bench/gold/ranking.json (see bench/gold/README.md).");
} else {
  const agreement = rated.filter((r) => r.match).length / rated.length;
  const tau = rated.reduce((s, r) => s + r.tau!, 0) / rated.length;
  console.log(`Human agreement over ${rated.length}/${rows.length} ranked groups: ${(agreement * 100).toFixed(0)}% exact order, mean Kendall tau-b ${tau.toFixed(2)}.`);
  if (rated.length < rows.length) console.log(`${rows.length - rated.length} groups still need a human ranking.`);
}
