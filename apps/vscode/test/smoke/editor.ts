/**
 * The built extension in a real VS Code: @vscode/test-electron downloads the current stable
 * release into .vscode-test/ (once, about 300 MB), opens a copy of Halden's screens and intents
 * with only this extension loaded, and runs editor-suite.cjs inside it. That suite checks the
 * bundled schema reaches inside intent files (and doesn't call them broken), waits for the static
 * check's diagnostics, opens the preview and waits for the webview to say it rendered, and fails
 * if the page reported anything its content-security policy blocked or that threw. It is how the
 * policy without 'unsafe-eval' is known to hold in the editor itself.
 *
 *   node --test test/smoke/editor.ts          (build first: npm run build -w polyxd-vscode)
 *
 * Set POLYXD_SKIP_EDITOR=1 to skip it, e.g. on a machine without a display.
 */
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";

const here = fileURLToPath(new URL("../../", import.meta.url));
const halden = join(here, "../demos/halden");
const skip = process.env.POLYXD_SKIP_EDITOR ? "POLYXD_SKIP_EDITOR is set" : !existsSync(join(here, "dist/extension.cjs")) && "dist/extension.cjs isn't built";

test("the built extension checks and previews a document in VS Code, under the webview's policy", { skip, timeout: 15 * 60_000 }, async () => {
  // A copy of Halden's screens and intents, so the suite can add a broken file beside them.
  const root = await mkdtemp(join(tmpdir(), "polyxd-vscode-smoke-"));
  const workspace = join(root, "halden");
  for (const dir of ["authored", "intents"]) await cp(join(halden, dir), join(workspace, dir), { recursive: true });
  try {
    await runTests({
      cachePath: join(here, ".vscode-test"),
      extensionDevelopmentPath: here,
      extensionTestsPath: join(here, "test/smoke/editor-suite.cjs"),
      launchArgs: [workspace, "--disable-extensions", "--disable-workspace-trust", "--skip-welcome", "--skip-release-notes", "--user-data-dir", join(root, "user-data")],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
