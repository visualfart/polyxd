# @polyxd/ds-terminal

**Terminal** — an original Polyxd template pack. Dark, monospace everywhere, green and amber, 2px radii, dense; developer tools.

Dark by default, JetBrains Mono for every role including titles and numbers, phosphor green for the primary action and links, amber for focus and warnings, two-pixel radii, and spacing tight enough to put a lot on one screen. No shadows; an overlay gets a one-pixel ring instead. Body text is 16px because the contract asks for it, but everything around it is smaller. Light mode is a paper terminal: green-grey ground and the same hues darkened. For CLIs with a face, log viewers, admin consoles and developer dashboards.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-terminal/manifest.json   # every contract token, every contrast pair, both modes
```

## Make it yours

Two ways in.

**Edit these tokens.** Every colour role in `tokens/system.light.json` and `tokens/system.dark.json` points at a named entry in that file's `palette`; change a palette entry and every role using it follows, or point a role at another entry to change one thing. Type, spacing, radii and motion are in `tokens/system.json`. `tokens/semantic.json` only aliases those and rarely needs touching. Run `polyxd check` after each change: it names any pair that no longer meets its contrast floor.

**Or start from your own tokens.** `npx polyxd pack ./your-tokens.css --name yours` drafts a pack from a stylesheet or a DTCG file and writes a mapping you correct; this template is then a reference for what each role is for.

Either way, rename it: `name` in `manifest.json` is the `theme` a surface asks for, and `[data-pxd-theme="<name>"]` is the selector the compiled CSS uses.

## Fonts

| Role | Family | Full stack |
|---|---|---|
| `display` | JetBrains Mono | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |
| `body` | JetBrains Mono | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |
| `label` | JetBrains Mono | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |
| `mono` | JetBrains Mono | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |

Web fonts: JetBrains Mono — from Google Fonts under the SIL Open Font License, not shipped with the pack. Add them to your page's `<link>`; without them the pack falls back to the stack after each name and still passes every check.

## Notes on the values

- `size.target.min` is 36px, not 44: dense by intent, and still above WCAG 2.5.8's 24px floor.
- `radius.full` is 4px, so avatars and chips are squarish; this is the one pack where a pill would look wrong.

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `terminal.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `terminal.*` |

Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.

## Logo

`logo.svg` is Polyxd's own mark for this template, not anyone's logo: a small card drawn only from the template's tokens in its default mode (the ground, strong border and radius, the text and muted text, the primary action and one accent). `packages/ds-kit/scripts/pack-logos.ts` draws it, so it follows the tokens: change them and run `node packages/ds-kit/scripts/pack-logos.ts` to redraw it. A test fails if it goes stale.
