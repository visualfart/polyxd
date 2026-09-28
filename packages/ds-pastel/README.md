# @polyxd/ds-pastel

**Pastel** — an original Polyxd template pack. Light, soft mint, lavender and peach, 16px radii, a friendly rounded sans; consumer apps.

Nunito at every size, pill-shaped buttons, 16px corners on cards, and three soft colours with jobs: lavender is the brand and the primary action, mint is the secondary action and success, peach marks what's selected. The page is cream rather than white, borders are lavender-tinted, shadows are soft and low. Dark mode is a plum night with the same three colours lightened. For consumer apps, onboarding, habit trackers, anything that should feel kind.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-pastel/manifest.json   # every contract token, every contrast pair, both modes
```

## Make it yours

Two ways in.

**Edit these tokens.** Every colour role in `tokens/system.light.json` and `tokens/system.dark.json` points at a named entry in that file's `palette`; change a palette entry and every role using it follows, or point a role at another entry to change one thing. Type, spacing, radii and motion are in `tokens/system.json`. `tokens/semantic.json` only aliases those and rarely needs touching. Run `polyxd check` after each change: it names any pair that no longer meets its contrast floor.

**Or start from your own tokens.** `npx polyxd pack ./your-tokens.css --name yours` drafts a pack from a stylesheet or a DTCG file and writes a mapping you correct; this template is then a reference for what each role is for.

Either way, rename it: `name` in `manifest.json` is the `theme` a surface asks for, and `[data-pxd-theme="<name>"]` is the selector the compiled CSS uses.

## Fonts

| Role | Family | Full stack |
|---|---|---|
| `display` | Nunito | `Nunito, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `body` | Nunito | `Nunito, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `label` | Nunito | `Nunito, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| `mono` | ui-monospace | `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` |

Web fonts: Nunito — from Google Fonts under the SIL Open Font License, not shipped with the pack. Add them to your page's `<link>`; without them the pack falls back to the stack after each name and still passes every check.

## Notes on the values

- Every accent was pushed just dark enough to pass: `violet` #6a4fbf carries white at 5.6:1, the mint emphasis #3f9d74 is 3.3:1 on cream. Pastel tints are for backgrounds; text and icons on them are the deep version of the same hue.
- `radius.control` is 999px (pills) while `radius.default` is 16px: buttons and chips are round, cards are rounded.

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `pastel.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `pastel.*` |

Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.

## Logo

`logo.svg` is Polyxd's own mark for this template, not anyone's logo: a small card drawn only from the template's tokens in its default mode (the ground, strong border and radius, the text and muted text, the primary action and one accent). `packages/ds-kit/scripts/pack-logos.ts` draws it, so it follows the tokens: change them and run `node packages/ds-kit/scripts/pack-logos.ts` to redraw it. A test fails if it goes stale.
