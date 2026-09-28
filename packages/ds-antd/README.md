# @polyxd/ds-antd

The Ant Design design-system pack for Polyxd. It has DTCG 2025.10 token files that satisfy the Polyxd semantic token contract (`packages/spec/tokens/semantic-contract.json`, v0.1.0) in `light` and `dark` modes.

```sh
npm run check -w @polyxd/ds-antd     # contract check, both modes
npm run generate -w @polyxd/ds-antd  # regenerate tokens/*.json
```

## Tiers

Ant's own token names are kept as they are, so you can trace every semantic token back to `theme.useToken()` / `ConfigProvider` names.

| Tier | File | Contents |
|---|---|---|
| Reference (primitive) | `tokens/primitive.json` | `antd.seed.*` (the default seed: `colorPrimary`, `fontSize`, `borderRadius`, `controlHeight`, `motionUnit`, preset seed colours, …). `antd.palette.<preset>.1..10` (`presetPalettes`, e.g. `antd.palette.blue.6`) and `antd.paletteDark.<preset>.1..10` (`presetDarkPalettes`). `antd.palette.{primary,success,warning,error,info}.1..10` and the `paletteDark` equivalents: the palettes each algorithm derives from the colour seeds. |
| System | `tokens/system.json` | `antd.token.*` map/alias tokens with the same value in both algorithms: `fontSize*`, `lineHeight*`, `fontFamily`, `borderRadius*`, `controlHeight*`, `padding*`, `margin*`, `size*`, `lineWidth*`, `motionDuration*`, `motionEase*`, `screen*`, `zIndex*`, … Tokens the seed passes through unchanged alias `antd.seed.*`. Polyxd additions: `polyxd.sys.{font,radius,motion,focus,state.disabled}`. |
| System, per mode | `tokens/system.light.json`, `tokens/system.dark.json` | `antd.token.*` colour and `boxShadow*` tokens from `defaultAlgorithm` / `darkAlgorithm`. A colour is an alias to a palette step wherever the algorithm took it from one (for example, `colorPrimary` → `{antd.palette.primary.6}`, `colorPrimaryActive` → `.7`). Polyxd additions: `polyxd.sys.color.solid.*` (opaque composites, see below), `polyxd.sys.color.<role>` (roles that differ by mode or were adjusted for contrast, chart colours) and `polyxd.sys.state.{hover,pressed,focus}`. |
| Semantic | `tokens/semantic.json` | The Polyxd contract tokens, each an `{alias}` to an `antd.token.*`, or to a `polyxd.sys.*` token where Ant has no directly usable value. The file is the same in both modes. |

`manifest.json` merges the files for each mode in this order: primitive → system → system.<mode> → semantic.

The main semantic mappings are:

