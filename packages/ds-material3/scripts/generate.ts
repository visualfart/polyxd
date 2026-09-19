#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polixd/ds-material3.
 *
 *   node scripts/generate.ts            regenerate tokens/*.json from the vendored sources
 *   node scripts/generate.ts --refresh  first re-download the material-web sources (pinned tag)
 *
 * Colour comes from @material/material-color-utilities (DynamicScheme / SchemeTonalSpot, spec 2021)
 * seeded with the M3 baseline colour. Typescale, shape, motion, state and elevation are parsed from
 * the material-web `tokens/versions/v0_192` SCSS files vendored in scripts/sources/material-web.
 * Output is deterministic: running this twice gives byte-identical files.
 */
import { registerHooks } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DynamicScheme, TonalPalette as Palette } from "@material/material-color-utilities";

// material-color-utilities 0.4.0 ships a few extensionless relative imports (e.g.
// `from '../dynamiccolor/dynamic_scheme'`) that bundlers accept but Node's ESM resolver rejects.
// Retry those with `.js` so the package loads under plain Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.js`, context);
      }
      throw error;
    }
  },
});
const mcu = await import("@material/material-color-utilities");
const { Hct, SchemeTonalSpot, TonalPalette, argbFromHex, hexFromArgb, redFromArgb, greenFromArgb, blueFromArgb } = mcu;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/material-web");
const OUT = join(ROOT, "tokens");

// ---------------------------------------------------------------------------------------------
// Pinned inputs. Keep in sync with manifest.json "provenance" and README.md.
// ---------------------------------------------------------------------------------------------
const MCU_VERSION = "0.4.0";
const MATERIAL_WEB_TAG = "v2.5.0"; // commit b4de401eb665ec63474f39319a4ba8f2145974cc
const MATERIAL_WEB_TOKENS = "tokens/versions/v0_192";
const SOURCE_FILES = [
  "_md-ref-typeface.scss",
  "_md-sys-typescale.scss",
  "_md-sys-shape.scss",
  "_md-sys-motion.scss",
  "_md-sys-state.scss",
  "_md-sys-elevation.scss",
  "_md-comp-scrim.scss",
  "_md-comp-filled-button.scss",
  "_md-comp-icon-button.scss",
  "_md-comp-outlined-text-field.scss",
];

/** M3 baseline seed colour. */
const SEED = "#6750A4";
/** Spec 2021 is the (non-Expressive) M3 colour spec that material-web v0_192 implements. */
const SPEC_VERSION = "2021" as const;

/** Status hues M3 does not define (it only has `error`). One tonal palette per seed. */
const STATUS_SEEDS = { success: "#2E7D32", warning: "#F9A825", info: "#0288D1" } as const;

/** Categorical chart hues: the seed hue, then steps of 60 degrees, ordered so neighbours differ by >= 60. */
const CHART_CHROMA = 48;
const CHART_HUE_OFFSETS = [0, 240, 120, 300, 180, 60];

/** Tones every palette gets (the M3 reference-palette set); tones used by roles are added on top. */
const BASE_TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];

/** The md.sys.color roles material-web v0_192 defines, in kebab-case. */
const SYS_COLOR_ROLES = [
  "background", "on-background",
  "surface", "surface-dim", "surface-bright",
  "surface-container-lowest", "surface-container-low", "surface-container", "surface-container-high", "surface-container-highest",
  "on-surface", "surface-variant", "on-surface-variant",
  "inverse-surface", "inverse-on-surface", "inverse-primary",
  "outline", "outline-variant", "shadow", "scrim", "surface-tint",
  "primary", "on-primary", "primary-container", "on-primary-container",
  "primary-fixed", "primary-fixed-dim", "on-primary-fixed", "on-primary-fixed-variant",
  "secondary", "on-secondary", "secondary-container", "on-secondary-container",
  "secondary-fixed", "secondary-fixed-dim", "on-secondary-fixed", "on-secondary-fixed-variant",
  "tertiary", "on-tertiary", "tertiary-container", "on-tertiary-container",
  "tertiary-fixed", "tertiary-fixed-dim", "on-tertiary-fixed", "on-tertiary-fixed-variant",
  "error", "on-error", "error-container", "on-error-container",
];

