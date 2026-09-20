#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-mantine (Mantine 8, light and dark).
 *
 *   node scripts/generate.ts                          regenerate tokens/*.json from the vendored stylesheet
 *   node scripts/generate.ts --refresh <node_modules>  first re-copy the stylesheet from an installed copy
 *
 * To refresh, install the pinned package somewhere OUTSIDE the monorepo:
 *   cd "$(mktemp -d)" && npm init -y && npm install --ignore-scripts @mantine/core@8.4.2
 * and pass that directory's node_modules.
 *
 * Mantine publishes its whole theme as CSS custom properties, with the palette in `:root` and the
 * scheme-dependent roles under `:root[data-mantine-color-scheme='light'|'dark']`. The reading,
 * conversion and file writing are @polyxd/ds-kit's; what's here is the mapping.
 */
import { copyFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { alias, aliasWith, cssVars, nearestPassing, resolveVars, systemTier, writePack, type Json, type Vars } from "@polyxd/ds-kit";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/mantine");
const PINNED = { "@mantine/core": "8.4.2" } as const;

const TYPES = [
  { match: /^(spacing|radius|font-size|line-height-|breakpoint)/, type: "dimension" as const },
  { match: /^shadow-/, type: "shadow" as const },
  { match: /^(font-family|font-family-monospace|font-family-headings)/, type: "fontFamily" as const },
  { match: /^(line-height|font-weight|scale)$/, type: "number" as const },
];

/** Mantine's roles for one colour scheme: the palette from :root, the roles from the scheme block. */
function themeVars(css: string, scheme: "light" | "dark"): Vars {
  const base = cssVars(css, (s) => s.startsWith(":root") && !s.includes("color-scheme="), "--mantine-");
  const roles = cssVars(css, (s) => s.includes(`color-scheme='${scheme}'`), "--mantine-");
  return resolveVars({ ...base, ...roles });
}

/**
 * Values Mantine leaves to its components, and the steps its own palette needs to clear the
 * contract. Rather than guess a step, each role is measured against the surface it sits on and
 * moved along Mantine's own ramp until it passes (see nearestPassing).
 */
function polyxdTier(scheme: "light" | "dark", vars: Vars): Json {
  const ramp = (hue: string) => Array.from({ length: 10 }, (_, i) => vars[`--mantine-color-${hue}-${i}`]).filter(Boolean);
  const surface = vars["--mantine-color-body"];
  const raised = vars["--mantine-color-default"];
  const dark = scheme === "dark";
  const notes: string[] = [];

  /**
   * A step of `hue` that clears `min` against `on`, searched along Mantine's own ramp. The
   * direction is about the background, not the scheme: white text needs a darker fill either way.
   * When no step reaches the floor, the role falls back to the body text colour and says so.
   */
  const passing = (hue: string, on: string, min: number, from: number, direction: "darker" | "lighter", why = "") => {
    const steps = ramp(hue);
    const found = nearestPassing(steps, on, min, from, direction);
    if (!found.passes) {
      notes.push(`${hue}: no step reaches ${min}:1 on this background (best ${found.ratio.toFixed(2)}:1) → body text`);
      return { $value: "{mantine.color-text}", $description: `No step of Mantine's ${hue} ramp reaches ${min}:1 on its own ${scheme} tint (best ${found.ratio.toFixed(2)}:1), so this uses the body text colour` };
    }
    if (found.index !== from) notes.push(`${hue}-${from} → ${hue}-${found.index} (${found.ratio.toFixed(2)}:1${why ? `, ${why}` : ""})`);
    return {
      $value: `{mantine.color-${hue}-${found.index}}`,
      ...(found.index !== from ? { $description: `Contrast adjustment: Mantine's ${hue}-${from} doesn't reach ${min}:1 here; ${hue}-${found.index} is the nearest step of the same ramp that does (${found.ratio.toFixed(2)}:1)` } : {}),
    };
  };

  // Mantine pairs a tinted background with the text colour meant to sit on it: --mantine-color-<hue>-light
  // and -light-color, which it already flips per scheme. Status roles use that pair.
  const tint = (hue: string) => ({ $value: `{mantine.color-${hue}-light}`, $description: `Mantine's light variant of ${hue}` });
  const onTint = (hue: string) => {
    const background = vars[`--mantine-color-${hue}-light`];
    const text = vars[`--mantine-color-${hue}-light-color`];
    const steps = ramp(hue);
    const from = steps.findIndex((step) => step.toLowerCase() === String(text).toLowerCase());
    const found = nearestPassing(steps, background, 4.5, from === -1 ? (dark ? 0 : 9) : from, dark ? "lighter" : "darker");
    if (!found.passes) {
      notes.push(`${hue}-light pair is ${found.ratio.toFixed(2)}:1 → body text`);
      return { $value: "{mantine.color-text}", $description: `Mantine's ${hue}-light-color is ${found.ratio.toFixed(2)}:1 on ${hue}-light, so this uses the body text colour` };
    }
    return { $value: `{mantine.color-${hue}-${found.index}}`, ...(found.index !== from ? { $description: `Contrast adjustment: Mantine's ${hue}-light-color doesn't reach 4.5:1 on ${hue}-light; ${hue}-${found.index} does (${found.ratio.toFixed(2)}:1)` } : {}) };
  };
  /** An accent is a graphic, so 3:1 against the page is enough. */
  const accent = (hue: string) => passing(hue, surface, 3, dark ? 5 : 6, dark ? "lighter" : "darker");
  /** A filled button carries white text, so its fill has to be dark enough in either scheme. */
  const filled = (hue: string) => passing(hue, "#ffffff", 4.5, 6, "darker", "white button text");

  const tier = {
    $description: `Values Mantine does not define as variables, and contrast adjustments, for the ${scheme} scheme.`,
    polyxd: {
      sys: {
        $type: "color",
        "status-info-background": tint("blue"),
        "status-info-foreground": onTint("blue"),
        "status-info-emphasis": accent("blue"),
        "status-success-background": tint("green"),
        "status-success-foreground": onTint("green"),
        "status-success-emphasis": accent("green"),
        "status-warning-background": tint("yellow"),
        "status-warning-foreground": onTint("yellow"),
        "status-warning-emphasis": accent("yellow"),
        "status-danger-background": tint("red"),
        "status-danger-foreground": onTint("red"),
        "status-danger-emphasis": accent("red"),
        "data-1": accent("blue"),
        "data-2": accent("teal"),
        "data-3": accent("grape"),
        "data-4": accent("orange"),
        "data-5": accent("pink"),
        "data-6": accent("cyan"),
        "data-positive": accent("green"),
        "data-negative": accent("red"),
        "data-neutral": accent("gray"),
        // Mantine's --mantine-color-dimmed has to be readable on every surface the pack uses.
        "text-muted": passing("gray", dark ? raised : surface, 4.5, dark ? 4 : 6, dark ? "lighter" : "darker", "muted text"),
        "border-strong": passing("gray", surface, 3, dark ? 5 : 6, dark ? "lighter" : "darker", "a 3:1 stroke"),
        // Mantine's filled buttons put white on step 6, which is 3.56:1 — below 4.5 for its label.
        "action-primary": filled("blue"),
        "action-danger": filled("red"),
        // Mantine's --mantine-color-anchor is blue-6, 3.56:1 on white: readable as a graphic, not as text.
        "text-link": passing("blue", surface, 4.5, 6, dark ? "lighter" : "darker", "link text"),
        state: {
          $type: "number",
          hover: { $value: 0.06, $description: "Mantine shades hover with separate palette steps; Polyxd needs a state-layer opacity" },
          pressed: { $value: 0.12 },
          focus: { $value: 0.12 },
          disabled: { $value: 0.4, $description: "Mantine's disabled controls use its gray-5 text on gray-2" },
        },
        target: { $type: "dimension", min: { $value: { value: 44, unit: "px" }, $description: "Mantine's default control height is 36px; 44px is the touch target a generated surface is held to" } },
        focusRing: { $type: "dimension", width: { $value: { value: 2, unit: "px" } }, offset: { $value: { value: 2, unit: "px" }, $description: "Mantine's focus ring is a 2px outline with 2px offset" } },
        motion: {
          $type: "duration",
          instant: { $value: { value: 100, unit: "ms" } },
          short: { $value: { value: 150, unit: "ms" } },
          medium: { $value: { value: 200, unit: "ms" }, $description: "Mantine's default transition-duration" },
          long: { $value: { value: 300, unit: "ms" } },
        },
        easing: {
          $type: "cubicBezier",
          standard: { $value: [0.4, 0, 0.2, 1] },
          enter: { $value: [0, 0, 0.2, 1] },
          exit: { $value: [0.4, 0, 1, 1] },
        },
      },
    },
  };
  if (notes.length) console.log(`  ${scheme}: ${notes.join("; ")}`);
  return tier;
}

/** The Polyxd contract, each token an alias to a Mantine variable or a Polyxd addition. */
function semanticTier(): Json {
  const m = (name: string) => alias(`mantine.${name}`);
  const md = (name: string, description: string) => aliasWith(`mantine.${name}`, description);
  const p = (name: string) => alias(`polyxd.sys.${name}`);
  const typo = (size: string, weight: number) => ({
    $value: {
      fontFamily: "{mantine.font-family}",
      fontSize: `{mantine.font-size-${size}}`,
      fontWeight: weight,
      lineHeight: `{mantine.line-height-${size === "xl" || size === "lg" ? "sm" : "md"}}`,
      letterSpacing: { value: 0, unit: "px" },
    },
  });
  return {
    $description:
      "Polyxd semantic tier for Mantine 8. Every token aliases a Mantine variable wherever one exists; polyxd.* marks what Mantine leaves to its components. The file is the same in both schemes.",
    color: {
      $type: "color",
      surface: {
        default: m("color-body"),
        subtle: md("color-default-hover", "Mantine's hovered default surface, its subtle fill"),
        raised: md("color-default", "Mantine Paper and Card"),
        overlay: m("color-default"),
        inverse: md("color-text", "Mantine has no inverse surface; its text colour is the opposite end of the same ramp"),
      },
      scrim: { $value: "rgba(0, 0, 0, 0.6)", $description: "Mantine's Overlay default is #000 at 60%" },
      text: { default: m("color-text"), muted: p("text-muted"), inverse: m("color-body"), link: p("text-link") },
      border: { default: m("color-default-border"), strong: p("border-strong"), focus: m("primary-color-filled") },
      action: {
        primary: { background: p("action-primary"), foreground: m("color-white") },
        secondary: { background: m("color-default"), foreground: m("color-text"), border: m("color-default-border") },
        danger: { background: p("action-danger"), foreground: m("color-white") },
      },
      selection: { background: md("primary-color-light", "Mantine's light variant of the primary colour"), foreground: m("primary-color-light-color") },
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
      title: { page: typo("xl", 700), section: typo("lg", 600), item: typo("md", 600) },
      body: { default: typo("md", 400), small: typo("sm", 400) },
      label: { default: typo("sm", 500), small: typo("xs", 500) },
      numeric: { display: { ...typo("xl", 700), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
    },
    space: {
      $type: "dimension",
      inset: { compact: m("spacing-xs"), default: m("spacing-md"), comfortable: m("spacing-lg") },
      stack: { tight: m("spacing-xs"), default: m("spacing-sm"), loose: m("spacing-md"), section: m("spacing-xl") },
      inline: { tight: m("spacing-xs"), default: m("spacing-sm"), loose: m("spacing-md") },
    },
    size: { $type: "dimension", target: { min: p("target.min") }, icon: { small: m("font-size-sm"), default: m("font-size-lg") } },
    radius: {
      $type: "dimension",
      small: m("radius-xs"),
      control: md("radius-sm", "Mantine's default control radius"),
      default: m("radius-md"),
      large: m("radius-lg"),
      full: { $value: { value: 9999, unit: "px" }, $description: "Mantine's radius=\"xl\" on a round control" },
    },
    border: { width: { $type: "dimension", default: { $value: { value: 1, unit: "px" } }, strong: { $value: { value: 2, unit: "px" } } } },
    focus: { ring: { $type: "dimension", width: p("focusRing.width"), offset: p("focusRing.offset") } },
    measure: { max: { $value: 65, $type: "number", $description: "Characters per line for running text (Polyxd; Mantine has no measure token)" } },
    opacity: { state: { $type: "number", hover: p("state.hover"), pressed: p("state.pressed"), focus: p("state.focus"), disabled: p("state.disabled") } },
    shadow: { $type: "shadow", raised: m("shadow-sm"), overlay: m("shadow-lg") },
    motion: {
      duration: { $type: "duration", instant: p("motion.instant"), short: p("motion.short"), medium: p("motion.medium"), long: p("motion.long") },
      easing: { $type: "cubicBezier", standard: p("easing.standard"), enter: p("easing.enter"), exit: p("easing.exit") },
    },
  };
}

async function main(): Promise<void> {
  const i = process.argv.indexOf("--refresh");
  if (i > -1) await copyFile(join(process.argv[i + 1], "@mantine/core/styles.css"), join(SOURCES, "styles.css"));

  const css = await readFile(join(SOURCES, "styles.css"), "utf8");
  const light = themeVars(css, "light");
  const darkVars = themeVars(css, "dark");
  const describe = (scheme: string) => `Mantine ${PINNED["@mantine/core"]}, ${scheme} scheme (:root plus [data-mantine-color-scheme='${scheme}']), variable names unchanged.`;
  await writePack({
    dir: ROOT,
    name: "mantine",
    displayName: "Mantine 8",
    contractVersion: "0.2.0",
    provenance: [
      {
        source: "npm:@mantine/core styles.css (https://github.com/mantinedev/mantine)",
        version: PINNED["@mantine/core"],
        license: "MIT",
        notes: "The stylesheet is vendored verbatim as scripts/sources/mantine/styles.css; the generator reads its custom properties.",
      },
    ],
    light: { ...systemTier(light, "mantine", TYPES, describe("light")), ...polyxdTier("light", light) },
    dark: { ...systemTier(darkVars, "mantine", TYPES, describe("dark")), ...polyxdTier("dark", darkVars) },
    semantic: semanticTier(),
  });
  console.log(`wrote Mantine tokens → ${join(ROOT, "tokens")}`);
}

await main();
