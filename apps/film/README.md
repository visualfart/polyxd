# The launch film

Seventy-two seconds, 1920×1080 at 30fps, silent: the mark blinks, the line lands, and the four demo
products, the gallery and Studio are used on camera. Built with [Remotion](https://www.remotion.dev)
from clips captured off the running dev servers with Playwright, so re-capturing after a product
changes and re-rendering is one command each.

```
apps/film/
  scripts/capture.ts   drives the products and Studio, records clips and stills into assets/
  scripts/render.ts    renders out/polyxd-launch.mp4, the square cut, the poster and check frames
  src/script.ts        the words and their timing; also written out as captions.srt
  src/Film.tsx         the scenes, wide and square, from one timeline
  src/brand.tsx        the mark (from brand/build.ts's definition) with its animated states, the wordmark
  src/ui.tsx           captions, act titles, phone and window frames, the skeleton, easing
  assets/              captured clips and stills (git-ignored)
  out/                 renders (git-ignored except poster.png)
```

## Scenes

| Time | Act | On screen |
|---|---|---|
| 0–4s | | The mark on paper: idle, one blink, idle; the wordmark settles beside it |
| 4–10s | | "Interfaces that show up when you need them." one line at a time |
| 10–22s | Ask. | Halden on a phone: the ask typed, the skeleton, the Send money form, the confirmation, sent |
| 22–32s | Any design system. | One document through Material 3, Carbon, Polaris, GOV.UK, shadcn, slowing on Sketch and Wireframe; then the four products' home screens |
| 32–44s | People and agents. / Verified. | Foundry, dark: ⌘K, the ask, the filter narrowing live; the Checked mark and its report |
| 44–56s | Generated or authored. | Studio's Screens editor making a screen from an example; Wexley's address-change wizard |
| 56–66s | Yours. | Quay: "why did sales drop last week" |
| 66–72s | | The mark and wordmark, polyxd.com, Apache-2.0; the mark goes to "checked" last |

## Re-capture the assets

The dev servers must be up: demos on http://localhost:5174, the gallery on http://localhost:5183
(`npx vite --port 5183` in `apps/gallery`, or set `GALLERY`), Studio on http://localhost:8789
(`.claude/launch.json` has all three). Then:

```sh
npm run capture -w @polyxd/film              # everything
node scripts/capture.ts foundry studio       # some: halden-send halden-spend foundry quay wexley studio gallery homes
```

Clips are recorded by screenshotting the page at 2× about twenty times a second while the script
works the product, then assembling the frames at 30fps with ffmpeg (a headless screencast is
captured at CSS pixels whatever the device scale factor, which is why `recordVideo` isn't used).
Each clip gets a `.log` of its beats with their times, which is where the trims in `Film.tsx` come
from. The cursor is drawn by a script the capture injects; movements are deliberate: move, pause, click.

Studio needs an account: the script signs in as a throwaway local user (see `STUDIO_ACCOUNT`),
creating it and a "Harbourline" workspace on the first run. Locally no email goes out, so it works
at once. Sign-in details for Foundry and Wexley are the demos' own (any email works).

## Render

```sh
npm run render -w @polyxd/film               # both cuts, the poster, eight check frames
node scripts/render.ts --wide                # only out/polyxd-launch.mp4
node scripts/render.ts --square              # only out/polyxd-launch-square.mp4
npm run preview -w @polyxd/film              # Remotion Studio, to scrub the timeline
```

Output: `out/polyxd-launch.mp4` (H.264, yuv420p, CRF 18), `out/polyxd-launch-square.mp4`
(1080×1080, the same scenes re-framed), `out/poster.png` (the headline, 9s in), `out/frames/*.png`
(one frame per act, to check by eye), and `captions.srt` beside this README.

Needs ffmpeg at `/opt/homebrew/bin/ffmpeg` (or `FFMPEG=…`). Remotion downloads its own headless
Chrome on first render. Fonts (Bricolage Grotesque, Geist) come from Google Fonts at render time.

## Changing the words

Everything said on screen is in `src/script.ts` with its in and out times; the scenes read it by id,
and `render` writes it to `captions.srt`. There is no music track; the timing is meant to read without
one, and the SRT is there for subtitles or a voice-over later.
