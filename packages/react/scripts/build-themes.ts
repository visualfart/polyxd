/**
 * Compiles design-system packs into CSS custom properties, one file per pack:
 *   themes/<pack>.css  →  [data-pxd-theme="<pack>"][data-pxd-mode="<mode>"] { --pxd-color-surface-default: …; … }
 * Only semantic-tier tokens (the contract) are emitted; renderers never see primitives.
 * Also emits shadcn's variable names so an existing shadcn app is themed by the same pack.
 *
 * Usage: node scripts/build-themes.ts [path/to/manifest.json ...]
 * With no arguments, builds every packages/ds-* pack that exists.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadContract, loadDesignSystem, type TokenSet } from "@polyxd/spec";

const packagesDir = new URL("../../", import.meta.url);
const outDir = new URL("../themes/", import.meta.url);

export const cssVar = (token: string) => `--pxd-${token.replace(/\./g, "-")}`;

type Dim = { value: number; unit: string };
const dim = (v: unknown) => (typeof v === "object" && v && "unit" in v ? `${(v as Dim).value}${(v as Dim).unit}` : String(v));

function color(v: unknown): string {
  if (typeof v === "string") return v;
  const c = v as { colorSpace: string; components: number[]; alpha?: number; hex?: string };
  if (c.alpha !== undefined && c.alpha < 1 && c.colorSpace === "srgb") {
    const [r, g, b] = c.components.map((x) => Math.round(x * 255));
    return `rgb(${r} ${g} ${b} / ${c.alpha})`;
  }
  return c.hex ?? `color(${c.colorSpace} ${c.components.join(" ")})`;
}

function shadow(v: unknown): string {
  const one = (s: any) => `${s.inset ? "inset " : ""}${dim(s.offsetX)} ${dim(s.offsetY)} ${dim(s.blur)} ${dim(s.spread)} ${color(s.color)}`;
  return Array.isArray(v) ? v.map(one).join(", ") : one(v);
}

/**
 * A CSS font-family list from a DTCG fontFamily token. Names that aren't plain CSS identifiers are
 * quoted (one invalid name, such as `.SFNSText-Regular`, invalidates the whole declaration), and a
 * generic family is appended when the pack gives none, so a missing web font never falls back to serif.
 */
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|math|emoji|fangsong|-apple-system|BlinkMacSystemFont)$/;
const family = (v: unknown) => {
  const names = (Array.isArray(v) ? v : String(v).split(",")).map((f) => String(f).trim().replace(/^["']|["']$/g, ""));
  const css = names.map((f) => (GENERIC.test(f) || /^[A-Za-z_][\w-]*$/.test(f) ? f : `"${f}"`));
  if (!names.some((f) => /^(serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace)$/.test(f))) css.push("system-ui", "sans-serif");
  return css.join(", ");
};

/** CSS declarations for one resolved token. Composite typography expands into its parts. */
export function declarations(name: string, type: string, value: unknown): [string, string][] {
  const v = cssVar(name);
  switch (type) {
    case "color":
      return [[v, color(value)]];
    case "dimension":
    case "duration":
      return [[v, dim(value)]];
    case "number":
      return [[v, String(value)]];
    case "cubicBezier":
      return [[v, `cubic-bezier(${(value as number[]).join(", ")})`]];
    case "shadow":
      return [[v, shadow(value)]];
    case "fontFamily":
      return [[v, family(value)]];
    case "typography": {
      const t = value as Record<string, unknown>;
      return [
        [`${v}-family`, family(t.fontFamily)],
        [`${v}-size`, dim(t.fontSize)],
        [`${v}-weight`, String(t.fontWeight)],
        // A line height is either a ratio (Material's 1.5) or a length (Polaris's 1.25rem); both
        // are valid CSS, and a DTCG dimension has to keep its unit or the declaration is dropped.
        [`${v}-line-height`, dim(t.lineHeight)],
        [`${v}-letter-spacing`, t.letterSpacing === undefined ? "normal" : dim(t.letterSpacing)],
      ];
    }
    default:
      return [[v, String(value)]];
  }
}

const SHADCN: Record<string, string> = {
  "--background": "color.surface.default",
  "--foreground": "color.text.default",
  "--card": "color.surface.raised",
  "--card-foreground": "color.text.default",
  "--popover": "color.surface.overlay",
  "--popover-foreground": "color.text.default",
  "--primary": "color.action.primary.background",
  "--primary-foreground": "color.action.primary.foreground",
  "--secondary": "color.action.secondary.background",
  "--secondary-foreground": "color.action.secondary.foreground",
  "--muted": "color.surface.subtle",
  "--muted-foreground": "color.text.muted",
  "--accent": "color.selection.background",
  "--accent-foreground": "color.selection.foreground",
  "--destructive": "color.action.danger.background",
  "--border": "color.border.default",
  "--input": "color.border.strong",
  "--ring": "color.border.focus",
  "--radius": "radius.default",
  "--chart-1": "color.data.categorical.1",
  "--chart-2": "color.data.categorical.2",
  "--chart-3": "color.data.categorical.3",
  "--chart-4": "color.data.categorical.4",
  "--chart-5": "color.data.categorical.5",
};

/**
 * A pack's optional extras stylesheet (manifest `extras`): the few things tokens can't express, such
 * as a hand-drawn pack's uneven radii. It is appended verbatim, so it is held to two rules first:
 * every selector is scoped by this pack's `[data-pxd-theme]`, and it names no colour of its own —
 * only `var(--pxd-…)` tokens — so recolouring the tokens recolours the extras too.
 */
export function checkExtras(pack: string, css: string): string[] {
  const problems: string[] = [];
  const scope = `[data-pxd-theme="${pack}"]`;
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const colour = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color|color-mix)\(/gi;
  for (const m of body.matchAll(colour)) problems.push(`colour literal "${m[0]}" (extras may only use var(--pxd-…) tokens)`);
  // A brace scanner: rules inside @media / @supports are checked the same way as top-level ones.
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "{") {
      const prelude = body.slice(start, i).trim();
      stack.push(prelude);
      start = i + 1;
      if (!prelude.startsWith("@")) {
        for (const sel of prelude.split(",")) {
          if (!sel.trim().startsWith(scope)) problems.push(`selector "${sel.trim()}" is not scoped by ${scope}`);
        }
      }
    } else if (body[i] === "}") {
      stack.pop();
      start = i + 1;
    }
  }
  if (stack.length) problems.push("unbalanced braces");
  return problems;
}

export function themeCss(pack: string, modes: Map<string, TokenSet>, defaultMode: string, contractTokens: string[], layout: Record<string, string> = {}, extras?: string): string {
  const blocks: string[] = [`/* Generated by @polyxd/react scripts/build-themes.ts from the ${pack} pack. Do not edit. */`];
  for (const [mode, tokens] of modes) {
    const lines: string[] = [];
    for (const name of contractTokens) {
      const t = tokens.get(name);
      if (!t) throw new Error(`${pack}/${mode}: missing contract token ${name}`);
      for (const [k, val] of declarations(name, t.type, t.value)) lines.push(`  ${k}: ${val};`);
    }
    if (Object.keys(layout).length) {
      lines.push("", "  /* Layout this system's components differ on, which tokens can't express (see the manifest) */");
      for (const [k, v] of Object.entries(layout)) lines.push(`  --pxd-layout-${k}: ${v};`);
    }
    lines.push("", "  /* shadcn/ui variable names, so shadcn components follow this pack too */");
    for (const [k, token] of Object.entries(SHADCN)) lines.push(`  ${k}: var(${cssVar(token)});`);
    lines.push(`  color-scheme: ${mode === "dark" ? "dark" : "light"};`);
    // A pack with one mode renders that mode whichever mode is asked for: GOV.UK has no dark theme,
    // and a surface that asks for one should still be themed rather than fall back to nothing.
    const selector =
      modes.size === 1
        ? `[data-pxd-theme="${pack}"]`
        : mode === defaultMode
          ? `[data-pxd-theme="${pack}"]:not([data-pxd-mode]),\n[data-pxd-theme="${pack}"][data-pxd-mode="${mode}"]`
          : `[data-pxd-theme="${pack}"][data-pxd-mode="${mode}"]`;
    blocks.push(`${selector} {\n${lines.join("\n")}\n}`);
  }
  if (extras !== undefined) {
    const problems = checkExtras(pack, extras);
    if (problems.length) throw new Error(`${pack}: extras stylesheet rejected:\n  ${problems.join("\n  ")}`);
    blocks.push(`/* Extras from the ${pack} pack's manifest: what tokens can't express, appended verbatim, scoped to this theme. */\n${extras.trim()}`);
  }
  return blocks.join("\n\n") + "\n";
}

/** The extras stylesheet a manifest names, read relative to the manifest; undefined when it names none. */
export async function loadExtras(manifestPath: string, manifest: { extras?: string }): Promise<string | undefined> {
  return manifest.extras ? readFile(resolve(dirname(manifestPath), manifest.extras), "utf8") : undefined;
}

async function packManifests(): Promise<string[]> {
  const dirs = (await readdir(packagesDir)).filter((d) => d.startsWith("ds-")).sort();
  return dirs.map((d) => new URL(`${d}/manifest.json`, packagesDir).pathname).filter((p) => existsSync(p));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifests = process.argv.length > 2 ? process.argv.slice(2) : await packManifests();
  const contract = await loadContract();
  for (const path of manifests) {
    const { manifest, modes } = await loadDesignSystem(path);
    const extras = await loadExtras(path, manifest);
    await writeFile(new URL(`${manifest.name}.css`, outDir), themeCss(manifest.name, modes, manifest.defaultMode, Object.keys(contract.tokens), manifest.layout, extras));
    console.log(`wrote themes/${manifest.name}.css (${[...modes.keys()].join(", ")}${extras ? ", with extras" : ""})`);
  }
}
