/**
 * One run of the job: collect every source, drop what the ledger says was already sent, send the
 * rest to PostHog, and remember what went. The Worker's cron, its /run route and the local
 * backfill script all come through here.
 *
 * npm reports history, so a run covers several days (a missed run is caught up, and a backfill is
 * just more days). The editor stores, GitHub and the MCP Registry only report the present, so each
 * run reads them once and files the reading under the previous UTC day.
 */
import { addDays, daysBetween, daysEndingOn, yesterday, type Day } from "./days.ts";
import { eventKey, releaseTag, toPostHog, type AdoptionEvent, type VscodeDaily } from "./events.ts";
import { PACKAGES } from "./packages.ts";
import { BATCH_SIZE, sendBatch, type PostHogConfig } from "./posthog.ts";
import {
  fetchDownloadRange,
  fetchGitHub,
  fetchLastCompleteDay,
  fetchMarketplace,
  fetchNpmSearch,
  fetchOpenVsx,
  fetchPublishHistory,
  fetchRegistry,
  politely,
  type Fetch,
  type PublishHistory,
  type Sleep,
} from "./sources.ts";
import { addToLedger, readCache, readLedger, readTotal, writeCache, writeTotal, type Store, type TotalSeen } from "./store.ts";

/** npm days a scheduled run covers, ending on npm's last complete day: two missed runs are caught up. */
export const DEFAULT_DAYS = 3;
/** The most a backfill may ask for. npm keeps 18 months; a Worker run has a time budget. */
export const MAX_DAYS = 365;
/** Requests in flight at once. npm's downloads API rate-limits bursts, so two, with retries (sources.ts `politely`). */
export const CONCURRENCY = 2;
/** How long a cached publish history is trusted: long enough for the 01:30 refresh to serve the 02:00 run, too short to miss a release. */
export const HISTORY_MAX_AGE_MS = 6 * 3_600_000;

export interface RunOptions {
  fetch: Fetch;
  store: Store;
  now: Date;
  /** npm days to cover, ending on npm's last complete day. */
  days?: number;
  /** Where to send. Null or no key: collect and log, send nothing, remember nothing. */
  posthog?: PostHogConfig | null;
  githubToken?: string;
  /** The packages to count. Defaults to src/packages.ts plus anything npm's search adds. */
  packages?: readonly string[];
  log?: (line: string) => void;
  /** How to wait before a retry. Tests pass one that returns at once. */
  sleep?: Sleep;
  /** Why nothing is sent, for the summary line, when it is not a missing key. */
  notSending?: string;
}

export interface RunResult {
  /** Events collected that the ledger had not seen, in the order they would be sent. */
  events: AdoptionEvent[];
  /** Events collected that were already sent. */
  skipped: number;
  sent: number;
  errors: string[];
  /** npm's last complete day, which the npm events end on. */
  npmThrough: Day | null;
  summary: string;
}

async function pool<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
  }));
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** `total` against the last reading: null until there is one. */
export function delta(previous: TotalSeen | null, day: Day, total: number): Pick<VscodeDaily, "delta" | "delta_days"> {
  if (!previous || previous.day >= day) return { delta: null, delta_days: null };
  return { delta: total - previous.total, delta_days: daysBetween(previous.day, day) };
}

async function packageList(options: RunOptions, fetch: Fetch, errors: string[]): Promise<string[]> {
  if (options.packages) return [...options.packages];
  let found = await readCache<string[]>(options.store, "npm-packages", options.now, HISTORY_MAX_AGE_MS);
  if (!found) {
    try {
      found = await fetchNpmSearch(fetch);
    } catch (error) {
      errors.push(`npm search: ${message(error)}`);
      found = [];
    }
  }
  return [...new Set([...PACKAGES, ...found])];
}

async function publishHistory(options: RunOptions, fetch: Fetch, pkg: string): Promise<PublishHistory> {
  return (await readCache<PublishHistory>(options.store, `npm-history:${pkg}`, options.now, HISTORY_MAX_AGE_MS)) ?? fetchPublishHistory(fetch, pkg);
}

/**
 * Fetches every package's publish history into the store's cache. The Worker runs this half an
 * hour before the main run, so neither run needs more than 50 subrequests (the Workers Free limit).
 */
export async function refreshHistories(options: Pick<RunOptions, "fetch" | "store" | "now" | "packages" | "log" | "sleep">): Promise<string> {
  const fetch = politely(options.fetch, options.sleep);
  const errors: string[] = [];
  let packages: string[] = options.packages ? [...options.packages] : [...PACKAGES];
  if (!options.packages) {
    try {
      const found = await fetchNpmSearch(fetch);
      packages = [...new Set([...PACKAGES, ...found])];
      await writeCache(options.store, "npm-packages", options.now, found);
    } catch (error) {
      errors.push(`npm search: ${message(error)}`);
    }
  }
  let cached = 0;
  await pool(packages, CONCURRENCY, async (pkg) => {
    try {
      await writeCache(options.store, `npm-history:${pkg}`, options.now, await fetchPublishHistory(fetch, pkg));
      cached++;
    } catch (error) {
      errors.push(`${pkg} history: ${message(error)}`);
    }
  });
  const summary = `adoption history: cached ${cached} of ${packages.length} packages${errors.length ? ` · errors: ${errors.join("; ")}` : ""}`;
  (options.log ?? console.log)(summary);
  return summary;
}

