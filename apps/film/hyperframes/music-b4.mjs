/**
 * Film B4's score: an edit of one catalogue track (HeyGen audio catalogue, "inspiring sophisticated
 * instrumental, cinematic build, modern corporate", id 789f931a…, 120 bpm, resolved through
 * media-use into film-b4-return-the-shoes/.media/audio/bgm/bgm_001.wav) cut on its bars to the
 * film's story:
 *
 *   film 0.00–16.62  ← track  1.40–18.02   the light opening section (sting, the ask, the paragraph)
 *   film 16.62–20.62 ← track 66.02–70.02   the track's breakdown: the score drops out (the turn)
 *   film 20.62–32.62 ← track 70.02–82.02   the full section comes back on the reveal's hit
 *   film 32.62–58.62 ← track 18.02–44.02   the track's big lift, on the whip pan into "any app"
 *   film 58.62–66.22 ← track 82.02–89.62   the ending: drop, swell, final chord at film 62.62
 *
 * Every cut is on a bar line (the track's bars start at 0.02 + 2k s), with 8 ms fades so nothing
 * clicks. The result is levelled to about −13.3 LUFS under a −4.4 dBFS ceiling; the film's mix (the sound design on top, then the
 * music bus limiter) lands at about −14.
 *
 *   node apps/film/hyperframes/music-b4.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SRC = here("film-b4-return-the-shoes/.media/audio/bgm/bgm_001.wav");
const OUT = here("film-b4-return-the-shoes/assets/music.wav");
export const EDIT = [
  [1.4, 18.02],
  [66.02, 70.02],
  [70.02, 82.02],
  [18.02, 44.02],
  [82.02, 89.62],
];
const F = 0.008;
const chains = EDIT.map(([a, b], i) => {
  const d = b - a;
  const first = i === 0, last = i === EDIT.length - 1;
  return `[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=${first ? 0.12 : F},afade=t=out:st=${(d - (last ? 1.4 : F)).toFixed(3)}:d=${last ? 1.4 : F}[s${i}]`;
});
const graph = `${chains.join(";")};${EDIT.map((_, i) => `[s${i}]`).join("")}concat=n=${EDIT.length}:v=0:a=1[c]`;
const tmp = OUT.replace(".wav", ".raw.wav");
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", SRC, "-filter_complex", graph, "-map", "[c]", "-ar", "48000", tmp]);
const loud = (f) => parseFloat(execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${f}" -af ebur128 -f null - 2>&1 | sed -n '/Summary/,$p' | grep ' I:'`], { encoding: "utf8" }).split("I:")[1]);
const g = -12.9 - loud(tmp);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", tmp, "-af", `volume=${g.toFixed(2)}dB,alimiter=limit=0.6:level=false:attack=1:release=60`, "-c:a", "pcm_s16le", OUT]);
execFileSync("rm", [tmp]);
console.log(`wrote ${OUT} (${EDIT.reduce((s, [a, b]) => s + b - a, 0).toFixed(2)} s, ${loud(OUT)} LUFS)`);
