/**
 * Computes the adoption events for the last N days on this machine, and prints them or sends them.
 *
 *   npm run backfill -w @polyxd/stats -- --days 30              a table of what it found
 *   npm run backfill -w @polyxd/stats -- --days 30 --json       every event, one JSON object a line
 *   POSTHOG_KEY=phc_... npm run backfill -w @polyxd/stats -- --days 30 --ledger-out ledger.json
 *
 * It sends only when POSTHOG_KEY is set in the shell (POSTHOG_HOST and GITHUB_TOKEN are read too).
 * It has no ledger of its own, so everything it finds is sent. --ledger-out writes what it sent in
 * the form `wrangler kv bulk put` takes, so the deployed Worker learns those days are done:
 *
 *   npx wrangler kv bulk put ledger.json --binding STATS --remote   (from apps/stats)
 *
 * The npm events are history and can go back 18 months. The store, GitHub and registry readings are
 * of today, filed under yesterday, with no delta (there is no earlier reading here).
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { run } from "../src/run.ts";
import { MemoryStore } from "../src/store.ts";
import type { AdoptionEvent } from "../src/events.ts";

const { values } = parseArgs({
  options: {
    days: { type: "string", default: "30" },
    json: { type: "boolean", default: false },
    "ledger-out": { type: "string" },
  },
});
const days = Number(values.days);
if (!Number.isInteger(days) || days < 1) {
  console.error("--days takes a whole number of days");
  process.exit(2);
}

const key = process.env.POSTHOG_KEY;
const store = new MemoryStore();
const result = await run({
  fetch: (url, init) => fetch(url, init),
  store,
  now: new Date(),
  days,
  posthog: key ? { key, host: process.env.POSTHOG_HOST } : null,
  githubToken: process.env.GITHUB_TOKEN,
  log: (line) => console.error(line),
});

if (values.json) {
  for (const e of result.events) console.log(JSON.stringify(e));
} else {
  const npm = new Map<string, { downloads: number; release: boolean; versions: Set<string> }>();
  const other: AdoptionEvent[] = [];
  for (const e of result.events) {
    if (e.event !== "adoption_npm_daily") {
      other.push(e);
      continue;
    }
    const row = npm.get(e.properties.day) ?? { downloads: 0, release: false, versions: new Set<string>() };
    row.downloads += e.properties.downloads;
    row.release ||= e.properties.release_day;
    for (const v of e.properties.versions_published) row.versions.add(v);
    npm.set(e.properties.day, row);
  }
  console.log("day          npm downloads  release");
  for (const [day, row] of [...npm].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`${day}   ${String(row.downloads).padStart(13)}  ${row.release ? `yes ${[...row.versions].join(" ")}`.trimEnd() : ""}`);
  }
  for (const e of other) {
    const { day, ...rest } = e.properties as { day: string } & Record<string, unknown>;
    console.log(`${day}   ${e.event} ${JSON.stringify(rest)}`);
  }
}

if (values["ledger-out"]) {
  if (!result.sent) console.error("Nothing was sent, so there is no ledger to write.");
  else {
    const entries = [...store.data].filter(([k]) => !k.startsWith("cache:")).map(([k, value]) => ({ key: k, value }));
    writeFileSync(values["ledger-out"], `${JSON.stringify(entries, null, 2)}\n`);
    console.error(`Wrote ${entries.length} KV entries to ${values["ledger-out"]}.`);
  }
}
if (result.errors.length) process.exitCode = 1;
