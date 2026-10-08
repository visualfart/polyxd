/**
 * The MCP server registration in the built extension, against the stand-in `vscode` with each
 * editor's API added: Cursor's `vscode.cursor.mcp`, VS Code's definition provider, and neither.
 * The setting turns it off and back on without a reload. Build first: npm run build -w polyxd-vscode.
 *
 *   node --test test/smoke/mcp.ts
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import Module from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import * as stub from "./vscode-stub.ts";

const here = fileURLToPath(new URL("../../", import.meta.url));
const bundle = join(here, "dist/extension.cjs");
const URL_ = "https://mcp.polyxd.com/mcp";

/** Activates a fresh copy of the bundle with `extra` merged into the stand-in `vscode`. */
function activateWith(extra: Record<string, unknown>) {
  const api = { ...stub, ...extra };
  const M = Module as unknown as { _load: (...a: unknown[]) => unknown; _cache: Record<string, unknown> };
  const load = M._load;
  M._load = function (request: unknown, ...rest: unknown[]) {
    return request === "vscode" ? api : load.call(this, request, ...rest);
  };
  try {
    const req = Module.createRequire(import.meta.url);
    delete req.cache[req.resolve(bundle)];
    const ext = req(bundle) as { activate: (c: unknown) => void };
    const context = { ...stub.makeContext(here), extension: { packageJSON: { version: "9.9.9" } } };
    ext.activate(context);
    return context;
  } finally {
    M._load = load;
  }
}

const skip = !existsSync(bundle) && "dist/extension.cjs isn't built";

test("in Cursor, the server is registered by URL and follows the setting", { skip }, () => {
  const calls: string[] = [];
  const mcp = {
    registerServer: (c: { name: string; server: { url: string } }) => calls.push(`register ${c.name} ${c.server.url}`),
    unregisterServer: (n: string) => calls.push(`unregister ${n}`),
  };
  stub.setConfig("polyxd.mcp.enabled", undefined);
  const context = activateWith({ cursor: { mcp } });
  assert.deepEqual(calls, [`register polyxd ${URL_}`]);

  const affects = { affectsConfiguration: (k: string) => k === "polyxd.mcp.enabled" };
  stub.setConfig("polyxd.mcp.enabled", false);
  stub.fire("changeConfiguration", affects);
  stub.setConfig("polyxd.mcp.enabled", true);
  stub.fire("changeConfiguration", affects);
  stub.fire("changeConfiguration", affects); // no change, no call
  assert.deepEqual(calls, [`register polyxd ${URL_}`, "unregister polyxd", `register polyxd ${URL_}`]);

  for (const d of context.subscriptions) d.dispose();
  assert.equal(calls.at(-1), "unregister polyxd");
});

test("in VS Code, a definition provider offers the HTTP server and follows the setting", { skip }, () => {
  class McpHttpServerDefinition {
    label: string;
    uri: { fsPath: string };
    version?: string;
    constructor(label: string, uri: { fsPath: string }, _headers?: Record<string, string>, version?: string) {
      this.label = label;
      this.uri = uri;
      this.version = version;
    }
  }
  let provider: { onDidChangeMcpServerDefinitions: (l: () => void) => unknown; provideMcpServerDefinitions: () => McpHttpServerDefinition[] } | undefined;
  let id = "";
  const lm = {
    registerMcpServerDefinitionProvider: (i: string, p: typeof provider) => {
      id = i;
      provider = p;
      return { dispose() {} };
    },
  };
  stub.setConfig("polyxd.mcp.enabled", undefined);
  activateWith({ lm, McpHttpServerDefinition });
  assert.equal(id, "polyxd.mcp");
  const [def] = provider!.provideMcpServerDefinitions();
  assert.equal(def.label, "Polyxd");
  assert.equal(def.uri.fsPath, URL_);
  assert.equal(def.version, "9.9.9");

  let changes = 0;
  provider!.onDidChangeMcpServerDefinitions(() => changes++);
  stub.setConfig("polyxd.mcp.enabled", false);
  stub.fire("changeConfiguration", { affectsConfiguration: (k: string) => k === "polyxd.mcp.enabled" });
  assert.equal(changes, 1);
  assert.deepEqual(provider!.provideMcpServerDefinitions(), []);
  stub.setConfig("polyxd.mcp.enabled", undefined);
});

test("in an editor with neither API, activation registers nothing and doesn't fail", { skip }, () => {
  assert.doesNotThrow(() => activateWith({}));
});
