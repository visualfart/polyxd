/**
 * Editing a token graph: a change sets one token's value (in one set), and the graph's alias
 * checks run again. A value that is a `{reference}` becomes an alias; a literal stops being one.
 * Every alias that resolves through the token changes with it, since resolution follows the
 * graph at read time; nothing else in the graph is touched.
 */
import { aliasOf, finish, type Graph, type Token } from "../import/read.ts";
import type { Change } from "./ramp.ts";

export type { Change };

const MAX_CHANGES = 5000;
const MAX_VALUE = 4000;

/** Checks a request's changes are the shape this applies: a path and a set that exist, and a JSON value of sane size. */
export function checkChanges(raw: unknown, graph: Graph): Change[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error("changes: a list of { path, set, value }");
  if (raw.length > MAX_CHANGES) throw new Error(`Up to ${MAX_CHANGES} changes at a time`);
  const have = new Set(graph.tokens.map((t) => `${t.set}\u0000${t.path}`));
  return raw.map((c, i) => {
    if (!c || typeof c !== "object") throw new Error(`changes[${i}]: an object with path, set and value`);
    const { path, set, value } = c as Record<string, unknown>;
    if (typeof path !== "string" || typeof set !== "string") throw new Error(`changes[${i}]: path and set are strings`);
    if (!have.has(`${set}\u0000${path}`)) throw new Error(`${path} isn't a token in the set ${set}`);
    if (value === undefined || JSON.stringify(value).length > MAX_VALUE) throw new Error(`changes[${i}]: a value, of up to ${MAX_VALUE} characters`);
    return { path, set, value };
  });
}

/** A new graph with the changes applied and its issues recomputed. Tokens keep their order. */
export function applyChanges(graph: Graph, changes: Change[]): Graph {
  const by = new Map(changes.map((c) => [`${c.set}\u0000${c.path}`, c.value]));
  const tokens: Token[] = graph.tokens.map((t) => {
    const key = `${t.set}\u0000${t.path}`;
    if (!by.has(key)) return t;
    const value = by.get(key);
    return { ...t, value, alias: aliasOf(value) };
  });
  return finish({ ...graph, tokens, issues: [] });
}
