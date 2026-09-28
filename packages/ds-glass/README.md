# @polyxd/ds-glass

**Glass** — an original Polyxd template pack. Translucent surfaces over a cool ground, soft wide shadows, 20px radii; as much glass as tokens allow.

Every raised surface is translucent white (or translucent light, in dark mode) over a cool ground, with a one-pixel highlight along the top edge, a wide soft shadow, and 20px corners. Tokens can't blur what sits behind a surface, so this pack is honest about what it is: frosted layers without the `backdrop-filter`. Add one line to your own stylesheet — `.pxd-card, .pxd-panel { backdrop-filter: blur(16px) }` — and it becomes real glass. Type is the system sans, tracked slightly tight. For dashboards, media apps and anything that sits over imagery.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-glass/manifest.json   # every contract token, every contrast pair, both modes
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

- Every translucent surface and tint is written with the rgb of what it looks like once composited on its ground (pale in light mode, dark in dark mode) and an alpha of 0.55–0.92. The contract measures a translucent background as if it were opaque, so writing the composited colour means what is measured is what is seen.
- In dark mode the glass is dark-tinted (`rgba(34, 45, 78, 0.7)`) rather than white at low alpha: white glass over a dark ground reads as opaque white to the checker and as grey mud to the eye.

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `glass.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `glass.*` |

Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.

## Logo

`logo.svg` is Polyxd's own mark for this template, not anyone's logo: a small card drawn only from the template's tokens in its default mode (the ground, strong border and radius, the text and muted text, the primary action and one accent). `packages/ds-kit/scripts/pack-logos.ts` draws it, so it follows the tokens: change them and run `node packages/ds-kit/scripts/pack-logos.ts` to redraw it. A test fails if it goes stale.
