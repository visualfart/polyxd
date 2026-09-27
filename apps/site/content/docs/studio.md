---
title: Studio
description: Where a design-system team brings its tokens, decides what generated screens may look like, authors screens of its own, and delivers them to products. Hosted at studio.polyxd.com, or run on your own Cloudflare account.
section: Guides
order: 23
---

# Studio

[Studio](https://studio.polyxd.com) is the team's side of Polyxd: open source (Apache-2.0, in `apps/studio`), running on Cloudflare Workers with D1 and R2, and the same code whether you use the hosted one or your own.

## Your design system

- **Import** it as it is: an npm package (public, or private through a read-only registry token kept encrypted), a `.tgz` from `npm pack`, a Tokens Studio file, a W3C DTCG file, or CSS custom properties. Or push from where the tokens are built:

  ```sh
  POLYXD_STUDIO_KEY=… npx polyxd studio push ./ --to https://studio.polyxd.com/api/w/<workspace>
  ```

  The same package name lands as a new version of the same design system every time, so a release step can run it.
- **Scan**: tokens by tier and type, modes, aliases, broken and circular references, deprecated tokens.
- **Map** Polyxd's 87 roles onto your semantic tier, with alias chains, contrast measured in every mode, candidates for each role, bulk accept for exact matches, and publish, blocked while any pair fails contrast.
- **Browse** your tokens by tier and group, with what each resolves to and what references it.

## Direction

- **Components**: which of the 44 are on for generators, guidance the generator reads, and your own implementation per component.
- **Rules**: yours, as verifier checks with a severity and an on/off switch. They run on every screen saved in Studio and in the verifier when a product passes them.

## Screens

Where designers author a product's surfaces, in the same format a generator writes:

- A **component tree** with a picker of the 44 components by category; add, remove, reorder, duplicate; keyboard throughout.
- A **property panel** generated from the spec's schema: enums, booleans, numbers, text that can be bound to data with a pointer picker over the sample data, references as pickers of existing components, actions as an event plus context.
- A **live preview** in the workspace's own design system (its published mapping, as variables) or any of the 13 built-in ones, light and dark, phone, tablet and desktop, or any width; click a component in the preview to select it in the tree.
- **Issues** as you edit, from the same checks the verifier runs statically; Publish stays disabled while an error remains.
- **Versions** with notes and restore; **Publish** marks the one products get.

A shell document can be authored the same way, with the Outlet shown as a placeholder.

## Delivering a screen to a product

A published screen is fetched by key, with an API key from Team → API keys (keys can import tokens and read design systems and screens, nothing else):

```sh
curl -H "Authorization: Bearer $POLYXD_STUDIO_KEY" \
  https://studio.polyxd.com/api/w/<workspace>/screens/<key>
```

It returns the document with `surface.origin: "authored"` and an `X-Polyxd-Screen-Version` header. Render it with `PolyxdSurface` (or `PolyxdFrame` for a shell) exactly like a generated one.

## Team

Workspaces, invites with roles (design-system, designer, product, engineer, viewer), sign-in through [better-auth](https://www.better-auth.com) (email and password with verification, Google when configured), API keys.

## Run it yourself

```sh
git clone https://github.com/visualfart/polyxd && cd polyxd && npm install
npm run db:migrate -w @polyxd/studio      # local D1
npm run dev -w @polyxd/studio             # http://localhost:8789
```

For production: a D1 database, an R2 bucket, `SECRETS_KEY` and `AUTH_SECRET` secrets, `RESEND_API_KEY` for email, and `npm run deploy -w @polyxd/studio`. The README in `apps/studio` has the exact steps.
