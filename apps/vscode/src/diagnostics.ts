/**
 * The static check as editor diagnostics. Each issue's JSON Pointer becomes a range through the
 * parsed tree; a missing data path is a warning (the validator already says "did you mean"),
 * everything structural an error. Syntax errors are the editor's own JSON mode's to report.
 */
import * as vscode from "vscode";
import type { Loaded } from "./documents.ts";
import { rangeForPointer } from "./json.ts";

export function publish(collection: vscode.DiagnosticCollection, document: vscode.TextDocument, loaded: Loaded | undefined): void {
  if (!loaded) return collection.delete(document.uri);
  const text = document.getText();
  const diagnostics = loaded.check.issues.map((issue) => {
    const at = issue.at === "/" || issue.at === "" ? loaded.classified.prefix || "/" : loaded.classified.prefix + issue.at;
    const { range } = rangeForPointer(text, loaded.root, at);
    const d = new vscode.Diagnostic(
      new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character),
      issue.message,
      issue.severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
    );
    d.source = "polyxd";
    if (issue.code) d.code = issue.code;
    return d;
  });
  collection.set(document.uri, diagnostics);
}
