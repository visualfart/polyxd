#!/usr/bin/env node
/**
 * Generates the DTCG 2025.10 token files of @polyxd/ds-shadcn: the default shadcn/ui theme on
 * Tailwind CSS v4's scales. This is the look most new web apps (and most AI-generated ones) start
 * from, so a Polyxd surface dropped into one of those projects should already belong there.
 *
 *   node scripts/generate.ts                         regenerate tokens/*.json from the vendored sources
 *   node scripts/generate.ts --refresh               re-fetch the vendored sources over the network
 *
 * Two sources, both MIT:
 *   - shadcn/ui's default theme variables (--background, --primary, --border, --radius, …)
 *   - Tailwind CSS v4's theme (the colour palette, type scale, spacing base, radii, shadows, easings)
 *
 * shadcn's default theme is deliberately monochrome and defines no success, warning or info colour,
 * and its chart ramp is five blues. Those come from Tailwind's palette instead, marked `polyxd.*`:
 * a status colour has to mean something at a glance, and six categories have to be told apart.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(ROOT, "scripts/sources/shadcn");
const OUT = join(ROOT, "tokens");
const PINNED = { tailwindcss: "4.3.3", "shadcn/ui": "apps/v4/app/globals.css @ main, fetched 2026-09-20" } as const;

type Json = any;
type Vars = Record<string, string>;

const rem = (v: string) => ({ value: Number(String(v).replace("rem", "")) * 16, unit: "px" as const });
const px = (v: number) => ({ value: v, unit: "px" as const });
const ms = (v: number) => ({ value: v, unit: "ms" as const });

async function refresh(): Promise<void> {
  const grab = async (url: string) => (await fetch(url)).text();
  const [sc, tw] = await Promise.all([
    grab("https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css"),
    grab(`https://unpkg.com/tailwindcss@${PINNED.tailwindcss}/theme.css`),
  ]);
  const vars = (css: string, selector: string) => {
    const body = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{(.*?)\\n\\}`, "s").exec(css)?.[1] ?? "";
    return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  };
  const write = (name: string, data: Vars) => writeFile(join(SOURCES, name), JSON.stringify(sortKeys(data), null, 2) + "\n");
  await write("light.json", vars(sc, ":root"));
  await write("dark.json", vars(sc, ".dark"));
  await write("tailwind.json", Object.fromEntries([...tw.matchAll(/(--[a-z0-9-]+(?:--[a-z-]+)?):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])));
  console.log("refreshed sources");
}

const sortKeys = (o: Vars) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

/** Tailwind's palette, as DTCG colours under `tailwind.color.<hue>.<step>`. */
function palette(tw: Vars): Json {
  const colors: Json = { $type: "color" };
  for (const [name, value] of Object.entries(tw)) {
    const m = /^--color-([a-z]+)-(\d+)$/.exec(name);
    if (m) ((colors[m[1]] ??= {})[m[2]] = { $value: value });
    else if (/^--color-(white|black)$/.test(name)) colors[name.replace("--color-", "")] = { $value: value };
  }
  return colors;
}

/** shadcn's theme variables for one mode, plus the Tailwind scales the pack uses. */
function systemTier(shadcn: Vars, tw: Vars, mode: "light" | "dark"): Json {
  const color: Json = { $type: "color" };
  for (const [name, value] of Object.entries(shadcn)) {
    if (name === "--radius") continue;
    // The docs theme points its chart ramp at Tailwind blues; resolve those to values.
    const resolved = /^var\((--color-[a-z]+-\d+)\)$/.exec(value)?.[1];
    color[name.slice(2)] = { $value: resolved ? tw[resolved] : value };
  }
  return {
    $description: `shadcn/ui default theme, ${mode} (${PINNED["shadcn/ui"]}), variable names unchanged.`,
    shadcn: color,
    tailwind: { color: palette(tw) },
  };
}

