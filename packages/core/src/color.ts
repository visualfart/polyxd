/** Colour text a ColorInput reads and writes: hex, rgb()/rgba() and hsl()/hsla(). */

export type ColorFormat = "hex" | "rgb" | "hsl";
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const hex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
const parseAlpha = (t: string | undefined) => (t === undefined ? 1 : clamp(t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t), 0, 1));
const channel = (t: string) => (t.endsWith("%") ? (parseFloat(t) / 100) * 255 : parseFloat(t));

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  h /= 6;
  return [h * 360, s, l];
}

/** Parse CSS hex, rgb()/rgba() and hsl()/hsla() text; null when it isn't a colour yet. */
export function parseColor(text: unknown): RGBA | null {
  if (typeof text !== "string") return null;
  const t = text.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(t);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) {
      const [r, g, b, a] = h.split("").map((c) => parseInt(c + c, 16));
      return { r, g, b, a: h.length === 4 ? a / 255 : 1 };
    }
    if (h.length === 6 || h.length === 8) {
      const at = (i: number) => parseInt(h.slice(i, i + 2), 16);
      return { r: at(0), g: at(2), b: at(4), a: h.length === 8 ? at(6) / 255 : 1 };
    }
    return null;
  }
  const fn = /^(rgba?|hsla?)\(\s*([^)]+?)\s*\)$/i.exec(t);
  if (!fn) return null;
  const parts = fn[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const a = parseAlpha(parts[3]);
  if (Number.isNaN(a)) return null;
  if (fn[1].toLowerCase().startsWith("rgb")) {
    const [r, g, b] = parts.slice(0, 3).map(channel);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a };
  }
  const h = parseFloat(parts[0]);
  const sat = parseFloat(parts[1]) / 100;
  const light = parseFloat(parts[2]) / 100;
  if ([h, sat, light].some(Number.isNaN)) return null;
  const [r, g, b] = hslToRgb(h, clamp(sat, 0, 1), clamp(light, 0, 1));
  return { r, g, b, a };
}

/** Write a colour as CSS text in the requested format; alpha appears only when allowed and below 1. */
export function formatColor(c: RGBA, format: ColorFormat, alpha: boolean): string {
  const a = alpha ? Math.round(c.a * 100) / 100 : 1;
  const r = Math.round(c.r);
  const g = Math.round(c.g);
  const b = Math.round(c.b);
  if (format === "rgb") return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
  if (format === "hsl") {
    const [h, s, l] = rgbToHsl(r, g, b);
    const hh = Math.round(h);
    const ss = Math.round(s * 100);
    const ll = Math.round(l * 100);
    return a < 1 ? `hsla(${hh}, ${ss}%, ${ll}%, ${a})` : `hsl(${hh}, ${ss}%, ${ll}%)`;
  }
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 1 ? hex2(a * 255) : ""}`;
}

/** The six-digit hex a native colour picker takes. */
export const toHex6 = (c: RGBA | null): string => (c ? `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}` : "#000000");

/** Whether two colours are the same to the eye (by channel, not by text: '#FFF' is 'rgb(255, 255, 255)'). */
export const sameColor = (a: RGBA | null, c: RGBA | null, alpha: boolean): boolean =>
  Boolean(a && c && Math.round(a.r) === Math.round(c.r) && Math.round(a.g) === Math.round(c.g) && Math.round(a.b) === Math.round(c.b) && (!alpha || Math.abs(a.a - c.a) < 0.005));

export const colorPlaceholder = (format: ColorFormat): string => (format === "hex" ? "#000000" : format === "rgb" ? "rgb(0, 0, 0)" : "hsl(0, 0%, 0%)");
