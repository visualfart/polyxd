#!/usr/bin/env node
/**
 * Compiles tree-form UI documents to the flat wire form, in place.
 *
 *   node packages/spec/src/cli/flatten.ts bench/rank-set/*.json
 *
 * Models author trees; hosts, renderers and the verifier read the flat form. Files already flat are
 * left alone, so this is safe to run twice.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { flattenTree, isTree, validateDocument } from "../index.ts";

let flattened = 0;
for (const file of process.argv.slice(2)) {
  const doc = JSON.parse(readFileSync(file, "utf8"));
  if (!isTree(doc)) continue;
  const flat = flattenTree(doc);
  writeFileSync(file, JSON.stringify(flat, null, 2) + "\n");
  flattened++;
  const issues = validateDocument(flat).issues.filter((i) => i.severity === "error");
  if (issues.length) console.log(`${file}: ${issues.length} error(s) — ${issues[0].message}`);
}
console.log(`flattened ${flattened} of ${process.argv.length - 2} file(s)`);
