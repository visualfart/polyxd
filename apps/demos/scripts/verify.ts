/**
 * Verifies every intent document of every demo the way the products claim: the static checks
 * (schema, bindings, pattern, capabilities, the product's Design Direction rules), then a real
 * render in each design system, light and dark, phone and desktop, audited with axe and a layout
 * check. Writes a trimmed report next to each document, which the "Checked" mark shows.
 *
 *   npm run verify -w @polyxd/demos            all demos
 *   npm run verify -w @polyxd/demos -- halden  one demo
 *   ... -- halden money.send                   one intent
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { launch, verifyDocument, DEFAULTS, type Report } from "@polyxd/verifier";

const here = new URL("../", import.meta.url);
const read = async (u: URL) => JSON.parse(await readFile(u, "utf8"));
const [only, onlyIntent] = process.argv.slice(2);
const demos = (await readdir(here, { withFileTypes: true })).filter((d) => d.isDirectory() && ["halden", "foundry", "wexley", "quay"].includes(d.name) && (!only || d.name === only)).map((d) => d.name);
const THEMES = ["material3", "shadcn", "govuk", "carbon", "polaris", "antd", "fluent", "primer", "spectrum", "chakra", "mantine", "radix", "bootstrap"];

const browser = await launch();
let failed = 0;
try {
  for (const demo of demos) {
    const registry = await read(new URL(`${demo}/registry.json`, here)).catch(() => undefined);
    const direction = await read(new URL(`${demo}/direction.json`, here)).catch(() => undefined);
    // Generated documents (intents/) and authored screens (authored/) are held to the same checks.
    const files: { dir: URL; file: string }[] = [];
    for (const kind of ["intents", "authored"]) {
      const dir = new URL(`${demo}/${kind}/`, here);
      for (const file of (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".json") && (!onlyIntent || f === `${onlyIntent}.json`)).sort()) files.push({ dir, file });
    }
    await mkdir(new URL(`${demo}/reports/`, here), { recursive: true });
    for (const { dir, file } of files) {
      const intent = await read(new URL(file, dir));
      const doc = intent.document;
      const report: Report = await verifyDocument(doc, { ...DEFAULTS, themes: THEMES, browser, registry, rules: direction?.rules });
      const summary = {
        score: report.score,
        errors: report.errors,
        warnings: report.warnings,
        targets: report.targets.map((t) => ({ theme: t.theme, mode: t.mode, width: t.width, findings: t.findings.length })),
        checkedAt: new Date().toISOString(),
        verifier: (await read(new URL("../../packages/verifier/package.json", here))).version,
        findings: [
          ...report.static.map((f) => ({ severity: f.severity, check: f.check, message: f.message, where: "document" })),
          ...report.targets.flatMap((t) => t.findings.map((f) => ({ severity: f.severity, check: f.check, message: f.message, where: `${t.theme}/${t.mode}/${t.width}` }))),
        ].filter((f, i, all) => all.findIndex((g) => g.check === f.check && g.message === f.message) === i),
      };
      await writeFile(new URL(`${demo}/reports/${file}`, here), JSON.stringify(summary, null, 2) + "\n");
      const line = `${String(report.score).padStart(3)}  ${demo}/${file.replace(".json", "")}  (${report.errors} errors, ${report.warnings} warnings, ${report.targets.length} renders)`;
      console.log(line);
      for (const f of summary.findings) console.log(`       ${f.severity === "error" ? "error" : "warn "} ${f.check}  ${f.message}  [${f.where}]`);
      if (report.errors) failed++;
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
