# The launch film

Eighty-two seconds, 1920×1080 at 30 fps (and a 1080×1080 cut), with music and sound design. The
film is the one in [`SCRIPT.md`](SCRIPT.md): a hook, the line, the reversal on the mark, four proofs
shown rather than described, the turn, the close. Every product moment is real footage of the real
products, captured off the dev servers with Playwright; everything around it is a Remotion graphic
keyed to that footage (a pencil skeleton drawn from the form's measured geometry, the screen
unfolding into its JSON, a token swarm, a scan line, a 13 × 2 × 2 grid, an accessibility tree read
from the real DOM), and the pack flips are the real renderer, `PolyxdSurface` from `@polyxd/react`,
mounted in the composition with the packs' theme CSS. Remotion renders React, and the renderer is
React, so nothing there is a screenshot.

```
apps/film/
  SCRIPT.md            the brief: every scene with its timecode, what is on screen, what is heard
  scripts/capture.ts   drives the products and Studio: clips, stills, the form's geometry and ARIA tree, Foundry's shell regions
  scripts/sound.ts     composes assets/music.wav and every cue in assets/sfx/, in code, at 48 kHz
  scripts/render.ts    captions.srt, both cuts, out/mix.wav, the poster, twelve check frames, a 10 s listen-check
  scripts/stills.ts    single frames straight from the composition, to check a scene without a full render
  src/script.ts        the clock: every line on screen and every sound cue, in seconds
  src/Film.tsx         the timeline: eleven scenes on SCRIPT.md's timecodes, plus the mix
  src/scenes/          open (hook, the line, the reversal) · halden (the pencil, the unfold, the swarm) · checked (the scan, the grid, the split frame) · rest (the turn, Studio and the frame draw, the montage, the close)
  src/surface.tsx      the real renderer in the film: the spec's send-money document with Halden's payees, the thirteen packs, measuring
  src/audio.tsx        the mix: one music import, the cues placed from script.ts
  src/brand.tsx        the mark from brand/build.ts's definition, with its states animated; the wordmark
  src/ui.tsx           easing, kinetic type, captions, phone and window frames, the pointer
  assets/              captured clips, stills and measurements, the music and the SFX (git-ignored)
  out/                 renders (git-ignored except poster.png)
```

## Scenes

