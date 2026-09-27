/**
 * The "Polyxd documents" view: every document in the workspace, grouped by folder, with the
 * static check's status as a dot. Rescans (debounced) when a JSON file is saved, made or removed.
 */
import { basename } from "node:path";
import * as vscode from "vscode";
import { discoverDocuments, groupByFolder, type DiscoveredDocument } from "./documents.ts";

type Item = { kind: "folder"; label: string; documents: DiscoveredDocument[] } | { kind: "document"; document: DiscoveredDocument };

export class DocumentsView implements vscode.TreeDataProvider<Item> {
  private emitter = new vscode.EventEmitter<Item | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private groups: { folder: string; documents: DiscoveredDocument[] }[] = [];
  private timer: NodeJS.Timeout | undefined;

  constructor(context: vscode.ExtensionContext) {
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.json");
    context.subscriptions.push(watcher, watcher.onDidChange(() => this.schedule()), watcher.onDidCreate(() => this.schedule()), watcher.onDidDelete(() => this.schedule()), vscode.workspace.onDidChangeWorkspaceFolders(() => this.schedule()));
    context.subscriptions.push(vscode.window.registerTreeDataProvider("polyxd.documents", this));
    void this.refresh();
  }

  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refresh(), 400);
  }

  async refresh(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const groups: { folder: string; documents: DiscoveredDocument[] }[] = [];
    for (const f of folders) {
      const docs = await discoverDocuments(f.uri.fsPath);
      const prefix = folders.length > 1 ? `${f.name}/` : "";
      for (const g of groupByFolder(docs)) groups.push({ folder: prefix + (g.folder || "."), documents: g.documents });
    }
    this.groups = groups;
    this.emitter.fire(undefined);
  }

  getChildren(item?: Item): Item[] {
    if (!item) return this.groups.map((g) => ({ kind: "folder", label: g.folder, documents: g.documents }));
    if (item.kind === "folder") return item.documents.map((document) => ({ kind: "document", document }));
    return [];
  }

  getTreeItem(item: Item): vscode.TreeItem {
    if (item.kind === "folder") {
      const t = new vscode.TreeItem(item.label, vscode.TreeItemCollapsibleState.Expanded);
      t.iconPath = vscode.ThemeIcon.Folder;
      t.description = `${item.documents.length}`;
      return t;
    }
    const d = item.document;
    const t = new vscode.TreeItem(d.title || basename(d.path, ".json"));
    const status = d.check.errors ? "error" : d.check.warnings ? "warn" : "ok";
    t.iconPath = new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor(status === "error" ? "charts.red" : status === "warn" ? "charts.yellow" : "charts.green"));
    t.description = [basename(d.path), d.kind === "intent" ? "intent" : "", d.origin ?? ""].filter(Boolean).join(" · ");
    const counts = [d.check.errors ? `${d.check.errors} error${d.check.errors === 1 ? "" : "s"}` : "", d.check.warnings ? `${d.check.warnings} warning${d.check.warnings === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ");
    t.tooltip = `${d.file}\n${d.id ? `surface ${d.id}` : d.kind}${d.dataFrom === "none" ? " · no data" : d.dataFrom === "sibling" ? " · data from the sibling .data.json" : ""}\n${counts || "No issues"}`;
    t.resourceUri = vscode.Uri.file(d.path);
    t.contextValue = "polyxdDocument";
    t.command = { command: "vscode.open", title: "Open", arguments: [vscode.Uri.file(d.path)] };
    return t;
  }
}
