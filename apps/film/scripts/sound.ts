/**
 * The film's sound, composed in code: assets/music.wav (the one track the script describes) and
 * assets/sfx/*.wav (every cue the scenes call for). Everything is synthesised here at 48 kHz, so
 * the film has no sample dependencies; drop a better `music.wav` into assets/ to replace the track
 * (Film.tsx imports it once, from that path, and nothing else changes).
 *
 *   node scripts/sound.ts            writes music and all the SFX
 *   node scripts/sound.ts sfx        only the SFX
 *
 * The track, at 96 bpm, in D: a held low D (three detuned saws through a low-pass) from 0:00; a
 * pulse (kick and hat) from 0:07; a pad progression Dmaj7 · Bm7 · Gmaj7 · A with a plucked
 * arpeggio from 0:18; the pad alone from 0:48; the pulse back at 0:52; a single D chord and a
 * sine tick at 1:19; out by 1:22. A feedback delay on the pluck, a reverb by convolution with a
 * synthesised decaying-noise impulse on the pad, pluck and hat. Peaks at −12 dBFS.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SR = 48000;
const assets = fileURLToPath(new URL("../assets/", import.meta.url));
const only = process.argv[2];

/* ─── WAV ─── */
function wav(channels: Float64Array[], peakDb: number): Buffer {
  let peak = 1e-9;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  const gain = Math.pow(10, peakDb / 20) / peak;
  const n = channels[0].length;
  const nch = channels.length;
  const data = Buffer.alloc(n * nch * 2);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < nch; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i] * gain));
      data.writeInt16LE(Math.round(v * 32767), (i * nch + c) * 2);
    }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(nch, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * nch * 2, 28);
  header.writeUInt16LE(nch * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/* ─── DSP helpers ─── */
const TAU = Math.PI * 2;
let seed = 7;
const rnd = () => {
  // A small LCG, so the noise is the same on every run.
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296 - 0.5;
};
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const db = (x: number) => Math.pow(10, x / 20);
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** One-pole low-pass, in place, cutoff in Hz (constant or per-sample). */
function lowpass(buf: Float64Array, cutoff: number | ((i: number) => number), passes = 1) {
  for (let p = 0; p < passes; p++) {
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
      const fc = typeof cutoff === "number" ? cutoff : cutoff(i);
      const a = 1 - Math.exp((-TAU * fc) / SR);
      y += a * (buf[i] - y);
      buf[i] = y;
    }
  }
}
function highpass(buf: Float64Array, cutoff: number, passes = 1) {
  for (let p = 0; p < passes; p++) {
    let y = 0;
    let xPrev = 0;
    const rc = 1 / (TAU * cutoff);
    const a = rc / (rc + 1 / SR);
    for (let i = 0; i < buf.length; i++) {
      const x = buf[i];
      y = a * (y + x - xPrev);
      xPrev = x;
      buf[i] = y;
    }
  }
}
function bandpass(buf: Float64Array, lo: number | ((i: number) => number), hi: number | ((i: number) => number), passes = 1) {
  const out = Float64Array.from(buf);
  lowpass(out, hi, passes);
  const lp = Float64Array.from(out);
  lowpass(lp, lo, passes);
  for (let i = 0; i < buf.length; i++) buf[i] = out[i] - lp[i];
}
const add = (dst: Float64Array, src: Float64Array, at: number, gain = 1) => {
  const start = Math.round(at * SR);
  for (let i = 0; i < src.length && start + i < dst.length; i++) if (start + i >= 0) dst[start + i] += src[i] * gain;
};
const seconds = (s: number) => new Float64Array(Math.round(s * SR));
/** Attack/decay envelope multiplied in: linear attack, exponential-ish decay to silence at the end. */
function env(buf: Float64Array, attack: number, decay: number, hold = 0) {
  const a = Math.round(attack * SR);
  const h = Math.round(hold * SR);
  const d = Math.max(1, Math.round(decay * SR));
  for (let i = 0; i < buf.length; i++) {
    let g = 1;
    if (i < a) g = i / a;
    else if (i > a + h) g = Math.exp((-5 * (i - a - h)) / d) * Math.max(0, 1 - (i - a - h) / d);
    buf[i] *= g;
  }
}
const noise = (s: number) => {
  const b = seconds(s);
  for (let i = 0; i < b.length; i++) b[i] = rnd() * 2;
  return b;
};
const sine = (s: number, freq: number | ((t: number) => number), phase = 0) => {
  const b = seconds(s);
  let ph = phase;
  for (let i = 0; i < b.length; i++) {
    const f = typeof freq === "number" ? freq : freq(i / SR);
    b[i] = Math.sin(ph);
    ph += (TAU * f) / SR;
  }
  return b;
};

