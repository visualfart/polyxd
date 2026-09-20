/**
 * Runs every workspace's tests and fails if any of them failed.
 *
 *   npm run test:all
 *
 * `npm run test --workspaces` prints one summary per workspace and exits 0 when a later
 * workspace passes, so a failure four workspaces up scrolls past and the last thing on screen is
 * "fail 0". This ran green for a while with four broken tests. It reads every summary instead.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const run = spawnSync("npm", ["run", "test", "--workspaces", "--if-present"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
process.stdout.write(output);

const summaries = [...output.matchAll(/^ℹ (tests|pass|fail) (\d+)$/gm)];
const total = (kind: string) => summaries.filter(([, k]) => k === kind).reduce((n, [, , v]) => n + Number(v), 0);
const failed = total("fail");
console.log(`\n${total("tests")} tests across ${summaries.filter(([, k]) => k === "tests").length} workspaces · ${total("pass")} passed · ${failed} failed`);

if (failed || run.status !== 0) {
  for (const line of output.split("\n")) if (/^✖ /.test(line)) console.log(`  ${line}`);
  process.exit(1);
}
