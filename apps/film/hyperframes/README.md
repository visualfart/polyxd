# The launch films, in HyperFrames

One film per script option in [`../SCRIPT-OPTIONS.md`](../SCRIPT-OPTIONS.md), each a HyperFrames project
(HTML compositions rendered by the `hyperframes` CLI). 1920×1080, 30 fps, H.264 + AAC.

| Film | Project | Length | Music |
|---|---|---|---|
| A · The ask | `film-a-the-ask/` | 50.0 s | Apple Loops "Longing", 82 bpm |
| B · Show, don't tell (recommended) | `film-b-show-dont-tell/` | 52.0 s | Apple Loops "Rise Up", 81 bpm |
| C · How it works | `film-c-how-it-works/` | 48.0 s | Apple Loops "Yearning", 70 bpm |

Each opens with the same 2.8 s logo sting and closes with the same 4.2 s end card.

## Render

Needs Node 22+, ffmpeg, and this Mac's Apple Loops (for the music).

```sh
# 1. The music, arranged to each film's timings -> film-*/assets/music.wav
node apps/film/scripts/music-hf.ts

# 2. Everything the projects share -> film-*/assets/ (renderer build, mark, kit, sting, end card, sfx, fonts)
node apps/film/hyperframes/sync.mjs

# 3. Check and render each film
cd apps/film/hyperframes/film-b-show-dont-tell
npx hyperframes check
npx hyperframes render --quality delivery --output ../../out/hyperframes/polyxd-b-show-dont-tell.mp4
```

Renders take about 25 s each. `npx hyperframes preview` opens a film in Studio;
`npx hyperframes snapshot --at 10,20,30` saves frames to look at.

`assets/` is ignored by git (`apps/film/.gitignore`), so steps 1 and 2 are needed after a fresh clone.
`sync.mjs` expects `apps/film/assets/sfx/` (from `scripts/sound.ts`) and `apps/film/assets/fonts/`
(Young Serif and DM Mono, OFL; Hanken Grotesk's latin variable font from Google Fonts). If the
renderer changes, rebuild its browser bundle first: `node packages/web/scripts/build-preview.ts`.

## Output

`apps/film/out/hyperframes/` (ignored by git):

- `polyxd-a-the-ask.mp4`, `polyxd-b-show-dont-tell.mp4`, `polyxd-c-how-it-works.mp4`
- `polyxd-*-sheet.png`: a contact sheet per film
- `stills/`: three full-size frames per film

## How it is built

- **The screens are the real renderer.** `@polyxd/web`'s browser build (`packages/web/preview/polyxd-web.js`
  and its stylesheet with every theme) is loaded into each film and `PolyxdWeb.mount` draws the
  documents inside the phone, in material3 (Halden), carbon (Ledger), polaris (Tidings), shadcn
  (Fernly) and govuk (Wexley Council). They are mounted once while the page loads; the timeline only
  fades their parts in, so every frame is a function of time and renders the same every time.
- **Documents.** The spec's `money-send-form.json` with its button saying "Send £40.00" and without
  the fee receipt (so the whole form fits the phone under the question); the film's own
  `return-shoes.json` and `new-address.json`. Copies live in `shared/kit.js`.
- **The mark** (`shared/mark.js`) uses the paths of `brand/chosen-mark.svg`; only the pupil moves.
  States and timings follow `brand/BRAND-2026.md`: idle, reading, looking, attention, thinking
  (orbit r 1.1, 1.6 s a turn), blink (the 5.2 × 1.6 bar, 280 ms), checked (the tick), asleep, all on
  cubic-bezier(0.2, 0, 0, 1). The mark sits beside the phone: it reads while the question is typed,
  thinks before the screen is made, looks at the screen as it arrives, blinks when the action is
  done, and turns into the tick at the end.
- **Sting and end card** are sub-compositions (`shared/sting.html`, `shared/end-card.html`); the end
  card's address line is a variable (`polyxd.com`, or `polyxd.com · open source` in C).
- **Pace.** One thing moves at a time: the phone arrives, then the pupil moves, then the words.
  A caption never arrives while anything else is moving, and scene changes are a fade out to paper
  followed by a fade in. Each film's `T` table at the top of its script holds every time.
