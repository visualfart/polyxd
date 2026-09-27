# Polyxd Studio

Where a design-system team decides what generated screens may look like, and reviews what they actually look like. Apache-2.0, like the rest of Polyxd.

Run it yourself on your own Cloudflare account, or use the hosted one at studio.polyxd.com (same code; a small fee may cover its storage later).

## What works

- Sign up and sign in through [better-auth](https://www.better-auth.com), open source and running inside the Worker: email and password with verification, password reset, Google when a client is configured; two-step verification and SAML/OIDC single sign-on are its plugins, to add when a customer needs them. Workspaces, invites with roles, API keys.
- Import a design system as it is, from an npm package (public, or private through a read-only registry token kept encrypted, an uploaded `npm pack` tarball, or `polyxd studio push` from inside your network), a Tokens Studio file, a W3C DTCG file, or CSS custom properties.
- A scan of what was found: tokens by tier and type, modes, broken and circular references, deprecated tokens.
- Mapping Polyxd's 87 roles onto your semantic tier, with alias chains, contrast measured in every mode, candidates to point a role at instead, bulk accept for exact matches, and publish (blocked while any pair fails contrast).
- Browse your own tokens by tier and group, with what each resolves to and what references it.
- Components: which are on for generators, guidance the generator reads, and your own implementation per component.
- Rules: yours, as verifier checks, with severity and an on/off switch.
- Screens: surfaces a designer authors rather than generates. A screen is a Polyxd document edited as a tree of components (all 37, with the spec's guidance), drawn live with `@polyxd/react` in your published design system (or any built-in theme; light and dark; phone, tablet and desktop; three densities), with a property panel made from the schema, a sample-data tab for bindings, and the JSON always within reach. It is checked as you edit, the way a generated screen is: schema, references, bindings against the sample data, and your rules. Save keeps versions with notes; Publish makes one the document your product fetches by key. Start from one of the spec's 28 examples, blank, or pasted JSON.

Reviews, releases, insights and the flow map come once screens flow in through the SDK.

## Deliver a screen to your product

A published screen is fetched by key with an API key from Team → API keys (a key reads published screens and design systems; it can't change anything). The answer is the document itself, with `surface.origin: "authored"` set, ready for `PolyxdSurface`:

```sh
curl -H "Authorization: Bearer $POLYXD_STUDIO_KEY" https://studio.polyxd.com/api/w/<workspace>/screens/send-money
```

```ts
const doc = await fetch(`${STUDIO}/api/w/acme/screens/send-money`, { headers: { authorization: `Bearer ${key}` } }).then((r) => r.json());
<PolyxdSurface document={doc} data={liveData} theme="acme" onAction={handle} />
```

The response carries `X-Polyxd-Screen-Version`; an unpublished screen answers 404. `GET …/screens` lists the workspace's screens with their published version, and `GET …/screens/<key>/versions` the history. Fetch on the server or at build time and keep the document with your bundle: a screen changes when someone publishes, not on every request.

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

Create an account with any email: locally no email goes out, so it works at once. Tests: `npm test -w @polyxd/studio`.

## Deploy your own

`wrangler.jsonc` has a `production` environment; copy it and change the route to your domain.

1. `npx wrangler d1 create studio`, put the id in the environment's `d1_databases`, then `npm run db:migrate:remote -w @polyxd/studio`.
2. `npx wrangler r2 bucket create polyxd-studio-files`.
3. Secrets, with `npx wrangler secret put <NAME> --env production`: `AUTH_SECRET` (a long random string; signs sessions), `SECRETS_KEY` (another; encrypts registry tokens), `RESEND_API_KEY` (verification, reset and invite emails; without it, links are logged), and optionally `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for "Continue with Google" (redirect URI: `<APP_URL>/api/auth/callback/google`).
4. `npm run deploy -w @polyxd/studio`.

The hosted one at studio.polyxd.com is this same configuration.

## Layout

| Path | What |
|---|---|
| `src/import/read.ts` | Token files in: Tokens Studio, DTCG, CSS. Tiers, modes, aliases, issues |
| `src/import/scan.ts` | What was found, by tier and type |
| `src/import/map.ts` | Roles onto the semantic tier, contrast in every mode, candidates |
| `src/import/package.ts` | npm packages: registry fetch, untar, find the token files |
| `src/worker/` | The API on Workers: auth, workspaces, design systems, components, rules, screens |
| `src/screens/` | Screens, shared by the Worker and the app: the schema read without ajv (Workers refuse generated code), the checker, the tree edits |
| `src/app/` | The React app; `src/app/screen/` is the editor's tree, preview, property panel and themes |
| `migrations/` | D1 schema |
| `../../design/studio` | The design every screen here follows |