- **Surfaces:** default and raised are `colorBgContainer`, because antd cards sit on the container colour and are set apart by a border rather than a tone. Subtle is `colorFillAlter` (table and collapse headers). Overlay is `colorBgElevated` (Modal, Popover, Dropdown). Inverse is `colorBgSpotlight` (Tooltip). Scrim is `colorBgMask`, used with its alpha.
- **Text:** default is `colorText`, muted is `colorTextSecondary`, inverse is `colorTextLightSolid` and link is `colorLink` (adjusted, see Contrast).
- **Borders:** default is `colorBorderSecondary`. Strong would be `colorBorder`, but that was adjusted. Focus is `colorPrimaryBorder`, the `genFocusOutline` colour (also adjusted).
- **Actions:** primary is `colorPrimary` with `colorTextLightSolid` text. Secondary is antd's default Button: `colorBgContainer`, `colorText` text and a `colorBorder` outline. Danger is `colorError` with `colorTextLightSolid` text. Selection is `controlItemBgActive` with `colorText` text.
- **Status:** background is `color<Status>Bg`, foreground is `color<Status>Text` and emphasis is `color<Status>`. `danger` uses antd's `colorError*`.
- **Data:** positive is `colorSuccess`, negative is `colorError` and neutral is `colorTextTertiary` (antd's icon grey, `colorIcon`).
- **Type:** fontFamily is `fontFamily` everywhere, and letter-spacing is 0. The page title is Title level 2 (`fontSizeHeading2` 30px), the section title is level 4 (20px) and the item title is level 5 (16px); all three use `fontWeightStrong` 600. Body default is `fontSizeLG` (16px) and body small is `fontSize` (14px). Label default is `fontSize` (14px) and label small is `fontSizeSM` (12px). Numeric display is `fontSizeHeading3` (24px), the Statistic value size. Every style uses its matching antd `lineHeight*` token.
- **Space:** the antd size ladder. Inset is `paddingSM`/`padding`/`paddingLG` (12/16/24). Stack is `marginXXS`/`marginXS`/`margin`/`marginXL` (4/8/16/32). Inline is `marginXXS`/`marginXS`/`margin` (4/8/16).
- **Size, radius and border:** target size is `controlHeight` (32). Icons are `fontSizeIcon` (12) and `fontSize` (14), because antd icons inherit the text size. Radius is `borderRadiusSM`/`borderRadius`/`borderRadiusLG` (4/6/8), and full is `polyxd.sys.radius.full` (9999px). Border widths are `lineWidth`/`lineWidthBold` (1/2). The focus ring is `lineWidthFocus` (3px) with a 1px offset.
- **Shadows:** raised is `boxShadowTertiary` and overlay is `boxShadowSecondary`. `boxShadowSecondary` is what antd's popovers and dropdowns use, and it is identical to `boxShadow`, which Modal uses. Every `boxShadow*` token is parsed into DTCG shadow layers; inset layers get `inset: true`.
- **Motion:** instant, short and medium are `motionDurationFast`/`Mid`/`Slow` (100/200/300ms). Long is `polyxd.sys.motion.duration-long` (400ms). Easing is `motionEaseInOut` for standard, and the zoom pair antd uses for Modal and Popover for enter and exit: `motionEaseOutCirc` and `motionEaseInOutCirc`.

## Judgement calls

- **Body text is 16px, not antd's 14px.** antd's base `fontSize` is 14px. The contract requires `type.body.default` ≥ 16px, so body default maps to `fontSizeLG` (16px, `lineHeightLG` 1.5). antd's 14px base is still available as `type.body.small` and `type.label.default`, so controls keep antd's density.
- **Target size is antd's `controlHeight` (32px).** This passes the contract (WCAG 2.5.8, ≥ 24px), but **antd's default density is below the 44–48px touch-target guidance** of iOS and Material. Use `controlHeightLG` (40px) or larger for touch-first surfaces.
- **Radius** keeps antd's small scale: 4/6/8. antd has no pill token.
- **Translucent colours.** antd's neutrals are alpha colours: `colorText` is `rgba(0,0,0,0.88)` in light mode and `rgba(255,255,255,0.85)` in dark mode. The same goes for `colorTextSecondary`, `colorFillAlter` and the light `colorBgSpotlight`. Semantic colours must be opaque for contrast checks and for renderers that do not composite, so these roles alias `polyxd.sys.color.solid.<antdName>`: the antd colour composited on that mode's `colorBgContainer`. The generator checks contrast with the real alpha composited on each actual background. Composited on white, antd's text alphas give its familiar greys: 0.88 → `#1f1f1f`, 0.65 → `#595959`, 0.45 → `#8c8c8c`.
- **State opacities:** antd shifts colours rather than using state layers. Hover and pressed are the alpha of `colorBgTextHover`/`colorBgTextActive` (0.06/0.15 in light, 0.12/0.18 in dark), and focus is the alpha of `controlOutline` (0.1 in light, 0.31 in dark). These are per mode.
- **Chart colours:** antd ships no chart palette (that is AntV). Series 1–6 are presets blue, orange, cyan, magenta, green and purple, with the order alternating warm and cool. They use step 6 (the preset's base colour) from `presetPalettes` in light mode and `presetDarkPalettes` in dark mode. Where step 6 fails 3:1 against the surface, the series moves to the nearest passing step (see Contrast).
- **Long duration:** antd defines durations as `motionBase + motionUnit × n`, with fast ×1, mid ×2 and slow ×3. `duration-long` extends that ladder by one step (×4 = 400ms).
- **Dark shadows:** in antd 6.6.4, `darkAlgorithm` derives shadows from `colorShadow` `rgba(255,255,255,0.2)`, so the dark `boxShadow*` layers are white at 1–2.4% alpha. They are vendored as antd computes them.

## Contrast

antd's default palette misses several WCAG thresholds. For each contract pair that failed with the natural mapping, the generator moved the role to the **nearest step of the same antd palette** that passes every pair the role is in. For `border.strong` it used antd's neutral ladder (`colorBorderSecondary` → `colorBorder` → `colorTextQuaternary` → `colorTextTertiary` → `colorTextSecondary` → `colorText`) instead. `npm run generate` prints this list. Ratios are WCAG 2.x, with translucent colours composited.

**Light (`defaultAlgorithm`)**

| Role | antd natural | Ratio | Now | Ratio |
|---|---|---|---|---|
| text.link | `colorLink` #1677ff | 4.10 on surface | primary/info step 7 #0958d9 (= `colorPrimaryActive`) | 6.16 |
| action.primary.background | `colorPrimary` #1677ff | **4.10 with white text** | step 7 #0958d9 | 6.16 |
| action.danger.background | `colorError` #ff4d4f | 3.27 with white text | error step 7 #d9363e (= `colorErrorActive`) | 4.62 |
| status.info.foreground | `colorInfoText` #1677ff | 3.66 on `colorInfoBg` | info step 7 #0958d9 | 5.50 |
| status.success.foreground | `colorSuccessText` #52c41a | 2.21 on `colorSuccessBg` | success step 8 #237804 | 5.44 |
| status.success.emphasis | `colorSuccess` #52c41a | 2.27 | success step 7 #389e0d | 3.46 |
| status.warning.foreground | `colorWarningText` #faad14 | **1.83** on `colorWarningBg` | warning step 9 #874d00 | 6.53 |
| status.warning.emphasis | `colorWarning` #faad14 | 1.90 | warning step 8 #ad6800 | 4.41 |
| status.danger.foreground | `colorErrorText` #ff4d4f | 2.99 on `colorErrorBg` | error step 8 #b32430 | 5.98 |
| border.strong | `colorBorder` #d9d9d9 | **1.41** (input outlines) | `colorTextTertiary` #8c8c8c | 3.36 |
| border.focus | `colorPrimaryBorder` #91caff | 1.74 (focus outline) | primary step 6 #1677ff (= `colorPrimary`) | 4.10 |
| data.categorical.2 | orange 6 #fa8c16 | 2.38 | orange 7 #d46b08 | 3.56 |
| data.categorical.3 | cyan 6 #13c2c2 | 2.21 | cyan 7 #08979c | 3.55 |
| data.categorical.5 | green 6 #52c41a | 2.27 | green 7 #389e0d | 3.46 |
| data.positive | `colorSuccess` #52c41a | 2.27 | success step 7 #389e0d | 3.46 |

**Dark (`darkAlgorithm`)**

| Role | antd natural | Ratio | Now | Ratio |
|---|---|---|---|---|
| text.link | `colorLink` #1668dc | 3.55 | info step 7 #3c89e8 (= dark `colorPrimaryHover`) | 5.21 |
| action.danger.background | `colorError` #dc4446 | 4.24 with white text | error step 5 #ad393a | 6.13 (3.00 on surface) |
| status.info.foreground | `colorInfoText` #1668dc | 3.35 on `colorInfoBg` | info step 7 #3c89e8 | 4.91 |
| status.danger.foreground | `colorErrorText` #dc4446 | 4.01 on `colorErrorBg` | error step 7 #e86e6b | 5.57 |
| border.strong | `colorBorder` #424242 | 1.83 | `colorTextTertiary` (composited #7e7e7e) | 4.54 |
| border.focus | `colorPrimaryBorder` #15325b | 1.44 | primary step 6 #1668dc (= `colorPrimary`) | 3.55 |
| data.categorical.6 | purple 6 #642ab5 | 2.23 | purple 7 #854eca | 3.46 |

Findings worth knowing:

- antd's primary button (white on `#1677ff`, 4.10:1) and its light link colour fail WCAG AA 1.4.3 for normal-size text.
- Warning text on the warning background is 1.83:1.
- The default input border `#d9d9d9` is 1.41:1, well below the 3:1 non-text minimum.
- The dark primary button (white on `#1668dc`) passes at 5.19:1, so it was not adjusted.
- The tightest pair after adjustment is dark `action.danger.background` against the surface, at exactly 3.00:1. Step 5 is the only error step that passes both the white-text pair (≥ 4.5) and the surface pair (≥ 3).
- `opacity.state.disabled` is adjusted too. antd's disabled content is `colorTextDisabled` (alpha 0.25), below the contract's 0.3 minimum, so the pack uses 0.45, the next step of antd's text-alpha ladder (`colorTextTertiary`).
- `action.secondary.border` stays antd's `colorBorder`, because the contract has no contrast pair for it. The button label identifies the control.

## Regenerating

`scripts/generate.ts` writes all five token files and gives the same output on every run. It works offline from `scripts/sources/antd/antd-tokens.json`. Do not edit the token files by hand. The generator also checks every contract contrast pair with alpha compositing, and it fails if a role cannot be brought into compliance.

To refresh the vendored data for a new antd version, **use a scratch directory outside the repo**. The pack has no npm dependencies on purpose.

```sh
cd "$(mktemp -d)" && npm init -y && npm install antd@<version> react react-dom
cp <repo>/packages/ds-antd/scripts/sources/antd/dump-antd-tokens.mjs .
node dump-antd-tokens.mjs > <repo>/packages/ds-antd/scripts/sources/antd/antd-tokens.json
```

Then update `ANTD_VERSION` / `COLORS_VERSION` in `generate.ts`, `manifest.json` and this README, and run `npm run generate`.

The dump holds `theme.defaultSeed`, the output of `theme.defaultAlgorithm(seed)` and `theme.darkAlgorithm(seed)` (map tokens), and `theme.getDesignToken({ algorithm })` (map + alias tokens). It also holds `presetPalettes`, `presetDarkPalettes`, and `generate(seed)` / `generate(seed, { theme: 'dark' })` for each colour seed.

## Provenance

`manifest.json` → `provenance` has the full list. In short:

| Source | Version | License | Used for |
|---|---|---|---|
| [`antd`](https://github.com/ant-design/ant-design) | 6.6.4 | MIT | Seed, map and alias tokens for both algorithms; focus-outline offset and colour (`es/style/index.js` `genFocusOutline`); zoom-motion easings (`es/style/motion/zoom.js`) |
| [`@ant-design/colors`](https://github.com/ant-design/ant-design-colors) | 8.0.1 (resolved by antd 6.6.4) | MIT | Preset palettes (light and dark) and the seed palettes |
| Polyxd | – | Apache-2.0 | The semantic mapping, contrast adjustments, solid composites, and the `polyxd.sys.*` additions |

The dump was produced with react/react-dom 19.3.0, which antd needs as a peer dependency but which affects no values. The licence texts of antd and @ant-design/colors are vendored next to the data (`scripts/sources/antd/LICENSE.*`). Our own code and the token files are Apache-2.0.

## Logo

`logo.svg` is the Ant Design mark exactly as Ant serves it from its own CDN, [`gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg`](https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg): the file ant.design's header and the ant-design README load ([`.dumi/theme/slots/Header/Logo.tsx`](https://github.com/ant-design/ant-design/blob/e0ea7bb76fdf2a8871b5f3f0eea5e9fd0cd7f485/.dumi/theme/slots/Header/Logo.tsx)). Ant Design publishes no logo guidelines; the repository is [MIT](https://github.com/ant-design/ant-design/blob/master/LICENSE).

Ant Design and its logo are trademarks of Ant Group, used here to identify the design system this pack is modelled on. Polyxd is not affiliated with Ant Group.
