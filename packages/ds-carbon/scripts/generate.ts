#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-carbon.
 *
 *   node scripts/generate.ts                          regenerate tokens/*.json from the vendored sources
 *   node scripts/generate.ts --refresh <node_modules>  first re-extract scripts/sources/carbon/*.json from an
 *                                                     installed copy of the pinned Carbon packages
 *
 * To refresh, install the pinned packages somewhere OUTSIDE the monorepo, e.g.
 *   cd "$(mktemp -d)" && npm init -y && npm install --ignore-scripts \
 *     @carbon/colors@11.58.0 @carbon/themes@11.81.0 @carbon/layout@11.59.0 \
 *     @carbon/type@11.67.0 @carbon/motion@11.52.0 @carbon/charts@1.27.20
 * and pass that directory's node_modules. The generator itself only reads the vendored JSON, has no
 * dependencies, and is deterministic: running it twice gives byte-identical files.
 */
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/carbon");
const OUT = join(ROOT, "tokens");

// ---------------------------------------------------------------------------------------------
// Pinned inputs. Keep in sync with manifest.json "provenance" and README.md.
// ---------------------------------------------------------------------------------------------
const PINNED = {
  "@carbon/colors": "11.58.0",
  "@carbon/themes": "11.81.0",
  "@carbon/layout": "11.59.0",
  "@carbon/type": "11.67.0",
  "@carbon/motion": "11.52.0",
  "@carbon/charts": "1.27.20",
} as const;

/** Carbon themes this pack exposes, keyed by Polyxd mode. */
const MODES = { light: "white", dark: "g100" } as const;
type Mode = keyof typeof MODES;

/** Type styles vendored from @carbon/type (productive set, plus code). */
const TYPE_STYLES = [
  "body01", "body02", "bodyCompact01", "bodyCompact02",
  "heading01", "heading02", "heading03", "heading04", "heading05", "heading06", "heading07",
  "headingCompact01", "headingCompact02",
  "label01", "label02", "helperText01", "helperText02", "legal01", "legal02",
  "code01", "code02",
];
/** Component token groups vendored from @carbon/themes (keys of the JS export). */
const COMPONENT_GROUPS = ["buttonTokens", "notificationTokens", "statusTokens"];

// Values transcribed from @carbon/styles 1.115.0 (Apache-2.0); not vendored because they are Sass mixins.
/** scss/utilities/_box-shadow.scss: `@mixin box-shadow { box-shadow: 0 2px 6px theme.$shadow; }` (menus, dropdowns, overflow menus). */
const BOX_SHADOW = { offsetY: 2, blur: 6 };
/** scss/utilities/_focus-outline.scss, type 'outline': `outline: 2px solid theme.$focus; outline-offset: -2px`. */
const FOCUS_OUTLINE = { width: 2, offset: -2 };

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
type Json = Record<string, unknown>;
const round = (n: number, d = 4) => Number(n.toFixed(d));
const px = (value: number) => ({ value: round(value), unit: "px" });
const ms = (value: number) => ({ value, unit: "ms" });
const token = (value: unknown, extra: Json = {}) => ({ $value: value, ...extra });
/** `borderStrong01` -> `border-strong-01`, `coolGray` -> `cool-gray` (Carbon's Sass spelling). */
const kebab = (camel: string) => camel.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/([a-zA-Z])(\d)/g, "$1-$2").toLowerCase();

function put(tree: Json, path: string, value: unknown) {
  const keys = path.split(".");
  let node = tree;
  for (const key of keys.slice(0, -1)) node = (node[key] ??= {}) as Json;
  node[keys.at(-1)!] = value;
}

