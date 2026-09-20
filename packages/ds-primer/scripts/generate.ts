#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-primer (GitHub Primer, light and dark).
 *
 *   node scripts/generate.ts                           regenerate tokens/*.json from the vendored stylesheets
 *   node scripts/generate.ts --refresh <node_modules>  first re-copy the stylesheets from an installed copy
 *
 * To refresh, install the pinned package somewhere OUTSIDE the monorepo:
 *   cd "$(mktemp -d)" && npm init -y && npm install --ignore-scripts @primer/primitives@11.10.0
 * and pass that directory's node_modules.
 *
 * Primer splits its CSS into base scales (sizes, type, durations), functional scales (spacing,
 * radii, borders, motion) and one file per theme. The scales are the same in both modes, so they
 * become the pack's shared tier and only the theme file differs between light and dark.
 */
import { copyFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { luminance, over as composite, rgbToHex } from "@polyxd/spec";
import { alias, aliasWith, cssVars, nearestPassing, resolveVars, systemTier, writePack, type Json, type Vars } from "@polyxd/ds-kit";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/primer");
const PINNED = { "@primer/primitives": "11.10.0" } as const;

/** The scale files, shared by both themes, and the two theme files. */
const SCALES = [
  "base/size/size.css",
  "base/typography/typography.css",
  "base/motion/motion.css",
  "functional/size/border.css",
  "functional/size/radius.css",
  "functional/size/size.css",
  "functional/spacing/space.css",
  "functional/typography/typography.css",
  "functional/motion/motion.css",
];
const THEMES = { light: "functional/themes/light.css", dark: "functional/themes/dark.css" } as const;

const TYPES = [
  { match: /^(base-size|base-text-size|base-text-lineHeight|space|borderRadius|borderWidth|control-.*-size|stack-|overlay-(width|height|padding|offset)|focus-outline-(width|offset)|text-.*-size)/, type: "dimension" as const },
  { match: /^(shadow-|boxShadow-|overlay-borderColor)/, type: "shadow" as const },
  { match: /^fontStack-/, type: "fontFamily" as const },
  { match: /^(base-text-weight|text-.*-weight|base-text-lineHeight|text-.*-lineHeight)/, type: "number" as const },
  { match: /^(base-duration|motion-duration)/, type: "duration" as const },
  { match: /^(base-easing|motion-easing)/, type: "cubicBezier" as const },
];

/**
 * Names Primer writes in camelCase stay as they are; only tokens the pack can type are kept, and
 * shorthands (`--text-body-shorthand-medium`, a whole `font` declaration) are left out.
 */
const SKIP = /^(text-.*-shorthand|motion-transition|boxShadow-|outline-focus|shadow-inset)/;

const read = async (file: string) => readFile(join(SOURCES, file), "utf8");

/** Every custom property of one file, whatever selector it's under. */
const allVars = (css: string) => cssVars(css, () => true);

/**
 * Values Primer leaves to its components, and any contrast adjustment a theme needs.
 *
 * Primer publishes no numbered ramps in CSS, but each status has a family that runs light to dark —
 * `bgColor-X-muted`, `bgColor-X-emphasis`, `fgColor-X` — and that family is the ramp this pack
 * walks when a role doesn't clear a floor, sorted by measured luminance rather than by name.
 */
function polyxdTier(scheme: "light" | "dark", vars: Vars): Json {
  const dark = scheme === "dark";
  const surface = vars["--bgColor-default"];
  const notes: string[] = [];
  const v = (name: string) => vars[`--${name}`];

  const family = (status: string) =>
    [`bgColor-${status}-muted`, `bgColor-${status}-emphasis`, `fgColor-${status}`]
      .filter((name) => v(name))
      // Primer's muted status fills are translucent; composite them on the page before comparing.
      .sort((a, b) => luminance(composite(v(b), surface)) - luminance(composite(v(a), surface)));

  const passing = (status: string, role: string, on: string, min: number, why: string) => {
    const steps = family(status);
    const from = Math.max(0, steps.indexOf(role));
    const found = nearestPassing(
      steps.map((name) => v(name)),
      on,
      min,
      from,
      dark ? "lighter" : "darker",
    );
    if (!found.passes) {
      notes.push(`${status}: no member of the family reaches ${min}:1 (best ${found.ratio.toFixed(2)}:1) → body text`);
      return { $value: "{primer.fgColor-default}", $description: `No colour in Primer's ${status} family reaches ${min}:1 here (best ${found.ratio.toFixed(2)}:1), so this uses the body text colour` };
    }
    if (found.index !== from) notes.push(`${role} → ${steps[found.index]} (${found.ratio.toFixed(2)}:1, ${why})`);
    return {
      $value: `{primer.${steps[found.index]}}`,
      ...(found.index !== from ? { $description: `Contrast adjustment: Primer's ${role} doesn't reach ${min}:1 here; ${steps[found.index]} is the nearest colour of the same family that does (${found.ratio.toFixed(2)}:1)` } : {}),
    };
  };

  /**
   * Primer's dark muted fills are translucent — `bgColor-danger-muted` is `#f851491a` — so the
   * colour a reader actually sees is that fill over the page. The contract measures a pair of
   * colours, not a stack, so the pack composites each status fill over the background it is
   * designed to sit on and stores the result: the same pixels Primer renders.
   */
  const chip = (status: string) => {
    const raw = v(`bgColor-${status}-muted`);
    const composited = rgbToHex(composite(raw, surface));
    if (composited.toLowerCase() === String(raw).toLowerCase()) return { $value: `{primer.bgColor-${status}-muted}` };
    return { $value: composited, $description: `Primer's bgColor-${status}-muted (${raw}) composited over bgColor-default, because the contract measures contrast between two colours rather than a stack` };
  };

  /** A status accent is a graphic, so 3:1 against the page is the floor. */
  const emphasis = (status: string) => passing(status, `bgColor-${status}-emphasis`, surface, 3, "a 3:1 accent");
  /** Text inside a status chip sits on that status's own muted fill, over the page. */
  const onChip = (status: string) => passing(status, `fgColor-${status}`, rgbToHex(composite(v(`bgColor-${status}-muted`), surface)), 4.5, "chip text");

  const tier = {
    $description: `Values Primer does not define as variables, and contrast adjustments, for the ${scheme} theme.`,
    polyxd: {
      sys: {
        $type: "color",
        "status-info-background": chip("accent"),
        "status-info-foreground": onChip("accent"),
        "status-info-emphasis": emphasis("accent"),
        "status-success-background": chip("success"),
        "status-success-foreground": onChip("success"),
        "status-success-emphasis": emphasis("success"),
        "status-warning-background": chip("attention"),
        "status-warning-foreground": onChip("attention"),
        "status-warning-emphasis": emphasis("attention"),
        "status-danger-background": chip("danger"),
        "status-danger-foreground": onChip("danger"),
        "status-danger-emphasis": emphasis("danger"),
        state: {
          $type: "number",
          hover: { $value: 0.06, $description: "Primer shades hover with separate control colours; Polyxd needs a state-layer opacity" },
          pressed: { $value: 0.12 },
          focus: { $value: 0.12 },
          disabled: { $value: 0.5, $description: "Primer's disabled controls use its fgColor-disabled on a muted fill" },
        },
        target: { $type: "dimension", min: { $value: { value: 44, unit: "px" }, $description: "Primer's medium control is 32px; 44px is the touch target a generated surface is held to" } },
        measure: { $type: "number", max: { $value: 65, $description: "Characters per line for running text (Polyxd; Primer has no measure token)" } },
      },
    },
  };
  if (notes.length) console.log(`  ${scheme}: ${notes.join("; ")}`);
  return tier;
}

/** The Polyxd contract, each token an alias to a Primer variable or a Polyxd addition. */
function semanticTier(): Json {
  const g = (name: string) => alias(`primer.${name}`);
  const gd = (name: string, description: string) => aliasWith(`primer.${name}`, description);
  const p = (name: string) => alias(`polyxd.sys.${name}`);
  const typo = (size: string, line: string, weight: string) => ({
    $value: {
      fontFamily: "{primer.fontStack-sansSerif}",
      fontSize: `{primer.base-text-size-${size}}`,
      fontWeight: `{primer.base-text-weight-${weight}}`,
      lineHeight: `{primer.base-text-lineHeight-${line}}`,
      letterSpacing: { value: 0, unit: "px" },
    },
  });
  return {
    $description:
      "Polyxd semantic tier for GitHub Primer. Every token aliases a Primer variable wherever one exists; polyxd.* marks what Primer leaves to its components. The file is the same in both themes.",
    color: {
      $type: "color",
      surface: {
        default: g("bgColor-default"),
        subtle: g("bgColor-muted"),
        raised: gd("bgColor-default", "Primer's Box and card sit on the default background with a border, not a raised fill"),
        overlay: g("overlay-bgColor"),
        inverse: g("bgColor-emphasis"),
      },
      scrim: gd("overlay-backdrop-bgColor", "Primer's dialog backdrop"),
      text: { default: g("fgColor-default"), muted: g("fgColor-muted"), inverse: g("fgColor-onEmphasis"), link: g("fgColor-link") },
      border: { default: g("borderColor-default"), strong: g("borderColor-emphasis"), focus: g("focus-outlineColor") },
      action: {
        primary: { background: g("button-primary-bgColor-rest"), foreground: g("button-primary-fgColor-rest") },
        secondary: { background: g("button-default-bgColor-rest"), foreground: g("button-default-fgColor-rest"), border: g("button-default-borderColor-rest") },
        danger: { background: g("bgColor-danger-emphasis"), foreground: g("fgColor-onEmphasis") },
      },
      selection: { background: p("status-info-background"), foreground: p("status-info-foreground") },
      status: {
        info: { background: p("status-info-background"), foreground: p("status-info-foreground"), emphasis: p("status-info-emphasis") },
        success: { background: p("status-success-background"), foreground: p("status-success-foreground"), emphasis: p("status-success-emphasis") },
        warning: { background: p("status-warning-background"), foreground: p("status-warning-foreground"), emphasis: p("status-warning-emphasis") },
        danger: { background: p("status-danger-background"), foreground: p("status-danger-foreground"), emphasis: p("status-danger-emphasis") },
      },
      // Primer ships a data-visualisation palette of its own, which is what these are for.
      data: {
        categorical: {
          1: g("data-blue-color-emphasis"),
          2: g("data-green-color-emphasis"),
          3: g("data-purple-color-emphasis"),
          4: g("data-orange-color-emphasis"),
          5: g("data-pink-color-emphasis"),
          6: g("data-teal-color-emphasis"),
        },
        positive: g("data-green-color-emphasis"),
        negative: g("data-red-color-emphasis"),
        neutral: g("data-gray-color-emphasis"),
      },
    },
    type: {
      $type: "typography",
      title: { page: typo("xl", "tight", "semibold"), section: typo("lg", "snug", "semibold"), item: typo("md", "snug", "semibold") },
      body: { default: typo("md", "normal", "normal"), small: typo("sm", "relaxed", "normal") },
      label: { default: typo("sm", "normal", "medium"), small: typo("xs", "normal", "medium") },
      numeric: { display: { ...typo("xl", "tight", "semibold"), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
    },
    space: {
      $type: "dimension",
      inset: { compact: g("space-sm"), default: g("space-lg"), comfortable: g("space-xl") },
      stack: { tight: g("space-xs"), default: g("space-sm"), loose: g("space-md"), section: g("space-xl") },
      inline: { tight: g("space-xs"), default: g("space-sm"), loose: g("space-md") },
    },
    size: { $type: "dimension", target: { min: p("target.min") }, icon: { small: g("base-size-16"), default: g("base-size-20") } },
    radius: {
      $type: "dimension",
      small: g("borderRadius-small"),
      control: gd("borderRadius-medium", "Primer's button and input radius"),
      default: g("borderRadius-medium"),
      large: g("borderRadius-large"),
      full: g("borderRadius-full"),
    },
    border: { width: { $type: "dimension", default: g("borderWidth-thin"), strong: g("borderWidth-thick") } },
    focus: { ring: { $type: "dimension", width: g("focus-outline-width"), offset: g("focus-outline-offset") } },
    measure: { max: p("measure.max") },
    opacity: { state: { $type: "number", hover: p("state.hover"), pressed: p("state.pressed"), focus: p("state.focus"), disabled: p("state.disabled") } },
    shadow: { $type: "shadow", raised: g("shadow-resting-medium"), overlay: g("shadow-floating-small") },
    motion: {
      duration: { $type: "duration", instant: g("base-duration-50"), short: g("motion-duration-short"), medium: g("motion-duration-medium"), long: g("motion-duration-long") },
      easing: { $type: "cubicBezier", standard: g("base-easing-easeInOut"), enter: g("motion-easing-enter"), exit: g("motion-easing-exit") },
    },
  };
}

async function main(): Promise<void> {
  const i = process.argv.indexOf("--refresh");
  if (i > -1) {
    const from = join(process.argv[i + 1], "@primer/primitives/dist/css");
    for (const file of [...SCALES, ...Object.values(THEMES)]) await copyFile(join(from, file), join(SOURCES, file));
  }

  const scales = resolveVars(Object.assign({}, ...(await Promise.all(SCALES.map(async (file) => allVars(await read(file)))))));
  const theme = async (mode: "light" | "dark") => resolveVars({ ...scales, ...allVars(await read(THEMES[mode])) });
  const light = await theme("light");
  const darkVars = await theme("dark");
  const keep = (vars: Vars, only?: Set<string>) =>
    Object.fromEntries(Object.entries(vars).filter(([name]) => !SKIP.test(name.replace("--", "")) && (!only || only.has(name))));
  // The scales are identical in both themes, so they go in the shared tier and the theme files
  // carry only what actually differs between light and dark.
  const scaleNames = new Set(Object.keys(scales));
  const themeOnly = (vars: Vars) => keep(Object.fromEntries(Object.entries(vars).filter(([name]) => !scaleNames.has(name))));

  const describe = (scheme: string) => `GitHub Primer ${PINNED["@primer/primitives"]}, ${scheme} theme (functional/themes/${scheme}.css), variable names unchanged.`;
  await writePack({
    dir: ROOT,
    name: "primer",
    displayName: "GitHub Primer",
    contractVersion: "0.2.0",
    provenance: [
      {
        source: "npm:@primer/primitives dist/css (https://github.com/primer/primitives)",
        version: PINNED["@primer/primitives"],
        license: "MIT",
        notes: "Primer's base and functional scales and its two theme files are vendored verbatim under scripts/sources/primer; the generator reads their custom properties.",
      },
    ],
    shared: systemTier(keep(scales), "primer", TYPES, `GitHub Primer ${PINNED["@primer/primitives"]} scales — sizes, spacing, radii, type and motion — which are the same in both themes.`),
    light: { ...systemTier(themeOnly(light), "primer", TYPES, describe("light")), ...polyxdTier("light", light) },
    dark: { ...systemTier(themeOnly(darkVars), "primer", TYPES, describe("dark")), ...polyxdTier("dark", darkVars) },
    semantic: semanticTier(),
  });
  console.log(`wrote Primer tokens → ${join(ROOT, "tokens")}`);
}

await main();
