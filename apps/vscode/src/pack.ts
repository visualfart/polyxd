/**
 * The `polyxd.pack` setting as theme CSS for the preview: a manifest compiled to the CSS
 * variables the renderer reads, or a stylesheet served as it is. Copied from `polyxd dev --pack`
 * (packages/ds-kit/src/dev-pack.ts), which ds-kit doesn't export; the contract comes from the
 * spec's JSON directly rather than `loadContract`, which resolves its file with import.meta.url
 * and can't in a CommonJS bundle.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { loadDesignSystem } from "@polyxd/spec";
import contract from "@polyxd/spec/tokens/semantic-contract.json" with { type: "json" };

export interface PackCss {
  /** The value the surface's data-pxd-theme attribute takes. */
  name: string;
  css: string;
}

const cssVar = (token: string) => `--pxd-${token.replace(/\./g, "-")}`;
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

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|math|emoji|fangsong|-apple-system|BlinkMacSystemFont)$/;
function family(v: unknown): string {
  const names = (Array.isArray(v) ? v : String(v).split(",")).map((f) => String(f).trim().replace(/^["']|["']$/g, ""));
  const css = names.map((f) => (GENERIC.test(f) || /^[A-Za-z_][\w-]*$/.test(f) ? f : `"${f}"`));
  if (!names.some((f) => /^(serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace)$/.test(f))) css.push("system-ui", "sans-serif");
  return css.join(", ");
}

function declarations(name: string, type: string, value: unknown): [string, string][] {
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
    case "shadow": {
      const one = (s: any) => `${s.inset ? "inset " : ""}${dim(s.offsetX)} ${dim(s.offsetY)} ${dim(s.blur)} ${dim(s.spread)} ${color(s.color)}`;
      return [[v, Array.isArray(value) ? value.map(one).join(", ") : one(value)]];
    }
    case "fontFamily":
      return [[v, family(value)]];
    case "typography": {
      const t = value as Record<string, unknown>;
      return [
        [`${v}-family`, family(t.fontFamily)],
        [`${v}-size`, dim(t.fontSize)],
        [`${v}-weight`, String(t.fontWeight)],
        [`${v}-line-height`, dim(t.lineHeight)],
        [`${v}-letter-spacing`, t.letterSpacing === undefined ? "normal" : dim(t.letterSpacing)],
      ];
    }
    default:
      return [[v, String(value)]];
  }
}

/** A pack as theme CSS: from its manifest (compiled here) or from a stylesheet (served as is). */
export async function packCss(path: string): Promise<PackCss> {
  if (path.endsWith(".css")) {
    const css = await readFile(path, "utf8");
    const named = /data-pxd-theme=["']?([a-z0-9-]+)/i.exec(css);
    return { name: named?.[1] ?? basename(path, ".css"), css };
  }
  const { manifest, modes } = await loadDesignSystem(path);
  const tokenNames = Object.keys((contract as { tokens: Record<string, unknown> }).tokens);
  const blocks: string[] = [`/* ${manifest.name}, compiled by the Polyxd extension from ${basename(path)} */`];
  const missing: string[] = [];
  for (const [mode, tokens] of modes) {
    const lines: string[] = [];
    for (const name of tokenNames) {
      const t = tokens.get(name);
      if (!t) {
        missing.push(`${mode}: ${name}`);
        continue;
      }
      for (const [k, val] of declarations(name, t.type, t.value)) lines.push(`  ${k}: ${val};`);
    }
    for (const [k, v] of Object.entries(manifest.layout ?? {})) lines.push(`  --pxd-layout-${k}: ${v};`);
    lines.push(`  color-scheme: ${mode === "dark" ? "dark" : "light"};`);
    const selector =
      modes.size === 1
        ? `[data-pxd-theme="${manifest.name}"]`
        : mode === manifest.defaultMode
          ? `[data-pxd-theme="${manifest.name}"]:not([data-pxd-mode]),\n[data-pxd-theme="${manifest.name}"][data-pxd-mode="${mode}"]`
          : `[data-pxd-theme="${manifest.name}"][data-pxd-mode="${mode}"]`;
    blocks.push(`${selector} {\n${lines.join("\n")}\n}`);
  }
  // A pack still being drafted renders with what it has; the contract check is `polyxd check`'s job.
  if (missing.length) blocks.push(`/* ${missing.length} contract token(s) not in this pack: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ", …" : ""} */`);
  return { name: manifest.name, css: blocks.join("\n\n") + "\n" };
}