/** Tones of the M3 custom-colour roles (color / on-color / color-container / on-color-container). */
const CUSTOM_ROLE_TONES = {
  light: { "": 40, "on-": 100, "-container": 90, "on--container": 30 },
  dark: { "": 80, "on-": 20, "-container": 30, "on--container": 90 },
};

// Values that live outside the vendored v0_192 files (hand-written material-web component tokens).
/** material-web tokens/_md-comp-focus-ring.scss @ v2.5.0: width 3px, outward-offset 2px, color = md.sys.color.secondary. */
const FOCUS_RING = { width: 3, outwardOffset: 2 };
/**
 * material-web elevation/internal/_elevation.scss @ v2.5.0: every level is two box-shadows in
 * md.sys.color.shadow, a key shadow at opacity 0.3 and an ambient shadow at opacity 0.15.
 * [offsetY, blur, spread] per level, copied from the comments in that file.
 */
const ELEVATION_SHADOWS = {
  key: { opacity: 0.3, levels: [[0, 0, 0], [1, 2, 0], [1, 2, 0], [1, 3, 0], [2, 3, 0], [4, 4, 0]] },
  ambient: { opacity: 0.15, levels: [[0, 0, 0], [1, 3, 1], [2, 6, 2], [4, 8, 3], [6, 10, 4], [8, 12, 6]] },
};

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
type Json = Record<string, unknown>;
const round = (n: number, d = 4) => Number(n.toFixed(d));
const px = (value: number) => ({ value: round(value), unit: "px" });
const ms = (value: number) => ({ value, unit: "ms" });
const color = (argb: number, alpha?: number) => ({
  colorSpace: "srgb",
  components: [redFromArgb(argb), greenFromArgb(argb), blueFromArgb(argb)].map((c) => round(c / 255, 6)),
  ...(alpha === undefined ? {} : { alpha }),
  hex: hexFromArgb(argb),
});
const token = (value: unknown, extra: Json = {}) => ({ $value: value, ...extra });
const camel = (kebab: string) => kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Sets a value at a dotted path, creating groups on the way. */
function put(tree: Json, path: string, value: unknown) {
  const keys = path.split(".");
  let node = tree;
  for (const key of keys.slice(0, -1)) node = (node[key] ??= {}) as Json;
  node[keys.at(-1)!] = value;
}

/**
 * Parses the `@return ( 'key': value, ... )` map of a material-web token SCSS file into raw value
 * strings. `if($exclude-hardcoded-values, null, X)` becomes X and `map.get($deps, 'dep', 'key')`
 * becomes `@dep/key`. Composite entries survive as strings and are ignored by the callers.
 */
function parseScssMap(source: string): Map<string, string> {
  const src = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const start = src.indexOf("@return (");
  if (start < 0) throw new Error("no @return map found");
  const entries: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = start + "@return (".length; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    if (ch === ")") {
      if (depth === 0) break;
      depth--;
    }
    if (ch === "," && depth === 0) {
      entries.push(current);
      current = "";
    } else current += ch;
  }
  entries.push(current);
  const out = new Map<string, string>();
  for (const entry of entries) {
    const m = /^\s*'([^']+)'\s*:\s*([\s\S]*?)\s*$/.exec(entry);
    if (!m) continue;
    let value = m[2].replace(/\s+/g, " ");
    const hard = /^if\(\$exclude-hardcoded-values, null, (.*)\)$/.exec(value);
    if (hard) value = hard[1].trim();
    const dep = /^map\.get\(\$deps, '([^']+)', '([^']+)'\)$/.exec(value);
    if (dep) value = `@${dep[1]}/${dep[2]}`;
    out.set(m[1], value);
  }
  return out;
}

async function source(file: string) {
  return parseScssMap(await readFile(join(SOURCES, file), "utf8"));
}

function get(map: Map<string, string>, key: string, file: string) {
  const v = map.get(key);
  if (v === undefined) throw new Error(`${file}: missing '${key}'`);
  return v;
}