- **Sound.** `scripts/music-hf.ts` arranges the Apple Loops: piano (with a quiet bed) under the
  problem, a lift when the screen appears, fuller for the rest, one chord left ringing under the
  logo; mastered to -16 LUFS. Sound effects: a soft tap on Send, a tick on the check, and a very
  quiet blink. The rendered films measure -16.0 / -16.1 / -16.2 LUFS integrated, true peak
  -1.8 / -1.3 / -1.3 dBTP.

## Film B, second pass: three versions (`film-b1-*`, `film-b2-*`, `film-b3-*`)

The owner chose option B and asked for: a more crafted intro, a logo outro, real morphs between
design systems (in several versions), a better call to action on the phone, and a montage of what
else Polyxd can draw. `film-b-show-dont-tell/` is the first pass, kept as it was.

| Version | Project | Length | How one design system becomes another |
|---|---|---|---|
| B1 | `film-b1-token-morph/` | 73.8 s | **Token interpolation.** One live screen; every `--pxd-*` design token (colours, radii, spacing, type sizes and weights, borders) is interpolated from one pack's value to the next and the real renderer re-lays the screen out each frame. The send-money screen passes shadcn → Material 3 → Carbon → Polaris → GOV.UK (the app bar renames itself Fernly → Halden → Ledger → Tidings → Wexley Council); where the document changes (return form → send form → address form) only the conversation's content leaves and arrives, the chrome stays. |
| B2 | `film-b2-shared-morph/` | 69.0 s | **Shared-element morph** between different apps' screens (Fernly/shadcn return form → Halden/Material 3 send form → Wexley/GOV.UK address form). Paired parts travel and reshape into their counterparts: the screen, app bar, app icon, question bubble, surface, action bar and primary button are drawn by a morph layer whose rect, colour, corner radius and border interpolate; the title, labels, status bar and fields travel along the same path (FLIP) and hand over; parts only one screen has fade out early or in late. |
| B3 | `film-b3-combined/` | 69.0 s | Both: shared-element morph Fernly → Halden, a token morph of the same send screen Material 3 → Carbon → Polaris, then a shared-element morph into Wexley's GOV.UK address form. |

All three share: a new intro sting (`shared/sting-b.html`: on the first hit the p is built one shape at
a time, bowl, stem, window; the pupil drops in, reads, looks, blinks; the mark moves aside and the
wordmark settles), a new outro (`shared/outro-b.html`: the mark returns alone, its pupil turns into
the tick and opens again, the mark moves aside for the wordmark and polyxd.com, a last blink on the
final hit, then it holds), the docked call to action (full width, 50 px, sticky at the bottom above
the home indicator, a press that dips and darkens under a soft finger mark; checked in shadcn,
Material 3, Carbon, Polaris and GOV.UK), and a 12 s montage cut on the beat (1.2 s a screen, hard
cuts, one caption): Halden budgets (Material 3), Quay "why sales dropped" (Polaris), Wexley bins
(GOV.UK), Foundry account overview (shadcn), order status (Fluent), compare plans (Carbon), find a
time (Primer), CRM account (Ant Design), trip overview (Spectrum), storage (Mantine), all drawn live
by the renderer from `apps/demos/*/authored|intents/*.json` and `packages/spec/examples/*.json`
(`montage.mjs`).

### Build and render

```sh
node apps/film/hyperframes/make-b.mjs          # writes film-b1/2/3: index.html from shared/film-b-timings.json,
                                               # assets, montage documents, and the sound effects (media-use)
cd apps/film/hyperframes/film-b2-shared-morph
npx hyperframes check
npx hyperframes render --quality delivery --output ../../out/hyperframes/polyxd-b2-shared-morph.mp4
```

Timings for all three versions live in `shared/film-b-timings.json`; the code in `shared/film-b.js`
(the film), `shared/morph.js` (the two morph mechanisms) and `shared/film-b.css` (docked CTA,
home indicator, desktop window, morph layer). Edit those and run `make-b.mjs` again; the
`index.html` files are generated.

### Sound

