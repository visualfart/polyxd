#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-govuk (GOV.UK Frontend).
 *
 *   node scripts/generate.ts                           regenerate tokens/*.json from the vendored settings
 *   node scripts/generate.ts --refresh <node_modules>  first re-copy the settings from an installed copy
 *
 * To refresh, install the pinned package somewhere OUTSIDE the monorepo:
 *   cd "$(mktemp -d)" && npm init -y && npm install --ignore-scripts govuk-frontend@6.5.1
 * and pass that directory's node_modules.
 *
 * GOV.UK Frontend publishes compiled component CSS but no design tokens: its palette, functional
 * colours, spacing points and type scale live in Sass settings files, as maps. Those files are
 * vendored and read here — narrowly, by the shape of each map, rather than by evaluating Sass.
 *
 * GOV.UK has one theme. There is no dark mode to read, and the pack does not invent one; it ships
 * a single mode, which the theme compiler renders whichever mode a surface asks for.
 */
import { copyFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { luminance, toRgb } from "@polyxd/spec";
import { alias, aliasWith, nearestPassing, writePack, type Json } from "@polyxd/ds-kit";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/govuk");
const PINNED = { "govuk-frontend": "6.5.1" } as const;

const FILES = [
  "_colours-palette--internal.scss",
  "_colours-functional.scss",
  "_spacing.scss",
  "_measurements.scss",
  "_typography-font.scss",
  "_typography-responsive.scss",
];

/** The body of a Sass map literal, by the variable it is assigned to. */
function mapBody(scss: string, name: string): string {
  const start = scss.indexOf(`$${name}:`);
  if (start === -1) throw new Error(`no $${name} in the vendored settings`);
  const open = scss.indexOf("(", start);
  let depth = 0;
  for (let i = open; i < scss.length; i++) {
    if (scss[i] === "(") depth++;
    else if (scss[i] === ")" && --depth === 0) return scss.slice(open + 1, i);
  }
  throw new Error(`unbalanced map for $${name}`);
}

/** `"blue": (…)` → the inner body, for each named group of a map. */
function groups(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /"([a-z0-9-]+)"\s*:\s*\(/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < body.length && depth > 0; i++) {
      if (body[i] === "(") depth++;
      else if (body[i] === ")") depth--;
    }
    out[m[1]] = body.slice(re.lastIndex, i - 1);
  }
  return out;
}

