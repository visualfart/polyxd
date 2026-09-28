---
workflow: general-video
flow: automation
storyboard: yes
message: "AI can draw any screen; your designers give it taste, in Studio."
destination: website (studio.polyxd.com), social
aspect: 1920x1080
language: en
audience: "design-system teams and design leads who have never used Polyxd Studio"
length: "about 75-80 s, plus B's intro and outro"
---

## Intent

The story in `../STORY-STUDIO.md`, made the way B5 was: a story with a start, a middle and an end,
hand-drawn doodles that arrive, point and leave, a camera that works the interface, captions that hold
long enough to read twice, and its own score.

## Constraints

- Studio's UI is the real Studio, captured from a local seeded instance (`../film-s-capture.mjs`):
  a throwaway database, a test account with a random password, created through the app's own API.
- Only what exists today. Not shown: reviews, insights or analytics, releases, rollouts, Direction
  applied during generation.
- Product screens are the real renderer (`polyxd-web`).
- Score and sound effects from the HeyGen audio catalogue; mix −14 LUFS integrated, true peak ≤ −1 dBTP.

## Assets

- `assets/studio/` — Studio's screens (`*.png`, 3200×2000), `boxes.json`, `cancel.json` (the published
  screen as a product fetches it), `harbourline.css` (Studio's CSS export of Harbourline), `crop/` (the
  parts that change in the typed and swept sequences, cut by make-s.mjs).
- `assets/themes.css` — Harbourline's export and the generated screen's loud version of it (make-s.mjs).
- `assets/music.wav` — the score, cut by `../music-s.mjs` from `.media/audio/bgm/bgm_001.wav`.
- `.media/` — catalogue audio frozen by `hyperframes media-use resolve` (manifest.jsonl).
