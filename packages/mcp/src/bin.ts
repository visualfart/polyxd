#!/usr/bin/env node
/**
 * `npx @polyxd/mcp`: the Polyxd MCP server over stdio. Stdout carries the protocol, so anything
 * worth saying goes to stderr.
 */
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./index.ts";

const server = createServer();
await server.connect(new StdioServerTransport());
const close = () => void server.close().finally(() => process.exit(0));
process.on("SIGINT", close);
process.on("SIGTERM", close);
