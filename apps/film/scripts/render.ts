/**
 * Renders the film from the captured assets and the synthesised sound:
 *   1. writes captions.srt from src/script.ts (every line on screen, with its timing),
 *   2. renders out/polyxd-launch.mp4 (1920×1080) and out/polyxd-launch-square.mp4 (1080×1080),
 *      H.264, yuv420p, CRF 18, AAC 192 kbps,
 *   3. writes out/mix.wav (the mixed music and sound design alone) and out/poster.png,
 *   4. extracts twelve frames across the timeline into out/frames/ to check by eye, and a 10 s
 *      excerpt of the mix around the pulse's entry with its astats, to check by ear and by meter.
 *
 *   node scripts/render.ts [--wide | --square | --frames-only]
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DURATION, srt } from "../src/script.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const FFMPEG = process.env.FFMPEG ?? "/opt/homebrew/bin/ffmpeg";
const args = new Set(process.argv.slice(2));
const run = (cmd: string, a: string[]) => execFileSync(cmd, a, { cwd: root, stdio: "inherit" });

await mkdir(`${root}out/frames`, { recursive: true });

if (!args.has("--frames-only")) {
  await writeFile(`${root}captions.srt`, srt());
  console.log("wrote captions.srt");

  const remotion = ["remotion", "render", "src/index.ts"];
  const video = ["--codec", "h264", "--crf", "18", "--pixel-format", "yuv420p", "--color-space", "bt709", "--audio-codec", "aac", "--audio-bitrate", "192K", "--overwrite", "--log", "warn"];
  if (!args.has("--square")) {
    run("npx", [...remotion, "Launch", "out/polyxd-launch.mp4", ...video]);
    run("npx", [...remotion, "Launch", "out/mix.wav", "--codec", "wav", "--overwrite", "--log", "warn"]);
    run("npx", ["remotion", "still", "src/index.ts", "Launch", "out/poster.png", "--frame", String(17 * 30), "--overwrite", "--log", "warn"]);
  }
  if (!args.has("--wide")) run("npx", [...remotion, "LaunchSquare", "out/polyxd-launch-square.mp4", ...video]);
}

// Twelve frames across the timeline: the hook, the line, the mark, the pencil, the unfold, a pack, the
// scan, the grid, the split frame, the frame draw, the montage, the close.
const stamps = [1.0, 6.5, 10.5, 12.8, 20.0, 27.9, 31.4, 34.6, 42.4, 58.6, 65.0, 80.0];
for (const t of stamps) {
  run(FFMPEG, ["-v", "error", "-y", "-ss", String(t), "-i", "out/polyxd-launch.mp4", "-frames:v", "1", `out/frames/${t.toFixed(1).padStart(5, "0")}s.png`]);
}
console.log(`wrote ${stamps.length} frames to out/frames/ (film is ${DURATION}s)`);

// The listen check: ten seconds around the pulse's entry at 0:07, and its levels.
run(FFMPEG, ["-v", "error", "-y", "-ss", "7", "-t", "10", "-i", "out/mix.wav", "out/frames/mix-7-17s.wav"]);
run(FFMPEG, ["-hide_banner", "-i", "out/frames/mix-7-17s.wav", "-af", "astats=measure_overall=Peak_level+RMS_level+RMS_peak:measure_perchannel=0", "-f", "null", "-"]);
