/**
 * The built bin, as `npx @polyxd/mcp` runs it: a child process speaking JSON-RPC over stdio.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const bin = fileURLToPath(new URL(`../${pkg.bin["polyxd-mcp"]}`, import.meta.url));

test("the built bin starts, answers initialize over stdio, and lists its tools", { timeout: 20_000 }, async () => {
  assert.ok(existsSync(bin), `${bin} is built (npm run build -w @polyxd/mcp)`);
  assert.match(readFileSync(bin, "utf8"), /^#!\/usr\/bin\/env node\n/);

  const child = spawn(process.execPath, [bin], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: child.stdout });
  const responses = new Map<number, any>();
  const waiters = new Map<number, (m: any) => void>();
  lines.on("line", (line) => {
    const m = JSON.parse(line);
    if (m.id === undefined) return;
    responses.set(m.id, m);
    waiters.get(m.id)?.(m);
  });
  const send = (m: object) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
  const response = (id: number) => (responses.has(id) ? Promise.resolve(responses.get(id)) : new Promise<any>((r) => waiters.set(id, r)));

  try {
    send({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0.0.0" } } });
    const init = await response(1);
    assert.equal(init.error, undefined, JSON.stringify(init.error));
    assert.equal(init.result.serverInfo.name, "polyxd");
    assert.equal(init.result.serverInfo.version, pkg.version);
    assert.ok(init.result.capabilities.tools && init.result.capabilities.resources);
    assert.match(init.result.instructions, /polyxd_guide/);

    send({ method: "notifications/initialized" });
    send({ id: 2, method: "tools/list" });
    const list = await response(2);
    assert.equal(list.result.tools.length, 7);

    send({ id: 3, method: "resources/read", params: { uri: "ui://polyxd/surface.html" } });
    const view = await response(3);
    assert.equal(view.result.contents[0].mimeType, "text/html;profile=mcp-app");
  } finally {
    child.kill();
  }
});
