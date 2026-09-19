#!/usr/bin/env node
import { checkDesignSystem } from "../tokens.ts";

const manifest = process.argv[2];
if (!manifest) {
  console.error("Usage: check-design-system <path/to/manifest.json>");
  process.exit(2);
}
const issues = await checkDesignSystem(manifest);
for (const i of issues) console.log(`${i.mode ? `[${i.mode}] ` : ""}${i.token}: ${i.message}`);
console.log(issues.length ? `\n${issues.length} issue(s)` : "Design system satisfies the semantic token contract.");
process.exit(issues.length ? 1 : 0);
