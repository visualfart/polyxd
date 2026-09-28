/**
 * The README's screenshots, taken from the packaged extension in a real VS Code.
 * @vscode/test-electron downloads the editor (into .vscode-test/, as the smoke test does), its CLI
 * installs polyxd-vscode-<version>.vsix into an extensions folder of its own, and Playwright drives
 * the window: a copy of Halden's authored screens with data from Halden's own seed, one binding
 * misspelt so the static check has something to say, the preview beside it, the Insert component
 * picker and the Explorer's documents view. Writes images/*.png.
 *
 *   npm run screenshots -w polyxd-vscode     (packages first)
 *
 * The window is its own (fresh user data, this extension alone), so nothing about the machine's
 * editor setup ends up in a picture. It renders at 2x whatever the display, so the images are sharp.
 */
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";
import { _electron, type Frame } from "playwright";

const here = fileURLToPath(new URL("../", import.meta.url));
const halden = join(here, "../demos/halden");
const images = join(here, "images");
const pkg = JSON.parse(await readFile(join(here, "package.json"), "utf8"));
const vsix = join(here, `${pkg.name}-${pkg.version}.vsix`);
const WIDTH = 1280;
const HEIGHT = 800;

// ---- a workspace: Halden's authored screens and intents, each screen with its data beside it ----
const root = await mkdtemp(join(tmpdir(), "polyxd-shots-"));
const workspace = join(root, "halden");
await mkdir(join(workspace, "authored"), { recursive: true });
await cp(join(halden, "intents"), join(workspace, "intents"), { recursive: true });
// Halden's own seed and views, loaded by URL: they belong to the demos app, not to this project.
const demo = (f: string) => import(new URL(`../../demos/halden/${f}`, import.meta.url).href);
const { seed } = (await demo("seed.ts")) as { seed: () => unknown };
const { surfaceData } = (await demo("views.ts")) as { surfaceData: (h: unknown, intent: unknown, slots: Record<string, unknown>) => unknown };
const h = seed();
for (const name of ["screen.budgets", "screen.card", "screen.insights"]) {
  const intent = JSON.parse(await readFile(join(halden, "authored", `${name}.json`), "utf8"));
  let text = JSON.stringify(intent, null, 2);
  // The one mistake in the pictures: a binding one letter short.
  if (name === "screen.budgets") text = text.replace('"path": "/budgets/daysLeft"', '"path": "/budgets/daysLef"');
  await writeFile(join(workspace, "authored", `${name}.json`), text + "\n");
  await writeFile(join(workspace, "authored", `${name}.data.json`), JSON.stringify(surfaceData(h, intent, {}), null, 2) + "\n");
}
await cp(join(halden, "authored/shell.json"), join(workspace, "authored/shell.json"));

// ---- an editor of its own, with the .vsix installed ----
const userData = join(root, "user-data");
const extensions = join(root, "extensions");
await mkdir(join(userData, "User"), { recursive: true });
await writeFile(
  join(userData, "User/settings.json"),
  JSON.stringify({
    "workbench.colorTheme": "Default Dark Modern",
    "workbench.startupEditor": "none",
    "workbench.tips.enabled": false,
    "workbench.secondarySideBar.defaultVisibility": "hidden",
    "workbench.layoutControl.enabled": false,
    "window.commandCenter": false,
    "chat.disableAIFeatures": true,
    "chat.commandCenter.enabled": false,
    "editor.minimap.enabled": false,
    "editor.fontSize": 13,
    "editor.stickyScroll.enabled": false,
    "breadcrumbs.enabled": false,
    "telemetry.telemetryLevel": "off",
    "update.mode": "none",
    "extensions.ignoreRecommendations": true,
    "extensions.autoUpdate": false,
    "git.enabled": false,
    "explorer.autoReveal": false,
  }),
);
const executablePath = await downloadAndUnzipVSCode({ cachePath: join(here, ".vscode-test") });
const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(executablePath);
execFileSync(cli, [...cliArgs.filter((a) => !a.startsWith("--extensions-dir") && !a.startsWith("--user-data-dir")), `--extensions-dir=${extensions}`, `--user-data-dir=${userData}`, "--install-extension", vsix], { stdio: "inherit" });

