/**
 * The server's settings from environment variables, as `npx @polyxd/server` and the Docker image
 * read them. Keys are read here and handed to the adapter; nothing prints or logs them.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { anthropic, gemini, local, openai, type CapabilityRegistry, type Direction, type Generator } from "@polyxd/runtime";
import type { ServerOptions } from "./server.ts";

export const PROVIDERS = ["anthropic", "openai", "gemini", "local"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** A setting is missing or wrong. The message says which, and what to set. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface Config {
  options: ServerOptions;
  port: number;
  host: string;
  provider: Provider;
  model: string;
}

type Env = Record<string, string | undefined>;

const KEY_NAMES: Record<Provider, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  local: [],
};

function readJson(what: string, path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new ConfigError(`${what} couldn't be read from ${path}: ${(err as Error).message}`);
  }
}

function number(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new ConfigError(`${name} is a whole number, not "${raw}".`);
  return n;
}

/** The generator for POLYXD_PROVIDER, POLYXD_MODEL, the key and POLYXD_BASE_URL. */
export function generatorFromEnv(env: Env = process.env): { generator: Generator; provider: Provider; model: string } {
  const provider = env.POLYXD_PROVIDER as Provider;
  if (!PROVIDERS.includes(provider)) throw new ConfigError(`Set POLYXD_PROVIDER to one of ${PROVIDERS.join(", ")}${env.POLYXD_PROVIDER ? `, not "${env.POLYXD_PROVIDER}"` : ""}.`);
  const model = env.POLYXD_MODEL || undefined;
  const baseURL = env.POLYXD_BASE_URL || undefined;
  const keyName = ["POLYXD_API_KEY", ...KEY_NAMES[provider]].find((k) => env[k]);
  const apiKey = keyName ? env[keyName] : undefined;
  if (provider !== "anthropic" && !model) throw new ConfigError(`Set POLYXD_MODEL to the ${provider} model id to use.`);
  // A proxy at POLYXD_BASE_URL may add the key itself.
  if (provider !== "local" && !apiKey && !baseURL) throw new ConfigError(`Set POLYXD_API_KEY (or ${KEY_NAMES[provider].join(" or ")}) to your ${provider} key.`);
  switch (provider) {
    case "anthropic":
      return { generator: anthropic({ apiKey, model, baseURL }), provider, model: model ?? "claude-sonnet-5" };
    case "openai":
      return { generator: openai({ apiKey, model: model!, baseURL }), provider, model: model! };
    case "gemini":
      return { generator: gemini({ apiKey, model: model!, baseURL }), provider, model: model! };
    case "local":
      return { generator: local({ apiKey, model: model!, baseURL }), provider, model: model! };
  }
}

/** Every setting, from the environment. Throws a `ConfigError` that says what to fix. */
export function configFromEnv(env: Env = process.env): Config {
  const { generator, provider, model } = generatorFromEnv(env);
  const options: ServerOptions = {
    generator,
    token: env.POLYXD_SERVER_TOKEN || undefined,
    corsOrigins: (env.POLYXD_CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    maxBodyBytes: number(env, "POLYXD_MAX_BODY_BYTES", 1024 * 1024),
    timeoutMs: number(env, "POLYXD_TIMEOUT_MS", 120_000),
    maxRepairs: number(env, "POLYXD_MAX_REPAIRS", 2),
  };
  if (env.POLYXD_DIRECTION) {
    const path = resolve(env.POLYXD_DIRECTION);
    options.direction = readJson("The Design Direction (POLYXD_DIRECTION)", path) as Direction;
    // An exemplar's document is a path, relative to the Direction's own file.
    options.resolveExemplar = (p) => readJson(`The exemplar ${p}`, resolve(dirname(path), p));
  }
  if (env.POLYXD_REGISTRY) {
    const registry = readJson("The capability registry (POLYXD_REGISTRY)", resolve(env.POLYXD_REGISTRY));
    if (!registry || typeof registry.capabilities !== "object" || registry.capabilities === null) throw new ConfigError("POLYXD_REGISTRY is a capability registry: { name, capabilities: { ... } }.");
    options.registry = registry as CapabilityRegistry;
  }
  const port = number(env, "PORT", 8080);
  return { options, port, host: env.HOST || "127.0.0.1", provider, model };
}

export const ENV_HELP = `polyxd-server: a Polyxd generation server around @polyxd/runtime.

Settings, from the environment:
  POLYXD_PROVIDER        anthropic, openai, gemini or local (required)
  POLYXD_MODEL           the model id (required except for anthropic, which defaults to claude-sonnet-5)
  POLYXD_API_KEY         the provider key; or ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
  POLYXD_BASE_URL        the provider's base URL: a local server (default http://localhost:11434/v1) or a proxy
  POLYXD_DIRECTION       path to your Design Direction (direction.json)
  POLYXD_REGISTRY        path to your capability registry, so callers can offer capabilities by name
  POLYXD_SERVER_TOKEN    require Authorization: Bearer <token> on every endpoint but /v1/health
  POLYXD_CORS_ORIGINS    comma-separated origins a browser may call from, or *
  POLYXD_MAX_BODY_BYTES  largest request body (default 1048576)
  POLYXD_TIMEOUT_MS      longest generation (default 120000)
  POLYXD_MAX_REPAIRS     repairs per generation (default 2)
  PORT, HOST             where to listen (default 8080 on 127.0.0.1)

Endpoints: POST /v1/generate (JSON, or text/event-stream), POST /v1/validate, POST /v1/verify,
GET /v1/health, GET /v1/spec. See https://polyxd.com/docs/server/
`;
