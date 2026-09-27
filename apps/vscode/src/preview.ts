/**
 * The preview panel: one webview beside the editor that follows whichever Polyxd document is
 * active, re-sent on every (debounced) edit. Selection goes both ways: the cursor's component is
 * outlined in the preview, and a click in the preview moves the cursor to the component's JSON.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import * as vscode from "vscode";
import { THEMES, type Loaded } from "./documents.ts";
import { nodeAtOffset, nodeAtPointer, positions } from "./json.ts";
import { packCss, type PackCss } from "./pack.ts";
import { previewPage } from "./webview/page.ts";

export interface Shown {
  uri: vscode.Uri;
  loaded: Loaded;
}

export class Preview {
  private panel: vscode.WebviewPanel | undefined;
  private ready = false;
  private shown: Shown | undefined;
  private version = 0;
  private pack: PackCss | undefined;
  private context: vscode.ExtensionContext;
  private editorFor: (uri: vscode.Uri) => vscode.TextEditor | undefined;

  constructor(context: vscode.ExtensionContext, editorFor: (uri: vscode.Uri) => vscode.TextEditor | undefined) {
    this.context = context;
    this.editorFor = editorFor;
    context.subscriptions.push(
      vscode.window.onDidChangeActiveColorTheme((t) => this.post({ type: "editorTheme", mode: modeOf(t) })),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("polyxd.pack")) void this.loadPack().then(() => this.post({ type: "pack", pack: this.pack }));
      }),
    );
  }

  get isOpen(): boolean {
    return !!this.panel;
  }

  async open(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(undefined, true);
      return;
    }
    const root = vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview");
    const panel = vscode.window.createWebviewPanel("polyxd.preview", "Polyxd preview", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
      enableScripts: true,
      // The mounted surface (and what someone typed into it) survives switching tabs.
      retainContextWhenHidden: true,
      localResourceRoots: [root],
    });
    panel.iconPath = new vscode.ThemeIcon("layout");
    this.panel = panel;
    this.ready = false;
    const uri = (f: string) => panel.webview.asWebviewUri(vscode.Uri.joinPath(root, f)).toString();
    panel.webview.html = previewPage({ polyxdJs: uri("polyxd.js"), polyxdCss: uri("polyxd.css"), mainJs: uri("main.js"), cspSource: panel.webview.cspSource, nonce: randomBytes(16).toString("base64") });
    panel.webview.onDidReceiveMessage((m: { type: string; id?: string }) => {
      if (m.type === "ready") {
        this.ready = true;
        this.post({ type: "init", themes: THEMES, theme: vscode.workspace.getConfiguration("polyxd").get<string>("defaultPack") || "material3", mode: modeOf(vscode.window.activeColorTheme), pack: this.pack });
        if (this.shown) this.send(this.shown);
        else this.post({ type: "none" });
      } else if (m.type === "select" && m.id) this.revealComponent(m.id);
    }, undefined, this.context.subscriptions);
    panel.onDidDispose(() => {
      this.panel = undefined;
      this.ready = false;
    }, undefined, this.context.subscriptions);
    await this.loadPack();
  }

  /** The document to show. Called for every active-editor change and edit; only documents arrive. */
  show(shown: Shown | undefined): void {
    this.shown = shown;
    if (!this.panel) return;
    if (!shown) return this.post({ type: "none" });
    this.send(shown);
  }

  /** Outline the component whose JSON holds `offset` in the shown file (none when outside one). */
  cursorAt(uri: vscode.Uri, offset: number): void {
    if (!this.panel || !this.shown || this.shown.uri.toString() !== uri.toString()) return;
    const { pointer } = nodeAtOffset(this.shown.loaded.root, offset);
    const m = new RegExp(`^${this.shown.loaded.classified.prefix}/components/(\\d+)(/|$)`).exec(pointer);
    const id = m ? this.shown.loaded.classified.document.components[Number(m[1])]?.id : undefined;
    this.post({ type: "outline", id: typeof id === "string" ? id : undefined });
  }

  private send(shown: Shown) {
    if (!this.ready) return;
    const { loaded, uri } = shown;
    this.version += 1;
    this.post({
      type: "document",
      file: vscode.workspace.asRelativePath(uri, false),
      title: loaded.classified.title,
      kind: loaded.classified.kind,
      document: loaded.classified.document,
      data: loaded.data,
      dataFrom: loaded.dataFrom,
      version: this.version,
    });
    if (this.panel) this.panel.title = `Preview: ${loaded.classified.title || vscode.workspace.asRelativePath(uri, false)}`;
  }

  private post(message: unknown) {
    void this.panel?.webview.postMessage(message);
  }

  /** Moves the editor's cursor to a component's JSON, opening the file if it isn't showing. */
  private async revealComponent(id: string) {
    if (!this.shown) return;
    const { uri, loaded } = this.shown;
    const index = loaded.classified.document.components.findIndex((c: { id?: string }) => c?.id === id);
    if (index < 0) return;
    const { node, exact } = nodeAtPointer(loaded.root, `${loaded.classified.prefix}/components/${index}`);
    if (!exact) return;
    const editor = this.editorFor(uri) ?? (await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.One, preserveFocus: false }));
    const text = editor.document.getText();
    const pos = positions(text);
    // The "id" member when there is one, so the cursor lands on something readable.
    const idNode = node.children?.find((c) => c.key === "id");
    const at = pos(idNode ? idNode.offset : node.offset);
    const start = new vscode.Position(at.line, at.character);
    editor.selection = new vscode.Selection(start, start);
    editor.revealRange(new vscode.Range(start, start), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    await vscode.window.showTextDocument(editor.document, { viewColumn: editor.viewColumn, preserveFocus: false });
  }

  private async loadPack(): Promise<void> {
    const setting = vscode.workspace.getConfiguration("polyxd").get<string>("pack")?.trim();
    this.pack = undefined;
    if (!setting) return;
    const folders = vscode.workspace.workspaceFolders ?? [];
    const candidates = isAbsolute(setting) ? [setting] : folders.map((f) => join(f.uri.fsPath, setting));
    const path = candidates.find((p) => existsSync(p));
    if (!path) {
      void vscode.window.showWarningMessage(`polyxd.pack: ${setting} isn't a file in this workspace.`);
      return;
    }
    try {
      this.pack = await packCss(path);
    } catch (e) {
      void vscode.window.showWarningMessage(`polyxd.pack: ${(e as Error).message}`);
    }
  }
}

const modeOf = (t: vscode.ColorTheme): "light" | "dark" => (t.kind === vscode.ColorThemeKind.Dark || t.kind === vscode.ColorThemeKind.HighContrast ? "dark" : "light");