/* ─── FFT convolution (the reverb) ─── */
function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 1 : -1) * TAU) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) (re[i] /= n), (im[i] /= n);
}
/** Overlap-add convolution of `x` with `ir`, output the length of `x`. */
function convolve(x: Float64Array, ir: Float64Array): Float64Array {
  const block = 1 << 17;
  let size = 1;
  while (size < block + ir.length) size <<= 1;
  const irRe = new Float64Array(size);
  const irIm = new Float64Array(size);
  irRe.set(ir);
  fft(irRe, irIm, false);
  const out = new Float64Array(x.length + ir.length);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let start = 0; start < x.length; start += block) {
    re.fill(0);
    im.fill(0);
    re.set(x.subarray(start, Math.min(x.length, start + block)));
    fft(re, im, false);
    for (let i = 0; i < size; i++) {
      const r = re[i] * irRe[i] - im[i] * irIm[i];
      const j = re[i] * irIm[i] + im[i] * irRe[i];
      re[i] = r;
      im[i] = j;
    }
    fft(re, im, true);
    for (let i = 0; i < size && start + i < out.length; i++) out[start + i] += re[i];
  }
  return out.subarray(0, x.length);
}
/** A room: decaying noise, darker as it fades, with a short pre-delay. */
function impulse(length: number, decay: number, dark = 1800): Float64Array {
  const ir = noise(length);
  const pre = Math.round(0.012 * SR);
  for (let i = 0; i < ir.length; i++) ir[i] *= i < pre ? 0 : Math.exp((-6.9 * (i - pre)) / (decay * SR));
  lowpass(ir, (i) => Math.max(500, dark * Math.exp((-2 * i) / (decay * SR))));
  return ir;
}

/* ─── Voices ─── */
/** Detuned saws through a low-pass: the drone and the pad. */
function saws(s: number, freqs: number[], detune: number, cutoff: number | ((i: number) => number)) {
  const b = seconds(s);
  for (const f of freqs)
    for (const d of [-detune, 0, detune]) {
      const fr = f * (1 + d);
      let ph = rnd() * 2 + 0.5;
      for (let i = 0; i < b.length; i++) {
        ph += fr / SR;
        if (ph >= 1) ph -= 1;
        b[i] += (ph * 2 - 1) * 0.33;
      }
    }
  lowpass(b, cutoff, 2);
  return b;
}
/** A plucked string (Karplus–Strong). */
function pluck(freq: number, s: number) {
  const b = seconds(s);
  const n = Math.round(SR / freq);
  const ring = new Float64Array(n);
  for (let i = 0; i < n; i++) ring[i] = rnd() * 2;
  lowpass(ring, 3200);
  let p = 0;
  for (let i = 0; i < b.length; i++) {
    const v = ring[p];
    const nx = ring[(p + 1) % n];
    ring[p] = (v + nx) * 0.5 * 0.996;
    b[i] = v;
    p = (p + 1) % n;
  }
  env(b, 0.002, s, 0);
  return b;
}
function kick() {
  const b = sine(0.35, (t) => 42 + 130 * Math.exp(-t * 28));
  env(b, 0.002, 0.3);
  return b;
}
function hat(open = false) {
  const b = noise(open ? 0.18 : 0.05);
  highpass(b, 7000, 2);
  env(b, 0.001, open ? 0.16 : 0.04);
  return b;
}

