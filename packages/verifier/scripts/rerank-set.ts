/**
 * Builds a re-ranking set: groups the designer has already ranked, shown again under fresh letters.
 *
 *   npm run rerank -w @polyxd/verifier            six groups, drawn across every archived round
 *   npm run rerank -w @polyxd/verifier -- --n 8   a different number
 *   npm run rerank -w @polyxd/verifier -- --score compare the new ranking to the archived one
 *
 * This measures the one thing nobody has measured: whether the designer agrees with himself. A
 * model judge agrees with another model judge at tau 0.71 and with the designer at 0.10, which
 * either means taste is specific and worth learning, or means the ranking is noise. The difference
 * is the designer's own test-retest agreement, and preference training should not be built on the
 * rankings until it is known.
 *
 * The documents are the same files, copied under shuffled letters so the earlier answer can't be
 * pattern-matched from position. The mapping back is kept out of bench/rank-set.
 */
import { copyFile, mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { kendallTauB } from "./gold-agreement.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const RANKINGS = join(REPO, "bench/rankings");
const SET = join(REPO, "bench/rank-set");
const KEY = join(RANKINGS, "rerank-key.json");

interface Group {
  id: string;
  request: string;
  variants: string[];
  humanRank: string[] | null;
  comment?: string;
  notes?: Record<string, string>;
}

/** Every finished round, newest last. */
async function archives(): Promise<{ dir: string; groups: Group[] }[]> {
  if (!existsSync(RANKINGS)) return [];
  const dirs = (await readdir(RANKINGS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => join(RANKINGS, d.name));
  const out = [];
  for (const dir of dirs.sort()) {
    const file = join(dir, "ranking.json");
    if (!existsSync(file)) continue;
    const parsed = JSON.parse(await readFile(file, "utf8"));
    out.push({ dir, groups: (parsed.groups as Group[]).filter((g) => g.humanRank?.length) });
  }
  return out;
}

/** Archives whatever is in bench/rank-set, the way rank_set.py does, before replacing it. */
async function archiveCurrent(): Promise<void> {
  const file = join(SET, "ranking.json");
  if (!existsSync(file)) return;
  const done = JSON.parse(await readFile(file, "utf8"));
  if (!done.groups?.some((g: Group) => g.humanRank?.length)) return;
  const label = String(done.model ?? "model").split("+").pop()!.replace(/\//g, "-");
  // Two rounds from the same adapter on the same day would land on the same name, and the second
  // would overwrite the first. The rankings are the only thing here that can't be regenerated.
  const base = join(RANKINGS, `${done.generatedAt ?? new Date().toISOString().slice(0, 10)}-${label}`);
  let dir = base;
  for (let n = 2; existsSync(join(dir, "ranking.json")); n++) dir = `${base}-${n}`;
  await mkdir(dir, { recursive: true });
  for (const f of (await readdir(SET)).filter((f) => f.endsWith(".json"))) await copyFile(join(SET, f), join(dir, f));
  console.log(`archived the finished ranking to ${dir.replace(REPO, "")}`);
}

const shuffle = <T>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

async function build(n: number): Promise<void> {
  const rounds = await archives();
  const all = rounds.flatMap((r) => r.groups.map((g) => ({ ...g, dir: r.dir })));
  if (!all.length) throw new Error("no archived rankings to draw from");
  await archiveCurrent();

  // Spread the draw across rounds rather than taking the most recent, so recall isn't the variable.
  const picked = shuffle(all).slice(0, Math.min(n, all.length));
  for (const f of (await readdir(SET)).filter((f) => f.endsWith(".json"))) await rm(join(SET, f));

  const key: { id: string; letters: Record<string, string>; earlier: string[] }[] = [];
  const groups = [];
  for (const g of picked) {
    const letters: Record<string, string> = {};
    const variants: string[] = [];
    for (const [i, original] of shuffle(g.variants).entries()) {
      const letter = "abc"[i];
      const name = `${g.id}-${letter}`;
      letters[name] = original;
      variants.push(name);
      await copyFile(join(g.dir, `${original}.json`), join(SET, `${name}.json`));
    }
    key.push({ id: g.id, letters, earlier: g.humanRank! });
    groups.push({ id: g.id, request: g.request, variants, humanRank: null });
  }

  await writeFile(
    join(SET, "ranking.json"),
    JSON.stringify(
      {
        $comment: "A re-rank of groups already ranked, under fresh letters. Measures the designer's agreement with himself.",
        rater: "",
        model: "re-rank",
        generatedAt: new Date().toISOString().slice(0, 10),
        groups,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(KEY, JSON.stringify(key, null, 1) + "\n");
  console.log(`${groups.length} groups to re-rank → bench/rank-set`);
  console.log(`rank them at http://localhost:5173/?rank&set=model, then: npm run rerank -w @polyxd/verifier -- --score`);
}

async function score(): Promise<void> {
  const key: { id: string; letters: Record<string, string>; earlier: string[] }[] = JSON.parse(await readFile(KEY, "utf8"));
  const now = JSON.parse(await readFile(join(SET, "ranking.json"), "utf8"));
  let sum = 0, exact = 0, top = 0, n = 0;
  for (const k of key) {
    const g = now.groups.find((x: Group) => x.id === k.id);
    if (!g?.humanRank?.length) continue;
    // Map this round's letters back to the documents they actually are.
    const again = g.humanRank.map((name: string) => k.letters[name] ?? name);
    const before = new Map(k.earlier.map((v, i) => [v, i]));
    const after = new Map(again.map((v: string, i: number) => [v, i]));
    const tau = kendallTauB(before, after);
    sum += tau;
    n++;
    if (again.every((v: string, i: number) => v === k.earlier[i])) exact++;
    if (again[0] === k.earlier[0]) top++;
    const strip = (v: string) => v.slice(k.id.length + 1);
    console.log(`  ${k.id.padEnd(24)} before ${k.earlier.map(strip).join(">")}   again ${again.map(strip).join(">")}   tau ${tau.toFixed(2)}`);
  }
  if (!n) return console.log("no re-ranked groups yet");
  console.log(`\n${n} groups · the designer agrees with himself: tau ${(sum / n).toFixed(2)} · exact ${((exact / n) * 100).toFixed(0)}% · same top pick ${((top / n) * 100).toFixed(0)}%`);
  console.log(`For comparison: two model judges agree with each other at 0.71, and with the designer at 0.10–0.16. Chance is 0.00 / 17% / 33%.`);
}

const args = process.argv.slice(2);
const n = Number(args[args.indexOf("--n") + 1]) || 6;
await (args.includes("--score") ? score() : build(n));
