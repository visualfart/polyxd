/**
 * Renders single frames of the film straight from the composition, bundling once, to check a scene
 * by eye without a full render:
 *   node scripts/stills.ts 12.5 19.2 24 [--square]      seconds → out/check/<seconds>s.png
 */
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const square = args.includes("--square");
const seconds = args.filter((a) => !a.startsWith("--")).map(Number);
const id = square ? "LaunchSquare" : "Launch";

await mkdir(`${root}out/check`, { recursive: true });
const serveUrl = await bundle({ entryPoint: `${root}src/index.ts`, publicDir: `${root}assets`, onProgress: () => {} });
const composition = await selectComposition({ serveUrl, id, inputProps: {} });
for (const t of seconds) {
  const out = `${root}out/check/${square ? "sq-" : ""}${t.toFixed(2).padStart(6, "0")}s.png`;
  await renderStill({ composition, serveUrl, output: out, frame: Math.round(t * 30), imageFormat: "png", logLevel: "warn", chromiumOptions: { gl: "angle" } });
  console.log(`wrote ${out.replace(root, "")}`);
}