const parseLength = (v: string | number): number => {
  if (v === 0 || v === "0") return 0;
  const m = /^(-?[\d.]+)(px|rem)$/.exec(String(v));
  if (!m) throw new Error(`not a length: ${v}`);
  return Number(m[1]) * (m[2] === "rem" ? 16 : 1);
};
const parseMs = (v: string) => {
  const m = /^(\d+)ms$/.exec(v);
  if (!m) throw new Error(`not a duration: ${v}`);
  return Number(m[1]);
};
const parseBezier = (v: string) => {
  const m = /^cubic-bezier\(([^)]*)\)$/.exec(v);
  if (!m) throw new Error(`not a cubic-bezier: ${v}`);
  return m[1].split(",").map(Number);
};
/** `'IBM Plex Sans', system-ui, sans-serif` -> ["IBM Plex Sans", "system-ui", "sans-serif"] */
const parseFamily = (v: string) => v.split(",").map((f) => f.trim().replace(/^'(.*)'$/, "$1"));

/** Parses `#rrggbb` or `rgba(r, g, b, a)` into 0-255 channels plus alpha. */
function parseColor(v: string): { rgb: [number, number, number]; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/.exec(v);
  if (rgba) return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], alpha: rgba[4] === undefined ? 1 : Number(rgba[4]) };
  throw new Error(`unsupported colour: ${v}`);
}
const toHex = (rgb: number[]) => `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
const dtcgColor = (v: string) => {
  const { rgb, alpha } = parseColor(v);
  return { colorSpace: "srgb", components: rgb.map((c) => round(c / 255, 6)), ...(alpha === 1 ? {} : { alpha }), hex: toHex(rgb) };
};

// ---------------------------------------------------------------------------------------------
// --refresh: extract the small token data we need from installed Carbon packages
// ---------------------------------------------------------------------------------------------
async function refreshSources(nodeModules: string) {
  const require = createRequire(join(nodeModules, "noop.js"));
  const meta: Record<string, { version: string; license: string }> = {};
  for (const [pkg, version] of Object.entries(PINNED)) {
    const json = JSON.parse(await readFile(join(nodeModules, pkg, "package.json"), "utf8"));
    if (json.version !== version) throw new Error(`${pkg}: installed ${json.version}, pinned ${version}`);
    meta[pkg] = { version: json.version, license: json.license };
  }
  const src = (pkg: keyof typeof PINNED, what: string) => ({ package: pkg, version: meta[pkg].version, license: meta[pkg].license, extracted: what });
  const write = async (file: string, data: unknown) => {
    await writeFile(join(SOURCES, file), `${JSON.stringify(data, null, 2)}\n`);
    console.log(`vendored scripts/sources/carbon/${file}`);
  };
  await mkdir(SOURCES, { recursive: true });

  const colors = require("@carbon/colors");
  await write("colors.json", { $source: src("@carbon/colors", "colors, hoverColors (JS export)"), colors: colors.colors, hoverColors: colors.hoverColors });

  const themes = require("@carbon/themes");
  const core = (theme: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(theme).filter(([k, v]) => typeof v === "string" && k !== "colorScheme" && !/^(ai|chat|syntax)[A-Z]/.test(k)));
  const components: Json = {};
  for (const group of COMPONENT_GROUPS) {
    const out: Json = {};
    for (const [name, byTheme] of Object.entries(themes[group] as Record<string, Record<string, string>>)) {
      out[name] = { white: byTheme.whiteTheme, g100: byTheme.g100 };
    }
    components[group] = out;
  }
  await write("themes.json", {
    $source: src("@carbon/themes", "white and g100 theme objects (JS export; ai*, chat* and syntax* tokens omitted) and buttonTokens, notificationTokens, statusTokens for white/g100"),
    themes: { white: core(themes.white), g100: core(themes.g100) },
    components,
  });

  const layout = require("@carbon/layout");
  await write("layout.json", {
    $source: src("@carbon/layout", "baseFontSize, spacing, sizes, iconSize, borderRadius (JS export)"),
    baseFontSize: layout.baseFontSize,
    spacing: layout.spacing,
    sizes: { xs: layout.sizeXSmall, sm: layout.sizeSmall, md: layout.sizeMedium, lg: layout.sizeLarge, xl: layout.sizeXLarge, "2xl": layout.size2XLarge },
    iconSize: layout.iconSize,
    borderRadius: layout.borderRadius,
  });

  const type = require("@carbon/type");
  await write("type.json", {
    $source: src("@carbon/type", "fontFamilies, fontWeights and productive type styles (JS export)"),
    fontFamilies: type.fontFamilies,
    fontWeights: type.fontWeights,
    styles: Object.fromEntries(TYPE_STYLES.map((s) => [s, type[s]])),
  });

  const motion = require("@carbon/motion");
  await write("motion.json", {
    $source: src("@carbon/motion", "easings and durations (JS export)"),
    easings: motion.easings,
    durations: { fast01: motion.fast01, fast02: motion.fast02, moderate01: motion.moderate01, moderate02: motion.moderate02, slow01: motion.slow01, slow02: motion.slow02 },
  });

  // Categorical palette: @carbon/charts scss/_color-palette.scss, 14-colour option 1 of the white and dark maps.
  const scss = await readFile(join(nodeModules, "@carbon/charts/scss/_color-palette.scss"), "utf8");
  const categorical = (mapName: string) => {
    const start = scss.indexOf(`$${mapName}:`);
    if (start < 0) throw new Error(`charts: no $${mapName}`);
    const block = scss.slice(scss.indexOf("'14': (", start));
    const entries: (string | [string, number])[] = [];
    for (const line of block.split("\n").slice(2)) {
      const fn = /^\s*'(\d+)': getColorValue\((\w+), (\d+)\)/.exec(line);
      const lit = /^\s*'(\d+)': (#[0-9a-f]{6})/i.exec(line);
      if (fn) entries.push([fn[2], Number(fn[3])]);
      else if (lit) entries.push(lit[2].toLowerCase());
      else if (/^\s*\)/.test(line)) break;
    }
    if (entries.length !== 14) throw new Error(`charts: expected 14 colours in $${mapName}, got ${entries.length}`);
    return entries;
  };
  await write("charts.json", {
    $source: src("@carbon/charts", "scss/_color-palette.scss: $white-theme-colors and $dark-theme-colors, key '14' option '1' (the 14-colour categorical sequence). Entries are [family, step] (getColorValue) or a literal hex."),
    categorical: { white: categorical("white-theme-colors"), dark: categorical("dark-theme-colors") },
  });

  await copyFile(join(nodeModules, "@carbon/themes/LICENSE"), join(SOURCES, "LICENSE"));
  console.log("vendored scripts/sources/carbon/LICENSE (Apache-2.0, from @carbon/themes)");
}

const refreshAt = process.argv.indexOf("--refresh");
if (refreshAt >= 0) {
  const dir = process.argv[refreshAt + 1];
  if (!dir) throw new Error("--refresh needs the path of a node_modules directory containing the pinned Carbon packages");
  await refreshSources(dir);
}

// ---------------------------------------------------------------------------------------------
// Load vendored sources
// ---------------------------------------------------------------------------------------------
const load = async (file: string) => JSON.parse(await readFile(join(SOURCES, file), "utf8"));
const [colorsSrc, themesSrc, layoutSrc, typeSrc, motionSrc, chartsSrc] = await Promise.all(
  ["colors.json", "themes.json", "layout.json", "type.json", "motion.json", "charts.json"].map(load),
);
for (const s of [colorsSrc, themesSrc, layoutSrc, typeSrc, motionSrc, chartsSrc]) {
  const { package: pkg, version } = s.$source;
  if (PINNED[pkg as keyof typeof PINNED] !== version) throw new Error(`vendored ${pkg} is ${version}, pinned ${PINNED[pkg as keyof typeof PINNED]}`);
}
const v = (pkg: keyof typeof PINNED) => `${pkg}@${PINNED[pkg]}`;

// ---------------------------------------------------------------------------------------------
// primitive.json: palette, type families/weights, spacing, sizes, radius, motion
// ---------------------------------------------------------------------------------------------
/** hex -> palette token name. Base steps win over hover steps; gray wins over cool/warm gray. */
const paletteByHex = new Map<string, string>();
const FAMILY_ORDER = ["white", "black", "gray", "coolGray", "warmGray", "blue", "cyan", "teal", "green", "yellow", "orange", "red", "magenta", "purple"];
const colorGroup: Json = {
  $type: "color",
  $description: `Carbon colour palette from ${v("@carbon/colors")} (colors + hoverColors). Hover steps are named <step>-hover, as in Carbon's Sass ($gray-10-hover).`,
};
for (const fam of FAMILY_ORDER) {
  const steps = colorsSrc.colors[fam] as Record<string, string>;
  if (!steps) throw new Error(`palette: no ${fam}`);
  const group: Json = {};
  for (const [step, hex] of Object.entries(steps)) {
    const name = `carbon.color.${kebab(fam)}.${step}`;
    group[step] = token(dtcgColor(hex));
    if (!paletteByHex.has(hex.toLowerCase())) paletteByHex.set(hex.toLowerCase(), name);
  }
  colorGroup[kebab(fam)] = group;
}
for (const fam of FAMILY_ORDER) {
  const hover = colorsSrc.hoverColors[`${fam}Hover`] as string | Record<string, string>;
  const group = colorGroup[kebab(fam)] as Json;
  const entries: [string, string][] = typeof hover === "string" ? [["hover", hover]] : Object.entries(hover).map(([s, h]) => [`${s}-hover`, h]);
  for (const [key, hex] of entries) {
    group[key] = token(dtcgColor(hex));
    if (!paletteByHex.has(hex.toLowerCase())) paletteByHex.set(hex.toLowerCase(), `carbon.color.${kebab(fam)}.${key}`);
  }
}