The mix is built with the HyperFrames audio engine: two buses (`<hf-audio-group>` "Music" and "Sound
design"), each with a 30 Hz high-pass and a −2 dB limiter; the score, when present, has a volume lane
that dips it under the sting's hit, the reveal and the final chord.

**Music is not in these renders yet.** The owner asked for a produced score through media-use rather
than Apple Loops. media-use's music routes need one of: a HeyGen sign-in (catalogue retrieval,
10k+ licensed tracks), a Gemini key (Lyria generation), or local MusicGen (needs ~300 MB of Python
packages and model weights, and the model is licensed CC-BY-NC, so not cleared for a commercial
launch film). None is set up on this machine and signing in is the owner's step:

```sh
npx hyperframes auth login          # browser sign-in to HeyGen (free-usage path), writes ~/.heygen
# or install the HeyGen CLI (developers.heygen.com/cli), then: heygen auth login --oauth
```

Then, for each version, resolve a score and rebuild:

```sh
cd apps/film/hyperframes/film-b2-shared-morph
npx hyperframes media-use resolve --type bgm --intent "cinematic confident modern, steady pulse, building strings, hit and lift, driving, big resolving final chord, no vocals, 100-120 bpm" --project .
cp .media/audio/bgm/bgm_001.* assets/music.mp3       # (the resolved file)
npx hyperframes beats . --json                        # read the score's beat grid; adjust shared/film-b-timings.json so the hits land on it
node ../make-b.mjs b2 && npx hyperframes render --quality delivery --output ../../out/hyperframes/polyxd-b2-shared-morph.mp4
```

`make-b.mjs` places `assets/music.mp3` (or `.wav`) automatically when it exists and lowers the sound
design bus to 0.7 under it.

### Credits (film B versions)