/** Values shadcn's default theme doesn't define: status colours, chart hues, and the non-colour scales. */
function polyxdTier(mode: "light" | "dark", tw: Vars): Json {
  const c = (hue: string, step: number) => ({ $value: `{tailwind.color.${hue}.${step}}` });
  // Light: a pale tint behind dark text. Dark: a deep tint behind light text.
  const bg = (hue: string) => c(hue, mode === "light" ? 50 : 950);
  const fg = (hue: string) => c(hue, mode === "light" ? 700 : 300);
  const emphasis = (hue: string) => c(hue, mode === "light" ? 600 : 400);
  return {
    $description: `Values shadcn's default theme does not define, for the ${mode} theme. Status colours and chart hues come from Tailwind's palette.`,
    polyxd: {
      sys: {
        $type: "color",
        "status-info-background": bg("blue"),
        "status-info-foreground": fg("blue"),
        "status-info-emphasis": emphasis("blue"),
        "status-success-background": bg("green"),
        "status-success-foreground": fg("green"),
        "status-success-emphasis": emphasis("green"),
        "status-warning-background": bg("amber"),
        "status-warning-foreground": mode === "light" ? c("amber", 800) : c("amber", 300),
        "status-warning-emphasis": emphasis("amber"),
        "status-danger-background": bg("red"),
        "status-danger-foreground": fg("red"),
        "status-danger-emphasis": emphasis("red"),
        // shadcn's chart ramp is five steps of one blue, which can't carry six categories.
        "data-1": emphasis("blue"),
        "data-2": emphasis("emerald"),
        "data-3": emphasis("violet"),
        "data-4": emphasis("amber"),
        "data-5": emphasis("rose"),
        "data-6": emphasis("teal"),
        "data-positive": emphasis("green"),
        "data-negative": emphasis("red"),
        "data-neutral": c("zinc", mode === "light" ? 500 : 400),
        // Three places where shadcn's default theme doesn't clear the contract's floor in light mode.
        // Each moves to the nearest step of Tailwind's neutral ramp that does, and dark keeps shadcn's own.
        "text-muted": mode === "light" ? { ...c("zinc", 600), $description: "Contrast adjustment (light): shadcn's --muted-foreground is 4.34:1 on --muted, just under 4.5:1" } : { $value: "{shadcn.muted-foreground}" },
        "border-strong": mode === "light" ? { ...c("zinc", 500), $description: "Contrast adjustment (light): shadcn's --ring is 2.59:1 on --background, under the 3:1 a stroke needs" } : { $value: "{shadcn.ring}" },
        "focus-ring": mode === "light" ? { ...c("zinc", 600), $description: "Contrast adjustment (light): a focus indicator has to be visible; shadcn's --ring is 2.59:1 on white" } : { $value: "{shadcn.ring}" },
        state: {
          $type: "number",
          hover: { $value: 0.05, $description: "Tailwind's hover tints are separate palette steps; Polyxd needs a state-layer opacity" },
          pressed: { $value: 0.1 },
          focus: { $value: 0.12 },
          disabled: { $value: 0.5, $description: "shadcn's disabled styles use opacity-50" },
        },
      },
    },
  };
}

