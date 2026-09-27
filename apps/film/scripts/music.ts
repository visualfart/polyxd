/**
 * The music of the three short cuts, arranged from Apple Loops (royalty-free with GarageBand, read
 * straight from /Library/Audio/Apple Loops) to each film's own bars:
 *
 *   a piano and a bed while the problem is shown · the lift when the screen appears · fuller, with a
 *   light pulse, for the rest · one chord left ringing, through a small plate, under the mark.
 *
 * Every part plays from 0:00 in time with the others and is only heard from its entry, so an entry
 * on any bar lands on the beat. Parts are first levelled to the same loudness while playing, then
 * set by role; the mix is brought to −16 LUFS with one gain and a limiter, nothing squashed.
 *
 *   node scripts/music.ts            → assets/music-a.wav, music-b.wav, music-c.wav
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOOPS = "/Library/Audio/Apple Loops/Apple/01 Hip Hop/";
const ASSETS = fileURLToPath(new URL("../assets/", import.meta.url));
const bar = (bpm: number, n: number) => (n * 240) / bpm;

interface Cut {
  out: string;
  family: string;
  bpm: number;
  /** The lift and the fuller section, in bars; the ringing chord, in bars; the film's length, s. */
  lift: number;
  full: number;
  ring: number;
  duration: number;
  parts: { name: string; at: 0 | 1 | 2; db: number }[];
  ringing: string[];
}

const CUTS: Cut[] = [
  { out: "music-a.wav", family: "Longing", bpm: 82, lift: 5, full: 8, ring: 12, duration: 43, ringing: ["Piano", "Pad"], parts: [
    { name: "Piano", at: 0, db: 0 }, { name: "Pad", at: 0, db: -10 },
    { name: "Strings 01", at: 1, db: -5 }, { name: "Electric Piano", at: 1, db: -10 },
    { name: "Bass", at: 2, db: -9 }, { name: "Beat", at: 2, db: -13 },
  ] },
  { out: "music-b.wav", family: "Rise Up", bpm: 81, lift: 6, full: 10, ring: 15, duration: 52, ringing: ["Piano", "Strings and Brass"], parts: [
    { name: "Piano", at: 0, db: 0 },
    { name: "Strings and Brass", at: 1, db: -5 }, { name: "Plucks", at: 1, db: -8 },
    { name: "Bass", at: 2, db: -8 }, { name: "Beat", at: 2, db: -12 },
  ] },
  { out: "music-c.wav", family: "Yearning", bpm: 70, lift: 4, full: 6, ring: 10, duration: 42, ringing: ["Piano", "Synth Pad"], parts: [
    { name: "Piano", at: 0, db: 0 }, { name: "Synth Drone", at: 0, db: -11 },
    { name: "Synth Pad", at: 1, db: -6 }, { name: "Synth Arp", at: 1, db: -9 },
    { name: "Electric Piano", at: 2, db: -7 }, { name: "Sub Bass", at: 2, db: -11 }, { name: "Beat", at: 2, db: -14 },
  ] },
];

/** Loudness of a part while it's playing (its silences don't count), in dB. */
function playingLevel(file: string) {
  const b = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const x = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  let e = 0, n = 0;
  for (let s = 0; s < x.length; s += 800) {
    let w = 0;
    for (let i = s; i < Math.min(s + 800, x.length); i++) w += x[i] * x[i];
    w /= 800;
    if (w > 1e-5) { e += w; n++; }
  }
  return 10 * Math.log10(e / Math.max(n, 1));
}

const IR = `${ASSETS}plate.wav`;
if (!existsSync(IR)) execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anoisesrc=d=3.2:c=pink:r=48000:a=0.5", "-f", "lavfi", "-i", "anoisesrc=d=3.2:c=pink:r=48000:a=0.5:seed=7", "-filter_complex", "[0][1]amerge=inputs=2,afade=t=out:d=3.2:curve=exp,lowpass=f=6000,highpass=f=180", "-ar", "48000", IR]);

const REF = -20;
for (const c of CUTS) {
  const at = [0, bar(c.bpm, c.lift), bar(c.bpm, c.full)];
  const ring = bar(c.bpm, c.ring);
  const tail = c.duration - ring;
  const file = (p: string) => `${LOOPS}${c.family} ${p}.caf`;
  const args = ["-y", "-v", "error"];
  const chains: string[] = [];
  const labels: string[] = [];
  let i = 0;
  const level: Record<string, number> = {};
  for (const p of c.parts) {
    const f = file(p.name);
    const g = REF - (level[p.name] ??= playingLevel(f)) + p.db;
    const entry = at[p.at];
    args.push("-stream_loop", "-1", "-i", f);
    const fadeIn = p.at === 0 ? `afade=t=in:st=0:d=2` : `afade=t=in:st=${(entry - 0.15).toFixed(3)}:d=0.5`;
    chains.push(`[${i}:a]aresample=48000,atrim=0:${ring.toFixed(3)},asetpts=PTS-STARTPTS,${fadeIn},afade=t=out:st=${(ring - 0.06).toFixed(3)}:d=0.06,volume=${g.toFixed(2)}dB[p${i}]`);
    labels.push(`[p${i}]`);
    i++;
  }
  for (const p of c.ringing) {
    const f = file(p);
    const role = c.parts.find((r) => r.name === p)!;
    const g = REF - level[p] + role.db;
    args.push("-i", f);
    chains.push(`[${i}:a]aresample=48000,atrim=0:${tail.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=out:st=1.2:d=${(tail - 2.2).toFixed(2)}:curve=qsin,volume=${g.toFixed(2)}dB,adelay=${Math.round(ring * 1000)}:all=1[p${i}]`);
    labels.push(`[p${i}]`);
    i++;
  }
  args.push("-i", IR);
  const L = at[1], F = at[2];
  // The sections' level: the problem sits back, the lift comes up over a second, the rest is full.
  const shape = `volume=eval=frame:volume='if(lt(t,${L - 1}),0.5,if(lt(t,${L}),0.5+0.3*(t-${L - 1}),if(lt(t,${F - 1}),0.8,if(lt(t,${F}),0.8+0.2*(t-${F - 1}),1))))'`;
  const graph = [
    ...chains,
    `${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,${shape},asplit[dry][send]`,
    `[send]atrim=start=${(ring - 0.3).toFixed(3)},asetpts=PTS-STARTPTS[t0]`,
    `[t0][${i}:a]afir=dry=0:wet=1:irgain=0.35[wet]`,
    `[wet]adelay=${Math.round((ring - 0.3) * 1000)}:all=1[wetd]`,
    `[dry][wetd]amix=inputs=2:normalize=0:duration=longest[out]`,
  ].join(";");
  const raw = `${ASSETS}${c.out}.raw.wav`;
  execFileSync("ffmpeg", [...args, "-filter_complex", graph, "-map", "[out]", "-ac", "2", "-ar", "48000", "-t", String(c.duration), raw]);
  const I = parseFloat(execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${raw}" -af ebur128 -f null - 2>&1 | grep -E '^\\s+I:' | tail -1`], { encoding: "utf8" }).split("I:")[1]);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", `volume=${(-16 - I).toFixed(2)}dB,alimiter=limit=0.84:level=false,afade=t=out:st=${c.duration - 1}:d=1`, "-ar", "48000", `${ASSETS}${c.out}`]);
  execFileSync("rm", [raw]);
  console.log(`wrote assets/${c.out}  (${c.family}, ${c.bpm} bpm; lift ${L.toFixed(2)} s, full ${F.toFixed(2)} s, ring ${ring.toFixed(2)} s)`);
}