/* ─── The track ─── */
function music(): Float64Array[] {
  const LEN = 82;
  const bpm = 96;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const L = seconds(LEN);
  const R = seconds(LEN);
  const send = seconds(LEN); // to the reverb
  const D2 = midi(38);

  // 1 · The held low note: three detuned saws, the low-pass opening a little through the film.
  {
    const drone = saws(LEN, [D2, D2 / 2], 0.004, (i) => 150 + 220 * smooth(i / SR / 30));
    for (let i = 0; i < drone.length; i++) {
      const t = i / SR;
      const g = Math.min(1, t / 2.5) * (t > 79 ? Math.max(0, 1 - (t - 79) / 2.4) : 1);
      const v = drone[i] * g * db(-9);
      L[i] += v;
      R[i] += v;
    }
  }

  // 2 · The pulse: kick on 1 and 3, hats on eighths, from 0:07 to 0:48 and 0:52 to 1:19.
  {
    const k = kick();
    const h = hat();
    const ho = hat(true);
    const on = (t: number) => (t >= 7 && t < 47.9) || (t >= 52 && t < 78.9);
    for (let t = 7; t < 79; t += beat / 2) {
      if (!on(t)) continue;
      const eighth = Math.round((t - 7) / (beat / 2));
      const inBar = eighth % 8;
      if (inBar === 0 || inBar === 4) add(L, k, t, db(-6)), add(R, k, t, db(-6));
      if (inBar === 7 && Math.floor(eighth / 8) % 4 === 3) add(L, k, t, db(-12)), add(R, k, t, db(-12));
      const g = inBar % 2 === 0 ? db(-25) : db(-19);
      const hh = inBar === 6 ? ho : h;
      add(L, hh, t, g * 0.9);
      add(R, hh, t, g * 1.1);
      add(send, hh, t, g * 0.5);
    }
  }

  // 3 · The pad: Dmaj7 · Bm7 · Gmaj7 · A, 7.5 s each; twice, the second time with the pulse back.
  const CHORDS: Record<string, number[]> = {
    Dmaj7: [50, 54, 57, 61],
    Bm7: [47, 50, 54, 57],
    Gmaj7: [43, 47, 50, 54],
    A: [45, 49, 52, 57],
    D: [50, 54, 57, 62],
  };
  const padAt = (name: string, at: number, len: number, attack = 1.2, release = 1.6, gain = db(-23)) => {
    const notes = CHORDS[name].map(midi);
    const p = saws(len + release, notes, 0.005, 900);
    const s = sine(len + release, notes[0] / 2);
    for (let i = 0; i < p.length; i++) {
      const t = i / SR;
      const g = smooth(t / attack) * (t > len ? Math.max(0, 1 - (t - len) / release) : 1);
      p[i] = (p[i] * 0.8 + s[i] * 0.25) * g * gain;
    }
    add(L, p, at, 0.95);
    add(R, p, at, 1.05);
    add(send, p, at, 0.6);
  };
  const progression = ["Dmaj7", "Bm7", "Gmaj7", "A"];
  progression.forEach((c, i) => padAt(c, 18 + i * 7.5, 7.5, i === 0 ? 2.2 : 1.2, i === 3 ? 0.8 : 1.6));
  padAt("A", 48, 4, 0.05, 1.2, db(-30)); // the pad alone, the question left open
  progression.forEach((c, i) => padAt(c, 52 + i * 6.75, 6.75, i === 0 ? 0.6 : 1.2, i === 3 ? 0.4 : 1.6));
  padAt("D", 79, 2.2, 0.35, 1.2, db(-20)); // the resolve

  // 4 · The pluck: chord tones, an octave up, a few per bar, through a dotted-eighth delay.
  {
    const dry = seconds(LEN);
    const pattern = [0, 1.5, 2, 3.5]; // beats within the bar
    const play = (from: number, to: number, chordAt: (t: number) => string, gain: number) => {
      let n = 0;
      for (let b = from; b < to - 0.1; b += bar)
        for (const off of pattern) {
          const t = b + off * beat;
          if (t >= to - 0.1) break;
          const tones = CHORDS[chordAt(t)];
          const note = tones[(n * 2 + Math.floor(n / 3)) % tones.length] + 12;
          n++;
          add(dry, pluck(midi(note), 1.6), t, gain * (off === 0 ? 1 : 0.8));
        }
    };
    play(18, 48, (t) => progression[Math.min(3, Math.floor((t - 18) / 7.5))], db(-21));
    play(56, 79, (t) => progression[Math.min(3, Math.floor((t - 52) / 6.75))], db(-23));
    lowpass(dry, 4200);
    // Feedback delay, dotted eighth, ping-pong.
    const d = Math.round(beat * 0.75 * SR);
    const dl = seconds(LEN);
    const dr = seconds(LEN);
    for (let i = 0; i < dry.length; i++) {
      const fbL = i >= d ? dr[i - d] : 0;
      const fbR = i >= d ? dl[i - d] : 0;
      dl[i] = dry[i] + fbL * 0.42;
      dr[i] = (i >= d ? dry[i - d] : 0) * 0.7 + fbR * 0.42;
    }
    lowpass(dl, 3000);
    lowpass(dr, 3000);
    for (let i = 0; i < LEN * SR; i++) {
      L[i] += dry[i] * 0.9 + dl[i] * 0.45;
      R[i] += dry[i] * 0.9 + dr[i] * 0.45;
      send[i] += (dl[i] + dr[i]) * 0.35 + dry[i] * 0.3;
    }
  }

  // 5 · The tick at 1:19, on the resolve: a short high sine, dry.
  {
    const t = sine(0.09, 1760);
    env(t, 0.002, 0.08);
    add(L, t, 79.0, db(-14));
    add(R, t, 79.0, db(-14));
  }

  // 6 · The room: the send bus through a synthesised impulse, back in wide.
  {
    const ir = impulse(2.4, 2.0, 2200);
    const wet = convolve(send, ir);
    const ir2 = impulse(2.1, 1.7, 1900);
    const wet2 = convolve(send, ir2);
    for (let i = 0; i < LEN * SR; i++) {
      L[i] += wet[i] * 0.42;
      R[i] += wet2[i] * 0.42;
    }
  }

  // 7 · Out by 1:21.8, and a soft knee so nothing spikes.
  for (let i = 0; i < LEN * SR; i++) {
    const t = i / SR;
    const g = t > 80.2 ? Math.max(0, 1 - (t - 80.2) / 1.5) : 1;
    L[i] = Math.tanh(L[i] * g * 0.7) / 0.7;
    R[i] = Math.tanh(R[i] * g * 0.7) / 0.7;
  }
  return [L, R];
}