/** Non-colour scales: Tailwind's type, spacing, radii, shadows and easings, plus shadcn's --radius. */
function scaleTier(tw: Vars, shadcn: Vars): Json {
  const text = (name: string) => ({ $value: rem(tw[`--text-${name}`]), $type: "dimension" });
  const radius = Number(String(shadcn["--radius"]).replace("rem", "")) * 16;
  return {
    $description: `Tailwind CSS v4 scales (${PINNED.tailwindcss}) and shadcn's --radius, the same in both modes.`,
    tailwind: {
      text: { $type: "dimension", xs: text("xs"), sm: text("sm"), base: text("base"), lg: text("lg"), xl: text("xl"), "2xl": text("2xl"), "3xl": text("3xl") },
      // Tailwind's spacing is a single 4px base multiplied by the utility's number.
      space: { $type: "dimension", 1: { $value: px(4) }, 2: { $value: px(8) }, 3: { $value: px(12) }, 4: { $value: px(16) }, 6: { $value: px(24) }, 8: { $value: px(32) }, 11: { $value: px(44) }, 12: { $value: px(48) } },
      font: { sans: { $value: tw["--font-sans"], $type: "fontFamily" }, mono: { $value: tw["--font-mono"], $type: "fontFamily" } },
      weight: { $type: "number", normal: { $value: 400 }, medium: { $value: 500 }, semibold: { $value: 600 } },
      shadow: {
        $type: "shadow",
        sm: { $value: [{ offsetX: px(0), offsetY: px(1), blur: px(3), spread: px(0), color: "rgba(0, 0, 0, 0.1)" }, { offsetX: px(0), offsetY: px(1), blur: px(2), spread: px(-1), color: "rgba(0, 0, 0, 0.1)" }] },
        lg: { $value: [{ offsetX: px(0), offsetY: px(10), blur: px(15), spread: px(-3), color: "rgba(0, 0, 0, 0.1)" }, { offsetX: px(0), offsetY: px(4), blur: px(6), spread: px(-4), color: "rgba(0, 0, 0, 0.1)" }] },
      },
      ease: {
        $type: "cubicBezier",
        out: { $value: [0, 0, 0.2, 1] },
        in: { $value: [0.4, 0, 1, 1] },
        "in-out": { $value: [0.4, 0, 0.2, 1] },
      },
      duration: { $type: "duration", 75: { $value: ms(75) }, 150: { $value: ms(150) }, 200: { $value: ms(200) }, 300: { $value: ms(300) } },
    },
    shadcn: {
      radius: {
        $type: "dimension",
        sm: { $value: px(radius - 4) },
        md: { $value: px(radius - 2) },
        lg: { $value: px(radius) },
        full: { $value: px(9999) },
      },
    },
  };
}

