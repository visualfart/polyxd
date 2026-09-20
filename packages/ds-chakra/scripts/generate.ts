#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-chakra (Chakra UI 3, light and dark).
 *
 *   node scripts/generate.ts     regenerate tokens/*.json from the vendored stylesheet
 *
 * The vendored stylesheet is not published by Chakra: it is emitted by Chakra's own
 * `defaultSystem.getTokenCss()` (see scripts/extract.ts), which is what a Chakra app ships. From
 * there this is an ordinary CSS pack: the base block holds the scales and palettes, and the
 * `.light` / `.dark` blocks hold the semantic colours Chakra flips between the two.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { alias, aliasWith, cssVars, nearestPassing, resolveVars, systemTier, writePack, type Json, type Vars } from "@polyxd/ds-kit";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/chakra");
const PINNED = { "@chakra-ui/react": "3.37.0" } as const;

const TYPES = [
  { match: /^(spacing|sizes|radii|font-sizes|border-widths|blurs|breakpoints)-/, type: "dimension" as const },
  { match: /^shadows-/, type: "shadow" as const },
  { match: /^fonts-/, type: "fontFamily" as const },
  { match: /^(font-weights|line-heights|z-index)-/, type: "number" as const },
  { match: /^durations-/, type: "duration" as const },
  { match: /^easings-/, type: "cubicBezier" as const },
];

/** Animations, keyframes, aspect ratios and cursors are not tokens the contract can use. */
const SKIP = /^(animations|aspect-ratios|cursor|assets|letter-spacings)-/;

/** Chakra's variables for one colour mode: the base block with that mode's semantic block over it. */
function themeVars(css: string, mode: "light" | "dark"): Vars {
  const base = cssVars(css, (s) => s.includes("chakra-theme)"), "--chakra-");
  const semantic = cssVars(css, (s) => (mode === "dark" ? s.startsWith(".dark") : s.startsWith(":root")), "--chakra-");
  return resolveVars({ ...base, ...semantic });
}

/**
 * Values Chakra leaves to its components, and the steps its own palettes need to clear the
 * contract. Chakra's ramps are Tailwind-shaped — 50 to 950, lighter to darker — so a role that
 * needs more contrast in light mode moves up the numbers and in dark mode moves down them.
 */