const primitive: Json = {
  $description: `IBM Carbon primitive tier: palette (${v("@carbon/colors")}), IBM Plex families and weights (${v("@carbon/type")}), spacing, sizes, icon sizes and border radius (${v("@carbon/layout")}), durations and easings (${v("@carbon/motion")}). rem converted to px at ${layoutSrc.baseFontSize}px/rem.`,
};
put(primitive, "carbon.color", colorGroup);

const familyGroup: Json = { $type: "fontFamily", $description: `@carbon/type fontFamilies (${v("@carbon/type")})` };
for (const [k, stack] of Object.entries(typeSrc.fontFamilies as Record<string, string>)) familyGroup[kebab(k)] = token(parseFamily(stack));
put(primitive, "carbon.type.font-family", familyGroup);
const weightGroup: Json = { $type: "fontWeight", $description: `@carbon/type fontWeights (${v("@carbon/type")})` };
for (const [k, w] of Object.entries(typeSrc.fontWeights as Record<string, number>)) weightGroup[k] = token(w);
put(primitive, "carbon.type.font-weight", weightGroup);

const spacingGroup: Json = { $type: "dimension", $description: `Carbon 8px-based spacing scale, $spacing-01..13 (${v("@carbon/layout")})` };
(layoutSrc.spacing as string[]).forEach((s, i) => (spacingGroup[String(i + 1).padStart(2, "0")] = token(px(parseLength(s)))));
put(primitive, "carbon.spacing", spacingGroup);
const sizeGroup: Json = { $type: "dimension", $description: `Carbon component sizes, $size-xs..2xl (${v("@carbon/layout")})` };
for (const [k, s] of Object.entries(layoutSrc.sizes as Record<string, string>)) sizeGroup[k] = token(px(parseLength(s)));
put(primitive, "carbon.size", sizeGroup);
const iconGroup: Json = { $type: "dimension", $description: `Carbon icon sizes, $icon-size-01/02 (${v("@carbon/layout")})` };
(layoutSrc.iconSize as string[]).forEach((s, i) => (iconGroup[String(i + 1).padStart(2, "0")] = token(px(parseLength(s)))));
put(primitive, "carbon.icon-size", iconGroup);
const radiusGroup: Json = { $type: "dimension", $description: `Carbon border radius, $border-radius-00..max (${v("@carbon/layout")}). Carbon components are square (00); max is for pills and avatars.` };
for (const [k, s] of Object.entries(layoutSrc.borderRadius as Record<string, string>)) radiusGroup[k.replace(/^border-radius-/, "")] = token(px(parseLength(s)));
put(primitive, "carbon.border-radius", radiusGroup);

