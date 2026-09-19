#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validateDocument } from "../validate.ts";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: validate <ui-document.json> [...more]");
  process.exit(2);
}
let failed = 0;
for (const file of files) {
  const result = validateDocument(JSON.parse(await readFile(file, "utf8")));
  if (!result.valid) failed++;
  console.log(`${result.valid ? "✓" : "✗"} ${file}`);
  for (const i of result.issues) console.log(`    ${i.severity === "error" ? "error" : "warn "} ${i.at}: ${i.message}`);
}
process.exit(failed ? 1 : 0);
