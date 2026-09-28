/**
 * Film B5's score: the same catalogue track as B4 (HeyGen audio catalogue 789f931a…, 120 bpm),
 * re-cut on its bars for B5's longer opening and the design-system beat. Film ← track:
 *
 *   0.00–8.62    ←  1.40–10.02   light opening (sting, the ask)
 *   8.62–14.62   ←  4.02–10.02   the same light bars again (the circle, the note, the answer begins)
 *   14.62–22.62  ← 10.02–18.02   the rest of the light section (the long answer, the doodles)
 *   22.62–28.62  ← 66.02–70.02   the breakdown, slowed to 1.5× its length (the turn)
 *   28.62–40.62  ← 70.02–82.02   the full section returns on the reveal's hit
 *   40.62–42.62  ← 16.02–18.02   the build bar before the lift (the tap, the toast)
 *   42.62–70.62  ← 18.02–46.02   the lift on the first whip; any app, the design systems, checked, the montage
 *   70.62–78.22  ← 82.02–89.62   the ending: drop, swell, final chord at 74.62
 *
 *   node apps/film/hyperframes/music-b5.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SRC = here("film-b5-return-the-shoes/.media/audio/bgm/bgm_001.wav");
const OUT = here("film-b5-return-the-shoes/assets/music.wav");
const EDIT = [
  [1.4, 10.02],
  [4.02, 10.02],
  [10.02, 18.02],
  [66.02, 70.02, 1.5],
  [70.02, 82.02],
  [16.02, 18.02],
  [18.02, 46.02],
  [82.02, 89.62],
];
const F = 0.008;
const chains = EDIT.map(([a, b, stretch], i) => {
  const d = (b - a) * (stretch || 1);
  const first = i === 0, last = i === EDIT.length - 1;
  const tempo = stretch ? `,atempo=${(1 / stretch).toFixed(6)}` : "";
  return `[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS${tempo},afade=t=in:d=${first ? 0.12 : F},afade=t=out:st=${(d - (last ? 1.4 : F)).toFixed(3)}:d=${last ? 1.4 : F}[s${i}]`;
});
const graph = `${chains.join(";")};${EDIT.map((_, i) => `[s${i}]`).join("")}concat=n=${EDIT.length}:v=0:a=1[c]`;
const tmp = OUT.replace(".wav", ".raw.wav");
execFileSync("mkdir", ["-p", OUT.slice(0, OUT.lastIndexOf("/"))]);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", SRC, "-filter_complex", graph, "-map", "[c]", "-ar", "48000", tmp]);
const loud = (f) => parseFloat(execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${f}" -af ebur128 -f null - 2>&1 | sed -n '/Summary/,$p' | grep ' I:'`], { encoding: "utf8" }).split("I:")[1]);
const g = -12.9 - loud(tmp);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", tmp, "-af", `volume=${g.toFixed(2)}dB,alimiter=limit=0.6:level=false:attack=1:release=60`, "-c:a", "pcm_s16le", OUT]);
execFileSync("rm", [tmp]);
const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUT], { encoding: "utf8" }));
console.log(`wrote ${OUT} (${dur.toFixed(2)} s, ${loud(OUT)} LUFS)`);
