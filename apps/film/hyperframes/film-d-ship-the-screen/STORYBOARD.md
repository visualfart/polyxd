---
format: 1920x1080
fps: 30
duration: 98.22
message: "Ship the screen, not the backlog."
music: "HeyGen catalogue caac63aa, 120 bpm, re-cut on its bars (music-d.mjs)"
mode: autonomous
---

# Film D · "Ship the screen, not the backlog"

Story: `../STORY-DEV.md`. Timings: `../shared/film-d-timings.json`. Code: `../shared/film-d.js`,
`../shared/film-d.css` (on top of `kit.css` and `film-b4.css`), `../make-d.mjs`, `../music-d.mjs`.
The acme pack: `../shared/film-d-acme/` (`acme.css` is the token file; `polyxd.mapping.json` and
`pack.css` are what `npx polyxd pack` and `npx polyxd dev --pack` produced from it).

One world, five sets (board, editor + phone, checks, your design system, web component) under one
virtual camera: a pose ladder of push-ins, pull-backs, whip pans and a vertical travel with velocity
blur (whip-pan-cut's mechanism, generalised to any direction), 3D tilts settling flat, and a long flight
home. Score bars at even + 0.62 s; the drop at 22.62; the final stop at 94.62 (the outro's blink).

## 0 · Intro (0–5.4)
B's sting (`shared/sting-b.html`), unchanged. Blueprint: logo-assemble-lockup. Pads under it.

## 1 · Cold open: the backlog (5.6–17.6)
Blueprints: spatial-pan-stations (the camera travels note to note as each lands, easing out a little
wider each time) → overwhelm-surround, clutter variant (the pile) → zoom-out-workspace-reveal (one
decelerating pull-back that shows the pile spilling off the board and out of frame). Rules:
multi-phase-camera, viewport-change, spring-pop-entrance (the notes' drop and settle), discrete-text
(the count 1 → 41). Registry: hw-arrow + Caveat note "+37 this week" at the count (hw-boil).
Caption: caption-clip-wipe, "Your users ask for more than you’ll ever build." (3.7 s hold).
Sound: a paper slap per note, the kick entering on the first.

## 2 · The turn (17.6–22.6)
Blueprint: titlecard-reveal (paper veil, the mark alone, one question). Mark: looking, blink,
attention. The ask "Pay Alex my rent share" peels off the pile and flies to the centre on an arc.
Caption: caption-clip-wipe, centred, "What if a screen were just data?" (3.1 s). Audio: the score's
breakdown with a low-pass closing over it (hyperframes-audio automation), a riser into the drop.

## 3 · A screen is a document (22.6–34.6)
The hit: the note morphs (FLIP, colour and radius) into the editor, which arrives tilted and settles
flat. Blueprints: typewriter-reveal / code-typing's mechanism (the spec's money-send-confirm.json
streams in with a caret), panel-edit-live-sync (JSON on the left, the real renderer on the right),
camera-journey. code-highlight's mechanism: a band on the line that matters, context dimmed. Three
hand-drawn arrows (hw family draw-on, boiled), one at a time: `"component": "Confirm"` → the dialog,
`"DetailList"` → the receipt, `"label": "Send £250.00"` → the button; each part arrives as its arrow
lands. Then a push-in on the JSON with an hw-underline squiggle. Captions: "A screen is a small
document." (2.8 s), "Meaning, not pixels." (2.7 s).

## 4 · One component draws it (34.6–44.6)
The file swaps to SendConfirm.tsx (line-swap mask). A terminal pane rises: `npm install @polyxd/react
@polyxd/spec` with its real output. The quickstart's `<PolyxdSurface …/>` streams in; push-in on
`theme="material3"` with an hw-callout-circle and "one prop"; the prop is retyped to carbon, govuk and
shadcn and the phone re-themes after each (B1's token morph, rule theme-crossfade-morph /
blueprint fixed-anchor-cycle). Caption across the top over a paper scrim: "One component draws it,
in any design system." (3.5 s).

## 5 · Your code decides (44.6–50.6)
Blueprint: cta-morph-press + camera-journey (A, action round trip): a finger on "Send £250.00", the
ActionEvent `{ name, context, source }` flies out on an arc (path travel) and lands above the
host's onAction, whose three lines light (band) with an hw circle round `sendMoney(context.quoteId)`.
Caption: "Your code decides what it does." (2.9 s).

## 6 · Checked before anyone sees it (50.6–63.6)
A vertical travel down to the checks. A node prompt: `validateDocument(doc)` → `{ valid: true,
issues: [] }` and a drawn tick (svg-path-draw). `npx polyxd-verify … --tasks tasks.json` types; the
camera pulls back to the default matrix (Material 3, Carbon, Ant Design × light, dark × 390, 1100;
twelve real renders) which assembles (grid-card-assemble) and ticks in a diagonal wave; the real
score line prints and "100" is circled. Caption: "The spec and the verifier check every screen."
(3.5 s). Then a push through one render into the agent's view: the task and step from
bench/tasks.json, the real accessibility tree (the verifier's ARIA snapshot, trimmed) drawing row by
row, a highlight walking the roles to `button "Send £250.00"`, the press, `✓ transfer.confirm {
quoteId: "q_91" }` (blueprint agent-progress-theater). Caption: "People and agents can use it."
(2.8 s).

## 7 · Your design system (63.6–74.1)
Whip pan. `npx polyxd pack ./acme.css` with its real output; push-in; hw circle round "mapped 54 of
87 contract tokens" and "worked out for you". `npx polyxd dev ./screens --pack
./ds-acme/manifest.json`; a browser slides in with polyxd dev's controls and the document drawn in the
acme pack. A `$schema` card: a squiggle under "Confrim", the completion "Confirm", fixed, the preview
reloads. Caption: "Your design system comes in with one command." (3.4 s).

## 8 · Not React? (74.1–82.6)
Whip up. renderers.md's `<polyxd-surface>` + `defineElements()` streams in. Caption: "Not React? The
same screen as a web component." (3.7 s). The camera travels to the two renders side by side with a 3D
tilt settling flat; "=" and "same fingerprint" with a tick (compareFingerprints found no difference).

## 9 · Payoff (82.6–90.4)
Blueprint: camera-journey (B, cursorless flight): a zoom-out flight over the whole world home to the
board. The first note is already its screen; the others flip (rotateY, two faces) into their real
screens (one spec example per ask), ticked by hand, faster and faster, the count running down to 0;
they ship off the board and the board is clear, with a tick. Caption: "Ship the screen, not the
backlog." (3.0 s), centred on the empty board.

## 10 · Outro (90.4–98.2)
B's outro (`shared/outro-b.html`) with "polyxd.com/docs · open source"; the blink on the score's
final stop (94.62).
