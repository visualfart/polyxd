# @polyxd/ds-shadcn

**shadcn/ui on Tailwind CSS v4** as a Polyxd design-system pack: DTCG 2025.10 token files that satisfy the semantic token contract (`packages/spec/tokens/semantic-contract.json`, v0.1.0) in `light` and `dark`.

This is the look most new web apps — and most AI-generated ones — start from, so a Polyxd surface dropped into one of those projects should already belong there.

```sh
npm run check -w @polyxd/ds-shadcn      # contract check, both modes
npm run generate -w @polyxd/ds-shadcn   # regenerate tokens/*.json from the vendored sources
npm run generate -w @polyxd/ds-shadcn -- --refresh   # re-fetch the sources first
```

## Sources

| Source | Version | Licence | What comes from it |
|---|---|---|---|
| shadcn/ui default theme (`apps/v4/app/globals.css`) | main @ 2026-09-20 | MIT | `--background`, `--card`, `--primary`, `--muted`, `--border`, `--ring`, `--radius`, … in both modes |
| Tailwind CSS `theme.css` | 4.3.3 | MIT | The colour palette, type scale, spacing base, shadows and easings |

Both are vendored under `scripts/sources/shadcn/`, with their licences.

## Mapping notes

shadcn's default theme is deliberately monochrome: the primary action is near-black in light mode and near-white in dark. The pack keeps that. Two things it doesn't define come from Tailwind's palette, marked `polyxd.*`:

- **Status colours.** shadcn has only `--destructive`. Success, warning and info use Tailwind green, amber and blue: a pale tint behind dark text in light mode, a deep tint behind light text in dark.
- **Chart colours.** shadcn's `--chart-1..5` are five steps of one blue, which can't carry six categories. The categorical ramp uses six distinguishable Tailwind hues.

Type is Tailwind's scale on its `--font-sans` stack; spacing is Tailwind's 4px base; radii come from shadcn's `--radius` (0.625rem) with its usual `sm`/`md`/`lg` derivations.

## Contrast adjustments

Three places where shadcn's default theme doesn't clear the contract's floor, all in light mode. Each moves to the nearest step of Tailwind's neutral ramp that passes, and says so in the token's `$description`; dark mode keeps shadcn's own values.

| Token | shadcn's value | Measured | Used instead |
|---|---|---|---|
| `color.text.muted` | `--muted-foreground` | 4.34:1 on `--muted` | `zinc-600` |
| `color.border.strong` | `--ring` | 2.59:1 on `--background` | `zinc-500` |
| `color.border.focus` | `--ring` | 2.59:1 on `--background` | `zinc-600` |

The focus one is worth stating plainly: a focus indicator at 2.59:1 is hard to see, and a generated surface has to be operable by keyboard.

## Logo

`logo.svg` is the shadcn/ui mark from the project's own site code, [`apps/v4/components/icons.tsx`](https://github.com/shadcn-ui/ui/blob/98a1fe67b439324ddc857f47fbdce056600a4329/apps/v4/components/icons.tsx) (`Icons.logo`), copied into a standalone SVG: the viewBox, the rectangle and both lines verbatim, with the JSX attribute names written the SVG way. It draws in `currentColor`, which is black in an `<img>`. shadcn publishes no logo guidelines; the repository is [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).

shadcn/ui and its logo are trademarks of shadcn, used here to identify the design system this pack is modelled on. Polyxd is not affiliated with shadcn.
