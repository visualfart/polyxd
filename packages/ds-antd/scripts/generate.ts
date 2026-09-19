#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-antd.
 *
 *   node scripts/generate.ts
 *
 * Works offline from scripts/sources/antd/antd-tokens.json: the design tokens antd 6.6.4 computes
 * for its default seed with theme.defaultAlgorithm (mode `light`) and theme.darkAlgorithm (mode
 * `dark`), plus the @ant-design/colors 8.0.1 preset palettes and the palettes the algorithms derive
 * from each colour seed. scripts/sources/antd/dump-antd-tokens.mjs produced that file (see README).
 *
 * The semantic tier is checked here against the Polyxd contract's contrast pairs with alpha
 * compositing. Where Ant's natural token fails a pair, the generator moves that role to the nearest
 * step of the same Ant palette that passes every pair it is in, and prints each adjustment.
 * Output is deterministic: running this twice gives byte-identical files.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "scripts/sources/antd/antd-tokens.json");
const CONTRACT = join(ROOT, "../spec/tokens/semantic-contract.json");
const OUT = join(ROOT, "tokens");

// ---------------------------------------------------------------------------------------------
// Pinned inputs. Keep in sync with manifest.json "provenance" and README.md.
// ---------------------------------------------------------------------------------------------
const ANTD_VERSION = "6.6.4";
const COLORS_VERSION = "8.0.1";

type Mode = "light" | "dark";
const MODES: Mode[] = ["light", "dark"];
type Json = Record<string, unknown>;
type Primitive = string | number | boolean;

interface Dump {
  versions: Record<string, string>;
  seed: Record<string, Primitive>;
  map: Record<Mode, Record<string, Primitive>>;
  alias: Record<Mode, Record<string, Primitive>>;
  presetPalettes: Record<string, string[]>;
  presetDarkPalettes: Record<string, string[]>;
  seedPalettes: Record<string, { seed: string; light: string[]; dark: string[] }>;
}
const dump: Dump = JSON.parse(await readFile(SOURCE, "utf8"));
if (dump.versions.antd !== ANTD_VERSION || dump.versions["@ant-design/colors"] !== COLORS_VERSION) {
  throw new Error(`vendored dump is ${JSON.stringify(dump.versions)}, generator is pinned to antd ${ANTD_VERSION} / @ant-design/colors ${COLORS_VERSION}`);
}

/** Seed palette names: `colorPrimary` -> `primary`. */
const SEED_PALETTES: Record<string, string> = { colorPrimary: "primary", colorSuccess: "success", colorWarning: "warning", colorError: "error", colorInfo: "info" };
const PRESETS = Object.keys(dump.presetPalettes);

// ---------------------------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------------------------
const round = (n: number, d = 4) => Number(n.toFixed(d));
const px = (value: number) => ({ value: round(value), unit: "px" });
const token = (value: unknown, extra: Json = {}) => ({ $value: value, ...extra });

interface Rgba { r: number; g: number; b: number; a: number }
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");
const toHex = (c: Rgba) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;

