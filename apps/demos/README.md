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
the drawer), and types. The generator prompt is built from the spec by `@polyxd/runtime`.

## Scripts

```sh
npm run dev -w @polyxd/demos                 # all four at http://localhost:5174/demos/
node scripts/snapshot.ts [product] [intent]  # put a data snapshot from the seed into each document
node scripts/verify.ts [product] [intent]    # verify every document in 13 packs; writes reports/
node scripts/og.ts                           # social images (the site's cards) and touch icons into public/
node scripts/shots.ts [origin] [outDir]      # phone-size screenshots of a running Halden
npm test -w @polyxd/demos                    # ask matching, slots, snapshots
```

A document changes → `snapshot` → `verify` → commit the document and its report together.

## Live generation

The public demos answer from their verified library, so they never depend on a model being
available, and none of them runs a live path today. One would use `@polyxd/runtime`: `createRuntime` with
the product's `direction.json`, the capabilities from its registry and a model adapter builds the prompt
from the spec, checks and repairs the answer, and returns a document for an ask the library doesn't
cover. The product would show it with a "generated just now" mark instead of a verified one.
