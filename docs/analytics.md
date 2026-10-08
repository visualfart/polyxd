# Analytics

Polyxd's own product analytics go to PostHog (US cloud). They are off everywhere until a key is
set: with no key there is no script on any page, no `/ingest` route, no request to PostHog and no
change in what any app does. What is sent is written down in the privacy policy
(`apps/site/content/legal/privacy.md`); change the two together.

The npm packages, the local MCP server (`npx @polyxd/mcp`), the generation server, the runtime and
the VS Code extension send nothing, with or without a key. Only the hosted apps below do.

## Turning it on

The key is the PostHog project's public key (`phc_…`). It is public by design, but it is set as a
secret so it never sits in the repository. `POSTHOG_HOST` is optional: the default is
`https://us.i.posthog.com`; set `https://eu.i.posthog.com` for a project in the EU cloud.

**polyxd.com** (the site, the docs, the gallery and the demos). Two places, because the pages are
static: the Worker needs the key for `/ingest` and for the demos' server-side event, and the build
needs it to write the script into the pages.

```sh
cd apps/site
npx wrangler secret put POSTHOG_KEY           # the Worker: /ingest/* and demo_live_generation
echo "POSTHOG_KEY=phc_…" > .env               # once: the build reads it (the file is gitignored)
npm run deploy                                 # the build writes the script into every page
```

A build without `POSTHOG_KEY` (in its environment or `apps/site/.env`) writes pages with no
analytics at all, whatever the Worker has, so every site chart in PostHog reads 0. `npm run deploy`
therefore refuses to deploy without one; `POSTHOG_KEY=off npm run deploy` deploys without analytics
on purpose. A value that isn't a `phc_` key fails the build.

**Studio** (studio.polyxd.com). The Worker tells the app whether analytics are on (`/api/me`), so
there is nothing to set at build time.

```sh
cd apps/studio
npx wrangler secret put POSTHOG_KEY --env production
```

**The hosted MCP server** (mcp.polyxd.com).

```sh
cd apps/mcp
npx wrangler secret put POSTHOG_KEY
```

Deleting the secret (`npx wrangler secret delete POSTHOG_KEY`, with `--env production` for Studio)
turns an app's analytics off again; for the site, deploy once more without `POSTHOG_KEY` too.

## PostHog project settings

Set these before the first key goes live:

1. **Region.** A project in the US cloud (us.posthog.com), matching the privacy policy's "PostHog,
   Inc. (USA)".
2. **Discard client IP data.** Settings, Project, IP data capture: on. PostHog still works out the
   location from the address before discarding it.
3. **Country only.** GeoIP adds city, region, postcode and coordinates as well as country. The
   policy says country, so add a Property filter transformation (Data pipelines, Transformations)
   after GeoIP that removes `$geoip_city_name`, `$geoip_subdivision_1_code`,
   `$geoip_subdivision_1_name`, `$geoip_subdivision_2_code`, `$geoip_subdivision_2_name`,
   `$geoip_postal_code`, `$geoip_latitude`, `$geoip_longitude`, `$geoip_accuracy_radius` and
   `$geoip_time_zone`.
4. **Retention.** Events kept for up to 12 months, as the policy says. Check the plan's retention
   and set it to 12 months where it can be set.
5. **Off in the project too.** Session replay, autocapture, heatmaps, web vitals, surveys and
   exception capture: off. The code turns them all off already; this keeps it so if the code ever
   changes.
6. **Groups.** Studio's events carry a `workspace` group (the workspace's id). Group analytics is a
   PostHog add-on; without it the events still arrive, just without the group view.
7. **Deleting a person.** When a Studio account is deleted, delete the PostHog person whose
   distinct id is that user's id, with their events (the policy promises it).

## What each app sends

