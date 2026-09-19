/**
 * Scores a model run (model/runs/<name>) against the benchmark:
 *   requests/  → validity, verifier score, expected components/pattern/capability, agent task success, latency
 *   sequences/ → consistency between consecutive turns (interface memory)
 *
 * npm run score -w @polyxd/verifier -- ../../model/runs/Qwen3.5-4B-4bit
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateDocument } from "@polyxd/spec";
import { launch, verifyDocument, compare, type Task } from "../src/index.ts";

const runDir = resolve(process.argv[2] ?? "");
if (!existsSync(runDir)) {
  console.error("Usage: score-run.ts <model/runs/NAME>");
  process.exit(2);
}
const bench = new URL("../../../bench/", import.meta.url);
const readJson = (p: string | URL) => JSON.parse(readFileSync(p, "utf8"));
const requests: any[] = readJson(new URL("requests.json", bench)).requests;
const registry = readJson(new URL("registry.json", bench));
const byId = new Map(requests.map((r) => [r.id, r]));

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "—");

/** The host exposes only the capabilities listed for this request. */
const hostRegistry = (r: any) => ({ name: registry.name, capabilities: Object.fromEntries((r.capabilities ?? []).map((c: string) => [c, registry.capabilities[c]]).filter(([, v]: any) => v)) });

function expectations(doc: any, r: any): { hit: number; total: number; missed: string[] } {
  const e = r.expect ?? {};
  const types = new Set((doc.components ?? []).map((c: any) => c.component));
  const missed: string[] = [];
  let total = 0;
  for (const c of e.components ?? []) {
    total++;
    if (!types.has(c)) missed.push(`component ${c}`);
  }
  if (e.pattern) {
    total++;
    if (doc.surface?.pattern !== e.pattern) missed.push(`pattern ${e.pattern}`);
  }
  if (e.capability) {
    total++;
    if (!JSON.stringify(doc).includes(`"${e.capability}"`)) missed.push(`capability ${e.capability}`);
  }
  return { hit: total - missed.length, total, missed };
}

const rows: any[] = [];
const reqDir = join(runDir, "requests");
if (existsSync(reqDir)) {
  const browser = await launch();
  try {
    for (const f of readdirSync(reqDir).filter((f) => f.endsWith(".json")).sort()) {
      const out = readJson(join(reqDir, f));
      const r = byId.get(out.id);
      if (!r) continue;
      const row: any = { id: out.id, parsed: !!out.doc, valid: false, score: 0, task: r.task ? false : null, expectHit: 0, expectTotal: 0, total_s: out.total_s, ttft_s: out.ttft_s, tps: out.generation_tps, tokens: out.generation_tokens, problems: [] as string[] };
      if (out.doc) {
        const doc = { ...out.doc, data: r.data };
        const v = validateDocument(doc);
        row.valid = v.valid;
        if (!v.valid) row.problems.push(...v.issues.filter((i) => i.severity === "error").slice(0, 3).map((i) => `${i.at}: ${i.message}`));
        const ex = expectations(doc, r);
        row.expectHit = ex.hit;
        row.expectTotal = ex.total;
        if (ex.missed.length) row.problems.push(`missing ${ex.missed.join(", ")}`);
        if (v.valid) {
          const task: Task[] = r.task ? [{ id: r.id, document: r.id, instruction: r.task.instruction, steps: r.task.steps, expect: r.task.expect }] : [];
          const rep = await verifyDocument(doc, { browser, registry: hostRegistry(r), tasks: task, themes: ["material3"], modes: ["light"], widths: [390, 1100] });
          row.score = rep.score;
          if (r.task) row.task = rep.agentRuns > 0 && rep.agentSuccess === rep.agentRuns;
          const findings = [...rep.static, ...rep.targets.flatMap((t) => t.findings)].filter((x) => x.severity === "error");
          row.problems.push(...[...new Set(findings.map((x) => `${x.check}: ${x.message}`))].slice(0, 3));
          if (r.task && !row.task) row.problems.push(`task: ${rep.targets.flatMap((t) => t.agent).find((a) => !a.success)?.error?.slice(0, 160)}`);
        }
      } else {
        row.problems.push(out.error);
      }
      rows.push(row);
      console.log(`${row.valid ? String(row.score).padStart(3) : "  –"}  ${row.task === null ? " " : row.task ? "✓" : "✗"}  ${out.id}${row.problems.length ? `  ·  ${row.problems[0]}` : ""}`);
    }
  } finally {
    await browser.close();
  }
}

const seqRows: any[] = [];
for (const kind of ["sequences", "sequences-nomem"]) {
  const dir = join(runDir, kind);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const s = readJson(join(dir, f));
    const pairs: number[] = [];
    for (let i = 1; i < s.turns.length; i++) {
      const [a, b] = [s.turns[i - 1].doc, s.turns[i].doc];
      if (a && b && validateDocument({ ...a, data: s.turns[i - 1].data }).valid && validateDocument({ ...b, data: s.turns[i].data }).valid) pairs.push(compare(a, b).score);
      else pairs.push(0);
    }
    seqRows.push({ kind, id: s.id, consistency: pairs.length ? pairs.reduce((x, y) => x + y, 0) / pairs.length : 0 });
  }
}

const n = rows.length;
const withTask = rows.filter((r) => r.task !== null);
const summary = {
  run: runDir.split("/").slice(-1)[0],
  requests: n,
  parseRate: pct(rows.filter((r) => r.parsed).length, n),
  validRate: pct(rows.filter((r) => r.valid).length, n),
  meanScore: n ? Math.round(rows.reduce((s, r) => s + r.score, 0) / n) : 0,
  taskSuccess: `${withTask.filter((r) => r.task).length}/${withTask.length}`,
  expectations: pct(rows.reduce((s, r) => s + r.expectHit, 0), rows.reduce((s, r) => s + r.expectTotal, 0)),
  medianLatency_s: median(rows.map((r) => r.total_s)),
  medianTtft_s: median(rows.map((r) => r.ttft_s)),
  medianTps: median(rows.map((r) => r.tps)),
  consistency: Object.fromEntries(["sequences", "sequences-nomem"].map((k) => [k, seqRows.filter((s) => s.kind === k).length ? +(seqRows.filter((s) => s.kind === k).reduce((a, s) => a + s.consistency, 0) / seqRows.filter((s) => s.kind === k).length).toFixed(3) : null])),
};
writeFileSync(join(runDir, "summary.json"), JSON.stringify({ summary, rows, sequences: seqRows }, null, 2));
console.log("\n" + JSON.stringify(summary, null, 2));
