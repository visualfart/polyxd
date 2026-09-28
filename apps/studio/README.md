# Polyxd Studio

Where a design-system team decides what generated screens may look like, and reviews what they actually look like. Apache-2.0, like the rest of Polyxd.

Run it yourself on your own Cloudflare account, or use the hosted one at studio.polyxd.com (same code; a small fee may cover its storage later).

## What works

- A landing page at `/` for anyone signed out (and at `/welcome` for anyone signed in): what Studio does, in the site's voice, with the spec's send-money example drawn live by `@polyxd/react` and cycled through three design systems, product images captured from Studio itself (`public/landing/`), and the sign-in split beside it (`/signin`, `?mode=signup` or `?mode=forgot` open that form).
- Sign up and sign in through [better-auth](https://www.better-auth.com), open source and running inside the Worker: email and password with verification, password reset, Google when a client is configured; two-step verification and SAML/OIDC single sign-on are its plugins, to add when a customer needs them. Workspaces, invites with roles, API keys.
- Import a design system as it is, from an npm package (public, or private through a read-only registry token kept encrypted, an uploaded `npm pack` tarball, or `polyxd studio push` from inside your network), a Tokens Studio file, a W3C DTCG file, or CSS custom properties.
- Or **start from a template**: one of the twelve original template packs (`packages/ds-{mono,civic,sketch,wireframe,editorial,pastel,health,finance,glass,terminal,brutalist,neon}`, bundled into the Worker as JSON), or a blank one (Mono's structure with a grey ramp). Each is shown with one line of character and a strip of swatches from its own tokens. It becomes a design system of the workspace with its tokens copied, scanned, and every role mapped to the pack's semantic token of the same name (exact matches accepted), ready to tune and publish.
- A scan of what was found: tokens by tier and type, modes, broken and circular references, deprecated tokens.
- Mapping Polyxd's 87 roles onto your semantic tier, with alias chains, contrast measured in every mode, candidates to point a role at instead, bulk accept for exact matches, and publish (blocked while any pair fails contrast).
- **Tune** a version in the tokens editor: primitives by group, colour ramps as swatches (each with the roles that read it and whether their contrast pairs pass), spacing, radius and type scales as lists. Edit a value (hex, a colour picker, a `{reference}`, or the JSON of a composite) and every alias that resolves through it follows, with the mapping's contrast pairs measured again as you type, by the same code the mapping page uses. Save keeps the edits as a new draft version with a note, the mapping carried over; a live version is never changed in place. **Rebrand**, for the Mono and Blank templates: turn the brand ramp's hue with one slider (and its chroma with another). It keeps each step's lightness and chroma and rotates the hue, in every mode; the other ramps keep theirs, and contrast is re-measured rather than assumed.
- **Export** a version for code, in six shapes (below), from the Export button or `GET /api/w/<workspace>/design-systems/<id>/versions/<version>/export?format=…` with a session or an API key. A published version exports as is; a draft carries a banner at the top of every file.
- Browse your own tokens by tier and group, with what each resolves to and what references it.
- Components: which are on for generators, guidance the generator reads, and your own implementation per component.
- Rules: yours, as verifier checks, with severity and an on/off switch. The starters Studio suggests are checks from the spec's vocabulary, so a Direction can carry them.
- **Directions**: a whole Design Direction (`packages/spec/schema/direction.schema.json`) edited in Studio, several per workspace, each with a key. Profile as cards with a drawing per choice; voice (guidelines, tone sliders, person, casing, spelling, reading grade, exclamation marks and emoji, button labels, words to use and to avoid, moments) with a sample heading, sentence and button checked as you type by the spec's own copy checks (`@polyxd/spec/checks`, the rules `compileVoice` makes); the spec's six patterns preferred, allowed or ruled out, and the team's own written in the pattern format; the workspace's screens attached as exemplars with the request each answers, drawn small with `@polyxd/react`. The workspace's rules are the Direction's rules (carried as they are when it is saved) and its components sit beside them, the same lists as the Rules and Components pages. Every change is checked against the schema by Studio's own walk of it (`src/direction/schema.ts`), each problem in plain words beside its control; the Worker refuses to save one that doesn't fit. Versions with notes and the file's own version number; a field-by-field diff of the editor against the published version or any saved one; publish, unpublish; export as `<key>.direction.json` and import from a file.
- Screens: surfaces a designer authors rather than generates, and the **shell** they sit in. A screen is a Polyxd document edited as a tree of components (all 44, with the spec's guidance), drawn live with `@polyxd/react` in your published design system (or any built-in theme; light and dark; phone, tablet and desktop; three densities), with a property panel made from the schema, a sample-data tab for bindings, and the JSON always within reach. It is checked as you edit, the way a generated screen is: schema, references, bindings against the sample data, the spec's shell rules, and your rules. Save keeps versions with notes; Publish makes one the document your product fetches by key. Start from one of the spec's examples, blank, pasted JSON, or the Shell template.
- Shells: New screen → Shell starts from the spec's `shell-product.json`, named after your product: a Frame with an AppBar, a main Navigation, the Outlet, an aside with a `Custom` logo slot, and a Footer. The tree shows the Frame's regions as labelled slots (banner, header, navigation, main, aside, footer; empty ones can be filled). The preview draws it with `PolyxdFrame`, as your product will, with a stand-in in the Outlet (a placeholder, or any published screen of the workspace, from the toolbar), at phone, tablet and desktop, so the navigation's bar, rail and side forms show; the shell fills the preview's height (not the window's), and a frame wider than the preview scrolls both ways, while a surface wider than it is scaled to fit. The surface's `kind` and `origin` are edited from the Surface row at the top of the tree. The checker applies the spec's shell rules exactly as `@polyxd/spec` does: shell components (Frame, AppBar, Footer, Outlet, Custom) only in a shell, which is authored, with a Frame at the root and exactly one Outlet reachable from its main; a `Custom`'s fallback is never a shell part; `Navigation.placement` outside a Frame is a warning. The picker and the reference fields refuse shell components in a surface with the same message.

Reviews, releases, insights and the flow map come once screens flow in through the SDK. Components aren't in the Direction file: the schema has no place for them yet.

## Deliver a screen to your product

A published screen is fetched by key with an API key from Team → API keys (a key reads published screens and design systems; it can't change anything). The answer is the document itself, with `surface.origin: "authored"` set, ready for `PolyxdSurface`:

```sh
curl -H "Authorization: Bearer $POLYXD_STUDIO_KEY" https://studio.polyxd.com/api/w/<workspace>/screens/send-money
```

```ts
const doc = await fetch(`${STUDIO}/api/w/acme/screens/send-money`, { headers: { authorization: `Bearer ${key}` } }).then((r) => r.json());
<PolyxdSurface document={doc} data={liveData} theme="acme" onAction={handle} />
```

A shell is fetched the same way: the document comes back with `surface.kind: "shell"`, and your product renders it with `PolyxdFrame`, its screens as children in the Outlet:

```ts
const shell = await fetch(`${STUDIO}/api/w/acme/screens/shell`, { headers: { authorization: `Bearer ${key}` } }).then((r) => r.json());
<PolyxdFrame document={shell} data={shellData} theme="acme" current={{ key: "shipments", title: "Shipments" }} onAction={route}>
  <PolyxdSurface document={doc} data={liveData} theme="acme" onAction={handle} />
</PolyxdFrame>
```

The response carries `X-Polyxd-Screen-Version`; an unpublished screen answers 404. `GET …/screens` lists the workspace's screens with their published version and `kind`, and `GET …/screens/<key>/versions` the history. Fetch on the server or at build time and keep the document with your bundle: a screen changes when someone publishes, not on every request.

## Deliver a Direction

A published Direction is fetched by its key (its `name` in the file) with the same kind of API key:

```sh
curl -H "Authorization: Bearer $POLYXD_STUDIO_KEY" https://studio.polyxd.com/api/w/<workspace>/directions/<key>
```

The answer is the Direction, valid against `direction.schema.json`, with `X-Polyxd-Direction-Version` (Studio's version number); an unpublished one answers 404. Its rules are the workspace's rules that were on when the version was saved. Paths in it are relative to that address: the team's own patterns are listed in `patterns.custom` as `<key>/patterns/<id>.json` and served at `GET …/directions/<key>/patterns/<id>.json`, and an exemplar that is one of the workspace's screens is `../screens/<screen>`, the screen's own delivery address (published screens only). `GET …/directions` lists the workspace's Directions, `GET …/directions/<key>/versions` the history and `GET …/directions/<key>/versions/<n>` one version. Hold a document to it with `directionRules(direction)` from `@polyxd/spec`.

## Deliver a design system to your code

`GET /api/w/<workspace>/design-systems/<id>/versions/<version>/export?format=<format>` returns one file; the Export button in Studio downloads the same. The response carries `X-Polyxd-Design-System-Version` and `X-Polyxd-Design-System-Status` (`live` or `draft`); a draft's file starts with a banner saying so (a comment, or a `$draft` key in the JSON formats). Every format starts from the same thing: the 87 roles, each resolved through the version's mapping to a value per mode.

| `format` | File | Shape |
|---|---|---|
| `css` | `<name>.css` | `[data-pxd-theme="<name>"][data-pxd-mode="<mode>"] { --pxd-<role>: …; }` per mode, the default mode also without a mode attribute, exactly what `packages/react/scripts/build-themes.ts` emits for a pack (typography as `-family`, `-size`, `-weight`, `-line-height`, `-letter-spacing`), plus shadcn/ui's variable names (`--background`, `--primary`, `--radius`, `--chart-1`…) set from the roles and `color-scheme`. A version started from a template with an extras stylesheet (Sketch, Wireframe) gets it appended, rescoped to the design system's name. An unmapped role is a comment, never a guess. Use it with `@polyxd/react/styles.css` and `theme="<name>"`. |
| `dtcg` | `<name>.pack.json` | The design system as a Polyxd pack, in one JSON bundle: `manifest` (name, modes → files, `defaultMode`, `contractVersion`, provenance) and `files`, one DTCG tree per token set (`tokens/<set>.json`, with `$value`, `$type`, `$description`, `$deprecated`), plus `tokens/extras.css` when there is one. Write each file to its path beside the manifest and it checks with `polyxd check`. |
| `tailwind` | `<name>.tailwind.config.js` | `module.exports = { theme: { extend: { colors, spacing, borderRadius, borderWidth, fontFamily, fontSize, boxShadow, transitionDuration, transitionTimingFunction, outlineWidth, outlineOffset, opacity, maxWidth } } }`, every value a `var(--pxd-…)` from the CSS export so modes follow `data-pxd-mode`, with the default mode's value in a comment after each. Colours nest by role (`colors.surface.DEFAULT`, `colors.action.primary.background`); type gives `fontFamily` and a `fontSize` tuple with line height, letter spacing and weight. |
| `style-dictionary` | `<name>.tokens.json` | A Style Dictionary v4 source in the DTCG format: one tree per mode (`light`, `dark`, …), the roles nested by their path, each `{ "$type", "$value" }` with aliases inside composites resolved. Point a platform at its mode's tree. |
| `swift` | `<Name>Tokens.swift` | `public enum <Name>Tokens { public enum Light { public static let colorSurfaceDefault: Color = Color(red:green:blue:) … } public enum Dark { … } }` with `CGFloat` lengths (1px = 1pt), `TimeInterval` durations, `[Double]` easings, and `Typography` and `Shadow` structs defined in the file. |
| `compose` | `<Name>Tokens.kt` | `object <Name>Tokens { object Light { val colorSurfaceDefault = Color(0xFFFBF7EE) … } object Dark { … } }` with `.dp` lengths, `.sp` type sizes, millisecond durations, `CubicBezierEasing`, and `Typography` and `Shadow` data classes. Add your package line. |

Values a format can't express (a colour it can't read, a gradient) become a comment naming the role, so nothing is silently dropped.

## Push from your own build

Studio can fetch a public package, or a private one through a read-only registry token. When neither suits (the registry is inside your network, or the tokens are built rather than published), push from where the tokens are:

```sh
POLYXD_STUDIO_KEY=<key from Team → API keys> npx polyxd studio push ./ --to https://studio.polyxd.com/api/w/<workspace>
```

A directory is packed with `npm pack` (so it is exactly what a release would be); a `.tgz` or a single token file is sent as is. The same package name lands as a new version of the same design system every time, and the command prints the scan and a link to review the mapping. Keys can import and read design systems, nothing else.

## Run it locally

```sh
npm install                       # at the repository root
npm run db:migrate -w @polyxd/studio
npm run dev -w @polyxd/studio     # builds the app, then wrangler dev on http://localhost:8789
```

Create an account with any email: locally no email goes out, so it works at once. Tests: `npm test -w @polyxd/studio`; `test/*.worker.test.ts` run the Worker itself in Node (`test/support/worker.ts`: D1 as an in-memory SQLite database with every migration applied, sign-up through better-auth, requests through `app.request`).

The landing's product images are captured from a running Studio: against a local one with a database of its own (`--persist-to` a scratch directory for both the migration and `wrangler dev`), `node apps/studio/scripts/landing-shots.ts` makes a test account and the Harbourline workspace (the Sketch pack imported, a Mono-based design system rebranded and published, the spec's screens and the shell) and writes `public/landing/*.png`. `node apps/studio/scripts/og.ts` then writes the social image, `public/og.png`, from the brand and one of those images.

## Deploy your own

`wrangler.jsonc` has a `production` environment; copy it and change the route to your domain.

1. `npx wrangler d1 create studio`, put the id in the environment's `d1_databases`, then `npm run db:migrate:remote -w @polyxd/studio`.
2. `npx wrangler r2 bucket create polyxd-studio-files`.
3. Secrets, with `npx wrangler secret put <NAME> --env production`: `AUTH_SECRET` (a long random string; signs sessions), `SECRETS_KEY` (another; encrypts registry tokens), `RESEND_API_KEY` (verification, reset and invite emails; without it, links are logged), and optionally `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for "Continue with Google" (redirect URI: `<APP_URL>/api/auth/callback/google`). Analytics are off unless you also set `POSTHOG_KEY` (and `POSTHOG_HOST` for PostHog's EU cloud); `docs/analytics.md` says what they send.
4. `npm run deploy -w @polyxd/studio`.

The hosted one at studio.polyxd.com is this same configuration.

## Layout

| Path | What |
|---|---|
| `src/import/read.ts` | Token files in: Tokens Studio, DTCG, CSS. Tiers, modes, aliases, issues |
| `src/import/scan.ts` | What was found, by tier and type |
| `src/import/map.ts` | Roles onto the semantic tier, contrast in every mode, candidates |
| `src/import/package.ts` | npm packages: registry fetch, untar, find the token files |
| `src/templates/` | The twelve template packs bundled as JSON (`packs.ts`), their extras stylesheets as text (`extras.ts`), and each as a graph with a swatch summary |
| `src/tokens/` | Editing: a pack as a graph, edits applied with aliases re-checked, the OKLCH ramp and rebrand, values as CSS and as one line |
| `src/export/` | The six export formats |
| `src/worker/` | The API on Workers: auth, workspaces, design systems, templates, editing, export, components, rules, screens, Directions |
| `src/screens/` | Screens, shared by the Worker and the app: the schema read directly (the editor's shapes, and problems placed at the prop they are about), the checker with the spec's shell rules, the tree edits |
| `src/direction/` | Directions, shared by the Worker and the app: what a version stores and what a product gets (`model.ts`), the schema check in plain words (`schema.ts`), the field-by-field diff (`diff.ts`), the voice sample (`voice.ts`), and every setting's words (`labels.ts`) |
| `src/app/` | The React app; `src/app/screen/` is the editor's tree, preview, property panel and themes; `pages/Direction.tsx` and `src/app/direction/` the Direction editor; `pages/TokensEditor.tsx` the tokens editor; `pages/Landing.tsx` and `landing.css` the landing, `pages/SignIn.tsx` and `signin.css` the sign-in |
| `migrations/` | D1 schema |
| `scripts/` | `landing-shots.ts` (the landing's images, from a seeded local Studio) and `og.ts` (the social image) |
| `../../design/studio` | The design every screen here follows |
