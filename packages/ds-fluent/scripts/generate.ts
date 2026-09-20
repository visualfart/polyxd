#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-fluent (Microsoft's Fluent 2, web theme).
 *
 *   node scripts/generate.ts                          regenerate tokens/*.json from the vendored sources
 *   node scripts/generate.ts --refresh <node_modules>  first re-extract scripts/sources/fluent/*.json from an
 *                                                      installed copy of the pinned package
 *
 * To refresh, install the pinned package somewhere OUTSIDE the monorepo:
 *   cd "$(mktemp -d)" && npm init -y && npm install --ignore-scripts @fluentui/tokens@1.0.0-alpha.24
 * and pass that directory's node_modules. The generator itself reads only the vendored JSON, has no
 * dependencies, and is deterministic.
 *
 * Fluent's own token names are kept (`fluent.<name>`), so every semantic token traces back to a
 * name you can look up in Fluent's docs or `webLightTheme` / `webDarkTheme`.
 */
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/fluent");
const OUT = join(ROOT, "tokens");
const PINNED = { "@fluentui/tokens": "1.0.0-alpha.24" } as const;

type Json = any;
const px = (v: string) => ({ value: Number(String(v).replace("px", "")), unit: "px" as const });
const ms = (v: string) => ({ value: Number(String(v).replace("ms", "")), unit: "ms" as const });

/** Fluent ships a cubic-bezier() string; DTCG wants the four numbers. */
const bezier = (v: string) => (String(v).match(/-?\d*\.?\d+/g) ?? []).map(Number);

/**
 * Fluent ships shadows as CSS strings of one or more layers ("0 0 2px rgba(...), 0 2px 4px rgba(...)");
 * DTCG wants each layer as offsets, blur, spread and colour.
 */
function shadowLayers(css: string): Json[] {
  return css
    .split(/,(?![^(]*\))/)
    .map((layer) => layer.trim())
    .filter(Boolean)
    .map((layer) => {
      const colour = layer.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i)?.[0] ?? "#000000";
      const lengths = layer.replace(colour, "").trim().split(/\s+/).filter(Boolean);
      const [offsetX = "0", offsetY = "0", blur = "0", spread = "0"] = lengths;
      return { offsetX: px(offsetX), offsetY: px(offsetY), blur: px(blur), spread: px(spread), color: colour };
    });
}

async function refresh(nodeModules: string): Promise<void> {
  const require = createRequire(join(nodeModules, "index.js"));
  const tokens = require("@fluentui/tokens");
  const sorted = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(join(SOURCES, "light.json"), JSON.stringify(sorted(tokens.webLightTheme), null, 2) + "\n");
  await writeFile(join(SOURCES, "dark.json"), JSON.stringify(sorted(tokens.webDarkTheme), null, 2) + "\n");
  console.log(`refreshed sources from ${nodeModules}`);
}

/** The whole Fluent theme, as DTCG tokens under `fluent.*`, typed by what the name says it is. */
function systemTier(theme: Record<string, string>, mode: "light" | "dark"): Json {
  const color: Json = { $type: "color" };
  const other: Json = {};
  for (const [name, value] of Object.entries(theme)) {
    if (name.startsWith("color")) color[name] = { $value: value };
    else if (name.startsWith("borderRadius") || name.startsWith("strokeWidth") || name.startsWith("spacing") || name.startsWith("fontSize") || name.startsWith("lineHeight"))
      other[name] = { $value: px(value), $type: "dimension" };
    else if (name.startsWith("duration")) other[name] = { $value: ms(value), $type: "duration" };
    else if (name.startsWith("curve")) other[name] = { $value: bezier(value), $type: "cubicBezier" };
    else if (name.startsWith("shadow")) other[name] = { $value: shadowLayers(value), $type: "shadow" };
    else other[name] = { $value: value };
  }
  return {
    $description: `Fluent 2 web ${mode} theme (@fluentui/tokens ${PINNED["@fluentui/tokens"]}), token names unchanged.`,
    fluent: { ...color, ...other },
  };
}

/**
 * Polyxd additions: values Fluent doesn't define, and the two places its natural choice doesn't
 * pass the contract's contrast floor. Each one says what it is and why.
 */
