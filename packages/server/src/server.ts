/**
 * The generation server: `@polyxd/runtime` behind a small HTTP API, on Node's own `http`. It holds
 * no state between requests and logs one line per request (method, path, status, duration), never
 * an ask, its data or a document.
 */
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createRuntime, GeneratorError, type Ask, type Capability, type CapabilityRegistry, type Direction, type Generator, type Progress, type Runtime } from "@polyxd/runtime";
import { directionRules } from "@polyxd/spec";
import { SPEC_VERSION, validateDocument } from "@polyxd/spec/browser";
import { PATTERN_IDS, staticAudit } from "@polyxd/verifier/static";

const requireHere = createRequire(import.meta.url);
export const VERSION: string = requireHere("../package.json").version;

export interface ServerOptions {
  /** A runtime you built. Give this or `generator`. */
  runtime?: Runtime;
  /** A generator; the server builds the runtime around it with `direction` and the options below. */
  generator?: Generator;
  /** The product's Design Direction: applied at generation, and used by /v1/validate and /v1/verify. */
  direction?: Direction;
  /** Loads an exemplar the Direction names by path. */
  resolveExemplar?: (path: string) => unknown | Promise<unknown>;
  /** The capabilities a caller may offer by name, and what /v1/verify checks against. */
  registry?: CapabilityRegistry;
  /** How many repairs the runtime may ask for. Default 2. */
  maxRepairs?: number;
  /** When set, every endpoint but /v1/health needs `Authorization: Bearer <token>`. */
  token?: string;
  /** Origins a browser may call from. `*` allows any. Default none. */
  corsOrigins?: string[];
  /** The largest request body, in bytes. Default 1 MiB. */
  maxBodyBytes?: number;
  /** How long one generation may take, in milliseconds. Default 120000. */
  timeoutMs?: number;
  /** How often a stream sends a keep-alive comment, in milliseconds. Default 15000. */
  heartbeatMs?: number;
  /** Where the one line per request goes. Default: JSON on stdout. */
  log?: (entry: LogEntry) => void;
}

/** Everything the server logs about a request. Nothing from its body, headers or query. */
export interface LogEntry {
  method: string;
  path: string;
  status: number;
  ms: number;
}

/** The reasons a generation can end without a document, as the API reports them. */
export type ErrorCode = "invalid" | "generator" | "setup" | "aborted" | "timeout";

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const bad = (message: string) => new HttpError(400, "bad_request", message);
const isObject = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);

const ROUTES: Record<string, string> = {
  "/v1/health": "GET",
  "/v1/spec": "GET",
  "/v1/generate": "POST",
  "/v1/validate": "POST",
  "/v1/verify": "POST",
};

let components: { name: string; summary: string; shell: boolean }[] | undefined;
/** The spec's components, read once from @polyxd/spec's published files. */
function specComponents() {
  const dir = join(dirname(requireHere.resolve("@polyxd/spec/package.json")), "components");
  return (components ??= readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .map((c) => ({ name: c.name, summary: c.summary, shell: c.shell === true })));
}

