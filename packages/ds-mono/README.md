# @polyxd/ds-mono

**Mono** — an original Polyxd template pack. One hue, many tints: a brand colour ramp in every role (indigo by default); the fastest to rebrand by changing one number.

Every colour role is a tint or shade of one hue, written as `oklch(L C 275)`. The page is the palest tint, text is the darkest shade, borders, selection, the secondary button and the info status are steps between, the six chart colours are six shades of it, and only success, warning and danger step off the hue (green, amber, red at the same lightness recipe). To rebrand, change the hue: replace `275` with your own in `tokens/system.light.json` and `tokens/system.dark.json` (one search-and-replace), run `polyxd check`, and the whole system follows. Everything else — system sans, 8px corners, standard spacing — is deliberately unremarkable so the colour is what you notice.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-mono/manifest.json   # every contract token, every contrast pair, both modes
```

## Make it yours

Two ways in.

**Edit these tokens.** Every colour role in `tokens/system.light.json` and `tokens/system.dark.json` points at a named entry in that file's `palette`; change a palette entry and every role using it follows, or point a role at another entry to change one thing. Type, spacing, radii and motion are in `tokens/system.json`. `tokens/semantic.json` only aliases those and rarely needs touching. Run `polyxd check` after each change: it names any pair that no longer meets its contrast floor.

**Or start from your own tokens.** `npx polyxd pack ./your-tokens.css --name yours` drafts a pack from a stylesheet or a DTCG file and writes a mapping you correct; this template is then a reference for what each role is for.

Either way, rename it: `name` in `manifest.json` is the `theme` a surface asks for, and `[data-pxd-theme="<name>"]` is the selector the compiled CSS uses.

## Fonts

| Role | Family | Full stack |
|---|---|---|
| `display` | system-ui | `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `body` | system-ui | `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `label` | system-ui | `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `mono` | ui-monospace | `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |

Web fonts: None. The pack uses the reader's system fonts, so there is nothing to load.

## Notes on the values

- Lightness carries contrast in OKLCH, so the ramp's L values were chosen with margin: a hue change of any size keeps every pair passing except for the yellows (hue 60–110), where the 600 step may need L lowered a few points. `polyxd check` tells you.
- Chart colours are one hue at six lightnesses, each at least 3:1 on the page: they distinguish by weight, not by hue, and a legend is doing most of the work.

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `mono.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `mono.*` |

Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.
