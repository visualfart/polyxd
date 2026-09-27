/**
 * Renderer conformance: every spec example and every demo document, rendered by both shipped
 * renderers (React and Web Components) in 13 packs × light/dark × 390/1100, must score 100 and
 * give the same fingerprint (components in order, ARIA tree, visible text), the same findings and
 * the same agent-task results. Reports per document and per renderer; exits 1 on any difference.
 *
 *   npm run conformance -w @polyxd/verifier
 *   node scripts/conformance.ts --only money-send-form --packs material3,govuk --widths 390 --concurrency 4 --json out.json
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { HARNESSES, launch, verifyDocument, compareFingerprints, type Report, type TargetReport } from "../src/index.ts";

const { values } = parseArgs({
  options: {
    only: { type: "string" },
    packs: { type: "string" },
    modes: { type: "string" },
    widths: { type: "string" },
    concurrency: { type: "string" },
    json: { type: "string" },
    "no-tasks": { type: "boolean" },
  },
});
const list = (v: string | undefined) => v?.split(",").map((s) => s.trim()).filter(Boolean);
const PACKS = list(values.packs) ?? ["material3", "carbon", "antd", "fluent", "shadcn", "bootstrap", "mantine", "radix", "polaris", "primer", "spectrum", "govuk", "chakra"];
const MODES = (list(values.modes) as ("light" | "dark")[]) ?? ["light", "dark"];
const WIDTHS = list(values.widths)?.map(Number) ?? [390, 1100];
const CONCURRENCY = Number(values.concurrency ?? 6);

const here = new URL("../", import.meta.url);
const read = async (u: URL) => JSON.parse(await readFile(u, "utf8"));

interface Doc {
  name: string;
  doc: any;
  tasks: any[];
  registry?: any;
  rules?: any[];
}

/** Every spec example (with its agent tasks) and every demo intent and authored screen. */
async function documents(): Promise<Doc[]> {
  const out: Doc[] = [];
  const examples = new URL("../spec/examples/", here);
  const registry = await read(new URL("registry/capabilities.json", examples));
  const tasks: any[] = values["no-tasks"] ? [] : (await read(new URL("../../bench/tasks.json", here))).tasks;
  for (const f of (await readdir(examples)).filter((f) => f.endsWith(".json")).sort()) {
    const name = f.replace(".json", "");
    out.push({ name, doc: await read(new URL(f, examples)), tasks: tasks.filter((t) => t.document === name), registry });
  }
  const demos = new URL("../../apps/demos/", here);
  for (const demo of ["halden", "foundry", "wexley", "quay"]) {
    const reg = await read(new URL(`${demo}/registry.json`, demos)).catch(() => undefined);
    const direction = await read(new URL(`${demo}/direction.json`, demos)).catch(() => undefined);
    for (const kind of ["intents", "authored"]) {
      const dir = new URL(`${demo}/${kind}/`, demos);
      for (const f of (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort()) {
        out.push({ name: `${demo}/${f.replace(".json", "")}`, doc: (await read(new URL(f, dir))).document, tasks: [], registry: reg, rules: direction?.rules });
      }
    }
  }
  return values.only ? out.filter((d) => d.name.includes(values.only!)) : out;
}

interface Row {
  name: string;
  react: number;
  web: number;
  renders: number;
  /** Targets whose fingerprints differ */
  fingerprint: number;
  /** Targets whose findings differ */
  findings: number;
  /** Targets whose agent results differ */
  agent: number;
  differences: string[];
}

const where = (t: TargetReport) => `${t.theme}/${t.mode}/${t.width}`;
const findingKey = (t: TargetReport) => t.findings.map((f) => `${f.severity} ${f.check}${f.count ? ` ×${f.count}` : ""}`).sort().join("; ");
const agentKey = (t: TargetReport) => t.agent.map((a) => `${a.task}:${a.success ? "ok" : "fail"}`).join("; ");

function compare(name: string, react: Report, web: Report): Row {
  const row: Row = { name, react: react.score, web: web.score, renders: react.targets.length, fingerprint: 0, findings: 0, agent: 0, differences: [] };
  const note = (s: string) => row.differences.length < 12 && row.differences.push(s);
  for (const f of react.static.filter((f) => f.severity === "error")) note(`static (both): ${f.check} ${f.message}`);
  for (const rt of react.targets) {
    const wt = web.targets.find((t) => where(t) === where(rt));
    if (!wt) {
      row.fingerprint++;
      note(`${where(rt)}: web did not render`);
      continue;
    }
    if (rt.fingerprint && wt.fingerprint) {
      const diffs = compareFingerprints(rt.fingerprint, wt.fingerprint);
      if (diffs.length) {
        row.fingerprint++;
        for (const d of diffs) note(`${where(rt)}: ${d}`);
      }
    }
    if (findingKey(rt) !== findingKey(wt)) {
      row.findings++;
      note(`${where(rt)}: findings react [${findingKey(rt) || "none"}] vs web [${findingKey(wt) || "none"}]`);
      for (const f of wt.findings) if (!rt.findings.some((x) => x.check === f.check)) note(`${where(rt)}: web only: ${f.check} ${f.message}`);
      for (const f of rt.findings) if (!wt.findings.some((x) => x.check === f.check)) note(`${where(rt)}: react only: ${f.check} ${f.message}`);
    }
    if (agentKey(rt) !== agentKey(wt)) {
      row.agent++;
      note(`${where(rt)}: agent react [${agentKey(rt)}] vs web [${agentKey(wt)}]`);
      for (const a of wt.agent) if (!a.success) note(`${where(rt)}: web ${a.task}: ${a.error}`);
      for (const a of rt.agent) if (!a.success) note(`${where(rt)}: react ${a.task}: ${a.error}`);
    }
  }
  return row;
}

const docs = await documents();
const browser = await launch();
const rows: Row[] = [];
const reports: Record<string, { react: Report; web: Report }> = {};
const started = Date.now();
try {
  let next = 0;
  const worker = async () => {
    while (next < docs.length) {
      const d = docs[next++];
      const opts = { browser, themes: PACKS, modes: MODES, widths: WIDTHS, tasks: d.tasks, registry: d.registry, rules: d.rules, fingerprint: true };
      const [react, web] = await Promise.all([verifyDocument(d.doc, { ...opts, harness: HARNESSES.react }), verifyDocument(d.doc, { ...opts, harness: HARNESSES.web })]);
      reports[d.name] = { react, web };
      const row = compare(d.name, react, web);
      rows.push(row);
      const same = row.fingerprint + row.findings + row.agent === 0 ? "same" : `${row.fingerprint} fingerprint, ${row.findings} findings, ${row.agent} agent differ`;
      console.log(`${String(react.score).padStart(3)} react ${String(web.score).padStart(3)} web  ${d.name}  (${row.renders} renders, ${same})`);
      for (const line of row.differences) console.log(`       ${line}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, docs.length) }, worker));
} finally {
  await browser.close();
}

rows.sort((a, b) => a.name.localeCompare(b.name));
const renders = rows.reduce((s, r) => s + r.renders, 0);
const bad = rows.filter((r) => r.react < 100 || r.web < 100 || r.fingerprint || r.findings || r.agent);
console.log(`\n${rows.length} documents · ${renders} renders per renderer · ${PACKS.length} packs × ${MODES.join("/")} × ${WIDTHS.join("/")} · ${Math.round((Date.now() - started) / 1000)}s`);
console.log(`react: ${rows.filter((r) => r.react === 100).length}/${rows.length} at 100 · web: ${rows.filter((r) => r.web === 100).length}/${rows.length} at 100 · fingerprints match in ${rows.filter((r) => !r.fingerprint).length}/${rows.length}`);
if (bad.length) console.log(`${bad.length} document(s) differ or fall short: ${bad.map((r) => r.name).join(", ")}`);
if (values.json) await writeFile(values.json, JSON.stringify({ packs: PACKS, modes: MODES, widths: WIDTHS, rows, reports }, null, 2));
process.exit(bad.length ? 1 : 0);
