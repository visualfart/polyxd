#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-polaris (Shopify Polaris, light and dark).
 *
 *   node scripts/generate.ts                           regenerate tokens/*.json from the vendored stylesheet
 *   node scripts/generate.ts --refresh <node_modules>  first re-copy the stylesheet from an installed copy
 *
 * To refresh, install the pinned package somewhere OUTSIDE the monorepo:
 *   cd "$(mktemp -d)" && npm init -y && npm install --ignore-scripts @shopify/polaris-tokens@9.4.2
 * and pass that directory's node_modules.
 *
 * Polaris publishes its theme as CSS custom properties: everything in `:root, .p-theme-light`, and
 * a short `.p-theme-dark` block that overrides the neutrals only. Its status colours are the same
 * in both themes — a light green success chip on a dark page is what Polaris itself renders today —
 * so the dark pack keeps them and moves only what the contract's contrast floors require.
 */
import { copyFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { alias, aliasWith, cssVars, nearestPassing, resolveVars, systemTier, writePack, type Json, type Vars } from "@polyxd/ds-kit";
import { contrastRatio, luminance, toRgb } from "@polyxd/spec";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/polaris");
const PINNED = { "@shopify/polaris-tokens": "9.4.2" } as const;

const TYPES = [
  { match: /^(space|border-radius|border-width|font-size|font-line-height|width|height|breakpoints)/, type: "dimension" as const },
  { match: /^shadow-/, type: "shadow" as const },
  { match: /^font-family/, type: "fontFamily" as const },
  { match: /^(font-weight|z-index)/, type: "number" as const },
  { match: /^motion-duration/, type: "duration" as const },
  { match: /^motion-ease/, type: "cubicBezier" as const },
];

/** Polaris's variables for one theme: the light block, with the dark block layered over it. */
function themeVars(css: string, scheme: "light" | "dark"): Vars {
  const light = cssVars(css, (s) => s.includes(".p-theme-light"), "--p-");
  const dark = cssVars(css, (s) => s.includes(".p-theme-dark"), "--p-");
  return renamed(resolveVars(scheme === "light" ? light : { ...light, ...dark }));
}

/**
 * Polaris's variables are prefixed `--p-`; the pack's namespace is `polaris`, so the names are
 * rewritten once, after `var()` references have been resolved against the original names.
 */
const renamed = (vars: Vars): Vars => Object.fromEntries(Object.entries(vars).map(([name, value]) => [name.replace(/^--p-/, "--polaris-"), value]));

/** Keyframes and animation helpers aren't tokens; neither are Polaris's component-scoped colours. */
const SKIP = /^(motion-keyframes|motion-linear|shadow-button|shadow-inset|shadow-bevel|color-video|color-scrollbar|color-tooltip)/;

/**
 * Values Polaris leaves to its components, and the contrast adjustments each theme needs.
 *
 * Polaris has no numbered colour ramps in CSS, but each status has a family that runs light to
 * dark — surface, border, fill, text — and that family is the ramp this pack walks when a role
 * doesn't clear a floor. Same rule as every other pack: move along the system's own steps.
 */
function polyxdTier(scheme: "light" | "dark", vars: Vars): Json {
  const dark = scheme === "dark";
  const surface = vars["--polaris-color-bg-surface"];
  const notes: string[] = [];
  const v = (name: string) => vars[`--polaris-color-${name}`];

  /**
   * A status family as a ramp, lightest first. Polaris names these by role rather than by number —
   * surface, border, icon, fill, text — and the order of the roles isn't the order of the colours
   * (critical's icon is lighter than its fill), so the ramp is sorted by measured luminance.
   */
  const family = (status: string) =>
    [`bg-surface-${status}`, `border-${status}`, `icon-${status}`, `bg-fill-${status}`, `text-${status}`]
      .filter((name) => v(name))
      .sort((a, b) => luminance(toRgb(v(b))) - luminance(toRgb(v(a))));

  /**
   * The nearest member of a status family that clears `min` against `on`, starting from the one
   * Polaris uses for that role. Statuses whose whole family stays light in the dark theme have to
   * move toward the light end to be seen on a dark page, so the direction follows the scheme.
   */
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
      notes.push(`${status}: no member of the family reaches ${min}:1 (best ${found.ratio.toFixed(2)}:1) → text colour`);
      return { $value: "{polaris.color-text}", $description: `No colour in Polaris's ${status} family reaches ${min}:1 on this ${scheme} surface (best ${found.ratio.toFixed(2)}:1), so this uses the body text colour` };
    }
    if (found.index !== from) notes.push(`${role} → ${steps[found.index]} (${found.ratio.toFixed(2)}:1, ${why})`);
    return {
      $value: `{polaris.color-${steps[found.index]}}`,
      ...(found.index !== from ? { $description: `Contrast adjustment: Polaris's ${role} doesn't reach ${min}:1 here; ${steps[found.index]} is the nearest colour of the same family that does (${found.ratio.toFixed(2)}:1)` } : {}),
    };
  };

  /** A status accent is a graphic, so 3:1 against the page it sits on is the floor. */
  const emphasis = (status: string) => passing(status, `icon-${status}`, surface, 3, "a 3:1 accent");
  /** Text inside a status chip sits on that status's own surface. */
  const onChip = (status: string) => passing(status, `text-${status}`, v(`bg-surface-${status}`), 4.5, "chip text");

  /**
   * A destructive button has to satisfy two floors at once: 3:1 against the page it sits on, and
   * 4.5:1 for its own label. Polaris's critical fill is 2.20:1 on its dark surface, so the fill
   * moves along the critical family and the label takes whichever of Polaris's two critical text
   * colours clears 4.5:1 on the step chosen.
   */
  const [dangerFill, dangerText] = (() => {
    const fill = passing("critical", "bg-fill-critical", surface, 3, "a 3:1 destructive button");
    const chosen = String(fill.$value).replace("{polaris.color-", "").replace("}", "");
    const on = v(chosen) ?? v("bg-fill-critical");
    for (const label of ["text-critical-on-bg-fill", "text-critical", "text", "text-inverse"]) {
      if (v(label) && contrastRatio(v(label), on) >= 4.5) {
        if (label !== "text-critical-on-bg-fill") notes.push(`destructive label → ${label} (${contrastRatio(v(label), on).toFixed(2)}:1 on ${chosen})`);
        return [
          fill,
          {
            $value: `{polaris.color-${label}}`,
            ...(label !== "text-critical-on-bg-fill" ? { $description: `Polaris's text-critical-on-bg-fill doesn't reach 4.5:1 on the fill this theme uses; ${label} does` } : {}),
          },
        ];
      }
    }
    notes.push("no critical label reaches 4.5:1 → text-critical-on-bg-fill");
    return [fill, { $value: "{polaris.color-text-critical-on-bg-fill}" }];
  })();

  const tier = {
    $description: `Values Polaris does not define as variables, and contrast adjustments, for the ${scheme} theme.`,
    polyxd: {
      sys: {
        $type: "color",
        "status-info-foreground": onChip("info"),
        "status-info-emphasis": emphasis("info"),
        "status-success-foreground": onChip("success"),
        "status-success-emphasis": emphasis("success"),
        "status-warning-foreground": onChip("warning"),
        "status-warning-emphasis": emphasis("warning"),
        "status-danger-foreground": onChip("critical"),
        "status-danger-emphasis": emphasis("critical"),
        "data-1": emphasis("info"),
        "data-2": emphasis("success"),
        "data-3": emphasis("magic"),
        "data-4": emphasis("warning"),
        "data-5": emphasis("critical"),
        "data-6": emphasis("caution"),
        "data-positive": emphasis("success"),
        "data-negative": emphasis("critical"),
        // Polaris's own neutral accent: its icon colour, which both themes define.
        "data-neutral": { $value: "{polaris.color-icon}", $description: "Polaris's icon colour, the neutral that both themes define" },
        // Polaris's secondary text is the same as its body text in the light theme, which leaves
        // muted text with nothing quieter to use; its icon colour is the next step down and passes.
        "text-muted": (() => {
          const secondary = v("text-secondary");
          const icon = v("text");
          if (secondary.toLowerCase() !== icon.toLowerCase()) return { $value: "{polaris.color-text-secondary}" };
          notes.push("text-secondary equals text → icon colour for muted text");
          return { $value: "{polaris.color-icon}", $description: "Polaris's light theme gives text-secondary the same value as text; its icon colour is the quieter neutral that still clears 4.5:1" };
        })(),
        // Polaris's dark theme overrides its neutrals only, so the blues it links and focuses with
        // stay the light theme's #005bd3 — 2.16:1 on a dark surface. Its emphasis family's lightest
        // member is the only step that carries there, and it reads as a blue-tinted white.
        "text-link": dark ? passing("emphasis", "text-emphasis", surface, 4.5, "link text") : { $value: "{polaris.color-text-link}" },
        "border-focus": dark ? passing("emphasis", "border-emphasis", surface, 3, "a 3:1 focus ring") : { $value: "{polaris.color-border-focus}" },
        // Polaris's dark theme has no second dark surface: bg-surface-secondary stays light. Its
        // page background is the quieter surface underneath the cards, and it is genuinely darker.
        "surface-subtle": dark
          ? { $value: "{polaris.color-bg}", $description: "Polaris's dark theme leaves bg-surface-secondary at its light value; its page background is the darker surface the cards sit on" }
          : { $value: "{polaris.color-bg-surface-secondary}" },
        "action-danger-background": dangerFill,
        "action-danger-foreground": dangerText,
        state: {
          $type: "number",
          hover: { $value: 0.05, $description: "Polaris shades hover with separate surface colours; Polyxd needs a state-layer opacity" },
          pressed: { $value: 0.08 },
          focus: { $value: 0.12 },
          disabled: { $value: 0.4, $description: "Polaris's disabled controls use its disabled text and surface colours" },
        },
        target: { $type: "dimension", min: { $value: { value: 44, unit: "px" }, $description: "Polaris's default control height is 32px; 44px is the touch target a generated surface is held to" } },
        focusRing: { $type: "dimension", width: { $value: { value: 2, unit: "px" } }, offset: { $value: { value: 2, unit: "px" }, $description: "Polaris's focus ring is a 2px outline with a 2px offset" } },
        easing: {
          $type: "cubicBezier",
          standard: { $value: [0.25, 0.1, 0.25, 1], $description: "Polaris's --p-motion-ease" },
          enter: { $value: [0, 0, 0.58, 1] },
          exit: { $value: [0.42, 0, 1, 1] },
        },
      },
    },
  };
  if (notes.length) console.log(`  ${scheme}: ${notes.join("; ")}`);
  return tier;
}