/** Collects every source. Reads the store (caches, last totals) but writes nothing. */
export async function collect(options: RunOptions): Promise<{ events: AdoptionEvent[]; errors: string[]; npmThrough: Day | null; packages: number }> {
  const { store, now } = options;
  const fetch = politely(options.fetch, options.sleep);
  const errors: string[] = [];
  const events: AdoptionEvent[] = [];
  const days = Math.min(Math.max(Math.floor(options.days ?? DEFAULT_DAYS), 1), MAX_DAYS);

  // ---- npm: history, per package ----
  let npmThrough: Day | null = null;
  let packages: string[] = [];
  try {
    npmThrough = await fetchLastCompleteDay(fetch);
  } catch (error) {
    errors.push(`npm last day: ${message(error)}`);
  }
  if (npmThrough) {
    const window = daysEndingOn(npmThrough, days);
    packages = await packageList(options, fetch, errors);
    const perPackage = new Map<string, AdoptionEvent[]>();
    await pool(packages, CONCURRENCY, async (pkg) => {
      try {
        const [range, history] = await Promise.all([fetchDownloadRange(fetch, pkg, window[0], npmThrough!), publishHistory(options, fetch, pkg)]);
        const list: AdoptionEvent[] = [];
        for (const day of window) {
          // Nothing to say about a day before the package existed.
          if (history.created && day < history.created) continue;
          const downloads = range.get(day);
          if (downloads === undefined) continue;
          list.push({ event: "adoption_npm_daily", properties: { package: pkg, day, downloads, ...releaseTag(history.versions, day, addDays(day, -1)) } });
        }
        perPackage.set(pkg, list);
      } catch (error) {
        errors.push(`${pkg}: ${message(error)}`);
      }
    });
    // In package-list order, not completion order, so a run's output is stable.
    for (const pkg of packages) events.push(...(perPackage.get(pkg) ?? []));
  }

  // ---- Readings of the present, filed under yesterday ----
  const day = yesterday(now);
  const vscode = async (store_: string, metric: string, total: number) => {
    const previous = await readTotal(store, `${store_}:${metric}`);
    events.push({ event: "adoption_vscode_daily", properties: { store: store_, metric, day, total, ...delta(previous, day, total) } });
  };
  const [openVsx, marketplace, github, registry] = await Promise.allSettled([
    fetchOpenVsx(fetch),
    fetchMarketplace(fetch),
    fetchGitHub(fetch, options.githubToken),
    fetchRegistry(fetch),
  ]);
  if (openVsx.status === "fulfilled") await vscode("open-vsx", "downloads", openVsx.value);
  else errors.push(`Open VSX: ${message(openVsx.reason)}`);
  if (marketplace.status === "fulfilled") {
    await vscode("vs-marketplace", "installs", marketplace.value.installs);
    await vscode("vs-marketplace", "downloads", marketplace.value.downloads);
  } else errors.push(`Marketplace: ${message(marketplace.reason)}`);
  if (github.status === "fulfilled") events.push({ event: "adoption_github_daily", properties: { day, ...github.value } });
  else errors.push(`GitHub: ${message(github.reason)}`);
  if (registry.status === "fulfilled") events.push({ event: "adoption_registry", properties: { day, listed: registry.value.listed, version: registry.value.version } });
  else errors.push(`MCP Registry: ${message(registry.reason)}`);

  return { events, errors, npmThrough, packages: packages.length };
}

/** Collects, drops what was sent before, sends the rest (when there is a key) and remembers it. */
export async function run(options: RunOptions): Promise<RunResult> {
  const { store } = options;
  const collected = await collect(options);
  const errors = [...collected.errors];

  const ledgers = new Map<Day, Set<string>>();
  for (const e of collected.events) if (!ledgers.has(e.properties.day)) ledgers.set(e.properties.day, await readLedger(store, e.properties.day));
  const events = collected.events.filter((e) => !ledgers.get(e.properties.day)!.has(eventKey(e)));
  const skipped = collected.events.length - events.length;

  const delivered: AdoptionEvent[] = [];
  const posthog = options.posthog?.key ? options.posthog : null;
  if (posthog) {
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const chunk = events.slice(i, i + BATCH_SIZE);
      try {
        await sendBatch(options.fetch, posthog, await Promise.all(chunk.map(toPostHog)));
      } catch (error) {
        // The rest stay out of the ledger and go next run.
        errors.push(message(error));
        break;
      }
      delivered.push(...chunk);
    }
    // Written once per day after every batch: KV allows one write a second to a key.
    const byDay = new Map<Day, string[]>();
    for (const e of delivered) byDay.set(e.properties.day, [...(byDay.get(e.properties.day) ?? []), eventKey(e)]);
    for (const [day, keys] of byDay) await addToLedger(store, day, keys);
    for (const e of delivered) {
      if (e.event === "adoption_vscode_daily") await writeTotal(store, `${e.properties.store}:${e.properties.metric}`, { day: e.properties.day, total: e.properties.total });
    }
  }
  const sent = delivered.length;

  const npm = collected.npmThrough ? `npm ${collected.packages} packages through ${collected.npmThrough}` : "npm unavailable";
  const outcome = posthog ? `sent ${sent}` : `not sent (${options.notSending ?? "no POSTHOG_KEY"})`;
  const summary = `adoption: ${npm} · ${events.length} new events · ${skipped} already sent · ${outcome}${errors.length ? ` · errors: ${errors.join("; ")}` : ""}`;
  (options.log ?? console.log)(summary);
  return { events, skipped, sent, errors, npmThrough: collected.npmThrough, summary };
}
