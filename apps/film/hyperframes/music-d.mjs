/**
 * Film D's score: HeyGen audio catalogue caac63aa… ("modern upbeat tech background music, punchy but
 * clean", 120 bpm, 179 s), re-cut on its bars for the film (shared/film-d-timings.json). Film ← track:
 *
 *   0.00–16.62   ←   1.50–18.12   pads under the sting; the kick enters with the first note (6.62);
 *                                 the lift under the pile and the pull-back (14.62)
 *   16.62–22.62  ← 106.12–112.12  the breakdown and its riser (the turn)
 *   22.62–54.62  ← 112.12–144.12  the drop on the hit: the document, one component, your code, the checks
 *   54.62–62.62  ← 128.12–136.12  one phrase again (the matrix, the agent)
 *   62.62–97.50  ← 144.12–179.00  your design system, the web component, the payoff; the last section
 *                                 swells into the stop at 176.12 = film 94.62 (the outro's blink)
 *
 *   node apps/film/hyperframes/music-d.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SRC = here("film-d-ship-the-screen/.media/audio/bgm/bgm_001.wav");
const OUT = here("film-d-ship-the-screen/assets/music.wav");
const EDIT = [
  [1.5, 18.12],
  [106.12, 112.12],
  [112.12, 144.12],
  [128.12, 136.12],
  [144.12, 179.0],
];
const F = 0.008;
const chains = EDIT.map(([a, b], i) => {
  const d = b - a;
  const first = i === 0, last = i === EDIT.length - 1;
  return `[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=${first ? 0.12 : F},afade=t=out:st=${(d - (last ? 1.2 : F)).toFixed(3)}:d=${last ? 1.2 : F}[s${i}]`;
});
const graph = `${chains.join(";")};${EDIT.map((_, i) => `[s${i}]`).join("")}concat=n=${EDIT.length}:v=0:a=1[c]`;
const tmp = OUT.replace(".wav", ".raw.wav");
execFileSync("mkdir", ["-p", OUT.slice(0, OUT.lastIndexOf("/"))]);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", SRC, "-filter_complex", graph, "-map", "[c]", "-ar", "48000", tmp]);
const loud = (f) => parseFloat(execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${f}" -af ebur128 -f null - 2>&1 | sed -n '/Summary/,$p' | grep ' I:'`], { encoding: "utf8" }).split("I:")[1]);
const g = -11.8 - loud(tmp);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", tmp, "-af", `volume=${g.toFixed(2)}dB,alimiter=limit=0.6:level=false:attack=1:release=60`, "-c:a", "pcm_s16le", OUT]);
execFileSync("rm", [tmp]);
const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUT], { encoding: "utf8" }));
console.log(`wrote ${OUT} (${dur.toFixed(2)} s, ${loud(OUT)} LUFS)`);
