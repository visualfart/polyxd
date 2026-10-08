---
format: 1920x1080
fps: 30
duration: 91.33
message: "Every ask gets a screen."
music: "Stylish Deep Electronic (nveravetyanmusic, supplied by the owner), 105 bpm, re-cut on its bars (music-d2.mjs)"
mode: autonomous
---

# Film D2 · "Where's my order?"

Story: `../STORY-DEV-2.md` plus the owner's changes in `BRIEF.md`. Timings:
`../shared/film-d2-timings.json`. Code: `../shared/film-d2.js`, `../shared/film-d2.css` (on top of
`kit.css` and `film-b4.css`), `../shared/ascii-field.js`, `../shared/sting-ascii.html`,
`../shared/outro-ascii.html`, `../make-d2.mjs`, `../music-d2.mjs`. The order document and its agent
task: `../shared/film-d2-order/`. The acme pack: `../shared/film-d2-acme/` (`acme.css` is film D's token
file unchanged; `acme-dark.css` its dark counterpart; `ds-acme/` and `pack-output.txt` are what
`npx polyxd pack ./acme.css --dark ./acme-dark.css` wrote and printed; `pack.css` is that pack compiled
by `@polyxd/ds-kit`'s `packCss`, see the README).

Look: ground #0B0B0A with a 24 px dot grid that drifts with the camera; panels #141413/#1C1B19 with
#2A2825 rules and an orange rim on the focused one; type #F3F1EC/#A8A298; signal orange the only
accent; syntax keys off-white, strings #FF8A63, numbers #E8C27A; a vignette. Bars at n × 2.2857 s. Captions are left blocks of two or three short lines (Young Serif, 72 px) over a
left scrim, with the picture composed to their right; only the turn's question is centred.

## 0 · Sting (0–5.4)
ASCII field (DM Mono, density ramp " .:-=+*#%@"), seeded value noise; on the score's first accent
(0.57) the glyphs fly in to the mark (orange p, off-white window, pupil a hole), then the wordmark
(1.9); the pupil looks and blinks (3.25); from 4.3 every glyph thins to a dot and fades into the ground.

## 1 · The backlog (5.3–16.0)
A generic tracker ("Issues", "● N Open ✓ 1,208 Closed", no product's name or icons). Rows land with the
kick (6.86): #933, #1287, #2041, #1764, then sixteen more at 0.12 s; 👍 counts tick; the Open count rolls
up one per row to 412 (odometer). Camera: close on the first rows, then a decelerating pull-back over the
whole list. hw note "+37 this week" with an arrow at the count. Caption: "Your users ask for more than
you'll ever build."

## 2 · The turn (16.0–25.14)
The impact bar, then the breakdown. The list dims away; #933 lifts out and lands in the centre, alone,
with a slow push-in, and holds to be read (16.9–19.6). Only then the mark appears above it and looks at
it, and the question wipes in under it; both hold (to 24.75). Caption: "What if every ask came with its
screen?"

## 3 · Describe it (25.14–38.5)
The drop: the card becomes the editor (tilted, settling flat). `order-status.json` is written: a "you"
chip rides the caret while the first lines are typed by hand, then it hands over to "✦ agent · via MCP"
(28.35), which streams the rest; with the handover a muted DM Mono line "MCP server:
mcp.polyxd.com/mcp" appears under the caption. Then (wide)  the dark phone (Material 3) draws the real screen part by part as three hw arrows land (Status,
DetailList, Collection); the Action line lights and "Change delivery time" appears. The order items are the owner's photos (desk lamp,
LED bulbs). Caption (left block): "You or your agent / describe the screen. / Polyxd draws it."

## 4 · Style it (38.5–55.5)
`Order.tsx` streams in; push-in on `theme="material3"`, hw circle, "one prop", and a chip naming the kind.
The prop is retyped every 1.2 s and the phone token-morphs (dark tokens): enterprise · Carbon (a desktop
window rises with crm-accounts-list in Carbon), developer, minimal · shadcn/ui, public service · GOV.UK
(light: GOV.UK has no dark mode), template · terminal, template · brutalist. The integrated terminal
rises: `npx polyxd pack ./acme.css --dark ./acme-dark.css`, real output; the prop becomes acme (yours ·
acme), held to be read; then the code steps back and the phone stands right of the caption "Any design
system. / Including yours."

## 5 · Wire it (56.0–62.1)
A tap on "Change delivery time"; the ActionEvent `{ name: "order.reschedule", context: { orderId:
"4821" } }` flies onto `onAction`, whose lines light; hw circle round `rescheduleDelivery(...)`.
The camera then sets the editor right of the caption "Your code / decides / what it does."

## 6 · Trust it (62.1–70.9)
Vertical travel down. `npx polyxd-verify order-status.json --tasks tasks.json` types; the default
matrix (Material 3, Carbon, Ant Design × light/dark × 390/1100) assembles and ticks in a diagonal wave;
the real score line prints and "100" is circled. Caption: "Checked before anyone sees it."

## 7 · Payoff (70.9–82.7)
The impact bar: a long flight home. The tracker is now a board (To Do · In progress · Done). To Do
shows seven cards and "+N more"; #933 is already on the Done wall. Each card leaves To Do, its real
screen assembles on it in In progress (phones for consumer asks, desktop windows for B2B ones), and it
lands on the wall in Done, slightly turned, with an orange tick; faster and faster, To Do runs to 0
(tick); the camera pulls back to the whole wall. Caption, left over the emptied columns: "Every ask /
gets a screen."

## 8 · Outro (82.7–91.33)
The board dissolves into the glyph field, which converges on the lockup; the pupil blinks on the score's
final hit (86.86); "polyxd.com/docs · open source" types in under it with a blinking orange cursor and
holds.
