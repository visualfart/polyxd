# 0005 — Images, maps, follow-ups and the other gaps in chat screens

Status: **proposed** (10 Oct 2026). Nothing here is built.

## Why now

Making the listing video, we picked the most ordinary thing people ask an AI ("Plan 3 days in Lisbon for two, under €600") and tried to answer it as a Polyxd screen. Two things broke:

- **Images don't show in the chat.** The MCP App resolves every media reference to a grey box (`placeholderMedia` in `packages/mcp/src/view/app.ts`), and its Content Security Policy allows no outside origin at all. Any screen about a place, a product, a hotel or a person looks broken.
- **There is no map.** The trip plan wants the three days as pins on a map with the route between them. The video's map is a drawing passed in as an image, which only works because we swapped the grey box ourselves.

Anthropic's Economic Index shows what people bring to Claude: coding first (about a third of claude.ai conversations), then writing, learning, office work, sales and planning, and the spread is widening (the top 10 tasks fell from 24% to 19% of conversations between November 2025 and February 2026). Outside coding, most of those asks are about **places, things, times and next steps**, so we checked the spec against them.

## What we already have (and I wrongly called missing)

Before writing this I checked each "gap" against `packages/spec/components/`:

| Need | Already in the spec |
|---|---|
| Carousel of cards | `Collection` `layout: "carousel"` (snap points, Previous/Next, "N of M") |
| Timeline / itinerary | `Collection` `layout: "timeline"` |
| Calendar view | `Collection` `layout: "calendar"` with `datePath` |
| Task flow with progress | `Steps` (`wizard`, `tasklist`, `guide`) |
| Dates and times | `DateInput` (`date`, `time`, `datetime`, `dateRange`, `month`, `year`) |
| Video, audio, gallery, QR | `Media` kinds |

So the gaps are narrower than they first looked. Most of them are about **rendering in chat hosts**, not missing components.

## The gaps, in order

### 1. Images in chat hosts (P0)

