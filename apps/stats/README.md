# @polyxd/stats

An internal Cloudflare Worker that records Polyxd's adoption once a day into PostHog, so it can be charted over time: npm downloads per package, the editor extension's installs on Open VSX and the VS Marketplace, the GitHub repository's counts, and whether the MCP Registry lists the server.

It has no public address (no routes, `workers_dev` and preview URLs off) and nothing on the public site. Cloudflare's invocation logs, traces and Issues are off, as for `apps/mcp`; the Worker writes one summary line per run.

## Read this before reading the charts

**Release-day downloads are mostly not people.** Every new version on npm is fetched within hours by registry mirrors, security scanners, dependency bots and CI caches, for every package at once. A release of all 36 packages can show thousands of downloads that day and the next with nobody new using Polyxd. Every npm event carries `release_day` (a version of that package was published that day or the day before) so these days can be filtered out or shown apart. For real adoption, chart days with `release_day = false`, or compare the baseline between releases, rather than totals.

The same holds, more weakly, for Open VSX (mirrors fetch new versions) and GitHub (stars arrive in bursts when a post goes around).

## Events

Every event goes to the distinct id `polyxd-adoption` with `$process_person_profile: false` (no person is created), and its `timestamp` is **noon UTC on the day it describes**, so a daily chart puts it in the right bucket in any time zone. Each has a `uuid` derived from its day and key, so the same fact always has the same id.

| Event | Properties | One per |
|---|---|---|
| `adoption_npm_daily` | `package`, `day`, `downloads`, `release_day`, `versions_published` | package per day |
| `adoption_vscode_daily` | `store`, `metric`, `day`, `total`, `delta`, `delta_days` | store and metric per day |
| `adoption_github_daily` | `day`, `stars`, `forks`, `watchers`, `open_issues` | day |
| `adoption_registry` | `day`, `listed`, `version` | day |

**`adoption_npm_daily`**: `downloads` is npm's count for that package on that UTC day. `release_day` is true when a version of the package was published that day or the day before. `versions_published` is the list of versions published that day (often empty on a `release_day`, which is then the day after). Packages come from `src/packages.ts` (a test keeps it in step with `packages/*`) plus anything npm's search for `scope:polyxd` returns. Days before a package existed get no event.

