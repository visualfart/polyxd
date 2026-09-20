#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-spectrum (Adobe Spectrum 2, light and dark).
 *
 *   node scripts/generate.ts                           regenerate tokens/*.json from the vendored JSON
 *   node scripts/generate.ts --refresh <node_modules>  first re-copy variables.json from an installed copy
 *
 * To refresh, install the pinned package somewhere OUTSIDE the monorepo:
 *   cd "$(mktemp -d)" && npm init -y && npm install --ignore-scripts @adobe/spectrum-tokens@15.4.1
 * and pass that directory's node_modules.
 *
 * Spectrum publishes tokens as JSON rather than CSS, and a token's value depends on which sets it
 * belongs to: colours carry a light/dark/wireframe set (nested twice — theme, then colour scheme),
 * sizes carry a desktop/mobile set. The pack resolves the desktop scale in both schemes, which is
 * what a rendered surface uses; the touch target comes from the contract, not from the scale.
 */
import { copyFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "@polyxd/spec";
import { alias, aliasWith, length, nearestPassing, shadowLayers, writePack, type Json } from "@polyxd/ds-kit";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/spectrum");
const PINNED = { "@adobe/spectrum-tokens": "15.4.1" } as const;

type Node = { value?: string; sets?: Record<string, Node> };
type Tokens = Record<string, Node>;

/**
 * One token's value for a scheme. A Spectrum token is a tree of sets: the outer one picks the
 * theme, the inner one the colour scheme, and dimensions use desktop/mobile instead. Walking down
 * by name — scheme first, then scale — lands on the value a Spectrum app of that theme renders.
 */
function resolve(tokens: Tokens, name: string, scheme: "light" | "dark", scale = "desktop"): string | undefined {
  let node: Node | undefined = tokens[name];
  for (let depth = 0; node && depth < 6; depth++) {
    if (node.value !== undefined) return node.value;
    const sets = node.sets;
    if (!sets) return undefined;
    node = sets[scheme] ?? sets[scale] ?? sets[Object.keys(sets)[0]];
  }
  return node?.value;
}

/** The steps of one Spectrum ramp, in order. */
const ramp = (tokens: Tokens, hue: string, scheme: "light" | "dark") =>
  Object.keys(tokens)
    .filter((name) => new RegExp(`^${hue}-\\d+$`).test(name))
    .sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]))
    .map((name) => ({ name, value: resolve(tokens, name, scheme)! }))
    .filter((step) => step.value);

/** The tokens the pack reads, grouped by what they become. Everything else in the file is left out. */
const KEEP = [
  /^(gray|blue|red|green|orange|yellow|purple|magenta|celery|indigo|seafoam|cyan|fuchsia|chartreuse|turquoise|pink|brown|silver|cinnamon)-\d+$/,
  /^(background|neutral|accent|negative|positive|informative|notice)-.*color/,
  /^(disabled|overlay)-.*color$/,
  /^(spacing|corner-radius|border-width|component-height|focus-indicator)-/,
  /^(font-size|line-height)-\d+$/,
  /^(body|heading|detail|title)-(size|line-height)/,
  /^(body|heading|detail)-sans-serif.*font-weight$/,
  /^drop-shadow-(elevated|emphasized)-(x|y|blur|color)$/,
  /^corner-radius-(full|small|medium|large|extra-large)-default$/,
  /^(background|overlay)-opacity/,
];

const DIMENSION = /^(spacing|corner-radius|border-width|component-height|focus-indicator-(thickness|gap)|font-size|line-height)-|^(body|heading|detail|title)-size-|-(size|thickness|gap)$|^drop-shadow-.*-(x|y|blur)$/;
const NUMBER = /font-weight$|line-height$|opacity/;

