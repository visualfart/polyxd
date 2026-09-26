/**
 * What a token file holds, before anything is mapped: how many of each tier and type, which
 * modes, and what is wrong with it. This is the screen a person sees after choosing a file.
 */
import type { Graph, Tier, Token } from "./read.ts";

export type TypeBucket =
  | "color" | "dimension" | "typography" | "fontFamily" | "fontWeight" | "lineHeight" | "letterSpacing"
  | "radius" | "border" | "shadow" | "opacity" | "duration" | "easing" | "zIndex" | "breakpoint" | "number" | "other";

export const TYPE_LABEL: Record<TypeBucket, string> = {
  color: "Colour", dimension: "Dimension (space, size)", typography: "Typography (composite)", fontFamily: "Font family",
  fontWeight: "Font weight", lineHeight: "Line height", letterSpacing: "Letter spacing", radius: "Radius", border: "Border",
  shadow: "Shadow (elevation)", opacity: "Opacity", duration: "Duration", easing: "Easing", zIndex: "Z-index", breakpoint: "Breakpoint",
  number: "Number", other: "Other",
};

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|color\()/i;
const DIMENSION = /^-?\d*\.?\d+(px|rem|em|%|vw|vh|pt)$/;

/** One bucket per token, from its declared type, its name, or failing both, its value. */
export function bucketOf(t: Token): TypeBucket {
  const type = (t.type ?? "").toLowerCase();
  const path = t.path.toLowerCase();
  if (/z-?index/.test(path)) return "zIndex";
  if (/breakpoint|viewport/.test(path)) return "breakpoint";
  switch (type) {
    case "color": return "color";
    case "sizing": case "spacing": case "dimension": case "fontsizes": case "fontsize": case "paragraphspacing": case "size": case "space": return "dimension";
    case "borderradius": case "radius": return "radius";
    case "border": case "borderwidth": case "strokestyle": return "border";
    case "boxshadow": case "shadow": return "shadow";
    case "typography": return "typography";
    case "fontfamilies": case "fontfamily": return "fontFamily";
    case "fontweights": case "fontweight": return "fontWeight";
    case "lineheights": case "lineheight": return "lineHeight";
    case "letterspacing": return "letterSpacing";
    case "opacity": return "opacity";
    case "duration": case "transition": return "duration";
    case "cubicbezier": case "easing": return "easing";
    case "number": return "number";
  }
  if (/radius/.test(path)) return "radius";
  if (/shadow|elevation/.test(path)) return "shadow";
  if (/opacity/.test(path)) return "opacity";
  if (/duration|motion|transition/.test(path)) return "duration";
  if (/eas(e|ing)|curve/.test(path)) return "easing";
  const v = t.value;
  if (typeof v === "string") {
    if (COLOR.test(v.trim())) return "color";
    if (DIMENSION.test(v.trim())) return "dimension";
    if (/^\d*\.?\d+m?s$/.test(v.trim())) return "duration";
    if (/^cubic-bezier|^ease/.test(v.trim())) return "easing";
  }
  if (typeof v === "number") return "number";
  if (v && typeof v === "object" && !Array.isArray(v) && ("fontSize" in v || "fontFamily" in v)) return "typography";
  return "other";
}

export interface Scan {
  format: Graph["format"];
  total: number;
  byTier: Record<Tier, number>;
  byType: { type: TypeBucket; label: string; total: number; primitive: number; semantic: number; component: number }[];
  sets: string[];
  modes: { name: string; sets: string[] }[];
  issues: { kind: string; count: number; examples: string[] }[];
}

export function scan(graph: Graph): Scan {
  const byTier: Record<Tier, number> = { primitive: 0, semantic: 0, component: 0 };
  const byType = new Map<TypeBucket, { primitive: number; semantic: number; component: number }>();
  for (const t of graph.tokens) {
    byTier[t.tier]++;
    const b = bucketOf(t);
    const row = byType.get(b) ?? { primitive: 0, semantic: 0, component: 0 };
    row[t.tier]++;
    byType.set(b, row);
  }
  const issues = new Map<string, string[]>();
  for (const i of graph.issues) issues.set(i.kind, [...(issues.get(i.kind) ?? []), i.message]);
  return {
    format: graph.format,
    total: graph.tokens.length,
    byTier,
    byType: [...byType.entries()]
      .map(([type, n]) => ({ type, label: TYPE_LABEL[type], total: n.primitive + n.semantic + n.component, ...n }))
      .sort((a, b) => b.total - a.total),
    sets: graph.sets,
    modes: graph.modes,
    issues: [...issues.entries()].map(([kind, messages]) => ({ kind, count: messages.length, examples: messages.slice(0, 3) })),
  };
}