function polyxdTier(mode: "light" | "dark", theme: Record<string, string>): Json {
  const t = (name: string) => theme[name];
  return {
    $description: `Values Fluent does not define, and contrast adjustments, for the ${mode} theme.`,
    polyxd: {
      sys: {
        $type: "color",
        // Fluent has no "info" status family; its blue shared colour is the same hue as the brand ramp.
        "status-info-background": { $value: t("colorPaletteBlueBackground2"), $description: "Fluent shared colour blue, background 2" },
        "status-info-foreground": { $value: t("colorPaletteBlueForeground2"), $description: "Fluent shared colour blue, foreground 2" },
        "status-info-emphasis": { $value: t("colorPaletteBlueBorderActive"), $description: "Fluent shared colour blue, active border" },
        // Chart colours: six shared-colour hues at foreground 2, which Fluent tests against its own surfaces.
        "data-1": { $value: t("colorPaletteBlueForeground2") },
        "data-2": { $value: t("colorPaletteGreenForeground2") },
        "data-3": { $value: t("colorPalettePurpleForeground2") },
        "data-4": { $value: t("colorPalettePeachForeground2") },
        "data-5": { $value: t("colorPaletteTealForeground2") },
        "data-6": { $value: t("colorPaletteMagentaForeground2") },
        "data-positive": { $value: t("colorPaletteGreenForeground2") },
        "data-negative": { $value: t("colorPaletteRedForeground2") },
        "data-neutral": { $value: t("colorNeutralForeground3") },
        state: {
          $type: "number",
          hover: { $value: 0.06, $description: "Fluent draws hover with named colour tokens; Polyxd needs a state-layer opacity" },
          pressed: { $value: 0.12 },
          focus: { $value: 0.12 },
          disabled: { $value: 0.38 },
        },
        target: { $type: "dimension", min: { $value: px("44px"), $description: "Fluent's controls are 32px (medium) and 40px (large); its touch guidance is 44px, which is what a generated surface is held to" } },
        focus: { $type: "dimension", offset: { $value: px("2px"), $description: "Fluent's focus indicator is a 2px stroke outside the control" } },
      },
    },
  };
}