const durationGroup: Json = { $type: "duration", $description: `Carbon durations, $duration-fast-01..slow-02 (${v("@carbon/motion")})` };
for (const [k, d] of Object.entries(motionSrc.durations as Record<string, string>)) durationGroup[kebab(k)] = token(ms(parseMs(d)));
put(primitive, "carbon.motion.duration", durationGroup);
const easingGroup: Json = { $type: "cubicBezier", $description: `Carbon easings, motion(<name>, <mode>) (${v("@carbon/motion")})` };
for (const [name, modes] of Object.entries(motionSrc.easings as Record<string, Record<string, string>>)) {
  easingGroup[name] = Object.fromEntries(Object.entries(modes).map(([mode, b]) => [mode, token(parseBezier(b))]));
}
put(primitive, "carbon.motion.easing", easingGroup);

// ---------------------------------------------------------------------------------------------
// system.json: type styles and shadows (mode-independent)
// ---------------------------------------------------------------------------------------------
const familyKeyByStack = new Map(Object.entries(typeSrc.fontFamilies as Record<string, string>).map(([k, s]) => [s, kebab(k)]));
const weightKeyByValue = new Map(Object.entries(typeSrc.fontWeights as Record<string, number>).map(([k, w]) => [w, k]));
const system: Json = {
  $description: `IBM Carbon system tier, mode-independent: productive type styles (${v("@carbon/type")}) and shadows (@carbon/styles 1.115.0 utilities/_box-shadow.scss).`,
};
const typeGroup: Json = { $type: "typography", $description: `Carbon type styles from ${v("@carbon/type")}. Carbon sets font-family: sans on every style except code, and helper-text inherits weight (regular).` };
for (const style of TYPE_STYLES) {
  const s = typeSrc.styles[style] as { fontFamily?: string; fontSize: string; fontWeight?: number; lineHeight: number; letterSpacing: string | number };
  const family = s.fontFamily ? familyKeyByStack.get(s.fontFamily) : "sans";
  if (!family) throw new Error(`${style}: unknown font family ${s.fontFamily}`);
  const weight = weightKeyByValue.get(s.fontWeight ?? 400);
  if (!weight) throw new Error(`${style}: unknown weight ${s.fontWeight}`);
  typeGroup[kebab(style)] = token({
    fontFamily: `{carbon.type.font-family.${family}}`,
    fontSize: px(parseLength(s.fontSize)),
    fontWeight: `{carbon.type.font-weight.${weight}}`,
    lineHeight: s.lineHeight,
    letterSpacing: px(parseLength(s.letterSpacing)),
  });
}
put(system, "carbon.type", typeGroup);
const shadowPart = (y: number, blur: number) => ({ color: "{carbon.theme.shadow}", offsetX: px(0), offsetY: px(y), blur: px(blur), spread: px(0) });
put(system, "carbon.shadow", {
  $type: "shadow",
  "box-shadow": token(shadowPart(BOX_SHADOW.offsetY, BOX_SHADOW.blur), {
    $description: "@carbon/styles 1.115.0 scss/utilities/_box-shadow.scss: box-shadow: 0 2px 6px $shadow (menus, dropdowns, overflow menus)",
  }),
});
put(system, "polyxd.shadow", {
  $type: "shadow",
  flat: token({ color: dtcgColor("rgba(0, 0, 0, 0)"), offsetX: px(0), offsetY: px(0), blur: px(0), spread: px(0) }, {
    $description: "Polyxd addition: no shadow. Carbon tiles and cards are flat and are set apart by $layer colour, not elevation.",
  }),
});

