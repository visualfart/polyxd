/** Each source's parser against its recorded answer, and the rules for the awkward cases. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, daysEndingOn, noonOf, yesterday } from "../src/days.ts";
import { releaseTag } from "../src/events.ts";
import {
  parseDownloadRange,
  parseGitHub,
  parseLastDay,
  parseMarketplace,
  parseNpmSearch,
  parseOpenVsx,
  parsePublishHistory,
  parseRegistry,
  politely,
  fetchRegistry,
  fetchDownloadRange,
  fetchPublishHistory,
} from "../src/sources.ts";
import { fixture, jsonResponse } from "./helpers.ts";

test("days: UTC arithmetic, windows and noon timestamps", () => {
  assert.equal(addDays("2026-09-01", -1), "2026-08-31");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(yesterday(new Date("2026-09-28T02:00:00Z")), "2026-09-27");
  assert.equal(yesterday(new Date("2026-09-28T23:59:59Z")), "2026-09-27");
  assert.deepEqual(daysEndingOn("2026-09-27", 3), ["2026-09-25", "2026-09-26", "2026-09-27"]);
  assert.equal(daysBetween("2026-09-25", "2026-09-27"), 2);
  assert.equal(noonOf("2026-09-27"), "2026-09-27T12:00:00.000Z");
});

test("npm: downloads per day, the last counted day, and the search", () => {
  const spec = parseDownloadRange(fixture("downloads-spec.json"));
  assert.equal(spec.size, 30);
  assert.equal(spec.get("2026-09-26"), 547);
  assert.equal(spec.get("2026-09-27"), 651);
  assert.equal(spec.get("2026-09-01"), 0);
  assert.throws(() => parseDownloadRange({ error: "package x not found" }), /not found/);

  assert.equal(parseLastDay(fixture("last-day.json")), "2026-09-27");
  assert.throws(() => parseLastDay({ downloads: 1 }), /no end day/);

  assert.deepEqual(parseNpmSearch(fixture("npm-search.json")), ["@polyxd/spec", "@polyxd/brand-new"], "only polyxd and @polyxd/* names");
  assert.deepEqual(parseNpmSearch(fixture("npm-search-empty.json")), []);
});

test("npm: publish history from the registry's time field", () => {
  const history = parsePublishHistory(fixture("registry-spec.json"));
  assert.equal(history.created, "2026-09-26");
  assert.deepEqual(history.versions.map((v) => v.version), ["0.1.0", "0.1.1", "0.2.0", "0.2.1", "0.2.2", "0.3.0", "0.4.0"]);
  assert.ok(!history.versions.some((v) => v.version === "created" || v.version === "modified"));
  assert.deepEqual(parsePublishHistory({ name: "x" }), { created: null, versions: [] });
});

test("release days: a publish that day or the day before, and which versions went out that day", () => {
  const { versions } = parsePublishHistory(fixture("registry-spec.json"));
  const tag = (day: string) => releaseTag(versions, day, addDays(day, -1));
  assert.deepEqual(tag("2026-09-26"), { release_day: true, versions_published: ["0.1.0", "0.1.1", "0.2.0"] });
  assert.deepEqual(tag("2026-09-27"), { release_day: true, versions_published: ["0.2.1", "0.2.2", "0.3.0"] });
  assert.deepEqual(tag("2026-09-29"), { release_day: true, versions_published: [] }, "the day after 0.4.0");
  assert.deepEqual(tag("2026-09-30"), { release_day: false, versions_published: [] });
  assert.deepEqual(tag("2026-09-25"), { release_day: false, versions_published: [] });
});

test("the editor stores: Open VSX downloads, Marketplace installs and downloads", () => {
  assert.equal(parseOpenVsx(fixture("openvsx.json")), 80);
  assert.deepEqual(parseMarketplace(fixture("marketplace.json")), { installs: 42, downloads: 13 });
  assert.deepEqual(parseMarketplace(fixture("marketplace-new.json")), { installs: 0, downloads: 0 }, "no statistics yet reads as zero");
  assert.throws(() => parseMarketplace({ results: [{ extensions: [] }] }), /not found/);
  assert.throws(() => parseOpenVsx({ downloadCount: "80" }), /expected a count/);
});

test("GitHub: stars, forks, the people watching (subscribers, not the legacy watchers alias), open issues", () => {
  const counts = parseGitHub({ ...fixture("github.json"), stargazers_count: 12, watchers_count: 12, subscribers_count: 3, forks_count: 2, open_issues_count: 5 });
  assert.deepEqual(counts, { stars: 12, forks: 2, watchers: 3, open_issues: 5 });
  assert.deepEqual(parseGitHub(fixture("github.json")), { stars: 0, forks: 0, watchers: 0, open_issues: 0 });
});

test("MCP Registry: listed with its latest version, a 404 is not listed, a deleted entry is not listed", async () => {
  assert.deepEqual(parseRegistry(fixture("mcp-registry.json")), { listed: true, version: "0.4.0", status: "active" });
  const deleted = fixture("mcp-registry.json");
  deleted._meta["io.modelcontextprotocol.registry/official"].status = "deleted";
  assert.equal(parseRegistry(deleted).listed, false);
  const missing = await fetchRegistry(async () => jsonResponse({ title: "Not Found", status: 404, detail: "Server not found" }, 404));
  assert.deepEqual(missing, { listed: false, version: null, status: null });
  await assert.rejects(fetchRegistry(async () => jsonResponse({}, 500)), /HTTP 500/);
});

test("npm: a package npm has not counted yet, or not published, is no data rather than an error", async () => {
  const notFound = async () => jsonResponse({ error: "package @polyxd/new not found" }, 404);
  assert.equal((await fetchDownloadRange(notFound, "@polyxd/new", "2026-09-25", "2026-09-27")).size, 0);
  assert.deepEqual(await fetchPublishHistory(notFound, "@polyxd/new"), { created: null, versions: [] });
});

test("politely: waits out a 429 (Retry-After, else backing off), then gives up after three retries", async () => {
  const waits: number[] = [];
  let calls = 0;
  const busyTwice = politely(async () => (++calls <= 2 ? new Response("", { status: 429, headers: calls === 1 ? { "retry-after": "5" } : {} }) : jsonResponse({ ok: 1 })), async (ms) => void waits.push(ms));
  assert.equal((await busyTwice("https://api.npmjs.org/x")).status, 200);
  assert.deepEqual(waits, [5000, 4000]);

  waits.length = 0;
  const alwaysBusy = politely(async () => new Response("", { status: 503 }), async (ms) => void waits.push(ms));
  assert.equal((await alwaysBusy("https://api.npmjs.org/x")).status, 503);
  assert.deepEqual(waits, [2000, 4000, 8000]);
});
