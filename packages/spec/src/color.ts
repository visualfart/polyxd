/** A DTCG 2025.10 color value, or a legacy hex string. Only the sRGB color space is supported for now. */
export type ColorValue =
  | string
  | { colorSpace: string; components: [number, number, number]; alpha?: number; hex?: string };

export type Rgb = [number, number, number];

export function toRgb(value: ColorValue): Rgb {
  if (typeof value === "string") return hexToRgb(value);
  if (value.colorSpace === "srgb") return value.components;
  if (value.hex) return hexToRgb(value.hex);
  throw new Error(`Unsupported color space "${value.colorSpace}" (only srgb, or a hex fallback)`);
}

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

/** WCAG 2.x contrast ratio, from 1 to 21. */
export function contrastRatio(a: ColorValue, b: ColorValue): number {
  const la = luminance(toRgb(a));
  const lb = luminance(toRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
