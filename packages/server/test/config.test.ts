import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { configFromEnv, ConfigError, generatorFromEnv } from "../src/index.ts";

const specExamples = fileURLToPath(new URL("../../spec/examples/", import.meta.url));

test("POLYXD_PROVIDER picks the adapter, and each provider says what else it needs", () => {
  assert.throws(() => generatorFromEnv({}), (e: Error) => e instanceof ConfigError && /POLYXD_PROVIDER/.test(e.message));
  assert.throws(() => generatorFromEnv({ POLYXD_PROVIDER: "cohere" }), /not "cohere"/);
  assert.throws(() => generatorFromEnv({ POLYXD_PROVIDER: "openai", OPENAI_API_KEY: "k" }), /POLYXD_MODEL/);
  assert.throws(() => generatorFromEnv({ POLYXD_PROVIDER: "gemini", POLYXD_MODEL: "m" }), /GEMINI_API_KEY or GOOGLE_API_KEY/);
  assert.throws(() => generatorFromEnv({ POLYXD_PROVIDER: "local" }), /POLYXD_MODEL/);

  const claude = generatorFromEnv({ POLYXD_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" });
  assert.equal(claude.generator.name, "anthropic");
  assert.equal(claude.model, "claude-sonnet-5");
  assert.equal(generatorFromEnv({ POLYXD_PROVIDER: "openai", POLYXD_MODEL: "m", POLYXD_API_KEY: "k" }).generator.name, "openai");
  assert.equal(generatorFromEnv({ POLYXD_PROVIDER: "gemini", POLYXD_MODEL: "m", GOOGLE_API_KEY: "k" }).generator.name, "gemini");
  assert.equal(generatorFromEnv({ POLYXD_PROVIDER: "local", POLYXD_MODEL: "qwen3:8b" }).generator.name, "local");
  // A proxy at the base URL may add the key.
  assert.equal(generatorFromEnv({ POLYXD_PROVIDER: "openai", POLYXD_MODEL: "m", POLYXD_BASE_URL: "http://proxy/v1" }).generator.name, "openai");
});

test("the key reaches the provider, and POLYXD_API_KEY wins over the provider's own name", async () => {
  const seen: Record<string, string>[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    seen.push(init.headers as Record<string, string>);
    return new Response("no", { status: 401 });
  }) as typeof fetch;
  try {
    const { generator } = generatorFromEnv({ POLYXD_PROVIDER: "anthropic", POLYXD_API_KEY: "polyxd-key", ANTHROPIC_API_KEY: "other-key" });
    await assert.rejects(generator.generate({ system: "s", messages: [{ role: "user", content: "u" }] }));
    assert.equal(seen[0]["x-api-key"], "polyxd-key");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the rest of the settings, with their defaults", () => {
  const base = { POLYXD_PROVIDER: "local", POLYXD_MODEL: "m" };
  const d = configFromEnv(base);
  assert.equal(d.port, 8080);
  assert.equal(d.host, "127.0.0.1", "only this machine, unless HOST says otherwise");
  assert.deepEqual(d.options.corsOrigins, []);
  assert.equal(d.options.token, undefined);
  assert.equal(d.options.maxBodyBytes, 1024 * 1024);
  assert.equal(d.options.timeoutMs, 120_000);

  const c = configFromEnv({ ...base, PORT: "9000", HOST: "0.0.0.0", POLYXD_SERVER_TOKEN: "t", POLYXD_CORS_ORIGINS: "https://a.example, https://b.example", POLYXD_MAX_BODY_BYTES: "2048", POLYXD_TIMEOUT_MS: "5000", POLYXD_MAX_REPAIRS: "1" });
  assert.equal(c.port, 9000);
  assert.equal(c.host, "0.0.0.0");
  assert.equal(c.options.token, "t");
  assert.deepEqual(c.options.corsOrigins, ["https://a.example", "https://b.example"]);
  assert.equal(c.options.maxBodyBytes, 2048);
  assert.equal(c.options.timeoutMs, 5000);
  assert.equal(c.options.maxRepairs, 1);
  assert.throws(() => configFromEnv({ ...base, PORT: "eighty" }), /PORT is a whole number/);
});

test("the Direction and the registry are read from their files, and exemplars from beside the Direction", async () => {
  const c = configFromEnv({
    POLYXD_PROVIDER: "local",
    POLYXD_MODEL: "m",
    POLYXD_DIRECTION: `${specExamples}directions/calm-finance.json`,
    POLYXD_REGISTRY: `${specExamples}registry/capabilities.json`,
  });
  assert.equal(c.options.direction?.name, "calm-finance");
  assert.ok(c.options.registry?.capabilities["transfer.confirm"]);
  const path = c.options.direction!.exemplars!.find((e) => typeof e.document === "string")!.document as string;
  const exemplar = (await c.options.resolveExemplar!(path)) as any;
  assert.equal(typeof exemplar.root, "string");
  assert.throws(() => configFromEnv({ POLYXD_PROVIDER: "local", POLYXD_MODEL: "m", POLYXD_DIRECTION: "/nowhere/direction.json" }), /couldn't be read from \/nowhere\/direction.json/);
  assert.throws(() => configFromEnv({ POLYXD_PROVIDER: "local", POLYXD_MODEL: "m", POLYXD_REGISTRY: `${specExamples}money-send-confirm.json` }), /capability registry/);
});

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const bin = fileURLToPath(new URL(`../${pkg.bin["polyxd-server"]}`, import.meta.url));

test("the built bin explains its settings, refuses to start without a provider, and serves health", { timeout: 20_000 }, async () => {
  assert.ok(existsSync(bin), `${bin} is built (npm run build -w @polyxd/server)`);
  assert.match(readFileSync(bin, "utf8"), /^#!\/usr\/bin\/env node\n/);
  assert.match(execFileSync(process.execPath, [bin, "--help"], { encoding: "utf8" }), /POLYXD_PROVIDER/);

  const env = { PATH: process.env.PATH ?? "" };
  assert.throws(() => execFileSync(process.execPath, [bin], { env, stdio: "pipe" }), (e: any) => e.status === 1 && /POLYXD_PROVIDER/.test(String(e.stderr)));

  // A local provider pointed at nothing: the server starts, and health doesn't need the model.
  const child = spawn(process.execPath, [bin], { env: { ...env, POLYXD_PROVIDER: "local", POLYXD_MODEL: "none", POLYXD_BASE_URL: "http://127.0.0.1:9/v1", PORT: "0" }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const first = await new Promise<string>((resolve, reject) => {
      child.stdout.once("data", (d) => resolve(String(d)));
      child.once("exit", (code) => reject(new Error(`exited ${code}`)));
    });
    const { listening, provider, model } = JSON.parse(first.split("\n")[0]);
    assert.equal(provider, "local");
    assert.equal(model, "none");
    const res = await fetch(`${listening}/v1/health`);
    assert.equal(res.status, 200);
    const gen = await fetch(`${listening}/v1/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ask: "a", intent: "b" }) });
    assert.equal(gen.status, 502, "nothing is listening where the model should be");
  } finally {
    const exited = new Promise((r) => child.once("exit", r));
    child.kill("SIGTERM");
    await exited;
  }
});
