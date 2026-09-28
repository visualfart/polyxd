# @polyxd/ds-neon

**Neon** — an original Polyxd template pack. Dark with saturated magenta and cyan, glow shadows; entertainment and gaming.

Dark by default: near-black violet ground, magenta primary, cyan links and focus, and shadows that are coloured glows rather than drop shadows — a card is lit from behind in magenta and edged in cyan. Space Grotesk throughout, titles tracked tight, labels tracked wide. Success is lime, warning is sun, danger is hot pink-red. Light mode is a daylight version with the same hues darkened until they carry white text. For games, streaming, events, music and anything where restraint would be the wrong call.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-neon/manifest.json   # every contract token, every contrast pair, both modes
```

## Make it yours

Two ways in.

**Edit these tokens.** Every colour role in `tokens/system.light.json` and `tokens/system.dark.json` points at a named entry in that file's `palette`; change a palette entry and every role using it follows, or point a role at another entry to change one thing. Type, spacing, radii and motion are in `tokens/system.json`. `tokens/semantic.json` only aliases those and rarely needs touching. Run `polyxd check` after each change: it names any pair that no longer meets its contrast floor.

**Or start from your own tokens.** `npx polyxd pack ./your-tokens.css --name yours` drafts a pack from a stylesheet or a DTCG file and writes a mapping you correct; this template is then a reference for what each role is for.

Either way, rename it: `name` in `manifest.json` is the `theme` a surface asks for, and `[data-pxd-theme="<name>"]` is the selector the compiled CSS uses.

## Fonts

| Role | Family | Full stack |
|---|---|---|
| `display` | Space Grotesk | `'Space Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `body` | Space Grotesk | `'Space Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `label` | Space Grotesk | `'Space Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `mono` | JetBrains Mono | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |

Web fonts: JetBrains Mono, Space Grotesk — from Google Fonts under the SIL Open Font License, not shipped with the pack. Add them to your page's `<link>`; without them the pack falls back to the stack after each name and still passes every check.

## Notes on the values

- Magenta #ff2bd6 carries near-black text at 6:1, so the primary button's label is `magenta-ink`, not white — white on that magenta is 2.9:1.
- The two shadows are the gradient: raised surfaces glow magenta, overlays glow cyan, and their inner layer is the opposite hue.

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `neon.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `neon.*` |

Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.

## Logo

`logo.svg` is Polyxd's own mark for this template, not anyone's logo: a small card drawn only from the template's tokens in its default mode (the ground, strong border and radius, the text and muted text, the primary action and one accent). `packages/ds-kit/scripts/pack-logos.ts` draws it, so it follows the tokens: change them and run `node packages/ds-kit/scripts/pack-logos.ts` to redraw it. A test fails if it goes stale.
