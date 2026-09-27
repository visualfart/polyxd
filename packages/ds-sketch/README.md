# @polyxd/ds-sketch

**Sketch** — an original Polyxd template pack. Hand-drawn: paper, ink, a handwritten display face, pencil-grey borders, no shadows, and lines that wobble.

Paper and ink in light mode, chalk on a board in dark. Titles and buttons are handwritten (Caveat and Patrick Hand); running text is a humanist sans so a long form stays readable. Borders are pencil-grey and two pixels wide, there are no shadows, and `tokens/extras.css` is what makes it look drawn: the uneven corner radii on buttons, cards and inputs, wavy underlines on links, and a slight tilt on cards. Use it for early concepts you want people to critique without mistaking for finished work.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-sketch/manifest.json   # every contract token, every contrast pair, both modes
```

## Make it yours

Two ways in.

**Edit these tokens.** Every colour role in `tokens/system.light.json` and `tokens/system.dark.json` points at a named entry in that file's `palette`; change a palette entry and every role using it follows, or point a role at another entry to change one thing. Type, spacing, radii and motion are in `tokens/system.json`. `tokens/semantic.json` only aliases those and rarely needs touching. Run `polyxd check` after each change: it names any pair that no longer meets its contrast floor.

**Or start from your own tokens.** `npx polyxd pack ./your-tokens.css --name yours` drafts a pack from a stylesheet or a DTCG file and writes a mapping you correct; this template is then a reference for what each role is for.

Either way, rename it: `name` in `manifest.json` is the `theme` a surface asks for, and `[data-pxd-theme="<name>"]` is the selector the compiled CSS uses.

## Fonts

| Role | Family | Full stack |
|---|---|---|
| `display` | Caveat | `Caveat, 'Segoe Print', 'Bradley Hand', cursive` |
| `label` | Patrick Hand | `'Patrick Hand', 'Segoe Print', 'Comic Sans MS', cursive` |
| `body` | Nunito | `Nunito, 'Segoe UI', 'Trebuchet MS', Verdana, sans-serif` |
| `mono` | ui-monospace | `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |

Web fonts: Caveat, Nunito, Patrick Hand — from Google Fonts under the SIL Open Font License, not shipped with the pack. Add them to your page's `<link>`; without them the pack falls back to the stack after each name and still passes every check.

## The extras stylesheet

Tokens can't draw. `tokens/extras.css` is a small stylesheet the theme compiler appends verbatim to `themes/sketch.css`, every rule scoped by `[data-pxd-theme="sketch"]`, that does what tokens can't: the uneven hand-drawn corner radii, wavy link underlines and the slight tilt on cards. It uses no colour of its own — every colour in it is a `var(--pxd-…)` token — so recolouring the tokens recolours the extras. Delete the `extras` line from the manifest and the pack is plain tokens again.

## Notes on the values

- `color.text.muted` is `ink-soft` (#5c584f) rather than the pencil grey, because pencil grey (#a8a39a) is 2.2:1 on paper; the pencil is kept for `color.border.default`, which the contract doesn't measure.
- Dark mode is a blackboard rather than inverted paper: `chalk` text on `board`, with chalk-tinted status colours.

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode, the extras stylesheet and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `sketch.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `sketch.*` |
| `tokens/extras.css` | The scoped CSS the compiler appends |
Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.
