import { readdirSync, readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer } from "../src/index.ts";

// The examples as the spec's workspace holds them, to compare with what the server serves.
const examplesDir = new URL("../../spec/examples/", import.meta.url);
export const exampleFiles = readdirSync(examplesDir).filter((f) => f.endsWith(".json")).sort();
export const loadExample = (f: string): any => JSON.parse(readFileSync(new URL(f, examplesDir), "utf8"));

/** A client and the server, joined in memory. The client says it can show MCP Apps, as a host would. */
export async function connect() {
  const server = createServer();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "test-host", version: "0.0.0" },
    { capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } } as any },
  );
  await server.connect(serverSide);
  await client.connect(clientSide);
  return { client, server, close: async () => (await client.close(), await server.close()) };
}

export const textOf = (r: any): string => (r.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
