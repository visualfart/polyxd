---
format: 1920x1080
fps: 30
duration: 86.68
message: "AI can draw any screen; your designers give it taste, in Studio."
music: "HeyGen catalogue 78398bc2, 120 bpm, cut on its bars (music-s.mjs)"
mode: autonomous
---

# Film S · "Who gives AI taste?" (Polyxd Studio)

The story: `../STORY-STUDIO.md`. Timings: `../shared/film-s-timings.json`. Code: `../shared/film-s.js`,
`../shared/film-s.css` (new, film-s only), on top of B4/B5's machinery used as is: `kit.js` (the phone,
the app chrome, typing), `morph.js` (the token morph), `hw-kit.js` (the registry's hw family),
`mark.js`, `sting-b.html`, `outro-b.html`, `film-b4.css` (captions, the hand-drawn layer, the turn's paper).

Studio is the real Studio: `../film-s-capture.mjs` seeds a throwaway local Studio (a test account with a
random password, through the app's own API, the way `apps/studio/scripts/landing-shots.ts` does), walks
it in Chromium at 2× and saves every state the film needs (`assets/studio/*.png`) with the boxes of the
parts the camera and the doodles aim at (`assets/studio/boxes.json`). The typing, the slider and the
switches are sequences of real states, not mock-ups; where the film animates what the page did (the
scan counting up, the mapping's rows filling in, the shell drawn in hairlines) it lays patches over the
final still and takes them away. The product screens are the real renderer: the generated screen and its
three fixed versions are Polyxd documents drawn by `polyxd-web`, the team's screen is the document
Studio publishes (`GET /api/w/harbourline/screens/cancel`, saved as `assets/studio/cancel.json`), drawn
in Harbourline's CSS export (`assets/themes.css`). The assistant's "loud" theme is Harbourline's own export
with the brand hue turned to an off-brand blue, louder, tighter and squarer (make-s.mjs), so the tune
morph runs every token back to the team's.

Two worlds, two cameras (poses on a keyframe ladder, as B4/B5): stage A holds the Studio window, stage B
the phone. A paper panel slides under the captions when stage A's camera needs the whole frame.
Beats sit on the score's grid: 120 bpm, bar lines at x.88 from 16.88. Reading rule: every caption holds
≥ 2.5 s and ≥ words × 0.3 s + 1 s after it has appeared; every handwritten note holds its words × 0.3 s
+ 1 s; nothing arrives while a caption is being revealed.

## Frame 1 · Intro (0–5.4)
status: animated · src: assets/shared/sting-b.html (B3/B5's, unchanged)
Blueprint: logo-assemble-lockup. The score's quiet piano opening under it.

## Frame 2 · Cold open: a tasteless screen (5.4–16.3)
Blueprint: prompt-type-submit-generate (the ask "Cancel my subscription" types in the composer and sends;
the answer assembles fast, one part per 16th). Rules: discrete-text-sequence (typing), part-by-part
assembly. Keyframes: stage B's camera, one slow sine push-in (s 1 → 1.4) over 10.5 s.
The screen: a real document, rendered, in the "loud" theme (three primary buttons, capitals, "Oops! Sad
to see you go 😢", an off-brand blue status chip, cramped spacing, square corners).
Registry: hw-callout-circle (tight wobble ellipse round the three primaries, no connector) + Caveat note
"3 primary buttons?" written on (clip-path write-on); hw-arrow (flipped, at the copy) + "we'd never say
that"; a hand scribble across the colour chip (svg-path-draw with hwStrokeApply/hwDrawOn) + "not our
blue"; hw-boil on every mark. Notes in the phone's right margin, one after another, each held.
Captions: caption-clip-wipe "AI can draw any screen." (8.38) → line-swap "But who gives it taste?" (12.43).
Sound: typing, the send tap, a UI pop per part, a pen-on-paper (page turn) per doodle.

## Frame 3 · The turn (16.15–20.9)
The screen tilts away and shrinks (stage B camera: rotateX 16°, rotateY −22°, s 0.36, power3.inOut) and
match-cuts to a sticky note on paper where the phone landed: "cancel screen / 3 primary buttons? /
"Oops!"? / not our blue". Blueprint: titlecard-reveal (paper, the note, the mark). Mark states: looking
(down at the note) → attention (at camera). Registry: hw-arrow sweeping right, to where the Studio window
slides in (stage A, decelerating from the right). Captions: caption-clip-wipe "Your designers do." on the
score's lift (16.88: the bass enters) → line-swap "In Studio.". Sound: airy whoosh on the tilt, a riser
into the lift, pen for the arrow, airy whoosh as the window arrives.

## Frame 4 · Bring your design system (20.9–30.9)
Real Studio: Import (a token file), Scan, Map to Polyxd's roles, the design system's roles with contrast.
Blueprint: agent-progress-theater (files land, counts climb, rows fill, pairs tick). Rules:
coordinate-target-zoom (stage A camera: dropzone → the scan's tier cards → the mapping's rows → the
contrast column, each move with the brand ease on a page change), multi-phase-camera.
File chips (npm package, Tokens Studio, DTCG, CSS variables) fly in on an arc and land one per beat.
Scan: "We found N tokens" and the tier counts count up over the still (counter patches in Young Serif),
the table uncovered top to bottom. Mapping: each row's token, swatches and Match fill in, one after
another. Contrast: six green hand ticks (svg-path-draw), one per 8th; a sticky "every pair measured".
Caption: line-swap "Bring your design system as it is." Sound: an airy pop per landing, clicks under the
count, a click per tick, pen for the note.

## Frame 5 · Tune it (30.9–40.9)
Real Studio: the tokens editor (the brand ramp turned to the generated screen's blue, unsaved), the
Rebrand dialog, its Hue slider swept 262° → 202° (31 captured states cut in sync, 2.5 s), Turn the ramp
→ the teal ramp with "Every pair passes contrast". Keyframes: push-in on the ramp, onto the dialog,
then to the contrast readout; pull-back to identity. Registry: hw-callout-circle on the readout + sticky
"still passes". The pull-back brings the phone in small on the left and the generated screen re-colours
(morph.js tokenMorph: every --pxd-* token interpolated, oklch hue included, loud → Harbourline; spacing
and corners relax with it). Caption: caption-clip-wipe "Tune it, and everything follows."
Sound: pop on the dialog, two synth sweeps under the slider, pen for the circle.

## Frame 6 · Decide what screens may use (40.9–48.9)
Real Studio: Components. Three switches turn off on the beat (Rating, ColorInput, CodeInput), each
with a hand-drawn press ring; Choice's drawer opens and its guidance types in ("Up to six options;
more goes in a list.", 14 captured states). Registry: hw-callout-circle round the field and Studio's own
help line ("Generators read this.") + sticky "the generator reads this". Keyframes: the table, then a
push onto the drawer. Caption: caption-clip-wipe "Decide what screens may use." Sound: a mechanical
double click per switch, pop, typing, pen.

## Frame 7 · Write the rules (48.9–58.9)
Real Studio: Rules (the empty state, New rule typed "One primary action per screen", its severity and
check), then the list with one, two, three rules (Sentence case: warning; Never say "Oops": error).
Each saved rule lifts off the list as a card and flies on an arc to the phone (small, left, stage B)
where it fixes its problem: hw-underline strike (double pass) on what breaks it, then the next real
rendered version cross-fades in (two primaries become secondary; capitals become sentence case;
"Oops! Sad to see you go 😢" becomes "Sorry to see you go."), and a hand tick lands beside it.
Keyframes: onto the drawer, onto the list, pull back. Captions (low, under the phone): caption-clip-wipe
"Write the rules in plain words." → line-swap "Every screen is checked against them."
Sound: tap on save, a swish for the flight, pen for the strike, a small chime per rule applied.

## Frame 8 · Author what shouldn't be generated (58.9–64.9)
Real Studio: the Screens editor on "Cancel your plan" (tree, preview, properties; selecting the primary
Action moves the preview's selection), then the Harbourline shell. The shell's regions (app bar,
navigation, main, outlet, footer) draw themselves in hairlines over a blank preview (svg rect
stroke-dashoffset), then the real preview fills in under them. Registry: hw-arrow (swoop) at the
navigation + sticky "the part that's always yours". Caption: caption-clip-wipe "Author the screens that
shouldn't be generated." Sound: pen under the hairlines, pen for the arrow.

## Frame 9 · Publish (64.9–70.9)
Real Studio: the screen's header, "Not published · Publish v1" → press → "v1 published · Unpublish"
(the score's full section arrives on this bar). Registry: hw-callout-circle stamped round the new status.
Blueprint: device-surface-showcase: the preview lifts off the page and flies to a laptop and a phone
(the published document, rendered in Harbourline's export), the fetch types under them
(`GET /api/w/harbourline/screens/cancel`), and export chips fan out (CSS variables, Tailwind theme,
Swift, Kotlin: formats Studio exports). Caption: caption-clip-wipe "Publish it. Your products fetch it."
Sound: click on the press, a swipe impact and a soft sub hit on Publish, whoosh for the flight, typing,
a pop per chip.

## Frame 10 · Payoff: the same ask again (70.9–78.9)
The product again, "Cancel my subscription" typed and sent; this time the screen that arrives is the
team's (one clear primary action, "Your plan ends on 30 October. You can come back any time.",
Harbourline's colours, calm spacing), part by part on the beat, under a push-in. The mark slides in
beside the phone; its pupil turns into the tick. Caption: caption-clip-wipe "Now the screen is yours."
Audio: the score's climax (cut in on the bar), the chime on the tick.

## Frame 11 · Outro (78.9–86.7)
status: animated · src: assets/shared/outro-b.html (B's), subtext "Polyxd Studio · studio.polyxd.com".
The score runs on into its own ending.

## Not shown (planned, per the story)
No reviews queue, no insights or analytics, no releases or rollouts, and no claim that Direction is
applied during generation: the components beat shows Studio's own words ("Generators read this.
Changes go out with the next release.") and the rules beat shows checks, which the verifier runs today.
