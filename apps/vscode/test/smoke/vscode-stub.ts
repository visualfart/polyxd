/**
 * Enough of the `vscode` API, in plain objects, to activate the built extension in Node and watch
 * what it does: which commands it registers, which diagnostics it publishes for a document, what
 * the preview panel is told. Not VS Code; the real thing is the .vsix in an editor (see README).
 */
import { EventEmitter as NodeEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export class Position {
  line: number;
  character: number;
  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }
}
export class Range {
  start: Position;
  end: Position;
  constructor(a: number | Position, b: number | Position, c?: number, d?: number) {
    this.start = typeof a === "number" ? new Position(a, b as number) : a;
    this.end = typeof a === "number" ? new Position(c!, d!) : (b as Position);
  }
}
export class Selection extends Range {
  get active() {
    return this.end;
  }
}
export class Uri {
  scheme = "file";
  fsPath: string;
  constructor(fsPath: string) {
    this.fsPath = fsPath;
  }
  get path() {
    return this.fsPath;
  }
  static file(p: string) {
    return new Uri(p);
  }
  static parse(s: string) {
    return new Uri(s);
  }
  static joinPath(u: Uri, ...parts: string[]) {
    return new Uri([u.fsPath, ...parts].join("/"));
  }
  toString() {
    return `file://${this.fsPath}`;
  }
}
export class Diagnostic {
  source?: string;
  code?: string;
  range: Range;
  message: string;
  severity: number;
  constructor(range: Range, message: string, severity: number) {
    this.range = range;
    this.message = message;
    this.severity = severity;
  }
}
export const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };
export class ThemeIcon {
  static Folder = new ThemeIcon("folder");
  id: string;
  color?: unknown;
  constructor(id: string, color?: unknown) {
    this.id = id;
    this.color = color;
  }
}
export class ThemeColor {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}
export class TreeItem {
  iconPath?: unknown;
  description?: string;
  tooltip?: string;
  resourceUri?: Uri;
  contextValue?: string;
  command?: unknown;
  label: string;
  collapsibleState: number;
  constructor(label: string, collapsibleState = 0) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}
export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
export class EventEmitter<T> {
  private listeners = new Set<(e: T) => void>();
  event = (l: (e: T) => void) => {
    this.listeners.add(l);
    return { dispose: () => this.listeners.delete(l) };
  };
  fire(e: T) {
    for (const l of this.listeners) l(e);
  }
}
export class SnippetString {
  value: string;
  constructor(value: string) {
    this.value = value;
  }
}
export const ViewColumn = { One: 1, Beside: -2 };
export const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 };
export const ConfigurationTarget = { Workspace: 2 };
export const QuickPickItemKind = { Separator: -1, Default: 0 };
export const TextEditorRevealType = { InCenterIfOutsideViewport: 2 };
export const TaskScope = { Workspace: 2 };
export const TaskRevealKind = { Always: 1 };
export const TaskPanelKind = { Dedicated: 2 };
export class Task {
  presentationOptions: unknown;
  definition: unknown;
  scope: unknown;
  name: string;
  source: string;
  execution: unknown;
  constructor(definition: unknown, scope: unknown, name: string, source: string, execution: unknown) {
    this.definition = definition;
    this.scope = scope;
    this.name = name;
    this.source = source;
    this.execution = execution;
  }
}
export class ShellExecution {
  commandLine: string;
  options?: unknown;
  constructor(commandLine: string, options?: unknown) {
    this.commandLine = commandLine;
    this.options = options;
  }
}

/** A text document over a string, with the offset/position pair the extension uses. */
export class TextDocument {
  private starts: number[] = [0];
  uri: Uri;
  private text: string;
  languageId: string;
  constructor(uri: Uri, text: string, languageId = "json") {
    this.uri = uri;
    this.text = text;
    this.languageId = languageId;
    for (let i = 0; i < text.length; i++) if (text[i] === "\n") this.starts.push(i + 1);
  }
  getText() {
    return this.text;
  }
  setText(t: string) {
    this.text = t;
    this.starts = [0];
    for (let i = 0; i < t.length; i++) if (t[i] === "\n") this.starts.push(i + 1);
  }
  offsetAt(p: Position) {
    return this.starts[p.line] + p.character;
  }
  positionAt(offset: number) {
    let line = 0;
    while (line + 1 < this.starts.length && this.starts[line + 1] <= offset) line++;
    return new Position(line, offset - this.starts[line]);
  }
}

