# Polyxd brand, September 2026

Chosen with the owner on the brand canvas (Claude Design, "Polyxd brand directions": the Shortlist page).
This is the source every other place reads: the design system, `brand/build.ts`, the site, Studio, the
films. Change it here first.

## The mark

A p made of three shapes and a pupil, on a 32-unit grid. Every shape is a rounded rectangle whose
corners are one cubic each, with handles at a fraction `f` of the radius (0.552 draws circular arcs;
0.88 is a firm squircle).

| Part | Box (x, y, w, h) | Corner | Curve `f` | Colour |
|---|---|---|---|---|
| Bowl | 6, 6, 20, 20 | 7 | 0.552 (circular) | Signal orange `#FF6E40` |
| Stem | 6, 14, 5, 14 | 2.5 (fully round) | 0.552 | Signal orange |
| Window | 11.2, 11.2, 9.6, 9.6 | 4.8 | 0.88 (firm squircle) | White `#FFFFFF` |
| Pupil | circle at 16, 16, r 2.4 | | | Ink `#141413`, drawn on top (not cut) |

`chosen-mark.svg` beside this file is the exact artwork. The pupil is a solid ink shape, so it stays
ink on any background. On an ink background the mark is unchanged (orange p, white window, ink pupil).
One-colour use: ink p, paper window, ink pupil, or reversed. Below 20 px the pupil stays; below 12 px
use the p and window only.

The wordmark `polyxd` is set in Young Serif, lowercase, ink, tracking −1.5%, always beside the mark
(gap = 5/32 of the mark's size, wordmark size = 0.8 × mark). Never "olyxd" beside a p.

## The pupil is the only thing that moves

The p and the window never move or change. The pupil expresses state, inside the window:

| State | Pupil | Use |
|---|---|---|
| idle | centre (16, 16), r 2.4 | Rest |
| reading | (17.3, 14.9) | Taking in what was asked, text arriving |
| looking | (14.7, 17.1) | Pointing attention down-left, at content |
| attention | centre, r 3.0 | Something needs the person |
| thinking | orbits the centre at radius 1.1, one turn per 1.6 s | A screen is being generated |
| blink | squashes to a horizontal ink bar (5.2 × 1.6, r 0.8) and back, 280 ms | Acknowledgement, once, never looped fast |
| checked | becomes an ink tick in the window: M13.9 16.3 l1.5 1.5 2.8 −3.1, stroke 1.3, round caps | Verified, done |
| asleep | a low horizontal bar at y 17.4, 40% opacity | Offline, idle for long |

Motion: the packs' easing `cubic-bezier(0.2, 0, 0, 1)`, 200–400 ms between states; nothing bounces.
Respect `prefers-reduced-motion`: jump between states, no orbit.

## Colour

| Token | Hex | Use |
|---|---|---|
| paper | `#F3F1EC` | The ground |
| ink | `#141413` | Text, the pupil, outlines, focus rings |
| signal | `#FF6E40` | The p, primary buttons (with ink text), highlights. Never text on paper. |
| signal-text | `#B14C2C` | Orange text and links: 4.7:1 on paper, 5.3:1 on white |
| white | `#FFFFFF` | The window, cards, inputs |
| muted | `#5E5A52` | Secondary text |
| rule | `#DAD5CA` | Hairlines, quiet borders |
| night | `#121211` | Dark ground (paper and ink swap; signal unchanged) |

Contrast, measured: ink on signal 6.6:1 (AA at every size, AAA for large text); white on signal
2.8:1 (fails, never used); signal on paper 2.5:1 (so signal is never text, focus ring or input border
on paper). Primary buttons are signal with ink text, weight 600, at least 15 px.

## Type

- Display: **Young Serif** 400, tracking −1.5%.
- Body and UI: **Hanken Grotesk** 400 / 500 / 600.
- Code: **DM Mono** 400.

## Shape

The mark sets the corners: buttons, chips and inputs are fully round (the p's stem); cards, panels,
the app icon and surfaces use the squircle curve (`f` 0.73, radius 16–30). Hairlines, not shadows.
