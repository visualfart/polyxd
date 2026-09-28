# @polyxd/ds-brutalist

**Brutalist** — an original Polyxd template pack. Black 2px borders, flat yellow and black, hard 4px shadows, no radius, mono labels.

Two-pixel black borders on everything, hard shadows offset four pixels with no blur, no radius anywhere (avatars are square), and two colours that mean something: black is the primary action, yellow is what's selected, highlighted or secondary. Titles are Space Grotesk set tight; labels are JetBrains Mono in bold; body is Arial because Arial is the honest default. Motion is nearly zero. Dark mode flips it: yellow primary on black, white borders, white shadows. For posters, launches, and products that want to be seen from across the room.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-brutalist/manifest.json   # every contract token, every contrast pair, both modes
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
| `body` | Arial | `Arial, Helvetica, sans-serif` |
| `label` | JetBrains Mono | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |
| `mono` | JetBrains Mono | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |

Web fonts: JetBrains Mono, Space Grotesk — from Google Fonts under the SIL Open Font License, not shipped with the pack. Add them to your page's `<link>`; without them the pack falls back to the stack after each name and still passes every check.

## Notes on the values

- Yellow can't be the primary button on white — it is 1.2:1 against the page and the contract wants 3:1 for a control — so black is primary with a yellow label, and yellow carries the secondary and selected states, where it sits behind black text at 17:1.
- `radius.full` is 0 too, so avatars and pills are squares; change it to 999px if you want round avatars back.

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `brutalist.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `brutalist.*` |

Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.

## Logo

`logo.svg` is Polyxd's own mark for this template, not anyone's logo: a small card drawn only from the template's tokens in its default mode (the ground, strong border and radius, the text and muted text, the primary action and one accent). `packages/ds-kit/scripts/pack-logos.ts` draws it, so it follows the tokens: change them and run `node packages/ds-kit/scripts/pack-logos.ts` to redraw it. A test fails if it goes stale.