// ---- what the test watches ----
export const recorded = {
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  context: new Map<string, unknown>(),
  diagnostics: new Map<string, Diagnostic[]>(),
  messages: [] as string[],
  panels: [] as FakePanel[],
  treeProviders: new Map<string, unknown>(),
  tasks: [] as Task[],
  opened: [] as string[],
  clipboard: "",
  snippets: [] as { text: string; at: Position }[],
  quickPickAnswer: undefined as string | undefined,
  inputAnswer: undefined as string | undefined,
  secrets: new Map<string, string>(),
};

export class FakePanel {
  webview: { html: string; cspSource: string; posted: unknown[]; asWebviewUri: (u: Uri) => string; onDidReceiveMessage: (l: (m: unknown) => void) => void; postMessage: (m: unknown) => Promise<boolean>; receive: (m: unknown) => void };
  title = "";
  iconPath: unknown;
  private disposeListeners: (() => void)[] = [];
  private messageListeners: ((m: unknown) => void)[] = [];
  constructor() {
    const panel = this;
    this.webview = {
      html: "",
      cspSource: "vscode-webview://x",
      posted: [],
      asWebviewUri: (u: Uri) => `vscode-webview://x${u.fsPath}`,
      onDidReceiveMessage: (l) => panel.messageListeners.push(l),
      postMessage: async (m) => {
        panel.webview.posted.push(m);
        return true;
      },
      receive: (m) => panel.messageListeners.forEach((l) => l(m)),
    };
  }
  reveal() {}
  onDidDispose(l: () => void) {
    this.disposeListeners.push(l);
  }
  dispose() {
    this.disposeListeners.forEach((l) => l());
  }
}

const events = new NodeEmitter();
const on = (name: string) => (l: (e: unknown) => void) => {
  events.on(name, l);
  return { dispose: () => events.off(name, l) };
};
export const fire = (name: string, e?: unknown) => events.emit(name, e);

export const documents: TextDocument[] = [];
export let activeEditor: { document: TextDocument; selection: Selection; viewColumn: number; revealRange: () => void; insertSnippet: (s: SnippetString, at: Position) => Promise<boolean> } | undefined;
export function openDocument(path: string, text = readFileSync(path, "utf8")): TextDocument {
  const doc = new TextDocument(Uri.file(path), text);
  documents.push(doc);
  fire("openTextDocument", doc);
  return doc;
}
export function activate(doc: TextDocument, line = 0, character = 0) {
  const p = new Position(line, character);
  activeEditor = {
    document: doc,
    selection: new Selection(p, p),
    viewColumn: 1,
    revealRange: () => undefined,
    insertSnippet: async (s, at) => {
      recorded.snippets.push({ text: s.value, at });
      return true;
    },
  };
  fire("changeActiveTextEditor", activeEditor);
  return activeEditor;
}
export function moveCursor(line: number, character: number) {
  const p = new Position(line, character);
  activeEditor!.selection = new Selection(p, p);
  fire("changeTextEditorSelection", { textEditor: activeEditor, selections: [activeEditor!.selection] });
}
export function edit(doc: TextDocument, text: string) {
  doc.setText(text);
  fire("changeTextDocument", { document: doc, contentChanges: [{}] });
}

export let workspaceFolders: { uri: Uri; name: string }[] = [];
export const setWorkspace = (paths: string[]) => (workspaceFolders = paths.map((p) => ({ uri: Uri.file(p), name: basename(p) })));
const config = new Map<string, unknown>([["polyxd.defaultPack", "material3"]]);
export const setConfig = (k: string, v: unknown) => config.set(k, v);

