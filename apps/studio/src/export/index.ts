/**
 * A design-system version, exported for code. Every format starts from the same thing: the 87
 * roles, each resolved through the team's mapping to a value per mode. Six shapes come out:
 *
 *   css              the --pxd-* variables per mode, exactly what @polyxd/react's build-themes.ts
 *                    emits for a pack (plus shadcn/ui's variable names), and the pack's extras
 *   dtcg             the pack itself: a manifest and DTCG token files, as one JSON bundle
 *   tailwind         a tailwind.config theme extension, values pointing at the CSS variables
 *   style-dictionary a Style Dictionary v4 source (DTCG format), one tree per mode
 *   swift            a Swift enum per mode with Color and CGFloat values
 *   compose          a Kotlin object per mode with Color(0xFF…) and .dp values
 *
 * A published (live) version exports as is; a draft carries a banner at the top of the file.
 */
import { index, resolve, resolveDeep, type Graph, type Mode } from "../import/read.ts";
import type { Contract } from "../import/map.ts";
import { bezier, cssDim, cssVar, declarations, firstFamily, hex2, ms, px, rgba } from "../tokens/value.ts";

export type Format = "css" | "dtcg" | "tailwind" | "style-dictionary" | "swift" | "compose";
export const FORMATS: Format[] = ["css", "dtcg", "tailwind", "style-dictionary", "swift", "compose"];
export const isFormat = (s: unknown): s is Format => typeof s === "string" && (FORMATS as string[]).includes(s);

export interface ExportInput {
  /** The design system's name; the theme, enum and file names come from it */
  name: string;
  version: number;
  /** draft | live | retired */
  status: string;
  graph: Graph;
  /** role → the team's token it reads, or null when unmapped */
  mapping: Record<string, string | null>;
  contract: Contract & { contractVersion?: string };
  /** The pack's extras stylesheet, when the version came from a template that has one */
  extras?: string;
}

export interface ExportFile {
  fileName: string;
  contentType: string;
  body: string;
}

/* ---- names */

