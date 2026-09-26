# Polyxd Studio

Where a design-system team decides what generated screens may look like, and reviews what they actually look like. Apache-2.0, like the rest of Polyxd.

Run it yourself on your own Cloudflare account, or use the hosted one at studio.polyxd.com (same code; a small fee may cover its storage later).

## What works

- Sign up and sign in (email in local development; WorkOS for email, Google and SSO in production), workspaces, invites with roles, API keys.
- Import a design system as it is, from an npm package (public, or private through a read-only registry token kept encrypted, an uploaded `npm pack` tarball, or `polyxd studio push` from inside your network), a Tokens Studio file, a W3C DTCG file, or CSS custom properties.
- A scan of what was found: tokens by tier and type, modes, broken and circular references, deprecated tokens.
- Mapping Polyxd's 87 roles onto your semantic tier, with alias chains, contrast measured in every mode, candidates to point a role at instead, bulk accept for exact matches, and publish (blocked while any pair fails contrast).
- Browse your own tokens by tier and group, with what each resolves to and what references it.
- Components: which are on for generators, guidance the generator reads, and your own implementation per component.
- Rules: yours, as verifier checks, with severity and an on/off switch.

Reviews, releases, insights and the flow map come once screens flow in through the SDK.

## Run it locally

```sh
npm install                       # at the repository root
npm run db:migrate -w @polyxd/studio
npm run dev -w @polyxd/studio     # builds the app, then wrangler dev on http://localhost:8787
```

Sign in with any email (`DEV_AUTH=1` in wrangler.jsonc). Tests: `npm test -w @polyxd/studio`.

## Deploy your own

`wrangler.jsonc` has a `production` environment; copy it and change the route to your domain.

1. `npx wrangler d1 create studio`, put the id in the environment's `d1_databases`, then `npm run db:migrate:remote -w @polyxd/studio`.
2. `npx wrangler r2 bucket create polyxd-studio-files`.
3. Secrets, with `npx wrangler secret put <NAME> --env production`: `SECRETS_KEY` (a long random string; it encrypts registry tokens), and for sign-in `WORKOS_CLIENT_ID` and `WORKOS_API_KEY`. Never set `DEV_AUTH` in production.
4. `npm run deploy -w @polyxd/studio`.

The hosted one at studio.polyxd.com is this same configuration. The WorkOS flow follows their User Management API (`/user_management/authorize` and `/user_management/authenticate`); check the paths against WorkOS's current docs before turning it on.

## Layout

| Path | What |
|---|---|
| `src/import/read.ts` | Token files in: Tokens Studio, DTCG, CSS. Tiers, modes, aliases, issues |
| `src/import/scan.ts` | What was found, by tier and type |
| `src/import/map.ts` | Roles onto the semantic tier, contrast in every mode, candidates |
| `src/import/package.ts` | npm packages: registry fetch, untar, find the token files |
| `src/worker/` | The API on Workers: auth, workspaces, design systems, components, rules |
| `src/app/` | The React app |
| `migrations/` | D1 schema |
| `../../design/studio` | The design every screen here follows |
