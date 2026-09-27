/**
 * A design-system pack (the shape every packages/ds-* pack has: a manifest naming DTCG token files
 * per mode) as Studio's token graph. Each file is a set; a mode's lookup order is its files in
 * reverse, since a later file overrides an earlier one when the pack is loaded. The semantic file
 * is the semantic tier, named exactly like Polyxd's roles; everything else is the pack's own
 * primitives, named the way the pack names them.
 */
import { finish, readTree, type Graph, type Mode, type Token } from "../import/read.ts";

export interface PackInput {
  name: string;
  modes: Record<string, string[]>;
  defaultMode: string;
  /** Each token file's parsed JSON, by the path the manifest names it with. */
  files: Record<string, Record<string, unknown>>;
}

/** `tokens/system.light.json` → `system.light`: the set a file becomes. */
export const setOf = (file: string) => file.replace(/^.*\//, "").replace(/\.json$/i, "");

const isSemantic = (file: string) => /semantic/i.test(setOf(file));

export function packGraph(pack: PackInput): Graph {
  const tokens: Token[] = [];
  const sets: string[] = [];
  const modeFiles = Object.values(pack.modes).flat();
  const files = [...new Set(modeFiles)];
  // The semantic file first, so a role's own token is the first candidate the mapper sees.
  files.sort((a, b) => Number(isSemantic(b)) - Number(isSemantic(a)));
  for (const file of files) {
    const tree = pack.files[file];
    if (!tree) throw new Error(`${pack.name}: the manifest names ${file}, which isn't in the pack`);
    const set = setOf(file);
    sets.push(set);
    tokens.push(...readTree(tree, set, isSemantic(file) ? "semantic" : "primitive"));
  }
  const modes: Mode[] = Object.entries(pack.modes).map(([name, list]) => ({ name, sets: [...list].reverse().map(setOf) }));
  // The default mode first: it is the one the mapper measures chains in and the export leads with.
  modes.sort((a, b) => Number(b.name === pack.defaultMode) - Number(a.name === pack.defaultMode));
  return finish({ format: "dtcg", sets, modes, tokens, issues: [] });
}
