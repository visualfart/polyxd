/**
 * Film D2's score: "Stylish Deep Electronic" by nveravetyanmusic (supplied by the owner; the file name
 * says Pixabay, id 262632), 105 bpm, 96 s, frozen into the project with media-use
 * (.media/audio/bgm/bgm_002.mp3). `npx hyperframes beats` finds its grid at 0.093 + n × 0.2857 s; bars
 * of 2.2857 s from 0.093. Sections (measured): pads to 9.24, the kick and bass from 9.24, a big impact
 * bar at 45.81, the breakdown 49.3–54.9, the drop at 54.95, the final hit at 91.52 ringing to 96.
 *
 * Re-cut on its bars (film ← track):
 *
 *   0.000–16.000  ←   2.379–18.379  pads under the sting (its first accent, 2.95, is the ASCII hit
 *                                   at 0.57); the kick enters with the first issue (6.86)
 *  16.000–25.143  ←  45.807–54.950  the impact bar as the list dims, then the breakdown under the turn
 *  25.143–59.429  ←  54.950–89.236  the drop on the hit: describe, style, wire
 *  59.429–73.143  ←  34.379–48.093  groove into the impact bar again: wire it, trust it, then the impact
 *                                   lands on the payoff's flight home (70.857)
 *  73.143–91.336  ←  77.807–96.000  the board clears; the final hit (91.52) is the outro's blink (86.857)
 *
 *   node apps/film/hyperframes/music-d2.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SRC = here("film-d2-where-is-my-order/.media/audio/bgm/bgm_002.mp3");
const OUT = here("film-d2-where-is-my-order/assets/music.wav");
const B = (n) => +(0.093 + n * (240 / 105)).toFixed(4); // bar n's downbeat in the track
const EDIT = [
  [B(1), B(8)],
  [B(20), B(24)],
  [B(24), B(39)],
  [B(15), B(21)],
  [B(34), 96.0],
];
const F = 0.01;
const chains = EDIT.map(([a, b], i) => {
  const d = b - a;
  const first = i === 0, last = i === EDIT.length - 1;
  return `[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=${first ? 0.12 : F},afade=t=out:st=${(d - (last ? 0.6 : F)).toFixed(3)}:d=${last ? 0.6 : F}[s${i}]`;
});
const graph = `${chains.join(";")};${EDIT.map((_, i) => `[s${i}]`).join("")}concat=n=${EDIT.length}:v=0:a=1[c]`;
const tmp = OUT.replace(".wav", ".raw.wav");
execFileSync("mkdir", ["-p", OUT.slice(0, OUT.lastIndexOf("/"))]);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", SRC, "-filter_complex", graph, "-map", "[c]", "-ar", "48000", tmp]);
const loud = (f) => parseFloat(execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${f}" -af ebur128 -f null - 2>&1 | sed -n '/Summary/,$p' | grep ' I:'`], { encoding: "utf8" }).split("I:")[1]);
const g = -11.8 - loud(tmp); // with the buses in make-d2.mjs this measured −14.1 LUFS integrated, −1.1 dBTP in a full render
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", tmp, "-af", `volume=${g.toFixed(2)}dB,alimiter=limit=0.6:level=false:attack=1:release=60`, "-c:a", "pcm_s16le", OUT]);
execFileSync("rm", [tmp]);
const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUT], { encoding: "utf8" }));
let film = 0;
for (const [a, b] of EDIT) {
  console.log(`  film ${film.toFixed(3)}–${(film + b - a).toFixed(3)} ← track ${a}–${b}`);
  film += b - a;
}
console.log(`wrote ${OUT} (${dur.toFixed(2)} s, ${loud(OUT)} LUFS)`);