export function createServer(options: ServerOptions): Server {
  if (!options.runtime && !options.generator) throw new Error("createServer needs a runtime or a generator");
  const runtime =
    options.runtime ??
    createRuntime({ generator: options.generator!, direction: options.direction, resolveExemplar: options.resolveExemplar, maxRepairs: options.maxRepairs });
  const maxBody = options.maxBodyBytes ?? 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const heartbeatMs = options.heartbeatMs ?? 15_000;
  const origins = new Set(options.corsOrigins ?? []);
  const anyOrigin = origins.has("*");
  const token = options.token ? createHash("sha256").update(options.token).digest() : undefined;
  const log = options.log ?? ((e: LogEntry) => process.stdout.write(JSON.stringify(e) + "\n"));
  const rules = options.direction ? directionRules(options.direction) : [];
  const emphasisBudget = options.direction?.profile?.emphasisBudget;

  function authorized(req: IncomingMessage): boolean {
    if (!token) return true;
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "");
    return !!m && timingSafeEqual(createHash("sha256").update(m[1].trim()).digest(), token);
  }

  function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    if (res.headersSent || res.destroyed) return;
    const text = JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(text), "cache-control": "no-store", ...headers });
    res.end(text);
  }

  const fail = (res: ServerResponse, err: HttpError, headers: Record<string, string> = {}) => send(res, err.status, { error: { code: err.code, message: err.message } }, headers);

  async function readJson(req: IncomingMessage): Promise<unknown> {
    if (!/^application\/json\s*(;|$)/i.test(req.headers["content-type"] ?? "")) throw new HttpError(415, "unsupported_media_type", "Send the body as application/json.");
    const tooLarge = new HttpError(413, "too_large", `The body is larger than ${maxBody} bytes.`);
    if (Number(req.headers["content-length"] ?? 0) > maxBody) throw tooLarge;
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
      size += chunk.length;
      if (size > maxBody) throw tooLarge;
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw bad("The body isn't valid JSON.");
    }
  }

  function only(body: Record<string, unknown>, allowed: string[], shape: string): void {
    const extra = Object.keys(body).filter((k) => !allowed.includes(k));
    if (extra.length) throw bad(`Unknown field${extra.length > 1 ? "s" : ""} ${extra.map((k) => `"${k}"`).join(", ")}. The body is ${shape}.`);
  }

  /** Capabilities by name from the registry, or given in full. */
  function capabilitiesFrom(value: unknown): Record<string, Capability> | undefined {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
      const out: Record<string, Capability> = {};
      for (const name of value) {
        if (typeof name !== "string") throw bad("capabilities is a list of names, or an object of capability definitions by name.");
        const found = options.registry?.capabilities[name];
        if (!found) throw bad(`No capability named "${name}" in this server's registry${options.registry ? "" : " (none is configured: set POLYXD_REGISTRY, or send the definitions)"}.`);
        out[name] = found;
      }
      return out;
    }
    if (!isObject(value) || Object.values(value).some((c) => !isObject(c))) throw bad("capabilities is a list of names, or an object of capability definitions by name.");
    return value as Record<string, Capability>;
  }

  function askFrom(body: unknown): Omit<Ask, "signal"> {
    const shape = "{ ask, intent, capabilities?, data?, pattern? }";
    if (!isObject(body)) throw bad(`The body is ${shape}.`);
    only(body, ["ask", "intent", "capabilities", "data", "pattern"], shape);
    if (typeof body.ask !== "string" || !body.ask.trim()) throw bad("ask is what the person asked, as a non-empty string.");
    if (typeof body.intent !== "string" || !body.intent.trim()) throw bad('intent is a stable key for what they are doing, such as "money.send".');
    if (body.pattern !== undefined && typeof body.pattern !== "string") throw bad("pattern is a spec pattern id.");
    const out: Omit<Ask, "signal"> = { ask: body.ask, intent: body.intent };
    const capabilities = capabilitiesFrom(body.capabilities);
    if (capabilities) out.capabilities = capabilities;
    if (body.data !== undefined) out.data = body.data;
    if (body.pattern !== undefined) out.pattern = body.pattern;
    return out;
  }

  function documentFrom(body: unknown, extra: string[]): { document: Record<string, unknown>; body: Record<string, any> } {
    const shape = `{ document, data?${extra.map((k) => `, ${k}?`).join("")} }`;
    if (!isObject(body)) throw bad(`The body is ${shape}.`);
    only(body, ["document", "data", ...extra], shape);
    if (!isObject(body.document)) throw bad("document is a Polyxd UI document, as a JSON object.");
    return { document: body.data === undefined ? body.document : { ...body.document, data: body.data }, body };
  }

  /** What went wrong, for the caller: never the provider's own words, which could carry anything. */
  function failure(code: ErrorCode, error: unknown): { code: ErrorCode; message: string; provider?: string; status?: number } {
    if (code === "timeout") return { code, message: `No document within ${timeoutMs} ms.` };
    if (code === "aborted") return { code, message: "The request was cancelled." };
    if (code === "invalid") return { code, message: "The model's answer still had errors after every repair." };
    if (code === "setup") return { code, message: "The server couldn't prepare the prompt." };
    if (error instanceof GeneratorError) return { code, message: `The model provider (${error.provider}) failed${error.status ? ` with HTTP ${error.status}` : ""}.`, provider: error.provider, ...(error.status ? { status: error.status } : {}) };
    return { code, message: "The model provider couldn't be reached." };
  }

  /** An abort signal for one generation: the timeout, or the caller going away. */
  function lifetime(res: ServerResponse) {
    const controller = new AbortController();
    const state = { timedOut: false, gone: false };
    const timer = setTimeout(() => {
      state.timedOut = true;
      controller.abort(new DOMException("The generation took too long", "TimeoutError"));
    }, timeoutMs);
    res.on("close", () => {
      if (res.writableFinished) return;
      state.gone = true;
      controller.abort(new DOMException("The caller went away", "AbortError"));
    });
    return { signal: controller.signal, state, done: () => clearTimeout(timer) };
  }

  async function generateJson(res: ServerResponse, ask: Omit<Ask, "signal">): Promise<void> {
    const life = lifetime(res);
    let reason: ErrorCode | undefined;
    try {
      const result = await runtime.generate({ ...ask, signal: life.signal }, { onProgress: (p) => void (p.type === "error" && (reason = p.reason)) });
      send(res, result.report.valid ? 200 : 422, result.report.valid ? result : { ...result, error: failure("invalid", undefined) });
    } catch (err) {
      if (life.state.gone) return;
      const code: ErrorCode = life.state.timedOut ? "timeout" : reason ?? "generator";
      send(res, code === "timeout" ? 504 : code === "generator" ? 502 : 500, { error: failure(code, err) });
    } finally {
      life.done();
    }
  }

  async function generateStream(res: ServerResponse, ask: Omit<Ask, "signal">): Promise<void> {
    const life = lifetime(res);
    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    res.flushHeaders();
    const write = (event: string, data: unknown) => void (!res.destroyed && res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    const heartbeat = setInterval(() => !res.destroyed && res.write(": keep-alive\n\n"), heartbeatMs);
    try {
      for await (const p of runtime.stream({ ...ask, signal: life.signal })) {
        if (life.state.gone) break;
        write(p.type, payload(p, life.state.timedOut));
      }
    } finally {
      clearInterval(heartbeat);
      life.done();
      if (!res.destroyed) res.end();
    }
  }

  function payload(p: Progress, timedOut: boolean): unknown {
    switch (p.type) {
      case "started":
        return { remembered: p.remembered, exemplars: p.exemplars };
      case "text":
        return { attempt: p.attempt, text: p.text };
      case "attempt":
      case "repaired":
        return { attempt: p.attempt, report: p.report };
      case "done":
        return p.result;
      case "error": {
        const code: ErrorCode = p.reason === "aborted" && timedOut ? "timeout" : p.reason;
        return { ...failure(code, p.error), ...(p.result ? { result: p.result } : {}) };
      }
    }
  }

  function spec() {
    const all = specComponents().filter((c) => !c.shell);
    return {
      version: VERSION,
      specVersion: SPEC_VERSION,
      components: all.map(({ name, summary }) => ({ name, summary })),
      patterns: PATTERN_IDS,
      direction: options.direction?.name ?? null,
      capabilities: Object.keys(options.registry?.capabilities ?? {}),
    };
  }

  async function route(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    if (path === "/v1/health") return send(res, 200, { status: "ok", version: VERSION });
    if (!authorized(req)) return fail(res, new HttpError(401, "unauthorized", "Send Authorization: Bearer <token>."), { "www-authenticate": "Bearer" });
    if (path === "/v1/spec") return send(res, 200, spec());
    const body = await readJson(req);
    if (path === "/v1/generate") {
      const ask = askFrom(body);
      return /\btext\/event-stream\b/.test(req.headers.accept ?? "") ? generateStream(res, ask) : generateJson(res, ask);
    }
    if (path === "/v1/validate") {
      const { document } = documentFrom(body, []);
      const v = validateDocument(document, { emphasisBudget });
      const errors = v.issues.filter((i) => i.severity === "error").length;
      return send(res, 200, { valid: v.valid, errors, warnings: v.issues.length - errors, issues: v.issues });
    }
    if (path === "/v1/verify") {
      const { document, body: b } = documentFrom(body, ["capabilities"]);
      const capabilities = capabilitiesFrom(b.capabilities);
      const registry = capabilities ? { name: "request", capabilities } : options.registry;
      const findings = staticAudit(document, { registry, rules, emphasisBudget });
      const errors = findings.filter((f) => f.severity === "error").length;
      return send(res, 200, { valid: errors === 0, errors, warnings: findings.length - errors, findings });
    }
  }

  return createHttpServer(async (req, res) => {
    const started = performance.now();
    const path = new URL(req.url ?? "/", "http://server").pathname;
    const method = req.method ?? "GET";
    res.on("close", () => log({ method, path: path.slice(0, 200), status: res.writableFinished ? res.statusCode : 499, ms: Math.round(performance.now() - started) }));
    try {
      const origin = req.headers.origin;
      if (origin !== undefined) {
        if (!anyOrigin && !origins.has(origin)) return fail(res, new HttpError(403, "forbidden_origin", "This origin may not call this server."));
        res.setHeader("access-control-allow-origin", anyOrigin ? "*" : origin);
        if (!anyOrigin) res.setHeader("vary", "Origin");
      }
      const allowed = ROUTES[path];
      if (method === "OPTIONS" && allowed) {
        res.writeHead(204, { "access-control-allow-methods": `${allowed}, OPTIONS`, "access-control-allow-headers": "authorization, content-type, accept", "access-control-max-age": "600" });
        return void res.end();
      }
      if (!allowed) return fail(res, new HttpError(404, "not_found", `No endpoint ${path}.`));
      if (method !== allowed) return fail(res, new HttpError(405, "method_not_allowed", `${path} takes ${allowed}.`), { allow: `${allowed}, OPTIONS` });
      await route(req, res, path);
    } catch (err) {
      if (err instanceof HttpError) {
        // A body that's too large is still arriving: answer, then close rather than read the rest.
        fail(res, err, err.status === 413 ? { connection: "close" } : {});
        if (err.status === 413) res.once("finish", () => req.destroy());
      } else fail(res, new HttpError(500, "internal", "Something went wrong in the server."));
    }
  });
}

