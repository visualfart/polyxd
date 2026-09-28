---
format: 1920x1080
fps: 30
duration: 66.22
message: "The answer can be the screen: in any app, in its own design, checked."
music: "HeyGen catalogue 789f931a, 120 bpm, edited on its bars (music-b4.mjs)"
mode: autonomous
---

# Film B4 · "Can I return these shoes?"

Timings: `../shared/film-b4-timings.json`. Code: `../shared/film-b4.js`, `../shared/film-b4.css`,
`../shared/hw-kit.js` (the registry's hw family), `../shared/morph.js` (B3's morphs).
Beats sit on the score's 120 bpm grid (beats at x.12 / x.62); hits at 0.62, 20.62, 32.62, 50.62, 62.62.

## Frame 1 · Intro (0–5.4)
status: animated · src: assets/shared/sting-b.html (B3's, unchanged)
Blueprint: logo-assemble-lockup. Score's first hit lands on the bowl.

## Frame 2 · Cold open: the ask (5.62–10.6)
Blueprints: zoom-out-workspace-reveal (open tight on the composer, one decelerating pull-back
reveals the app) + prompt-type-submit-generate (the question types, sends).
Rules: viewport-change (the camera rig), discrete-text-sequence (typing). Keyframes: macro → pull-back
reveal, then a Ken Burns drift. Registry: hw-callout-circle (orange wobble ellipse around the
trainers, Caveat note "too small :(", boil), hw-boil.

## Frame 3 · The problem (10.62–16.62)
Blueprint: overwhelm-surround (accumulation under a slow push-in), transcript-scroll-artifact-reveal
(the long answer as evidence). Keyframes: slow sine push-in (s 1.03 → 1.42) as the text piles up.
Registry: hw-arrow (at "print the label we email you", follows the streaming text), hw-underline
(squiggle under "3 to 5 working days"; double-pass strike across the paragraph), hw-boil.
Hand-lettered step counter (clip-path write-on, discrete steps on the beat).
Captions: caption-clip-wipe (per-word) → line-swap (masked replacement "She got homework.").

## Frame 4 · The turn (16.62–20.62)
The paragraph and its strike ball up and fly off (scale, rotation, blur on an arc; paper crumple SFX).
Blueprint: titlecard-reveal (one calm card: the mark alone, one question). Mark states: reading, blink.
Caption: caption-clip-wipe. Audio: the score's breakdown, a low-pass closing over it (hyperframes-audio
automation on the music's lowpass) and a riser into the hit.

## Frame 5 · The reveal (20.62–32.62)
Blueprints: device-surface-showcase (3D tilt settling flat on the hit), camera-journey (dive to a
panel, travel to the consequence, pull back), cta-morph-press (the press, the toast).
Rules: coordinate-target-zoom (punch-in on "Too small", travel to "Swap for size 10"),
multi-phase-camera, grid/part assembly one per beat. Registry: hw-callout-circle ("it knew"),
hw-underline + a drawn sparkle (svg-path-draw), a big hand tick over the toast. Caption:
mask-reveal-up (line-swap mask). Docked CTA rises on the pull-back.

## Frame 6 · Any app, its own design (32.62–44.62)
Transitions: whip-pan-cut (registry component's mechanism on the camera: one power3.inOut travel,
directional blur capped at 16 px peaking mid-whip) ×2, each landing mid-morph.
Rules: card-morph-anchor / shared element (B2's shared-element morph: bar, bubble, title, fields,
button reshape), theme-crossfade-morph / fixed-anchor-cycle (B1's token blend: Material 3 → Carbon →
Polaris). Registry: hw-arrow + Caveat note "their colours, not ours"; hand-lettered pack names
written on then scribbled out (hw-underline strike). Captions: caption-clip-wipe, mask-reveal-up.

## Frame 7 · Checked (44.62–50.62)
Blueprint: agent-progress-theater (a scan passes, each control checks off). Keyframes: push-in on
the form, pull-back to make room for the mark. Hand ticks drawn per control (svg-path-draw) with
three notes; the mark slides in and its pupil becomes the tick. Caption: caption-clip-wipe.

## Frame 8 · Montage (50.62–58.12)
Blueprint: device-surface-showcase (showcase-carousel variant). Ten screens, 0.75 s each, hard cuts
on the beat, each arriving with its own move (push, tilt, slide, zoom-out reveal) plus a drift; fast
drawn doodles on four (ellipse via hwWobbleEllipse, sparkle). Caption: caption-clip-wipe.

## Frame 9 · Outro (58.42–66.22)
status: animated · src: assets/shared/outro-b.html (B3's, unchanged). Final blink on the score's
last chord (62.62).
