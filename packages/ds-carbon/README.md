# @polyxd/ds-carbon

The IBM Carbon design-system pack for Polyxd. It has DTCG 2025.10 token files that satisfy the Polyxd semantic token contract (`packages/spec/tokens/semantic-contract.json`, v0.1.0) in two modes: `light` is the Carbon **White** theme and `dark` is the Carbon **Gray 100** theme. The default mode is `light`.

```sh
npm run check -w @polyxd/ds-carbon     # contract check, both modes
npm run generate -w @polyxd/ds-carbon  # regenerate tokens/*.json from the vendored sources
```

## Tiers

Carbon's names are kept in Carbon's Sass spelling, so `$text-primary` becomes `carbon.theme.text-primary` and `$spacing-05` becomes `carbon.spacing.05`. You can trace every semantic token back to Carbon.

| Tier | File | Contents |
|---|---|---|
| Primitive | `tokens/primitive.json` | `carbon.color.<family>.<step>` (the full palette, including `white.0`, `black.100`, `cool-gray`, `warm-gray` and the `<step>-hover` colours), `carbon.type.font-family.*` (the IBM Plex stacks as arrays), `carbon.type.font-weight.{light,regular,semibold}`, `carbon.spacing.01..13`, `carbon.size.{xs,sm,md,lg,xl,2xl}`, `carbon.icon-size.01/02`, `carbon.border-radius.{00,02,04,08,16,24,max}`, `carbon.motion.duration.*` and `carbon.motion.easing.{standard,entrance,exit}.{productive,expressive}`. |
| System | `tokens/system.json` | Values that are the same in both modes: the productive type styles `carbon.type.body-01`, `body-02`, `body-compact-01/02`, `heading-01..07`, `heading-compact-01/02`, `label-01/02`, `helper-text-01/02`, `legal-01/02` and `code-01/02` as DTCG typography composites. Also `carbon.shadow.box-shadow` and `polyxd.shadow.flat`. |
| System, per mode | `tokens/system.light.json`, `tokens/system.dark.json` | `carbon.theme.*`: every core Carbon theme token (White or Gray 100), plus the button, notification and status component tokens (`carbon.theme.button-primary`, `notification-background-error`, `status-yellow-outline`, …). `carbon.data-viz.categorical.01..14` holds the Carbon Charts categorical palette. `polyxd.theme.*` holds the per-mode Polyxd additions: `warning-emphasis` (a contrast adjustment) and `opacity.{hover,pressed,focus,disabled}`. |
| Semantic | `tokens/semantic.json` | The 86 Polyxd contract tokens. Each one is an `{alias}` to a Carbon token, or to a `polyxd.*` token where Carbon has no equivalent or the value had to be adjusted. The file is the same in both modes. The aliases pick up whichever mode's system file is loaded. |

`manifest.json` merges the files for each mode in this order: primitive → system → system.<mode> → semantic.

When a theme colour is exactly a palette step, it is an alias to that step. For example, `carbon.theme.text-primary` is `{carbon.color.gray.100}` in light mode. The generator matches base steps before hover steps, and `gray` before `cool-gray`/`warm-gray`. The only colours written as literals are the alpha colours (`background-hover`, `overlay`, `shadow`, `text-disabled`, …), because an alias cannot add alpha, and `button-danger-hover` (`#b81921`, which is not a palette step). Each literal has a `$description` that names its source.

## Semantic mapping and judgement calls

- **Surfaces.** `default` is `$background`. `subtle` is `$layer-accent-01`, the data-table header layer. `raised` is `$layer-01` (tile). `overlay` is `$layer-01`, because Carbon puts modals, menus and popovers on `$layer` over `$background`. `inverse` is `$background-inverse`. `scrim` is `$overlay`, which is black at 0.6. In light mode, `surface.subtle` and `selection.background` are both gray 20, because `$layer-accent-01` and `$layer-selected-01` share that value in the White theme.
- **Text.** `default` is `$text-primary`, `muted` is `$text-secondary`, `inverse` is `$text-inverse` and `link` is `$link-primary`.
- **Borders.** `default` is `$border-subtle-01`, `strong` is `$border-strong-01` and `focus` is `$focus`.
- **Actions.**
  - Primary uses `$button-primary` with `$text-on-color`.
  - Secondary uses `$button-secondary` with `$text-on-color`. Carbon's secondary button has no border, so `action.secondary.border` is also `$button-secondary`, which makes the border invisible against the fill.
  - Danger uses `$button-danger-primary` with `$text-on-color`.
