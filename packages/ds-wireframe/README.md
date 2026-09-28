# @polyxd/ds-wireframe

**Wireframe** — an original Polyxd template pack. Low-fidelity: greyscale, dashed borders, placeholder blue for links and actions, mono labels; for reviewing structure before visual design.

Everything is grey except what you can act on, which is placeholder blue. Labels are monospace so they read as annotations, motion is zero, there are no shadows, and `tokens/extras.css` dashes the borders of cards, inputs and secondary buttons and hatches every media placeholder. The point is to review structure, copy and flow before anyone argues about colour. Status colours are deliberately greys of different weights: a wireframe shows that something is a warning, not what a warning will look like.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-wireframe/manifest.json   # every contract token, every contrast pair, both modes
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
| `label` | JetBrains Mono | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |
| `mono` | JetBrains Mono | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |

Web fonts: JetBrains Mono — from Google Fonts under the SIL Open Font License, not shipped with the pack. Add them to your page's `<link>`; without them the pack falls back to the stack after each name and still passes every check.

## The extras stylesheet

Tokens can't draw. `tokens/extras.css` is a small stylesheet the theme compiler appends verbatim to `themes/wireframe.css`, every rule scoped by `[data-pxd-theme="wireframe"]`, that does what tokens can't: dashed borders on cards, inputs and secondary buttons, and a diagonal hatch on media placeholders. It uses no colour of its own — every colour in it is a `var(--pxd-…)` token — so recolouring the tokens recolours the extras. Delete the `extras` line from the manifest and the pack is plain tokens again.

## Notes on the values

- Danger actions are dark grey, not red: in a wireframe the only colour is the blue that marks a link or the primary action.
- The six chart colours are the blue and five greys, each at least 3:1 on the page, so a chart still has six distinguishable series.

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode, the extras stylesheet and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `wireframe.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `wireframe.*` |
| `tokens/extras.css` | The scoped CSS the compiler appends |
Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.

## Logo

`logo.svg` is Polyxd's own mark for this template, not anyone's logo: a small card drawn only from the template's tokens in its default mode (the ground, strong border and radius, the text and muted text, the primary action and one accent). `packages/ds-kit/scripts/pack-logos.ts` draws it, so it follows the tokens: change them and run `node packages/ds-kit/scripts/pack-logos.ts` to redraw it. A test fails if it goes stale.