const parsePx = (v: string) => {
  const m = /^(-?[\d.]+)(px|rem)$/.exec(v);
  if (!m) throw new Error(`not a length: ${v}`);
  return Number(m[1]) * (m[2] === "rem" ? 16 : 1);
};

/** `@md-ref-typeface/plain` -> `{md.ref.typeface.plain}` */
const depAlias = (v: string) => {
  const m = /^@md-(ref|sys)-([a-z-]+)\/([a-z0-9-]+)$/.exec(v);
  if (!m) throw new Error(`not a token reference: ${v}`);
  return `{md.${m[1]}.${m[2]}.${m[3]}}`;
};

async function refreshSources() {
  await mkdir(SOURCES, { recursive: true });
  for (const file of SOURCE_FILES) {
    const url = `https://raw.githubusercontent.com/material-components/material-web/${MATERIAL_WEB_TAG}/${MATERIAL_WEB_TOKENS}/${file}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    await writeFile(join(SOURCES, file), await res.text());
    console.log(`fetched ${url}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------------------------
const seedHct = Hct.fromInt(argbFromHex(SEED));
type Mode = "light" | "dark";
// Typed as DynamicScheme: the SchemeTonalSpot .d.ts inherits the extensionless-import problem.
const schemes: Record<Mode, DynamicScheme> = {
  light: new SchemeTonalSpot(seedHct, false, 0, SPEC_VERSION) as unknown as DynamicScheme,
  dark: new SchemeTonalSpot(seedHct, true, 0, SPEC_VERSION) as unknown as DynamicScheme,
};

/** Named palettes. `md` palettes come from the scheme; `polixd` palettes are Polixd additions. */
const palettes: { ns: "md" | "polixd"; name: string; palette: Palette; description: string }[] = [
  { ns: "md", name: "primary", palette: schemes.light.primaryPalette, description: "SchemeTonalSpot primary palette" },
  { ns: "md", name: "secondary", palette: schemes.light.secondaryPalette, description: "SchemeTonalSpot secondary palette" },
  { ns: "md", name: "tertiary", palette: schemes.light.tertiaryPalette, description: "SchemeTonalSpot tertiary palette" },
  { ns: "md", name: "neutral", palette: schemes.light.neutralPalette, description: "SchemeTonalSpot neutral palette" },
  { ns: "md", name: "neutral-variant", palette: schemes.light.neutralVariantPalette, description: "SchemeTonalSpot neutral-variant palette" },
  { ns: "md", name: "error", palette: schemes.light.errorPalette, description: "SchemeTonalSpot error palette" },
  ...Object.entries(STATUS_SEEDS).map(([name, hex]) => ({
    ns: "polixd" as const,
    name,
    palette: TonalPalette.fromInt(argbFromHex(hex)),
    description: `TonalPalette.fromInt(${hex}): Polixd status palette (M3 defines no ${name} role)`,
  })),
  ...CHART_HUE_OFFSETS.map((offset, i) => {
    const hue = round((seedHct.hue + offset) % 360, 2);
    return {
      ns: "polixd" as const,
      name: `chart-${i + 1}`,
      palette: TonalPalette.fromHueAndChroma(hue, CHART_CHROMA),
      description: `TonalPalette.fromHueAndChroma(${hue}, ${CHART_CHROMA}): seed hue + ${offset} degrees`,
    };
  }),
];
for (const [mode, scheme] of Object.entries(schemes)) {
  for (const key of ["primaryPalette", "secondaryPalette", "tertiaryPalette", "neutralPalette", "neutralVariantPalette", "errorPalette"] as const) {
    const p = scheme[key];
    const ref = schemes.light[key];
    if (p.hue !== ref.hue || p.chroma !== ref.chroma) throw new Error(`${mode} ${key} differs from light; palettes must be shared`);
  }
}
const paletteRef = (p: { ns: string; name: string }, tone: number) => `{${p.ns}.ref.palette.${p.name}.${tone}}`;
const tonesUsed = new Map(palettes.map((p) => [p.name, new Set(BASE_TONES)]));

/** Resolves an MCU role to `{md.ref.palette.<palette>.<tone>}`, checking the alias is exact. */
function roleAlias(scheme: DynamicScheme, role: string): string {
  const dc = (scheme.colors as unknown as Record<string, () => { palette(s: DynamicScheme): Palette; getTone(s: DynamicScheme): number; getArgb(s: DynamicScheme): number }>)[camel(role)]();
  const pal = dc.palette(scheme);
  const names = { primaryPalette: "primary", secondaryPalette: "secondary", tertiaryPalette: "tertiary", neutralPalette: "neutral", neutralVariantPalette: "neutral-variant", errorPalette: "error" } as const;
  const key = (Object.keys(names) as (keyof typeof names)[]).find((k) => scheme[k] === pal);
  if (!key) throw new Error(`${role}: unknown palette`);
  const name = names[key];
  const tone = dc.getTone(scheme);
  if (!Number.isInteger(tone) || pal.tone(tone) !== dc.getArgb(scheme)) throw new Error(`${role}: tone ${tone} is not an exact palette tone`);
  tonesUsed.get(name)!.add(tone);
  return paletteRef({ ns: "md", name }, tone);
}

function systemColors(mode: Mode) {
  const scheme = schemes[mode];
  const tree: Json = {};
  const colors: Json = { $type: "color" };
  for (const role of SYS_COLOR_ROLES) colors[role] = token(roleAlias(scheme, role));
  put(tree, "md.sys.color", colors);

  const custom: Json = { $type: "color", $description: "Polixd additions shaped like M3 custom-colour roles (M3 has no success/warning/info roles, nor chart colours)." };
  for (const name of Object.keys(STATUS_SEEDS)) {
    const p = palettes.find((x) => x.name === name)!;
    for (const [pattern, tone] of Object.entries(CUSTOM_ROLE_TONES[mode])) {
      const role = pattern === "on--container" ? `on-${name}-container` : pattern.startsWith("on-") ? `on-${name}` : `${name}${pattern}`;
      custom[role] = token(paletteRef(p, tone));
      tonesUsed.get(name)!.add(tone);
    }
  }
  for (const p of palettes.filter((x) => x.name.startsWith("chart-"))) {
    const tone = CUSTOM_ROLE_TONES[mode][""];
    custom[p.name] = token(paletteRef(p, tone));
    tonesUsed.get(p.name)!.add(tone);
  }
  put(tree, "polixd.sys.color", custom);
  return tree;
}

// ---------------------------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------------------------
if (process.argv.includes("--refresh")) await refreshSources();

const [typeface, typescale, shape, motion, state, elevation, scrim, filledButton, iconButton, outlinedTextField] = await Promise.all(SOURCE_FILES.map(source));
const mw = (file: string) => `material-web ${MATERIAL_WEB_TAG} ${MATERIAL_WEB_TOKENS}/${file}`;

// system.light.json / system.dark.json (computing these first records which palette tones are used)
const systemLight = { $description: "Material 3 system tier, light mode: md.sys.color roles from material-color-utilities SchemeTonalSpot (spec 2021, contrast 0) aliased to reference palette tones, plus Polixd status and chart roles.", ...systemColors("light") };
const systemDark = { $description: "Material 3 system tier, dark mode: md.sys.color roles from material-color-utilities SchemeTonalSpot (spec 2021, contrast 0) aliased to reference palette tones, plus Polixd status and chart roles.", ...systemColors("dark") };

// primitive.json
const primitive: Json = {
  $description: `Material 3 reference tier (md.ref.*) plus Polixd reference additions (polixd.ref.*). Palettes generated with @material/material-color-utilities ${MCU_VERSION} from seed ${SEED}; typefaces from ${mw("_md-ref-typeface.scss")}.`,
};
for (const p of palettes) {
  const group: Json = { $type: "color", $description: `${p.description}. HCT hue ${round(p.palette.hue, 2)}, chroma ${round(p.palette.chroma, 2)}.` };
  for (const tone of [...tonesUsed.get(p.name)!].sort((a, b) => a - b)) group[String(tone)] = token(color(p.palette.tone(tone)));
  put(primitive, `${p.ns}.ref.palette.${p.name}`, group);
}
const typefaceGroup: Json = { $description: `From ${mw("_md-ref-typeface.scss")}` };
for (const key of ["brand", "plain"]) typefaceGroup[key] = token(get(typeface, key, "typeface").replace(/^\((.*)\)$/, "$1"), { $type: "fontFamily" });
for (const key of ["weight-regular", "weight-medium", "weight-bold"]) typefaceGroup[key] = token(Number(get(typeface, key, "typeface")), { $type: "fontWeight" });
put(primitive, "md.ref.typeface", typefaceGroup);
const spaceGroup: Json = { $type: "dimension", $description: "M3 4dp layout grid: polixd.ref.space.N = N x 4px" };
for (const n of [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16]) spaceGroup[String(n)] = token(px(n * 4));
put(primitive, "polixd.ref.space", spaceGroup);

// system.json (mode-independent md.sys tokens)
const system: Json = { $description: `Material 3 system tier, mode-independent: typescale, shape, motion, state and elevation from ${mw("_md-sys-*.scss")}.` };
const typescaleGroup: Json = { $description: `From ${mw("_md-sys-typescale.scss")}; rem converted to px at 16px/rem` };
for (const role of ["display", "headline", "title", "body", "label"]) {
  for (const size of ["large", "medium", "small"]) {
    const s = `${role}-${size}`;
    typescaleGroup[`${s}-font`] = token(depAlias(get(typescale, `${s}-font`, "typescale")), { $type: "fontFamily" });
    typescaleGroup[`${s}-weight`] = token(depAlias(get(typescale, `${s}-weight`, "typescale")), { $type: "fontWeight" });
    typescaleGroup[`${s}-size`] = token(px(parsePx(get(typescale, `${s}-size`, "typescale"))), { $type: "dimension" });
    typescaleGroup[`${s}-line-height`] = token(px(parsePx(get(typescale, `${s}-line-height`, "typescale"))), { $type: "dimension" });
    typescaleGroup[`${s}-tracking`] = token(px(parsePx(get(typescale, `${s}-tracking`, "typescale"))), { $type: "dimension" });
  }
}
put(system, "md.sys.typescale", typescaleGroup);
const shapeGroup: Json = { $type: "dimension", $description: `From ${mw("_md-sys-shape.scss")}. Per-corner composites (e.g. corner-large-top) are omitted: DTCG has no four-corner type.` };
for (const [key, v] of shape) if (/^[\d.]+px$/.test(v)) shapeGroup[key] = token(px(parsePx(v)));
put(system, "md.sys.shape", shapeGroup);
const motionGroup: Json = { $description: `From ${mw("_md-sys-motion.scss")}. 'path' is omitted (no DTCG type).` };
for (const [key, v] of motion) {
  const dur = /^(\d+)ms$/.exec(v);
  const bez = /^cubic-bezier\(([^)]*)\)$/.exec(v);
  if (dur) motionGroup[key] = token(ms(Number(dur[1])), { $type: "duration" });
  else if (bez) motionGroup[key] = token(bez[1].split(",").map(Number), { $type: "cubicBezier" });
}
put(system, "md.sys.motion", motionGroup);
const stateGroup: Json = { $type: "number", $description: `From ${mw("_md-sys-state.scss")}` };
for (const [key, v] of state) stateGroup[key] = token(Number(v));
put(system, "md.sys.state", stateGroup);
const elevationGroup: Json = { $description: `Levels (dp, as px) from ${mw("_md-sys-elevation.scss")}; shadows from material-web ${MATERIAL_WEB_TAG} elevation/internal/_elevation.scss (key shadow at 0.3 and ambient shadow at 0.15 opacity of md.sys.color.shadow, #000000 in both modes).` };
for (let level = 0; level <= 5; level++) {
  elevationGroup[`level${level}`] = token(px(Number(get(elevation, `level${level}`, "elevation"))), { $type: "dimension" });
}
put(system, "md.sys.elevation", elevationGroup);
const shadowGroup: Json = { $type: "shadow", $description: elevationGroup.$description };
for (let level = 1; level <= 5; level++) {
  shadowGroup[`level${level}`] = token(
    (["key", "ambient"] as const).map((layer) => {
      const { opacity, levels } = ELEVATION_SHADOWS[layer];
      const [y, blur, spread] = levels[level];
      return { color: color(0xff000000, opacity), offsetX: px(0), offsetY: px(y), blur: px(blur), spread: px(spread) };
    }),
  );
}
put(system, "polixd.sys.elevation.shadow", shadowGroup);

// semantic.json
const typeStyle = (m3: string) => {
  const size = parsePx(get(typescale, `${m3}-size`, "typescale"));
  const lineHeight = parsePx(get(typescale, `${m3}-line-height`, "typescale"));
  return token(
    {
      fontFamily: `{md.sys.typescale.${m3}-font}`,
      fontSize: `{md.sys.typescale.${m3}-size}`,
      fontWeight: `{md.sys.typescale.${m3}-weight}`,
      lineHeight: round(lineHeight / size),
      letterSpacing: `{md.sys.typescale.${m3}-tracking}`,
    },
    { $description: `md.sys.typescale.${m3} (lineHeight = ${lineHeight}px / ${size}px)` },
  );
};
const compNumber = (map: Map<string, string>, key: string, file: string) => Number(get(map, key, file));
const compPx = (map: Map<string, string>, key: string, file: string) => px(parsePx(get(map, key, file)));
const sys = (role: string) => token(`{md.sys.color.${role}}`);
const ext = (role: string) => token(`{polixd.sys.color.${role}}`);

const scrimOpacity = compNumber(scrim, "container-opacity", "scrim");
const semantic = {
  $description: "Polixd semantic tier for Material 3. Every token maps to an M3 system (md.sys.*) or reference (md.ref.*) token wherever an M3 equivalent exists; mode differences come from the system files.",
  color: {
    $type: "color",
    surface: {
      default: sys("surface"),
      subtle: sys("surface-container"),
      raised: { ...sys("surface-container-low"), $description: "md.comp.elevated-card.container.color" },
      overlay: { ...sys("surface-container-high"), $description: "md.comp.dialog.container.color" },
      inverse: sys("inverse-surface"),
    },
    scrim: token(color(0xff000000, scrimOpacity), { $description: `md.sys.color.scrim (#000000 in both modes) at md.comp.scrim.container.opacity ${scrimOpacity}; a literal because an alias cannot add alpha` }),
    text: {
      default: sys("on-surface"),
      muted: sys("on-surface-variant"),
      inverse: sys("inverse-on-surface"),
      link: sys("primary"),
    },
    border: {
      default: sys("outline-variant"),
      strong: sys("outline"),
      focus: { ...sys("secondary"), $description: "material-web md-focus-ring color" },
    },
    action: {
      primary: { background: sys("primary"), foreground: sys("on-primary") },
      secondary: { background: sys("secondary-container"), foreground: sys("on-secondary-container"), border: sys("outline") },
      danger: { background: sys("error"), foreground: sys("on-error") },
    },
    selection: { background: sys("secondary-container"), foreground: sys("on-secondary-container") },
    status: {
      info: { background: ext("info-container"), foreground: ext("on-info-container"), emphasis: ext("info") },
      success: { background: ext("success-container"), foreground: ext("on-success-container"), emphasis: ext("success") },
      warning: { background: ext("warning-container"), foreground: ext("on-warning-container"), emphasis: ext("warning") },
      danger: { background: sys("error-container"), foreground: sys("on-error-container"), emphasis: sys("error") },
    },
    data: {
      categorical: Object.fromEntries(CHART_HUE_OFFSETS.map((_, i) => [String(i + 1), ext(`chart-${i + 1}`)])),
      positive: ext("success"),
      negative: sys("error"),
      neutral: sys("outline"),
    },
  },
  type: {
    $type: "typography",
    title: { page: typeStyle("headline-large"), section: typeStyle("title-large"), item: typeStyle("title-medium") },
    body: { default: typeStyle("body-large"), small: typeStyle("body-medium") },
    label: { default: typeStyle("label-large"), small: typeStyle("label-medium") },
    numeric: { display: typeStyle("display-small") },
  },
  space: {
    $type: "dimension",
    $description: "M3 4dp grid",
    inset: { compact: token("{polixd.ref.space.2}"), default: token("{polixd.ref.space.4}"), comfortable: token("{polixd.ref.space.6}") },
    stack: { tight: token("{polixd.ref.space.1}"), default: token("{polixd.ref.space.2}"), loose: token("{polixd.ref.space.4}"), section: token("{polixd.ref.space.8}") },
    inline: { tight: token("{polixd.ref.space.1}"), default: token("{polixd.ref.space.2}"), loose: token("{polixd.ref.space.4}") },
  },
  size: {
    $type: "dimension",
    target: { min: token(px(48), { $description: "M3 minimum touch target, 48x48dp" }) },
    icon: {
      small: token(compPx(filledButton, "with-icon-icon-size", "filled-button"), { $description: "md.comp.filled-button.with-icon.icon.size" }),
      default: token(compPx(iconButton, "icon-size", "icon-button"), { $description: "md.comp.icon-button.icon.size" }),
    },
  },
  radius: {
    $type: "dimension",
    small: token("{md.sys.shape.corner-extra-small}"),
    default: token("{md.sys.shape.corner-medium}"),
    large: token("{md.sys.shape.corner-extra-large}"),
    full: token("{md.sys.shape.corner-full}"),
  },
  border: {
    width: {
      $type: "dimension",
      default: token(compPx(outlinedTextField, "outline-width", "outlined-text-field"), { $description: "md.comp.outlined-text-field.outline.width" }),
      strong: token(compPx(outlinedTextField, "focus-outline-width", "outlined-text-field"), { $description: "md.comp.outlined-text-field.focus.outline.width" }),
    },
  },
  focus: {
    ring: {
      $type: "dimension",
      width: token(px(FOCUS_RING.width), { $description: "material-web md-focus-ring width" }),
      offset: token(px(FOCUS_RING.outwardOffset), { $description: "material-web md-focus-ring outward-offset" }),
    },
  },
  measure: { max: token(65, { $type: "number", $description: "Characters per line for running text" }) },
  opacity: {
    state: {
      $type: "number",
      hover: token("{md.sys.state.hover-state-layer-opacity}"),
      pressed: token("{md.sys.state.pressed-state-layer-opacity}"),
      focus: token("{md.sys.state.focus-state-layer-opacity}"),
      disabled: token(compNumber(filledButton, "disabled-label-text-opacity", "filled-button"), { $description: "md.comp.*.disabled.label-text.opacity (M3 disabled content opacity)" }),
    },
  },
  shadow: {
    $type: "shadow",
    raised: token("{polixd.sys.elevation.shadow.level1}", { $description: "md.sys.elevation.level1 (elevated card)" }),
    overlay: token("{polixd.sys.elevation.shadow.level3}", { $description: "md.sys.elevation.level3 (dialog)" }),
  },
  motion: {
    duration: {
      $type: "duration",
      instant: token("{md.sys.motion.duration-short1}"),
      short: token("{md.sys.motion.duration-short4}"),
      medium: token("{md.sys.motion.duration-medium2}"),
      long: token("{md.sys.motion.duration-long2}"),
    },
    easing: {
      $type: "cubicBezier",
      standard: token("{md.sys.motion.easing-standard}"),
      enter: token("{md.sys.motion.easing-emphasized-decelerate}"),
      exit: token("{md.sys.motion.easing-emphasized-accelerate}"),
    },
  },
};

await mkdir(OUT, { recursive: true });
const files: [string, unknown][] = [
  ["primitive.json", primitive],
  ["system.json", system],
  ["system.light.json", systemLight],
  ["system.dark.json", systemDark],
  ["semantic.json", semantic],
];
for (const [name, tree] of files) {
  await writeFile(join(OUT, name), `${JSON.stringify(tree, null, 2)}\n`);
  console.log(`wrote tokens/${name}`);
}
