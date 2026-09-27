/**
 * The commands: verify in a task terminal, insert a component skeleton, and the two Studio ones.
 * Anything that runs a process runs it as a task, so its output sits in a terminal the person
 * can read and rerun, and the extension host never blocks.
 */
import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import * as vscode from "vscode";
import { THEMES, type Loaded } from "./documents.ts";
import { CATEGORIES, COMPONENTS, categoryOf, insertionPoint, skeleton, summaryOf, toSnippet } from "./skeleton.ts";

export const STUDIO_URL = "https://studio.polyxd.com";
const SECRET_KEY = "polyxd.studio.key";

/** `node_modules/.bin/<name>` nearest to `from`, or an npx line that fetches the package. */
export function findBin(name: string, pkg: string, from: string): string {
  let dir = from;
  for (let i = 0; i < 12; i++) {
    const bin = join(dir, "node_modules", ".bin", name);
    if (existsSync(bin)) return quote(bin);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return `npx -y -p ${pkg} ${name}`;
}

const quote = (s: string) => (/[\s"']/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);

function runTask(name: string, command: string, cwd: string, env?: Record<string, string>): Promise<number | undefined> {
  const task = new vscode.Task({ type: "polyxd", task: name }, vscode.TaskScope.Workspace, name, "polyxd", new vscode.ShellExecution(command, { cwd, env }));
  task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, panel: vscode.TaskPanelKind.Dedicated, clear: true, showReuseMessage: false };
  return new Promise((resolve) => {
    void vscode.tasks.executeTask(task).then((execution) => {
      const sub = vscode.tasks.onDidEndTaskProcess((e) => {
        // The execution object isn't always the one returned; the task's name and source are.
        const same = e.execution === execution || (e.execution.task.name === task.name && e.execution.task.source === task.source);
        if (!same) return;
        sub.dispose();
        resolve(e.exitCode);
      });
    }, () => resolve(undefined));
  });
}

/** `polyxd-verify` on the document, every pack, light and dark, phone and desktop. */
export async function verify(uri: vscode.Uri, loaded: Loaded): Promise<void> {
  let file = uri.fsPath;
  // The verifier takes a bare document; an intent file's document, with its data, goes through a temp file.
  if (loaded.classified.kind === "intent" || loaded.dataFrom === "sibling") {
    const dir = await mkdtemp(join(tmpdir(), "polyxd-vscode-verify-"));
    file = join(dir, basename(uri.fsPath));
    const doc = loaded.data !== undefined ? { ...loaded.classified.document, data: loaded.data } : loaded.classified.document;
    await writeFile(file, JSON.stringify(doc, null, 2));
  }
  const cwd = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? dirname(uri.fsPath);
  const bin = findBin("polyxd-verify", "@polyxd/verifier", dirname(uri.fsPath));
  const command = `${bin} ${quote(file)} --themes ${THEMES.join(",")} --modes light,dark --widths 390,1100`;
  const code = await runTask(`Verify ${basename(uri.fsPath)}`, command, cwd);
  const name = basename(uri.fsPath);
  if (code === 0) void vscode.window.showInformationMessage(`Polyxd: ${name} verified in ${THEMES.length} packs with no errors.`);
  else if (code === undefined) void vscode.window.showWarningMessage("Polyxd: the verifier didn't start. Is @polyxd/verifier installed (npm install -D @polyxd/verifier && npx playwright install chromium)?");
  else void vscode.window.showWarningMessage(`Polyxd: the verifier found problems in ${name} (exit ${code}); see the terminal.`);
}

/** A quick pick of the components by category; the choice lands as a snippet in `components`. */
export async function insertComponent(editor: vscode.TextEditor, loaded: Loaded): Promise<void> {
  const items: (vscode.QuickPickItem & { component?: string })[] = [];
  for (const cat of [...CATEGORIES, ...[...new Set(COMPONENTS.map(categoryOf))].filter((c) => !CATEGORIES.includes(c))]) {
    const inCat = COMPONENTS.filter((c) => categoryOf(c) === cat);
    if (!inCat.length) continue;
    items.push({ label: cat, kind: vscode.QuickPickItemKind.Separator });
    for (const c of inCat) items.push({ label: c, description: summaryOf(c), component: c });
  }
  const pick = await vscode.window.showQuickPick(items, { placeHolder: "Component to insert", matchOnDescription: true });
  if (!pick?.component) return;
  const text = editor.document.getText();
  const pointer = `${loaded.classified.prefix}/components`;
  const at = insertionPoint(text, loaded.root, pointer, editor.document.offsetAt(editor.selection.active));
  if (!at) return void vscode.window.showWarningMessage("Polyxd: this file has no components array to insert into.");
  const taken = loaded.classified.document.components.map((c: { id?: unknown }) => String(c?.id ?? ""));
  const sk = skeleton(pick.component, taken);
  const snippet = new vscode.SnippetString(`${at.before}${toSnippet(sk, at.indent, at.base)}${at.after}`);
  const pos = editor.document.positionAt(at.offset);
  await editor.insertSnippet(snippet, pos, { undoStopBefore: true, undoStopAfter: true });
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** Studio makes a screen from pasted JSON; the document goes to the clipboard and Studio opens. */
export async function openInStudio(loaded: Loaded): Promise<void> {
  await vscode.env.clipboard.writeText(JSON.stringify(loaded.classified.document, null, 2));
  await vscode.env.openExternal(vscode.Uri.parse(STUDIO_URL));
  void vscode.window.showInformationMessage("Polyxd: the document is on your clipboard. In Studio, open Screens and choose “Paste JSON” to make a screen of it.");
}

export async function setStudioKey(context: vscode.ExtensionContext): Promise<void> {
  const key = await vscode.window.showInputBox({ prompt: "Studio API key (Team → API keys in Studio). Stored in the editor's secret storage, never in settings.", password: true, ignoreFocusOut: true });
  if (key === undefined) return;
  if (!key.trim()) {
    await context.secrets.delete(SECRET_KEY);
    void vscode.window.showInformationMessage("Polyxd: the Studio API key was removed.");
    return;
  }
  await context.secrets.store(SECRET_KEY, key.trim());
  void vscode.window.showInformationMessage("Polyxd: the Studio API key is stored.");
}

/** `polyxd studio push <file> --to <workspace>` with the key from the environment or secret storage. */
export async function pushToStudio(context: vscode.ExtensionContext, uri: vscode.Uri): Promise<void> {
  let to = vscode.workspace.getConfiguration("polyxd").get<string>("studio.workspaceUrl")?.trim();
  if (!to) {
    to = await vscode.window.showInputBox({ prompt: "Your Studio workspace's API base (saved as polyxd.studio.workspaceUrl)", placeHolder: `${STUDIO_URL}/api/w/<workspace>`, ignoreFocusOut: true });
    if (!to) return;
    await vscode.workspace.getConfiguration("polyxd").update("studio.workspaceUrl", to, vscode.ConfigurationTarget.Workspace);
  }
  let key = process.env.POLYXD_STUDIO_KEY ?? (await context.secrets.get(SECRET_KEY));
  if (!key) {
    await setStudioKey(context);
    key = await context.secrets.get(SECRET_KEY);
    if (!key) return;
  }
  const cwd = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? dirname(uri.fsPath);
  const bin = findBin("polyxd", "@polyxd/ds-kit", dirname(uri.fsPath));
  // The key travels in the task's environment, never on the command line the terminal shows.
  const code = await runTask(`Push ${basename(uri.fsPath)} to Studio`, `${bin} studio push ${quote(uri.fsPath)} --to ${quote(to)}`, cwd, { POLYXD_STUDIO_KEY: key });
  if (code === 0) void vscode.window.showInformationMessage(`Polyxd: ${basename(uri.fsPath)} was pushed to Studio.`);
  else if (code !== undefined) void vscode.window.showWarningMessage(`Polyxd: the push failed (exit ${code}); see the terminal.`);
}