Every event also carries PostHog's own library properties. The ones from browsers carry the user
agent, screen size, language, time zone, the page's address cut to origin and path, and the country
(for Studio, PostHog's GeoIP derives it before discarding the address; for the site, the `/ingest`
proxy adds Cloudflare's country, because PostHog's cookieless mode drops the address before GeoIP
runs, PostHog/posthog#48660). The Workers' events set `$geoip_disable` and
`$ip: null`, so they carry no location at all.

### polyxd.com: the pages (`apps/site/scripts/analytics.ts`)

posthog-js `module.slim.no-external`, pinned by `package-lock.json` and served from
`/assets/vendor/`, with `persistence: "memory"`: no cookies, no local storage, a new anonymous id on
every page load. No autocapture, session replay, surveys, flags or external scripts. Do Not Track
and Global Privacy Control mean the script isn't loaded at all. Events go to `polyxd.com/ingest`,
which the Worker passes to PostHog without cookies or credentials (`apps/site/worker/analytics.ts`).

| Event | Properties |
|---|---|
| `$pageview`, `$pageleave` | PostHog's; addresses without query strings, fragments or ad-click ids |
| `cta_clicked` | `cta` (the button's own words), `target` (where it leads, no query), `page` |
| `install_command_copied` | `package` (`@polyxd/…` or `polyxd…`), `via` (`button` or `selection`), `page` |
| `doc_page_copied` | `page` (the docs page whose Markdown a "Copy page" button copied, never the text) |
| `gallery_pack_changed` | `pack`, `page` |
| `demo_ask` | `product`, `outcome` (`library`, `live` or `not_yet`), `page`. Never the ask |

There is no docs search and no film on the site, so there are no events for them.

### polyxd.com: the demos' live endpoint (`apps/demos/server/live.ts`, sent by the site's Worker)

Only when a model key and `POSTHOG_KEY` are both set. A new random id each time, no person profile.

| Event | Properties |
|---|---|
| `demo_live_generation` | `product`, `outcome`, `attempts`, `repaired`, `tokens`, `input_tokens`, `output_tokens`, `ms` |

### Studio (`apps/studio/src/app/analytics.ts`, `apps/studio/src/worker/analytics.ts`)

In the app, only for a signed-in person, and not with Do Not Track or Global Privacy Control:
posthog-js loads as a chunk of its own on first use, in memory, identified by the user's id (never
their name or email), with the workspace's id as the `workspace` group. No page views; every
address is cut to its shape (`/w/:workspace/screens/:key`).

| Event | From | Properties |
|---|---|---|
| `signed_up` | Worker | `method` (`email` or `google`) |
| `workspace_created` | app | |
| `design_system_imported` | app | `source` (`json`, `css`, `tarball`, `package` or `template`) |
| `roles_mapped` | app | `how` (`bulk`, `one`, `unmapped` or `reset`), `count` |
| `components_chosen` | app | `change` (`enabled`, `disabled` or `guidance`) |
| `rule_added` | app | `severity`, `from` (`rules` or `direction`) |
| `screen_authored` | app | `start` (`blank`, `template`, `shell` or `paste`) |
| `screen_published` | Worker | `version`, `kind` (`surface` or `shell`), `warnings` |
| `direction_published` | Worker | `version` |
| `api_key_created` | app | |
| `api_fetch` | Worker | `kind` (`screen`, `direction` or `pattern`), `status`. A product's API-key call: no person, the workspace group only |

The two publishes are counted in the Worker only, where they are exact, so they are never counted
twice.

### The hosted MCP server (`apps/mcp/src/analytics.ts`)

Read from copies of the request and the answer after the answer has gone out. A new random id per
event, no person profile, no location. Requests refused for the rate limit or their size aren't
counted. The one-line log is unchanged.

| Event | Properties |
|---|---|
| `mcp_initialize` | `client_name`, `client_version` (from `clientInfo`), `protocol_version`, `client_product`, `status` |
| `mcp_tool_called` | `tool`, `ok`, `error` (a class: `invalid_document`, `unknown_pack`, `unknown_component`, `unknown_direction`, `timeout`, a JSON-RPC class…), `duration_ms`, `client_product` (the User-Agent's first word), `protocol_version`; for validate, verify and show: `components` (counts by spec component type, anything else as `Other`), `has_data`, `errors`, `warnings`; for verify: `has_direction`, `has_registry`; for show: `pack` (the resolved id), `mode` |

`apps/mcp/test/analytics.test.ts` fails if any string or long number from a tool call's arguments
turns up in an event.
