#!/usr/bin/env node
/**
 * polyxd-verify <ui-document.json ...> [--themes material3,carbon] [--modes light,dark] [--widths 390,1100]
 *               [--registry capabilities.json] [--tasks tasks.json] [--json report.json]
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { DEFAULTS, launch, verifyDocument, type Report } from "./index.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    themes: { type: "string" },
    modes: { type: "string" },
    widths: { type: "string" },
    registry: { type: "string" },
    tasks: { type: "string" },
    json: { type: "string" },
    quiet: { type: "boolean", short: "q" },
  },
});

if (!positionals.length) {
  console.error("Usage: polyxd-verify <ui-document.json ...> [--themes a,b] [--modes light,dark] [--widths 390,1100] [--registry file] [--tasks file] [--json out]");
  process.exit(2);
}

const list = (v: string | undefined) => v?.split(",").map((s) => s.trim()).filter(Boolean);
const readJson = async (p: string) => JSON.parse(await readFile(p, "utf8"));
const registry = values.registry ? await readJson(values.registry) : undefined;
const allTasks: any[] = values.tasks ? (await readJson(values.tasks)).tasks : [];
const options = {
  themes: list(values.themes) ?? DEFAULTS.themes,
  modes: (list(values.modes) as ("light" | "dark")[]) ?? DEFAULTS.modes,
  widths: list(values.widths)?.map(Number) ?? DEFAULTS.widths,
};

const browser = await launch();
const reports: (Report & { file: string })[] = [];
try {
  for (const file of positionals) {
    const name = basename(file, ".json");
    const report = await verifyDocument(await readJson(file), { ...options, browser, registry, tasks: allTasks.filter((t) => t.document === name) });
    reports.push({ file, ...report });
    const agent = report.agentRuns ? ` agent ${report.agentSuccess}/${report.agentRuns}` : "";
    console.log(`${String(report.score).padStart(3)}  ${name}  (${report.errors} errors, ${report.warnings} warnings${agent})`);
    if (!values.quiet) {
      const seen = new Set<string>();
      const lines = [
        ...report.static.map((f) => ({ f, where: "document" })),
        ...report.targets.flatMap((t) => [
          ...t.findings.map((f) => ({ f, where: `${t.theme}/${t.mode}/${t.width}` })),
          ...t.agent.filter((a) => !a.success).map((a) => ({ f: { severity: "error", check: `agent:${a.task}`, message: a.error ?? "failed" }, where: `${t.theme}/${t.mode}/${t.width}` })),
        ]),
      ];
      for (const { f, where } of lines) {
        const key = `${f.check}|${f.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        console.log(`       ${f.severity === "error" ? "error" : "warn "} ${f.check}  ${f.message}  [${where}]`);
      }
    }
  }
} finally {
  await browser.close();
}

const mean = reports.reduce((s, r) => s + r.score, 0) / reports.length;
const runs = reports.reduce((s, r) => s + r.agentRuns, 0);
const ok = reports.reduce((s, r) => s + r.agentSuccess, 0);
const renders = reports.reduce((s, r) => s + r.targets.length, 0);
console.log(`\n${reports.length} documents · ${renders} renders · mean score ${mean.toFixed(1)}${runs ? ` · agent tasks ${ok}/${runs}` : ""}`);
if (values.json) await writeFile(values.json, JSON.stringify({ options, reports }, null, 2));
process.exit(reports.some((r) => r.errors > 0 || r.agentSuccess < r.agentRuns) ? 1 : 0);
