/**
 * Colour ramps in OKLCH, for the Rebrand shortcut. What it does, exactly: an `oklch(L C H)` value
 * keeps its lightness and chroma and takes the new hue (chroma can be scaled, down to grey). It
 * does not pick new lightness steps, so a ramp designed to pass contrast at hue 275 passes at hue
 * 30 almost always, but not by construction: OKLCH lightness is perceptual, WCAG contrast is sRGB
 * luminance, and the same L lands a shade apart across hues, which is why the mapping's contrast
 * is re-measured after every change rather than assumed.
 */
import type { Graph, Token } from "../import/read.ts";

export interface Oklch {
  /** 0–1 */
  l: number;
  c: number;
  h: number;
  /** 0–1; undefined when the value gave none */
  alpha?: number;
}

const OKLCH = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

export function parseOklch(value: unknown): Oklch | null {
  if (typeof value !== "string") return null;
  const m = OKLCH.exec(value.trim());
  if (!m) return null;
  const pct = (s: string) => (s.endsWith("%") ? Number(s.slice(0, -1)) / 100 : Number(s));
  return { l: pct(m[1]), c: Number(m[2]), h: Number(m[3]), ...(m[4] !== undefined ? { alpha: pct(m[4]) } : {}) };
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** Written the way the template packs write it: `oklch(48% 0.21 275)`, alpha after a slash. */
export function formatOklch({ l, c, h, alpha }: Oklch): string {
  const a = alpha !== undefined && alpha < 1 ? ` / ${round(alpha, 3)}` : "";
  return `oklch(${round(l * 100, 1)}% ${round(c, 3)} ${round(((h % 360) + 360) % 360, 1)}${a})`;
}

/** The lightness and chroma profile of a twelve-step ramp, 25 (near white) to 950 (near black): the Mono template's. */
export const RAMP_STEPS = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const PROFILE: Record<(typeof RAMP_STEPS)[number], [l: number, c: number]> = {
  25: [0.99, 0.006], 50: [0.965, 0.02], 100: [0.93, 0.04], 200: [0.87, 0.07], 300: [0.78, 0.11], 400: [0.68, 0.16],
  500: [0.57, 0.2], 600: [0.48, 0.21], 700: [0.42, 0.19], 800: [0.35, 0.15], 900: [0.28, 0.11], 950: [0.2, 0.07],
};

/**
 * A twelve-step ramp at a hue: the Mono profile's lightness per step, its chroma scaled by
 * `chroma` (1 is Mono's saturation, 0 a neutral grey). Steps are named as Mono names them.
 */
export function oklchRamp(hue: number, chroma = 1): Record<string, string> {
  const out: Record<string, string> = {};
  for (const step of RAMP_STEPS) {
    const [l, c] = PROFILE[step];
    out[String(step)] = formatOklch({ l, c: c * chroma, h: hue });
  }
  return out;
}

/** One value, rebranded: same lightness, chroma scaled, the new hue. Anything that isn't OKLCH is left alone. */
export function rebrandValue(value: unknown, hue: number, chroma = 1): unknown {
  const p = parseOklch(value);
  return p ? formatOklch({ ...p, c: p.c * chroma, h: hue }) : value;
}

export interface Change {
  path: string;
  set: string;
  value: unknown;
}

/** Whether a token is one of a brand ramp's steps, the ones a rebrand rotates. */
export const isBrandStep = (t: Token) => /(^|\.)brand-\d+$/.test(t.path);

/**
 * The changes a rebrand makes: every `brand-*` primitive in every set, rotated to the hue. Values
 * that aren't OKLCH (a hex white) are not touched. The template's other ramps (success, warning,
 * danger) keep their hues: they mean something.
 */
export function rebrandChanges(graph: Graph, hue: number, chroma = 1): Change[] {
  const out: Change[] = [];
  for (const t of graph.tokens) {
    if (!isBrandStep(t) || t.alias) continue;
    const next = rebrandValue(t.value, hue, chroma);
    if (next !== t.value) out.push({ path: t.path, set: t.set, value: next });
  }
  return out;
}

/** The hue the brand ramp is at now (its 600 step, or the first step found), or null when there is no OKLCH brand ramp. */
export function brandHue(graph: Graph): { hue: number; chroma: number } | null {
  const steps = graph.tokens.filter((t) => isBrandStep(t) && !t.alias && parseOklch(t.value));
  if (!steps.length) return null;
  const six = steps.find((t) => /brand-600$/.test(t.path)) ?? steps[0];
  const p = parseOklch(six.value)!;
  return { hue: p.h, chroma: round(p.c / PROFILE[600][1], 2) };
}