export const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design-system";
const pascal = (s: string) => slug(s).split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
const camel = (role: string) => role.split(/[.-]/).map((w, i) => (i ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join("");
export { cssVar };

/** A mode's name as the renderer's data-pxd-mode: light and dark where the name says so, a slug otherwise. */
export function modeId(name: string): string {
  if (/dark|night/i.test(name)) return "dark";
  if (/light|day|default/i.test(name)) return "light";
  return slug(name);
}

/* ---- values: see tokens/value.ts, shared with the mapper and the preview's theme */
export { px, ms, bezier, rgba, cssColor, cssFamily, declarations } from "../tokens/value.ts";

/** shadcn/ui's variable names, set from the roles so a shadcn app follows the same design system. */
export const SHADCN: Record<string, string> = {
  "--background": "color.surface.default",
  "--foreground": "color.text.default",
  "--card": "color.surface.raised",
  "--card-foreground": "color.text.default",
  "--popover": "color.surface.overlay",
  "--popover-foreground": "color.text.default",
  "--primary": "color.action.primary.background",
  "--primary-foreground": "color.action.primary.foreground",
  "--secondary": "color.action.secondary.background",
  "--secondary-foreground": "color.action.secondary.foreground",
  "--muted": "color.surface.subtle",
  "--muted-foreground": "color.text.muted",
  "--accent": "color.selection.background",
  "--accent-foreground": "color.selection.foreground",
  "--destructive": "color.action.danger.background",
  "--border": "color.border.default",
  "--input": "color.border.strong",
  "--ring": "color.border.focus",
  "--radius": "radius.default",
  "--chart-1": "color.data.categorical.1",
  "--chart-2": "color.data.categorical.2",
  "--chart-3": "color.data.categorical.3",
  "--chart-4": "color.data.categorical.4",
  "--chart-5": "color.data.categorical.5",
};

/* ---- the roles, resolved */

export interface Resolved {
  modes: { name: string; id: string }[];
  /** mode name → role → resolved value (aliases inside composites followed); missing when unmapped or unresolvable */
  values: Map<string, Map<string, unknown>>;
  roles: string[];
  types: Record<string, string>;
  unmapped: string[];
}

export function resolveRoles(input: ExportInput): Resolved {
  const { graph, mapping, contract } = input;
  const byPath = index(graph);
  const modes: Mode[] = graph.modes.length ? graph.modes : [{ name: "default", sets: graph.sets }];
  const values = new Map<string, Map<string, unknown>>();
  const roles = Object.keys(contract.tokens);
  const unmapped = roles.filter((r) => !mapping[r]);
  for (const m of modes) {
    const map = new Map<string, unknown>();
    for (const role of roles) {
      const token = mapping[role];
      if (!token) continue;
      const r = resolve(graph, token, m, byPath);
      if (r.leaf === undefined) continue;
      map.set(role, resolveDeep(graph, r.value, m, byPath));
    }
    values.set(m.name, map);
  }
  // Two modes named so they both read as light (a "Light" and a "Default") would collide; the slug keeps them apart.
  const ids = modes.map((m) => modeId(m.name));
  const modeList = modes.map((m, i) => ({ name: m.name, id: ids.filter((x) => x === ids[i]).length > 1 ? slug(m.name) : ids[i] }));
  return { modes: modeList, values, roles, types: Object.fromEntries(roles.map((r) => [r, contract.tokens[r].type])), unmapped };
}

/* ---- the formats */

const stamp = (input: ExportInput) => `Polyxd Studio, from the ${input.name} design system, v${input.version}`;
const draftLine = (input: ExportInput) => (input.status === "live" ? null : `DRAFT: v${input.version} of ${input.name} is not published. What it says may still change; publish it in Studio before shipping this file.`);

export function exportCss(input: ExportInput): string {
  const { modes, values, roles, types, unmapped } = resolveRoles(input);
  const theme = slug(input.name);
  const blocks: string[] = [`/* Generated by ${stamp(input)}. Do not edit. */`];
  const draft = draftLine(input);
  if (draft) blocks[0] += `\n/* ${draft} */`;
  const defaultMode = modes[0]?.id;
  for (const mode of modes) {
    const vals = values.get(mode.name)!;
    const lines: string[] = [];
    for (const role of roles) {
      const v = vals.get(role);
      if (v === undefined) {
        lines.push(`  /* ${cssVar(role)}: ${unmapped.includes(role) ? "unmapped in Studio" : "the mapped token has no value in this mode"} */`);
        continue;
      }
      for (const [k, val] of declarations(role, types[role], v)) lines.push(`  ${k}: ${val};`);
    }
    lines.push("", "  /* shadcn/ui variable names, so shadcn components follow this pack too */");
    for (const [k, token] of Object.entries(SHADCN)) lines.push(`  ${k}: var(${cssVar(token)});`);
    lines.push(`  color-scheme: ${mode.id === "dark" ? "dark" : "light"};`);
    const selector =
      modes.length === 1
        ? `[data-pxd-theme="${theme}"]`
        : mode.id === defaultMode
          ? `[data-pxd-theme="${theme}"]:not([data-pxd-mode]),\n[data-pxd-theme="${theme}"][data-pxd-mode="${mode.id}"]`
          : `[data-pxd-theme="${theme}"][data-pxd-mode="${mode.id}"]`;
    blocks.push(`${selector} {\n${lines.join("\n")}\n}`);
  }
  if (input.extras !== undefined) {
    // The pack's extras are scoped to the pack's name; here they follow the design system's.
    const scoped = input.extras.replace(/\[data-pxd-theme="[^"]+"\]/g, `[data-pxd-theme="${theme}"]`);
    blocks.push(`/* Extras from the ${theme} pack's manifest: what tokens can't express, appended verbatim, scoped to this theme. */\n${scoped.trim()}`);
  }
  return blocks.join("\n\n") + "\n";
}

/** The graph's sets back into DTCG trees: one file per set, tokens nested by path with $value, $type and $description. */
function setsAsFiles(graph: Graph): Record<string, Record<string, unknown>> {
  const files: Record<string, Record<string, unknown>> = {};
  for (const t of graph.tokens) {
    const file = `tokens/${slug(t.set)}.json`;
    const tree = (files[file] ??= {});
    const parts = t.path.split(".");
    let node: Record<string, unknown> = tree;
    for (const p of parts.slice(0, -1)) node = (node[p] ??= {}) as Record<string, unknown>;
    const leaf: Record<string, unknown> = { $value: t.value };
    if (t.type) leaf.$type = t.type;
    if (t.description) leaf.$description = t.description;
    if (t.deprecated) leaf.$deprecated = true;
    node[parts[parts.length - 1]] = leaf;
  }
  return files;
}

export function exportDtcg(input: ExportInput): string {
  const { graph, contract } = input;
  const files = setsAsFiles(graph);
  const modes = (graph.modes.length ? graph.modes : [{ name: "default", sets: graph.sets }]).map((m) => ({ id: modeId(m.name), files: [...m.sets].reverse().map((s) => `tokens/${slug(s)}.json`).filter((f) => files[f]) }));
  const draft = draftLine(input);
  const bundle: Record<string, unknown> = {
    ...(draft ? { $draft: draft } : {}),
    $comment: `Generated by ${stamp(input)}: the design system as a Polyxd pack, one JSON bundle. Write each entry of "files" to its path beside "manifest" as manifest.json, and the pack checks with polyxd check.`,
    manifest: {
      $schema: "https://polyxd.com/schema/0.3/design-system.schema.json",
      name: slug(input.name),
      displayName: input.name,
      version: `${input.version}.0.0`,
      contractVersion: contract.contractVersion ?? "0.2.0",
      license: "UNLICENSED",
      modes: Object.fromEntries(modes.map((m) => [m.id, m.files])),
      defaultMode: modes[0]?.id ?? "light",
      ...(input.extras !== undefined ? { extras: "tokens/extras.css" } : {}),
      provenance: [{ source: "Polyxd Studio", notes: `Exported from the ${input.name} design system, v${input.version}${input.status === "live" ? " (published)" : " (draft)"}.` }],
    },
    files: { ...files, ...(input.extras !== undefined ? { "tokens/extras.css": input.extras } : {}) },
  };
  return JSON.stringify(bundle, null, 2) + "\n";
}

/** A small JS object writer: nested objects, string leaves, a comment after a leaf when one is given. */
function js(value: unknown, comments: Map<string, string>, path: string[] = [], depth = 0): string {
  const pad = "  ".repeat(depth + 1);
  if (Array.isArray(value)) return `[${value.map((v) => js(v, comments, path, depth)).join(", ")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return "{}";
    const rows = entries.map(([k, v]) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
      const c = comments.get([...path, k].join("."));
      return `${pad}${key}: ${js(v, comments, [...path, k], depth + 1)},${c ? ` // ${c}` : ""}`;
    });
    return `{\n${rows.join("\n")}\n${"  ".repeat(depth)}}`;
  }
  return JSON.stringify(value);
}

export function exportTailwind(input: ExportInput): string {
  const { modes, values, roles, types } = resolveRoles(input);
  const first = values.get(modes[0]?.name ?? "") ?? new Map();
  const comments = new Map<string, string>();
  const ext: Record<string, Record<string, unknown>> = { colors: {}, spacing: {}, borderRadius: {}, borderWidth: {}, fontFamily: {}, fontSize: {}, boxShadow: {}, transitionDuration: {}, transitionTimingFunction: {}, outlineWidth: {}, outlineOffset: {}, opacity: {}, maxWidth: {} };
  const set = (group: string, key: string, role: string, suffix = "", note?: string) => {
    ext[group][key] = `var(${cssVar(role)}${suffix})`;
    const v = first.get(role);
    const shown = note ?? (v === undefined ? "unmapped" : types[role] === "typography" ? undefined : declarations(role, types[role], v)[0][1]);
    if (shown) comments.set(`${group}.${key}`, shown);
  };
  const nest = (group: string, keys: string[], role: string) => {
    let node = ext[group];
    for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as Record<string, unknown>;
    const last = keys[keys.length - 1] === "default" ? "DEFAULT" : keys[keys.length - 1];
    node[last] = `var(${cssVar(role)})`;
    const v = first.get(role);
    comments.set(`${group}.${[...keys.slice(0, -1), last].join(".")}`, v === undefined ? "unmapped" : declarations(role, types[role], v)[0][1]);
  };
  for (const role of roles) {
    const [group, ...rest] = role.split(".");
    const key = rest.join("-");
    if (group === "color") nest("colors", rest, role);
    else if (group === "space") set("spacing", key, role);
    else if (group === "size") set("spacing", key, role);
    else if (group === "radius") set("borderRadius", key === "default" ? "DEFAULT" : key, role);
    else if (group === "border") set("borderWidth", rest[1] === "default" ? "DEFAULT" : rest[1], role);
    else if (group === "type") {
      set("fontFamily", key, role, "-family", `${firstFamily((first.get(role) as any)?.fontFamily) || "unmapped"}`);
      ext.fontSize[key] = [`var(${cssVar(role)}-size)`, { lineHeight: `var(${cssVar(role)}-line-height)`, letterSpacing: `var(${cssVar(role)}-letter-spacing)`, fontWeight: `var(${cssVar(role)}-weight)` }];
      const t = first.get(role) as Record<string, unknown> | undefined;
      if (t) comments.set(`fontSize.${key}`, `${cssDim(t.fontSize)} / ${cssDim(t.lineHeight)}, ${t.fontWeight}`);
    } else if (group === "shadow") set("boxShadow", key, role);
    else if (group === "motion" && rest[0] === "duration") set("transitionDuration", rest[1], role);
    else if (group === "motion" && rest[0] === "easing") set("transitionTimingFunction", rest[1], role);
    else if (group === "focus" && rest[1] === "width") set("outlineWidth", "focus", role);
    else if (group === "focus" && rest[1] === "offset") set("outlineOffset", "focus", role);
    else if (group === "opacity") set("opacity", rest[1], role);
    else if (group === "measure") set("maxWidth", "measure", role);
  }
  for (const k of Object.keys(ext)) if (!Object.keys(ext[k]).length) delete ext[k];
  const draft = draftLine(input);
  const head = [`/**`, ` * Generated by ${stamp(input)}. Do not edit.`, ...(draft ? [` * ${draft}`] : []), ` *`, ` * A theme extension mapping Tailwind's scales to the design system's roles. Values reference the`, ` * --pxd-* variables from the CSS export, so light and dark follow [data-pxd-mode] and a change in`, ` * Studio needs no rebuild here. The comment after each value is what it resolves to in ${modes[0]?.name ?? "the default mode"}.`, ` */`].join("\n");
  return `${head}\nmodule.exports = {\n  theme: {\n    extend: ${js(ext, comments, [], 2)},\n  },\n};\n`;
}

/** DTCG, the shape Style Dictionary v4 reads: $type and $value per token, nested by the role's path. */
function roleTree(vals: Map<string, unknown>, roles: string[], types: Record<string, string>): Record<string, unknown> {
  const tree: Record<string, unknown> = {};
  for (const role of roles) {
    const v = vals.get(role);
    if (v === undefined) continue;
    const parts = role.split(".");
    let node = tree;
    for (const p of parts.slice(0, -1)) node = (node[p] ??= {}) as Record<string, unknown>;
    node[parts[parts.length - 1]] = { $type: types[role], $value: v };
  }
  return tree;
}

export function exportStyleDictionary(input: ExportInput): string {
  const { modes, values, roles, types, unmapped } = resolveRoles(input);
  const draft = draftLine(input);
  const out: Record<string, unknown> = {
    ...(draft ? { $draft: draft } : {}),
    $comment: `Generated by ${stamp(input)}. A Style Dictionary v4 source in the DTCG format: one tree per mode, so a platform picks its mode with "source": ["tokens.json#/${modes[0]?.id ?? "light"}"] or by splitting this file. Every token is a Polyxd role.${unmapped.length ? ` Unmapped in Studio, so absent here: ${unmapped.join(", ")}.` : ""}`,
  };
  for (const m of modes) out[m.id] = roleTree(values.get(m.name)!, roles, types);
  return JSON.stringify(out, null, 2) + "\n";
}

/* Swift and Compose share one reading of each value. */
interface Native {
  /** A line's right-hand side, or null when the value can't be expressed */
  swift: string | null;
  kotlin: string | null;
  note?: string;
}
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));
function native(type: string, v: unknown): Native {
  switch (type) {
    case "color": {
      const c = rgba(v);
      if (!c) return { swift: null, kotlin: null, note: `not a colour this can read: ${JSON.stringify(v)}` };
      const [r, g, b, a] = c;
      const argb = `0x${hex2(a)}${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase().replace("0X", "0x");
      return { swift: `Color(red: ${r.toFixed(3)}, green: ${g.toFixed(3)}, blue: ${b.toFixed(3)}${a < 1 ? `, opacity: ${a.toFixed(3)}` : ""})`, kotlin: `Color(${argb})`, note: typeof v === "string" ? v : undefined };
    }
    case "dimension": {
      const n = px(v);
      return n === null ? { swift: null, kotlin: null, note: `not a length: ${JSON.stringify(v)}` } : { swift: `${num(n)}`, kotlin: `${num(n)}.dp` };
    }
    case "number":
      return typeof v === "number" ? { swift: num(v), kotlin: `${num(v)}f` } : { swift: null, kotlin: null, note: `not a number: ${JSON.stringify(v)}` };
    case "duration": {
      const n = ms(v);
      return n === null ? { swift: null, kotlin: null, note: `not a duration: ${JSON.stringify(v)}` } : { swift: `${num(n / 1000)}`, kotlin: `${num(n)}` };
    }
    case "cubicBezier": {
      const b = bezier(v);
      return b ? { swift: `[${b.map(num).join(", ")}]`, kotlin: `CubicBezierEasing(${b.map((x) => `${num(x)}f`).join(", ")})` } : { swift: null, kotlin: null, note: `not an easing: ${JSON.stringify(v)}` };
    }
    case "typography": {
      const t = (v ?? {}) as Record<string, unknown>;
      const size = px(t.fontSize);
      const lh = typeof t.lineHeight === "number" ? t.lineHeight : px(t.lineHeight);
      const ls = t.letterSpacing === undefined ? 0 : px(t.letterSpacing);
      const weight = Number(t.fontWeight) || 400;
      const fam = firstFamily(t.fontFamily);
      if (size === null) return { swift: null, kotlin: null, note: "a typography value without a size" };
      return {
        swift: `Typography(family: ${JSON.stringify(fam)}, size: ${num(size)}, weight: ${weight}, lineHeight: ${num(lh ?? 1.2)}, letterSpacing: ${num(ls ?? 0)})`,
        kotlin: `Typography(family = ${JSON.stringify(fam)}, size = ${num(size)}.sp, weight = ${weight}, lineHeight = ${num(lh ?? 1.2)}f, letterSpacing = ${num(ls ?? 0)}.sp)`,
        note: typeof t.lineHeight === "number" ? "lineHeight is a ratio of the size" : "lineHeight is in points",
      };
    }
    case "shadow": {
      const layers = (Array.isArray(v) ? v : [v]) as Record<string, unknown>[];
      const parts = layers.map((s) => {
        const c = rgba(s.color);
        if (!c) return null;
        const [r, g, b, a] = c;
        return { x: px(s.offsetX) ?? 0, y: px(s.offsetY) ?? 0, blur: px(s.blur) ?? 0, spread: px(s.spread) ?? 0, r, g, b, a, inset: !!s.inset };
      });
      if (parts.some((p) => !p)) return { swift: null, kotlin: null, note: "a shadow layer with a colour this can't read" };
      const ps = parts as NonNullable<(typeof parts)[number]>[];
      return {
        swift: `[${ps.map((p) => `Shadow(x: ${num(p.x)}, y: ${num(p.y)}, blur: ${num(p.blur)}, spread: ${num(p.spread)}, color: Color(red: ${p.r.toFixed(3)}, green: ${p.g.toFixed(3)}, blue: ${p.b.toFixed(3)}, opacity: ${p.a.toFixed(3)})${p.inset ? ", inset: true" : ""})`).join(", ")}]`,
        kotlin: `listOf(${ps.map((p) => `Shadow(x = ${num(p.x)}.dp, y = ${num(p.y)}.dp, blur = ${num(p.blur)}.dp, spread = ${num(p.spread)}.dp, color = Color(0x${hex2(p.a)}${hex2(p.r)}${hex2(p.g)}${hex2(p.b)}${p.inset ? ", inset = true" : ""}))`.replace(/0x([0-9a-f]{8})/g, (_, h) => `0x${h.toUpperCase()}`)).join(", ")})`,
      };
    }
    default:
      return { swift: null, kotlin: null, note: `no native form for a ${type}` };
  }
}
const swiftType: Record<string, string> = { color: "Color", dimension: "CGFloat", number: "Double", duration: "TimeInterval", cubicBezier: "[Double]", typography: "Typography", shadow: "[Shadow]" };

export function exportSwift(input: ExportInput): string {
  const { modes, values, roles, types, unmapped } = resolveRoles(input);
  const name = `${pascal(input.name)}Tokens`;
  const draft = draftLine(input);
  const lines = [`// Generated by ${stamp(input)}. Do not edit.`, ...(draft ? [`// ${draft}`] : []), `// One enum per mode; every static is a Polyxd role. Lengths are points (1px = 1pt), durations seconds.${unmapped.length ? `\n// Unmapped in Studio, so absent here: ${unmapped.join(", ")}.` : ""}`, "", "import SwiftUI", "", `public enum ${name} {`];
  for (const m of modes) {
    lines.push(`    public enum ${pascal(m.id)} {`);
    const vals = values.get(m.name)!;
    for (const role of roles) {
      const v = vals.get(role);
      if (v === undefined) continue;
      const n = native(types[role], v);
      if (n.swift === null) {
        lines.push(`        // ${camel(role)}: ${n.note}`);
        continue;
      }
      lines.push(`        public static let ${camel(role)}: ${swiftType[types[role]] ?? "String"} = ${n.swift}${n.note ? `  // ${n.note}` : ""}`);
    }
    lines.push("    }", "");
  }
  lines.push(
    "    public struct Typography: Sendable {",
    "        public let family: String",
    "        public let size: CGFloat",
    "        public let weight: Int",
    "        /// A ratio of the size (1.5), or points when the design system gives a length",
    "        public let lineHeight: CGFloat",
    "        public let letterSpacing: CGFloat",
    "        public var font: Font { Font.custom(family, size: size).weight(Typography.weight(weight)) }",
    "        static func weight(_ w: Int) -> Font.Weight { w >= 700 ? .bold : w >= 600 ? .semibold : w >= 500 ? .medium : .regular }",
    "    }",
    "",
    "    public struct Shadow: Sendable {",
    "        public let x: CGFloat, y: CGFloat, blur: CGFloat, spread: CGFloat",
    "        public let color: Color",
    "        public var inset: Bool = false",
    "    }",
    "}",
  );
  return lines.join("\n") + "\n";
}

export function exportCompose(input: ExportInput): string {
  const { modes, values, roles, types, unmapped } = resolveRoles(input);
  const name = `${pascal(input.name)}Tokens`;
  const draft = draftLine(input);
  const lines = [`// Generated by ${stamp(input)}. Do not edit.`, ...(draft ? [`// ${draft}`] : []), `// One object per mode; every val is a Polyxd role. Lengths are dp, durations milliseconds.${unmapped.length ? `\n// Unmapped in Studio, so absent here: ${unmapped.join(", ")}.` : ""}`, "// Put this file in your package and add its package line.", "", "import androidx.compose.animation.core.CubicBezierEasing", "import androidx.compose.ui.graphics.Color", "import androidx.compose.ui.unit.Dp", "import androidx.compose.ui.unit.TextUnit", "import androidx.compose.ui.unit.dp", "import androidx.compose.ui.unit.sp", "", `object ${name} {`];
  for (const m of modes) {
    lines.push(`    object ${pascal(m.id)} {`);
    const vals = values.get(m.name)!;
    for (const role of roles) {
      const v = vals.get(role);
      if (v === undefined) continue;
      const n = native(types[role], v);
      if (n.kotlin === null) {
        lines.push(`        // ${camel(role)}: ${n.note}`);
        continue;
      }
      lines.push(`        val ${camel(role)} = ${n.kotlin}${n.note ? `  // ${n.note}` : ""}`);
    }
    lines.push("    }", "");
  }
  lines.push(
    "    data class Typography(val family: String, val size: TextUnit, val weight: Int, /** a ratio of the size, or px when the design system gives a length */ val lineHeight: Float, val letterSpacing: TextUnit)",
    "    data class Shadow(val x: Dp, val y: Dp, val blur: Dp, val spread: Dp, val color: Color, val inset: Boolean = false)",
    "}",
  );
  return lines.join("\n") + "\n";
}

export function exportDesignSystem(format: Format, input: ExportInput): ExportFile {
  const base = slug(input.name);
  switch (format) {
    case "css":
      return { fileName: `${base}.css`, contentType: "text/css; charset=utf-8", body: exportCss(input) };
    case "dtcg":
      return { fileName: `${base}.pack.json`, contentType: "application/json; charset=utf-8", body: exportDtcg(input) };
    case "tailwind":
      return { fileName: `${base}.tailwind.config.js`, contentType: "text/javascript; charset=utf-8", body: exportTailwind(input) };
    case "style-dictionary":
      return { fileName: `${base}.tokens.json`, contentType: "application/json; charset=utf-8", body: exportStyleDictionary(input) };
    case "swift":
      return { fileName: `${pascal(input.name)}Tokens.swift`, contentType: "text/x-swift; charset=utf-8", body: exportSwift(input) };
    case "compose":
      return { fileName: `${pascal(input.name)}Tokens.kt`, contentType: "text/x-kotlin; charset=utf-8", body: exportCompose(input) };
  }
}
