/**
 * Puts a representative data snapshot into each intent document (`document.data`), built from the
 * product's seed through the same views the product uses at runtime, so the verifier checks the
 * bindings against the shape the surface will really get. Run before `verify`.
 *
 *   node scripts/snapshot.ts [halden] [intent]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";

const here = new URL("../", import.meta.url);
const [only, onlyIntent] = process.argv.slice(2);

const products: Record<string, () => Promise<{ seed: () => unknown; surfaceData: (h: any, intent: any, slots: Record<string, unknown>) => Record<string, unknown> }>> = {
  halden: async () => ({ seed: (await import("../halden/seed.ts")).seed, surfaceData: (await import("../halden/views.ts")).surfaceData }),
  foundry: async () => ({ seed: (await import("../foundry/seed.ts")).seed, surfaceData: (await import("../foundry/views.ts")).surfaceData }),
  wexley: async () => ({ seed: (await import("../wexley/seed.ts")).seed, surfaceData: (await import("../wexley/views.ts")).surfaceData }),
};

for (const [name, load] of Object.entries(products)) {
  if (only && only !== name) continue;
  const { seed, surfaceData } = await load();
  const dir = new URL(`${name}/intents/`, here);
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json") && (!onlyIntent || f === `${onlyIntent}.json`)).sort()) {
    const path = new URL(file, dir);
    const intent = JSON.parse(await readFile(path, "utf8"));
    intent.document.data = surfaceData(seed(), intent, intent.sample ?? {});
    await writeFile(path, JSON.stringify(intent, null, 2) + "\n");
    console.log(`${name}/${file}: data keys ${Object.keys(intent.document.data).join(", ")}`);
  }
}
