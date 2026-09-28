/**
 * Film S's score: HeyGen audio catalogue 78398bc2… ("elegant cinematic corporate build with rhythmic
 * confidence and premium strings", 160 s, 120 bpm, bar lines at 18.38 + 2.002·n), cut on its bars.
 * Film ← track:
 *
 *    0.00–64.88  ←   1.50–66.38   the quiet piano opening (sting, the tasteless screen), the bass
 *                                 entering on the turn (film 16.88 = track 18.38: "Your designers do."),
 *                                 then the build under Studio: import, tune, components, rules, author
 *   64.88–70.88  ←  80.44–86.44   the full section arrives on Publish
 *   70.88–86.68  ← 132.37–148.17  the climax for the payoff, running on into the track's own ending
 *                                 under the outro
 *
 * The opening is lifted (the track starts ~20 dB under its climax), then the whole cut is levelled
 * and pre-limited so the rendered film lands at −14 LUFS with the render's true-peak correction.
 *
 *   node apps/film/hyperframes/music-s.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SRC = here("film-s-who-gives-ai-taste/.media/audio/bgm/bgm_001.wav");
const OUT = here("film-s-who-gives-ai-taste/assets/music.wav");
const EDIT = [
  [1.5, 66.38],
  [80.44, 86.44],
  [132.37, 148.17],
];
const F = 0.008;
const chains = EDIT.map(([a, b], i) => {
  const d = b - a;
  const first = i === 0, last = i === EDIT.length - 1;
  return `[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=${first ? 0.12 : F},afade=t=out:st=${(d - (last ? 1.6 : F)).toFixed(3)}:d=${last ? 1.6 : F}[s${i}]`;
});
// The track's opening is a whisper (about 20 dB under its climax): lift it under the cold open, and
// the middle a little, so the build still reads but nothing is lost under the words.
const LIFT = "if(lt(t,16.2),2.5,if(lt(t,16.85),2.5-(t-16.2)/0.65,if(lt(t,60),1.5,if(lt(t,64.88),1.5-0.5*(t-60)/4.88,1))))";
const graph = `${chains.join(";")};${EDIT.map((_, i) => `[s${i}]`).join("")}concat=n=${EDIT.length}:v=0:a=1,volume='${LIFT}':eval=frame[c]`;
const tmp = OUT.replace(".wav", ".raw.wav");
execFileSync("mkdir", ["-p", OUT.slice(0, OUT.lastIndexOf("/"))]);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", SRC, "-filter_complex", graph, "-map", "[c]", "-ar", "48000", tmp]);
const loud = (f) => parseFloat(execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${f}" -af ebur128 -f null - 2>&1 | sed -n '/Summary/,$p' | grep ' I:'`], { encoding: "utf8" }).split("I:")[1]);
const g = -11.6 - loud(tmp);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", tmp, "-af", `volume=${g.toFixed(2)}dB,alimiter=limit=0.6:level=false:attack=1:release=60`, "-c:a", "pcm_s16le", OUT]);
execFileSync("rm", [tmp]);
const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUT], { encoding: "utf8" }));
console.log(`wrote ${OUT} (${dur.toFixed(2)} s, ${loud(OUT)} LUFS)`);