/** The Polyxd contract, each token an alias to a Polaris variable or a Polyxd addition. */
function semanticTier(): Json {
  const s = (name: string) => alias(`polaris.${name}`);
  const sd = (name: string, description: string) => aliasWith(`polaris.${name}`, description);
  const p = (name: string) => alias(`polyxd.sys.${name}`);
  const typo = (size: string, line: string, weight: string) => ({
    $value: {
      fontFamily: "{polaris.font-family-sans}",
      fontSize: `{polaris.font-size-${size}}`,
      fontWeight: `{polaris.font-weight-${weight}}`,
      lineHeight: `{polaris.font-line-height-${line}}`,
      letterSpacing: { value: 0, unit: "px" },
    },
  });
  return {
    $description:
      "Polyxd semantic tier for Shopify Polaris. Every token aliases a Polaris variable wherever one exists; polyxd.* marks what Polaris leaves to its components. The file is the same in both themes.",
    color: {
      $type: "color",
      surface: {
        default: sd("color-bg-surface", "Polaris's card and page surface"),
        subtle: p("surface-subtle"),
        raised: s("color-bg-surface"),
        overlay: s("color-bg-surface"),
        inverse: s("color-bg-fill-inverse"),
      },
      scrim: sd("color-backdrop-bg", "Polaris's modal backdrop"),
      text: { default: s("color-text"), muted: p("text-muted"), inverse: s("color-text-inverse"), link: p("text-link") },
      border: { default: sd("color-border-tertiary", "Polaris's card and table divider"), strong: s("color-border"), focus: p("border-focus") },
      action: {
        primary: { background: s("color-bg-fill-brand"), foreground: s("color-text-brand-on-bg-fill") },
        secondary: { background: s("color-bg-fill"), foreground: s("color-text"), border: s("color-border") },
        danger: { background: p("action-danger-background"), foreground: p("action-danger-foreground") },
      },
      selection: { background: s("color-bg-surface-emphasis"), foreground: s("color-text-emphasis") },
      status: {
        info: { background: s("color-bg-surface-info"), foreground: p("status-info-foreground"), emphasis: p("status-info-emphasis") },
        success: { background: s("color-bg-surface-success"), foreground: p("status-success-foreground"), emphasis: p("status-success-emphasis") },
        warning: { background: s("color-bg-surface-warning"), foreground: p("status-warning-foreground"), emphasis: p("status-warning-emphasis") },
        danger: { background: s("color-bg-surface-critical"), foreground: p("status-danger-foreground"), emphasis: p("status-danger-emphasis") },
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
      title: { page: typo("600", "800", "bold"), section: typo("400", "600", "semibold"), item: typo("350", "500", "semibold") },
      body: { default: typo("400", "600", "regular"), small: typo("350", "500", "regular") },
      label: { default: typo("325", "500", "medium"), small: typo("300", "400", "medium") },
      numeric: { display: { ...typo("600", "800", "bold"), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
    },
    space: {
      $type: "dimension",
      inset: { compact: s("space-200"), default: s("space-400"), comfortable: s("space-500") },
      stack: { tight: s("space-100"), default: s("space-200"), loose: s("space-400"), section: s("space-800") },
      inline: { tight: s("space-100"), default: s("space-200"), loose: s("space-400") },
    },
    size: { $type: "dimension", target: { min: p("target.min") }, icon: { small: s("font-size-350"), default: s("font-size-500") } },
    radius: {
      $type: "dimension",
      small: s("border-radius-100"),
      control: sd("border-radius-200", "Polaris's button and input radius"),
      default: s("border-radius-300"),
      large: s("border-radius-400"),
      full: s("border-radius-full"),
    },
    border: { width: { $type: "dimension", default: s("border-width-025"), strong: s("border-width-050") } },
    focus: { ring: { $type: "dimension", width: p("focusRing.width"), offset: p("focusRing.offset") } },
    measure: { max: { $value: 65, $type: "number", $description: "Characters per line for running text (Polyxd; Polaris has no measure token)" } },
    opacity: { state: { $type: "number", hover: p("state.hover"), pressed: p("state.pressed"), focus: p("state.focus"), disabled: p("state.disabled") } },
    shadow: { $type: "shadow", raised: s("shadow-200"), overlay: s("shadow-400") },
    motion: {
      duration: { $type: "duration", instant: s("motion-duration-50"), short: s("motion-duration-150"), medium: s("motion-duration-200"), long: s("motion-duration-300") },
      easing: { $type: "cubicBezier", standard: p("easing.standard"), enter: p("easing.enter"), exit: p("easing.exit") },
    },
  };
}

async function main(): Promise<void> {
  const i = process.argv.indexOf("--refresh");
  if (i > -1) await copyFile(join(process.argv[i + 1], "@shopify/polaris-tokens/dist/css/styles.css"), join(SOURCES, "styles.css"));

  const css = await readFile(join(SOURCES, "styles.css"), "utf8");
  const filter = (vars: Vars) => Object.fromEntries(Object.entries(vars).filter(([name]) => !SKIP.test(name.replace("--polaris-", ""))));
  const light = filter(themeVars(css, "light"));
  const darkVars = filter(themeVars(css, "dark"));
  const describe = (scheme: string) => `Shopify Polaris ${PINNED["@shopify/polaris-tokens"]}, ${scheme} theme (.p-theme-${scheme}), variable names unchanged.`;
  await writePack({
    dir: ROOT,
    name: "polaris",
    displayName: "Shopify Polaris",
    contractVersion: "0.2.0",
    provenance: [
      {
        source: "npm:@shopify/polaris-tokens dist/css/styles.css (https://github.com/Shopify/polaris)",
        version: PINNED["@shopify/polaris-tokens"],
        license: "MIT",
        notes: "The stylesheet is vendored verbatim as scripts/sources/polaris/styles.css; the generator reads its custom properties.",
      },
    ],
    light: { ...systemTier(light, "polaris", TYPES, describe("light")), ...polyxdTier("light", light) },
    dark: { ...systemTier(darkVars, "polaris", TYPES, describe("dark")), ...polyxdTier("dark", darkVars) },
    semantic: semanticTier(),
  });
  console.log(`wrote Polaris tokens → ${join(ROOT, "tokens")}`);
}

await main();