Sound effects, resolved through media-use's bundled library (`npx hyperframes media-use resolve
--type sfx`, recorded in each project's `.media/manifest.jsonl`), all from Pixabay under the Pixabay
Content License (free for commercial use, no attribution required):

| Effect | Used for |
|---|---|
| whoosh-short | into the sting's first hit; each shared or content morph; the montage's end |
| impact-bass-1 | the sting's first hit (low, tonal); the montage's first cut |
| chime | the wordmark settling in the sting; the final resolve |
| typing | the question being typed |
| click-soft | sending; each montage cut (very quiet) |
| riser | the build into the reveal |
| impact-bass-2 | the reveal (the answer becomes a screen); the outro's final hit |
| sparkle | the reveal; each token morph |
| click | the tap on the docked button |
| pop | the toast |
| ping | the check (the pupil becomes a tick), in the film and in the outro |
| whoosh-cinematic | the sweep into the montage |

Music: none yet (see above). Fonts: Young Serif and DM Mono (SIL OFL), Hanken Grotesk (SIL OFL, from
Google Fonts).

### Output (film B versions)

`apps/film/out/hyperframes/`: `polyxd-b1-token-morph.mp4` (73.8 s), `polyxd-b2-shared-morph.mp4`
(69.0 s), `polyxd-b3-combined.mp4` (69.0 s), a `*-sheet.png` contact sheet each, and six stills
each in `stills/`.

## Film B4: "Can I return these shoes?" (`film-b4-return-the-shoes/`)

The story in `STORY-B4.md`, directed as a motion-designed film: a virtual camera (macro, pull-back
reveal, push-ins, punch-ins, a 3D tilt settling flat, whip pans), hand-drawn doodles from the
HyperFrames registry (`hw-callout-circle`, `hw-arrow`, `hw-underline`, `hw-boil`, installed with
`hyperframes add` into `film-b4-return-the-shoes/compositions/components/`, helpers copied into
`shared/hw-kit.js`), captions revealed per word (`caption-clip-wipe`) or through a line mask
(`line-swap`), B3's intro, outro and morphs, and a score with sound design from the HeyGen audio
catalogue. 66.2 s. Scene-by-scene notes with the skills and techniques used: `film-b4-return-the-shoes/STORYBOARD.md`.

```sh
node apps/film/hyperframes/music-b4.mjs    # the score, edited on its bars to the story
node apps/film/hyperframes/make-b4.mjs     # index.html, assets, sound cues (from shared/film-b4-timings.json)
cd apps/film/hyperframes/film-b4-return-the-shoes
npx hyperframes check
npx hyperframes render --quality delivery --output ../../out/hyperframes/polyxd-b4-return-the-shoes.mp4
```

Output: `apps/film/out/hyperframes/polyxd-b4-return-the-shoes.mp4` (66.2 s, −14.1 LUFS, −1.4 dBTP),
`polyxd-b4-return-the-shoes-sheet.png`, ten stills in `stills/`.

### Credits (film B4)

All retrieved from the **HeyGen audio catalogue** through media-use's HeyGen route
(`/v3/audio/sounds`, the owner's signed-in HeyGen account), then frozen into the project with
`npx hyperframes media-use resolve --from …` (`.media/manifest.jsonl`). They are used under the
HeyGen account's terms for catalogue audio; the catalogue does not attach a per-item licence
string, so confirm commercial use in the HeyGen account terms before publishing.

| Use | Item (catalogue id) | Name |
|---|---|---|
| Score (edited: `music-b4.mjs`) | 789f931a… | "Astral Generated Music: 789f931a" — inspiring sophisticated instrumental, cinematic build, modern corporate (120 bpm, 95 s) |
| Whip pans, sting | 00caa739… | Quick Whoosh |
| The reveal, the montage | 128d8419… | Cinematic Sub Bass Hit |
| Send, tap, montage cuts | 19bd1766… | Soft muted tap |
| The crumple | 25bf9c03… | Paper crumple |
| Parts arriving | 4558aa13… | UI Pop |
| Punch-ins, push-ins | 72d0b143… | Fast whoosh |
| The swap's sparkle, token blends | 7a885578… | Ascending chime sparkle |
| Doodles drawing, scribbles | 9b77ef76… | Page turn |
| The paper ball flying off, montage end | a4855a82… | Fast airy whoosh |
| Typing | e401e115… | Keyboard Typing |
| Step counter, check ticks | e7945ed1… | Sharp click |
| The toast, the mark's check | ef870618… | Bright electronic chime |
| Into the reveal | f6995a68… | Deep whoosh riser |

Fonts: Young Serif, DM Mono, Hanken Grotesk (SIL OFL); Caveat (SIL OFL, installed by the registry).

## Film B5 (`film-b5-return-the-shoes/`)

B4 re-paced so every line can be read (rule: words × 0.3 s + 1 s after appearing; captions ≥ 2.5 s),
with a new beat that answers "whose design?": the 13 design systems' logos and the 12 Polyxd
templates, one per 8th of the score, each re-theming the phone's screen through the real renderer.
78.2 s. What changed: `film-b5-return-the-shoes/STORYBOARD.md`.

```sh
node apps/film/hyperframes/music-b5.mjs    # the same score, re-cut on its bars for B5
node apps/film/hyperframes/make-b5.mjs     # index.html, assets (incl. logos from packages/ds-*/logo.svg), sound cues
cd apps/film/hyperframes/film-b5-return-the-shoes && npx hyperframes check && \
  npx hyperframes render --quality delivery --output ../../out/hyperframes/polyxd-b5-return-the-shoes.mp4
