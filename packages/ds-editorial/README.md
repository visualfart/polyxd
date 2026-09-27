# @polyxd/ds-editorial

**Editorial** — an original Polyxd template pack. Serif display, warm paper, hairline rules, a generous measure; magazines, publishing, long reads.

Fraunces for everything that is read, a plain grotesque for the small caps that label things, and warm paper under it all. Rules are hairlines, radii are nearly square, the measure runs to 72 characters, and the accent is oxblood rather than a UI blue. Cards have no shadow; only overlays lift. Dark mode is night paper with cream text and the same palette softened. For magazines, publishing tools, reading apps and anything that wants to feel set rather than built.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-editorial/manifest.json   # every contract token, every contrast pair, both modes
```

## Make it yours

Two ways in.

**Edit these tokens.** Every colour role in `tokens/system.light.json` and `tokens/system.dark.json` points at a named entry in that file's `palette`; change a palette entry and every role using it follows, or point a role at another entry to change one thing. Type, spacing, radii and motion are in `tokens/system.json`. `tokens/semantic.json` only aliases those and rarely needs touching. Run `polyxd check` after each change: it names any pair that no longer meets its contrast floor.

**Or start from your own tokens.** `npx polyxd pack ./your-tokens.css --name yours` drafts a pack from a stylesheet or a DTCG file and writes a mapping you correct; this template is then a reference for what each role is for.

Either way, rename it: `name` in `manifest.json` is the `theme` a surface asks for, and `[data-pxd-theme="<name>"]` is the selector the compiled CSS uses.

## Fonts

| Role | Family | Full stack |
|---|---|---|
| `display` | Fraunces | `Fraunces, Georgia, 'Times New Roman', Times, serif` |
| `body` | Fraunces | `Fraunces, Georgia, 'Times New Roman', Times, serif` |
| `label` | Helvetica Neue | `'Helvetica Neue', Helvetica, Arial, sans-serif` |
| `mono` | ui-monospace | `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |

Web fonts: Fraunces — from Google Fonts under the SIL Open Font License, not shipped with the pack. Add them to your page's `<link>`; without them the pack falls back to the stack after each name and still passes every check.

## Notes on the values

- Body text is 17px Fraunces at 1.6 line height: a serif needs the extra size and leading that a sans doesn't.
- The accent, `oxblood`, is used for links, focus and danger; the four status colours are slate, moss, ochre and oxblood, all low-chroma so a notice sits in the page rather than on it.

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `editorial.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `editorial.*` |

Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.
