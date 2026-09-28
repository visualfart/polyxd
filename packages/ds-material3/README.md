# @polyxd/ds-material3

The Material 3 design-system pack for Polyxd. It has DTCG 2025.10 token files that satisfy the Polyxd semantic token contract (`packages/spec/tokens/semantic-contract.json`, v0.1.0) in `light` and `dark` modes.

```sh
npm run check -w @polyxd/ds-material3     # contract check, both modes
npm run generate -w @polyxd/ds-material3  # regenerate tokens/*.json
```

## Tiers

The M3 names are kept as they are, so you can trace every semantic token back to Material 3.

| Tier | File | Contents |
|---|---|---|
| Reference (primitive) | `tokens/primitive.json` | `md.ref.palette.<palette>.<tone>` (primary, secondary, tertiary, neutral, neutral-variant, error), `md.ref.typeface.*`. Polyxd additions: `polyxd.ref.palette.{success,warning,info,chart-1..6}` and `polyxd.ref.space.N` (the 4dp grid, N × 4px). |
| System | `tokens/system.json` | Values that are the same in every mode: `md.sys.typescale.*`, `md.sys.shape.*`, `md.sys.motion.*`, `md.sys.state.*`, `md.sys.elevation.level0..5`, and `polyxd.sys.elevation.shadow.level1..5` (M3 elevation shown as DTCG shadows). |
| System, per mode | `tokens/system.light.json`, `tokens/system.dark.json` | `md.sys.color.*` (all 49 material-web v0_192 roles), each an alias to a reference-palette tone. Polyxd additions: `polyxd.sys.color.{success,on-success,success-container,on-success-container,…,chart-1..6}`. |
| Semantic | `tokens/semantic.json` | The Polyxd contract tokens. Wherever M3 has an equivalent, the token is an `{alias}` to an `md.sys.*` / `md.ref.*` token. The file is the same in both modes; aliases pick up the mode's system file. |

`manifest.json` merges the files for each mode in this order: primitive → system → system.<mode> → semantic.

The main semantic mappings are:

- Surfaces: `surface`, `surface-container` (subtle), `surface-container-low` (raised: the elevated card), `surface-container-high` (overlay: the dialog), and `inverse-surface`.
- Text: `on-surface`, `on-surface-variant` (muted), `inverse-on-surface`, and `primary` (links).
- Borders: `outline-variant`, `outline` (strong), and `secondary` (focus, as in material-web's focus ring).
- Actions: primary is `primary`/`on-primary`. Secondary is `secondary-container`/`on-secondary-container` (tonal button), with an `outline` border. Danger is `error`/`on-error`. Selection is `secondary-container`.
- Type: page is headline-large, section is title-large, and item is title-medium. Body is body-large (16px) and body-medium. Labels are label-large and label-medium. Numeric display is display-small.
- Radius: extra-small (4), medium (12), extra-large (28), full. Shadows: raised is level1, overlay is level3.
- Motion: durations are short1, short4, medium2 and long2. Easing is standard, emphasized-decelerate (enter) and emphasized-accelerate (exit).
- State opacities are the `md.sys.state` values (0.08 hover, 0.12 pressed, 0.12 focus). Disabled is 0.38 (M3 disabled content).
- Literals (no M3 sys token exists): the scrim is `#000000` at 0.32 alpha (md.comp.scrim opacity), because an alias cannot add alpha. Also: target size 48px, icon sizes 18px and 24px, border widths 1px and 2px, focus ring 3px with a 2px offset, `measure.max` 65. Each literal has a `$description` naming its source.

## Regenerating

`scripts/generate.ts` writes all five token files and gives the same output on every run. It works offline from the vendored material-web sources in `scripts/sources/material-web/`. Run `node scripts/generate.ts --refresh` to download them again from the pinned tag first. Do not edit the token files by hand.

- **Colour:** `@material/material-color-utilities` 0.4.0. The generator runs `SchemeTonalSpot(Hct.fromInt(#6750A4), isDark, 0, "2021")` (the `DynamicScheme` API). Each `md.sys.color` role becomes an alias to the exact palette tone the scheme resolves it to, and the generator fails if a role's tone does not match a palette tone exactly. Spec `2021` is the library default and the colour spec material-web v0_192 implements. Spec `2025` (M3 Expressive) produces fractional tones and chroma-adjusted colours that do not match any palette tone, so the three tiers could not be shown as aliases.
- **Status colours** (M3 only has `error`): `TonalPalette.fromInt` of seed colours success `#2E7D32`, warning `#F9A825` and info `#0288D1`. They use the M3 custom-colour tone pattern: light 40/100/90/30 and dark 80/20/30/90 for color/on-color/container/on-container. They are not harmonized with the seed, so the hues stay conventional.
- **Chart colours:** `TonalPalette.fromHueAndChroma(seedHue + [0, 240, 120, 300, 180, 60]°, 48)`. They use tone 40 in light mode and tone 80 in dark mode. Neighbouring series are at least 60° apart in hue. `data.positive` is `success`, `data.negative` is `error` and `data.neutral` is `outline`.
- **Everything else:** parsed from material-web `tokens/versions/v0_192/_md-{ref,sys,comp}-*.scss`. rem is converted to px at 16px/rem. Typography `lineHeight` is written as a multiplier (line-height ÷ size). Per-corner shape composites and the motion `path` token are skipped because DTCG has no type for them.

## Contrast

Every contrast pair in the contract passes in both modes with the raw M3 roles, so **no tones were adjusted**. The pair closest to its limit is `border.strong` (`outline`, neutral-variant 50) on `surface` in light mode, at 4.26:1 against a 3:1 minimum. Every other pair clears its minimum by at least 1.5.

## Provenance

`manifest.json` → `provenance` has the full list. In short:

| Source | Version | License | Used for |
|---|---|---|---|
| [`@material/material-color-utilities`](https://github.com/material-foundation/material-color-utilities) | 0.4.0 | Apache-2.0 | Palettes and light/dark colour roles; status and chart palettes |
| [material-web](https://github.com/material-components/material-web) `tokens/versions/v0_192/*.scss` | v2.5.0 (b4de401e) | Apache-2.0 | Typeface, typescale, shape, motion, state, elevation levels, scrim/disabled opacity, icon sizes, outline widths |
| material-web `tokens/_md-comp-focus-ring.scss`, `elevation/internal/_elevation.scss` | v2.5.0 | Apache-2.0 | Focus ring width/offset/colour, shadow geometry |

None of the values are scraped from m3.material.io.

Known quirk: material-color-utilities 0.4.0 contains extensionless relative imports (e.g. `from '../dynamiccolor/dynamic_scheme'`). Plain Node ESM cannot resolve them, so `generate.ts` registers a small resolve hook that retries them with `.js` added.

## Logo

`logo.svg` is Material's own mark, unaltered, from [m3.material.io/](https://raw.githubusercontent.com/material-components/material-web/cbd34a8921915af94d5ef65c2a69eece41d5b4f3/catalog/site/images/favicon.svg). Polyxd shows it beside the pack's name to identify the design system this pack is modelled on. Google's [trademark guidelines](https://partnermarketinghub.withgoogle.com/brands/google/trademarks-and-terms/terms-and-conditions/) restrict the use of its logos (Google Brand Features (incl. logos) may be used only after Google approves a permission request; no referential-use exception for logos is stated); Polyxd's maintainer has chosen to show it and is responsible for that choice.

Google, Material Design and its logo are trademarks of Google LLC, used here to identify the design system this pack is modelled on. Polyxd is not affiliated with Google LLC.