function polyxdTier(mode: "light" | "dark", vars: Vars): Json {
  const dark = mode === "dark";
  const surface = vars["--chakra-colors-bg"];
  const notes: string[] = [];
  const v = (name: string) => vars[`--chakra-colors-${name}`];

  const ramp = (hue: string) =>
    Object.keys(vars)
      .filter((name) => new RegExp(`^--chakra-colors-${hue}-\\d+$`).test(name))
      .sort((a, b) => Number(a.split("-").pop()) - Number(b.split("-").pop()));

  /** The nearest step of `hue` that clears `min` on `on`, along Chakra's own ramp. */
  const passing = (hue: string, fromStep: number, on: string, min: number, why: string) => {
    const steps = ramp(hue);
    const from = Math.max(
      0,
      steps.indexOf(`--chakra-colors-${hue}-${fromStep}`),
    );
    const found = nearestPassing(
      steps.map((name) => vars[name]),
      on,
      min,
      from,
      dark ? "lighter" : "darker",
    );
    const name = (i: number) => steps[i].replace("--chakra-colors-", "");
    if (!found.passes) {
      notes.push(`${hue}: no step reaches ${min}:1 (best ${found.ratio.toFixed(2)}:1) → foreground`);
      return { $value: "{chakra.colors-fg}", $description: `No step of Chakra's ${hue} ramp reaches ${min}:1 here (best ${found.ratio.toFixed(2)}:1), so this uses the foreground colour` };
    }
    if (found.index !== from) notes.push(`${hue}-${fromStep} → ${name(found.index)} (${found.ratio.toFixed(2)}:1, ${why})`);
    return {
      $value: `{chakra.colors-${name(found.index)}}`,
      ...(found.index !== from ? { $description: `Contrast adjustment: Chakra's ${hue}-${fromStep} doesn't reach ${min}:1 here; ${name(found.index)} is the nearest step of the same ramp that does (${found.ratio.toFixed(2)}:1)` } : {}),
    };
  };

  /** Text on one of Chakra's status tints, which is a 50 step in light and a 950 step in dark. */
  const onTint = (hue: string, role: string) => passing(hue, dark ? 300 : 600, v(`bg-${role}`), 4.5, "status text");
  /** An accent is a graphic: 3:1 against the page. */
  const accent = (hue: string) => passing(hue, dark ? 400 : 500, surface, 3, "a 3:1 accent");
  /** A solid button carries Chakra's inverted foreground, so the fill is measured against that. */
  const filled = (hue: string) => passing(hue, dark ? 400 : 600, v("fg-inverted"), 4.5, "button label");

  const tier = {
    $description: `Values Chakra UI does not define as variables, and contrast adjustments, for the ${mode} mode.`,
    polyxd: {
      sys: {
        $type: "color",
        "status-info-foreground": onTint("blue", "info"),
        "status-info-emphasis": accent("blue"),
        "status-success-foreground": onTint("green", "success"),
        "status-success-emphasis": accent("green"),
        "status-warning-foreground": onTint("orange", "warning"),
        "status-warning-emphasis": accent("orange"),
        "status-danger-foreground": onTint("red", "error"),
        "status-danger-emphasis": accent("red"),
        "data-1": accent("blue"),
        "data-2": accent("green"),
        "data-3": accent("purple"),
        "data-4": accent("orange"),
        "data-5": accent("pink"),
        "data-6": accent("teal"),
        "data-positive": accent("green"),
        "data-negative": accent("red"),
        "data-neutral": accent("gray"),
        "text-muted": passing("gray", dark ? 400 : 600, surface, 4.5, "muted text"),
        "border-strong": passing("gray", dark ? 600 : 300, surface, 3, "a 3:1 stroke"),
        // Chakra's default colour palette is gray, so its solid button is a dark neutral fill.
        "action-primary": filled("gray"),
        "action-danger": filled("red"),
        "text-link": passing("blue", dark ? 400 : 600, surface, 4.5, "link text"),
        // Chakra's focus ring follows whatever colour palette a component is given, and its
        // neutral default — border-emphasized, gray-300 — is 1.48:1 on the page. A focus ring is a
        // graphic the keyboard user has to find, so it moves up the same gray ramp until it is one.
        "border-focus": passing("gray", dark ? 600 : 300, surface, 3, "a 3:1 focus ring"),
        "selection-background": { $value: `{chakra.colors-bg-info}`, $description: "Chakra's informational tint, which is its selected-row fill" },
        "selection-foreground": onTint("blue", "info"),
        state: {
          $type: "number",
          hover: { $value: 0.06, $description: "Chakra shades hover with separate palette steps; Polyxd needs a state-layer opacity" },
          pressed: { $value: 0.12 },
          focus: { $value: 0.12 },
          disabled: { $value: 0.5, $description: "Chakra's disabled controls are its standard controls at half opacity" },
        },
        target: { $type: "dimension", min: { $value: { value: 44, unit: "px" }, $description: "Chakra's medium control is 40px; 44px is the touch target a generated surface is held to" } },
        measure: { $type: "number", max: { $value: 65, $description: "Characters per line for running text (Polyxd; Chakra has no measure token)" } },
        focusRing: { $type: "dimension", width: { $value: { value: 2, unit: "px" } }, offset: { $value: { value: 2, unit: "px" }, $description: "Chakra's focus ring is a 2px outline with a 2px offset" } },
      },
    },
  };
  if (notes.length) console.log(`  ${mode}: ${notes.join("; ")}`);
  return tier;
}

