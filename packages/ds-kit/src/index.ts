/**
 * Shared parts of building a design-system pack.
 *
 * A pack is: vendored source tokens, a mapping onto the Polyxd contract, and the DTCG files that
 * come out. The mapping is the interesting part and stays per pack; everything else — reading CSS
 * custom properties, turning CSS lengths and shadows into DTCG values, writing the tiers and the
 * manifest — is the same every time, and lives here.
 *
 * Used by @polyxd/ds-mantine and @polyxd/ds-radix. The earlier packs (Material 3, Carbon, Ant,
 * Fluent, shadcn, Bootstrap) have their own generators, written before this existed; they produce
 * the same shape of output and are checked the same way.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { contrastRatio } from "@polyxd/spec";
import { join } from "node:path";

export type Json = any;
export type Vars = Record<string, string>;

/**
 * Every custom property from the CSS rules whose selector satisfies `matches`, in file order, so a
 * later rule overrides an earlier one exactly as a browser resolves it. Selectors spanning several
 * lines are handled: a design system's dark block is usually `:root[data-scheme='dark'], :host(…)`.
 *
 * `matches` also receives the enclosing at-rule when there is one, so a caller can skip overrides
 * it can't use — Radix Themes, for example, repeats every colour in display-p3 inside @supports,
 * and contrast is defined on sRGB.
 */
export function cssVars(css: string, matches: (selector: string, atRule?: string) => boolean, prefix = "--"): Vars {
  const out: Vars = {};
  const declarations = new RegExp(`(${prefix}[a-zA-Z0-9-]+)\\s*:\\s*([^;]+);`, "g");
  // A brace scanner rather than a regex: real stylesheets nest rules inside @media and @supports,
  // and a regex that assumes one level silently reads the wrong blocks.
  let depth = 0;
  let start = 0;
  const stack: string[] = [];
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      stack.push(css.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim());
      depth++;
      start = i + 1;
    } else if (ch === "}") {
      const selector = stack.pop() ?? "";
      const body = css.slice(start, i);
      // An at-rule wraps other rules; a normal selector's body holds the declarations we want.
      // The nearest enclosing at-rule, so a caller can skip a wide-gamut or print override.
      const atRule = [...stack].reverse().find((s) => s.startsWith("@"));
      if (!selector.startsWith("@") && matches(selector, atRule)) {
        for (const [, name, value] of body.matchAll(declarations)) out[name] = value.trim();
      }
      depth = Math.max(0, depth - 1);
      start = i + 1;
    }
  }
  return out;
}