const app = await _electron.launch({
  executablePath,
  args: [workspace, `--extensions-dir=${extensions}`, `--user-data-dir=${userData}`, "--disable-workspace-trust", "--skip-welcome", "--skip-release-notes", "--new-window", "--force-device-scale-factor=2"],
});
const page = await app.firstWindow();
await app.evaluate(({ BrowserWindow }, [w, h]) => {
  const win = BrowserWindow.getAllWindows()[0];
  win.setContentSize(w, h);
  win.center();
}, [WIDTH, HEIGHT] as const);
await page.waitForSelector(".monaco-workbench", { timeout: 60_000 });
await page.waitForTimeout(3000);

const mod = process.platform === "darwin" ? "Meta" : "Control";
const shot = async (file: string) => {
  await mkdir(images, { recursive: true });
  await page.screenshot({ path: join(images, file) });
  console.log(`wrote images/${file}`);
};
async function command(title: string) {
  await page.keyboard.press("F1");
  await page.waitForSelector(".quick-input-widget input", { state: "visible" });
  await page.keyboard.type(title);
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
}
async function open(file: string) {
  await page.keyboard.press(`${mod}+P`);
  await page.waitForSelector(".quick-input-widget input", { state: "visible" });
  await page.keyboard.type(file);
  await page.waitForTimeout(700);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
}
/** The preview page inside its webview frames, once it has rendered. */
async function previewFrame(): Promise<Frame> {
  for (let i = 0; i < 100; i++) {
    for (const f of page.frames()) if (await f.$("#surface [data-pxd-id]").catch(() => null)) return f;
    await page.waitForTimeout(200);
  }
  throw new Error("the preview never rendered");
}

try {
  // 1. The static check and the preview, side by side, with room for both.
  await open("authored/screen.budgets.json");
  await command("View: Close Primary Side Bar");
  await command("Polyxd: Open preview");
  const preview = await previewFrame();
  await page.waitForTimeout(1500);
  // The cursor on the misspelt binding: its hover says what's wrong, and its component is outlined.
  await page.keyboard.press(`${mod}+1`);
  await page.keyboard.press(`${mod}+F`);
  await page.keyboard.type('daysLef"');
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await command("Show or Focus Hover");
  await page.waitForTimeout(1500);
  await shot("check-and-preview.png");
  await page.keyboard.press("Escape");

  // 2. The preview's controls: another pack, light, a wider surface, and an action in the log.
  await preview.selectOption("#theme", "polaris");
  await preview.click('#mode button[data-v="light"]');
  await preview.click('#width button[data-v="820"]');
  await page.waitForTimeout(800);
  const action = await preview.$("#surface button");
  if (action) await action.click();
  await page.waitForTimeout(800);
  await shot("preview-controls.png");

  // 3. Insert component.
  await page.keyboard.press(`${mod}+1`);
  await command("Polyxd: Insert component");
  await page.waitForTimeout(800);
  await shot("insert-component.png");
  await page.keyboard.press("Escape");

  // 4. The documents view in the Explorer, beside another screen's preview.
  await command("View: Close All Editors");
  await page.waitForTimeout(500);
  await command("Explorer: Collapse Folders in Explorer");
  await page.waitForTimeout(500);
  await command("Explorer: Focus on Polyxd Documents View");
  await page.waitForTimeout(1500);
  await open("authored/screen.insights.json");
  await command("Polyxd: Open preview");
  await page.waitForTimeout(2500);
  await shot("documents-view.png");
} finally {
  await app.close();
  await rm(root, { recursive: true, force: true });
}
