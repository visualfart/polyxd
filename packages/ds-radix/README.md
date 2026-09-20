# @polyxd/ds-radix

**Radix Themes 3** as a Polyxd design-system pack: DTCG 2025.10 token files that satisfy the semantic token contract in `light` and `dark`.

```sh
npm run check -w @polyxd/ds-radix     # contract check, both modes
npm run generate -w @polyxd/ds-radix  # regenerate tokens/*.json
```

## Source

`@radix-ui/themes` 3.3.0 (MIT), stylesheet vendored verbatim. Radix Themes is configured at runtime — accent colour, gray, radius and scaling are attributes on its root element — so the pack takes **its documented defaults: indigo accent, medium radius, 100% scaling**, and says so rather than pretending there is one Radix look.

Radix publishes every scale twice: sRGB, and the same colours in display-p3 inside `@supports`. The pack reads the sRGB ones, because WCAG contrast is defined on sRGB.

## Radix's steps carry meaning

1–2 backgrounds, 3–5 component fills, 6–8 borders, 9–10 solid fills, 11 accessible text, 12 high-contrast text. The mapping follows that, which is why so little needed adjusting.

## Contrast adjustments

| Token | Radix's step | Measured | Used instead |
|---|---|---|---|
| `color.status.*.foreground` | step 11 on step 3 (its "soft" pairing) | 4.21–4.54:1 in light | step 12 |
| `color.data.categorical.*` | step 9 (the solid fill) | amber-9 is 1.54:1 on a light page | step 11 |
| `color.border.strong` | `gray-8` | 1.86:1 in light | `gray-9` (3.22:1) |
| `color.border.focus` | `focus-8` | 2.36:1 in light | `accent-9` (5.08:1) |
| `color.action.danger.background` | `red-9` with white | 3.91:1 in both modes | `red-11` with `gray-1` |

That last one is the interesting case. **No solid red step carries white text at 4.5:1** — step 9 is 3.91:1, and in dark mode the ramp gets lighter, not darker. Step 11 flips with the mode, dark in light and light in dark, so pairing it with step 1 passes both ways: 5.21:1 and 8.95:1.
