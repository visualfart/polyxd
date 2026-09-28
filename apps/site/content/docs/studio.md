---
title: Studio
description: Where a design-system team brings its tokens, decides what generated screens may look like, authors screens of its own, and delivers them to products. Hosted at studio.polyxd.com, or run on your own Cloudflare account.
section: Guides
order: 23
---

# Studio

[Studio](https://studio.polyxd.com) is the team's side of Polyxd: open source (Apache-2.0, in `apps/studio`), running on Cloudflare Workers with D1 and R2, and the same code whether you use the hosted one or your own. The hosted Studio is free for one workspace; a small fee may later cover its storage.

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

## Team

Workspaces, invites with roles (design-system, designer, product, engineer, viewer), sign-in through [better-auth](https://www.better-auth.com) (email and password with verification, Google when configured), API keys.

## Run it yourself

```sh
git clone https://github.com/visualfart/polyxd && cd polyxd && npm install
npm run db:migrate -w @polyxd/studio      # local D1
npm run dev -w @polyxd/studio             # http://localhost:8789
```

For production: a D1 database, an R2 bucket, `SECRETS_KEY` and `AUTH_SECRET` secrets, `RESEND_API_KEY` for email, and `npm run deploy -w @polyxd/studio`. The README in `apps/studio` has the exact steps.
