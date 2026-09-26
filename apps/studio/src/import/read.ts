/**
 * Reads a team's design tokens as they are: thousands of them, in three tiers (primitives,
 * semantic aliases, component tokens), of every type, in several modes. Nothing is mapped here;
 * this only builds a faithful graph of what the file says, plus what is wrong with it.
 *
 * Formats: Tokens Studio (sets at the top level, `$themes` and `$metadata`), W3C DTCG (`$value`,
 * `$type`, group-level types, `{alias}` references), and CSS custom properties.
 */
import { cssVars } from "@polyxd/ds-kit/css";

export type Tier = "primitive" | "semantic" | "component";
export type Format = "tokens-studio" | "dtcg" | "css";

export interface Token {
  /** Dotted path, without the set for Tokens Studio files (aliases there don't carry the set) */
  path: string;
  set: string;
  tier: Tier;
  /** The file's own type word, or null when it gave none */
  type: string | null;
  value: unknown;
  /** The path this token points at, when its value is a pure reference */
  alias: string | null;
  description: string;
  deprecated: boolean;
}

export interface Issue {
  kind: "broken-alias" | "circular-alias" | "deprecated" | "unsupported-type";
  path: string;
  message: string;
}

export interface Mode {
  name: string;
  /** Sets in lookup order: the mode's own first, then what it falls back to */
  sets: string[];
}

export interface Graph {
  format: Format;
  sets: string[];
  modes: Mode[];
  tokens: Token[];
  issues: Issue[];
}

const MODE_WORDS = /^(light|dark|dim|high[-_ ]?contrast|hc|contrast|compact|comfortable|dense|cozy|spacious|mobile|desktop)$/i;
const PRIMITIVE_SETS = /primitive|core|base|global|foundation|raw|palette|ref(erence)?s?$/i;
const SEMANTIC_SETS = /semantic|alias|theme|sys(tem)?$|brand/i;
const COMPONENT_SETS = /component|comp$/i;
const COMPONENT_WORDS = new Set([
  "button", "btn", "input", "textfield", "field", "select", "checkbox", "radio", "switch", "toggle", "slider", "card", "badge", "tag", "chip",
  "table", "datatable", "dialog", "modal", "drawer", "sheet", "tooltip", "popover", "menu", "dropdown", "tabs", "tab", "toast", "alert", "banner",
  "avatar", "link", "nav", "navbar", "sidebar", "header", "footer", "list", "listitem", "accordion", "progress", "spinner", "skeleton", "stepper",
  "pagination", "breadcrumb", "form", "label", "textarea", "combobox", "datepicker", "calendar", "divider", "icon", "tile", "kbd", "code",
]);

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** `{a.b.c}` (DTCG, Tokens Studio), `$a.b.c` (Style Dictionary) or `var(--a-b)` (CSS): the path it names. */
export function aliasOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  let m = v.match(/^\{([^{}]+)\}$/);
  if (m) return m[1].trim();
  m = v.match(/^\$([A-Za-z0-9_.-]+)$/);
  if (m) return m[1];
  m = v.match(/^var\(\s*--([A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)$/);
  if (m) return m[1];
  return null;
}

/** Whether a node in the tree is a token (has a value) rather than a group of tokens. */
function isTokenNode(node: Record<string, unknown>): boolean {
  if ("$value" in node) return true;
  if (!("value" in node)) return false;
  const v = node.value;
  // A group named "value" holding tokens is the one case this gets wrong; it's rare enough.
  return !(isObject(v) && Object.values(v).some((x) => isObject(x) && ("value" in x || "$value" in x)));
}

function tierOf(set: string, path: string, alias: string | null): Tier {
  if (COMPONENT_SETS.test(set)) return "component";
  if (PRIMITIVE_SETS.test(set)) return "primitive";
  if (SEMANTIC_SETS.test(set) || MODE_WORDS.test(set)) return "semantic";
  const head = path.split(".")[0].toLowerCase();
  if (COMPONENT_WORDS.has(head)) return "component";
  return alias ? "semantic" : "primitive";
}

function walk(node: Record<string, unknown>, at: string[], set: string, inherited: string | null, pathIncludesSet: boolean, out: Token[]) {
  const groupType = (node.$type ?? node.type) as string | undefined;
  const type = typeof groupType === "string" && !isTokenNode(node) ? groupType : inherited;
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !isObject(child)) continue;
    const here = [...at, key];
    if (isTokenNode(child)) {
      const value = "$value" in child ? child.$value : child.value;
      const own = (child.$type ?? child.type) as string | undefined;
      const description = String(child.$description ?? child.description ?? "");
      const path = (pathIncludesSet ? [set, ...here] : here).join(".");
      const alias = aliasOf(value);
      out.push({
        path,
        set,
        tier: tierOf(set, here.join("."), alias),
        type: typeof own === "string" ? own : type,
        value,
        alias,
        description,
        deprecated: child.$deprecated === true || child.deprecated === true || /\bdeprecated\b/i.test(description),
      });
    } else {
      walk(child, here, set, type, pathIncludesSet, out);
    }
  }
}

