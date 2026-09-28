# @polyxd/ds-polaris

**Shopify Polaris** as a Polyxd design-system pack: DTCG 2025.10 token files that satisfy the semantic token contract in `light` and `dark`.

```sh
npm run check -w @polyxd/ds-polaris     # contract check, both themes
npm run generate -w @polyxd/ds-polaris  # regenerate tokens/*.json
```

## Source

`@shopify/polaris-tokens` 9.4.2 (MIT). Polaris publishes its whole theme as CSS custom properties, so `dist/css/styles.css` is vendored verbatim and the generator reads its variables: everything from `:root, .p-theme-light`, with the short `.p-theme-dark` block layered on top for the dark pack. Names are kept, with the `--p-` prefix rewritten to the pack's namespace (`polaris.color-bg-surface`, `polaris.space-400`).

Built with `@polyxd/ds-kit`, which handles the CSS reading, the `rem` conversion and the DTCG output.

## What Polaris leaves out, and what this pack does about it

**Polaris's dark theme is partial.** As of 9.4.2 it overrides forty variables — the neutrals, the brand fill and a few surfaces — and leaves every status, emphasis and magic colour at its light value. A light green success chip on a dark page is what Polaris itself renders today, and the pack keeps it: the chip is internally consistent (light tint, dark text) and moving it would be inventing a palette Polaris doesn't have. What the pack does move is anything the contract measures against the *page*.

Polaris has no numbered ramps, but each status has a family that runs light to dark — `bg-surface-*`, `border-*`, `icon-*`, `bg-fill-*`, `text-*`. That family is the ramp this pack walks, sorted by measured luminance rather than by role name, because the order of the roles isn't the order of the colours (critical's icon is lighter than its fill). Same rule as every other pack: move along the system's own steps.

| Role | Polaris's own value | Measured | Used instead |
|---|---|---|---|
| `color.status.*.emphasis` (dark) | `icon-success`, `icon-critical`, `icon-magic` | 1.4–2.9:1 on `#303030` | `border-*` of the same family (8.6–10.5:1) |
| `color.action.danger.background` (dark) | `bg-fill-critical` | 2.20:1 | `border-critical` (8.59:1), with `text-critical` as its label (6.16:1) |
| `color.text.link` (dark) | `text-link` / `text-emphasis` (`#005bd3`) | 2.16:1 | `bg-surface-emphasis` (11.85:1) — the lightest step of the emphasis family, a blue-tinted white |
| `color.border.focus` (dark) | `border-emphasis` | 2.16:1 | `bg-surface-emphasis` (11.85:1) |
| `color.text.muted` (light) | `text-secondary` | identical to `text` | `icon` — Polaris's light theme gives secondary text the same value as body text, so the icon colour is the quieter neutral |
| `color.surface.subtle` (dark) | `bg-surface-secondary` | stays `#f1f1f1` | `bg` — Polaris's page background, the darker surface its cards sit on |

**The destructive button is the one worth repeating.** It has to clear two floors at once: 3:1 against the page it sits on and 4.5:1 for its own label. Polaris's critical fill is 2.20:1 on its dark surface, so the fill moves along the critical family and the label then takes whichever of Polaris's two critical text colours clears 4.5:1 on the step chosen — here the pale `border-critical` fill with dark `text-critical` on it, rather than white on red.

**Body text.** Polaris's body size is 14px (`font-size-350`); the contract's floor for running text is 16px, so `type.body.default` uses `font-size-400` and `type.body.small` takes 14px. Nothing else in the type scale moves.

## What the pack adds

`polyxd.sys.*` marks everything Polaris leaves to its components rather than to variables: state-layer opacities (Polaris shades hover with separate surface colours), the 44px touch target (Polaris's own control height is 32px), the focus ring's width and offset, and the enter/exit easings either side of `--p-motion-ease`.

## Files

| File | What's in it |
|---|---|
| `tokens/system.light.json`, `tokens/system.dark.json` | Polaris's own variables, names kept, plus that theme's `polyxd.sys.*` additions |
| `tokens/semantic.json` | the Polyxd contract, each token an alias — identical in both themes |
| `manifest.json` | modes, contract version, provenance |
| `scripts/sources/polaris/` | the vendored stylesheet and Polaris's licence |

## Logo

`logo.svg` is Shopify's shopping-bag logo, since Polaris has no mark of its own, unaltered, from [www.shopify.com/brand-assets](https://cdn.shopify.com/shopifycloud/brochure/assets/brand-assets/shopify-logo-shopping-bag-full-color-66166b2e55d67988b56b4bd28b63c271e2b9713358cb723070a92bde17ad7d63.svg). Polyxd shows it beside the pack's name to identify the design system this pack is modelled on. Shopify's [trademark guidelines](https://www.shopify.com/brand-assets) restrict the use of its logos (Use of Shopify brand assets must be expressly authorised in writing and must not imply sponsorship, affiliation or endorsement); Polyxd's maintainer has chosen to show it and is responsible for that choice.

Shopify, Polaris and the Shopify logo are trademarks of Shopify Inc., used here to identify the design system this pack is modelled on. Polyxd is not affiliated with Shopify Inc.
