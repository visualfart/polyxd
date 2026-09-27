/**
 * Renders the film from the captured assets:
 *   1. transcodes each assets/*.webm to H.264 (Remotion decodes MP4 reliably; WebM from Playwright less so),
 *   2. writes captions.srt from src/script.ts,
 *   3. renders out/polyxd-launch.mp4 (1920×1080) and out/polyxd-launch-square.mp4 (1080×1080), H.264, yuv420p, CRF 18,
 *   4. writes out/poster.png and eight frames across the timeline into out/frames/ to check by eye.
 *
 *   node scripts/render.ts [--wide | --square | --frames-only]
 */
import { execFileSync } from "node:child_process";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DURATION, srt } from "../src/script.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const FFMPEG = process.env.FFMPEG ?? "/opt/homebrew/bin/ffmpeg";
const args = new Set(process.argv.slice(2));
const run = (cmd: string, a: string[]) => execFileSync(cmd, a, { cwd: root, stdio: "inherit" });

const newer = async (a: string, b: string) => {
  try {
    const [sa, sb] = await Promise.all([stat(a), stat(b)]);
    return sa.mtimeMs > sb.mtimeMs;
  } catch {
    return true;
  }
};

await mkdir(`${root}out/frames`, { recursive: true });

if (!args.has("--frames-only")) {
  for (const f of await readdir(`${root}assets`)) {
    if (!f.endsWith(".webm")) continue;
    const src = `${root}assets/${f}`;
    const dst = src.replace(/\.webm$/, ".mp4");
    if (!(await newer(src, dst))) continue;
    console.log(`transcode ${f}`);
    run(FFMPEG, ["-v", "error", "-y", "-i", src, "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", dst]);
  }
  await writeFile(`${root}captions.srt`, srt());
  console.log("wrote captions.srt");

  const remotion = ["remotion", "render", "src/index.ts"];
  const common = ["--codec", "h264", "--crf", "18", "--pixel-format", "yuv420p", "--color-space", "bt709", "--overwrite", "--log", "warn"];
  if (!args.has("--square")) run("npx", [...remotion, "Launch", "out/polyxd-launch.mp4", ...common]);
  if (!args.has("--wide")) run("npx", [...remotion, "LaunchSquare", "out/polyxd-launch-square.mp4", ...common]);
  if (!args.has("--square")) run("npx", ["remotion", "still", "src/index.ts", "Launch", "out/poster.png", "--frame", String(9 * 30), "--overwrite", "--log", "warn"]);
}

// Eight frames across the timeline, one per act and the two ends.
const stamps = [2.8, 8.5, 17, 25.5, 30.5, 41.5, 47.5, 61];
for (const t of stamps) {
  run(FFMPEG, ["-v", "error", "-y", "-ss", String(t), "-i", "out/polyxd-launch.mp4", "-frames:v", "1", `out/frames/${t.toFixed(1).padStart(5, "0")}s.png`]);
}
console.log(`wrote ${stamps.length} frames to out/frames/ (film is ${DURATION}s)`);
