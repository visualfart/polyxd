# @polyxd/ds-bootstrap

**Bootstrap 5** as a Polyxd design-system pack: DTCG 2025.10 token files that satisfy the semantic token contract in `light` and `dark`.

```sh
npm run check -w @polyxd/ds-bootstrap     # contract check, both modes
npm run generate -w @polyxd/ds-bootstrap  # regenerate tokens/*.json
```

## Source

`bootstrap` 5.3.8 (MIT), the `:root` and `[data-bs-theme=dark]` custom-property blocks from `dist/css/bootstrap.css`, vendored as `scripts/sources/bootstrap/{light,dark}.json`. Bootstrap's dark theme overrides a subset of `:root`, so the dark file is the merge, as a browser resolves it. Variable names are kept (`bs.body-bg`, `bs.border-radius`).

## Mapping notes

- **Cards sit on the body background** with a border rather than a tone, which is how Bootstrap draws them, so `surface.raised` and `surface.default` are the same colour and the border does the work.
- **Spacing, heading sizes and transitions** live in Bootstrap's Sass, not its CSS variables, so they are Polyxd additions recording Bootstrap's own scale: the 4/8/16/24/48px spacers, `h1` 2.5rem, `.small` 0.875em, and the 0.15s/0.2s/0.3s transitions.
- **Target size.** Bootstrap's default button is 38px; the pack sets 44px, the touch target a generated surface is held to.

## Contrast adjustments

Bootstrap's bright hues can't carry a 3:1 accent in light mode — cyan `#0dcaf0` is 1.35:1 on white, yellow `#ffc107` is 1.23:1, teal 2.13:1, orange 2.57:1. Bootstrap solves this itself with `*-text-emphasis` variables, which are darkened in light mode and lightened in dark, so every status emphasis and chart colour uses those:

| Token | Bootstrap's raw hue | Measured | Used instead |
|---|---|---|---|
| `color.status.info.emphasis` | `--bs-info` | 1.35:1 | `--bs-info-text-emphasis` |
| `color.status.warning.emphasis` | `--bs-warning` | 1.23:1 | `--bs-warning-text-emphasis` |
| `color.status.success.emphasis`, `danger.emphasis` | `--bs-success`, `--bs-danger` | pass in light, fail in dark | their `-text-emphasis` steps, which are mode-aware |
| `color.data.categorical.1–6` | `--bs-blue`, `teal`, `indigo`, `orange`, `pink`, `cyan` | 1.96–2.57:1 | the six `*-text-emphasis` hues |
| `color.border.strong` | `--bs-border-color` | 1.3:1 | `--bs-secondary-color` |
| `opacity.state.disabled` | `.disabled` is 0.65 | above the contract's 0.6 cap | 0.6 |
