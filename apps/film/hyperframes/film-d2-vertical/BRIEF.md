---
workflow: general-video
flow: automation
storyboard: no
message: "Every ask gets a screen."
destination: instagram-reels
aspect: 1080x1920
language: en
audience: "developers"
length: "about 91 s, same as the horizontal cut"
---

## Intent

Film D2 (`../film-d2-where-is-my-order/`, story `../STORY-DEV-2.md` plus the owner's changes in that
project's `BRIEF.md`) in 9:16 for Instagram Reels: the same story, the same timings
(`../shared/film-d2-timings.json`), the same score cut (`../music-d2.mjs`) and sound cues, recomposed for
portrait rather than letterboxed. The horizontal project is untouched; the vertical picture is its own
code (`../shared/film-d2v.js`, `../shared/film-d2v.css`), written by `../make-d2v.mjs`.

## Reels safe zone

Captions, the code lines that matter, counts, and the logo and address stay inside x 60–960, y 250–1500
(right 120 px: the like/comment/share rail; top ~250 px: the header; bottom ~420 px: caption, audio and
username). The ground and dot grid run full-bleed. A guide overlay is hidden by default: open the page
with `?guide` or build with `GUIDE=1 node make-d2v.mjs` to show it.

## Rules kept

Real renderer (each pack's dark mode), real code and terminal output (narrow terminals wrap as a narrow
terminal does; long commands use a shell line continuation), reading holds as in the horizontal cut, code
at 34 px or more on screen when it is read, nothing clipped by accident.