**`adoption_vscode_daily`**: `store` is `open-vsx` or `vs-marketplace`. `metric` is `downloads` (both stores) or `installs` (the Marketplace's headline number). `total` is the store's cumulative count, read at about 02:00 UTC and filed under the day before. `delta` is `total` minus the previous reading this Worker sent, and `delta_days` how many days that covers (1, or more after a missed run); both are null for the first reading. The Marketplace's statistics are recomputed on its own schedule and can wobble between reads, so a small negative delta is possible. A brand-new extension has no statistics yet, which reads as 0.

**`adoption_github_daily`**: counts for `visualfart/polyxd`, read at about 02:00 UTC and filed under the day before. `watchers` is the people watching the repository (GitHub's `subscribers_count`; its `watchers_count` is a legacy alias for stars). `open_issues` includes open pull requests, as GitHub counts it.

**`adoption_registry`**: whether the official MCP Registry lists `com.polyxd/mcp` (a deleted entry is not listed) and the latest version it lists.

npm reports history; the other sources report only the present. So a run covers the last 3 days npm has finished counting (catching up a missed run or two), and reads the others once.

## How a run works

Two crons (UTC):

- **01:00, 01:15, 01:30, 01:45** each take a quarter of the packages and cache their npm publish history and their downloads for the window in KV (one downloads call per package: npm's bulk endpoint does not take scoped names).
- **02:00** reads the stores, GitHub and the registry first (they can't be caught up later), then npm's last counted day and each package's downloads from the cache (fetching only what's missing), drops every event the ledger says was sent, sends the rest in one batch to PostHog's capture API, then records them.

**Idempotency.** KV key `sent:<day>` holds the keys of the events sent for that day (one write per day, whatever the number of events). A rerun, or a backfill over days already sent, sends nothing twice. `total:<store>:<metric>` holds the last reading sent, for the deltas. A source that fails costs only its own events, which go on the next run; if PostHog refuses a batch, nothing is recorded and the next run sends it. Without the `STATS` binding the Worker sends nothing rather than risk counting a day twice.

**Politeness and limits.** Two requests in flight at a time, a user agent naming this repository, and a wait and retry when a host answers 429 or 503. Each run stays well under Workers Free's 50 subrequests per invocation, retries included: each 01:xx shard makes about 20 (two per package, the last day, and a search in the first), the 02:00 run about 9. Going over the limit makes every later fetch throw, the PostHog send included; with one big 02:00 run (about 43 plus npm's 429 retries) that happened on most days from 29 September to 6 October 2026, and those days' store, GitHub and registry readings were lost. So the 02:00 run also carries a budget (`subrequests` in src/run.ts): it stops collecting one short of the limit and sends what it has, and npm's missed days come on the next run. If the package count passes about 90, add shards or use Workers Paid. KV sees about 90 writes a day (the history and downloads caches, one ledger key per day, three totals), well inside the free 1,000.

**No key, no send.** Without `POSTHOG_KEY`, a run logs its one summary line and sends and records nothing.

## Setup

From `apps/stats`:

```sh
# 1. The KV namespace for the ledger. Put the id it prints into wrangler.jsonc, in place of
#    REPLACE_WITH_STATS_KV_NAMESPACE_ID.
npx wrangler kv namespace create STATS

# 2. The PostHog project API key (Project settings → Project API key, phc_...). It can only write events.
npx wrangler secret put POSTHOG_KEY

#    An EU project: change POSTHOG_HOST in wrangler.jsonc to https://eu.i.posthog.com.

# 3. Optional: a GitHub token (fine-grained, public repositories read-only). One unauthenticated
#    call a day is well inside GitHub's limit, so this is only for a shared egress IP.
npx wrangler secret put GITHUB_TOKEN

# 4. Optional: enables POST /run (manual runs and backfills through the Worker).
npx wrangler secret put ADMIN_TOKEN

# 5. Deploy.
npm run deploy -w @polyxd/stats
```

Check a night's run in the dashboard (Workers → polyxd-stats → Logs) or with `npx wrangler tail polyxd-stats`: one line starting `adoption:` at 02:00 UTC.

## Backfill

npm keeps 18 months of daily counts, so past days can be filled in. The stores, GitHub and the registry have no history; they start from the first run.

**From this machine** (Node 22 or later):

```sh
npm run backfill -w @polyxd/stats -- --days 30           # a table: npm downloads per day, release days
npm run backfill -w @polyxd/stats -- --days 30 --json    # every event, one JSON object a line
```

It sends only when `POSTHOG_KEY` is set in the shell (it also reads `POSTHOG_HOST` and `GITHUB_TOKEN`). It has no ledger, so everything it finds is sent. To tell the Worker those days are done, write the ledger and load it into KV:

```sh
cd apps/stats
POSTHOG_KEY=phc_... npm run backfill -- --days 30 --ledger-out ledger.json
npx wrangler kv bulk put ledger.json --binding STATS --remote
rm ledger.json
```

That replaces the `sent:<day>` keys for those days with what the script sent, which is everything it found. Best done once, before the Worker's first run. Each event's `uuid` is stable, so PostHog can also drop an event sent both ways.

**Through the Worker**: with `ADMIN_TOKEN` set, `POST /run?backfill=30` runs the job over 30 days and answers with its summary, using the KV ledger. `POST /run?step=history` refreshes the publish-history cache first (without it, a backfill on Workers Free runs out of subrequests). The Worker has no public route, so this is for `wrangler dev` or a route added for the purpose.

## Development

```sh
npm test -w @polyxd/stats         # parsers against recorded responses, runs, idempotency, the Worker
npm run typecheck -w @polyxd/stats
npm run dev -w @polyxd/stats      # wrangler dev --test-scheduled; then curl "http://localhost:8787/__scheduled?cron=0+2+*+*+*"
```

The tests make no network calls. `test/fixtures` holds the sources' answers recorded on 2026-09-28; `marketplace.json` adds a `statistics` block in the API's shape (Polyxd's extension had none yet), and `npm-search.json` is in the search API's shape (the scope was not indexed yet; `npm-search-empty.json` is the real answer).
