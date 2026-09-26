/**
 * Re-checks training examples that were selected under an older check set. An example kept before
 * a check existed can teach the very thing the check now rejects: sft-v2's pool was selected while
 * a binding to a path that isn't in the data only cost a warning, and sft-v2 binds to paths that
 * aren't there.
 *
 * node packages/verifier/scripts/audit-pool.ts model/data/selected.jsonl [more.jsonl ...] [--keep out.jsonl]
 *
 * Prints, per file, how many examples now fail a static error check and which checks they fail.
 * With --keep, writes every example that still passes, from all the files, to one file. Static
 * checks only, so it runs in seconds; the rendered checks are what selection already ran.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { flattenTree, isTree } from "@polyxd/spec";
import { staticAudit } from "../src/static.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { keep: { type: "string" } } });

/** The DATA a request gave the model: the JSON line after the prompt's DATA heading. */
const dataIn = (user: string) => {
  const m = user.match(/^DATA \(bind[^\n]*\n(.*)$/m);
  return m ? JSON.parse(m[1]) : undefined;
};

const kept: string[] = [];
for (const file of positionals) {
  let total = 0;
  let failing = 0;
  const byCheck: Record<string, number> = {};
  for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    total++;
    const example = JSON.parse(line);
    const answer = JSON.parse(example.assistant);
    const doc = { ...(isTree(answer) ? flattenTree(answer) : answer), data: dataIn(example.user) };
    const errors = staticAudit(doc).filter((f) => f.severity === "error");
    if (errors.length === 0) {
      kept.push(line);
      continue;
    }
    failing++;
    for (const check of new Set(errors.map((f) => f.check))) byCheck[check] = (byCheck[check] ?? 0) + 1;
  }
  const worst = Object.entries(byCheck).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ");
  console.log(`${basename(file)}: ${failing} of ${total} now fail${worst ? ` (${worst})` : ""}`);
}

if (values.keep) {
  const unique = [...new Set(kept)];
  writeFileSync(values.keep, unique.join("\n") + "\n");
  console.log(`kept ${unique.length} → ${values.keep}`);
}
