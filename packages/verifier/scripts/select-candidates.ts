/**
 * Picks training examples: for each scenario, scores every candidate with the verifier and keeps
 * the best one if it is valid and scores at least --min (default 90). Ties go to the candidate that
 * wires up more of the capabilities the host offered (the main weakness found in Phase 4).
 *
 * node packages/verifier/scripts/select-candidates.ts model/data/candidates/<model> [--min 90]
 * Writes model/data/selected.jsonl: { id, user, assistant } with the assistant turn in tree form.
 */
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { validateDocument, flattenTree, isTree } from "@polyxd/spec";
import { launch, verifyDocument } from "../src/index.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { min: { type: "string" }, out: { type: "string" } } });
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
let kept = 0;
let total = 0;
const scores: number[] = [];
try {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const { scenario, user, samples } = JSON.parse(readFileSync(join(dir, f), "utf8"));
    total++;
    let best: { tree: any; score: number; wired: number } | null = null;
    for (const s of samples) {
      if (!s.doc || !isTree(s.doc)) continue;
      let flat: any;
      try {
        flat = { ...flattenTree(s.doc), data: scenario.data };
      } catch {
        continue;
      }
      if (!validateDocument(flat).valid) continue;
      const rep = await verifyDocument(flat, { browser, registry: hostRegistry(scenario.capabilities ?? []), themes: ["material3"], modes: ["light"], widths: [390] });
      const text = JSON.stringify(flat);
      const wired = (scenario.capabilities ?? []).filter((c: string) => text.includes(`"${c}"`)).length;
      if (!best || rep.score > best.score || (rep.score === best.score && wired > best.wired)) best = { tree: s.doc, score: rep.score, wired };
    }
    if (best) scores.push(best.score);
    if (best && best.score >= min) {
      kept++;
      appendFileSync(outPath, JSON.stringify({ id: scenario.id, user, assistant: JSON.stringify(best.tree), score: best.score }) + "\n");
    }
    console.log(`${best ? String(best.score).padStart(3) : "  –"} ${best && best.score >= min ? "keep" : "drop"}  ${scenario.id}  ${scenario.request.slice(0, 60)}`);
  }
} finally {
  await browser.close();
}
console.log(`\nkept ${kept}/${total} scenarios (best candidate ≥ ${min}); mean best score ${(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)).toFixed(1)} → ${outPath}`);
