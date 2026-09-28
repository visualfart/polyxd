/**
 * Pack logos.
 *
 * A pack that reproduces a real design system ships that system's official logo, downloaded from
 * its owner and recorded in the manifest's `logo` field (file, source, guidelines). Those are not
 * made here and are never redrawn.
 *
 * A template pack is Polyxd's own, so it gets a Polyxd-made mark instead: a small card drawn in
 * the pack's own tokens (its ground, border, radius, text, primary action and one accent), so the
 * mark is a specimen of the pack rather than a logo. `templateMark` draws it from the resolved
 * tokens of the pack's default mode, and `packages/ds-kit/scripts/pack-logos.ts` writes it to
 * `packages/ds-<name>/logo.svg`; a test fails when a mark no longer matches its tokens.
 */
import { rgbToHex, toRgb, alphaOf, type TokenSet, type ColorValue } from "@polyxd/spec";

/** What a manifest records about its logo. */
export interface PackLogo {
  /** The logo file, relative to the manifest. Absent only when `text` stands in for a protected mark. */
  file?: string;
  /** The owner's own version for dark grounds, when the owner publishes one. Never a recolour of `file`. */
  dark?: string;
  /** Where the file came from: the owner's own site or repository, or "Polyxd" for a template mark. */
  source?: string;
  /** For a system whose marks may not be used (GOV.UK's crown and logotype): the words to set in the host's own type instead. */
  text?: string;
  /** The owner's brand or trademark guidelines for using the logo. */
  guidelines?: string;
  /** The colours the file is drawn in, as the owner provides them. */
  colours?: string[];
  /** Anything a reader should know: why this mark, what it may be used for. */
  note?: string;
}

const px = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "value" in v) {
    const { value, unit } = v as { value: number; unit?: string };
    return unit === "rem" ? value * 16 : value;
  }
  return 0;
};

/** A colour as `#rrggbb`, plus its alpha when it isn't opaque, for an SVG fill. */
function paint(value: unknown): { hex: string; alpha: number } {
  const c = value as ColorValue;
  return { hex: rgbToHex(toRgb(c)), alpha: Math.round(alphaOf(c) * 1000) / 1000 };
}
const fill = (value: unknown, attr = "fill") => {
  const { hex, alpha } = paint(value);
  return alpha < 1 ? `${attr}="${hex}" ${attr}-opacity="${alpha}"` : `${attr}="${hex}"`;
};
const round = (n: number) => Math.round(n * 100) / 100;
const chroma = (value: unknown) => {
  const [r, g, b] = toRgb(value as ColorValue);
  return Math.max(r, g, b) - Math.min(r, g, b);
};
const distance = (a: unknown, b: unknown) => {
  const x = toRgb(a as ColorValue);
  const y = toRgb(b as ColorValue);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/**
 * The pack's one accent beside its primary: the most saturated of the colours a pack uses to set
 * itself apart (secondary fill, selection, the second and first chart hues, links) that is not the
 * primary itself. Undefined when none is vivid enough to read at 6px.
 */
function accentOf(tokens: TokenSet): unknown {
  const primary = tokens.get("color.action.primary.background")?.value;
  const candidates = ["color.action.secondary.background", "color.selection.background", "color.data.categorical.2", "color.data.categorical.1", "color.text.link"]
    .map((name) => tokens.get(name)?.value)
    .filter((v) => v !== undefined && alphaOf(v as ColorValue) === 1 && distance(v, primary) > 0.25);
  let best: unknown;
  for (const c of candidates) if (chroma(c) >= 0.35 && (best === undefined || chroma(c) > chroma(best))) best = c;
  return best;
}

/**
 * A template pack's mark: a 32-unit tile drawn only from the pack's tokens.
 *
 * The tile is the pack's ground (`color.surface.default`) with its strong border at its default
 * border width and its default radius (scaled to the tile); inside sit a title bar
 * (`color.text.default`), a muted line (`color.text.muted`), a button (`color.action.primary.background`
 * at the control radius) and, when the pack has one, a dot of its accent. A pack whose raised shadow
 * is hard (no blur, an offset) casts it, so Brutalist looks like Brutalist.
 */
export function templateMark(tokens: TokenSet, title: string): string {
  const get = (name: string) => {
    const t = tokens.get(name);
    if (!t) throw new Error(`templateMark: the pack has no ${name}`);
    return t.value;
  };
  const scale = 0.4;
  const stroke = Math.min(2.5, Math.max(1, px(get("border.width.default"))));
  const shadow = (Array.isArray(get("shadow.raised")) ? get("shadow.raised") : [get("shadow.raised")]) as { offsetX: unknown; offsetY: unknown; blur: unknown; color: unknown }[];
  const hard = shadow.find((s) => px(s.blur) === 0 && (px(s.offsetX) || px(s.offsetY)) && alphaOf(s.color as ColorValue) > 0);
  const dx = hard ? Math.min(3, px(hard.offsetX) * 0.5) : 0;
  const dy = hard ? Math.min(3, px(hard.offsetY) * 0.5) : 0;

  const inset = stroke / 2;
  const w = 32 - inset * 2 - dx;
  const h = 32 - inset * 2 - dy;
  const rx = round(Math.min(10, px(get("radius.default")) * scale));
  const control = px(get("radius.control"));
  const buttonRx = round(Math.min(3, control >= 999 ? 3 : control * scale));
  const lineRx = round(Math.min(1, rx));
  const accent = accentOf(tokens);

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    hard ? `<rect x="${round(inset + dx)}" y="${round(inset + dy)}" width="${round(w)}" height="${round(h)}" rx="${rx}" ${fill(hard.color)}/>` : "",
    `<rect x="${round(inset)}" y="${round(inset)}" width="${round(w)}" height="${round(h)}" rx="${rx}" ${fill(get("color.surface.default"))} ${fill(get("color.border.strong"), "stroke")} stroke-width="${stroke}"/>`,
    `<rect x="7" y="8" width="12" height="3" rx="${lineRx}" ${fill(get("color.text.default"))}/>`,
    `<rect x="7" y="13.5" width="16" height="2" rx="${lineRx}" ${fill(get("color.text.muted"))}/>`,
    `<rect x="7" y="19" width="12" height="6" rx="${buttonRx}" ${fill(get("color.action.primary.background"))}/>`,
    accent !== undefined ? `<circle cx="${round(23 - dx / 2)}" cy="22" r="2.75" ${fill(accent)}/>` : "",
    `</svg>`,
  ];
  return parts.filter(Boolean).join("\n") + "\n";
}
