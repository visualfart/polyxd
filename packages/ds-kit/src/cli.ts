#!/usr/bin/env node
/**
 * Makes a Polyxd design-system pack out of your own tokens.
 *
 *   npx polyxd pack ./src/tokens.css                    draft a pack, and a mapping to correct
 *   npx polyxd pack ./tokens.css --dark ./dark.css      when light and dark are separate files
 *   npx polyxd pack ./tokens.css --name acme --out ./ds
 *
 * Run it once and it writes two things: a pack, and `polyxd.mapping.json` recording every guess it
 * made. Correct the wrong lines, fill the blank ones, run it again. It prints what is still missing
 * and why each time, so the work is a list that gets shorter rather than a specification to read.
 *
 * It does not invent colours. Where the contract needs something your tokens don't have — a colour
 * that carries 3:1 for a focus ring, say — it says so and names the closest thing you do have.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { contrastRatio } from "@polyxd/spec";
import { cssVars, resolveVars, length, duration, bezier, shadowLayers, writePack, type Json, type Vars } from "./index.ts";
import { inferMapping, type Mapping } from "./infer.ts";

const CONTRACT = new URL("../../spec/tokens/semantic-contract.json", import.meta.url);

interface Options {
  input: string;
  dark?: string;
  name: string;
  out: string;
}

function parse(argv: string[]): Options {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const flag = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i > -1 ? argv[i + 1] : undefined;
  };
  const input = positional[0];
  if (!input) {
    console.log("usage: polyxd pack <tokens.css> [--dark <dark.css>] [--name <name>] [--out <dir>]");
    process.exit(1);
  }
  const name = flag("name") ?? basename(input).replace(/\.(css|json)$/, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return { input: resolve(input), dark: flag("dark") ? resolve(flag("dark")!) : undefined, name, out: resolve(flag("out") ?? `./ds-${name}`) };
}

/** Every custom property in a stylesheet, whatever selector it sits under. */
async function read(path: string): Promise<Vars> {
  const text = await readFile(path, "utf8");
  if (path.endsWith(".json")) {
    // A flat DTCG-ish file: { "color.primary": "#123456" } or { "color": { "primary": { "$value": … } } }
    const flat: Vars = {};
    const walk = (node: any, trail: string[]) => {
      if (node && typeof node === "object" && "$value" in node) return void (flat[`--${trail.join("-")}`] = String(node.$value));
      if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, [...trail, k.replace(/\./g, "-")]);
      else if (typeof node === "string") flat[`--${trail.join("-")}`] = node;
    };
    walk(JSON.parse(text), []);
    return flat;
  }
  return resolveVars(cssVars(text, () => true));
}

/** A contract token's value, converted to whatever DTCG type the contract says it is. */
function convert(type: string, raw: string): unknown {
  switch (type) {
    case "dimension":
      return length(raw);
    case "duration":
      return duration(raw);
    case "cubicBezier":
      return bezier(raw);
    case "shadow":
      return shadowLayers(raw);
    case "number":
      return Number.parseFloat(raw) || 0;
    default:
      return raw;
  }
}

/**
 * What the contract needs that no token can supply, because it isn't a value a design system
 * publishes: how long a state layer lasts, how wide a line of text runs, how big a touch target is.
 * These are Polyxd's, they are the same for everyone, and a team shouldn't have to invent them.
 */
