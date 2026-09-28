# @polyxd/ds-civic

**Civic** — an original Polyxd template pack. Plain, high-contrast, blue links, large type and targets, one primary colour; public services.

Black text on white, 18px body, one blue for links and the primary action, 48px targets, near-square corners, no shadows on cards, and a thick black focus ring with no offset so it is never mistaken for decoration. The system sans, because the reader's own system font is the one they can already read. Dark mode keeps the same contrast with a yellow focus ring. Nothing here belongs to any government's design system; it is the plain style that public services converge on when they take accessibility seriously. For forms people have to complete, not want to.

This is a *template*: not a reproduction of any design system, and meant to be changed. Start from it, keep what you like, and it stays a valid pack as long as `polyxd check` passes.

```sh
npx polyxd check packages/ds-civic/manifest.json   # every contract token, every contrast pair, both modes
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

- Every text pair clears 7:1 in light mode, not just 4.5:1, which is what a service used by everyone should aim for.
- `focus.ring.offset` is 0 and the ring is 3px: a focus indicator that hugs the control is easier to associate with it at 200% zoom.

## Files

| File | What it holds |
|---|---|
| `manifest.json` | Name, modes, default mode and provenance |
| `tokens/system.json` | Primitives both modes share: fonts, sizes, spacing, radii, borders, motion |
| `tokens/system.light.json`, `tokens/system.dark.json` | The palette and the `civic.sys.*` roles for each mode, plus shadows |
| `tokens/semantic.json` | The Polyxd contract, aliasing `civic.*` |

Licence Apache-2.0, like the rest of Polyxd. Provenance in the manifest: original template by Polyxd.

## Logo

`logo.svg` is Polyxd's own mark for this template, not anyone's logo: a small card drawn only from the template's tokens in its default mode (the ground, strong border and radius, the text and muted text, the primary action and one accent). `packages/ds-kit/scripts/pack-logos.ts` draws it, so it follows the tokens: change them and run `node packages/ds-kit/scripts/pack-logos.ts` to redraw it. A test fails if it goes stale.
