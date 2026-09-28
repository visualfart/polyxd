# @polyxd/ds-chakra

**Chakra UI 3** as a Polyxd design-system pack: DTCG 2025.10 token files that satisfy the semantic token contract in `light` and `dark`.

```sh
npm run check -w @polyxd/ds-chakra     # contract check, both modes
npm run generate -w @polyxd/ds-chakra  # regenerate tokens/*.json
npm run extract -w @polyxd/ds-chakra -- <node_modules>   # re-emit the vendored stylesheet
```

## Source

`@chakra-ui/react` 3.37.0 (MIT). Chakra publishes its theme as JavaScript — there is no CSS or JSON file to vendor — but it does publish the emitter: `defaultSystem.getTokenCss()` returns exactly the custom properties a Chakra app ships. `scripts/extract.ts` runs that against the pinned package and writes `scripts/sources/chakra/tokens.css`, so the vendored source is reproducible and the generator then reads a stylesheet like every other pack.

The emitted file has three blocks: the base one holds Chakra's scales and palettes, and `:root &, .light &` / `.dark &` hold the semantic colours it flips between modes. Names are kept (`chakra.colors-bg-panel`, `chakra.spacing-4`, `chakra.radii-l2`).

## Contrast adjustments

Chakra's ramps are Tailwind-shaped — 50 to 950, lighter to darker — so a role that needs more contrast moves up the numbers in light mode and down them in dark. Light mode needed most of the work:

| Role | Chakra's own step | Measured | Used instead |
|---|---|---|---|
| `color.status.success.foreground` | `green-600` on `green-50` | 4.36:1 | `green-700` (6.49:1) |
| `color.status.warning.foreground` | `orange-600` on `orange-50` | 4.44:1 | `orange-700` (7.42:1) |
| `color.status.danger.foreground` | `red-600` on `red-50` | 4.40:1 | `red-700` (7.66:1) |
| `color.status.*.emphasis` | step 500 | 2.5–2.9:1 on the page | step 600 of the same ramp |
| `color.border.strong` | `border-emphasized` (`gray-300`) | 1.48:1 | `gray-500` (4.83:1) |
| `color.border.focus` | `border-emphasized` | 1.48:1 light, 1.91:1 dark | the first gray step that is a 3:1 graphic |

**The focus ring is the one worth repeating.** Chakra's ring follows whatever colour palette a component is given, and its neutral default is a 1.48:1 hairline. A focus ring is the thing a keyboard user has to find on the page, so it moves up the same gray ramp until it is one.

## What the pack adds

`polyxd.sys.*` marks what Chakra leaves to its recipes rather than to tokens: state-layer opacities, the 44px touch target, the focus ring's width and offset, the 65-character measure, and the dialog backdrop (black at 48%, set in Chakra's dialog recipe).

Chakra's shadows are built with `color-mix()`, which the kit now reads as a shadow colour — its commas nest, so a shadow is split on brackets rather than on commas.

## Files

| File | What's in it |
|---|---|
| `tokens/system.light.json`, `tokens/system.dark.json` | Chakra's variables for that mode, names unchanged, plus that mode's `polyxd.sys.*` additions |
| `tokens/semantic.json` | the Polyxd contract, each token an alias — identical in both modes |
| `manifest.json` | modes, contract version, provenance |
| `scripts/sources/chakra/` | the emitted stylesheet and Chakra's licence |
| `scripts/extract.ts` | re-emits that stylesheet from an installed copy of Chakra |

## Logo

`logo.svg` is the colour logomark from the brand assets in the chakra-ui repository, [`media/logomark-colored.svg`](https://github.com/chakra-ui/chakra-ui/blob/961161428b8c59157ad921dd23303b73c294d73f/media/logomark-colored.svg), unchanged. Chakra publishes no logo guidelines; the repository is [MIT](https://github.com/chakra-ui/chakra-ui/blob/main/LICENSE).

Chakra UI and its logo are trademarks of Chakra Systems Inc., used here to identify the design system this pack is modelled on. Polyxd is not affiliated with Chakra Systems Inc.
