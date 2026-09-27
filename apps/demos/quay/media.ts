/**
 * Product pictures. The demo ships no photography: a media reference ("media:candle:amber-oak")
 * becomes an SVG drawn here, a flat product silhouette on a colour taken from the scent, so every
 * product looks like itself across the index, the order page and a generated surface. The same
 * function is the renderer's `resolveMedia`, so a document never carries a URL.
 */
export type Silhouette = "candle" | "diffuser" | "melt" | "gift" | "accessory";

/** Scent → hue, so Amber & Oak is always warm and Sea Salt & Sage is always cool. */
const HUES: Record<string, number> = {
  "amber-oak": 30,
  "sea-salt-sage": 165,
  "fig-cassis": 320,
  "cedar-smoke": 20,
  "lavender-field": 265,
  "vanilla-bean": 42,
  "black-currant": 300,
  "fresh-linen": 205,
  "orange-blossom": 22,
  "pine-birch": 140,
  "tobacco-leaf": 14,
  "rose-water": 345,
  "eucalyptus-mint": 158,
  sandalwood: 34,
  brass: 40,
  black: 0,
  natural: 45,
  white: 210,
  sage: 120,
  terracotta: 18,
};

const SHAPES: Record<Silhouette, string> = {
  candle: `<rect x="34" y="42" width="52" height="56" rx="6" fill="#fff" opacity=".92"/><rect x="34" y="42" width="52" height="10" rx="3" fill="#000" opacity=".08"/><path d="M60 40c-4-6-1-10 0-13 1 3 4 7 0 13z" fill="#f4b23a"/><rect x="59" y="34" width="2" height="7" fill="#333"/><rect x="42" y="62" width="36" height="18" rx="2" fill="#000" opacity=".06"/>`,
  diffuser: `<path d="M46 98V66c0-6 3-9 7-11h14c4 2 7 5 7 11v32z" fill="#fff" opacity=".92"/><rect x="54" y="42" width="12" height="14" rx="2" fill="#fff" opacity=".92"/><g stroke="#8a6b48" stroke-width="2.2" stroke-linecap="round"><path d="M60 44V20"/><path d="M60 44L44 24"/><path d="M60 44l16-20"/><path d="M60 44L50 18"/><path d="M60 44l10-26"/></g>`,
  melt: `<g fill="#fff" opacity=".92"><rect x="30" y="50" width="16" height="16" rx="3"/><rect x="52" y="50" width="16" height="16" rx="3"/><rect x="74" y="50" width="16" height="16" rx="3"/><rect x="30" y="72" width="16" height="16" rx="3"/><rect x="52" y="72" width="16" height="16" rx="3"/><rect x="74" y="72" width="16" height="16" rx="3"/></g>`,
  gift: `<rect x="28" y="52" width="64" height="46" rx="5" fill="#fff" opacity=".92"/><rect x="24" y="44" width="72" height="14" rx="4" fill="#fff"/><rect x="56" y="44" width="8" height="54" fill="#000" opacity=".12"/><path d="M60 44c-8-10-18-8-16-2s12 4 16 2c4 2 14 4 16-2s-8-8-16 2z" fill="#000" opacity=".18"/>`,
  accessory: `<circle cx="60" cy="70" r="26" fill="#fff" opacity=".92"/><circle cx="60" cy="70" r="12" fill="#000" opacity=".1"/><rect x="58" y="22" width="4" height="30" rx="2" fill="#fff" opacity=".9"/>`,
};

const slug = (s: string) => s.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The reference a product carries: "media:candle:amber-oak". */
export const mediaRef = (kind: Silhouette, scent: string, n = 0) => `media:${kind}:${slug(scent)}${n ? `:${n}` : ""}`;

/** The renderer's resolveMedia: a data URL for a reference, undefined for anything else. */
export function resolveMedia(ref: string): string | undefined {
  const m = /^media:(candle|diffuser|melt|gift|accessory):([a-z0-9-]+)(?::(\d+))?$/.exec(ref);
  if (!m) return undefined;
  const kind = m[1] as Silhouette;
  const hue = HUES[m[2]] ?? (m[2].split("").reduce((s, c) => s + c.charCodeAt(0), 0) % 360);
  const shade = Number(m[3] ?? 0);
  const bg = `hsl(${hue} ${kind === "accessory" ? 12 : 38}% ${72 - shade * 6}%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" fill="${bg}"/>${SHAPES[kind]}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
