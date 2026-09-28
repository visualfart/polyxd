# @polyxd/ds-primer

**GitHub Primer** as a Polyxd design-system pack: DTCG 2025.10 token files that satisfy the semantic token contract in `light` and `dark`.

```sh
npm run check -w @polyxd/ds-primer     # contract check, both themes
npm run generate -w @polyxd/ds-primer  # regenerate tokens/*.json
```

## Source

`@primer/primitives` 11.10.0 (MIT). Primer splits its CSS into base scales (sizes, type, durations), functional scales (spacing, radii, borders, motion) and one file per theme, and all of those are vendored verbatim. The scales are identical in both themes, so they become the pack's shared tier (`tokens/system.json`) and the per-theme files carry only what actually differs — which is colour, and nothing else.

Names are kept exactly as Primer writes them, camelCase included: `primer.bgColor-default`, `primer.fgColor-muted`, `primer.borderRadius-medium`.

Built with `@polyxd/ds-kit`, which handles the CSS reading, the `rem` conversion and the DTCG output.

## Contrast adjustments

Primer's semantic pairs are tuned by GitHub and clear the contract as they are; no status colour had to move. The two things the pack does are mechanical rather than aesthetic:

**Translucent status fills are composited.** In dark mode Primer's muted fills carry alpha — `bgColor-danger-muted` is `#f851491a` — so the colour a reader sees is that fill over the page, not the value in the file. The contract measures contrast between two colours rather than a stack, so the pack composites each status fill over `bgColor-default` and stores the result: the same pixels Primer renders, written as a colour the checker can measure. The token says which value it came from.

**Where a role has to move, it moves along Primer's own family.** Primer publishes no numbered ramps in CSS, but each status has a family that runs light to dark — `bgColor-X-muted`, `bgColor-X-emphasis`, `fgColor-X`. That family is the ramp, sorted by measured luminance rather than by name, and the generator prints every move it makes. In 11.10.0 it makes none.

**Data visualisation** uses Primer's own `data-*-color-emphasis` palette rather than borrowing status colours, which is what that palette is for.

## What the pack adds

`polyxd.sys.*` marks everything Primer leaves to its components rather than to variables: state-layer opacities (Primer shades hover with separate control colours), the 44px touch target (Primer's medium control is 32px), and the 65-character measure for running text.

## Files

| File | What's in it |
|---|---|
| `tokens/system.json` | Primer's scales — sizes, spacing, radii, type, motion — shared by both themes |
| `tokens/system.light.json`, `tokens/system.dark.json` | that theme's colours, plus its `polyxd.sys.*` additions |
| `tokens/semantic.json` | the Polyxd contract, each token an alias — identical in both themes |
| `manifest.json` | modes, contract version, provenance |
| `scripts/sources/primer/` | the vendored stylesheets and Primer's licence |

## Logo

`logo.svg` is GitHub's Invertocat, since Primer has no mark of its own (primer.style's header uses it beside the name), unaltered, from [brand.github.com/foundations/logo](https://brand.github.com/GitHub_Logos.zip). Polyxd shows it beside the pack's name to identify the design system this pack is modelled on. GitHub's [trademark guidelines](https://brand.github.com/foundations/logo) restrict the use of its logos (Unmodified permitted GitHub logos may be used to link to GitHub, show integration, or in articles about GitHub, placed secondary and never implying affiliation or combined with other words; any other use needs GitHub's prior written permission); Polyxd's maintainer has chosen to show it and is responsible for that choice.

GitHub, Primer and the GitHub logo are trademarks of GitHub, Inc., used here to identify the design system this pack is modelled on. Polyxd is not affiliated with GitHub, Inc.
