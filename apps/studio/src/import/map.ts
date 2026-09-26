/**
 * Which of a team's tokens each Polyxd role reads. Studio guesses from the semantic tier (a role
 * that points straight at a primitive skips a rebrand), a person accepts or corrects each guess,
 * and every pair the contract says must contrast is measured in every mode.
 */
import { inferMapping } from "@polyxd/ds-kit/infer";
import { contrastRatio } from "@polyxd/spec/color";
import { index, resolve, type Graph, type Mode, type Token } from "./read.ts";

export interface Contract {
  tokens: Record<string, { type: string; description: string }>;
  contrast: { foreground: string; background: string; min: number; criterion: string }[];
}

export type RoleStatus = "exact" | "guessed" | "missing" | "fails" | "primitive" | "off";

export interface ContrastResult {
  against: string;
  mode: string;
  ratio: number;
  min: number;
  passes: boolean;
}

export interface RoleRow {
  role: string;
  type: string;
  description: string;
  /** The team's token this role reads, or null */
  token: string | null;
  /** The alias chain from that token down to the primitive that holds the value */
  chain: string[];
  values: Record<string, string | null>;
  how: "named" | "measured" | "derived" | "manual" | "none";
  why: string;
  status: RoleStatus;
  contrast: ContrastResult[];
}

export interface Override {
  role: string;
  /** null: leave this role unmapped on purpose */
  token: string | null;
}