```

Output: `apps/film/out/hyperframes/polyxd-b5-return-the-shoes.mp4` (78.2 s, −14.2 LUFS, −1.4 dBTP),
`polyxd-b5-return-the-shoes-sheet.png`, ten stills in `stills/`. No new catalogue items: the score
and every sound effect are B4's (see B4's credits). The logos are the design systems' own marks as
shipped in `packages/ds-*/logo.svg` (their owners' trademarks); GOV.UK is shown as words only.

## Film S: "Who gives AI taste?" (`film-s-who-gives-ai-taste/`)

The Studio film, from `STORY-STUDIO.md`, made the way B5 was: an assistant draws a cancel screen
nobody on the team would ship (three primaries, "Oops!", the wrong blue); the designers give it taste
in Studio (import, tune, components, rules, author, publish); the same ask comes back and the screen
is theirs. 86.7 s including B's intro sting and outro (subtext "Polyxd Studio · studio.polyxd.com").
Scene-by-scene notes with the skills and techniques used: `film-s-who-gives-ai-taste/STORYBOARD.md`.

Studio's screens are the real Studio. `film-s-capture.mjs` seeds a throwaway local Studio the way
`apps/studio/scripts/landing-shots.ts` does (a local test account with a random password, through
the app's own API; nothing real is touched), adds the film's screen ("Cancel your plan", key
`cancel`) and three rules, then captures every state at 2× with the boxes the camera and doodles aim
at. The product screens are the real renderer; the team's screen is the document Studio publishes,
drawn with Harbourline's CSS export. New code is film-s only (`shared/film-s.js`, `shared/film-s.css`,
`shared/film-s-timings.json`, `make-s.mjs`, `music-s.mjs`, `film-s-capture.mjs`); everything else
is B4/B5's machinery, unchanged.

```sh
# a local Studio with a database of its own (in apps/studio):
npx wrangler d1 migrations apply studio-dev --local --persist-to <dir>
npm run build -w @polyxd/studio && npx wrangler dev --persist-to <dir> --port 8789
node apps/film/hyperframes/film-s-capture.mjs      # Studio's screens → film-s-who-gives-ai-taste/assets/studio/
# (stop the dev server)
node apps/film/hyperframes/music-s.mjs             # the score, cut on its bars
node apps/film/hyperframes/make-s.mjs              # index.html, themes, crops, sound cues
cd apps/film/hyperframes/film-s-who-gives-ai-taste && npx hyperframes check && \
  npx hyperframes render --quality delivery --output ../../out/hyperframes/polyxd-s-who-gives-ai-taste.mp4
ffmpeg -i ../../out/hyperframes/polyxd-s-who-gives-ai-taste.mp4 -c:v libx264 -crf 24 -preset slow \
  -pix_fmt yuv420p -c:a copy -movflags +faststart ../../out/hyperframes/polyxd-s-who-gives-ai-taste-share.mp4
```

Output: `apps/film/out/hyperframes/polyxd-s-who-gives-ai-taste.mp4` (86.7 s, 41 MB, −14.2 LUFS,
−1.7 dBTP), `polyxd-s-who-gives-ai-taste-share.mp4` (CRF 24, 9.8 MB),
`polyxd-s-who-gives-ai-taste-sheet.png`, ten stills in `stills/`.

### Credits (film S)

From the **HeyGen audio catalogue** through media-use's HeyGen route (the owner's signed-in account),
frozen into the project with `npx hyperframes media-use resolve --from …` (`.media/manifest.jsonl`,
git-ignored; re-download by id). Used under the HeyGen account's terms for catalogue audio; the
catalogue attaches no per-item licence string, so confirm commercial use in the account terms.

| Use | Item (catalogue id) | Name |
|---|---|---|
| Score (cut: `music-s.mjs`) | 78398bc2… | "Astral Generated Music: 78398bc2" — elegant cinematic corporate build with rhythmic confidence and premium strings (120 bpm, 160 s) |
| Sting, the flight to the devices, into the payoff | 00caa739… | Quick Whoosh |
| Publish (soft, under the impact) | 128d8419… | Cinematic Sub Bass Hit |
| Send, saving a rule | 19bd1766… | Soft muted tap |
| Parts arriving, dialogs, export chips | 4558aa13… | UI Pop |
| Camera moves, rule flights | 72d0b143… | Fast whoosh |
| Pen on paper: every doodle, the hairlines | 9b77ef76… | Page turn |
| The tilt, the Studio window arriving | a4855a82… | Fast airy whoosh |
| Typing (the ask, guidance, a rule, the fetch) | e401e115… | Keyboard Typing |
| Scan count, contrast ticks, the Publish press | e7945ed1… | Sharp click |
| The mark's check | ef870618… | Bright electronic chime |
| Into the turn | f6995a68… | Deep whoosh riser |
| Component switches | ee5e8476… | Mechanical double click (new) |
| A rule applied | f6601811… | High pitched chime (new) |
| The rebrand slider | f21dfc94… | Short synth whoosh (new) |
| Publish | 8639f575… | Quick Swipe Impact (new) |
| File chips landing | d9b59db7… | Airy pop (new) |

Fonts: Young Serif, DM Mono, Hanken Grotesk (SIL OFL); Caveat (SIL OFL, installed by the registry).
