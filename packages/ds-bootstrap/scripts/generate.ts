#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-bootstrap (Bootstrap 5, light and dark).
 *
 *   node scripts/generate.ts                          regenerate tokens/*.json from the vendored sources
 *   node scripts/generate.ts --refresh <node_modules>  first re-extract the sources from an installed copy
 *
 * To refresh, install the pinned package somewhere OUTSIDE the monorepo:
 *   cd "$(mktemp -d)" && npm init -y && npm install --ignore-scripts bootstrap@5.3.8
 * and pass that directory's node_modules.
 *
 * Bootstrap's own variable names are kept (`bs.body-bg`, `bs.border-radius`), so every semantic
 * token traces back to something you can look up in Bootstrap's documentation. Its dark theme
 * overrides a subset of `:root`, so the vendored dark file is the merge, as a browser resolves it.
 */
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/bootstrap");
const OUT = join(ROOT, "tokens");
const PINNED = { bootstrap: "5.3.8" } as const;

type Json = any;
type Vars = Record<string, string>;

/** Bootstrap writes lengths in rem (1rem = 16px) and the odd px. */
function length(v: string): { value: number; unit: "px" } {
  const s = String(v).trim();
  if (s.endsWith("rem")) return { value: Number(s.slice(0, -3)) * 16, unit: "px" };
  if (s.endsWith("px")) return { value: Number(s.slice(0, -2)), unit: "px" };
  return { value: Number(s) || 0, unit: "px" };
}

/** A CSS shadow string ("0 0.5rem 1rem rgba(0,0,0,0.15)") as DTCG shadow layers. */
function shadowLayers(css: string): Json[] {
  return css
    .split(/,(?![^(]*\))/)
    .map((layer) => layer.trim())
    .filter(Boolean)
    .map((layer) => {
      const colour = layer.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i)?.[0] ?? "rgba(0, 0, 0, 0.15)";
      const lengths = layer.replace(colour, "").replace("inset", "").trim().split(/\s+/).filter(Boolean);
      const [offsetX = "0", offsetY = "0", blur = "0", spread = "0"] = lengths;
      return { offsetX: length(offsetX), offsetY: length(offsetY), blur: length(blur), spread: length(spread), color: colour, ...(layer.includes("inset") ? { inset: true } : {}) };
    });
}

