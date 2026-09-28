/**
 * Writes only the app icons (brand/icon-<size>.png) from the mark, without the rest of
 * `node brand/build.ts` (which also rewrites the social image with web fonts). With --check it
 * writes nothing and fails when an icon on disk isn't what the mark renders to today.
 *
 *   node brand/icons.ts            write every size
 *   node brand/icons.ts --check    compare instead
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ICON_SIZES, INK, iconTile, mark } from "./build.ts";

const dir = fileURLToPath(new URL("./", import.meta.url));
const check = process.argv.includes("--check");
const { launch } = await import("@polyxd/verifier");
const browser = await launch();
const stale: string[] = [];
try {
  for (const size of ICON_SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(iconTile(INK, mark(), size), { waitUntil: "networkidle" });
    const png = await page.screenshot({ omitBackground: true });
    await page.close();
    const file = `${dir}icon-${size}.png`;
    if (!check) {
      await writeFile(file, png);
      console.log(`wrote brand/icon-${size}.png`);
    } else if (!png.equals(await readFile(file).catch(() => Buffer.alloc(0)))) stale.push(`icon-${size}.png`);
  }
} finally {
  await browser.close();
}
if (stale.length) {
  console.error(`not what the mark renders to: ${stale.join(", ")} (node brand/icons.ts)`);
  process.exit(1);
}
if (check) console.log(`${ICON_SIZES.length} icons match the mark`);
