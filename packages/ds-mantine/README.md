# @polyxd/ds-mantine

**Mantine 8** as a Polyxd design-system pack: DTCG 2025.10 token files that satisfy the semantic token contract in `light` and `dark`.

```sh
npm run check -w @polyxd/ds-mantine     # contract check, both schemes
npm run generate -w @polyxd/ds-mantine  # regenerate tokens/*.json
```

## Source

`@mantine/core` 8.4.2 (MIT). Mantine publishes its whole theme as CSS custom properties, so the stylesheet is vendored verbatim and the generator reads its variables: the palette from `:root`, the scheme-dependent roles from `:root[data-mantine-color-scheme='light'|'dark']`. Names are kept (`mantine.color-body`, `mantine.spacing-md`).

Built with `@polyxd/ds-kit`, which handles the CSS reading, the `calc()` Mantine wraps its scales in, and the DTCG conversion.

## Contrast adjustments

Mantine's palettes are ten steps per hue, and the pack picks the step that clears the contract against the surface each role sits on, rather than a step chosen by eye. The generator prints every move it makes:

| Role | Mantine's own step | Measured | Used instead |
|---|---|---|---|
| `color.action.primary.background` | `blue-6` with white text | 3.56:1 | `blue-8` (5.02:1) |
| `color.action.danger.background` | `red-6` with white text | 3.56:1 | `red-8` (4.51:1) |
| `color.text.link` | `--mantine-color-anchor` (`blue-6`) | 3.56:1 on the body | `blue-8` in light, `blue-5` in dark |
| `color.text.muted` | `--mantine-color-dimmed` (`gray-6`) | 3.5:1 | `gray-7` (8.18:1) |
| `color.status.*.emphasis` | step 6 | 3.0–3.5:1 | steps 7–8 of the same hue |

**Where no step passes.** Mantine's green and yellow `-light` pairs — its own tinted background with its own text colour — are 3.81:1 and 2.69:1 in light mode. No step of those ramps reaches 4.5:1 on that tint, so status text falls back to the body text colour, and the token says so.

**Filled buttons are the one worth repeating:** Mantine's default filled button puts white on step 6 of a hue, which is 3.56:1 — below 4.5:1 for its own label.

## Logo

`logo.svg` is the Mantine mark that [mantine.dev/about](https://mantine.dev/about/) offers for download, byte for byte from the repository ([`mantine-logo.svg`](https://github.com/mantinedev/mantine/blob/f38933cb4f1c534600f4ff59ee3ddbb4685a4bc4/apps/mantine.dev/src/components/LogoAssets/assets/mantine-logo.svg)). The About page gives the logos out with no usage rules; the repository is [MIT](https://github.com/mantinedev/mantine/blob/master/LICENSE).

Mantine and its logo are trademarks of Vitaly Rtishchev, used here to identify the design system this pack is modelled on. Polyxd is not affiliated with Vitaly Rtishchev.