/** Resolves `var(--x)` references within one set of variables, so tokens hold values. */
export function resolveVars(vars: Vars, depth = 6): Vars {
  const out = { ...vars };
  for (let pass = 0; pass < depth; pass++) {
    let changed = false;
    for (const [name, value] of Object.entries(out)) {
      const next = value.replace(/var\((--[a-zA-Z0-9-]+)(?:\s*,\s*([^)]+))?\)/g, (whole, ref, fallback) => out[ref] ?? fallback ?? whole);
      if (next !== value) {
        out[name] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

/**
 * A CSS length as a DTCG dimension. rem and em are 16px at the root, and the simple `calc()` a
 * scale is usually written with — `calc(0.5rem * 1)`, Mantine's scale factor — is evaluated.
 */
export function length(value: string, rootPx = 16): { value: number; unit: "px" } {
  const s = String(value).trim();
  const calc = /^calc\(\s*([\d.]+)(rem|em|px)?\s*([*/+-])\s*([\d.]+)(rem|em|px)?\s*\)$/.exec(s);
  if (calc) {
    const [, a, unitA, op, b, unitB] = calc;
    const toPx = (n: string, unit?: string) => (unit === "rem" || unit === "em" ? Number(n) * rootPx : Number(n));
    const left = toPx(a, unitA);
    // A bare number on either side is a multiplier, not a length.
    const right = unitB ? toPx(b, unitB) : Number(b);
    const result = op === "*" ? left * right : op === "/" ? left / right : op === "+" ? left + toPx(b, unitB ?? unitA) : left - toPx(b, unitB ?? unitA);
    return { value: Math.round(result * 1000) / 1000, unit: "px" };
  }
  const n = Number.parseFloat(s);
  if (Number.isNaN(n)) return { value: 0, unit: "px" };
  if (s.endsWith("rem") || s.endsWith("em")) return { value: Math.round(n * rootPx * 1000) / 1000, unit: "px" };
  return { value: n, unit: "px" };
}

/** Splits on whitespace that isn't inside brackets, so `calc(1rem * 2)` stays one piece. */
export function splitOutside(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current) parts.push(current);
      current = "";
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

/** A CSS duration as a DTCG duration. */
export function duration(value: string): { value: number; unit: "ms" } {
  const s = String(value).trim();
  const n = Number.parseFloat(s) || 0;
  return { value: s.endsWith("ms") ? n : n * 1000, unit: "ms" };
}

/** A cubic-bezier() string as its four numbers. */
export const bezier = (value: string): number[] => (String(value).match(/-?\d*\.?\d+/g) ?? [0, 0, 1, 1]).map(Number).slice(-4);

/** A CSS box-shadow (one or more layers) as DTCG shadow layers. */
export function shadowLayers(css: string): Json[] {
  return String(css)
    .split(/,(?![^(]*\))/)
    .map((layer) => layer.trim())
    .filter(Boolean)
    .map((layer) => {
      const colour = layer.match(/(rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|#[0-9a-f]{3,8})/i)?.[0] ?? "rgba(0, 0, 0, 0.15)";
      const lengths = splitOutside(layer.replace(colour, "").replace("inset", "").trim()).filter(Boolean);
      const [offsetX = "0", offsetY = "0", blur = "0", spread = "0"] = lengths;
      return {
        offsetX: length(offsetX),
        offsetY: length(offsetY),
        blur: length(blur),
        spread: length(spread),
        color: colour,
        ...(layer.includes("inset") ? { inset: true } : {}),
      };
    });
}

/** How a source variable becomes a DTCG token: which type, and how the value is converted. */
export interface TypeRule {
  match: RegExp;
  type: "color" | "dimension" | "duration" | "cubicBezier" | "shadow" | "fontFamily" | "number";
}

const CONVERT: Record<TypeRule["type"], (v: string) => unknown> = {
  color: (v) => v,
  dimension: (v) => length(v),
  duration: (v) => duration(v),
  cubicBezier: (v) => bezier(v),
  shadow: (v) => shadowLayers(v),
  fontFamily: (v) => v,
  number: (v) => Number.parseFloat(v) || 0,
};

/**
 * One system tier: the design system's own variables, names kept, typed by the rules given.
 * A variable no rule matches, and that doesn't look like a colour, is left out rather than guessed at.
 */
export function systemTier(vars: Vars, namespace: string, rules: TypeRule[], description: string): Json {
  const tokens: Json = {};
  for (const [name, value] of Object.entries(vars)) {
    const key = name.replace(/^--/, "").replace(new RegExp(`^${namespace}-`), "");
    const rule = rules.find((r) => r.match.test(key));
    // A value a design system writes as a colour: hex, a colour function, or a plain keyword.
    const looksLikeColour = /^(#|rgb|hsl|oklch|color-mix|white$|black$|transparent$)/.test(value.trim());
    if (!rule && !looksLikeColour) continue;
    const type = rule?.type ?? "color";
    tokens[key] = { $value: CONVERT[type](value), $type: type };
  }
  return { $description: description, [namespace]: tokens };
}

export interface PackFiles {
  dir: string;
  name: string;
  displayName: string;
  contractVersion: string;
  provenance: Json[];
  light: Json;
  dark: Json;
  semantic: Json;
  /** Tokens shared by both modes, if the pack has any. */
  shared?: Json;
}

/** Writes a pack's token files, manifest and package.json. */
export async function writePack(pack: PackFiles): Promise<void> {
  const tokens = join(pack.dir, "tokens");
  await mkdir(tokens, { recursive: true });
  const write = (file: string, data: Json) => writeFile(join(tokens, file), JSON.stringify(data, null, 2) + "\n");
  if (pack.shared) await write("system.json", pack.shared);
  await write("system.light.json", pack.light);
  await write("system.dark.json", pack.dark);
  await write("semantic.json", pack.semantic);

  const files = (mode: string) => [...(pack.shared ? ["tokens/system.json"] : []), `tokens/system.${mode}.json`, "tokens/semantic.json"];
  await writeFile(
    join(pack.dir, "manifest.json"),
    JSON.stringify(
      {
        $schema: "../spec/schema/design-system.schema.json",
        name: pack.name,
        displayName: pack.displayName,
        version: "0.0.0",
        contractVersion: pack.contractVersion,
        license: "Apache-2.0",
        modes: { light: files("light"), dark: files("dark") },
        defaultMode: "light",
        provenance: pack.provenance,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    join(pack.dir, "package.json"),
    JSON.stringify(
      {
        name: `@polyxd/ds-${pack.name}`,
        version: "0.0.0",
        private: true,
        description: `${pack.displayName} design-system pack for Polyxd (DTCG 2025.10 tokens)`,
        license: "Apache-2.0",
        type: "module",
        files: ["manifest.json", "tokens", "README.md"],
        scripts: {
          generate: "node scripts/generate.ts",
          check: "node ../spec/src/cli/check-design-system.ts manifest.json",
          test: "npm run check",
        },
      },
      null,
      2,
    ) + "\n",
  );
}

/**
 * The nearest step of a palette that clears a contrast floor against `background`, searching
 * outward from `from`. This is the rule every pack follows when a design system's own choice
 * doesn't pass: move along that system's own ramp rather than inventing a colour.
 *
 * `steps` is the ramp in order (index 0 lightest). Returns the chosen index, or the end of the
 * ramp it searched toward when nothing passes — the caller reports that.
 */
export function nearestPassing(steps: string[], background: string, min: number, from: number, direction: "darker" | "lighter"): { index: number; ratio: number; passes: boolean } {
  const step = direction === "darker" ? 1 : -1;
  let best = { index: from, ratio: contrastRatio(steps[from], background), passes: false };
  for (let i = from; i >= 0 && i < steps.length; i += step) {
    const ratio = contrastRatio(steps[i], background);
    if (ratio >= min) return { index: i, ratio, passes: true };
    if (ratio > best.ratio) best = { index: i, ratio, passes: false };
  }
  return best;
}

/** `{alias}` helpers for writing a semantic tier. */
export const alias = (path: string) => ({ $value: `{${path}}` });
export const aliasWith = (path: string, description: string) => ({ $value: `{${path}}`, $description: description });
