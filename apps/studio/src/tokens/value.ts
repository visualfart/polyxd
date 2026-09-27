/**
 * Token values as CSS, and as one line of text. A team's tokens arrive in two shapes: strings
 * as CSS writes them ("8px", "#1849a9") and DTCG objects ({ value: 8, unit: "px" }, a typography
 * composite, shadow layers). Everything that shows or exports a value goes through here, so the
 * mapping table, the tokens editor, the theme the preview draws with and the exports agree.
 */
import { alphaOf, toRgb } from "@polyxd/spec/color";

export type Dim = { value: number; unit: string };
export const isDim = (v: unknown): v is Dim => !!v && typeof v === "object" && "value" in v && "unit" in v && typeof (v as Dim).value === "number";

export const cssVar = (token: string) => `--pxd-${token.replace(/\./g, "-")}`;

/** A length in px: a DTCG dimension, a CSS length string, or a bare number. */
export function px(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (isDim(v)) return v.unit === "rem" || v.unit === "em" ? v.value * 16 : v.value;
  if (typeof v === "string") {
    const m = /^(-?[\d.]+)(px|rem|em)?$/.exec(v.trim());
    if (m) return m[2] === "rem" || m[2] === "em" ? Number(m[1]) * 16 : Number(m[1]);
  }
  return null;
}
/** A duration in ms. */
export function ms(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (isDim(v)) return v.unit === "s" ? v.value * 1000 : v.value;
  if (typeof v === "string") {
    const m = /^([\d.]+)(ms|s)$/.exec(v.trim());
    if (m) return m[2] === "s" ? Number(m[1]) * 1000 : Number(m[1]);
  }
  return null;
}
/** The four numbers of an easing: a DTCG cubicBezier array or a cubic-bezier() string. */
export function bezier(v: unknown): number[] | null {
  if (Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number")) return v as number[];
  if (typeof v === "string") {
    const nums = v.match(/-?\d*\.?\d+/g)?.map(Number);
    if (nums && nums.length >= 4) return nums.slice(-4);
  }
  return null;
}
/** sRGB channels 0–1 and alpha, from any colour the spec can read; null when it can't. */
export function rgba(v: unknown): [number, number, number, number] | null {
  try {
    const c = typeof v === "string" ? v : v && typeof v === "object" && ("hex" in v || "colorSpace" in v) ? (v as { hex?: string }) : null;
    if (!c) return null;
    const [r, g, b] = toRgb(c as string);
    return [r, g, b, alphaOf(c as string)];
  } catch {
    return null;
  }
}
export const hex2 = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, "0");

/** As CSS, the way build-themes.ts writes it: strings as they are, DTCG objects as their hex or a color() function. */
export function cssColor(v: unknown): string {
  if (typeof v === "string") return v;
  const c = v as { colorSpace: string; components: number[]; alpha?: number; hex?: string };
  if (c.alpha !== undefined && c.alpha < 1 && c.colorSpace === "srgb") {
    const [r, g, b] = c.components.map((x) => Math.round(x * 255));
    return `rgb(${r} ${g} ${b} / ${c.alpha})`;
  }
  return c.hex ?? `color(${c.colorSpace} ${c.components.join(" ")})`;
}
export const cssDim = (v: unknown) => (isDim(v) ? `${v.value}${v.unit}` : String(v));
export function cssShadow(v: unknown): string {
  const one = (s: any) => `${s.inset ? "inset " : ""}${cssDim(s.offsetX)} ${cssDim(s.offsetY)} ${cssDim(s.blur)} ${cssDim(s.spread)} ${cssColor(s.color)}`;
  return Array.isArray(v) ? v.map(one).join(", ") : one(v);
}
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|math|emoji|fangsong|-apple-system|BlinkMacSystemFont)$/;
/** A CSS font-family list from a DTCG fontFamily value, quoted and with a generic family, as build-themes.ts does it. */
export function cssFamily(v: unknown): string {
  const names = (Array.isArray(v) ? v : String(v).split(",")).map((f) => String(f).trim().replace(/^["']|["']$/g, ""));
  const css = names.map((f) => (GENERIC.test(f) || /^[A-Za-z_][\w-]*$/.test(f) ? f : `"${f}"`));
  if (!names.some((f) => /^(serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace)$/.test(f))) css.push("system-ui", "sans-serif");
  return css.join(", ");
}
export const firstFamily = (v: unknown) => (Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "")).split(",")[0].trim().replace(/^["']|["']$/g, "");

const isShadowLayer = (v: unknown) => !!v && typeof v === "object" && "offsetX" in v && "blur" in v;
const isTypography = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v) && ("fontSize" in v || "fontFamily" in v);

/**
 * A value as one line: a string or number as it is, a DTCG dimension as "8px", an easing as
 * cubic-bezier(), shadow layers and a typography composite as CSS-ish shorthand. Null only for
 * something with no sensible line (an object nobody recognises). What the mapping table, the
 * candidates and the tokens editor show.
 */
export function display(v: unknown): string | null {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (isDim(v)) return cssDim(v);
  const b = bezier(v);
  if (b && Array.isArray(v)) return `cubic-bezier(${b.join(", ")})`;
  if (Array.isArray(v) && v.length && v.every(isShadowLayer)) return cssShadow(v);
  if (isShadowLayer(v)) return cssShadow(v);
  if (isTypography(v)) {
    const t = v as Record<string, unknown>;
    return `${firstFamily(t.fontFamily) || "inherit"} ${cssDim(t.fontSize)}/${cssDim(t.lineHeight ?? 1.2)} ${t.fontWeight ?? 400}`;
  }
  if (v && typeof v === "object" && "colorSpace" in v) return cssColor(v);
  return null;
}

/** CSS declarations for one role, as build-themes.ts's `declarations`: typography expands into its parts. */
export function declarations(role: string, type: string, value: unknown): [string, string][] {
  const v = cssVar(role);
  switch (type) {
    case "color":
      return [[v, cssColor(value)]];
    case "dimension":
    case "duration":
      return [[v, cssDim(value)]];
    case "number":
      return [[v, String(value)]];
    case "cubicBezier": {
      const b = bezier(value);
      return [[v, b ? `cubic-bezier(${b.join(", ")})` : String(value)]];
    }
    case "shadow":
      return [[v, cssShadow(value)]];
    case "fontFamily":
      return [[v, cssFamily(value)]];
    case "typography": {
      const t = (value ?? {}) as Record<string, unknown>;
      return [
        [`${v}-family`, cssFamily(t.fontFamily)],
        [`${v}-size`, cssDim(t.fontSize)],
        [`${v}-weight`, String(t.fontWeight)],
        [`${v}-line-height`, cssDim(t.lineHeight)],
        [`${v}-letter-spacing`, t.letterSpacing === undefined ? "normal" : cssDim(t.letterSpacing)],
      ];
    }
    default:
      return [[v, String(value)]];
  }
}