/** Spectrum's tokens as one tier per scheme, names kept, typed by what they are. */
function systemTier(tokens: Tokens, scheme: "light" | "dark"): Json {
  const out: Json = {};
  for (const name of Object.keys(tokens)) {
    if (!KEEP.some((re) => re.test(name))) continue;
    const value = resolve(tokens, name, scheme);
    if (value === undefined) continue;
    if (DIMENSION.test(name) && /px|rem|em$/.test(value)) out[name] = { $value: length(value), $type: "dimension" };
    else if (NUMBER.test(name) && /^-?[\d.]+$/.test(value)) out[name] = { $value: Number(value), $type: "number" };
    else if (/^(rgb|#|hsl)/.test(value)) out[name] = { $value: value, $type: "color" };
  }
  return {
    $description: `Adobe Spectrum ${PINNED["@adobe/spectrum-tokens"]}, ${scheme} scheme at the desktop scale, token names unchanged.`,
    spectrum: out,
  };
}

/**
 * Values Spectrum's token package doesn't publish, and the steps its own ramps need to clear the
 * contract. Spectrum numbers its ramps by contrast rather than by lightness — `gray-25` is white in
 * light and near-black in dark, `gray-800` is body text in both — so a role that needs more contrast
 * always moves *up* the numbers, whichever scheme it is in.
 */
function polyxdTier(tokens: Tokens, scheme: "light" | "dark"): Json {
  const t = (name: string) => resolve(tokens, name, scheme)!;
  const surface = t("background-base-color");
  const notes: string[] = [];

  const passing = (hue: string, on: string, min: number, fromStep: number, why: string) => {
    const steps = ramp(tokens, hue, scheme);
    const from = Math.max(
      0,
      steps.findIndex((step) => step.name === `${hue}-${fromStep}`),
    );
    const found = nearestPassing(
      steps.map((step) => step.value),
      on,
      min,
      from,
      "darker",
    );
    if (!found.passes) {
      notes.push(`${hue}: no step reaches ${min}:1 (best ${found.ratio.toFixed(2)}:1) → body text`);
      return { $value: "{spectrum.gray-800}", $description: `No step of Spectrum's ${hue} ramp reaches ${min}:1 here (best ${found.ratio.toFixed(2)}:1), so this uses the body text colour` };
    }
    if (steps[found.index].name !== `${hue}-${fromStep}`) notes.push(`${hue}-${fromStep} → ${steps[found.index].name} (${found.ratio.toFixed(2)}:1, ${why})`);
    return {
      $value: `{spectrum.${steps[found.index].name}}`,
      ...(steps[found.index].name !== `${hue}-${fromStep}`
        ? { $description: `Contrast adjustment: Spectrum's ${hue}-${fromStep} doesn't reach ${min}:1 here; ${steps[found.index].name} is the nearest step of the same ramp that does (${found.ratio.toFixed(2)}:1)` }
        : {}),
    };
  };

  /** A status chip: Spectrum's step 100 of the hue as the tint, and the first step readable on it. */
  const chip = (hue: string) => ({ $value: `{spectrum.${hue}-100}` });
  const onChip = (hue: string) => passing(hue, t(`${hue}-100`), 4.5, 1200, "chip text");
  /** An accent is a graphic, so 3:1 against the page is the floor; 800 is Spectrum's own visual step. */
  const accent = (hue: string) => passing(hue, surface, 3, 800, "a 3:1 accent");
  /**
   * A filled button's label is `gray-25`, which is white in light and near-black in dark — the same
   * token, the opposite end of the ramp — so the fill is measured against that, not against white.
   */
  const filled = (hue: string) => passing(hue, t("gray-25"), 4.5, 900, "button label");

  const tier = {
    $description: `Values Adobe Spectrum's token package does not publish, and contrast adjustments, for the ${scheme} scheme.`,
    polyxd: {
      sys: {
        $type: "color",
        "status-info-background": chip("blue"),
        "status-info-foreground": onChip("blue"),
        "status-info-emphasis": accent("blue"),
        "status-success-background": chip("green"),
        "status-success-foreground": onChip("green"),
        "status-success-emphasis": accent("green"),
        "status-warning-background": chip("orange"),
        "status-warning-foreground": onChip("orange"),
        "status-warning-emphasis": accent("orange"),
        "status-danger-background": chip("red"),
        "status-danger-foreground": onChip("red"),
        "status-danger-emphasis": accent("red"),
        "data-1": accent("blue"),
        "data-2": accent("green"),
        "data-3": accent("purple"),
        "data-4": accent("orange"),
        "data-5": accent("magenta"),
        "data-6": accent("seafoam"),
        "data-positive": accent("green"),
        "data-negative": accent("red"),
        "data-neutral": accent("gray"),
        "text-muted": passing("gray", surface, 4.5, 700, "muted text"),
        "border-strong": passing("gray", surface, 3, 500, "a 3:1 stroke"),
        "action-primary": filled("blue"),
        "action-danger": filled("red"),
        "text-link": passing("blue", surface, 4.5, 900, "link text"),
        // Spectrum's own selection tint is accent-100 with the first accent step readable on it.
        "selection-background": chip("blue"),
        "selection-foreground": onChip("blue"),
        family: {
          $type: "fontFamily",
          sans: {
            $value: "Adobe Clean, Source Sans 3, system-ui, sans-serif",
            $description: "Spectrum's typeface is Adobe Clean, which is licensed and not published with the tokens; Source Sans 3 is Adobe's open metric-compatible stand-in",
          },
        },
        weight: {
          $type: "number",
          regular: { $value: 400 },
          medium: { $value: 500 },
          bold: { $value: 700, $description: "Spectrum publishes weights per typeface variant; these are the three the contract needs" },
        },
        state: {
          $type: "number",
          hover: { $value: 0.06, $description: "Spectrum shades states with separate ramp steps; Polyxd needs a state-layer opacity" },
          pressed: { $value: 0.12 },
          focus: { $value: 0.12 },
          disabled: { $value: 0.4, $description: "Spectrum's disabled content uses gray-400 on gray-100" },
        },
        // Spectrum keeps its scrim's colour and its opacity in two tokens; the contract wants one colour.
        scrim: { $type: "color", $value: `rgba(0, 0, 0, ${t("overlay-opacity")})`, $description: `Spectrum's overlay-color at its overlay-opacity (${t("overlay-opacity")})` },
        radius: { $type: "dimension", full: { $value: { value: 9999, unit: "px" }, $description: "Spectrum writes a full radius as the ratio 0.5 (50%), which a token can't carry; 9999px rounds the same controls" } },
        target: { $type: "dimension", min: { $value: { value: 44, unit: "px" }, $description: "Spectrum's desktop control height is 32px; 44px is the touch target a generated surface is held to" } },
        measure: { $type: "number", max: { $value: 65, $description: "Characters per line for running text (Polyxd; Spectrum has no measure token)" } },
        motion: {
          $type: "duration",
          instant: { $value: { value: 100, unit: "ms" } },
          short: { $value: { value: 130, unit: "ms" } },
          medium: { $value: { value: 160, unit: "ms" } },
          long: { $value: { value: 220, unit: "ms" }, $description: "Spectrum documents its animation durations but does not publish them as tokens; these are Polyxd values" },
        },
        easing: {
          $type: "cubicBezier",
          standard: { $value: [0.45, 0, 0.4, 1] },
          enter: { $value: [0, 0, 0.4, 1] },
          exit: { $value: [0.5, 0, 1, 1] },
        },
        shadow: {
          $type: "shadow",
          raised: { $value: shadowLayers(`${t("drop-shadow-elevated-x")} ${t("drop-shadow-elevated-y")} ${t("drop-shadow-elevated-blur")} ${t("drop-shadow-elevated-color")}`) },
          overlay: { $value: shadowLayers(`${t("drop-shadow-emphasized-x")} ${t("drop-shadow-emphasized-y")} ${t("drop-shadow-emphasized-blur")} ${t("drop-shadow-emphasized-color")}`) },
        },
      },
    },
  };
  if (notes.length) console.log(`  ${scheme}: ${notes.join("; ")}`);
  return tier;
}

/** The Polyxd contract, each token an alias to a Spectrum token or a Polyxd addition. */
function semanticTier(): Json {
  const s = (name: string) => alias(`spectrum.${name}`);
  const sd = (name: string, description: string) => aliasWith(`spectrum.${name}`, description);
  const p = (name: string) => alias(`polyxd.sys.${name}`);
  const typo = (size: string, line: string, weight: string) => ({
    $value: {
      fontFamily: "{polyxd.sys.family.sans}",
      fontSize: `{spectrum.${size}}`,
      fontWeight: `{polyxd.sys.weight.${weight}}`,
      lineHeight: `{spectrum.${line}}`,
      letterSpacing: { value: 0, unit: "px" },
    },
  });
  return {
    $description:
      "Polyxd semantic tier for Adobe Spectrum 2. Every token aliases a Spectrum token wherever one exists; polyxd.* marks what Spectrum's token package does not publish. The file is the same in both schemes.",
    color: {
      $type: "color",
      surface: {
        default: sd("background-base-color", "Spectrum's base background, gray-25"),
        subtle: s("background-layer-1-color"),
        raised: s("background-layer-2-color"),
        overlay: s("background-elevated-color"),
        inverse: s("gray-800"),
      },
      scrim: p("scrim"),
      text: { default: s("neutral-content-color-default"), muted: p("text-muted"), inverse: s("gray-25"), link: p("text-link") },
      border: { default: s("gray-300"), strong: p("border-strong"), focus: s("focus-indicator-color") },
      action: {
        primary: { background: p("action-primary"), foreground: s("gray-25") },
        secondary: { background: s("gray-100"), foreground: s("neutral-content-color-default"), border: s("gray-300") },
        danger: { background: p("action-danger"), foreground: s("gray-25") },
      },
      selection: { background: p("selection-background"), foreground: p("selection-foreground") },
      status: {
        info: { background: p("status-info-background"), foreground: p("status-info-foreground"), emphasis: p("status-info-emphasis") },
        success: { background: p("status-success-background"), foreground: p("status-success-foreground"), emphasis: p("status-success-emphasis") },
        warning: { background: p("status-warning-background"), foreground: p("status-warning-foreground"), emphasis: p("status-warning-emphasis") },
        danger: { background: p("status-danger-background"), foreground: p("status-danger-foreground"), emphasis: p("status-danger-emphasis") },
      },
      data: {
        categorical: { 1: p("data-1"), 2: p("data-2"), 3: p("data-3"), 4: p("data-4"), 5: p("data-5"), 6: p("data-6") },
        positive: p("data-positive"),
        negative: p("data-negative"),
        neutral: p("data-neutral"),
      },
    },
    type: {
      $type: "typography",
      title: { page: typo("heading-size-m", "heading-line-height", "bold"), section: typo("heading-size-s", "heading-line-height", "bold"), item: typo("heading-size-xs", "heading-line-height", "medium") },
      body: { default: typo("body-size-m", "body-line-height", "regular"), small: typo("body-size-s", "body-line-height", "regular") },
      label: { default: typo("detail-size-m", "detail-line-height", "medium"), small: typo("detail-size-s", "detail-line-height", "medium") },
      numeric: { display: { ...typo("heading-size-m", "heading-line-height", "bold"), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
    },
    space: {
      $type: "dimension",
      inset: { compact: s("spacing-100"), default: s("spacing-300"), comfortable: s("spacing-400") },
      stack: { tight: s("spacing-50"), default: s("spacing-100"), loose: s("spacing-200"), section: s("spacing-500") },
      inline: { tight: s("spacing-50"), default: s("spacing-100"), loose: s("spacing-200") },
    },
    size: { $type: "dimension", target: { min: p("target.min") }, icon: { small: s("font-size-100"), default: s("font-size-300") } },
    radius: {
      $type: "dimension",
      small: s("corner-radius-small-default"),
      control: sd("corner-radius-medium-default", "Spectrum's default control radius"),
      default: s("corner-radius-medium-default"),
      large: s("corner-radius-large-default"),
      full: p("radius.full"),
    },
    border: { width: { $type: "dimension", default: s("border-width-100"), strong: s("border-width-200") } },
    focus: { ring: { $type: "dimension", width: s("focus-indicator-thickness"), offset: s("focus-indicator-gap") } },
    measure: { max: p("measure.max") },
    opacity: { state: { $type: "number", hover: p("state.hover"), pressed: p("state.pressed"), focus: p("state.focus"), disabled: p("state.disabled") } },
    shadow: { $type: "shadow", raised: p("shadow.raised"), overlay: p("shadow.overlay") },
    motion: {
      duration: { $type: "duration", instant: p("motion.instant"), short: p("motion.short"), medium: p("motion.medium"), long: p("motion.long") },
      easing: { $type: "cubicBezier", standard: p("easing.standard"), enter: p("easing.enter"), exit: p("easing.exit") },
    },
  };
}

async function main(): Promise<void> {
  const i = process.argv.indexOf("--refresh");
  if (i > -1) await copyFile(join(process.argv[i + 1], "@adobe/spectrum-tokens/dist/json/variables.json"), join(SOURCES, "variables.json"));

  const tokens: Tokens = JSON.parse(await readFile(join(SOURCES, "variables.json"), "utf8"));
  await writePack({
    dir: ROOT,
    name: "spectrum",
    displayName: "Adobe Spectrum 2",
    contractVersion: "0.2.0",
    provenance: [
      {
        source: "npm:@adobe/spectrum-tokens dist/json/variables.json (https://github.com/adobe/spectrum-tokens)",
        version: PINNED["@adobe/spectrum-tokens"],
        license: "Apache-2.0",
        notes: "The token file is vendored verbatim as scripts/sources/spectrum/variables.json; the generator resolves each token's light/dark set at the desktop scale.",
      },
    ],
    light: { ...systemTier(tokens, "light"), ...polyxdTier(tokens, "light") },
    dark: { ...systemTier(tokens, "dark"), ...polyxdTier(tokens, "dark") },
    semantic: semanticTier(),
  });
  console.log(`wrote Spectrum tokens → ${join(ROOT, "tokens")}`);
}

await main();