const POLYXD_DEFAULTS: Record<string, { value: unknown; why: string }> = {
  "measure.max": { value: 65, why: "characters per line for running text" },
  "opacity.state.hover": { value: 0.06, why: "state-layer opacity; most systems shade with separate colours instead" },
  "opacity.state.pressed": { value: 0.12, why: "state-layer opacity" },
  "opacity.state.focus": { value: 0.12, why: "state-layer opacity" },
  "opacity.state.disabled": { value: 0.4, why: "disabled content stays perceivable but clearly inactive" },
  "size.target.min": { value: { value: 44, unit: "px" }, why: "the touch target a generated surface is held to" },
  "focus.ring.width": { value: { value: 2, unit: "px" }, why: "a focus ring you can find" },
  "focus.ring.offset": { value: { value: 2, unit: "px" }, why: "a focus ring you can find" },
  "border.width.default": { value: { value: 1, unit: "px" }, why: "a hairline" },
  "border.width.strong": { value: { value: 2, unit: "px" }, why: "a deliberate line" },
  "motion.duration.instant": { value: { value: 100, unit: "ms" }, why: "no motion tokens found" },
  "motion.duration.short": { value: { value: 150, unit: "ms" }, why: "no motion tokens found" },
  "motion.duration.medium": { value: { value: 200, unit: "ms" }, why: "no motion tokens found" },
  "motion.duration.long": { value: { value: 300, unit: "ms" }, why: "no motion tokens found" },
  "motion.easing.standard": { value: [0.4, 0, 0.2, 1], why: "no easing tokens found" },
  "motion.easing.enter": { value: [0, 0, 0.2, 1], why: "no easing tokens found" },
  "motion.easing.exit": { value: [0.4, 0, 1, 1], why: "no easing tokens found" },
};

/** The type scale, built from whatever font sizes exist, because no two systems name theirs alike. */
function typography(vars: Vars, mapping: Mapping): Record<string, Json> {
  const family =
    Object.entries(vars).find(([n]) => /font-(family|sans)|fonts?-(body|sans)/.test(n.replace(/^--/, "")))?.[1] ?? "system-ui, sans-serif";
  const sizes = Object.entries(vars)
    .filter(([n, v]) => /font-size|text-(xs|sm|base|md|lg|xl|2xl)/.test(n.replace(/^--/, "")) && /^[\d.]+(px|rem)$/.test(v.trim()))
    .map(([, v]) => length(v).value)
    .sort((a, b) => a - b);
  // Without a scale to read, the contract's own floor: 16px body, and steps either side of it.
  const scale = sizes.length >= 4 ? sizes : [12, 14, 16, 20, 24];
  const at = (i: number) => ({ value: scale[Math.min(i, scale.length - 1)], unit: "px" as const });
  const body = Math.max(16, scale.find((s) => s >= 16) ?? 16);
  const style = (size: { value: number; unit: "px" }, weight: number) => ({
    $type: "typography",
    $value: { fontFamily: family, fontSize: size, fontWeight: weight, lineHeight: 1.5, letterSpacing: { value: 0, unit: "px" } },
  });
  void mapping;
  return {
    title: { page: style(at(scale.length - 1), 700), section: style(at(scale.length - 2), 600), item: style({ value: body, unit: "px" }, 600) },
    body: { default: style({ value: body, unit: "px" }, 400), small: style(at(1), 400) },
    label: { default: style(at(1), 500), small: style(at(0), 500) },
    numeric: { display: { ...style(at(scale.length - 1), 700), $extensions: { "com.polyxd": { numeric: "tabular" } } } },
  };
}