// ---------------------------------------------------------------------------------------------
// system.<mode>.json: Carbon theme tokens (+ component tokens) and Polyxd per-mode additions
// ---------------------------------------------------------------------------------------------
/** A theme colour: an alias when it is an exact palette step, otherwise a literal (with the source noted). */
function themeColor(value: string): Json {
  const { rgb, alpha } = parseColor(value);
  const ref = paletteByHex.get(toHex(rgb));
  if (alpha === 1 && ref) return token(`{${ref}}`);
  if (alpha === 1) return token(dtcgColor(value), { $description: `${value}: not a palette step` });
  return token(dtcgColor(value), { $description: `${ref ?? toHex(rgb)} at alpha ${alpha} (${value}); a literal because an alias cannot add alpha` });
}
const alphaOf = (value: string) => parseColor(value).alpha;

/** WCAG 2.x contrast of two opaque theme colours, for the adjustment notes below. */
function contrast(a: string, b: string) {
  const lum = (v: string) => {
    const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [r, g, bl] = parseColor(v).rgb.map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
}

/**
 * Contrast adjustments. When the natural Carbon token fails a contract pair, the semantic tier points
 * at a polyxd.theme.* token that aliases the nearest Carbon token that passes (see README "Contrast").
 */
function adjusted(mode: Mode, values: Record<string, string>, components: Record<string, Record<string, string | undefined>>) {
  const bg = values.background;
  if (mode === "light") {
    const outline = components.statusYellowOutline.white!;
    return {
      "warning-emphasis": {
        value: "{carbon.theme.status-yellow-outline}",
        description: `Adjusted: $support-warning (${values.supportWarning}) is ${contrast(values.supportWarning, bg)}:1 on $background (${bg}), below 3:1. $status-yellow-outline (${outline}), Carbon's own outline for yellow status shapes on light themes, is ${contrast(outline, bg)}:1.`,
      },
    };
  }
  return {
    "warning-emphasis": { value: "{carbon.theme.support-warning}", description: `$support-warning, unadjusted (${contrast(values.supportWarning, bg)}:1 on $background)` },
  };
}
/** Carbon has no opacity tokens; its hover/active/selected fills are $gray-50 with an alpha. */
const DISABLED_OPACITY = { carbon: 0.25, adjusted: 0.3 };

function systemMode(mode: Mode) {
  const theme = MODES[mode];
  const values = themesSrc.themes[theme] as Record<string, string>;
  const tree: Json = {
    $description: `IBM Carbon system tier, ${mode} mode: the Carbon ${theme === "white" ? "White" : "Gray 100"} theme (${v("@carbon/themes")}) as carbon.theme.*, with component tokens (button, notification, status) and the ${v("@carbon/charts")} categorical palette, plus Polyxd per-mode additions (polyxd.theme.*).`,
  };
  const group: Json = { $type: "color" };
  for (const [name, value] of Object.entries(values)) group[kebab(name)] = themeColor(value);
  for (const comp of COMPONENT_GROUPS) {
    for (const [name, byTheme] of Object.entries(themesSrc.components[comp] as Record<string, Record<string, string | undefined>>)) {
      const value = byTheme[theme];
      if (value === undefined) continue; // e.g. $status-yellow-outline is only defined for white/g10
      if (kebab(name) in group) throw new Error(`${name} clashes with a theme token`);
      group[kebab(name)] = themeColor(value);
    }
  }
  put(tree, "carbon.theme", group);

  const chartTheme = mode === "light" ? "white" : "dark";
  const viz: Json = { $type: "color", $description: `${v("@carbon/charts")} scss/_color-palette.scss, 14-colour categorical palette (option 1) for the ${chartTheme} theme(s)` };
  (chartsSrc.categorical[chartTheme] as (string | [string, number])[]).forEach((entry, i) => {
    const ref = typeof entry === "string" ? paletteByHex.get(entry) : `carbon.color.${kebab(entry[0])}.${entry[1]}`;
    if (!ref) throw new Error(`charts ${chartTheme} ${i + 1}: ${entry} is not a palette step`);
    viz[String(i + 1).padStart(2, "0")] = token(`{${ref}}`, typeof entry === "string" ? { $description: `${entry} (a literal in @carbon/charts; equals ${ref})` } : {});
  });
  put(tree, "carbon.data-viz.categorical", viz);

  const extra: Json = { $type: "color", $description: "Polyxd per-mode additions: contrast adjustments and state opacities derived from Carbon theme tokens." };
  for (const [name, a] of Object.entries(adjusted(mode, values, themesSrc.components.statusTokens))) extra[name] = token(a.value, { $description: a.description });
  extra.opacity = {
    $type: "number",
    hover: token(alphaOf(values.backgroundHover), { $description: `Alpha of $background-hover (${values.backgroundHover})` }),
    pressed: token(alphaOf(values.backgroundActive), { $description: `Alpha of $background-active (${values.backgroundActive})` }),
    focus: token(alphaOf(values.backgroundHover), { $description: "Carbon marks focus with the $focus outline, not a fill; reuses the $background-hover alpha for renderers that paint a focus layer" }),
    disabled: token(DISABLED_OPACITY.adjusted, {
      $description: `Adjusted: Carbon $text-disabled / $icon-disabled are text-primary at alpha ${alphaOf(values.textDisabled)} (${values.textDisabled}), below the contract minimum 0.3; raised to 0.3`,
    }),
  };
  if (alphaOf(values.textDisabled) !== DISABLED_OPACITY.carbon) throw new Error(`${theme}: $text-disabled alpha changed; review DISABLED_OPACITY`);
  put(tree, "polyxd.theme", extra);
  return tree;
}
const systemLight = systemMode("light");
const systemDark = systemMode("dark");

// ---------------------------------------------------------------------------------------------
// semantic.json
// ---------------------------------------------------------------------------------------------
const t = (name: string, description?: string) => token(`{carbon.theme.${name}}`, description ? { $description: description } : {});
const p = (name: string, description?: string) => token(`{polyxd.theme.${name}}`, description ? { $description: description } : {});
const type = (style: string, description?: string) => token(`{carbon.type.${style}}`, description ? { $description: description } : {});
const sp = (step: string) => token(`{carbon.spacing.${step}}`);

const semantic = {
  $description: "Polyxd semantic tier for IBM Carbon (light = White theme, dark = Gray 100 theme). Every token aliases a Carbon token (carbon.*) wherever Carbon has one; polyxd.* tokens mark contrast adjustments and values Carbon does not define. The file is the same in both modes.",
  color: {
    $type: "color",
    surface: {
      default: t("background"),
      subtle: t("layer-accent-01", "Carbon data-table header / accent layer"),
      raised: t("layer-01", "Carbon tile"),
      overlay: t("layer-01", "Carbon modal, menu and popover container ($layer on $background)"),
      inverse: t("background-inverse", "Carbon tooltip / inline notification (low contrast off)"),
    },
    scrim: t("overlay", "Carbon modal backdrop: black at 0.6"),
    text: {
      default: t("text-primary"),
      muted: t("text-secondary"),
      inverse: t("text-inverse"),
      link: t("link-primary"),
    },
    border: {
      default: t("border-subtle-01"),
      strong: t("border-strong-01"),
      focus: t("focus"),
    },
    action: {
      primary: { background: t("button-primary"), foreground: t("text-on-color") },
      secondary: {
        background: t("button-secondary"),
        foreground: t("text-on-color"),
        border: t("button-secondary", "Carbon secondary buttons are borderless; the border matches the fill"),
      },
      danger: { background: t("button-danger-primary"), foreground: t("text-on-color") },
    },
    selection: { background: t("layer-selected-01"), foreground: t("text-primary") },
    status: {
      info: { background: t("notification-background-info"), foreground: t("text-primary"), emphasis: t("support-info") },
      success: { background: t("notification-background-success"), foreground: t("text-primary"), emphasis: t("support-success") },
      warning: { background: t("notification-background-warning"), foreground: t("text-primary"), emphasis: p("warning-emphasis", "Light: adjusted to $status-yellow-outline; dark: $support-warning") },
      danger: { background: t("notification-background-error"), foreground: t("text-primary"), emphasis: t("support-error") },
    },
    data: {
      categorical: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [String(i), token(`{carbon.data-viz.categorical.${String(i).padStart(2, "0")}}`)])),
      positive: t("support-success"),
      negative: t("support-error"),
      neutral: t("status-gray"),
    },
  },
  type: {
    $type: "typography",
    title: {
      page: type("heading-05"),
      section: type("heading-03"),
      item: type("heading-02"),
    },
    body: {
      default: type("body-02", "Carbon body-02 (16px). Carbon's default body style is body-01 (14px), but the contract requires >= 16px"),
      small: type("body-01"),
    },
    label: {
      default: type("label-02", "Same metrics as body-compact-01, Carbon's button and control text"),
      small: type("label-01"),
    },
    numeric: { display: type("heading-06") },
  },
  space: {
    $type: "dimension",
    $description: "Carbon 8px-based spacing scale ($spacing-NN)",
    inset: { compact: sp("03"), default: sp("05"), comfortable: sp("06") },
    stack: { tight: sp("03"), default: sp("05"), loose: sp("07"), section: sp("09") },
    inline: { tight: sp("02"), default: sp("03"), loose: sp("05") },
  },
  size: {
    $type: "dimension",
    target: { min: token("{carbon.size.lg}", { $description: "Carbon $size-lg (48px), the large control height; Carbon's default (md) is 40px" }) },
    icon: { small: token("{carbon.icon-size.01}"), default: token("{carbon.icon-size.02}") },
  },
  radius: {
    $type: "dimension",
    small: token("{carbon.border-radius.00}", { $description: "Carbon components have square corners" }),
    control: token("{carbon.border-radius.00}", { $description: "Carbon buttons are square" }),
    default: token("{carbon.border-radius.00}"),
    large: token("{carbon.border-radius.00}"),
    full: token("{carbon.border-radius.max}", { $description: "Pills and avatars (tags, toggles)" }),
  },
  border: {
    width: {
      $type: "dimension",
      default: token(px(1), { $description: "Carbon 1px borders (dividers, tile and field outlines)" }),
      strong: token(px(2), { $description: "Carbon 2px emphasis (selected tile, invalid field, focus outline)" }),
    },
  },
  focus: {
    ring: {
      $type: "dimension",
      width: token(px(FOCUS_OUTLINE.width), { $description: "@carbon/styles focus-outline('outline'): 2px solid $focus" }),
      offset: token(px(FOCUS_OUTLINE.offset), { $description: "@carbon/styles focus-outline('outline'): outline-offset -2px (Carbon draws focus inside the element edge)" }),
    },
  },
  measure: { max: token(65, { $type: "number", $description: "Polyxd: characters per line for running text (Carbon defines no measure token)" }) },
  opacity: {
    state: {
      $type: "number",
      hover: p("opacity.hover"),
      pressed: p("opacity.pressed"),
      focus: p("opacity.focus"),
      disabled: p("opacity.disabled"),
    },
  },
  shadow: {
    $type: "shadow",
    raised: token("{polyxd.shadow.flat}", { $description: "Carbon tiles are flat" }),
    overlay: token("{carbon.shadow.box-shadow}", { $description: "Carbon box-shadow mixin (menus, dropdowns)" }),
  },
  motion: {
    duration: {
      $type: "duration",
      instant: token("{carbon.motion.duration.fast-01}"),
      short: token("{carbon.motion.duration.fast-02}"),
      medium: token("{carbon.motion.duration.moderate-02}"),
      long: token("{carbon.motion.duration.slow-01}"),
    },
    easing: {
      $type: "cubicBezier",
      standard: token("{carbon.motion.easing.standard.productive}"),
      enter: token("{carbon.motion.easing.entrance.productive}"),
      exit: token("{carbon.motion.easing.exit.productive}"),
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