- **Selection.** The background is `$layer-selected-01` (Carbon's selected row or item) and the foreground is `$text-primary`.
- **Status.**
  - `background` is `$notification-background-{info,success,warning,error}`. These are the tinted 10-steps in White. In Gray 100 they are all gray 90, the same as the Carbon dark notification.
  - `foreground` is `$text-primary`.
  - `emphasis` is `$support-{info,success,warning,error}`. The exception is light-mode warning; see [Contrast](#contrast).
- **Data.**
  - `categorical.1..6` are the first six colours of the Carbon Charts 14-colour categorical palette:
    - Light: purple 70, cyan 50, teal 70, magenta 70, red 50, red 90.
    - Dark: purple 60, cyan 40, teal 60, magenta 40, red 50, red 10.
  - All 14 are in `carbon.data-viz.categorical.*`. Neither `@carbon/themes` nor `@carbon/colors` 11.x has data-visualization tokens, so the palette comes from `@carbon/charts`. Carbon Charts writes four of the entries as hex literals (yellow 50 and orange 70 in light, yellow 40 and orange 60 in dark). Each one matches a `@carbon/colors` step exactly, so those entries are aliases too.
  - `positive` is `$support-success`, `negative` is `$support-error` and `neutral` is `$status-gray`.
- **Type.**
  - Page title is `heading-05` (32px), section is `heading-03` (20px) and item is `heading-02` (16px semibold).
  - **Body default is `body-02` (16px).** Carbon's default body style is `body-01` at 14px, but the contract requires `type.body.default` ≥ 16px. `body-01` is used for `type.body.small`.
  - Label default is `label-02` (14px). It has the same metrics as `body-compact-01`, Carbon's button and control text. Label small is `label-01` (12px).
  - Numeric display is `heading-06` (42px light).
  - Every style uses IBM Plex Sans.
- **Space.** Every space token is on the 8px-based `$spacing` scale:
  - Inset: 03 / 05 / 06 (8 / 16 / 24px).
  - Stack: 03 / 05 / 07 / 09 (8 / 16 / 32 / 48px).
  - Inline: 02 / 03 / 05 (4 / 8 / 16px).
- **Size.** `size.target.min` is `$size-lg`, 48px. Carbon's default control size (`md`) is 40px. 48px is Carbon's large size and meets the contract's 44–48px guidance. Icons are `$icon-size-01` (16px, small) and `$icon-size-02` (20px, default).
- **Radius.** `radius.small`, `default` and `large` are all `$border-radius-00` (0px), because Carbon components are square. `radius.full` is `$border-radius-max` (999999px), for pills and avatars. `@carbon/layout` also has 02–24 radii, but this pack does not use them.
- **Border widths.** 1px by default. 2px for the strong width, which Carbon uses for selected tiles, invalid fields and the focus outline.
- **Focus ring.** The width is 2px and the offset is **-2px**. This is Carbon's `focus-outline('outline')`: `outline: 2px solid $focus; outline-offset: -2px`. Carbon draws focus inside the element's edge, so the offset is negative rather than a gap.
- **Opacity.** Carbon has no opacity tokens. Its interaction fills are `$gray-50` with an alpha, so the state opacities are read from those alphas in each mode:
  - `hover` is the alpha of `$background-hover`: 0.12 in light, 0.16 in dark.
  - `pressed` is the alpha of `$background-active`: 0.5 in light, 0.4 in dark.
  - `focus` reuses the hover alpha. Carbon shows focus with the `$focus` outline, not a fill.
  - `disabled`: see [Contrast](#contrast).
- **Shadow.** `raised` is `polyxd.shadow.flat`, a zero-size transparent shadow, because Carbon tiles are flat and are told apart by layer colour. `overlay` is Carbon's `box-shadow` mixin, `0 2px 6px 0 $shadow`. `$shadow` is black at 0.3 in White and 0.8 in Gray 100.
- **Motion.** All values are productive:
  - Durations: `fast-01` (70ms), `fast-02` (110ms), `moderate-02` (240ms) and `slow-01` (400ms).
  - Easing: `standard` is standard-productive, `enter` is entrance-productive and `exit` is exit-productive.
- **Measure.** `measure.max` is 65 characters. This is a Polyxd value, because Carbon defines no measure token.

## Contrast

Two contract requirements fail when the natural Carbon tokens are used. Both are fixed in `polyxd.theme.*`, so the Carbon tokens themselves are not changed:

| Mode | Token | Natural Carbon value | Problem | Adjustment |
|---|---|---|---|---|
| light | `color.status.warning.emphasis` | `$support-warning` = yellow 30 `#f1c21b` | 1.68:1 on `$background` (white); the minimum is 3:1 (WCAG 1.4.11) | `$status-yellow-outline` = yellow 60 `#8e6a00`, **4.99:1**. This is the Carbon status token for outlining yellow status shapes on light themes. Dark mode keeps `$support-warning` (10.75:1 on gray 100). |
| both | `opacity.state.disabled` | 0.25 (the alpha of `$text-disabled` / `$icon-disabled`) | Below the contract range of 0.3–0.6 | Raised to **0.3**. No Carbon opacity token of 0.3 or more fits disabled content. |

Every other pair passes with the unadjusted Carbon tokens. These pairs are closest to their minimum:

- **Light:** `border.strong` (gray 50) on white is 3.32:1. `data.categorical.2` (cyan 50) is 3.33:1. `status.success.emphasis` / `data.positive` (green 50) and `data.categorical.5` (red 50) are 3.35:1.
- **Dark:** `border.strong` (gray 60) on gray 100 is 3.60:1. `data.categorical.1` (purple 60) and `action.danger.background` are 3.62:1. Button text on the primary and danger buttons is 5.00:1, and on the secondary button 5.02:1.

## Regenerating

`scripts/generate.ts` writes all five token files and gives the same output on every run. It has no dependencies and runs offline from the data vendored in `scripts/sources/carbon/`:

| File | From |
|---|---|
| `colors.json` | `@carbon/colors` 11.58.0: the `colors` and `hoverColors` exports |
| `themes.json` | `@carbon/themes` 11.81.0: the `white` and `g100` exports (without the ai/chat/syntax tokens), plus `buttonTokens`, `notificationTokens` and `statusTokens` |
| `layout.json` | `@carbon/layout` 11.59.0: `spacing`, the sizes, `iconSize`, `borderRadius` and `baseFontSize` |
| `type.json` | `@carbon/type` 11.67.0: `fontFamilies`, `fontWeights` and the type styles used |
| `motion.json` | `@carbon/motion` 11.52.0: `easings` and the six durations |
| `charts.json` | `@carbon/charts` 1.27.20: the `scss/_color-palette.scss` 14-colour categorical sequences |
| `LICENSE` | The Apache-2.0 license shipped with the Carbon packages |

Each JSON file has a `$source` field that records the package, the exact version, the license and what was extracted. The generator fails if a vendored version does not match the pinned version.

To refresh the vendored data, install the pinned packages **outside the monorepo** and pass their `node_modules` directory:

```sh
cd "$(mktemp -d)" && npm init -y >/dev/null && npm install --ignore-scripts \
  @carbon/colors@11.58.0 @carbon/themes@11.81.0 @carbon/layout@11.59.0 \
  @carbon/type@11.67.0 @carbon/motion@11.52.0 @carbon/charts@1.27.20
node /path/to/packages/ds-carbon/scripts/generate.ts --refresh "$PWD/node_modules"
```

Some values come from Sass mixins, so they are transcribed as constants in `generate.ts` rather than vendored. Both are from `@carbon/styles` 1.115.0: the `box-shadow` mixin (`0 2px 6px $shadow`) and `focus-outline('outline')` (2px, offset -2px).

`@carbon/themes` 11.81.0 also includes `src/dtcg/*.json`, but this pack does not use them. `g100.json` is missing several tokens that `white.json` has, such as `background-inverse`, and it nests names differently. This pack uses the built JS theme objects, which are the values Carbon's Sass and React packages ship.

Do not edit the token files by hand.

## Provenance

`manifest.json` → `provenance` has the full list. In short:

| Source | Version | License | Used for |
|---|---|---|---|
| [`@carbon/colors`](https://github.com/carbon-design-system/carbon/tree/main/packages/colors) | 11.58.0 | Apache-2.0 | Palette and hover colours |
| [`@carbon/themes`](https://github.com/carbon-design-system/carbon/tree/main/packages/themes) | 11.81.0 | Apache-2.0 | White and Gray 100 theme tokens; button, notification and status component tokens |
| [`@carbon/layout`](https://github.com/carbon-design-system/carbon/tree/main/packages/layout) | 11.59.0 | Apache-2.0 | Spacing, sizes, icon sizes, border radius |
| [`@carbon/type`](https://github.com/carbon-design-system/carbon/tree/main/packages/type) | 11.67.0 | Apache-2.0 | IBM Plex families, weights, type styles |
| [`@carbon/motion`](https://github.com/carbon-design-system/carbon/tree/main/packages/motion) | 11.52.0 | Apache-2.0 | Durations, easings |
| [`@carbon/charts`](https://github.com/carbon-design-system/carbon-charts) | 1.27.20 | Apache-2.0 | Categorical data-visualization palette |
| [`@carbon/styles`](https://github.com/carbon-design-system/carbon/tree/main/packages/styles) | 1.115.0 | Apache-2.0 | Box-shadow and focus-outline geometry (transcribed) |

None of the values are scraped from carbondesignsystem.com.

## Logo

`logo.svg` is Carbon's own two-hexagon mark, unaltered, from [carbondesignsystem.com/](https://raw.githubusercontent.com/carbon-design-system/carbon-website/d8783ad2ae3b5e59c58f58311491f8a2c4e62631/src/images/favicon.svg). Polyxd shows it beside the pack's name to identify the design system this pack is modelled on. IBM's [trademark guidelines](https://www.ibm.com/legal/copytrade) restrict the use of its logos (No other company may use IBM logos without IBM's express written permission or a licence; unlicensed use is limited to text-only references to IBM trademarks); Polyxd's maintainer has chosen to show it and is responsible for that choice.

IBM, Carbon and the Carbon logo are trademarks of IBM Corp., used here to identify the design system this pack is modelled on. Polyxd is not affiliated with IBM Corp.