| Time | Scene | On screen |
|---|---|---|
| 0:00–0:03 | Hook | Five dead ends on five invented apps, 0.4 s each, a dry click on each; then a chat bubble typing "…" that never resolves |
| 0:03–0:07 | The line | "Every product has a screen for what you asked last year." typed at reading speed; "Nothing for what you're asking now." in the accent, a bass hit on "now" |
| 0:07–0:12 | The reversal | The lines fold away; the mark blinks, looks toward the ask box sliding in from the left; "send £40 to priya for dinner" typed live; Return |
| 0:12–0:18 | The screen arrives | Halden on a phone, real footage: a pencil skeleton drawn from the form's measured geometry snaps into the real form; Continue, the confirmation, Send £40.00, the snackbar; three lines on the beat |
| 0:18–0:30 | Meaning, not pixels | The screen lifts off and unfolds into JSON cards (type, id, one real prop, from the actual document) in a tree with hairlines; thirteen real `--pxd-*` tokens swarm in and the tree re-forms as the real renderer in Carbon, Polaris, GOV.UK, then faster shadcn, Fluent, Spectrum, then slow: Sketch (the whole frame wobbles, a handwritten label) and Wireframe |
| 0:30–0:40 | Checked | Snap back to Material 3; a scan line sweeps, ticks land beside each control; the frame multiplies into 52 real renders (13 packs × light/dark × phone/desktop) ticking in a wave; then the real Checked mark and its Report, in Foundry |
| 0:40–0:48 | People and agents | The real screen beside its accessibility tree (Playwright's ARIA snapshot of the real DOM); a pointer and a highlight move together: choose Priya, type 40, Continue; then the agent alone completes it by name in 1.2 s |
| 0:48–0:52 | The turn | Paper. "And the rest of the product?" |
| 0:52–1:04 | Generated or authored | Studio's Screens editor, a selection changing; then Foundry, dark: the shell's regions drawn in hairlines as a document (header · navigation · main · footer, from the real layout) and filled in as the real product; ⌘K, the ask |
| 1:04–1:12 | Yours | Quay "why did sales drop last week" · React · Wexley "I've moved" · Web Components · Foundry narrowing · your renderer · Halden's confirmation |
| 1:12–1:22 | Close | The mark, large, idle; a blink; the wordmark settles beside it; polyxd.com · Open source · Apache-2.0; the pupil becomes the tick, the last thing that moves; cut to black |

## Sound

`scripts/sound.ts` writes the whole soundtrack, so the film has no sample dependencies. The track
(`assets/music.wav`, 82 s, 48 kHz stereo, peak −12 dBFS) follows the script: a held low D from three
detuned saws through an opening low-pass; a kick-and-hat pulse at 96 bpm from 0:07; a pad on
Dmaj7 · Bm7 · Gmaj7 · A with a plucked arpeggio (Karplus–Strong, through a dotted-eighth ping-pong
delay) from 0:18; the pad alone, on the open A, from 0:48; the pulse back at 0:52; a single D chord
and a sine tick at 1:19; out by 1:22. The reverb is a convolution with a synthesised decaying-noise
impulse (FFT, overlap-add). The cues (`assets/sfx/*.wav`, each peaking at −18 dBFS) are synthesised
the same way: paper click, type click, arrive, pencil, woosh, paper flip, scan, tick cascade, tick,
UI click, ratchet, blink, bass hit, confirm, shimmer, fold, slide. `src/script.ts` places every cue
at its second; `src/audio.tsx` plays them under the one music import.

**To swap the music:** drop a `music.wav` into `assets/` (48 kHz, any length up to 82 s; the cues
and the film do not change) and render again. `scripts/sound.ts sfx` regenerates only the cues, so
the drop-in survives.

## Re-capture the footage

The dev servers must be up: demos on http://localhost:5174 and Studio on http://localhost:8789
(`.claude/launch.json` has both; the gallery is not needed, the pack flips are live). Then:

```sh
npm run capture -w @polyxd/film              # everything
node scripts/capture.ts halden studio        # some: halden foundry quay wexley studio
```

Clips are recorded by screenshotting the page at 2× about twenty times a second while the script
works the product, then assembling the frames at 30 fps with ffmpeg (a headless screencast is
captured at CSS pixels whatever the device scale factor, which is why `recordVideo` isn't used).
Each clip gets a `.log` of its beats with their times, which is where the trims in the scenes come
from. The cursor is drawn by a script the capture injects; movements are deliberate: move, pause,
click. The Halden take also writes `halden-form.png` (the still the pencil snaps into),
`halden-geometry.json` (every heading, label, option, input and button of the real form with its
box, for the pencil and the unfold) and `halden-a11y.json` (Playwright's ARIA snapshot of the form
and the confirmation, for the split frame); the Foundry take writes `foundry-frame.json` (the
shell's regions, for the frame draw).

Studio needs an account: the script signs in as a throwaway local user (see `STUDIO_ACCOUNT`),
creating it and a "Harbourline" workspace on the first run. Locally no email goes out, so it works
at once. Sign-in details for Foundry and Wexley are the demos' own (any email works).

## Render

```sh
node scripts/sound.ts                        # the music and the cues (once, or after changing them)
npm run render -w @polyxd/film               # both cuts, mix.wav, the poster, twelve check frames, the listen-check
node scripts/render.ts --wide                # only out/polyxd-launch.mp4 (and mix.wav, poster.png)
node scripts/render.ts --square              # only out/polyxd-launch-square.mp4
node scripts/stills.ts 12.8 27.9 --square    # single frames into out/check/, to look at a scene
npm run preview -w @polyxd/film              # Remotion Studio, to scrub the timeline
```

Output: `out/polyxd-launch.mp4` (H.264, yuv420p, CRF 18, AAC 192 kbps), `out/polyxd-launch-square.mp4`
(1080×1080, the same scenes re-framed, not letterboxed), `out/mix.wav` (the mixed sound alone),
`out/poster.png` (the phone and the three lines, 17 s in), `out/frames/*.png` (twelve frames across
the timeline, to check by eye), `out/frames/mix-7-17s.wav` (the ten seconds around the pulse's
entry, with its `astats` printed), and `captions.srt` beside this README.

Needs ffmpeg at `/opt/homebrew/bin/ffmpeg` (or `FFMPEG=…`). Remotion downloads its own headless
Chrome on first render. Fonts (Bricolage Grotesque, Geist, Geist Mono, Caveat, and the faces the
packs name: Roboto, IBM Plex Sans, Inter, Nunito, Patrick Hand, Source Sans 3) come from Google
Fonts at render time.

## Changing the words or the timing

Everything said on screen is in `src/script.ts` with its in and out times, kinetic type and
captions alike, and every sound cue with its second. The scenes read the lines by id, the mix reads
the cues, and `render` writes the lines out as `captions.srt`, so subtitles or a voice-over later
match what is on screen. The scene boundaries are `T` in the same file, straight from `SCRIPT.md`.