Generated documents never contain URLs, by design (a model mustn't be able to put an arbitrary link or tracking pixel on screen). A host passes `resolveMedia(ref) → url`. The React and Web renderers support this. The hosted MCP App has no host data to resolve from, so it draws grey boxes.

**Decision needed: where image URLs come from in a chat.**

- **(a) The model passes them, from its own tool results.** `polyxd_show` gains an optional `media` argument: `{ "<ref>": "https://…" }`. The model may only use URLs that came from a tool result or the user (a search result's image, a product feed), the same rule as "never invent numbers". The verifier can't prove where a URL came from, so the guide states the rule and the server rejects anything that isn't `https:`.
- **(b) The MCP App loads them through one origin we control.** The page's CSP can't list every image host, and Claude and ChatGPT take a fixed `resourceDomains` list. So images go through `media.polyxd.com/i?u=<url>`: a Cloudflare Worker that fetches only `image/*`, caps size (say 5 MB) and dimensions, strips metadata, caches, and logs nothing but counts, like the MCP server. The CSP then lists one origin.

**Recommendation: both.** (a) says which image; (b) makes it loadable inside the sandbox. Write the privacy-policy paragraph before shipping (the proxy sees image URLs, not conversations).

**Quick win, independent of the decision:** when `resolveMedia` returns nothing, every renderer draws an **alt-text tile** (the alt text on a subtle surface with an image glyph) instead of a grey box. It's honest and readable today. The renderers change in `packages/core` and both renderers, and the MCP view drops `placeholderMedia`.

**Open question to test first:** do Claude and ChatGPT accept a `resourceDomains` entry for our proxy in the MCP App's `_meta.ui.csp` and `openai/widgetCSP`? Prove it with one image before building the proxy.

### 2. A `Map` component (P0)

**Spec.** A new component, `Map` (category `content`; it's an input when `selection` is set).

| Prop | Meaning |
|---|---|
| `label` | What the map shows ("Your three days in Lisbon") |
| `places` | Binding to an array in host data |
| `latPath`, `lngPath`, `titlePath` | Relative paths in each place. Required |
| `orderPath` | Optional; numbers the pins and orders the route |
| `kindPath` | Optional; `stay`, `stop`, `start`, `end` draw different pins |
| `route` | `none` (default), `ordered` (straight segments in order), or `path` (a polyline from host data via `routePath`) |
| `selection`, `selected` | `none` / `single`: picking a pin sets a binding, like `Collection` |
| `summary` | Required text, as with `Chart`: what the map says in words |
| `basemap` | `auto` (default), `outline` or `none` |

**Rules for generated screens** (validator and verifier):
- Coordinates are always bound to host data, never literals in the document. Same reason numbers are: a model must not invent where a place is.
- `summary` is required. The places are also always reachable as a text list (a disclosure under the map), so the map never carries information that isn't in text (WCAG 1.1.1, as `Media` already says).
- At most 25 places per map; past that the renderer clusters them and the verifier warns.

**Rendering.**
- Web Mercator, fitted to the places' bounds with padding. Pins are buttons, Tab-reachable in `order`, named by their title.
- Pins, route and labels use existing tokens (`color.action.primary.*`, `color.text.*`). The basemap needs new ones in the token contract (`ds-kit`): `color.map.land`, `color.map.water`, `color.map.park`, `color.map.road`, `color.map.label`. Every pack gets light and dark values; packs that don't set them derive them from `surface` and `status.info`.
- **Basemap `outline`:** a simplified world land and coastline layer shipped with the renderer and loaded only when a `Map` is on screen. Natural Earth (public domain) 1:50m, simplified to TopoJSON, should be a few hundred KB; measure it. This works offline, in every host and in the verifier.
- **Detailed basemap (streets, labels):** a host hook, `resolveTiles`, like `resolveMedia`. For the hosted MCP App we serve vector tiles ourselves from `tiles.polyxd.com` (Protomaps PMTiles on R2, OpenStreetMap data with its attribution shown on the map) and add that one origin to the CSP. Same CSP test as images.

**A2UI export:** no map in A2UI's basic catalog, so export as a `List` of the places plus the summary `Text`, like `Chart`.
**Native mappings** for later: MapKit `Map` with `Annotation`s, Google Maps Compose.

**Examples:** the Lisbon trip, a store finder ("pick a branch near you", with selection) and a delivery in progress (`route: path`).

### 3. Follow-up suggestions (P1)

Chat screens should end with what to ask next ("Make it cheaper", "Swap Saturday for Belém", "Show hotels"). Today a model writes these as prose under the screen, or as `Action`s, which are for host capabilities and look like commitments.

**Spec.** A surface-level `followUps` list, or a `Suggestions` component; decide in review. Each entry is a short ask in the person's own words.
- Pressing one sends it as the person's next message (MCP: `ui/message` with the text). Outside chat it's an `onAction` with the reserved name `ui.ask` and `{ text }`.
- At most 4, each at most 40 characters. They never do anything themselves: no event names, no context, so a suggestion can't book or pay.
- Rendered as chips under the surface, after the primary action, in reading order.
- **Check first:** whether Claude and ChatGPT already draw their own suggestions under an app. If they do, ours must not duplicate them, and the renderer can hide ours when the host says so (`hostContext`).

### 4. Time slots (P1)

Booking is a top everyday ask (a haircut, a table, a call). `DateInput` picks any date; people need to **pick from what's free**.

**Spec.** `DateInput` `kind: "slot"`: `slots` binds to an array of `{ start, end?, available }`, grouped by day in the person's locale and time zone, which is shown. Single or `multiple`. Unavailable slots show but can't be chosen, and the verifier checks there's at least one available slot. A2UI: `DateTimeInput` plus a `ChoicePicker` of times.

### 5. Board (P2)

Planning and task screens ("sort these into this week, next week, later"). **Spec:** `Collection` `layout: "board"` with `groupPath` and `groups` (the columns). Moving a card between columns uses the existing reorder event plus the new group. Keyboard: move with arrows and a "Move to…" menu, as `reorderable` already requires. A2UI: a `List` per column.

### 6. Smaller things to check, not plan yet

- **Itinerary days:** check that `Collection` `timeline` groups by day with times. If it doesn't, add `groupPath` (shared with the board).
- **Place and product cards** work today (`Card` with `media` in a `Collection` carousel) and are only blocked by gap 1.
- **Location input** ("deliver to…"): `TextInput` `suggestions` covers addresses; `Map` with `selection` covers "pick on a map". No new component yet.

## What adding a component touches

From the 0.2 commit that added eleven at once (`373a5b6`):

1. `packages/spec/components/<Name>.json`, then the regenerated schema, catalog and precompiled validators.
2. `packages/core` (shared logic) and both renderers, `@polyxd/react` and `@polyxd/web`, held together by the verifier's conformance suite.
3. Token contract in `ds-kit`, and values in all 25 packs (light and dark).
4. `@polyxd/a2ui` mapping and catalog.
5. Verifier: static rules, rendered checks (axe, layout), agent readout.
6. Examples, `docs/components.md`, the site's components and coverage pages.
7. These follow from the spec automatically: the MCP guide, the runtime's prompt and the VS Code extension's Insert component. Check each one.
8. `python-spec` version.

## Order and release

| Step | What | Size |
|---|---|---|
| A | Alt-text tiles instead of grey boxes (renderers + MCP view) | small, ship in a patch |
| B | CSP test in Claude and ChatGPT for one proxy origin, then the media proxy, `polyxd_show` `media` argument and the privacy text | medium |
| C | `Map` with the outline basemap, three examples, tokens in every pack | large |
| D | `followUps`, after checking host behaviour | medium |
| E | `DateInput` `slot` | medium |
| F | Tiles for `Map` in the hosted MCP App | medium |
| G | `Collection` `board` | medium |

A ships alone. B to E are **spec 0.4.0**: additive, so 0.3 documents still validate. All packages move to **0.5.0** together, as before. F and G can follow in 0.5.x.

## Not doing

- Any third-party map or image service that needs a key or tracks people. If we host it, it logs counts only, like the MCP server.
- Letting generated documents carry URLs. Media references stay references; only the host, or our proxy, turns them into images.