/** The Polyxd contract, each token an alias to a shadcn variable, a Tailwind scale, or a Polyxd addition. */
function semanticTier(): Json {
  const s = (name: string) => ({ $value: `{shadcn.${name}}` });
  const sd = (name: string, description: string) => ({ $value: `{shadcn.${name}}`, $description: description });
  const t = (path: string) => ({ $value: `{tailwind.${path}}` });
  const p = (name: string) => ({ $value: `{polyxd.sys.${name}}` });
  const typo = (size: string, weight: string) => ({
    $value: { fontFamily: "{tailwind.font.sans}", fontSize: `{tailwind.text.${size}}`, fontWeight: `{tailwind.weight.${weight}}`, lineHeight: { value: 1.5, unit: "px" }, letterSpacing: { value: 0, unit: "px" } },
  });
  return {
    $description:
      "Polyxd semantic tier for shadcn/ui on Tailwind v4. Every token aliases a shadcn variable or a Tailwind scale wherever one exists; polyxd.* marks what shadcn's default theme leaves out (status colours, chart hues). The file is the same in both modes.",
    color: {
      $type: "color",
      surface: {
        default: s("background"),
        subtle: sd("muted", "shadcn's muted fill, used for table headers and wells"),
        raised: sd("card", "shadcn's card surface"),
        overlay: sd("popover", "shadcn's popover and dialog surface"),
        inverse: s("primary"),
      },
      scrim: { $value: "rgba(0, 0, 0, 0.5)", $description: "shadcn's overlay is bg-black/50" },
      text: {
        default: s("foreground"),
        muted: p("text-muted"),
        inverse: s("primary-foreground"),
        link: sd("foreground", "shadcn links are the foreground colour with an underline; the default theme has no separate link colour"),
      },
      border: {
        default: s("border"),
        strong: p("border-strong"),
        focus: p("focus-ring"),
      },
      action: {
        primary: { background: s("primary"), foreground: s("primary-foreground") },
        secondary: { background: s("secondary"), foreground: s("secondary-foreground"), border: s("border") },
        danger: { background: s("destructive"), foreground: sd("background", "White on shadcn's destructive red; its own destructive-foreground is a near-red that doesn't carry text") },
      },
      selection: { background: sd("accent", "shadcn's accent fill marks selection"), foreground: s("accent-foreground") },
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
      title: { page: typo("3xl", "semibold"), section: typo("xl", "semibold"), item: typo("base", "semibold") },
      body: { default: typo("base", "normal"), small: typo("sm", "normal") },
      label: { default: typo("sm", "medium"), small: typo("xs", "medium") },
      numeric: { display: { ...typo("2xl", "semibold"), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
    },
    space: {
      $type: "dimension",
      inset: { compact: t("space.2"), default: t("space.4"), comfortable: t("space.6") },
      stack: { tight: t("space.1"), default: t("space.2"), loose: t("space.4"), section: t("space.8") },
      inline: { tight: t("space.1"), default: t("space.2"), loose: t("space.4") },
    },
    size: {
      $type: "dimension",
      target: { min: { $value: { value: 44, unit: "px" }, $description: "shadcn's default button is 36px (h-9); 44px is the touch target a generated surface is held to" } },
      icon: { small: t("text.sm"), default: t("text.lg") },
    },
    radius: { $type: "dimension", small: { $value: "{shadcn.radius.sm}" }, control: { $value: "{shadcn.radius.md}", $description: "shadcn buttons are rounded-md" }, default: { $value: "{shadcn.radius.md}" }, large: { $value: "{shadcn.radius.lg}" }, full: { $value: "{shadcn.radius.full}" } },
    border: { width: { $type: "dimension", default: { $value: { value: 1, unit: "px" } }, strong: { $value: { value: 2, unit: "px" } } } },
    focus: { ring: { $type: "dimension", width: { $value: { value: 3, unit: "px" }, $description: "shadcn's focus-visible:ring-[3px]" }, offset: { $value: { value: 2, unit: "px" } } } },
    measure: { max: { $value: 65, $type: "number", $description: "Characters per line for running text (Polyxd; Tailwind has no measure token beyond prose)" } },
    opacity: { state: { $type: "number", hover: p("state.hover"), pressed: p("state.pressed"), focus: p("state.focus"), disabled: p("state.disabled") } },
    shadow: { $type: "shadow", raised: t("shadow.sm"), overlay: t("shadow.lg") },
    motion: {
      duration: { $type: "duration", instant: t("duration.75"), short: t("duration.150"), medium: t("duration.200"), long: t("duration.300") },
      easing: { $type: "cubicBezier", standard: t("ease.in-out"), enter: t("ease.out"), exit: t("ease.in") },
    },
  };
}

const write = (file: string, data: Json) => writeFile(join(OUT, file), JSON.stringify(data, null, 2) + "\n");

async function main(): Promise<void> {
  if (process.argv.includes("--refresh")) await refresh();
  const [light, dark, tw] = await Promise.all([
    readFile(join(SOURCES, "light.json"), "utf8").then(JSON.parse),
    readFile(join(SOURCES, "dark.json"), "utf8").then(JSON.parse),
    readFile(join(SOURCES, "tailwind.json"), "utf8").then(JSON.parse),
  ]);
  await mkdir(OUT, { recursive: true });
  await write("system.json", scaleTier(tw, light));
  await write("system.light.json", { ...systemTier(light, tw, "light"), ...polyxdTier("light", tw) });
  await write("system.dark.json", { ...systemTier(dark, tw, "dark"), ...polyxdTier("dark", tw) });
  await write("semantic.json", semanticTier());
  console.log(`wrote shadcn + Tailwind tokens → ${OUT}`);
}

await main();