/** The Polyxd contract, each token an alias to a Chakra variable or a Polyxd addition. */
function semanticTier(): Json {
  const c = (name: string) => alias(`chakra.${name}`);
  const cd = (name: string, description: string) => aliasWith(`chakra.${name}`, description);
  const p = (name: string) => alias(`polyxd.sys.${name}`);
  const typo = (size: string, line: string, weight: string) => ({
    $value: {
      fontFamily: "{chakra.fonts-body}",
      fontSize: `{chakra.font-sizes-${size}}`,
      fontWeight: `{chakra.font-weights-${weight}}`,
      lineHeight: `{chakra.line-heights-${line}}`,
      letterSpacing: { value: 0, unit: "px" },
    },
  });
  return {
    $description:
      "Polyxd semantic tier for Chakra UI 3. Every token aliases a Chakra variable wherever one exists; polyxd.* marks what Chakra leaves to its components. The file is the same in both modes.",
    color: {
      $type: "color",
      surface: {
        default: c("colors-bg"),
        subtle: c("colors-bg-subtle"),
        raised: cd("colors-bg-panel", "Chakra's panel surface: its cards, menus and dialogs"),
        overlay: c("colors-bg-panel"),
        inverse: c("colors-bg-inverted"),
      },
      scrim: { $value: "rgba(0, 0, 0, 0.48)", $description: "Chakra's dialog backdrop is black at 48%, set in its recipe rather than in a token" },
      text: { default: c("colors-fg"), muted: p("text-muted"), inverse: c("colors-fg-inverted"), link: p("text-link") },
      border: { default: c("colors-border"), strong: p("border-strong"), focus: p("border-focus") },
      action: {
        primary: { background: p("action-primary"), foreground: c("colors-fg-inverted") },
        secondary: { background: c("colors-bg-subtle"), foreground: c("colors-fg"), border: c("colors-border") },
        danger: { background: p("action-danger"), foreground: c("colors-fg-inverted") },
      },
      selection: { background: p("selection-background"), foreground: p("selection-foreground") },
      status: {
        info: { background: c("colors-bg-info"), foreground: p("status-info-foreground"), emphasis: p("status-info-emphasis") },
        success: { background: c("colors-bg-success"), foreground: p("status-success-foreground"), emphasis: p("status-success-emphasis") },
        warning: { background: c("colors-bg-warning"), foreground: p("status-warning-foreground"), emphasis: p("status-warning-emphasis") },
        danger: { background: c("colors-bg-error"), foreground: p("status-danger-foreground"), emphasis: p("status-danger-emphasis") },
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
      title: { page: typo("2xl", "shorter", "bold"), section: typo("xl", "short", "semibold"), item: typo("md", "short", "semibold") },
      body: { default: typo("md", "moderate", "normal"), small: typo("sm", "moderate", "normal") },
      label: { default: typo("sm", "short", "medium"), small: typo("xs", "short", "medium") },
      numeric: { display: { ...typo("2xl", "shorter", "bold"), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
    },
    space: {
      $type: "dimension",
      inset: { compact: c("spacing-2"), default: c("spacing-4"), comfortable: c("spacing-6") },
      stack: { tight: c("spacing-1"), default: c("spacing-2"), loose: c("spacing-4"), section: c("spacing-8") },
      inline: { tight: c("spacing-1"), default: c("spacing-2"), loose: c("spacing-4") },
    },
    size: { $type: "dimension", target: { min: p("target.min") }, icon: { small: c("font-sizes-sm"), default: c("font-sizes-lg") } },
    radius: {
      $type: "dimension",
      small: c("radii-sm"),
      control: cd("radii-l2", "Chakra's control radius: the second step of its layered radius scale"),
      default: c("radii-md"),
      large: c("radii-lg"),
      full: c("radii-full"),
    },
    border: { width: { $type: "dimension", default: { $value: { value: 1, unit: "px" } }, strong: { $value: { value: 2, unit: "px" } } } },
    focus: { ring: { $type: "dimension", width: p("focusRing.width"), offset: p("focusRing.offset") } },
    measure: { max: p("measure.max") },
    opacity: { state: { $type: "number", hover: p("state.hover"), pressed: p("state.pressed"), focus: p("state.focus"), disabled: p("state.disabled") } },
    shadow: { $type: "shadow", raised: c("shadows-sm"), overlay: c("shadows-lg") },
    motion: {
      duration: { $type: "duration", instant: c("durations-fastest"), short: c("durations-fast"), medium: c("durations-moderate"), long: c("durations-slow") },
      easing: { $type: "cubicBezier", standard: c("easings-ease-in-out"), enter: c("easings-ease-out"), exit: c("easings-ease-in") },
    },
  };
}

async function main(): Promise<void> {
  const css = await readFile(join(SOURCES, "tokens.css"), "utf8");
  const filter = (vars: Vars) => Object.fromEntries(Object.entries(vars).filter(([name]) => !SKIP.test(name.replace("--chakra-", ""))));
  const light = filter(themeVars(css, "light"));
  const darkVars = filter(themeVars(css, "dark"));
  const describe = (mode: string) => `Chakra UI ${PINNED["@chakra-ui/react"]}, ${mode} mode, variable names unchanged.`;
  await writePack({
    dir: ROOT,
    name: "chakra",
    displayName: "Chakra UI 3",
    contractVersion: "0.2.0",
    provenance: [
      {
        source: "npm:@chakra-ui/react defaultSystem.getTokenCss() (https://github.com/chakra-ui/chakra-ui)",
        version: PINNED["@chakra-ui/react"],
        license: "MIT",
        notes: "Chakra publishes its theme as JavaScript, so scripts/extract.ts runs Chakra's own CSS emitter against the pinned package and vendors the result as scripts/sources/chakra/tokens.css.",
      },
    ],
    light: { ...systemTier(light, "chakra", TYPES, describe("light")), ...polyxdTier("light", light) },
    dark: { ...systemTier(darkVars, "chakra", TYPES, describe("dark")), ...polyxdTier("dark", darkVars) },
    semantic: semanticTier(),
  });
  console.log(`wrote Chakra tokens → ${join(ROOT, "tokens")}`);
}

await main();
