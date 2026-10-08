/**
 * The Polyxd MCP server, offered to the editor's agent: the hosted server at mcp.polyxd.com, the
 * same one the Cursor plugin and the MCP Registry entry point at. Cursor takes it through
 * `vscode.cursor.mcp.registerServer`; VS Code (1.101 and later) through an MCP server definition
 * provider, so it appears in the agent's tools and in "MCP: List Servers". Editors with neither
 * (Windsurf, VSCodium on an older base) are left alone. The extension itself opens no connection:
 * the editor does, when its agent uses a tool.
 *
 * The `polyxd.mcp.enabled` setting turns it off and on without a reload.
 */
import * as vscode from "vscode";

export const MCP_URL = "https://mcp.polyxd.com/mcp";
const NAME = "polyxd";
const LABEL = "Polyxd";
/** The provider id in package.json's `contributes.mcpServerDefinitionProviders`. */
export const PROVIDER_ID = "polyxd.mcp";

/** Cursor's extension API for MCP servers (https://cursor.com/docs/context/mcp-extension-api). */
interface CursorMcp {
  registerServer(config: { name: string; server: { url: string; headers?: Record<string, string> } }): void;
  unregisterServer(name: string): void;
}

/** The parts of VS Code's MCP API used here, typed locally since the extension targets 1.96. */
interface VsCodeMcp {
  lm?: {
    registerMcpServerDefinitionProvider?(
      id: string,
      provider: { onDidChangeMcpServerDefinitions: vscode.Event<void>; provideMcpServerDefinitions(): unknown[] },
    ): vscode.Disposable;
  };
  McpHttpServerDefinition?: new (label: string, uri: vscode.Uri, headers?: Record<string, string>, version?: string) => unknown;
}

const enabled = () => vscode.workspace.getConfiguration("polyxd").get<boolean>("mcp.enabled") !== false;

/** Which route this editor offers: Cursor's, VS Code's, or none. */
export function mcpRoute(api: unknown = vscode): "cursor" | "vscode" | undefined {
  const cursor = (api as { cursor?: { mcp?: Partial<CursorMcp> } }).cursor?.mcp;
  if (typeof cursor?.registerServer === "function") return "cursor";
  const v = api as VsCodeMcp;
  if (typeof v.lm?.registerMcpServerDefinitionProvider === "function" && typeof v.McpHttpServerDefinition === "function") return "vscode";
  return undefined;
}

export function registerMcp(context: vscode.ExtensionContext, version?: string): void {
  const route = mcpRoute();
  if (route === "cursor") {
    const mcp = (vscode as unknown as { cursor: { mcp: CursorMcp } }).cursor.mcp;
    let registered = false;
    const sync = () => {
      try {
        if (enabled() && !registered) mcp.registerServer({ name: NAME, server: { url: MCP_URL } });
        else if (!enabled() && registered) mcp.unregisterServer(NAME);
        else return;
        registered = !registered;
      } catch (e) {
        console.warn("Polyxd: couldn't register the MCP server with Cursor", e);
      }
    };
    sync();
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration("polyxd.mcp.enabled") && sync()),
      { dispose: () => registered && mcp.unregisterServer(NAME) },
    );
  } else if (route === "vscode") {
    const v = vscode as unknown as Required<VsCodeMcp> & { lm: Required<NonNullable<VsCodeMcp["lm"]>> };
    const changed = new vscode.EventEmitter<void>();
    context.subscriptions.push(
      changed,
      v.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
        onDidChangeMcpServerDefinitions: changed.event,
        provideMcpServerDefinitions: () => (enabled() ? [new v.McpHttpServerDefinition(LABEL, vscode.Uri.parse(MCP_URL), {}, version)] : []),
      }),
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration("polyxd.mcp.enabled") && changed.fire()),
    );
  }
}
