import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { contrastRatio, type ColorValue } from "./color.ts";

export interface ResolvedToken {
  type: string;
  value: unknown;
}

/** Flat map of dotted token names to resolved (alias-free) values. */
export type TokenSet = Map<string, ResolvedToken>;

export interface TokenContract {
  contractVersion: string;
  tokens: Record<string, { type: string; description: string }>;
  contrast: { foreground: string; background: string; min: number; criterion: string }[];
  constraints: { token: string; property?: string; min?: unknown; max?: unknown; reason: string }[];
}

export interface DesignSystemManifest {
  name: string;
  version: string;
  contractVersion: string;
  license: string;
  modes: Record<string, string[]>;
  defaultMode: string;
  /** Layout variables the renderer defines and this pack sets; see the schema. */
  layout?: Record<string, string>;
  /** A stylesheet, relative to the manifest, that the theme compiler appends verbatim; see the schema. */
  extras?: string;
}

export interface ContractIssue {
  mode?: string;
  token: string;
  message: string;
}

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));

export async function loadContract(): Promise<TokenContract> {
  return readJson(new URL("../tokens/semantic-contract.json", import.meta.url).pathname);
}

/**
 * Flattens nested DTCG groups into dotted names. `$type` set on a group is inherited by its
 * tokens, as the DTCG format specifies. Later calls override earlier entries.
 */
export function flatten(tree: Record<string, unknown>, into = new Map<string, { type?: string; value: unknown }>(), prefix = "", inheritedType?: string) {
  const groupType = typeof tree.$type === "string" ? tree.$type : inheritedType;
  for (const [key, node] of Object.entries(tree)) {
    if (key.startsWith("$") || node === null || typeof node !== "object") continue;
    const name = prefix ? `${prefix}.${key}` : key;
    const n = node as Record<string, unknown>;
    if ("$value" in n) {
      into.set(name, { type: typeof n.$type === "string" ? n.$type : groupType, value: n.$value });
    } else {
      flatten(n, into, name, groupType);
    }
  }
  return into;
}

const ALIAS = /^\{([^{}]+)\}$/;

/** Resolves `{token.name}` aliases (including inside composite values) and fills in inherited types. */
export function resolveAliases(raw: Map<string, { type?: string; value: unknown }>): TokenSet {
  const out: TokenSet = new Map();
  const visiting = new Set<string>();

  const resolveValue = (value: unknown, from: string): unknown => {
    if (typeof value === "string") {
      const m = ALIAS.exec(value);
      return m ? resolveToken(m[1], from).value : value;
    }
    if (Array.isArray(value)) return value.map((v) => resolveValue(v, from));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v, from)]));
    }
    return value;
  };

  const resolveToken = (name: string, from?: string): ResolvedToken => {
    const done = out.get(name);
    if (done) return done;
    const entry = raw.get(name);
    if (!entry) throw new Error(`Unknown token "${name}"${from ? ` referenced from "${from}"` : ""}`);
    if (visiting.has(name)) throw new Error(`Circular alias involving "${name}"`);
    visiting.add(name);
    let type = entry.type;
    const m = typeof entry.value === "string" ? ALIAS.exec(entry.value) : null;
    const value = resolveValue(entry.value, name);
    if (!type && m) type = resolveToken(m[1], name).type;
    visiting.delete(name);
    const token = { type: type ?? "unknown", value };
    out.set(name, token);
    return token;
  };

  for (const name of raw.keys()) resolveToken(name);
  return out;
}

export async function loadDesignSystem(manifestPath: string): Promise<{ manifest: DesignSystemManifest; modes: Map<string, TokenSet> }> {
  const manifest: DesignSystemManifest = await readJson(manifestPath);
  const base = dirname(manifestPath);
  const modes = new Map<string, TokenSet>();
  for (const [mode, files] of Object.entries(manifest.modes)) {
    const raw = new Map<string, { type?: string; value: unknown }>();
    for (const file of files) flatten(await readJson(resolve(base, file)), raw);
    modes.set(mode, resolveAliases(raw));
  }
  return { manifest, modes };
}

const px = (v: unknown): number | undefined => {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "value" in v && "unit" in v) {
    const { value, unit } = v as { value: number; unit: string };
    return unit === "px" ? value : unit === "rem" ? value * 16 : undefined;
  }
  return undefined;
};

/** Checks one mode of a design system against the semantic contract. Returns no issues when compliant. */
export function checkContract(tokens: TokenSet, contract: TokenContract, mode?: string): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const issue = (token: string, message: string) => issues.push({ mode, token, message });

  for (const [name, spec] of Object.entries(contract.tokens)) {
    const t = tokens.get(name);
    if (!t) issue(name, "missing");
    else if (t.type !== spec.type) issue(name, `type is "${t.type}", contract requires "${spec.type}"`);
  }

  for (const pair of contract.contrast) {
    const fg = tokens.get(pair.foreground);
    const bg = tokens.get(pair.background);
    if (!fg || !bg) continue;
    try {
      const ratio = contrastRatio(fg.value as ColorValue, bg.value as ColorValue);
      if (ratio < pair.min) {
        issue(pair.foreground, `contrast ${ratio.toFixed(2)}:1 against ${pair.background} is below ${pair.min}:1 (${pair.criterion})`);
      }
    } catch (e) {
      issue(pair.foreground, (e as Error).message);
    }
  }

  for (const c of contract.constraints) {
    const t = tokens.get(c.token);
    if (!t) continue;
    const raw = c.property ? (t.value as Record<string, unknown>)?.[c.property] : t.value;
    const value = px(raw);
    const min = px(c.min);
    const max = px(c.max);
    if (value === undefined) issue(c.token, `cannot check constraint: unsupported value ${JSON.stringify(raw)}`);
    else if (min !== undefined && value < min) issue(c.token, `${value} is below the minimum ${min} (${c.reason})`);
    else if (max !== undefined && value > max) issue(c.token, `${value} is above the maximum ${max} (${c.reason})`);
  }

  return issues;
}

/** Loads a pack and checks every mode it declares. */
export async function checkDesignSystem(manifestPath: string): Promise<ContractIssue[]> {
  const [{ manifest, modes }, contract] = await Promise.all([loadDesignSystem(manifestPath), loadContract()]);
  const issues: ContractIssue[] = [];
  if (!modes.has(manifest.defaultMode)) issues.push({ token: "(manifest)", message: `defaultMode "${manifest.defaultMode}" is not a declared mode` });
  for (const [mode, tokens] of modes) issues.push(...checkContract(tokens, contract, mode));
  return issues;
}
