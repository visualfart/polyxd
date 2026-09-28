# @polyxd/ds-spectrum

**Adobe Spectrum 2** as a Polyxd design-system pack: DTCG 2025.10 token files that satisfy the semantic token contract in `light` and `dark`.

```sh
npm run check -w @polyxd/ds-spectrum     # contract check, both schemes
npm run generate -w @polyxd/ds-spectrum  # regenerate tokens/*.json
```

## Source

`@adobe/spectrum-tokens` 15.4.1 (Apache-2.0), vendored verbatim as `scripts/sources/spectrum/variables.json`.

Spectrum publishes tokens as JSON rather than CSS, and a token's value depends on which sets it belongs to: colours carry a light/dark/wireframe set — nested twice, theme and then colour scheme — while sizes carry a desktop/mobile set. The generator walks those sets by name, so `accent-background-color-default` resolves to the value a Spectrum app of that theme actually renders. The pack takes the desktop scale in both schemes; the touch target comes from the contract rather than from the scale.

## Contrast adjustments

Spectrum numbers its ramps by **contrast**, not by lightness: `gray-25` is white in light and near-black in dark, `gray-800` is body text in both. A role that needs more contrast therefore always moves *up* the numbers, whichever scheme it is in — which makes this the one pack where the search direction doesn't flip.

The same logic decides a button's fill. A filled button's label is `gray-25`, which is white in light and near-black in dark; measuring the fill against literal white would ask the dark ramp to do something it is not built to do. Measured against `gray-25` instead, Spectrum's own steps pass in both schemes.

The generator prints every move it makes; at 15.4.1 the ramps carry each role without adjustment.

## What the pack adds

Spectrum's token package publishes no typeface, no motion and no measure, so `polyxd.sys.*` supplies them and says so:

- **Typeface.** Spectrum's is Adobe Clean, which is licensed and not published with the tokens. The pack asks for it first and falls back to Source Sans 3, Adobe's own open, metric-compatible face.
- **Motion.** Spectrum documents its durations and easings but does not ship them as tokens; these are Polyxd values, marked as such.
- **The scrim** is Spectrum's `overlay-color` at its `overlay-opacity` — two tokens the contract wants as one colour.
- **A full radius.** Spectrum writes it as the ratio `0.5` (50%), which a dimension token can't carry; 9999px rounds the same controls.
- State-layer opacities, the 44px touch target and the 65-character measure, as in every pack.

## Files

| File | What's in it |
|---|---|
| `tokens/system.light.json`, `tokens/system.dark.json` | Spectrum's tokens resolved for that scheme, names unchanged, plus that scheme's `polyxd.sys.*` additions |
| `tokens/semantic.json` | the Polyxd contract, each token an alias — identical in both schemes |
| `manifest.json` | modes, contract version, provenance |
| `scripts/sources/spectrum/` | the vendored token file and Adobe's licence |

## Logo

`logo.svg` is Adobe's logo, since Spectrum has no mark of its own (the Spectrum site's header uses it beside the name), unaltered, from [spectrum.adobe.com/](https://spectrum.adobe.com/_next/static/media/adobe_logo_spectrum_site.b6d47fe3.svg). Polyxd shows it beside the pack's name to identify the design system this pack is modelled on. Adobe's [trademark guidelines](https://www.adobe.com/legal/permissions/trademarks.html) restrict the use of its logos (Use of Adobe logos (corporate or product) is not allowed unless licensed by Adobe; the names may be used referentially ('for use with', 'compatible with')); Polyxd's maintainer has chosen to show it and is responsible for that choice.

Adobe, Spectrum and the Adobe logo are trademarks of Adobe Inc., used here to identify the design system this pack is modelled on. Polyxd is not affiliated with Adobe Inc.