/** Tokens Studio's `$themes`: which sets each theme turns on, in the order the file lists them. */
function themesToModes(themes: unknown, sets: string[]): Mode[] {
  if (!Array.isArray(themes)) return [];
  const modes: Mode[] = [];
  for (const t of themes) {
    if (!isObject(t) || typeof t.name !== "string") continue;
    const selected = isObject(t.selectedTokenSets) ? t.selectedTokenSets : {};
    const on = sets.filter((s) => selected[s] === "enabled" || selected[s] === "source");
    // The theme's own sets first, so a value it defines wins over the base it draws from.
    const own = on.filter((s) => selected[s] === "enabled");
    const base = on.filter((s) => selected[s] === "source");
    const name = typeof t.group === "string" && t.group ? `${t.group} / ${t.name}` : t.name;
    modes.push({ name, sets: [...own, ...base] });
  }
  return modes;
}

/** Sets named like modes become modes; everything else is what every mode falls back to. */
function setsToModes(sets: string[]): Mode[] {
  const modeSets = sets.filter((s) => MODE_WORDS.test(s));
  const base = sets.filter((s) => !MODE_WORDS.test(s));
  if (!modeSets.length) return [{ name: "default", sets }];
  return modeSets.map((s) => ({ name: s, sets: [s, ...base] }));
}

export function readJson(text: string): Graph {
  const doc = JSON.parse(text);
  if (!isObject(doc)) throw new Error("The file's top level isn't an object of tokens");
  const meta = "$themes" in doc || "$metadata" in doc;
  const format: Format = meta ? "tokens-studio" : "dtcg";
  const sets = Object.keys(doc).filter((k) => !k.startsWith("$") && isObject(doc[k]));
  const tokens: Token[] = [];
  // A DTCG file is one tree, and its aliases include the top-level group; a Tokens Studio file is
  // several sets, and its aliases don't.
  const pathIncludesSet = format === "dtcg";
  for (const set of sets) walk(doc[set] as Record<string, unknown>, [], set, null, pathIncludesSet, tokens);
  // A DTCG file whose top level is tokens rather than groups.
  if (format === "dtcg" && !sets.length) walk(doc, [], "tokens", null, false, tokens);
  const modes = format === "tokens-studio" ? themesToModes(doc.$themes, sets) : [];
  return finish({ format, sets: sets.length ? sets : ["tokens"], modes: modes.length ? modes : setsToModes(sets), tokens, issues: [] });
}

