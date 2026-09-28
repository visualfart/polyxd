# The Polyxd brand

`BRAND-2026.md` is the decision: the mark's geometry and colours, the pupil's states, the colour
tokens with their measured contrast, type and shape. Change it there first. `tokens.json` is the
design system's own file ("Polyxd Design System" in Claude Design), copied here unchanged; its README
there is the brand book and usage rules.

Everything else here is written by `build.ts` from those two (`node brand/build.ts`; the PNGs need
the verifier's browser and the Google Fonts). It checks that the generated `mark.svg` is
`chosen-mark.svg`, the chosen artwork, byte for byte.

## The mark

A p made of three shapes and a pupil on a 32-unit grid: an orange bowl and stem (`#FF6E40`), a white
firm-squircle window, and a solid ink pupil (`#141413`) drawn on top, so it stays ink on any ground.
Only the pupil moves.

| File | Use |
|---|---|
| `mark.svg` | The mark, on any ground: paper, white, night. The default |
| `mark-dark.svg` | The same file: on night the mark does not change (kept for old links) |
| `mark-mono.svg` | One colour for light grounds: ink p and pupil, paper window |
| `mark-paper.svg` | One colour for dark grounds: paper p and pupil, ink window |
| `mark-small.svg` | No pupil, for 12px and below. Down to 12px the pupil stays |
| `mark-states.svg` | The eight states as `<symbol>`s (`polyxd-idle`, `reading`, `looking`, `attention`, `thinking`, `blink`, `checked`, `asleep`), shown in a row |
| `mark.css` | The design system's `Mark` state CSS: an inline mark with `class="pxb-mark" data-state="…"` moves its pupil |
| `tokens.css` | `tokens.json` as CSS custom properties (`--ground`, `--ink`, `--signal`, `--focus-ring`, `--font-display`, …) for paper and night |
| `icon-*.png` | App icons on ink at 128, 180, 192, 512, 1024; `icon-accent-1024.png` on signal with the ink mark |
| `favicon.ico` | The mark alone at 16, 32 and 48px, for browsers and crawlers that ask for `/favicon.ico` (the SVG favicon is the mark itself) |
| `og.png` | 1200 × 630 social image, the fallback; polyxd.com gives each page its own card (`apps/site/og/`) |

From code, `build.ts` exports `mark()` and `svg()` for a still mark, `markSvg()` for the living one
(tokens and `mark.css`), `tokensCss()`, `FONTS_URL` and the colours.

## Rules

- The wordmark `polyxd` is set in Young Serif, lowercase, in ink, tracking −1.5%, always **beside**
  the mark: a gap of 5/32 of the mark's size, the word at 0.8 of it. Never a p beside "olyxd".
- Clear space is one window (30% of the mark's size) on every side.
- Never redraw the mark, recolour its parts, add effects or put it on a busy image.
- The static logo is idle. The other states say what Polyxd is doing (reading, thinking while a
  screen is generated, checked when verified), never decoration. Move between them with
  `ease-standard` over `duration-base`; never loop a blink; with reduced motion, jump and do not orbit.
- Signal is never text, a focus ring or an input border on paper (2.5:1). Text on signal is ink
  (6.6:1), never white. Orange words and links use `signal-text`.
- Type: Young Serif for display and the wordmark, Hanken Grotesk for body and UI, DM Mono for code
  and labels.
- Buttons, chips and inputs are fully round; cards and panels take `radius-card` as a squircle where
  supported. Hairlines, not shadows.
- Products built on Polyxd never inherit this brand; their screens are drawn in their own design system.