/** The Polyxd contract, each token an alias to a Fluent token (or a Polyxd addition). */
function semanticTier(): Json {
  const f = (name: string) => ({ $value: `{fluent.${name}}` });
  const fd = (name: string, description: string) => ({ $value: `{fluent.${name}}`, $description: description });
  const p = (name: string) => ({ $value: `{polyxd.sys.${name}}` });
  return {
    $description:
      "Polyxd semantic tier for Fluent 2 (light = webLightTheme, dark = webDarkTheme). Every token aliases a Fluent token wherever Fluent has one; polyxd.* marks values Fluent does not define. The file is the same in both modes.",
    color: {
      $type: "color",
      surface: {
        default: fd("colorNeutralBackground2", "Fluent's page canvas; cards sit on Background1 above it"),
        subtle: f("colorNeutralBackground3"),
        raised: fd("colorNeutralBackground1", "Fluent cards and surfaces"),
        overlay: fd("colorNeutralBackground1", "Fluent dialogs and flyouts"),
        inverse: f("colorNeutralBackgroundInverted"),
      },
      scrim: f("colorBackgroundOverlay"),
      text: {
        default: f("colorNeutralForeground1"),
        muted: f("colorNeutralForeground2"),
        inverse: f("colorNeutralForegroundInverted"),
        link: f("colorBrandForegroundLink"),
      },
      border: {
        default: fd("colorNeutralStroke2", "Fluent's divider stroke"),
        strong: fd("colorNeutralStrokeAccessible", "Fluent's own 3:1 stroke; colorNeutralStroke1 is 1.46:1 in light and 2.87:1 in dark, below the contract's floor for a graphic"),
        focus: f("colorStrokeFocus2"),
      },
      action: {
        primary: {
          background: fd("colorBrandBackgroundStatic", "Contrast adjustment (dark): Fluent's colorBrandBackground is 2.48:1 on the dark canvas; Static is the same brand ramp and passes at 3.06:1, with white text on it at 5.38:1"),
          foreground: f("colorNeutralForegroundOnBrand"),
        },
        secondary: {
          background: fd("colorNeutralBackground1", "Fluent's secondary button: Background1 with a stroke"),
          foreground: f("colorNeutralForeground1"),
          border: f("colorNeutralStroke1"),
        },
        danger: { background: f("colorPaletteRedBackground3"), foreground: f("colorNeutralForegroundOnBrand") },
      },
      selection: {
        background: fd("colorBrandBackground2", "Fluent's selected row tint"),
        foreground: f("colorBrandForeground2"),
      },
      status: {
        info: { background: p("status-info-background"), foreground: p("status-info-foreground"), emphasis: p("status-info-emphasis") },
        success: { background: f("colorStatusSuccessBackground1"), foreground: f("colorStatusSuccessForeground1"), emphasis: f("colorStatusSuccessBorderActive") },
        warning: {
          background: f("colorStatusWarningBackground1"),
          foreground: f("colorStatusWarningForeground2"),
          emphasis: fd("colorStatusWarningBorder2", "Contrast adjustment (light): colorStatusWarningBorderActive is 2.98:1 on the light canvas; Border2 is the next step of the same ramp"),
        },
        danger: { background: f("colorStatusDangerBackground1"), foreground: f("colorStatusDangerForeground1"), emphasis: f("colorStatusDangerBorderActive") },
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
      title: {
        page: typo("Hero800", "fontWeightSemibold", "lineHeightHero800"),
        section: typo("Base500", "fontWeightSemibold", "lineHeightBase500"),
        item: typo("Base400", "fontWeightSemibold", "lineHeightBase400"),
      },
      // Fluent's base body size is 14px; the contract asks for 16px running text, which is Fluent's Base400.
      body: { default: typo("Base400", "fontWeightRegular", "lineHeightBase400"), small: typo("Base300", "fontWeightRegular", "lineHeightBase300") },
      label: { default: typo("Base300", "fontWeightSemibold", "lineHeightBase300"), small: typo("Base200", "fontWeightSemibold", "lineHeightBase200") },
      numeric: { display: { ...typo("Hero700", "fontWeightSemibold", "lineHeightHero700"), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
    },
    space: {
      $type: "dimension",
      inset: { compact: f("spacingHorizontalS"), default: f("spacingHorizontalM"), comfortable: f("spacingHorizontalXL") },
      stack: { tight: f("spacingVerticalXS"), default: f("spacingVerticalS"), loose: f("spacingVerticalL"), section: f("spacingVerticalXXXL") },
      inline: { tight: f("spacingHorizontalXS"), default: f("spacingHorizontalS"), loose: f("spacingHorizontalL") },
    },
    size: { $type: "dimension", target: { min: p("target.min") }, icon: { small: f("fontSizeBase200"), default: f("fontSizeBase500") } },
    radius: { $type: "dimension", small: f("borderRadiusSmall"), default: f("borderRadiusMedium"), large: f("borderRadiusLarge"), full: { $value: { value: 9999, unit: "px" }, $description: "Fluent's borderRadiusCircular" } },
    border: { width: { $type: "dimension", default: f("strokeWidthThin"), strong: f("strokeWidthThick") } },
    focus: { ring: { $type: "dimension", width: f("strokeWidthThick"), offset: p("focus.offset") } },
    measure: { max: { $value: 65, $type: "number", $description: "Characters per line for running text (Polyxd; Fluent has no measure token)" } },
    opacity: { state: { $type: "number", hover: p("state.hover"), pressed: p("state.pressed"), focus: p("state.focus"), disabled: p("state.disabled") } },
    shadow: { $type: "shadow", raised: f("shadow4"), overlay: f("shadow16") },
    motion: {
      duration: { $type: "duration", instant: f("durationUltraFast"), short: f("durationFaster"), medium: f("durationNormal"), long: f("durationSlow") },
      easing: { $type: "cubicBezier", standard: f("curveEasyEase"), enter: f("curveDecelerateMid"), exit: f("curveAccelerateMid") },
    },
  };
}

/** One typography token from a Fluent size/weight/line-height triple. */
function typo(size: string, weight: string, lineHeight: string): Json {
  return {
    $value: {
      fontFamily: "{fluent.fontFamilyBase}",
      fontSize: `{fluent.fontSize${size}}`,
      fontWeight: `{fluent.${weight}}`,
      lineHeight: `{fluent.${lineHeight}}`,
      letterSpacing: { value: 0, unit: "px" },
    },
  };
}

const write = (file: string, data: Json) => writeFile(join(OUT, file), JSON.stringify(data, null, 2) + "\n");

async function main(): Promise<void> {
  const refreshFrom = process.argv.indexOf("--refresh");
  if (refreshFrom > -1) await refresh(process.argv[refreshFrom + 1]);

  const light = JSON.parse(await readFile(join(SOURCES, "light.json"), "utf8"));
  const dark = JSON.parse(await readFile(join(SOURCES, "dark.json"), "utf8"));
  await mkdir(OUT, { recursive: true });
  await write("system.light.json", { ...systemTier(light, "light"), ...polyxdTier("light", light) });
  await write("system.dark.json", { ...systemTier(dark, "dark"), ...polyxdTier("dark", dark) });
  await write("semantic.json", semanticTier());
  console.log(`wrote ${Object.keys(light).length} Fluent tokens per mode → ${OUT}`);
}

await main();
