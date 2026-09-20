#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-radix (Radix Themes 3, light and dark).
 *
 *   node scripts/generate.ts                          regenerate tokens/*.json from the vendored stylesheet
 *   node scripts/generate.ts --refresh <node_modules>  first re-copy the stylesheet from an installed copy
 *
 * To refresh, install the pinned package somewhere OUTSIDE the monorepo:
 *   cd "$(mktemp -d)" && npm init -y && npm install --ignore-scripts @radix-ui/themes@3.3.0
 * and pass that directory's node_modules.
 *
 * Radix Themes is configurable at runtime: accent colour, gray, radius and scaling are attributes
 * on its root element. This pack takes its documented defaults — indigo accent, medium radius,
 * 100% scaling — and says so, rather than pretending there is one Radix look.
 *
 * Its colours are published twice: sRGB, and the same scales in display-p3 inside @supports. The
 * pack reads the sRGB ones, because WCAG contrast is defined on sRGB.
 */
import { copyFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { alias, aliasWith, cssVars, resolveVars, systemTier, writePack, type Json, type Vars } from "@polyxd/ds-kit";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/radix");
const PINNED = { "@radix-ui/themes": "3.3.0" } as const;
/** Radix Themes' own defaults, as its documentation states them. */
const DEFAULTS = { accent: "indigo", radius: "medium", scaling: "100%" } as const;

const TYPES = [
  { match: /^(space|font-size|radius|line-height|letter-spacing|container)-/, type: "dimension" as const },
  { match: /^shadow-/, type: "shadow" as const },
  { match: /^(default-font-family|heading-font-family|code-font-family|strong-font-family|em-font-family|quote-font-family)$/, type: "fontFamily" as const },
  { match: /^(font-weight|scaling|radius-factor|radius-full|radius-thumb)/, type: "number" as const },
];

/** One mode's variables: the base scales, the chosen accent and radius, then the mode's colours. */
function themeVars(css: string, mode: "light" | "dark"): Vars {
  // sRGB only: Radix repeats every scale in display-p3 inside @supports, and contrast is sRGB.
  const srgb = (_: string, atRule?: string) => !atRule;
  const isLight = (s: string) => /(^|,\s*)(:root|\.light|\.light-theme)\s*(,|$)/.test(s);
  const isDark = (s: string) => s.includes(".dark") && !s.includes("light");
  const collect = (matches: (s: string, at?: string) => boolean) => cssVars(css, (s, at) => srgb(s, at) && matches(s));
  return resolveVars({
    ...collect(isLight),
    ...(mode === "dark" ? collect(isDark) : {}),
    // Radix writes these under several spellings of its root: ".radix-themes", ":where(.radix-themes)",
    // and a longer selector that also carries the focus scale.
    ...collect((s) => s.includes(".radix-themes")),
    ...collect((s) => s.includes(`data-accent-color='${DEFAULTS.accent}'`)),
    ...collect((s) => s.includes(`data-accent-color='${DEFAULTS.accent}'`) || s === `[data-accent-color='${DEFAULTS.accent}']`),
    ...collect((s) => s === "[data-radius]" || s.includes(`data-radius='${DEFAULTS.radius}'`)),
    ...collect((s) => s.includes(`data-scaling='${DEFAULTS.scaling}'`)),
    ...collect((s) => s.includes("data-panel-background='solid'")),
  });
}

/** Values Radix leaves to its components. Its scales are accessible by construction, step by step. */
function polyxdTier(mode: "light" | "dark"): Json {
  return {
    $description: `Values Radix Themes does not define as variables, for the ${mode} theme.`,
    polyxd: {
      sys: {
        state: {
          $type: "number",
          hover: { $value: 0.06, $description: "Radix uses step 4 of a scale for hover; Polyxd needs a state-layer opacity" },
          pressed: { $value: 0.12 },
          focus: { $value: 0.12 },
          disabled: { $value: 0.5, $description: "Radix's disabled controls sit at 50%" },
        },
        target: { $type: "dimension", min: { $value: { value: 44, unit: "px" }, $description: "Radix's size-2 control is 32px; 44px is the touch target a generated surface is held to" } },
        focusRing: { $type: "dimension", width: { $value: { value: 2, unit: "px" } }, offset: { $value: { value: 2, unit: "px" } } },
        border: { $type: "dimension", strong: { $value: { value: 2, unit: "px" } } },
        motion: {
          $type: "duration",
          instant: { $value: { value: 100, unit: "ms" } },
          short: { $value: { value: 150, unit: "ms" } },
          medium: { $value: { value: 200, unit: "ms" } },
          long: { $value: { value: 300, unit: "ms" } },
        },
        easing: {
          $type: "cubicBezier",
          standard: { $value: [0.45, 0, 0.55, 1], $description: "Radix's --ease-in-out" },
          enter: { $value: [0.16, 1, 0.3, 1] },
          exit: { $value: [0.7, 0, 0.84, 0] },
        },
      },
    },
  };
}

/**
 * The Polyxd contract on Radix's 12-step scales, which carry their own meaning: 1–2 backgrounds,
 * 3–5 component fills, 6–8 borders, 9–10 solid fills, 11 accessible text, 12 high-contrast text.
 */
function semanticTier(): Json {
  const r = (name: string) => alias(`radix.${name}`);
  const rd = (name: string, description: string) => aliasWith(`radix.${name}`, description);
  const p = (name: string) => alias(`polyxd.sys.${name}`);
  const typo = (size: string, weight: string) => ({
    $value: {
      fontFamily: "{radix.default-font-family}",
      fontSize: `{radix.font-size-${size}}`,
      fontWeight: `{radix.font-weight-${weight}}`,
      lineHeight: `{radix.line-height-${size}}`,
      letterSpacing: { value: 0, unit: "px" },
    },
  });
  return {
    $description:
      "Polyxd semantic tier for Radix Themes 3 (indigo accent, medium radius, 100% scaling — its own defaults). Radix's steps carry meaning: 9 is a solid fill, 11 is text that passes on its scale's background, 12 is high-contrast text.",
    color: {
      $type: "color",
      surface: {
        default: r("color-background"),
        subtle: rd("gray-2", "Radix's second step: a subtle background"),
        raised: rd("color-panel-solid", "Radix's solid panel"),
        overlay: r("color-panel-solid"),
        inverse: r("gray-12"),
      },
      scrim: rd("color-overlay", "Radix's overlay colour"),
      text: {
        default: rd("gray-12", "Radix's high-contrast text step"),
        muted: rd("gray-11", "Radix's step 11, which passes 4.5:1 on steps 1–2 by construction"),
        inverse: r("gray-1"),
        link: r("accent-11"),
      },
      border: {
        default: rd("gray-6", "Radix's subtle border step"),
        strong: rd("gray-9", "Radix's gray-8 is its strong border but only 1.86:1 in light mode; gray-9 is the next step and carries 3:1"),
        focus: rd("accent-9", "Radix's focus-8 is 2.36:1 on a light page; accent-9 is the same hue one step on, at 5.08:1"),
      },
      action: {
        primary: { background: rd("accent-9", "Radix's solid accent fill"), foreground: rd("accent-contrast", "The text colour Radix pairs with step 9") },
        secondary: { background: r("gray-3"), foreground: r("gray-12"), border: r("gray-7") },
        danger: {
          // No solid red step carries white at 4.5:1 (red-9 is 3.91:1 in both modes, and in dark the
          // ramp gets lighter, not darker). Step 11 flips with the mode — dark in light, light in
          // dark — so pairing it with step 1 passes both ways: 5.21:1 and 8.95:1.
          background: rd("red-11", "Radix's solid red steps carry white at 3.91:1 at best; step 11 with step 1 passes in both modes"),
          foreground: r("gray-1"),
        },
      },
      selection: { background: rd("accent-4", "Radix's selected component fill"), foreground: r("accent-12") },
      status: {
        // Radix pairs step 11 text with a step 3 background; in light mode that lands at 4.21–4.54:1,
        // so status text uses step 12, its high-contrast step of the same hue.
        info: { background: r("blue-3"), foreground: rd("blue-12", "Radix's blue-11 on blue-3 is 4.25:1, under 4.5:1 for text"), emphasis: r("blue-11") },
        success: { background: r("green-3"), foreground: rd("green-12", "Radix's green-11 on green-3 is 4.21:1"), emphasis: r("green-11") },
        warning: { background: r("amber-3"), foreground: rd("amber-12", "Radix's amber-11 on amber-3 is 4.25:1"), emphasis: rd("amber-11", "Radix's amber-9 is a bright fill: 1.54:1 on the page, so the accent uses step 11") },
        danger: { background: r("red-3"), foreground: rd("red-12", "Radix's red-11 on red-3 is 4.54:1 in light and passes, but dark mode pairs 12 with 3 the same way"), emphasis: r("red-11") },
      },
      data: {
        // Step 9 is Radix's solid fill, tuned for white text rather than for contrast against the
        // page: amber-9 is 1.54:1 on a light background. Step 11 is its accessible step in both modes.
        categorical: { 1: r("indigo-11"), 2: r("green-11"), 3: r("purple-11"), 4: r("amber-11"), 5: r("crimson-11"), 6: r("cyan-11") },
        positive: r("green-11"),
        negative: r("red-11"),
        neutral: r("gray-11"),
      },
    },
    type: {
      $type: "typography",
      title: { page: typo("7", "bold"), section: typo("5", "bold"), item: typo("3", "medium") },
      body: { default: typo("3", "regular"), small: typo("2", "regular") },
      label: { default: typo("2", "medium"), small: typo("1", "medium") },
      numeric: { display: { ...typo("8", "bold"), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
    },
    space: {
      $type: "dimension",
      inset: { compact: r("space-2"), default: r("space-3"), comfortable: r("space-5") },
      stack: { tight: r("space-1"), default: r("space-2"), loose: r("space-4"), section: r("space-6") },
      inline: { tight: r("space-1"), default: r("space-2"), loose: r("space-4") },
    },
    size: { $type: "dimension", target: { min: p("target.min") }, icon: { small: r("font-size-2"), default: r("font-size-5") } },
    radius: {
      $type: "dimension",
      small: r("radius-1"),
      control: rd("radius-3", "Radix's control radius at its default medium setting"),
      default: r("radius-3"),
      large: r("radius-4"),
      full: { $value: { value: 9999, unit: "px" }, $description: "Radix's --radius-full" },
    },
    border: { width: { $type: "dimension", default: { $value: { value: 1, unit: "px" } }, strong: p("border.strong") } },
    focus: { ring: { $type: "dimension", width: p("focusRing.width"), offset: p("focusRing.offset") } },
    measure: { max: { $value: 65, $type: "number", $description: "Characters per line for running text (Polyxd; Radix has no measure token)" } },
    opacity: { state: { $type: "number", hover: p("state.hover"), pressed: p("state.pressed"), focus: p("state.focus"), disabled: p("state.disabled") } },
    shadow: { $type: "shadow", raised: rd("shadow-2", "Radix's second elevation"), overlay: rd("shadow-5", "Radix's dialog elevation") },
    motion: {
      duration: { $type: "duration", instant: p("motion.instant"), short: p("motion.short"), medium: p("motion.medium"), long: p("motion.long") },
      easing: { $type: "cubicBezier", standard: p("easing.standard"), enter: p("easing.enter"), exit: p("easing.exit") },
    },
  };
}

async function main(): Promise<void> {
  const i = process.argv.indexOf("--refresh");
  if (i > -1) await copyFile(join(process.argv[i + 1], "@radix-ui/themes/styles.css"), join(SOURCES, "styles.css"));

  const css = await readFile(join(SOURCES, "styles.css"), "utf8");
  const describe = (mode: string) =>
    `Radix Themes ${PINNED["@radix-ui/themes"]}, ${mode} (accent ${DEFAULTS.accent}, radius ${DEFAULTS.radius}, scaling ${DEFAULTS.scaling}; sRGB, not the display-p3 overrides), variable names unchanged.`;
  await writePack({
    dir: ROOT,
    name: "radix",
    displayName: "Radix Themes 3",
    contractVersion: "0.2.0",
    provenance: [
      {
        source: "npm:@radix-ui/themes styles.css (https://github.com/radix-ui/themes)",
        version: PINNED["@radix-ui/themes"],
        license: "MIT",
        notes: `The stylesheet is vendored verbatim as scripts/sources/radix/styles.css. The pack reads its sRGB custom properties at Radix's default settings (accent ${DEFAULTS.accent}, radius ${DEFAULTS.radius}, scaling ${DEFAULTS.scaling}).`,
      },
    ],
    light: { ...systemTier(themeVars(css, "light"), "radix", TYPES, describe("light")), ...polyxdTier("light") },
    dark: { ...systemTier(themeVars(css, "dark"), "radix", TYPES, describe("dark")), ...polyxdTier("dark") },
    semantic: semanticTier(),
  });
  console.log(`wrote Radix Themes tokens → ${join(ROOT, "tokens")}`);
}

await main();
