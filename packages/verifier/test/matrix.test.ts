/**
 * Every example, in every design system, mode and width, scores 100: no accessibility violations,
 * no layout problems, and every agent task completes through the accessibility tree.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import type { Browser } from "playwright";
import { launch, verifyDocument } from "../src/index.ts";
import { load, registry, tasks, examplesDir } from "./helpers.ts";

let browser: Browser;
before(async () => (browser = await launch()));
after(async () => browser.close());

for (const f of readdirSync(examplesDir).filter((f) => f.endsWith(".json"))) {
  const name = f.replace(".json", "");
  test(`${name}: 3 packs × light/dark × phone/desktop`, async () => {
    const r = await verifyDocument(load(name), { browser, registry, tasks: tasks.filter((t) => t.document === name) });
    const problems = [...r.static, ...r.targets.flatMap((t) => t.findings.map((x) => ({ ...x, at: `${t.theme}/${t.mode}/${t.width}` })))];
    const failed = r.targets.flatMap((t) => t.agent.filter((a) => !a.success).map((a) => `${t.theme}/${t.mode}/${t.width} ${a.task}: ${a.error}`));
    assert.deepEqual(problems, []);
    assert.deepEqual(failed, []);
    assert.equal(r.score, 100);
  });
}

// Documents that use the building blocks from the flow designs (design/flows), until the examples adopt them.
const designDir = new URL("./fixtures/design/", import.meta.url);
for (const f of readdirSync(designDir).filter((f) => f.endsWith(".json"))) {
  test(`design fixture ${f}: 3 packs × light/dark × phone/desktop`, async () => {
    const r = await verifyDocument(JSON.parse(readFileSync(new URL(f, designDir), "utf8")), { browser });
    const problems = [...r.static, ...r.targets.flatMap((t) => t.findings.map((x) => ({ ...x, at: `${t.theme}/${t.mode}/${t.width}` })))];
    assert.deepEqual(problems, []);
    assert.equal(r.score, 100);
  });
}
