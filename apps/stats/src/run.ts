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
/** How long a cached publish history is trusted: long enough for the 01:00 refresh to serve the 02:00 run, too short to miss a release. */
export const HISTORY_MAX_AGE_MS = 6 * 3_600_000;
/**
 * Subrequests one Worker invocation may make on Workers Free. Going over makes every later fetch
 * throw, PostHog's included, so the run would send nothing: the Worker passes this as `subrequests`.
 */
export const SUBREQUEST_LIMIT = 50;
/** The npm prefetch is split into this many shards, one per cron run (index.ts), so each stays far under the limit. */
export const SHARDS = 4;

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
  /**
   * The most subrequests this run may make, retries included. Collection stops short of it, so the
   * PostHog send always has room; what it skips is caught up by a later run. Unset: no limit.
   */
  subrequests?: number;
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

/** A package's npm downloads for one window, as the prefetch cached it. */
interface CachedRange {
  start: Day;
  end: Day;
  downloads: Array<[Day, number]>;
}

async function downloadRange(options: RunOptions, fetch: Fetch, pkg: string, start: Day, end: Day): Promise<Map<Day, number>> {
  const cached = await readCache<CachedRange>(options.store, `npm-range:${pkg}`, options.now, HISTORY_MAX_AGE_MS);
  if (cached && cached.start === start && cached.end === end) return new Map(cached.downloads);
  return fetchDownloadRange(fetch, pkg, start, end);
}

/**
 * A fetch that refuses once `limit` requests have been made, so a run never reaches the point
 * where the Workers runtime throws on every fetch (the PostHog send included).
 */
function budgeted(fetch: Fetch, limit: number | undefined): Fetch {
  if (limit === undefined) return fetch;
  let used = 0;
  return (url, init) => (used++ < limit ? fetch(url, init) : Promise.reject(new Error("subrequest budget spent, left for a later run")));
}

/**
 * Fetches publish histories and download counts into the store's cache, for every package or, with
 * `shard`, for every SHARDS-th one. The Worker runs one shard per cron before the main run, so no
 * run comes near the 50 subrequests Workers Free allows, retries included, as the package list grows.
 */
export async function refreshHistories(options: Pick<RunOptions, "fetch" | "store" | "now" | "packages" | "log" | "sleep" | "days"> & { shard?: number }): Promise<string> {
  const fetch = politely(options.fetch, options.sleep);
  const errors: string[] = [];
  let packages: string[] = options.packages ? [...options.packages] : [...PACKAGES];
  if (!options.packages) {
    // The first shard searches; the others use what it found.
    let found = options.shard ? await readCache<string[]>(options.store, "npm-packages", options.now, HISTORY_MAX_AGE_MS) : null;
    if (!found) {
      try {
        found = await fetchNpmSearch(fetch);
        await writeCache(options.store, "npm-packages", options.now, found);
      } catch (error) {
        errors.push(`npm search: ${message(error)}`);
      }
    }
    packages = [...new Set([...PACKAGES, ...(found ?? [])])];
  }
  const mine = options.shard === undefined ? packages : packages.filter((_, i) => i % SHARDS === options.shard);
  let window: Day[] | null = null;
  try {
    const through = await fetchLastCompleteDay(fetch);
    await writeCache(options.store, "npm-through", options.now, through);
    window = daysEndingOn(through, Math.min(Math.max(Math.floor(options.days ?? DEFAULT_DAYS), 1), MAX_DAYS));
  } catch (error) {
    errors.push(`npm last day: ${message(error)}`);
  }
  let cached = 0;
  await pool(mine, CONCURRENCY, async (pkg) => {
    try {
      await writeCache(options.store, `npm-history:${pkg}`, options.now, await fetchPublishHistory(fetch, pkg));
      if (window) {
        const [start, end] = [window[0], window[window.length - 1]];
        const range = await fetchDownloadRange(fetch, pkg, start, end);
        await writeCache(options.store, `npm-range:${pkg}`, options.now, { start, end, downloads: [...range] } satisfies CachedRange);
      }
      cached++;
    } catch (error) {
      errors.push(`${pkg} history: ${message(error)}`);
    }
  });
  const of = options.shard === undefined ? "" : ` (shard ${options.shard + 1} of ${SHARDS})`;
  const summary = `adoption history: cached ${cached} of ${mine.length} packages${of}${errors.length ? ` · errors: ${errors.join("; ")}` : ""}`;
  (options.log ?? console.log)(summary);
  return summary;
}

/** Collects every source. Reads the store (caches, last totals) but writes nothing. */
export async function collect(options: RunOptions): Promise<{ events: AdoptionEvent[]; errors: string[]; npmThrough: Day | null; packages: number }> {
  const { store, now } = options;
  // One subrequest per PostHog batch stays free for run() to send what was collected.
  const fetch = politely(budgeted(options.fetch, options.subrequests === undefined ? undefined : options.subrequests - 1), options.sleep);
  const errors: string[] = [];
  const events: AdoptionEvent[] = [];
  const days = Math.min(Math.max(Math.floor(options.days ?? DEFAULT_DAYS), 1), MAX_DAYS);

  // ---- Readings of the present, filed under yesterday ----
  // First: unlike npm's history, a reading missed today can't be caught up tomorrow.
  const day = yesterday(now);
  const present: AdoptionEvent[] = [];
  const vscode = async (store_: string, metric: string, total: number) => {
    const previous = await readTotal(store, `${store_}:${metric}`);
    present.push({ event: "adoption_vscode_daily", properties: { store: store_, metric, day, total, ...delta(previous, day, total) } });
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
  if (github.status === "fulfilled") present.push({ event: "adoption_github_daily", properties: { day, ...github.value } });
  else errors.push(`GitHub: ${message(github.reason)}`);
  if (registry.status === "fulfilled") present.push({ event: "adoption_registry", properties: { day, listed: registry.value.listed, version: registry.value.version } });
  else errors.push(`MCP Registry: ${message(registry.reason)}`);

  // ---- npm: history, per package ----
  let npmThrough: Day | null = null;
  let packages: string[] = [];
  try {
    npmThrough = await fetchLastCompleteDay(fetch);
  } catch (error) {
    // The prefetch looked it up within the hour; without it, npm waits for the next run.
    npmThrough = await readCache<Day>(store, "npm-through", now, HISTORY_MAX_AGE_MS);
    if (!npmThrough) errors.push(`npm last day: ${message(error)}`);
  }
  if (npmThrough) {
    const window = daysEndingOn(npmThrough, days);
    packages = await packageList(options, fetch, errors);
    const perPackage = new Map<string, AdoptionEvent[]>();
    await pool(packages, CONCURRENCY, async (pkg) => {
      try {
        const [range, history] = await Promise.all([downloadRange(options, fetch, pkg, window[0], npmThrough!), publishHistory(options, fetch, pkg)]);
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

  // Sent in the same order as before: npm first, then the readings.
  events.push(...present);

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
