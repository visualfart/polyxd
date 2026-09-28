# The three launch films, in HyperFrames

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
