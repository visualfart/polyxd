# Demos

Four products built on the published packages, each in a different design system, live under
[polyxd.com/demos](https://polyxd.com/demos/):

| Product | What it is | Design system | Shape |
|---|---|---|---|
| [Halden](halden/) | A current account for one person | Material 3 | Phone first, also desktop |
| [Foundry](foundry/) | A customer-success desk for a B2B SaaS | shadcn/ui | Dense desktop, keyboard first |
| [Wexley Borough Council](wexley/) | A resident's account with a council | GOV.UK | Forms, one thing per page |
| [Quay](quay/) | The admin of one online store, in the shape of Shopify's admin | Polaris | Dense desktop, ⌘K |

Each is a working product: its own screens, seeded data that persists in the browser and changes
when you act (with undo where the capability allows it), and an ask box for what the product has no
screen for. Those screens are Polyxd documents: generated ahead of time from the spec's own prompt,
verified across all 13 packs, and rendered in the product's design system. The "Checked" mark under
each one opens the document, the verifier's report, and the same surface in another design system.

## How a product is put together

```
halden/
  index.html, main.tsx        entry; the design system is set on <html data-pxd-theme>
  seed.ts                     the data: deterministic, dated relative to today
  views.ts                    what a surface binds to (computed views, slot resolution); no React
  intents/<id>.json           one ask each: phrases, slots, capabilities, data map, the document
  reports/<id>.json           the verifier's summary for that document
  registry.json               the capabilities the product exposes, with risk and undo
  direction.json              the product's Design Direction (voice, rules)
  live.ts                     what a screen written live may bind to (views) and may not use
  actions.ts                  what each capability does to the store; what to open next
  session.ts                  the store and the context every screen reaches
  app.tsx, ui.tsx, *.css      the product's own chrome, on --pxd-* tokens
  screens/*.tsx               the conventional screens
  authored/<id>.json          screens that are Polyxd documents a person wrote, in the intent shape
```

`authored/` holds the other kind of screen: a document authored by hand rather than generated, bound to
the same views, verified the same way (its report lands in `reports/` too) and rendered through `JitSurface`
inside the product's own shell, so the mark reads "Authored · Checked" instead of "Checked".

`kit/` is shared: a store with undo, ask matching with slots, `JitSurface` (the surface plus the mark and
the drawer), the live client (`live.ts`, `live-ui.tsx`) and types. `server/` is the live endpoint. The
generator prompt is built from the spec by `@polyxd/runtime`.

## Scripts

```sh
npm run dev -w @polyxd/demos                 # all four at http://localhost:5174/demos/
node scripts/snapshot.ts [product] [intent]  # put a data snapshot from the seed into each document
node scripts/verify.ts [product] [intent]    # verify every document in 13 packs; writes reports/
node scripts/og.ts                           # social images (the site's cards) and touch icons into public/
node scripts/shots.ts [origin] [outDir]      # phone-size screenshots of a running Halden
npm test -w @polyxd/demos                    # ask matching, slots, snapshots, the live path
```

A document changes → `snapshot` → `verify` → commit the document and its report together.

## Live generation

The demos answer from their verified library first, always. When an ask matches nothing there, a
product can write a screen for it at request time with `@polyxd/runtime`. This path exists and is
**off**: until an operator sets a model key, the public demos answer from the library only, and an
ask it doesn't cover gets the same honest "not yet" as before.

How it works:

- The site's Worker (`apps/site/worker/index.ts`) sends `/demos/api/*` to `server/live.ts`.
  `GET /demos/api/live` answers `200 { live: true }` when a model is configured and
  `503 { live: false }` when it isn't. The browser asks once per page.
- On a miss, the product posts the ask to `POST /demos/api/generate`. The endpoint runs
  `createRuntime` with the product's `direction.json`, its registry's capabilities, the product's
  own views over its seed data, and a few of its verified documents as examples. Progress comes back
  as server-sent events.
- While it writes, the product shows its own skeleton and what's happening ("Writing this
  screen…", "Checking it against the spec…"). A screen that passes shows in the product's usual
  place with a "Generated just now" mark instead of the verified one. One that still fails after
  repair is "not yet", never an unchecked screen.
- The browser keeps the runtime's interface memory (`storageStore(localStorage)`). Asking again for
  the same thing, in the same or similar words, sends last time's screen with the ask, so the new
  one is recognisable.
- Actions on a generated screen go through the product's own `actions.ts`, as on any library
  screen. An action the screen wasn't offered is refused before it gets there.

### Turning it on

The key only ever comes from a Worker secret. From `apps/site`:

```sh
npx wrangler secret put ANTHROPIC_API_KEY     # model: the runtime's default, or set POLYXD_MODEL
```

Or another provider:

```sh
npx wrangler secret put POLYXD_PROVIDER       # anthropic, openai or gemini
npx wrangler secret put POLYXD_API_KEY
npx wrangler secret put POLYXD_MODEL          # required for openai and gemini
```

Then deploy the site as usual. Deleting the secret (`npx wrangler secret delete ANTHROPIC_API_KEY`)
turns it off again. The Worker needs nothing special for the spec's checks: `@polyxd/spec` ships its
schema validators compiled ahead of time, so nothing generates code at run time.

### Guardrails

- **Off by default.** No secret, no model call: the Worker answers 503 without loading the endpoint.
- **Rate limit.** Six asks a minute per client, kept in the isolate's memory with the client's
  address hashed. Past it, `429` with `Retry-After`. It is per isolate, so it is a brake rather than
  a quota; Cloudflare's rate limiting binding would make it global.
- **Length.** Asks of 200 characters or fewer. The whole request is capped at 64 KB, and a
  remembered screen sent back at 24,000 characters.
- **Capabilities.** Only the product's own, and only those with risk `none` or `low`, minus the ones
  its `live.ts` excludes (Halden's shell navigation). Consequential actions stay behind the
  library's verified confirmations. A request can narrow the list, never widen it, and a screen that
  names anything else is refused on the server and again in the browser.
- **Data.** The model sees the product's own views over a fresh seed, nothing a visitor typed or
  changed. The browser renders the screen with the visitor's own data through the same views.
- **Cost and time.** One repair at most, so two model calls an ask, and 90 seconds in all.
- **Same site only.** A cross-site `Origin` is refused.
- **No ask in the logs.** One line per generation: product, outcome, attempts, tokens and timing.
  With the site's `POSTHOG_KEY` set too, the same numbers go to PostHog as `demo_live_generation`
  (`onGeneration` in `server/live.ts`; `docs/analytics.md`). The page counts `demo_ask`: the product
  and whether the library, live generation or "not yet" answered. Never the ask.

### Trying it locally

```sh
POLYXD_DEMOS_FAKE=1 npm run dev -w @polyxd/demos
```

`POLYXD_DEMOS_FAKE=1` swaps in a canned generator (`server/fake.ts`) that streams one fixed screen
per product, so the whole path runs with no key and no network. It only answers on a local host, so
it can't switch on anywhere else, whatever the environment says. In `vite dev` a real key in your
shell is ignored unless you also set `POLYXD_DEMOS_LIVE=1`. With the site's Worker, `wrangler dev
--var POLYXD_DEMOS_FAKE:1 --local-upstream localhost:8787` does the same.
