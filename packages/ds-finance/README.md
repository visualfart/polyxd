# @polyxd/ds-finance

**Finance** — an original Polyxd template pack. Navy and gold, tabular numerals, conservative radii, dense tables; banking and trading.

Navy for the primary action and the inverse surface, gold for focus, selection and warnings, a serif only for titles and key figures, and everything else the system sans in small sizes with tight spacing so a table of positions fits. Radii stop at 4px. Shadows are a hairline. Key figures are tabular so columns of numbers line up. Dark mode swaps the roles: gold becomes the primary on navy. For banking, trading, treasury and any product where the numbers are the interface.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-finance/manifest.json   # every contract token, every contrast pair, both modes
```

## Make it yours

Two ways in.

**Edit these tokens.** Every colour role in `tokens/system.light.json` and `tokens/system.dark.json` points at a named entry in that file's `palette`; change a palette entry and every role using it follows, or point a role at another entry to change one thing. Type, spacing, radii and motion are in `tokens/system.json`. `tokens/semantic.json` only aliases those and rarely needs touching. Run `polyxd check` after each change: it names any pair that no longer meets its contrast floor.

**Or start from your own tokens.** `npx polyxd pack ./your-tokens.css --name yours` drafts a pack from a stylesheet or a DTCG file and writes a mapping you correct; this template is then a reference for what each role is for.

Either way, rename it: `name` in `manifest.json` is the `theme` a surface asks for, and `[data-pxd-theme="<name>"]` is the selector the compiled CSS uses.

## Fonts

| Role | Family | Full stack |
|---|---|---|
| `display` | Georgia | `Georgia, 'Times New Roman', Times, serif` |
| `body` | system-ui | `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `label` | system-ui | `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `mono` | ui-monospace | `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |

Web fonts: None. The pack uses the reader's system fonts, so there is nothing to load.

## Notes on the values

- Gold (#a67c0c) is the focus ring in light mode at 3.7:1 on white — bright enough to see, and the one place the accent is allowed to be loud.
- `type.numeric.display` and the tables are set with tabular numerals by the renderer; the pack's job is to give them a serif with real lining figures (Georgia has them).

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `finance.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `finance.*` |

Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.

## Logo

`logo.svg` is Polyxd's own mark for this template, not anyone's logo: a small card drawn only from the template's tokens in its default mode (the ground, strong border and radius, the text and muted text, the primary action and one accent). `packages/ds-kit/scripts/pack-logos.ts` draws it, so it follows the tokens: change them and run `node packages/ds-kit/scripts/pack-logos.ts` to redraw it. A test fails if it goes stale.