/* ─── The cues ─── */
const SFX: Record<string, () => Float64Array> = {
  /** A dry click on paper: a short filtered noise burst. */
  "paper-click": () => {
    const b = noise(0.05);
    bandpass(b, 900, 3200, 2);
    env(b, 0.001, 0.035);
    return b;
  },
  /** A key on a keyboard, smaller and higher. */
  "type-click": () => {
    const b = noise(0.02);
    bandpass(b, 2000, 6500, 2);
    env(b, 0.0005, 0.014);
    return b;
  },
  /** A screen arriving: a soft filtered sweep up. */
  arrive: () => {
    const b = noise(0.42);
    bandpass(b, (i) => 300 + 1800 * smooth(i / SR / 0.35), (i) => 900 + 3200 * smooth(i / SR / 0.35), 2);
    env(b, 0.06, 0.34);
    const s = sine(0.42, (t) => 330 + 330 * smooth(t / 0.3));
    env(s, 0.05, 0.36);
    for (let i = 0; i < b.length; i++) b[i] = b[i] * 0.6 + s[i] * 0.25;
    return b;
  },
  /** A pencil: band-passed noise with a tremolo, as strokes go down. */
  pencil: () => {
    const b = noise(1.3);
    bandpass(b, 1400, 4200, 2);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const strokes = 0.55 + 0.45 * Math.sin(TAU * 13 * t + Math.sin(TAU * 2.3 * t) * 2);
      b[i] *= strokes * (0.7 + 0.3 * Math.sin(TAU * 0.9 * t));
    }
    env(b, 0.04, 1.2, 0.05);
    return b;
  },
  /** The swarm: a noise sweep down. */
  woosh: () => {
    const b = noise(0.6);
    bandpass(b, (i) => 200 + 2400 * (1 - smooth(i / SR / 0.5)), (i) => 700 + 5000 * (1 - smooth(i / SR / 0.5)), 2);
    env(b, 0.12, 0.44);
    return b;
  },
  /** A page turned: two rustles and a small snap. */
  "paper-flip": () => {
    const b = noise(0.22);
    bandpass(b, 700, 5000, 2);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] *= 0.4 + 0.6 * Math.abs(Math.sin(TAU * 9 * t));
    }
    env(b, 0.01, 0.2);
    const snap = noise(0.02);
    bandpass(snap, 1500, 6000);
    env(snap, 0.0005, 0.015);
    add(b, snap, 0.11, 0.8);
    return b;
  },
  /** The verifier's scan: a rising sine with a vibrato. */
  scan: () => {
    const b = sine(1.7, (t) => (300 + 900 * smooth(t / 1.5)) * (1 + 0.012 * Math.sin(TAU * 6 * t)));
    env(b, 0.15, 1.4, 0.15);
    lowpass(b, 3000);
    return b;
  },
  /** Ticks landing, one after another. */
  "tick-cascade": () => {
    const b = seconds(0.6);
    for (let k = 0; k < 6; k++) {
      const t = sine(0.05, 1900 + k * 210);
      env(t, 0.001, 0.045);
      add(b, t, k * 0.07, 0.9 - k * 0.06);
    }
    return b;
  },
  tick: () => {
    const b = sine(0.05, 2400);
    env(b, 0.001, 0.045);
    return b;
  },
  /** A UI click: short, mid, a little noise. */
  "ui-click": () => {
    const s = sine(0.03, 900);
    env(s, 0.0005, 0.02);
    const n = noise(0.03);
    bandpass(n, 1200, 4000);
    env(n, 0.0005, 0.012);
    for (let i = 0; i < s.length; i++) s[i] = s[i] * 0.7 + n[i] * 0.5;
    return s;
  },
  /** The agent run: a quick ratchet of clicks. */
  ratchet: () => {
    const b = seconds(0.55);
    for (let k = 0; k < 9; k++) {
      const n = noise(0.02);
      bandpass(n, 1500 + k * 120, 5000 + k * 200);
      env(n, 0.0005, 0.012);
      add(b, n, k * 0.052, 0.8);
    }
    return b;
  },
  /** A blink: a tiny low thump. */
  blink: () => {
    const b = sine(0.12, (t) => 95 * Math.exp(-t * 9) + 45);
    env(b, 0.003, 0.09);
    return b;
  },
  /** One bass hit, for "now". */
  "bass-hit": () => {
    const b = sine(0.9, (t) => 36.7 * (1 + 2.2 * Math.exp(-t * 18)));
    env(b, 0.004, 0.8);
    const c = noise(0.03);
    bandpass(c, 400, 2500);
    env(c, 0.0005, 0.02);
    add(b, c, 0, 0.25);
    return b;
  },
  /** A soft confirm: two sines, a fifth apart. */
  confirm: () => {
    const a = sine(0.3, 587.3);
    env(a, 0.005, 0.28);
    const c = sine(0.34, 880);
    env(c, 0.005, 0.3);
    add(a, c, 0.09, 0.8);
    return a;
  },
  /** The grid wave: a shimmer of small high sines. */
  shimmer: () => {
    const b = seconds(1.8);
    for (let k = 0; k < 40; k++) {
      const t = sine(0.09, 2200 + Math.abs(rnd()) * 2800);
      env(t, 0.003, 0.08);
      add(b, t, (k / 40) * 1.5 + rnd() * 0.02, 0.35);
    }
    return b;
  },
  /** Paper folding away: a short rustle with a pitch drop. */
  fold: () => {
    const b = noise(0.3);
    bandpass(b, (i) => 1800 * (1 - 0.7 * smooth(i / SR / 0.25)), (i) => 5200 * (1 - 0.7 * smooth(i / SR / 0.25)), 2);
    env(b, 0.02, 0.26);
    return b;
  },
  /** Something sliding in: a filtered noise swell. */
  slide: () => {
    const b = noise(0.3);
    bandpass(b, 500, 2200, 2);
    env(b, 0.12, 0.16);
    return b;
  },
};

await mkdir(`${assets}sfx/`, { recursive: true });
for (const [name, make] of Object.entries(SFX)) {
  const b = make();
  await writeFile(`${assets}sfx/${name}.wav`, wav([b], -18));
}
console.log(`wrote assets/sfx/ (${Object.keys(SFX).length} cues, peaks at -18 dBFS)`);

if (only !== "sfx") {
  const t0 = Date.now();
  const [L, R] = music();
  await writeFile(`${assets}music.wav`, wav([L, R], -12));
  console.log(`wrote assets/music.wav  82 s, 48 kHz stereo, peak -12 dBFS (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