function parseColor(input: string): Rgba {
  const s = input.trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return { r: parseInt(m[1][0].repeat(2), 16), g: parseInt(m[1][1].repeat(2), 16), b: parseInt(m[1][2].repeat(2), 16), a: 1 };
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = /^rgba?\(([^)]*)\)$/.exec(s);
  if (m) {
    const [r, g, b, a = 1] = m[1].split(",").map((x) => Number(x.trim()));
    return { r, g, b, a };
  }
  throw new Error(`not a colour: ${input}`);
}
const isColor = (v: unknown): v is string => typeof v === "string" && /^(#[0-9a-f]{3,8}|rgba?\(|transparent$)/i.test(v.trim());

/** DTCG colour value. `alpha` only when translucent. */
const dtcgColor = (c: Rgba) => ({
  colorSpace: "srgb",
  components: [c.r, c.g, c.b].map((x) => round(x / 255, 6)),
  ...(c.a < 1 ? { alpha: round(c.a) } : {}),
  hex: toHex(c),
});

/** Source-over compositing of `fg` onto an opaque `bg`, rounded to 8-bit like a browser would. */
const composite = (fg: Rgba, bg: Rgba): Rgba => ({
  r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
  g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
  b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
  a: 1,
});
const luminance = (c: Rgba) => {
  const lin = (x: number) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
};
/** WCAG 2.x contrast, compositing a translucent foreground onto the (opaque) background first. */
const contrast = (fg: Rgba, bg: Rgba) => {
  const [a, b] = [luminance(composite(fg, bg)), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** `"\n 0 6px 16px 0 rgba(0,0,0,0.08),\n ..."` -> DTCG shadow layers. */
function parseShadow(css: string) {
  const layers = css.split(/,(?![^(]*\))/).map((l) => l.trim()).filter(Boolean);
  return layers.map((layer) => {
    const inset = /^inset\s+/.test(layer);
    const body = layer.replace(/^inset\s+/, "");
    const colorMatch = /(rgba?\([^)]*\)|#[0-9a-f]{3,8})\s*$/i.exec(body);
    if (!colorMatch) throw new Error(`shadow layer without colour: ${layer}`);
    const lengths = body.slice(0, colorMatch.index).trim().split(/\s+/).map((l) => {
      const m = /^(-?[\d.]+)(px)?$/.exec(l);
      if (!m) throw new Error(`bad shadow length ${l} in ${layer}`);
      return Number(m[1]);
    });
    const [offsetX, offsetY, blur = 0, spread = 0] = lengths;
    return { color: dtcgColor(parseColor(colorMatch[1])), offsetX: px(offsetX), offsetY: px(offsetY), blur: px(blur), spread: px(spread), ...(inset ? { inset: true } : {}) };
  });
}

const parseFontFamily = (v: string) => v.split(",").map((f) => f.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
const parseSeconds = (v: string) => {
  const m = /^([\d.]+)s$/.exec(v);
  if (!m) throw new Error(`not a duration: ${v}`);
  return { value: round(Number(m[1]) * 1000, 0), unit: "ms" };
};
const parseBezier = (v: string) => {
  const m = /^cubic-bezier\(([^)]*)\)$/.exec(v);
  if (!m) throw new Error(`not a cubic-bezier: ${v}`);
  return m[1].split(",").map(Number);
};

/**
 * Converts one antd token to a DTCG token (without aliasing), or undefined when DTCG has no type
 * for it (booleans, `lineType`, text-decoration keywords, CSS `filter` drop-shadows).
 */
function toDtcg(name: string, v: Primitive): { $type: string; $value: unknown } | undefined {
  if (typeof v === "boolean" || v === "") return undefined;
  if (typeof v === "number") {
    if (/^fontWeight/.test(name)) return { $type: "fontWeight", $value: v };
    if (/^(lineHeight|opacity|zIndex|motionUnit|motionBase)/.test(name)) return { $type: "number", $value: round(v, 6) };
    return { $type: "dimension", $value: px(v) };
  }
  if (/^boxShadow/.test(name)) return { $type: "shadow", $value: parseShadow(v) };
  if (/^fontFamily/.test(name)) return { $type: "fontFamily", $value: parseFontFamily(v) };
  if (/^motionDuration/.test(name)) return { $type: "duration", $value: parseSeconds(v) };
  if (/^motionEase/.test(name)) return { $type: "cubicBezier", $value: parseBezier(v) };
  if (isColor(v)) return { $type: "color", $value: dtcgColor(parseColor(v)) };
  return undefined;
}

/** Sets a value at a dotted path, creating groups on the way. */
function put(tree: Json, path: string, value: unknown) {
  const keys = path.split(".");
  let node = tree;
  for (const key of keys.slice(0, -1)) node = (node[key] ??= {}) as Json;
  node[keys.at(-1)!] = value;
}

// ---------------------------------------------------------------------------------------------
// Primitive tier: seed tokens and palettes
// ---------------------------------------------------------------------------------------------
const paletteRoot: Record<Mode, string> = { light: "antd.palette", dark: "antd.paletteDark" };
/** palettes[mode][name] = 10 hex steps (index 0 = step 1). */
const palettes: Record<Mode, Record<string, string[]>> = { light: {}, dark: {} };
for (const [key, name] of Object.entries(SEED_PALETTES)) {
  palettes.light[name] = dump.seedPalettes[key].light.map((h) => h.toLowerCase());
  palettes.dark[name] = dump.seedPalettes[key].dark.map((h) => h.toLowerCase());
}
for (const name of PRESETS) palettes.light[name] = dump.presetPalettes[name].map((h) => h.toLowerCase());
for (const name of Object.keys(dump.presetDarkPalettes)) palettes.dark[name] = dump.presetDarkPalettes[name].map((h) => h.toLowerCase());
const stepRef = (mode: Mode, palette: string, step: number) => `{${paletteRoot[mode]}.${palette}.${step}}`;

const primitive: Json = {
  $description: `Ant Design reference tier. antd.seed.* is antd ${ANTD_VERSION} theme.defaultSeed; antd.palette.* / antd.paletteDark.* are the @ant-design/colors ${COLORS_VERSION} palettes used by theme.defaultAlgorithm / theme.darkAlgorithm.`,
};
const seedGroup: Json = { $description: `antd ${ANTD_VERSION} theme.defaultSeed (seed tokens). Booleans, lineType and empty seeds (colorBgBase, colorTextBase, colorLink: the algorithms fill these in) are omitted.` };
for (const [name, v] of Object.entries(dump.seed)) {
  const t = toDtcg(name, typeof v === "string" && isColor(v) ? v.toLowerCase() : v);
  if (t) seedGroup[name] = t;
}
put(primitive, "antd.seed", seedGroup);
for (const mode of MODES) {
  const algo = mode === "light" ? "generate(seed)" : "generate(seed, { theme: 'dark' })";
  for (const [key, name] of Object.entries(SEED_PALETTES)) {
    const group: Json = { $type: "color", $description: `@ant-design/colors ${algo} for seed ${key} ${dump.seedPalettes[key].seed}; the palette ${mode === "light" ? "theme.defaultAlgorithm" : "theme.darkAlgorithm"} derives ${key}* tokens from.` };
    palettes[mode][name].forEach((h, i) => (group[String(i + 1)] = token(dtcgColor(parseColor(h)))));
    put(primitive, `${paletteRoot[mode]}.${name}`, group);
  }
  const presets = mode === "light" ? dump.presetPalettes : dump.presetDarkPalettes;
  for (const name of Object.keys(presets)) {
    const group: Json = { $type: "color", $description: `@ant-design/colors ${COLORS_VERSION} ${mode === "light" ? "presetPalettes" : "presetDarkPalettes"}.${name}` };
    palettes[mode][name].forEach((h, i) => (group[String(i + 1)] = token(dtcgColor(parseColor(h)))));
    put(primitive, `${paletteRoot[mode]}.${name}`, group);
  }
}

// ---------------------------------------------------------------------------------------------
// System tier: antd map + alias tokens (theme.getDesignToken)
// ---------------------------------------------------------------------------------------------
/** Preset-colour tokens (blue, blue-1, blue1, blueHover, …) are the palettes above; skip them in the system tier. */
const isPresetToken = (name: string) => PRESETS.some((p) => name === p || name.startsWith(`${p}-`) || new RegExp(`^${p}(\\d+|Hover|Active)$`).test(name));
/** Which seed palette a colour token is derived from, for aliasing it to a palette step. */
const derivedPalette = (name: string) => {
  const m = /^color(Primary|Success|Warning|Error|Info|Link)/.exec(name);
  if (m) return m[1] === "Link" ? "info" : m[1].toLowerCase();
  if (/^controlItemBgActive/.test(name)) return "primary";
  return undefined;
};

const L = dump.alias.light;
const D = dump.alias.dark;
const tokenNames = Object.keys(L).filter((n) => !isPresetToken(n)).sort();
const system: Json = {
  $description: `Ant Design system tier, mode-independent: antd ${ANTD_VERSION} map and alias tokens (theme.getDesignToken) whose value is the same under defaultAlgorithm and darkAlgorithm. Numbers are px dimensions unless they are line heights, opacities, z-indexes, motion units or font weights.`,
};
const systemMode: Record<Mode, Json> = {
  light: { $description: `Ant Design system tier, light mode: antd ${ANTD_VERSION} theme.getDesignToken({ algorithm: theme.defaultAlgorithm }) colour and shadow tokens, aliased to palette steps where the algorithm took them from one. Plus polyxd.sys.* additions (solid composites, contrast adjustments, chart colours, state opacities).` },
  dark: { $description: `Ant Design system tier, dark mode: antd ${ANTD_VERSION} theme.getDesignToken({ algorithm: theme.darkAlgorithm }) colour and shadow tokens, aliased to palette steps where the algorithm took them from one. Plus polyxd.sys.* additions (solid composites, contrast adjustments, chart colours, state opacities).` },
};
const antdGroup = { shared: {} as Json, light: {} as Json, dark: {} as Json };
const skipped: string[] = [];
for (const name of tokenNames) {
  const lt = toDtcg(name, L[name]);
  const dt = toDtcg(name, D[name]);
  if (!lt || !dt) {
    skipped.push(name);
    continue;
  }
  const perMode = lt.$type === "color" || lt.$type === "shadow" || JSON.stringify(lt) !== JSON.stringify(dt);
  if (!perMode) {
    // Alias to the seed when the algorithm passed the seed through unchanged.
    const seed = seedGroup[name] as { $type: string; $value: unknown } | undefined;
    antdGroup.shared[name] = seed && JSON.stringify(seed.$value) === JSON.stringify(lt.$value) ? { $type: lt.$type, $value: `{antd.seed.${name}}` } : lt;
    continue;
  }
  for (const [mode, t] of [["light", lt], ["dark", dt]] as const) {
    let value: unknown = t.$value;
    if (t.$type === "color") {
      const c = parseColor(String(mode === "light" ? L[name] : D[name]));
      const pal = derivedPalette(name);
      const candidates = [pal, "primary"].filter((x): x is string => !!x);
      for (const p of candidates) {
        const idx = c.a === 1 ? palettes[mode][p].indexOf(toHex(c)) : -1;
        if (idx >= 0) {
          value = stepRef(mode, p, idx + 1);
          break;
        }
      }
    }
    antdGroup[mode][name] = { $type: t.$type, $value: value };
  }
}
antdGroup.shared.$description = `Skipped (no DTCG type): ${skipped.join(", ")}`;
put(system, "antd.token", antdGroup.shared);
for (const mode of MODES) put(systemMode[mode], "antd.token", antdGroup[mode]);

/** Raw antd value of a token in a mode, as RGBA. */
const antdColor = (mode: Mode, name: string) => {
  const v = dump.alias[mode][name];
  if (!isColor(v)) throw new Error(`${name} is not a colour in ${mode}`);
  return parseColor(v);
};

// ---------------------------------------------------------------------------------------------
// Polyxd additions to the system tier
// ---------------------------------------------------------------------------------------------
const MOTION_UNIT = Number(dump.seed.motionUnit);
const MOTION_BASE = Number(dump.seed.motionBase);
put(system, "polyxd.sys", {
  $description: "Polyxd additions: values the semantic contract needs that antd does not expose as tokens.",
  font: {
    "weight-regular": token(400, { $type: "fontWeight", $description: "antd body text is font-weight normal (400); antd only tokenises fontWeightStrong" }),
    "letter-spacing": token(px(0), { $type: "dimension", $description: "antd sets no letter-spacing" }),
  },
  radius: { full: token(px(9999), { $type: "dimension", $description: "antd has no pill radius token (it uses 50% / shape=\"round\"); 9999px is the conventional equivalent" }) },
  motion: {
    "duration-long": token({ value: round((MOTION_BASE + MOTION_UNIT * 4) * 1000, 0), unit: "ms" }, { $type: "duration", $description: `One step past motionDurationSlow on antd's own ladder: motionBase + motionUnit x 4 (fast = x1, mid = x2, slow = x3)` }),
  },
  focus: {
    "ring-offset": token(px(1), { $type: "dimension", $description: `antd ${ANTD_VERSION} es/style/index.js genFocusOutline: outline-offset defaults to 1` }),
  },
  state: {
    disabled: token(0.45, { $type: "number", $description: "Contrast adjustment: antd's disabled content is colorTextDisabled (text alpha 0.25), below the contract's 0.3 minimum; this is the next step of antd's text-alpha ladder (colorTextTertiary, 0.45)" }),
  },
});

// Per-mode state opacities, read off the alpha of the antd tokens that implement those states.
for (const mode of MODES) {
  const alphaOf = (name: string) => round(antdColor(mode, name).a);
  put(systemMode[mode], "polyxd.sys.state", {
    $type: "number",
    $description: "Alpha channel of the antd tokens that implement each state (antd shifts colours rather than using state layers)",
    hover: token(alphaOf("colorBgTextHover"), { $description: "alpha of antd.token.colorBgTextHover (text/icon button hover)" }),
    pressed: token(alphaOf("colorBgTextActive"), { $description: "alpha of antd.token.colorBgTextActive (text/icon button active)" }),
    focus: token(alphaOf("controlOutline"), { $description: "alpha of antd.token.controlOutline (input focus glow)" }),
  });
}

// ---------------------------------------------------------------------------------------------
// Semantic colour roles, with contrast verification and adjustment
// ---------------------------------------------------------------------------------------------
/**
 * How each contract colour role maps onto antd:
 *   antd     natural antd token
 *   palette  palette the token comes from; enables contrast adjustment to a neighbouring step
 *   ladder   ordered antd neutral tokens (light-to-strong) used instead of a palette for greys
 */
interface RoleSpec { antd?: string; palette?: string; ladder?: string[]; step?: number; keepAlpha?: boolean; note?: string }
/** antd's neutral ladder from faint to strong (composited over colorBgContainer these are Ant's grey-4…grey-11). */
const NEUTRAL_LADDER = ["colorBorderSecondary", "colorBorder", "colorTextQuaternary", "colorTextTertiary", "colorTextSecondary", "colorText"];
/** Chart series: preset palettes at step 6, in this order (hues roughly 60 degrees apart, alternating warm/cool). */
const CHART_PRESETS = ["blue", "orange", "cyan", "magenta", "green", "purple"];
const CHART_STEP = 6;

const ROLES: Record<string, RoleSpec> = {
  "color.surface.default": { antd: "colorBgContainer" },
  "color.surface.subtle": { antd: "colorFillAlter", note: "table header / collapse header background" },
  "color.surface.raised": { antd: "colorBgContainer", note: "antd Card background (cards are separated by colorBorderSecondary, not tone)" },
  "color.surface.overlay": { antd: "colorBgElevated", note: "Modal / Popover / Dropdown background" },
  "color.surface.inverse": { antd: "colorBgSpotlight", note: "Tooltip background" },
  "color.scrim": { antd: "colorBgMask", keepAlpha: true },
  "color.text.default": { antd: "colorText" },
  "color.text.muted": { antd: "colorTextSecondary" },
  "color.text.inverse": { antd: "colorTextLightSolid" },
  "color.text.link": { antd: "colorLink", palette: "info" },
  "color.border.default": { antd: "colorBorderSecondary" },
  "color.border.strong": { antd: "colorBorder", ladder: NEUTRAL_LADDER },
  "color.border.focus": { antd: "colorPrimaryBorder", palette: "primary", note: "genFocusOutline: outline lineWidthFocus solid colorPrimaryBorder" },
  "color.action.primary.background": { antd: "colorPrimary", palette: "primary" },
  "color.action.primary.foreground": { antd: "colorTextLightSolid" },
  "color.action.secondary.background": { antd: "colorBgContainer", note: "antd default Button" },
  "color.action.secondary.foreground": { antd: "colorText" },
  "color.action.secondary.border": { antd: "colorBorder" },
  "color.action.danger.background": { antd: "colorError", palette: "error" },
  "color.action.danger.foreground": { antd: "colorTextLightSolid" },
  "color.selection.background": { antd: "controlItemBgActive", note: "selected Select option / Menu item" },
  "color.selection.foreground": { antd: "colorText" },
  "color.status.info.background": { antd: "colorInfoBg" },
  "color.status.info.foreground": { antd: "colorInfoText", palette: "info" },
  "color.status.info.emphasis": { antd: "colorInfo", palette: "info" },
  "color.status.success.background": { antd: "colorSuccessBg" },
  "color.status.success.foreground": { antd: "colorSuccessText", palette: "success" },
  "color.status.success.emphasis": { antd: "colorSuccess", palette: "success" },
  "color.status.warning.background": { antd: "colorWarningBg" },
  "color.status.warning.foreground": { antd: "colorWarningText", palette: "warning" },
  "color.status.warning.emphasis": { antd: "colorWarning", palette: "warning" },
  "color.status.danger.background": { antd: "colorErrorBg" },
  "color.status.danger.foreground": { antd: "colorErrorText", palette: "error" },
  "color.status.danger.emphasis": { antd: "colorError", palette: "error" },
  ...Object.fromEntries(CHART_PRESETS.map((p, i) => [`color.data.categorical.${i + 1}`, { palette: p, step: CHART_STEP }])),
  "color.data.positive": { antd: "colorSuccess", palette: "success" },
  "color.data.negative": { antd: "colorError", palette: "error" },
  "color.data.neutral": { antd: "colorTextTertiary", note: "antd's icon / tertiary grey (colorIcon)" },
};

interface Contract { tokens: Record<string, { type: string }>; contrast: { foreground: string; background: string; min: number; criterion: string }[] }
const contract: Contract = JSON.parse(await readFile(CONTRACT, "utf8"));
for (const [name, spec] of Object.entries(contract.tokens)) if (spec.type === "color" && !ROLES[name]) throw new Error(`no mapping for contract colour ${name}`);

/** A role's choice in one mode: where it points and its raw colour (possibly translucent). */
interface Choice { kind: "token" | "step" | "ladder"; ref: string; raw: Rgba; desc: string; natural: boolean }
const choices: Record<Mode, Record<string, Choice>> = { light: {}, dark: {} };
const adjustments: string[] = [];

const naturalChoice = (mode: Mode, role: string): Choice => {
  const spec = ROLES[role];
  if (spec.antd) return { kind: "token", ref: spec.antd, raw: antdColor(mode, spec.antd), desc: `antd.token.${spec.antd}`, natural: true };
  const hex = palettes[mode][spec.palette!][spec.step! - 1];
  return { kind: "step", ref: `${spec.palette}.${spec.step}`, raw: parseColor(hex), desc: `${paletteRoot[mode]}.${spec.palette}.${spec.step}`, natural: true };
};

/** Opaque colour of a role as the page renders it (translucent values composited on colorBgContainer). */
const solid = (mode: Mode, c: Rgba) => (c.a < 1 ? composite(c, antdColor(mode, "colorBgContainer")) : c);

/** Contrast of a contract pair in a mode; the foreground is composited on the actual background with its real alpha. */
const pairRatio = (mode: Mode, pair: Contract["contrast"][number], override?: [string, Choice]) => {
  const get = (r: string) => (override && override[0] === r ? override[1] : choices[mode][r]);
  return contrast(get(pair.foreground).raw, solid(mode, get(pair.background).raw));
};

for (const mode of MODES) {
  for (const role of Object.keys(ROLES)) choices[mode][role] = naturalChoice(mode, role);
  // Re-check until stable: adjusting one role can change another pair it is in.
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const pair of contract.contrast) {
      if (pairRatio(mode, pair) >= pair.min) continue;
      // Adjust whichever side has a palette or ladder to move along (foreground first).
      const role = [pair.foreground, pair.background].find((r) => ROLES[r].palette || ROLES[r].ladder);
      if (!role) throw new Error(`[${mode}] ${pair.foreground} on ${pair.background} fails and neither side can be adjusted`);
      const spec = ROLES[role];
      const current = choices[mode][role];
      const pairsOf = contract.contrast.filter((p) => p.foreground === role || p.background === role);
      const before = pairsOf.map((p) => `${p.foreground === role ? p.background : p.foreground} ${pairRatio(mode, p).toFixed(2)}:1`).join(", ");
      let options: Choice[];
      let naturalIndex: number;
      if (spec.ladder) {
        options = spec.ladder.map((n) => ({ kind: "ladder" as const, ref: n, raw: antdColor(mode, n), desc: `antd.token.${n}`, natural: false }));
        naturalIndex = spec.ladder.indexOf(spec.antd!);
      } else {
        const steps = palettes[mode][spec.palette!];
        options = steps.map((h, i) => ({ kind: "step" as const, ref: `${spec.palette}.${i + 1}`, raw: parseColor(h), desc: `${paletteRoot[mode]}.${spec.palette}.${i + 1}`, natural: false }));
        const hex = toHex(solid(mode, current.raw));
        naturalIndex = steps.indexOf(hex);
        if (naturalIndex < 0) throw new Error(`[${mode}] ${role}: ${current.desc} (${hex}) is not a step of palette ${spec.palette}`);
      }
      const order = options.map((_, i) => i).sort((a, b) => Math.abs(a - naturalIndex) - Math.abs(b - naturalIndex) || a - b);
      const pick = order.find((i) => pairsOf.every((p) => pairRatio(mode, p, [role, options[i]]) >= p.min));
      if (pick === undefined) throw new Error(`[${mode}] ${role}: no step of ${spec.palette ?? "the neutral ladder"} passes ${pairsOf.length} pair(s)`);
      choices[mode][role] = options[pick];
      const after = pairsOf.map((p) => `${p.foreground === role ? p.background : p.foreground} ${pairRatio(mode, p).toFixed(2)}:1`).join(", ");
      adjustments.push(`[${mode}] ${role}: ${current.desc} ${toHex(solid(mode, current.raw))} (${before}) -> ${options[pick].desc} ${toHex(solid(mode, options[pick].raw))} (${after})`);
      changed = true;
    }
    if (!changed) break;
  }
  for (const pair of contract.contrast) {
    const r = pairRatio(mode, pair);
    if (r < pair.min) throw new Error(`[${mode}] ${pair.foreground} on ${pair.background}: ${r.toFixed(2)} < ${pair.min}`);
  }
}

// Emit the per-mode polyxd.sys.color tokens and the semantic aliases.
const roleKey = (role: string) => role.replace(/^color\./, "").replace(/\./g, "-");
const solidTokens: Record<Mode, Json> = { light: {}, dark: {} };
const roleTokens: Record<Mode, Json> = { light: {}, dark: {} };
const semanticColor: Record<string, unknown> = {};
const translucentSomewhere = (name: string) => MODES.some((m) => antdColor(m, name).a < 1);

/** Reference to an antd token as a solid colour: the token itself, or its polyxd.sys.color.solid.* composite. */
function solidRef(mode: Mode, name: string) {
  if (!translucentSomewhere(name)) return `{antd.token.${name}}`;
  const c = antdColor(mode, name);
  solidTokens[mode][name] = c.a < 1
    ? token(dtcgColor(solid(mode, c)), { $description: `antd.token.${name} (${dump.alias[mode][name]}) composited on antd.token.colorBgContainer (${dump.alias[mode].colorBgContainer}); a literal because an alias cannot composite` })
    : token(`{antd.token.${name}}`, { $description: `antd.token.${name} is already opaque in this mode` });
  return `{polyxd.sys.color.solid.${name}}`;
}

const refFor = (mode: Mode, role: string, c: Choice) => {
  if (c.kind === "step") return stepRef(mode, c.ref.split(".")[0], Number(c.ref.split(".")[1]));
  if (ROLES[role].keepAlpha) return `{antd.token.${c.ref}}`;
  return solidRef(mode, c.ref);
};

for (const role of Object.keys(ROLES)) {
  const spec = ROLES[role];
  const refs = MODES.map((m) => refFor(m, role, choices[m][role]));
  const adjusted = MODES.filter((m) => !choices[m][role].natural);
  const natural = spec.antd ? `antd.token.${spec.antd}` : `preset ${spec.palette} step ${spec.step}`;
  let description = spec.note ?? (spec.antd ? "" : `antd preset ${spec.palette} palette, step ${spec.step} (light: presetPalettes, dark: presetDarkPalettes)`);
  if (adjusted.length) {
    description = [description, `Contrast adjustment (${adjusted.join(", ")}): natural ${natural} moved to the nearest ${spec.ladder ? "step of antd's neutral ladder" : `step of the ${spec.palette} palette`} that passes; see README`].filter(Boolean).join(". ");
  }
  if (refs[0] === refs[1]) {
    semanticColor[role] = token(refs[0], description ? { $description: description } : {});
    continue;
  }
  for (const [i, mode] of MODES.entries()) {
    const c = choices[mode][role];
    const why = c.natural ? natural : `adjusted from ${natural} for contrast`;
    roleTokens[mode][roleKey(role)] = token(refs[i], { $description: why });
  }
  semanticColor[role] = token(`{polyxd.sys.color.${roleKey(role)}}`, description ? { $description: description } : {});
}
for (const mode of MODES) {
  put(systemMode[mode], "polyxd.sys.color", {
    $type: "color",
    $description: "Polyxd additions: opaque composites of antd's translucent colours (solid.*), roles whose antd source differs by mode or was adjusted for contrast, and chart colours.",
    solid: solidTokens[mode],
    ...roleTokens[mode],
  });
}

// ---------------------------------------------------------------------------------------------
// Semantic tier
// ---------------------------------------------------------------------------------------------
const nest = (flat: Record<string, unknown>, strip: string) => {
  const tree: Json = {};
  for (const [k, v] of Object.entries(flat)) put(tree, k.slice(strip.length), v);
  return tree;
};
const a = (name: string, description?: string) => token(`{antd.token.${name}}`, description ? { $description: description } : {});
const lh = (name: string) => Number(L[name]);
const typeStyle = (size: string, lineHeight: string, weight: "regular" | "strong", description: string) =>
  token(
    {
      fontFamily: "{antd.token.fontFamily}",
      fontSize: `{antd.token.${size}}`,
      fontWeight: weight === "strong" ? "{antd.token.fontWeightStrong}" : "{polyxd.sys.font.weight-regular}",
      lineHeight: `{antd.token.${lineHeight}}`,
      letterSpacing: "{polyxd.sys.font.letter-spacing}",
    },
    { $description: `${description}: ${size} ${L[size]}px, ${lineHeight} ${round(lh(lineHeight))} (${round(Number(L[size]) * lh(lineHeight), 2)}px), ${weight === "strong" ? "fontWeightStrong 600" : "400"}` },
  );

const semantic = {
  $description: "Polyxd semantic tier for Ant Design. Every token aliases an antd token (antd.token.* / antd.palette*.*) or, where antd has no opaque or passing equivalent, a polyxd.sys.* addition documented in the README.",
  color: { $type: "color", ...nest(semanticColor, "color.") },
  type: {
    $type: "typography",
    title: {
      page: typeStyle("fontSizeHeading2", "lineHeightHeading2", "strong", "Typography.Title level 2"),
      section: typeStyle("fontSizeHeading4", "lineHeightHeading4", "strong", "Typography.Title level 4"),
      item: typeStyle("fontSizeHeading5", "lineHeightHeading5", "strong", "Typography.Title level 5 (also Card / Modal title size, fontSizeLG)"),
    },
    body: {
      default: typeStyle("fontSizeLG", "lineHeightLG", "regular", "Judgement call: antd's base fontSize is 14px but the contract needs >= 16px body text, so this is antd's large text size"),
      small: typeStyle("fontSize", "lineHeight", "regular", "antd base text (fontSize)"),
    },
    label: {
      default: typeStyle("fontSize", "lineHeight", "regular", "antd control text (Button, Input, Form label)"),
      small: typeStyle("fontSizeSM", "lineHeightSM", "regular", "antd small text (Tag, Badge, small controls)"),
    },
    numeric: { display: typeStyle("fontSizeHeading3", "lineHeightHeading3", "regular", "antd Statistic value (contentFontSize = fontSizeHeading3)") },
  },
  space: {
    $type: "dimension",
    $description: "antd size ladder (sizeUnit 4 x sizeStep): XXS 4, XS 8, SM 12, base 16, MD 20, LG 24, XL 32, XXL 48",
    inset: { compact: a("paddingSM", "Card size=small body padding"), default: a("padding"), comfortable: a("paddingLG", "Card body padding") },
    stack: { tight: a("marginXXS"), default: a("marginXS"), loose: a("margin"), section: a("marginXL") },
    inline: { tight: a("marginXXS"), default: a("marginXS", "Space size=small"), loose: a("margin", "Space size=middle") },
  },
  size: {
    $type: "dimension",
    target: { min: a("controlHeight", "antd default control height, 32px. Judgement call: antd's default density is below the 44-48px touch guidance of iOS/Material; it meets WCAG 2.5.8 (24px). Use controlHeightLG (40px) for touch-first surfaces") },
    icon: { small: a("fontSizeIcon", "antd small icon size (fontSizeSM)"), default: a("fontSize", "antd icons inherit the text size (14px)") },
  },
  radius: {
    $type: "dimension",
    small: a("borderRadiusSM"),
    default: a("borderRadius"),
    large: a("borderRadiusLG"),
    full: token("{polyxd.sys.radius.full}"),
  },
  border: { width: { $type: "dimension", default: a("lineWidth"), strong: a("lineWidthBold") } },
  focus: {
    ring: {
      $type: "dimension",
      width: a("lineWidthFocus", "genFocusOutline outline width"),
      offset: token("{polyxd.sys.focus.ring-offset}", { $description: "genFocusOutline outline-offset" }),
    },
  },
  measure: { max: token(65, { $type: "number", $description: "Characters per line for running text (Polyxd; antd has no measure token)" }) },
  opacity: {
    state: {
      $type: "number",
      hover: token("{polyxd.sys.state.hover}"),
      pressed: token("{polyxd.sys.state.pressed}"),
      focus: token("{polyxd.sys.state.focus}"),
      disabled: token("{polyxd.sys.state.disabled}"),
    },
  },
  shadow: {
    $type: "shadow",
    raised: a("boxShadowTertiary", "antd's low elevation (Segmented thumb, hoverable surfaces)"),
    overlay: a("boxShadowSecondary", "Popover / Dropdown / Select popup; identical to boxShadow (Modal) in antd 6"),
  },
  motion: {
    duration: {
      $type: "duration",
      instant: a("motionDurationFast"),
      short: a("motionDurationMid"),
      medium: a("motionDurationSlow"),
      long: token("{polyxd.sys.motion.duration-long}"),
    },
    easing: {
      $type: "cubicBezier",
      standard: a("motionEaseInOut"),
      enter: a("motionEaseOutCirc", "antd zoom motion (Modal, Popover) enter"),
      exit: a("motionEaseInOutCirc", "antd zoom motion (Modal, Popover) leave"),
    },
  },
};

await mkdir(OUT, { recursive: true });
const files: [string, unknown][] = [
  ["primitive.json", primitive],
  ["system.json", system],
  ["system.light.json", systemMode.light],
  ["system.dark.json", systemMode.dark],
  ["semantic.json", semantic],
];
for (const [name, tree] of files) {
  await writeFile(join(OUT, name), `${JSON.stringify(tree, null, 2)}\n`);
  console.log(`wrote tokens/${name}`);
}
console.log(adjustments.length ? `\ncontrast adjustments:\n  ${adjustments.join("\n  ")}` : "\nno contrast adjustments");
for (const mode of MODES) {
  const tight = contract.contrast.map((p) => ({ p, r: pairRatio(mode, p) })).sort((x, y) => x.r - x.p.min - (y.r - y.p.min)).slice(0, 3);
  console.log(`[${mode}] closest pairs: ${tight.map(({ p, r }) => `${p.foreground} on ${p.background} ${r.toFixed(2)}:1 (min ${p.min})`).join("; ")}`);
}
