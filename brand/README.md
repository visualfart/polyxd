# The Polyxd mark

Three shapes on a 32-unit grid: a solid lowercase **p**, a **squircle** inside its bowl in the accent, and a **circle** inside the squircle cut through both, so whatever the mark sits on shows in the pupil. Bowl 20 units, squircle 9.6, pupil 4.8; stem 5 wide. It is a letter first and a mark second, and it looks back.

Everything here is written by `build.ts` from that one definition (`node brand/build.ts`; needs the verifier's browser for the PNGs).

| File | Use |
|---|---|
| `mark.svg` | Ink on anything light; the default |
| `mark-dark.svg` | Paper on anything dark |
| `mark-mono.svg` | One colour: print, embroidery, monochrome UIs |
| `mark-small.svg` | No pupil, for 16–20px (the site's favicon) |
| `mark-states.svg` | The seven states as `<symbol>`s: `polyxd-idle`, `reading`, `looking`, `blink`, `attention`, `checked`, `asleep` |
| `icon-*.png` | App icons on ink at 128, 180, 192, 512, 1024; `icon-accent-1024.png` on the accent |
| `og.png` | 1200 × 630 social image |

## Rules

- The mark sits **beside** the full wordmark (`polyxd`, Bricolage Grotesque 800, −4% tracking), with a gap of one stem width. Never as the p of the wordmark: that reads "olyxd".
- Clear space of one stem width all round; minimum 16px, where the pupil closes (`mark-small.svg`).
- Ink `#141413`, paper `#f4f1ea`, accent `#ff5a1f`. The accent appears only in the squircle. Products built on Polyxd never inherit it; a customer's mark may take their primary in the squircle and nothing else changes.
- The static logo is always the idle state. The other states are earned by a real state (loading, checked, attention), never decoration.
- Don't outline it, tilt it, add a shadow, swap the colours, or drop the squircle.
