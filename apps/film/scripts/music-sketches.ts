// Three music sketches from Apple Loops families, all to Option B's shape:
// A piano and a bed (the problem) · B the lift (the screen appears) · C fuller, a light pulse (other apps) · a ringing last chord.
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";

const ROOT = "/Library/Audio/Apple Loops/Apple/01 Hip Hop/";
const HERE = new URL("../assets/music-sketches/", import.meta.url).pathname;
const OUT = HERE;
mkdirSync(OUT, { recursive: true });

const pcmRms = (args: string[]) => {
  const b = execFileSync("ffmpeg", ["-v", "error", ...args, "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const x = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  let e = 0, n = 0;
  // Only where the part is actually playing, so a sparse piano isn't boosted for its silences.
  for (let s = 0; s < x.length; s += 800) {
    let w = 0;
    for (let i = s; i < Math.min(s + 800, x.length); i++) w += x[i] * x[i];
    w /= 800;
    if (w > 1e-5) { e += w; n++; }
  }
  return 10 * Math.log10(e / Math.max(n, 1));
};

// A small plate: decaying stereo noise, for the last chord only.
const IR = `${OUT}ir.wav`;
if (!existsSync(IR)) execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anoisesrc=d=3.2:c=pink:r=48000:a=0.5", "-f", "lavfi", "-i", "anoisesrc=d=3.2:c=pink:r=48000:a=0.5:seed=7", "-filter_complex", "[0][1]amerge=inputs=2,afade=t=out:d=3.2:curve=exp,lowpass=f=6000,highpass=f=180", "-ar", "48000", IR]);

type Role = { part: string; section: 0 | 1 | 2; db: number };
type Sketch = { name: string; loop: number; roles: Role[]; ring: string[] };

const SKETCHES: Sketch[] = [
  { name: "1-yearning", loop: 13.714, ring: ["Piano", "Synth Pad"], roles: [
    { part: "Piano", section: 0, db: 0 }, { part: "Synth Drone", section: 0, db: -10 },
    { part: "Synth Pad", section: 1, db: -6 }, { part: "Synth Arp", section: 1, db: -9 },
    { part: "Electric Piano", section: 2, db: -6 }, { part: "Sub Bass", section: 2, db: -10 }, { part: "Beat", section: 2, db: -13 },
  ] },
  { name: "2-rise-up", loop: 11.852, ring: ["Piano", "Strings and Brass"], roles: [
    { part: "Piano", section: 0, db: 0 },
    { part: "Strings and Brass", section: 1, db: -5 }, { part: "Plucks", section: 1, db: -8 },
    { part: "Bass", section: 2, db: -8 }, { part: "Beat", section: 2, db: -12 },
  ] },
  { name: "3-longing", loop: 11.707, ring: ["Piano", "Pad"], roles: [
    { part: "Piano", section: 0, db: 0 }, { part: "Pad", section: 0, db: -9 },
    { part: "Strings 01", section: 1, db: -5 }, { part: "Electric Piano", section: 1, db: -9 },
    { part: "Bass", section: 2, db: -9 }, { part: "Beat", section: 2, db: -12 },
  ] },
];

const REF = -20; // every part is first brought to this level while playing, then set by its role

for (const s of SKETCHES) {
  const L = s.loop, end = 3 * L, ring = 7.5;
  const file = (p: string) => `${ROOT}Yearning`.replace("Yearning", "") + `${s.name.split("-").slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")} ${p}.caf`;
  const args = ["-y", "-v", "error"];
  const chains: string[] = [];
  const labels: string[] = [];
  let i = 0;
  for (const r of s.roles) {
    const f = file(r.part);
    const g = REF - pcmRms(["-i", f]) + r.db;
    const from = r.section * L;
    args.push("-stream_loop", "-1", "-i", f);
    chains.push(`[${i}:a]aresample=48000,atrim=0:${(end - from).toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${r.section === 0 ? 2 : 0.4},afade=t=out:st=${(end - from - 0.08).toFixed(3)}:d=0.08,volume=${g.toFixed(2)}dB,adelay=${Math.round(from * 1000)}:all=1[p${i}]`);
    labels.push(`[p${i}]`);
    i++;
  }
  // The last chord: the first bar of the ring parts, into the plate, fading out.
  for (const p of s.ring) {
    const f = file(p);
    const role = s.roles.find((r) => r.part === p)!;
    const g = REF - pcmRms(["-i", f]) + role.db;
    args.push("-i", f);
    chains.push(`[${i}:a]aresample=48000,atrim=0:${ring},asetpts=PTS-STARTPTS,afade=t=out:st=1.2:d=${ring - 1.2}:curve=qsin,volume=${g.toFixed(2)}dB,adelay=${Math.round(end * 1000)}:all=1[p${i}]`);
    labels.push(`[p${i}]`);
    i++;
  }
  args.push("-i", IR);
  const irIdx = i;
  // The sections' overall level: the problem sits back, the reveal lifts, the montage is full.
  const ramp = `volume=eval=frame:volume='if(lt(t,${L - 1}),0.5,if(lt(t,${L}),0.5+0.3*(t-${L - 1}),if(lt(t,${2 * L - 1}),0.8,if(lt(t,${2 * L}),0.8+0.2*(t-${2 * L - 1}),1))))'`;
  const graph = [
    ...chains,
    `${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,${ramp},asplit[dry][toverb]`,
    `[toverb]atrim=start=${(end - 0.5).toFixed(3)},asetpts=PTS-STARTPTS[tail]`,
    `[tail][${irIdx}:a]afir=dry=0:wet=1:irgain=0.35[wet]`,
    `[wet]adelay=${Math.round((end - 0.5) * 1000)}:all=1[wetd]`,
    `[dry][wetd]amix=inputs=2:normalize=0:duration=longest[out]`,
  ].join(";");
  const raw = `${OUT}${s.name}.raw.wav`;
  execFileSync("ffmpeg", [...args, "-filter_complex", graph, "-map", "[out]", "-ac", "2", "-ar", "48000", "-t", String(end + ring + 1.5), raw]);
  // One overall gain to −16 LUFS, a safety limiter, and a short fade at the very end.
  const meas = execFileSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).toString();
  const probe = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${raw}" -af ebur128 -f null - 2>&1 | grep -E '^\\s+I:' | tail -1`], { encoding: "utf8" });
  const I = parseFloat(probe.split("I:")[1]);
  void meas;
  const total = end + ring + 1.5;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", `volume=${(-16 - I).toFixed(2)}dB,alimiter=limit=0.84:level=false,afade=t=out:st=${(total - 1).toFixed(2)}:d=1`, "-ar", "48000", `${OUT}${s.name}.wav`]);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", `${OUT}${s.name}.wav`, "-c:a", "aac", "-b:a", "256k", `${OUT}${s.name}.m4a`]);
  console.log("wrote", s.name, "measured", I.toFixed(1), "LUFS before gain");
}
