/**
 * Talks to a running server over real HTTP with the official SDK client: `wrangler dev`, or the
 * deployed one. Calls every tool and reads the MCP App page, in both protocol eras.
 *
 *   npm run dev -w @polyxd/mcp-remote                    then, in another terminal:
 *   node apps/mcp/scripts/smoke.ts http://127.0.0.1:8787/mcp
 *   node apps/mcp/scripts/smoke.ts https://mcp.polyxd.com/mcp
 */
import { readFileSync } from "node:fs";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = new URL(process.argv[2] ?? "http://127.0.0.1:8787/mcp");
const example = (name: string) => JSON.parse(readFileSync(new URL(`../../../packages/spec/examples/${name}.json`, import.meta.url), "utf8"));
const firstLine = (r: any) => String(r.content?.find((c: any) => c.type === "text")?.text ?? "").split("\n")[0].slice(0, 90);

async function run(label: string, negotiation?: object) {
  const client = new Client({ name: "polyxd-smoke", version: "0.0.0" }, negotiation ? ({ versionNegotiation: negotiation } as any) : undefined);
  let started = performance.now();
  await client.connect(new StreamableHTTPClientTransport(url));
  console.log(`\n${label}: connected to ${client.getServerVersion()?.name} ${client.getServerVersion()?.version} in ${Math.round(performance.now() - started)} ms`);
  const time = async <T>(what: string, fn: () => Promise<T>, show: (r: T) => string) => {
    started = performance.now();
    const r = await fn();
    console.log(`  ${what.padEnd(34)} ${String(Math.round(performance.now() - started)).padStart(4)} ms  ${show(r)}`);
    return r;
  };
  const doc = example("tasks-add");
  await time("tools/list", () => client.listTools(), (r) => r.tools.map((t) => t.name).join(", "));
  await time("polyxd_guide", () => client.callTool({ name: "polyxd_guide", arguments: {} }), (r) => `${String((r as any).content[0].text).length} chars`);
  await time("polyxd_validate tasks-add", () => client.callTool({ name: "polyxd_validate", arguments: { document: doc } }), firstLine);
  await time("polyxd_verify money-send-form", () => client.callTool({ name: "polyxd_verify", arguments: { document: example("money-send-form"), direction: "calm-finance" } }), firstLine);
  await time("polyxd_show tasks-add (govuk)", () => client.callTool({ name: "polyxd_show", arguments: { document: doc, pack: "govuk" } }), firstLine);
  await time("polyxd_packs", () => client.callTool({ name: "polyxd_packs", arguments: {} }), firstLine);
  await time("polyxd_components Choice", () => client.callTool({ name: "polyxd_components", arguments: { name: "Choice" } }), (r) => `${(r as any).structuredContent.component.name}`);
  await time("resources/list", () => client.listResources(), (r) => `${r.resources.length} resources`);
  await time("resources/read ui://polyxd/surface.html", () => client.readResource({ uri: "ui://polyxd/surface.html" }), (r) => {
    const c = r.contents[0] as any;
    return `${c.mimeType}, ${Math.round(c.text.length / 1024)} KB, csp ${JSON.stringify(c._meta?.ui?.csp)}`;
  });
  await client.close();
}

await run("2025-11-25 (initialize handshake)");
await run("2026-07-28 (per-request envelope)", { mode: { pin: "2026-07-28" } });
