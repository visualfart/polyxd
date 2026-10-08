/**
 * Polyxd for VS Code (and Cursor and Windsurf): the schema for completion and hover text, the
 * static check as diagnostics while you type, a live preview in every design system, the
 * verifier and Studio a command away, a view of the workspace's documents, and the Polyxd MCP
 * server offered to the editor's agent.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as vscode from "vscode";
import { insertComponent, openInStudio, pushToStudio, setStudioKey, verify } from "./commands.ts";
import { publish } from "./diagnostics.ts";
import { isDataFile, loadDocument, siblingDataPath, type Loaded } from "./documents.ts";
import { mcpRoute, registerMcp } from "./mcp.ts";
import { Preview, type PreviewHealth } from "./preview.ts";
import { DocumentsView } from "./tree.ts";

const JSON_LANGUAGES = new Set(["json", "jsonc"]);

/** What activate returns: read by the editor smoke test (test/smoke/editor-suite.cjs), nothing else. */
export interface PolyxdExtension {
  previewHealth(): PreviewHealth;
  /** Which editor API the MCP server was offered through. */
  mcpRoute: ReturnType<typeof mcpRoute>;
}

export function activate(context: vscode.ExtensionContext): PolyxdExtension {
  const diagnostics = vscode.languages.createDiagnosticCollection("polyxd");
  const loaded = new Map<string, Loaded>();
  const timers = new Map<string, NodeJS.Timeout>();
  const preview = new Preview(context, (uri) => vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString()));
  const view = new DocumentsView(context);
  context.subscriptions.push(diagnostics);
  registerMcp(context, context.extension?.packageJSON?.version);

  const isJson = (d: vscode.TextDocument) => JSON_LANGUAGES.has(d.languageId) || d.uri.path.endsWith(".json");

  /** The sibling data file's text: an open editor's buffer, else the disk. */
  const siblingData = async (uri: vscode.Uri): Promise<string | undefined> => {
    if (uri.scheme !== "file") return undefined;
    const path = siblingDataPath(uri.fsPath);
    if (path === uri.fsPath) return undefined;
    const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === path);
    if (open) return open.getText();
    return existsSync(path) ? readFile(path, "utf8").catch(() => undefined) : undefined;
  };

  /** Checks a JSON file and publishes what it finds; tells the preview when it's the shown one. */
  const check = async (document: vscode.TextDocument) => {
    if (!isJson(document) || isDataFile(document.uri.path)) return;
    const key = document.uri.toString();
    const result = loadDocument(document.getText(), await siblingData(document.uri));
    if (result) loaded.set(key, result);
    else loaded.delete(key);
    publish(diagnostics, document, result);
    const active = vscode.window.activeTextEditor;
    if (active?.document.uri.toString() === key) {
      void vscode.commands.executeCommand("setContext", "polyxd.isDocument", !!result);
      if (result) preview.show({ uri: document.uri, loaded: result });
    }
  };
  const schedule = (document: vscode.TextDocument, delay: number) => {
    const key = document.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => void check(document), delay));
  };

  /** A data file changed: the document beside it reads differently now. */
  const recheckOwner = (document: vscode.TextDocument) => {
    if (!isDataFile(document.uri.path)) return false;
    const owner = document.uri.fsPath.replace(/\.data\.json$/i, ".json");
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === owner);
    if (doc) schedule(doc, 150);
    return true;
  };

  const current = (): { editor: vscode.TextEditor; loaded: Loaded } | undefined => {
    const editor = vscode.window.activeTextEditor;
    const l = editor && loaded.get(editor.document.uri.toString());
    if (!editor || !l) {
      void vscode.window.showInformationMessage("Polyxd: open a document first (a JSON file with specVersion and components).");
      return undefined;
    }
    return { editor, loaded: l };
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((d) => void check(d)),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.contentChanges.length === 0) return;
      if (recheckOwner(e.document)) return;
      if (isJson(e.document)) schedule(e.document, 250);
    }),
    vscode.workspace.onDidSaveTextDocument((d) => {
      if (recheckOwner(d)) return;
      schedule(d, 0);
    }),
    vscode.workspace.onDidCloseTextDocument((d) => {
      loaded.delete(d.uri.toString());
      diagnostics.delete(d.uri);
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      const l = editor && loaded.get(editor.document.uri.toString());
      void vscode.commands.executeCommand("setContext", "polyxd.isDocument", !!l);
      // The preview follows document files and ignores the rest, so a glance at data.json keeps it.
      if (editor && l) preview.show({ uri: editor.document.uri, loaded: l });
      else if (editor && isJson(editor.document)) void check(editor.document);
    }),
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.textEditor !== vscode.window.activeTextEditor) return;
      preview.cursorAt(e.textEditor.document.uri, e.textEditor.document.offsetAt(e.selections[0].active));
    }),
    vscode.commands.registerCommand("polyxd.openPreview", async () => {
      await preview.open();
      const editor = vscode.window.activeTextEditor;
      const l = editor && loaded.get(editor.document.uri.toString());
      preview.show(editor && l ? { uri: editor.document.uri, loaded: l } : undefined);
    }),
    vscode.commands.registerCommand("polyxd.verify", () => {
      const c = current();
      if (c) void verify(c.editor.document.uri, c.loaded);
    }),
    vscode.commands.registerCommand("polyxd.insertComponent", () => {
      const c = current();
      if (c) void insertComponent(c.editor, c.loaded);
    }),
    vscode.commands.registerCommand("polyxd.openInStudio", () => {
      const c = current();
      if (c) void openInStudio(c.loaded);
    }),
    vscode.commands.registerCommand("polyxd.pushToStudio", () => {
      const c = current();
      if (c) void pushToStudio(context, c.editor.document.uri);
    }),
    vscode.commands.registerCommand("polyxd.setStudioKey", () => setStudioKey(context)),
    vscode.commands.registerCommand("polyxd.refreshDocuments", () => view.refresh()),
  );

  for (const d of vscode.workspace.textDocuments) void check(d);
  return { previewHealth: () => preview.health, mcpRoute: mcpRoute() };
}

export function deactivate(): void {}