/** A value as text the mapper and the renderer can use; composites (typography objects) are not. */
export function scalar(v: unknown): string | null {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

/** `color.brand.600` as the kind of name ds-kit's patterns know: `color-brand-600`. */
const asVar = (path: string) => path.replace(/[./]/g, "-").toLowerCase();

export function mapRoles(graph: Graph, contract: Contract, overrides: Override[] = []): RoleRow[] {
  const byPath = index(graph);
  const modes = graph.modes.length ? graph.modes : [{ name: "default", sets: graph.sets }];
  const first = modes[0];
  // The semantic tier is what roles should read. A file with no real semantic tier (a flat
  // palette, a CSS file) falls back to everything that isn't a component token.
  const semantic = graph.tokens.filter((t) => t.tier === "semantic" && !t.deprecated);
  const primitives = graph.tokens.filter((t) => t.tier === "primitive" && !t.deprecated);
  // Semantic tokens first, so a name that matches in both tiers lands on the semantic one; the
  // primitives only fill in when the file has no real semantic tier.
  const candidates = semantic.length >= 5 ? semantic : [...semantic, ...primitives];
  const vars: Record<string, string> = {};
  const pathOfVar = new Map<string, string>();
  for (const t of candidates) {
    const v = scalar(resolve(graph, t.path, first, byPath).value);
    if (v === null) continue;
    // A token called bg.default is what ds-kit's patterns know as background-default.
    const names = [asVar(t.path), asVar(t.path).replace(/^bg-/, "background-").replace(/-bg$/, "-background").replace(/^fg-/, "foreground-")];
    for (const name of new Set(names)) {
      if (!(name in vars)) {
        vars[name] = v;
        pathOfVar.set(name, t.path);
      }
    }
  }
  const { guesses } = inferMapping(vars);
  const guessed = new Map(guesses.map((g) => [g.token, g]));
  // A team whose semantic token is named like the role itself (radius.control, color.text.muted)
  // has said what it is more plainly than any pattern can; ds-kit's patterns don't cover that.
  const isColor = (v: string) => /^(#|rgb|hsl|oklch|oklab|color\()/i.test(v);
  for (const [role, spec] of Object.entries(contract.tokens)) {
    if (guessed.has(role)) continue;
    const full = asVar(role);
    const short = full.split("-").slice(1).join("-");
    const hit = Object.keys(vars).find((n) => (n === full || n === short || n.endsWith(`-${short}`)) && (spec.type === "color") === isColor(vars[n]));
    if (hit) guessed.set(role, { token: role, from: hit, why: `"${pathOfVar.get(hit)}" is named like the role`, how: "named" });
  }
  const over = new Map(overrides.map((o) => [o.role, o]));

  const rows: RoleRow[] = [];
  for (const [role, spec] of Object.entries(contract.tokens)) {
    const o = over.get(role);
    const g = guessed.get(role);
    let token: string | null = null;
    let how: RoleRow["how"] = "none";
    let why = "No token matched by name or by value";
    if (o) {
      token = o.token;
      how = "manual";
      why = o.token ? "Chosen by your team" : "Left unmapped by your team";
    } else if (g?.from) {
      token = pathOfVar.get(g.from) ?? null;
      how = g.how === "default" ? "none" : g.how;
      why = g.why;
    }
    const values: Record<string, string | null> = {};
    let chain: string[] = [];
    let leaf: Token | undefined;
    if (token) {
      for (const m of modes) {
        const r = resolve(graph, token, m, byPath);
        values[m.name] = scalar(r.value);
        if (m === first) {
          chain = r.chain;
          leaf = r.leaf;
        }
      }
    }
    let status: RoleStatus = !token ? (o ? "off" : "missing") : how === "named" || how === "manual" ? "exact" : "guessed";
    if (token && byPath.get(token)?.[0]?.tier === "primitive" && semantic.length >= 5) status = "primitive";
    rows.push({ role, type: spec.type, description: spec.description, token, chain, values, how, why, status, contrast: [] });
  }

  // Contrast, measured, in every mode. A failing pair marks the foreground role.
  const byRole = new Map(rows.map((r) => [r.role, r]));
  for (const pair of contract.contrast) {
    const fg = byRole.get(pair.foreground);
    const bg = byRole.get(pair.background);
    if (!fg?.token || !bg?.token) continue;
    for (const m of modes) {
      const a = fg.values[m.name];
      const b = bg.values[m.name];
      if (!a || !b) continue;
      try {
        const ratio = contrastRatio(a, b);
        const passes = ratio >= pair.min;
        fg.contrast.push({ against: pair.background, mode: m.name, ratio: Math.round(ratio * 10) / 10, min: pair.min, passes });
        if (!passes && fg.status !== "off") fg.status = "fails";
      } catch {
        // Not a colour this can measure (a gradient, a var() that never resolved): the row says so
        // through its value, and the pair is simply not reported.
      }
    }
  }
  return rows;
}

export interface Candidate {
  token: string;
  chain: string[];
  value: string | null;
  tier: Token["tier"];
  /** Contrast against the role's contract backgrounds, in the first mode, when the role is a colour */
  contrast: ContrastResult[];
}

/** Tokens a person could point a role at instead, best first: same type, semantic tier, name similarity. */
export function candidatesFor(graph: Graph, contract: Contract, rows: RoleRow[], role: string, query = "", limit = 12): Candidate[] {
  const byPath = index(graph);
  const first = graph.modes[0] ?? { name: "default", sets: graph.sets };
  const spec = contract.tokens[role];
  const q = query.trim().toLowerCase();
  const words = role.split(".").slice(1);
  const byRole = new Map(rows.map((r) => [r.role, r]));
  const pairs = contract.contrast.filter((p) => p.foreground === role);
  const scored: { c: Candidate; score: number }[] = [];
  for (const t of graph.tokens) {
    if (t.deprecated || t.tier === "component") continue;
    if (q && !t.path.toLowerCase().includes(q)) continue;
    const r = resolve(graph, t.path, first, byPath);
    const value = scalar(r.value);
    if (value === null) continue;
    const isColor = /^(#|rgb|hsl|oklch)/i.test(value);
    if (spec?.type === "color" && !isColor) continue;
    if (spec?.type !== "color" && isColor) continue;
    let score = t.tier === "semantic" ? 2 : 0;
    for (const w of words) if (t.path.toLowerCase().includes(w.toLowerCase())) score += 1;
    const contrast: ContrastResult[] = [];
    for (const p of pairs) {
      const bg = byRole.get(p.background)?.values[first.name];
      if (!bg) continue;
      try {
        const ratio = contrastRatio(value, bg);
        contrast.push({ against: p.background, mode: first.name, ratio: Math.round(ratio * 10) / 10, min: p.min, passes: ratio >= p.min });
        if (ratio >= p.min) score += 2;
      } catch {
        // unmeasurable value; no penalty, no credit
      }
    }
    scored.push({ c: { token: t.path, chain: r.chain, value, tier: t.tier, contrast }, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.c.token.localeCompare(b.c.token)).slice(0, limit).map((s) => s.c);
}