/** `"primary": #1d70b8` pairs inside one group. */
const pairs = (body: string): Record<string, string> =>
  Object.fromEntries([...body.matchAll(/"([a-z0-9-]+)"\s*:\s*(#[0-9a-f]{3,8})/gi)].map(([, key, value]) => [key, value.toLowerCase()]));

/** GOV.UK's palette: hue → variant → hex, plus the bare `"white": #ffffff`. */
function palette(scss: string): Record<string, Record<string, string>> {
  const body = mapBody(scss, "govuk-palette");
  const out: Record<string, Record<string, string>> = {};
  for (const [hue, group] of Object.entries(groups(body))) out[hue] = pairs(group);
  for (const [, hue, hex] of body.matchAll(/"([a-z0-9-]+)"\s*:\s*(#[0-9a-f]{3,8})\s*(?:,|\n|$)/gi)) out[hue] ??= { primary: hex.toLowerCase() };
  return out;
}

/**
 * GOV.UK's functional colours: each role names a palette colour and, sometimes, a variant of it.
 * A role can also be a literal hex (`"print-text": #000000`).
 */
function functional(scss: string, pal: Record<string, Record<string, string>>): Record<string, string> {
  const body = mapBody(scss, "govuk-default-functional-colours");
  const out: Record<string, string> = {};
  const re = /"([a-z0-9-]+)"\s*:\s*(?:(#[0-9a-f]{3,8})|\(([^)]*)\))/gi;
  for (const [, role, hex, inner] of body.matchAll(re)) {
    if (hex) out[role] = hex.toLowerCase();
    else {
      const name = /name:\s*"([a-z0-9-]+)"/i.exec(inner ?? "")?.[1];
      const variant = /variant:\s*"([a-z0-9-]+)"/i.exec(inner ?? "")?.[1] ?? "primary";
      const value = name && pal[name]?.[variant];
      if (value) out[role] = value;
    }
  }
  return out;
}

/** `1: 5px` pairs from the spacing points map. */
const spacing = (scss: string): Record<string, string> =>
  Object.fromEntries([...mapBody(scss, "govuk-spacing-points").matchAll(/(\d+)\s*:\s*(\d+px|0)\b/g)].map(([, step, value]) => [step, value === "0" ? "0px" : value]));

/**
 * The type scale at GOV.UK's tablet breakpoint, which is the size it intends for a page that has
 * room — the sizes below it are the small-screen step-down of the same scale.
 */
function typeScale(scss: string): Record<string, { size: string; line: string }> {
  const body = mapBody(scss, "govuk-typography-scale");
  const out: Record<string, { size: string; line: string }> = {};
  const re = /(\d+)\s*:\s*\(/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < body.length && depth > 0; i++) {
      if (body[i] === "(") depth++;
      else if (body[i] === ")") depth--;
    }
    const group = body.slice(re.lastIndex, i - 1);
    const tablet = group.slice(group.indexOf("tablet:") === -1 ? 0 : group.indexOf("tablet:"));
    const size = /font-size:\s*(\d+)px/.exec(tablet)?.[1];
    const line = /line-height:\s*(\d+)px/.exec(tablet)?.[1];
    if (size && line) out[m[1]] = { size: `${size}px`, line: `${line}px` };
  }
  return out;
}

/** A `$govuk-…: <n>px` measurement. */
const measure = (scss: string, name: string) => /:\s*(\d+)px/.exec(scss.slice(scss.indexOf(`$${name}:`)))?.[1];

const px = (value: string) => ({ value: Number.parseFloat(value), unit: "px" as const });

async function main(): Promise<void> {
  const i = process.argv.indexOf("--refresh");
  if (i > -1) for (const file of FILES) await copyFile(join(process.argv[i + 1], "govuk-frontend/dist/govuk/settings", file), join(SOURCES, file));

  const read = (file: string) => readFile(join(SOURCES, file), "utf8");
  const [paletteScss, functionalScss, spacingScss, measurementsScss, fontScss, scaleScss] = await Promise.all(FILES.map(read));

  const pal = palette(paletteScss);
  const fn = functional(functionalScss, pal);
  const space = spacing(spacingScss);
  const scale = typeScale(scaleScss);
  const notes: string[] = [];

  /** One hue's variants as a ramp, lightest first, so a role can move along GOV.UK's own steps. */
  const ramp = (hue: string) =>
    Object.entries(pal[hue] ?? {})
      .map(([variant, value]) => ({ name: `${hue}-${variant}`, value }))
      .sort((a, b) => luminance(toRgb(b.value)) - luminance(toRgb(a.value)));

  const background = fn["body-background"];

  /** The nearest variant of `hue` that clears `min` on `on`, starting from `from`. */
  const passing = (hue: string, from: string, on: string, min: number, why: string) => {
    const steps = ramp(hue);
    const at = Math.max(
      0,
      steps.findIndex((step) => step.name === `${hue}-${from}`),
    );
    const found = nearestPassing(
      steps.map((step) => step.value),
      on,
      min,
      at,
      "darker",
    );
    if (!found.passes) {
      notes.push(`${hue}: no variant reaches ${min}:1 (best ${found.ratio.toFixed(2)}:1) → text`);
      return { $value: "{govuk.text}", $description: `No variant of GOV.UK's ${hue} reaches ${min}:1 here (best ${found.ratio.toFixed(2)}:1), so this uses the text colour` };
    }
    if (steps[found.index].name !== `${hue}-${from}`) notes.push(`${hue}-${from} → ${steps[found.index].name} (${found.ratio.toFixed(2)}:1, ${why})`);
    return {
      $value: `{govuk.palette-${steps[found.index].name}}`,
      ...(steps[found.index].name !== `${hue}-${from}`
        ? { $description: `Contrast adjustment: GOV.UK's ${hue} ${from} doesn't reach ${min}:1 here; ${steps[found.index].name} is the nearest variant of the same colour that does (${found.ratio.toFixed(2)}:1)` }
        : {}),
    };
  };

  /** A tinted status panel: GOV.UK's tint-95, with the first variant readable on it. */
  const chip = (hue: string) => ({ $value: `{govuk.palette-${hue}-tint-95}` });
  const onChip = (hue: string) => passing(hue, "shade-25", pal[hue]["tint-95"], 4.5, "panel text");
  const accent = (hue: string) => passing(hue, "primary", background, 3, "a 3:1 accent");
  const filled = (hue: string) => passing(hue, "primary", fn["inverse-text"], 4.5, "white button text");

  const system: Json = {
    $description: `GOV.UK Frontend ${PINNED["govuk-frontend"]}: its palette, functional colours, spacing points and type scale, read from the Sass settings and kept under their own names.`,
    govuk: {
      // The palette, every hue and variant, under palette-<hue>-<variant>.
      ...Object.fromEntries(
        Object.entries(pal).flatMap(([hue, variants]) => Object.entries(variants).map(([variant, value]) => [`palette-${hue}-${variant}`, { $value: value, $type: "color" }])),
      ),
      // The functional colours, under the role names GOV.UK gives them.
      ...Object.fromEntries(Object.entries(fn).map(([role, value]) => [role, { $value: value, $type: "color" }])),
      ...Object.fromEntries(Object.entries(space).map(([step, value]) => [`spacing-${step}`, { $value: px(value), $type: "dimension" }])),
      ...Object.fromEntries(
        Object.entries(scale).flatMap(([step, { size, line }]) => [
          [`font-size-${step}`, { $value: px(size), $type: "dimension" }],
          [`line-height-${step}`, { $value: px(line), $type: "dimension" }],
        ]),
      ),
      "font-family": { $value: /\$govuk-font-family:\s*([^;!]+)/.exec(fontScss)![1].trim(), $type: "fontFamily" },
      "font-weight-regular": { $value: 400, $type: "number" },
      "font-weight-bold": { $value: 700, $type: "number" },
      "focus-width": { $value: px(`${measure(measurementsScss, "govuk-focus-width")}px`), $type: "dimension" },
      "border-width": { $value: px(`${measure(measurementsScss, "govuk-border-width")}px`), $type: "dimension" },
      "border-width-form-element": { $value: px(`${measure(measurementsScss, "govuk-border-width-form-element")}px`), $type: "dimension" },
    },
  };

  const polyxd: Json = {
    $description: "Values GOV.UK Frontend does not define, and contrast adjustments.",
    polyxd: {
      sys: {
        $type: "color",
        "status-info-background": chip("blue"),
        "status-info-foreground": onChip("blue"),
        "status-info-emphasis": accent("blue"),
        "status-success-background": chip("green"),
        "status-success-foreground": onChip("green"),
        "status-success-emphasis": accent("green"),
        // GOV.UK's own warning component is black text beside a black icon rather than a colour,
        // so the pack uses its orange, which exists in the palette for exactly this weight of message.
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
        "data-6": accent("teal"),
        "data-positive": accent("green"),
        "data-negative": accent("red"),
        "data-neutral": accent("brown"),
        "action-primary": filled("green"),
        "action-danger": filled("red"),
        "border-strong": passing("black", "tint-50", background, 3, "a 3:1 stroke"),
        surface: {
          $type: "color",
          raised: { $value: fn["body-background"], $description: "GOV.UK draws cards as bordered panels on the page background rather than on a raised fill" },
        },
        scrim: { $type: "color", $value: "rgba(11, 12, 12, 0.6)", $description: "GOV.UK has no modal, so no scrim; this is its black at 60%" },
        radius: {
          $type: "dimension",
          none: { $value: { value: 0, unit: "px" }, $description: "GOV.UK's corners are square, everywhere — the one shape decision the whole system is built on" },
        },
        target: { $type: "dimension", min: { $value: { value: 44, unit: "px" }, $description: "GOV.UK's form controls are 40px; 44px is the touch target a generated surface is held to" } },
        measure: { $type: "number", max: { $value: 65, $description: "GOV.UK writes to about 65 characters a line; the setting is in its grid, not in a token" } },
        state: {
          $type: "number",
          hover: { $value: 0.06, $description: "GOV.UK shades hover with separate palette colours; Polyxd needs a state-layer opacity" },
          pressed: { $value: 0.12 },
          focus: { $value: 0.12 },
          disabled: { $value: 0.5, $description: "GOV.UK's disabled controls are its standard controls at half opacity" },
        },
        shadow: {
          $type: "shadow",
          none: {
            $value: [{ offsetX: { value: 0, unit: "px" }, offsetY: { value: 0, unit: "px" }, blur: { value: 0, unit: "px" }, spread: { value: 0, unit: "px" }, color: "rgba(0, 0, 0, 0)" }],
            $description: "GOV.UK draws no shadows at all: depth is a border, not a blur",
          },
        },
        motion: {
          $type: "duration",
          instant: { $value: { value: 0, unit: "ms" } },
          short: { $value: { value: 0, unit: "ms" } },
          medium: { $value: { value: 0, unit: "ms" } },
          long: { $value: { value: 0, unit: "ms" }, $description: "GOV.UK animates nothing; these durations are zero rather than invented" },
        },
        easing: { $type: "cubicBezier", standard: { $value: [0, 0, 1, 1] }, enter: { $value: [0, 0, 1, 1] }, exit: { $value: [0, 0, 1, 1] } },
      },
    },
  };

  const g = (name: string) => alias(`govuk.${name}`);
  const gd = (name: string, description: string) => aliasWith(`govuk.${name}`, description);
  const p = (name: string) => alias(`polyxd.sys.${name}`);
  const typo = (step: string, weight: "regular" | "bold") => ({
    $value: {
      fontFamily: "{govuk.font-family}",
      fontSize: `{govuk.font-size-${step}}`,
      fontWeight: `{govuk.font-weight-${weight}}`,
      lineHeight: `{govuk.line-height-${step}}`,
      letterSpacing: { value: 0, unit: "px" },
    },
  });

  const semantic: Json = {
    $description:
      "Polyxd semantic tier for GOV.UK Frontend. Every token aliases a GOV.UK functional colour, spacing point or type step wherever one exists; polyxd.* marks what GOV.UK leaves to its components or does not have.",
    color: {
      $type: "color",
      surface: {
        default: g("body-background"),
        subtle: gd("surface-background", "GOV.UK's generic surface: a blue tint-95 panel"),
        raised: p("surface.raised"),
        overlay: g("body-background"),
        inverse: g("text"),
      },
      scrim: p("scrim"),
      text: { default: g("text"), muted: g("secondary-text"), inverse: g("inverse-text"), link: g("link") },
      // GOV.UK's focus state is a yellow block with a 4px black bar under it, and the bar is the
      // part that carries the 3:1 against the page — the yellow alone is 1.35:1. A single-colour
      // ring can't be both, so the ring takes the black and the yellow stays in the palette.
      border: { default: g("border"), strong: p("border-strong"), focus: gd("focus-text", "GOV.UK's focus bar, the black half of its yellow-and-black focus state") },
      action: {
        primary: { background: p("action-primary"), foreground: g("inverse-text") },
        secondary: { background: gd("border", "GOV.UK's secondary button is its mid grey"), foreground: g("text"), border: g("input-border") },
        danger: { background: p("action-danger"), foreground: g("inverse-text") },
      },
      selection: { background: g("surface-background"), foreground: g("text") },
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
      title: { page: typo("36", "bold"), section: typo("24", "bold"), item: typo("19", "bold") },
      body: { default: typo("19", "regular"), small: typo("16", "regular") },
      // GOV.UK's scale stops at 16px: it has no small print, which is the point of the system.
      label: { default: typo("19", "bold"), small: typo("16", "bold") },
      numeric: { display: { ...typo("36", "bold"), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
    },
    space: {
      $type: "dimension",
      inset: { compact: g("spacing-2"), default: g("spacing-4"), comfortable: g("spacing-6") },
      stack: { tight: g("spacing-1"), default: g("spacing-2"), loose: g("spacing-4"), section: g("spacing-7") },
      inline: { tight: g("spacing-1"), default: g("spacing-2"), loose: g("spacing-4") },
    },
    size: { $type: "dimension", target: { min: p("target.min") }, icon: { small: g("font-size-16"), default: g("font-size-19") } },
    radius: { $type: "dimension", small: p("radius.none"), control: p("radius.none"), default: p("radius.none"), large: p("radius.none"), full: p("radius.none") },
    border: { width: { $type: "dimension", default: { $value: { value: 1, unit: "px" } }, strong: g("border-width-form-element") } },
    focus: { ring: { $type: "dimension", width: g("focus-width"), offset: { $value: { value: 0, unit: "px" }, $description: "GOV.UK's focus style is a solid yellow block behind the element, with no gap" } } },
    measure: { max: p("measure.max") },
    opacity: { state: { $type: "number", hover: p("state.hover"), pressed: p("state.pressed"), focus: p("state.focus"), disabled: p("state.disabled") } },
    shadow: { $type: "shadow", raised: p("shadow.none"), overlay: p("shadow.none") },
    motion: {
      duration: { $type: "duration", instant: p("motion.instant"), short: p("motion.short"), medium: p("motion.medium"), long: p("motion.long") },
      easing: { $type: "cubicBezier", standard: p("easing.standard"), enter: p("easing.enter"), exit: p("easing.exit") },
    },
  };

  await writePack({
    dir: ROOT,
    name: "govuk",
    displayName: "GOV.UK Frontend",
    contractVersion: "0.2.0",
    modes: ["light"],
    provenance: [
      {
        source: "npm:govuk-frontend dist/govuk/settings (https://github.com/alphagov/govuk-frontend)",
        version: PINNED["govuk-frontend"],
        license: "MIT",
        notes: "GOV.UK publishes no token file; its Sass settings are vendored verbatim under scripts/sources/govuk and the generator reads their maps.",
      },
    ],
    light: { ...system, ...polyxd },
    dark: { ...system, ...polyxd },
    semantic,
  });
  if (notes.length) console.log(`  ${notes.join("; ")}`);
  console.log(`wrote GOV.UK tokens → ${join(ROOT, "tokens")}`);
}

await main();