async function refresh(nodeModules: string): Promise<void> {
  const css = readFileSync(join(nodeModules, "bootstrap/dist/css/bootstrap.css"), "utf8");
  const block = (re: RegExp) => {
    const m = re.exec(css);
    return m ? Object.fromEntries([...m[1].matchAll(/(--bs-[a-z0-9-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()])) : {};
  };
  const light = block(/:root,\s*\[data-bs-theme=light\]\s*\{([\s\S]*?)\n\}/);
  const dark = block(/\[data-bs-theme=dark\]\s*\{([\s\S]*?)\n\}/);
  const sorted = (o: Vars) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(join(SOURCES, "light.json"), JSON.stringify(sorted(light), null, 2) + "\n");
  // Bootstrap's dark theme overrides a subset of :root; store the merge, as a browser resolves it.
  await writeFile(join(SOURCES, "dark.json"), JSON.stringify(sorted({ ...light, ...dark }), null, 2) + "\n");
  console.log(`refreshed sources from ${nodeModules}`);
}

/** Bootstrap's variables for one mode, typed by what the name says they are. */
function systemTier(vars: Vars, mode: "light" | "dark"): Json {
  const color: Json = { $type: "color" };
  const other: Json = {};
  for (const [name, raw] of Object.entries(vars)) {
    const key = name.slice(5); // drop "--bs-"
    const value = raw.replace(/var\(--bs-([a-z0-9-]+)\)/g, (_, ref) => vars[`--bs-${ref}`] ?? raw);
    if (key.endsWith("-rgb") || key === "gradient" || key.endsWith("-style")) continue;
    if (/^(border-radius|border-width|focus-ring-width|body-font-size)/.test(key)) other[key] = { $value: length(value), $type: "dimension" };
    else if (key.startsWith("box-shadow")) other[key] = { $value: shadowLayers(value), $type: "shadow" };
    else if (/^(font-sans-serif|font-monospace|body-font-family)$/.test(key)) other[key] = { $value: value, $type: "fontFamily" };
    else if (/^(body-font-weight|body-line-height|focus-ring-opacity|link-opacity)/.test(key)) other[key] = { $value: Number(value) || 0, $type: "number" };
    else if (/^#|^rgb/.test(value)) color[key] = { $value: value };
  }
  return { $description: `Bootstrap ${PINNED.bootstrap} ${mode} theme (${mode === "dark" ? "[data-bs-theme=dark] merged over :root" : ":root"}), variable names unchanged.`, bs: { ...color, ...other } };
}

/** Values Bootstrap doesn't define, and its one contrast gap. */
function polyxdTier(mode: "light" | "dark"): Json {
  const g = (step: number) => ({ $value: `{bs.gray-${step}}` });
  return {
    $description: `Values Bootstrap does not define, for the ${mode} theme.`,
    polyxd: {
      sys: {
        $type: "color",
        // Bootstrap's *-text-emphasis variables are its own darkened (light mode) and lightened
        // (dark mode) theme colours, so they carry a 3:1 accent in both. Its raw hues don't: cyan
        // is 1.96:1 on white, orange 2.57:1, teal 2.13:1.
        "data-1": { $value: "{bs.primary-text-emphasis}" },
        "data-2": { $value: "{bs.success-text-emphasis}" },
        "data-3": { $value: "{bs.danger-text-emphasis}" },
        "data-4": { $value: "{bs.warning-text-emphasis}" },
        "data-5": { $value: "{bs.info-text-emphasis}" },
        "data-6": { $value: "{bs.secondary-text-emphasis}" },
        "data-positive": { $value: "{bs.success-text-emphasis}" },
        "data-negative": { $value: "{bs.danger-text-emphasis}" },
        "data-neutral": g(mode === "light" ? 600 : 500),
        state: {
          $type: "number",
          hover: { $value: 0.08, $description: "Bootstrap shades hover with separate colour variables; Polyxd needs a state-layer opacity" },
          pressed: { $value: 0.12 },
          focus: { $value: "{bs.focus-ring-opacity}" },
          disabled: { $value: 0.6, $description: "Bootstrap's .disabled is 0.65; the contract caps it at 0.6 so disabled content stays perceivable" },
        },
        target: { $type: "dimension", min: { $value: { value: 44, unit: "px" }, $description: "Bootstrap's default button is 38px; 44px is the touch target a generated surface is held to" } },
        icon: { $type: "dimension", small: { $value: { value: 16, unit: "px" } }, default: { $value: { value: 20, unit: "px" } } },
        space: {
          $type: "dimension",
          // Bootstrap's spacers: $spacer is 1rem, and the scale is .25/.5/1/1.5/3 of it.
          1: { $value: { value: 4, unit: "px" } },
          2: { $value: { value: 8, unit: "px" } },
          3: { $value: { value: 16, unit: "px" } },
          4: { $value: { value: 24, unit: "px" } },
          5: { $value: { value: 48, unit: "px" } },
        },
        type: {
          $type: "dimension",
          // Bootstrap's heading sizes: h1 2.5rem … h6 1rem, and .small is .875em.
          h1: { $value: { value: 40, unit: "px" } },
          h4: { $value: { value: 24, unit: "px" } },
          h5: { $value: { value: 20, unit: "px" } },
          small: { $value: { value: 14, unit: "px" } },
        },
        motion: {
          $type: "duration",
          // Bootstrap's transitions are .15s (fade), .2s (collapse), .3s (modal), .6s (carousel).
          instant: { $value: { value: 100, unit: "ms" } },
          short: { $value: { value: 150, unit: "ms" } },
          medium: { $value: { value: 200, unit: "ms" } },
          long: { $value: { value: 300, unit: "ms" } },
        },
        easing: {
          $type: "cubicBezier",
          standard: { $value: [0.25, 0.1, 0.25, 1], $description: "Bootstrap's default transition-timing-function is ease" },
          enter: { $value: [0, 0, 0.2, 1] },
          exit: { $value: [0.4, 0, 1, 1] },
        },
      },
    },
  };
}

/** The Polyxd contract, each token an alias to a Bootstrap variable or a Polyxd addition. */
function semanticTier(): Json {
  const b = (name: string) => ({ $value: `{bs.${name}}` });
  const bd = (name: string, description: string) => ({ $value: `{bs.${name}}`, $description: description });
  const p = (name: string) => ({ $value: `{polyxd.sys.${name}}` });
  const typo = (size: string, weight: number) => ({
    $value: { fontFamily: "{bs.font-sans-serif}", fontSize: size.startsWith("{") ? size : `{polyxd.sys.type.${size}}`, fontWeight: weight, lineHeight: { value: 1.5, unit: "px" }, letterSpacing: { value: 0, unit: "px" } },
  });
  return {
    $description:
      "Polyxd semantic tier for Bootstrap 5. Every token aliases a Bootstrap variable wherever one exists; polyxd.* marks what Bootstrap leaves to its Sass scale or doesn't define. The file is the same in both modes.",
    color: {
      $type: "color",
      surface: {
        default: b("body-bg"),
        subtle: bd("secondary-bg", "Bootstrap's secondary background, used for wells and table stripes"),
        raised: bd("body-bg", "Bootstrap cards sit on the body background with a border, not a tone"),
        overlay: b("body-bg"),
        inverse: b("emphasis-color"),
      },
      scrim: { $value: "rgba(0, 0, 0, 0.5)", $description: "Bootstrap's .modal-backdrop is #000 at 50%" },
      text: { default: b("body-color"), muted: b("secondary-color"), inverse: b("body-bg"), link: b("link-color") },
      border: {
        default: b("border-color"),
        strong: bd("secondary-color", "Bootstrap's border-color is 1.3:1 on white; its secondary text colour is the nearest of its own that carries a 3:1 stroke"),
        focus: bd("primary", "Bootstrap's focus ring is the primary colour at 25% in a 0.25rem ring"),
      },
      action: {
        primary: { background: b("primary"), foreground: bd("white", "Bootstrap's .btn-primary text") },
        secondary: { background: b("body-bg"), foreground: b("body-color"), border: b("border-color") },
        danger: { background: b("danger"), foreground: b("white") },
      },
      selection: { background: bd("primary-bg-subtle", "Bootstrap's subtle primary background marks selection"), foreground: b("primary-text-emphasis") },
      status: {
        info: { background: b("info-bg-subtle"), foreground: b("info-text-emphasis"), emphasis: bd("info-text-emphasis", "Bootstrap's cyan #0dcaf0 is 1.35:1 on white; its own text-emphasis step is mode-aware and passes in both") },
        success: { background: b("success-bg-subtle"), foreground: b("success-text-emphasis"), emphasis: bd("success-text-emphasis", "Bootstrap's raw hue is too light to carry a 3:1 accent in light mode (cyan 1.35:1, yellow 1.23:1); its own text-emphasis step is mode-aware") },
        warning: { background: b("warning-bg-subtle"), foreground: b("warning-text-emphasis"), emphasis: bd("warning-text-emphasis", "Bootstrap's raw hue is too light to carry a 3:1 accent in light mode (cyan 1.35:1, yellow 1.23:1); its own text-emphasis step is mode-aware") },
        danger: { background: b("danger-bg-subtle"), foreground: b("danger-text-emphasis"), emphasis: bd("danger-text-emphasis", "Bootstrap's raw hue is too light to carry a 3:1 accent in light mode (cyan 1.35:1, yellow 1.23:1); its own text-emphasis step is mode-aware") },
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
      title: { page: typo("h1", 500), section: typo("h4", 500), item: typo("h5", 500) },
      body: { default: typo("{bs.body-font-size}", 400), small: typo("small", 400) },
      label: { default: typo("{bs.body-font-size}", 500), small: typo("small", 500) },
      numeric: { display: { ...typo("h1", 600), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
    },
    space: {
      $type: "dimension",
      inset: { compact: p("space.2"), default: p("space.3"), comfortable: p("space.4") },
      stack: { tight: p("space.1"), default: p("space.2"), loose: p("space.3"), section: p("space.5") },
      inline: { tight: p("space.1"), default: p("space.2"), loose: p("space.3") },
    },
    size: { $type: "dimension", target: { min: p("target.min") }, icon: { small: p("icon.small"), default: p("icon.default") } },
    radius: {
      $type: "dimension",
      small: b("border-radius-sm"),
      control: bd("border-radius", "Bootstrap buttons and inputs use the default radius"),
      default: b("border-radius"),
      large: b("border-radius-lg"),
      full: b("border-radius-pill"),
    },
    border: { width: { $type: "dimension", default: b("border-width"), strong: { $value: { value: 2, unit: "px" } } } },
    focus: { ring: { $type: "dimension", width: b("focus-ring-width"), offset: { $value: { value: 0, unit: "px" }, $description: "Bootstrap's focus ring sits on the control, not outside it" } } },
    measure: { max: { $value: 65, $type: "number", $description: "Characters per line for running text (Polyxd; Bootstrap has no measure token)" } },
    opacity: { state: { $type: "number", hover: p("state.hover"), pressed: p("state.pressed"), focus: p("state.focus"), disabled: p("state.disabled") } },
    shadow: { $type: "shadow", raised: b("box-shadow-sm"), overlay: b("box-shadow") },
    motion: {
      duration: { $type: "duration", instant: p("motion.instant"), short: p("motion.short"), medium: p("motion.medium"), long: p("motion.long") },
      easing: { $type: "cubicBezier", standard: p("easing.standard"), enter: p("easing.enter"), exit: p("easing.exit") },
    },
  };
}

const write = (file: string, data: Json) => writeFile(join(OUT, file), JSON.stringify(data, null, 2) + "\n");

async function main(): Promise<void> {
  const i = process.argv.indexOf("--refresh");
  if (i > -1) await refresh(process.argv[i + 1]);
  const [light, dark] = await Promise.all([
    readFile(join(SOURCES, "light.json"), "utf8").then(JSON.parse),
    readFile(join(SOURCES, "dark.json"), "utf8").then(JSON.parse),
  ]);
  await mkdir(OUT, { recursive: true });
  await write("system.light.json", { ...systemTier(light, "light"), ...polyxdTier("light") });
  await write("system.dark.json", { ...systemTier(dark, "dark"), ...polyxdTier("dark") });
  await write("semantic.json", semanticTier());
  console.log(`wrote Bootstrap tokens → ${OUT}`);
}

await main();