/** Sets a value at a dotted path inside the nested token tree a pack file uses. */
function put(tree: Json, path: string, value: Json): void {
  const parts = path.split(".");
  let node = tree;
  for (const part of parts.slice(0, -1)) node = node[part] ??= {};
  node[parts[parts.length - 1]] = value;
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2).filter((a) => a !== "pack"));
  const contract = JSON.parse(await readFile(CONTRACT, "utf8"));
  const light = await read(options.input);
  const dark = options.dark ? await read(options.dark) : undefined;
  console.log(`read ${Object.keys(light).length} variables from ${basename(options.input)}${dark ? ` and ${Object.keys(dark).length} from ${basename(options.dark!)}` : ""}\n`);

  await mkdir(options.out, { recursive: true });
  const mappingPath = join(options.out, "polyxd.mapping.json");
  // A mapping the team has already corrected wins over anything guessed this time round.
  const existing: Mapping | undefined = existsSync(mappingPath) ? JSON.parse(await readFile(mappingPath, "utf8")) : undefined;
  const { mapping: guessed, guesses } = inferMapping(light);
  const mapping: Mapping = { ...guessed, tokens: { ...guessed.tokens, ...(existing?.tokens ?? {}) } };

  const build = (vars: Vars) => {
    const semantic: Json = {};
    const missing: { token: string; type: string }[] = [];
    for (const [token, spec] of Object.entries(contract.tokens) as [string, any][]) {
      if (token.startsWith("type.")) continue;
      const source = mapping.tokens[token];
      const raw = source ? (vars[`--${source}`] ?? vars[source] ?? (source.startsWith("=") ? source.slice(1) : undefined)) : undefined;
      if (raw !== undefined) put(semantic, token, { $value: convert(spec.type, raw), $type: spec.type });
      else if (POLYXD_DEFAULTS[token]) put(semantic, token, { $value: POLYXD_DEFAULTS[token].value, $type: spec.type, $description: `Polyxd default: ${POLYXD_DEFAULTS[token].why}` });
      else missing.push({ token, type: spec.type });
    }
    for (const [key, value] of Object.entries(typography(vars, mapping))) put(semantic, `type.${key}`, value);
    return { semantic, missing };
  };

  const built = build(light);
  const builtDark = dark ? build(dark) : undefined;

  await writePack({
    dir: options.out,
    name: options.name,
    displayName: options.name.replace(/(^|-)([a-z])/g, (_, s, c) => `${s ? " " : ""}${c.toUpperCase()}`),
    contractVersion: contract.contractVersion ?? "0.2.0",
    modes: dark ? ["light", "dark"] : ["light"],
    provenance: [{ source: `local:${basename(options.input)}`, license: "see the owning project", notes: "Drafted by `polyxd pack` from this project's own tokens." }],
    light: built.semantic,
    dark: builtDark?.semantic ?? built.semantic,
    semantic: built.semantic,
  });
  await writeFile(mappingPath, JSON.stringify(mapping, null, 2) + "\n");

  // ---------- The report, which is the point ----------

  const named = guesses.filter((g) => g.how === "named").length;
  const measured = guesses.filter((g) => g.how === "measured");
  console.log(`mapped ${Object.keys(mapping.tokens).length} of ${Object.keys(contract.tokens).length} contract tokens`);
  console.log(`  ${named} from their names${existing ? `, including ${Object.keys(existing.tokens).length} you set` : ""}`);
  for (const g of measured) console.log(`  ${g.token} ← ${g.from} (${g.why})`);

  const defaults = Object.keys(POLYXD_DEFAULTS).filter((t) => !mapping.tokens[t]);
  if (defaults.length) console.log(`\n${defaults.length} tokens took a Polyxd default (state opacities, touch target, focus ring, motion). Override any of them in the mapping.`);

  if (built.missing.length) {
    console.log(`\nstill needed — nothing in your tokens matched, and there is no sensible default:`);
    for (const m of built.missing) console.log(`  ${m.token.padEnd(34)} (${m.type})`);
    console.log(`\nAdd them to ${basename(mappingPath)}: "${built.missing[0].token}": "your-variable-name", or "=#hex" for a literal.`);
  }

  // Contrast is the part a team can't eyeball, so it is reported whether or not they asked.
  const failures: string[] = [];
  for (const pair of contract.contrast ?? []) {
    const fg = mapping.tokens[pair.foreground] ? light[`--${mapping.tokens[pair.foreground]}`] : undefined;
    const bg = mapping.tokens[pair.background] ? light[`--${mapping.tokens[pair.background]}`] : undefined;
    if (!fg || !bg) continue;
    try {
      const ratio = contrastRatio(fg, bg);
      if (ratio < pair.min) failures.push(`  ${pair.foreground} on ${pair.background}: ${ratio.toFixed(2)}:1, needs ${pair.min}:1`);
    } catch {
      // A colour this tool can't read is reported by the contract check, not guessed at here.
    }
  }
  if (failures.length) {
    console.log(`\n${failures.length} of your own pairs don't meet the contrast the contract requires:`);
    for (const f of failures) console.log(f);
    console.log(`  These are your tokens, not ours — the pack won't paper over them.`);
  }

  console.log(`\nwrote ${options.out}`);
  console.log(`next: npx polyxd check ${join(options.out, "manifest.json")}`);
}

await main();
