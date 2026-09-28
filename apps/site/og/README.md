# Social cards

One 1200 × 630 card per page of polyxd.com, shown when a link is shared.

- `cards/` holds each card as a plain page: one per landing page, Studio, the gallery and the
  demos, and `docs.html`, a template filled in for every docs page (`{{TITLE}}`, `{{SUB}}`,
  `{{URL}}`, `{{SIZE}}`). They were designed on the Claude Design canvas, page "OG images".
- `png/` is what `scripts/og.ts` renders from them. Each file is named after its page's path
  without the slashes (`/` is `home`, `/docs/reference/tokens/` is `docs-reference-tokens`), and
  `scripts/build.ts` points each page's `og:image` at its file, or at the home card when a page
  has none. The four demo products' cards go to `apps/demos/public/<name>/og.png`, where their
  pages already point; `apps/demos/scripts/og.ts` renders the same cards there too.

Nothing on a card is smaller than 24px, since a feed shows it at about half size.

To change a card, edit it in `cards/` (and on the canvas), then run:

```
node scripts/build.ts && node scripts/og.ts && node scripts/build.ts
```

The first build gives `og.ts` the docs pages' titles; the second picks up the new images.
