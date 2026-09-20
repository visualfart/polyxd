/**
 * Picks training examples: for each scenario, scores every candidate with the verifier and keeps
 * the best one if it is valid and scores at least --min (default 90). Ties go to the candidate that
 * wires up more of the capabilities the host offered (the main weakness found in Phase 4).
 *
 * node packages/verifier/scripts/select-candidates.ts model/data/candidates/<model> [--min 90]
 * Writes model/data/selected.jsonl: { id, user, assistant } with the assistant turn in tree form.
 *
 * --require-wiring: when the host offers capabilities, a candidate must attach at least one of them to
 *   something a person or agent can operate, and candidates are ranked by score plus wiring. Without it,
 *   selection by verifier score alone favours timid interfaces with nothing to do (research log, Phase 5).
 * --reward: rank by the full training reward (decision 0003) instead of score plus wiring: it also asks
 *   whether a scripted agent can set one of the offered capabilities in motion. Slower (one extra render
 *   per candidate), and what expert-iteration rounds use.
 * --max-nocap F: at most this fraction of kept examples may come from scenarios offering no capability.
 */

import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { validateDocument, flattenTree, isTree } from "@polyxd/spec";
import { launch, rewardFor, verifyDocument } from "../src/index.ts";

/** Capabilities attached to an operable control: Action, Form submit, Card/Table row actions, Toggle, Confirm, Comparison, Steps finish. */
function wiredCapabilities(flat: any): Set<string> {
  const out = new Set<string>();
  const add = (a: any) => typeof a?.event?.name === "string" && out.add(a.event.name);
  for (const c of flat.components ?? []) {
    if (c.component === "Action" || c.component === "Card" || c.component === "Toggle") add(c.action);
    if (c.component === "Table") add(c.rowAction);
    for (const p of ["submit", "confirm", "finish", "choose"]) add(c[p]?.action);
  }
  return out;
}
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { min: { type: "string" }, out: { type: "string" }, "require-wiring": { type: "boolean" }, "max-nocap": { type: "string" }, reward: { type: "boolean" } },
});
const dir = resolve(positionals[0] ?? "");
if (!existsSync(dir)) {
  console.error("Usage: select-candidates.ts <model/data/candidates/MODEL> [--min 90]");
  process.exit(2);
}
const min = Number(values.min ?? 90);
const outPath = resolve(values.out ?? join(dir, "../../selected.jsonl"));
const registry = JSON.parse(readFileSync(new URL("../../../bench/registry.json", import.meta.url), "utf8"));
const hostRegistry = (caps: string[]) => ({ name: registry.name, capabilities: Object.fromEntries(caps.filter((c) => registry.capabilities[c]).map((c) => [c, registry.capabilities[c]])) });

writeFileSync(outPath, "");
const browser = await launch();
let total = 0;
const keptRows: any[] = [];
const scores: number[] = [];
try {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const { scenario, user, samples } = JSON.parse(readFileSync(join(dir, f), "utf8"));
    total++;
    let best: { tree: any; score: number; wired: number; reward: number } | null = null;
    for (const s of samples) {
      if (!s.doc || !isTree(s.doc)) continue;
      let flat: any;
      try {
        flat = { ...flattenTree(s.doc), data: scenario.data };
      } catch {
        continue;
      }
      if (!validateDocument(flat).valid) continue;
      const offered: string[] = scenario.capabilities ?? [];
      const wiredSet = wiredCapabilities(flat);
      const wired = offered.filter((c) => wiredSet.has(c)).length;
      if (values["require-wiring"] && offered.length && wired === 0) continue;
      let scored: { score: number; reward: number };
      try {
        scored = values.reward
          ? await rewardFor(flat, browser, offered, { registry: hostRegistry(offered) })
          : { score: (await verifyDocument(flat, { browser, registry: hostRegistry(offered), themes: ["material3"], modes: ["light"], widths: [390] })).score, reward: 0 };
      } catch (e) {
        console.log(`  !  ${scenario.id}: could not be scored (${(e as Error).message.split("\n")[0]})`);
        continue;
      }
      const rank = (x: { score: number; wired: number; reward: number }) =>
        values.reward ? x.reward : x.score + (values["require-wiring"] && offered.length ? (20 * x.wired) / offered.length : 0);
      const cand = { tree: s.doc, score: scored.score, wired, reward: scored.reward };
      if (!best || rank(cand) > rank(best) || (rank(cand) === rank(best) && wired > best.wired)) best = cand;
    }
    if (best) scores.push(best.score);
    if (best && best.score >= min) keptRows.push({ id: scenario.id, user, assistant: JSON.stringify(best.tree), score: best.score, nocap: !(scenario.capabilities ?? []).length });
    console.log(`${best ? String(best.score).padStart(3) : "  –"} ${best && best.score >= min ? "keep" : "drop"}  ${scenario.id}  ${scenario.request.slice(0, 60)}`);
  }
} finally {
  await browser.close();
}
// Cap examples from scenarios where the app could do nothing, so they don't dominate.
const maxNocap = values["max-nocap"] !== undefined ? Number(values["max-nocap"]) : 1;
const withCap = keptRows.filter((r) => !r.nocap);
const nocap = keptRows.filter((r) => r.nocap).slice(0, Math.floor((maxNocap * withCap.length) / Math.max(1e-9, 1 - maxNocap)));
const final = [...withCap, ...nocap];
for (const { nocap: _n, ...r } of final) appendFileSync(outPath, JSON.stringify(r) + "\n");
const kept = final.length;
console.log(`\nkept ${kept}/${total} (${nocap.length} without capabilities) scenarios (best candidate ≥ ${min}); mean best score ${(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)).toFixed(1)} → ${outPath}`);