export const workspace = {
  get workspaceFolders() {
    return workspaceFolders;
  },
  get textDocuments() {
    return documents;
  },
  getConfiguration: (section: string) => ({
    get: (k: string) => config.get(`${section}.${k}`),
    update: async (k: string, v: unknown) => void config.set(`${section}.${k}`, v),
  }),
  getWorkspaceFolder: (u: Uri) => workspaceFolders.find((f) => u.fsPath.startsWith(f.uri.fsPath)),
  asRelativePath: (u: Uri) => {
    const f = workspaceFolders.find((w) => u.fsPath.startsWith(w.uri.fsPath));
    return f ? u.fsPath.slice(f.uri.fsPath.length + 1) : u.fsPath;
  },
  onDidOpenTextDocument: on("openTextDocument"),
  onDidChangeTextDocument: on("changeTextDocument"),
  onDidSaveTextDocument: on("saveTextDocument"),
  onDidCloseTextDocument: on("closeTextDocument"),
  onDidChangeWorkspaceFolders: on("changeWorkspaceFolders"),
  onDidChangeConfiguration: on("changeConfiguration"),
  createFileSystemWatcher: () => ({ dispose() {}, onDidChange: on("fsChange"), onDidCreate: on("fsCreate"), onDidDelete: on("fsDelete") }),
};

export const window = {
  get activeTextEditor() {
    return activeEditor;
  },
  get visibleTextEditors() {
    return activeEditor ? [activeEditor] : [];
  },
  activeColorTheme: { kind: 2 },
  onDidChangeActiveTextEditor: on("changeActiveTextEditor"),
  onDidChangeTextEditorSelection: on("changeTextEditorSelection"),
  onDidChangeActiveColorTheme: on("changeActiveColorTheme"),
  registerTreeDataProvider: (id: string, p: unknown) => {
    recorded.treeProviders.set(id, p);
    return { dispose() {} };
  },
  createWebviewPanel: () => {
    const p = new FakePanel();
    recorded.panels.push(p);
    return p;
  },
  showInformationMessage: async (m: string) => void recorded.messages.push(`info: ${m}`),
  showWarningMessage: async (m: string) => void recorded.messages.push(`warn: ${m}`),
  showErrorMessage: async (m: string) => void recorded.messages.push(`error: ${m}`),
  showQuickPick: async (items: { label: string; component?: string }[]) => items.find((i) => i.label === recorded.quickPickAnswer),
  showInputBox: async () => recorded.inputAnswer,
  showTextDocument: async () => activeEditor,
};

export const languages = {
  createDiagnosticCollection: () => ({
    set: (u: Uri, d: Diagnostic[]) => recorded.diagnostics.set(u.fsPath, d),
    delete: (u: Uri) => recorded.diagnostics.delete(u.fsPath),
    dispose() {},
  }),
};

export const commands = {
  registerCommand: (id: string, fn: (...args: unknown[]) => unknown) => {
    recorded.commands.set(id, fn);
    return { dispose() {} };
  },
  executeCommand: async (id: string, ...args: unknown[]) => {
    if (id === "setContext") return void recorded.context.set(args[0] as string, args[1]);
    return recorded.commands.get(id)?.(...args);
  },
};

export const env = {
  clipboard: { writeText: async (t: string) => void (recorded.clipboard = t) },
  openExternal: async (u: Uri) => void recorded.opened.push(u.fsPath),
};

export const tasks = {
  executeTask: async (t: Task) => {
    recorded.tasks.push(t);
    return { task: t };
  },
  onDidEndTaskProcess: on("endTaskProcess"),
};

export const makeContext = (extensionPath: string) => ({
  subscriptions: [] as { dispose(): void }[],
  extensionUri: Uri.file(extensionPath),
  secrets: {
    get: async (k: string) => recorded.secrets.get(k),
    store: async (k: string, v: string) => void recorded.secrets.set(k, v),
    delete: async (k: string) => void recorded.secrets.delete(k),
  },
});
