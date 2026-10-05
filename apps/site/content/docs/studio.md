---
title: Studio
description: Where a design-system team brings its tokens, decides what generated screens may look like, authors screens of its own, delivers them to products, and sees how they do. Hosted at studio.polyxd.com, or run on your own Cloudflare account.
section: Guides
order: 23
---

# Studio

> **Coming soon.** The hosted Studio at studio.polyxd.com isn't open yet. This page describes what it will do.

[Studio](https://studio.polyxd.com) is the team's side of Polyxd: source-available (the [Functional Source License](https://fsl.software), in `apps/studio`: free to run for your own team or company, not as a competing hosted service, and each version becomes Apache-2.0 after two years), running on Cloudflare Workers with D1 and R2, and the same code whether you use the hosted one or your own. The hosted Studio has a Free plan and paid ones ([Plans](#plans)); a Studio you run yourself has no plans and no limits.

## Your design system

- **Import** it as it is: an npm package (public, or private through a read-only registry token kept encrypted), a `.tgz` from `npm pack`, a Tokens Studio file, a W3C DTCG file, or CSS custom properties. Or push from where the tokens are built:

  ```sh
  POLYXD_STUDIO_KEY=… npx polyxd studio push ./ --to https://studio.polyxd.com/api/w/<workspace>
  ```

  The same package name lands as a new version of the same design system every time, so a release step can run it.
- **Start from a template** instead: one of twelve original templates (Mono, Civic, Sketch, Wireframe, Editorial, Pastel, Health, Finance, Glass, Terminal, Brutalist, Neon; the same packs as `@polyxd/ds-*`) or a blank one, each shown with a line of character and a strip of swatches from its own tokens. It becomes a design system of your workspace: tokens copied, scanned, every role mapped to the pack's token of the same name.
- **Scan**: tokens by tier and type, modes, aliases, broken and circular references, deprecated tokens.
- **Map** Polyxd's 87 roles onto your semantic tier, with alias chains, contrast measured in every mode, candidates for each role, bulk accept for exact matches, and publish, blocked while any pair fails contrast.
- **Tune** in the tokens editor: primitives by group, colour ramps as swatches with the roles that read each and whether their contrast pairs pass, scales as lists. Change a value and every alias through it follows, with contrast measured again as you type; save the edits as a new draft version. Mono and Blank have a **Rebrand** slider: one hue turns the whole brand ramp, keeping each step's lightness (contrast is re-measured, not assumed).
- **Export** a version for code: CSS variables (exactly the `--pxd-*` theme `@polyxd/react` builds for a pack, plus shadcn/ui's names), a DTCG pack bundle, a Tailwind theme extension, a Style Dictionary v4 source, a Swift enum, a Kotlin object. From the Export button, or `GET /api/w/<workspace>/design-systems/<id>/versions/<version>/export?format=css|dtcg|tailwind|style-dictionary|swift|compose` with an API key. A published version exports as is; a draft's file starts with a banner saying so.
- **Browse** your tokens by tier and group, with what each resolves to and what references it.

## Direction

A [Design Direction](/docs/design-direction) is the team's taste as one versioned file. Studio edits a whole one, section by section, and products fetch the published one by key.

- **Profile**: density, numbers and data, motion, secondary detail, freedom and primary actions per view, each as cards with a small drawing and a line on what it does; the schema's default is marked until you choose.
- **Voice**: guidelines, tone as sliders (formality, energy, warmth, humour), who's talking, casing, spelling, the highest reading grade, exclamation marks and emoji, button labels, the words to use instead of others and the words never to say, and guidance for recurring moments (empty, error, success, confirm, loading, before something is lost). Beside it, a heading, a sentence and a button you type are checked as you type by the verifier's own copy checks, with the words it flags marked.
- **Patterns**: prefer, allow or rule out each of the spec's six, and write your own: the situations it's for, how to handle them, and the components you prefer in reading order. Yours are pattern files of the Direction's own, in the spec's pattern format.
- **Exemplars**: the workspace's screens, attached with the request each answers and drawn small with the renderer, in your design system.
- **Rules**: yours, as verifier checks with a severity and an on/off switch. They run on every screen saved in Studio and in the verifier when a product passes them, and every Direction in the workspace carries the ones switched on when it is saved. The Rules page and the Direction's Rules tab are the same list.
- **Components**: which of the 44 are on for generators, guidance the generator reads, and your own implementation per component. They are the workspace's, shown in the Direction editor too; the Direction file has no place for them yet.

Every change is checked against the Direction schema (`direction.schema.json`, and the pattern schema for your own patterns), and a problem shows beside the control it's about; a Direction that doesn't fit isn't saved. **Save** keeps a version with a note and your own version number (Studio suggests the next one); **Changes** compares the editor with the published version, or any saved one, field by field ("Density: Comfortable → Compact", "Words to avoid: added “kindly”"); **Publish** makes a version the one products get. **Export** downloads the Direction as `<key>.direction.json`, valid against the schema; **Import** loads a Direction file into the editor as unsaved changes, keeps your own patterns it still lists, and offers any rules in it that the workspace lacks.

## Screens

Where designers author a product's surfaces, in the same format a generator writes:

- A **component tree** with a picker of the 44 components by category; add, remove, reorder, duplicate; keyboard throughout.
- A **property panel** generated from the spec's schema: enums, booleans, numbers, text that can be bound to data with a pointer picker over the sample data, references as pickers of existing components, actions as an event plus context.
- A **live preview** in the workspace's own design system (its published mapping, as variables) or any of the 13 built-in ones, light and dark, phone, tablet and desktop, or any width; click a component in the preview to select it in the tree.
- **Issues** as you edit, from the same checks the verifier runs statically; Publish stays disabled while an error remains.
- **Versions** with notes and restore; **Publish** marks the one products get.

**Shells** are authored the same way. New screen → Shell starts from the spec's shell example, named after your product: a Frame with an AppBar, a main Navigation, the Outlet, an aside and a Footer. The tree shows the Frame's regions as labelled slots; the preview draws the shell with `PolyxdFrame` and a stand-in in the Outlet (a placeholder, or any published screen of the workspace), at phone, tablet and desktop, so the navigation's bar, rail and side forms show. The surface's `kind` and `origin` are edited from the Surface row; the checker applies the spec's shell rules (shell components only in a shell, which is authored, with a Frame at the root and exactly one Outlet under its main), and the picker refuses a shell component in a surface with the same message.

## Delivering a screen to a product

A published screen is fetched by key, with an API key from Team → API keys (keys can import tokens and read design systems, screens and Directions, nothing else):

```sh
curl -H "Authorization: Bearer $POLYXD_STUDIO_KEY" \
  https://studio.polyxd.com/api/w/<workspace>/screens/<key>
```

It returns the document with `surface.origin: "authored"` and an `X-Polyxd-Screen-Version` header. A key reads published screens and design systems and can't change anything; fetch on the server or at build time, since a screen changes when someone publishes, not on every request. Render it with `PolyxdSurface` (or `PolyxdFrame` for a shell) exactly like a generated one.

## Delivering a Direction

A published Direction is fetched the same way, by its key, which is also its `name` in the file:

```sh
curl -H "Authorization: Bearer $POLYXD_STUDIO_KEY" \
  https://studio.polyxd.com/api/w/<workspace>/directions/<key>
```

It returns the Direction, valid against `direction.schema.json`, with an `X-Polyxd-Direction-Version` header (the Studio version number); an unpublished one answers 404. Paths inside it are relative to that address: your own patterns are listed in `patterns.custom` as `<key>/patterns/<id>.json`, fetched from `…/directions/<key>/patterns/<id>.json`, and an exemplar screen as `../screens/<screen>`, which is the screen's own delivery address. Hold a document to it with `directionRules(direction)` from `@polyxd/spec`, as in [Design Direction](/docs/design-direction). A key reads Directions and can't change them.

## Insights

Insights shows how your screens do in your product, from the [semantic events](/docs/product#semantic-analytics-events) your product's renderer already emits. Studio counts them each day. It never keeps the events.

- **A table of intents** over the last 7, 30 or 90 days: how often each was shown, completed and abandoned, the completion rate, the time to complete, input errors with the most common component and reason, Statuses shown, undo, and the feedback average. An intent that matches one of your screens links to it.
- **A page per intent**: each day drawn by Polyxd's own Chart in your design system, the steps from shown to started to completed, input errors by component key and reason, the actions taken, the Statuses shown, how people left, and generated screens beside authored ones when both sent events.
- **Honest figures.** Completion is tasks completed for every time the screen was shown, so a journey spread over two screens reads lower than it is. A screen with no task, such as an overview, has no completion rate. Time to complete is the range the median falls in (under 2 s, 2 to 5 s, and so on up to over 5 min) and the mean, because Studio keeps no single durations.

To start, make an **ingest key** (on the Insights page, or in Team) and point `toFetch` from `@polyxd/analytics` at your workspace:

```ts
const studio = toFetch("https://studio.polyxd.com/api/w/<workspace>/events", {
  headers: { "x-polyxd-key": "<ingest key>" },
});
<PolyxdSurface document={doc} onEvent={studio} events={{ generator: "my-model@3" }} />
```

Name the generator on generated screens; a screen whose events name none counts as authored.

An ingest key is publishable, like the key a web analytics tool puts in a page. It can send events to its own workspace and nothing else: it can't read a screen, a Direction, a design system or Insights, and it isn't an API key. Studio shows it again whenever you need it, and revoking it stops it at once. The endpoint, `POST /api/w/<workspace>/events`, answers browsers from any origin, without cookies. It takes up to 100 events and 64 KB a request, and limits requests per key and per address.

**What Studio keeps:** daily counts by intent, surface id, pattern, event type, component key, capability, reason code, generated or authored, and person or agent, plus sums of completion times and feedback ratings. Every one of those must be a short code, so a value in the wrong place is left out. An event with a property the schema doesn't define is dropped whole, and the answer says how many were. Never kept: the events, session ids, timestamps, values, experiment variants, the Direction or the generator's name. Counts are kept for 90 days, the same on every workspace, since Studio has no plans yet. The workspace owner can delete them all from the Insights page.

## Team

Workspaces, invites with roles (design-system, designer, product, engineer, viewer), sign-in through [better-auth](https://www.better-auth.com) (email and password with verification, Google when configured), API keys, and ingest keys for Insights. Owners can take someone out of a workspace, and an invite can be withdrawn before it is used.

## Plans

Plans apply to the hosted Studio only. You pay per editor: a viewer is always free, and every other role (owner, design-system, designer, product, engineer) is an editor.

| | Free | Pro | Team | Enterprise |
|---|---|---|---|---|
| Price | $0 | $8 a month, or $80 a year | $12 per editor a month, or $120 a year | talk to us |
| Workspaces you own | 1 | 3 | unlimited | unlimited |
| Editors | 2 | 1 | unlimited | unlimited |
| Design systems | 1 | unlimited | unlimited | unlimited |
| Directions | 1 | unlimited | unlimited | unlimited |
| Published screens | 10 | unlimited | unlimited | unlimited |
| Fetches by key a month (screens, Directions, tokens) | 10,000 | 250,000 | 1,000,000 | 10 million or more |
| Version history | last 10 | all | all | all |

- **Reaching a limit** stops only the new thing: another design system, another published screen, another editor. Studio says which plan has room. Everything you already have keeps working.
- **Going over your fetches never breaks your product.** Studio warns you at 80% and 100% on the Billing page. If a workspace stays over for 7 days, editing pauses until it upgrades or the month turns; products still get their screens, Directions and tokens.
- **Billing** is under Workspace → Billing: your plan, your seats, what you've used this month, and the buttons to upgrade or manage your subscription (owners only; payment is through Stripe). On Team, adding or removing an editor changes your seats, prorated.
- **The founding offer**: the first 100 paying workspaces pay half, for as long as they stay subscribed.
- **You can always leave**: every design system, screen and Direction exports as JSON on every plan.

## Roles

| Role | How many | What they can do |
|---|---|---|
| Owner | exactly one | Everything, plus billing, deleting the workspace and handing it to someone else |
| Admin | any number | Everything except those three: invite, remove, change roles, edit tokens, rules, screens and Directions |
| Design system | any number | Tokens, components, rules, releases |
| Designer | any number | Direction, reviews, exemplars |
| Product | any number | Capabilities, journeys, Insights |
| Engineer | any number | Components, capabilities, integrations |
| Viewer | any number | Everything, read only — and always free |

Owner is never invited or set from the role list. It moves only by **handing the workspace over** (Team → Make owner), which makes the new person owner and the previous one an admin in the same step, so there is always exactly one. Everyone but a viewer counts as an editor for your plan's seats.

## Support

The people who run a hosted Studio can open **/admin**: find any workspace or person, set a plan by hand, hand a workspace to a new owner when the old one has gone, take someone out, and read what Stripe says about a customer. It never writes to Stripe.

Who counts is the `SUPER_ADMINS` secret — email addresses separated by commas, checked against the signed-in person on every request. It is deliberately not a column, so editing the database grants nobody access. Every change is recorded with the address that made it, what it was before and after, and the reason given.

A plan set by hand is separate from a Stripe subscription. **Enterprise** is the one a Stripe event never overwrites, so use it for comps, design partners and deals invoiced elsewhere.

## Run it yourself

```sh
git clone https://github.com/visualfart/polyxd && cd polyxd && npm install
npm run db:migrate -w @polyxd/studio      # local D1
npm run dev -w @polyxd/studio             # http://localhost:8789
```

For production: a D1 database, an R2 bucket, `SECRETS_KEY` and `AUTH_SECRET` secrets, `RESEND_API_KEY` for email, and `npm run deploy -w @polyxd/studio`. The README in `apps/studio` has the exact steps. Your own Studio has no plans and no limits: as many editors, design systems, Directions, screens and fetches as you like, and no Billing page.

The [licence](https://github.com/visualfart/polyxd/blob/main/apps/studio/LICENSE) lets you run Studio for your own team or company, change it, and share your changes. It does not let you offer Studio, or something substantially like it, as a service to others. Each version becomes Apache-2.0 two years after its release.
