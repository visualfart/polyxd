/**
 * A DTCG 2025.10 color value, a hex string, or a CSS colour function. Design systems increasingly
 * publish OKLCH (Tailwind v4, shadcn), so those are converted to sRGB before anything is measured:
 * WCAG contrast is defined on sRGB luminance.
 */
export type ColorValue =
  | string
  | { colorSpace: string; components: [number, number, number]; alpha?: number; hex?: string };

export type Rgb = [number, number, number];

export function toRgb(value: ColorValue): Rgb {
  if (typeof value === "string") return parseColor(value);
  if (value.colorSpace === "srgb") return value.components;
  if (value.colorSpace === "oklch") return oklchToRgb(value.components);
  if (value.hex) return hexToRgb(value.hex);
  throw new Error(`Unsupported color space "${value.colorSpace}" (srgb and oklch, or a hex fallback)`);
}

/** A hex string, `oklch(L C H [/ A])`, `rgb()` or `rgba()`. */
export function parseColor(value: string): Rgb {
  const s = value.trim();
  if (s.startsWith("#")) return hexToRgb(s);
  const ok = /^oklch\(([^)]+)\)$/i.exec(s);
  if (ok) {
    const [l, c, h] = numbers(ok[1]);
    return oklchToRgb([percentOr(l, ok[1].trim().split(/[\s,/]+/)[0]), c, h]);
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (rgb) {
    const [r, g, b] = numbers(rgb[1]);
    return [r / 255, g / 255, b / 255];
  }
  throw new Error(`Invalid color "${value}"`);
}

/** The numbers in a colour function, alpha included, with none/NaN read as 0. */
function numbers(body: string): number[] {
  return body
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map((part) => (part.endsWith("%") ? Number(part.slice(0, -1)) / 100 : part === "none" ? 0 : Number(part)))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

/** OKLCH lightness may be written 0–1 or as a percentage. */
const percentOr = (parsed: number, raw: string) => (raw.endsWith("%") ? parsed : parsed);

/**
 * OKLCH → sRGB (Björn Ottosson's Oklab, then the sRGB transfer function). Colours outside the
 * sRGB gamut are clipped per channel, which is what a browser shows on an sRGB display.
 */
export function oklchToRgb([l, c, h]: [number, number, number]): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lr = +4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  const lg = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  const lb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(0, x) ** (1 / 2.4) - 0.055);
  return [clamp(gamma(lr)), clamp(gamma(lg)), clamp(gamma(lb))];
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!m) throw new Error(`Invalid hex color "${hex}"`);
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const h = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** WCAG 2.x relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export const alphaOf = (value: ColorValue) => (typeof value === "string" ? stringAlpha(value) : (value.alpha ?? 1));

/** The alpha of a hex string, `oklch(… / a)` or `rgba(…)`; 1 when there is none. */
function stringAlpha(value: string): number {
  const s = value.trim();
  const hex = /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(s);
  if (hex) return parseInt(hex[1], 16) / 255;
  const fn = /^(?:oklch|rgba?)\(([^)]+)\)$/i.exec(s);
  if (!fn) return 1;
  const slash = fn[1].split("/")[1];
  if (slash !== undefined) {
    const a = slash.trim();
    return a.endsWith("%") ? Number(a.slice(0, -1)) / 100 : Number(a);
  }
  const parts = fn[1].split(/[\s,]+/).filter(Boolean);
  return parts.length === 4 ? Number(parts[3]) : 1;
}

/** Composites a translucent foreground over an (opaque) background, as it would be displayed. */
export function over(fg: ColorValue, bg: ColorValue): Rgb {
  const a = alphaOf(fg);
  const [fr, fg2, fb] = toRgb(fg);
  const [br, bg2, bb] = toRgb(bg);
  return [fr * a + br * (1 - a), fg2 * a + bg2 * (1 - a), fb * a + bb * (1 - a)];
}

/**
 * WCAG 2.x contrast ratio, from 1 to 21. A translucent foreground is composited over the
 * background first, so the ratio reflects what is actually displayed.
 */
export function contrastRatio(a: ColorValue, b: ColorValue): number {
  const la = luminance(alphaOf(a) < 1 ? over(a, b) : toRgb(a));
  const lb = luminance(toRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