export function readCss(text: string): Graph {
  const root = (sel: string, at?: string) => !at?.startsWith("@supports") && /:root|:host|^html\b|^body\b/.test(sel) && !/dark|contrast/i.test(sel) && !/prefers-color-scheme/.test(at ?? "");
  const dark = (sel: string, at?: string) => !at?.startsWith("@supports") && (/dark/i.test(sel) || /prefers-color-scheme:\s*dark/.test(at ?? ""));
  const tokens: Token[] = [];
  const add = (vars: Record<string, string>, set: string) => {
    for (const [name, value] of Object.entries(vars)) {
      const alias = aliasOf(value);
      const path = name.replace(/^--/, "").replace(/-/g, ".");
      tokens.push({ path, set, tier: tierOf(set, path, alias), type: null, value, alias: alias ? alias.replace(/-/g, ".") : null, description: "", deprecated: false });
    }
  };
  // ds-kit's reader wants every declaration terminated; a last one before `}` often isn't.
  const css = text.replace(/([^;\s{}])\s*}/g, "$1;}");
  const light = cssVars(css, root);
  const darkVars = cssVars(css, dark);
  add(light, "light");
  if (Object.keys(darkVars).length) add(darkVars, "dark");
  const sets = Object.keys(darkVars).length ? ["light", "dark"] : ["light"];
  const modes = sets.map((s) => ({ name: s, sets: s === "dark" ? ["dark", "light"] : ["light"] }));
  return finish({ format: "css", sets, modes, tokens, issues: [] });
}

/** Picks the reader from the file's name and first bytes. */
export function read(text: string, fileName = ""): Graph {
  if (/\.css$/i.test(fileName) || (!/\.json$/i.test(fileName) && /--[a-z0-9-]+\s*:/i.test(text) && !text.trimStart().startsWith("{"))) return readCss(text);
  return readJson(text);
}

/** Alias checks and the deprecated count, once the tokens are in. */
function finish(graph: Graph): Graph {
  const { tokens, issues } = graph;
  const byPath = index(graph);
  for (const t of tokens) {
    if (t.deprecated) issues.push({ kind: "deprecated", path: t.path, message: `${t.path} is marked deprecated` });
    if (typeof t.type === "string" && /^(asset|gradient|composition|url)$/i.test(t.type)) {
      issues.push({ kind: "unsupported-type", path: t.path, message: `${t.path} is a ${t.type}; kept, not mapped` });
    }
    if (!t.alias) continue;
    const seen = new Set<string>([t.path]);
    let cur: Token | undefined = t;
    while (cur?.alias) {
      if (seen.has(cur.alias)) {
        issues.push({ kind: "circular-alias", path: t.path, message: `${[...seen, cur.alias].join(" → ")}` });
        break;
      }
      seen.add(cur.alias);
      const next: Token | undefined = byPath.get(cur.alias)?.[0];
      if (!next) {
        issues.push({ kind: "broken-alias", path: t.path, message: `${t.path} points at ${cur.alias}, which doesn't exist` });
        break;
      }
      cur = next;
    }
  }
  return graph;
}

export function index(graph: Graph): Map<string, Token[]> {
  const m = new Map<string, Token[]>();
  for (const t of graph.tokens) m.set(t.path, [...(m.get(t.path) ?? []), t]);
  return m;
}

export interface Resolved {
  value: unknown;
  /** Every path from the token asked for down to the one that holds a value */
  chain: string[];
  /** The token that holds the value, or undefined when the chain broke */
  leaf?: Token;
}

/** Follows aliases in a mode: a value defined in the mode's own set wins over the base's. */
export function resolve(graph: Graph, path: string, mode?: Mode, byPath = index(graph)): Resolved {
  const order = mode?.sets ?? graph.sets;
  const pick = (p: string): Token | undefined => {
    const options = byPath.get(p);
    if (!options) return undefined;
    for (const set of order) {
      const hit = options.find((t) => t.set === set);
      if (hit) return hit;
    }
    return options[0];
  };
  const chain: string[] = [];
  let cur = pick(path);
  for (let i = 0; cur && i < 16; i++) {
    chain.push(cur.path);
    if (!cur.alias) return { value: cur.value, chain, leaf: cur };
    if (chain.includes(cur.alias)) break;
    cur = pick(cur.alias);
  }
  return { value: undefined, chain };
}
