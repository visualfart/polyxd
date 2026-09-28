import { anthropic, createRuntime, gemini, memoryStore, openai, type Capability, type Generator, type RuntimeEvent, type UIDocument } from "@polyxd/runtime";
import { ASK_MAX, INTENT_KEY, LIVE_API, PREVIOUS_MAX, actionNames, isDocument, liveCapabilities, liveIntentKey, sse, type GenerateRequestBody, type LiveEvent } from "../kit/live.ts";
import { fakeGenerator } from "./fake.ts";
import { PRODUCTS, type LiveProduct } from "./products.ts";

/**
 * The demos' live endpoint, served by the site's Worker (and by Vite in development):
 *
 *   GET  /demos/api/live      200 { live: true } when a model is configured, else 503 { live: false }
 *   POST /demos/api/generate  { product, ask, intent?, previous?, capabilities? } → server-sent events
 *
 * It is off unless the Worker has a model key as a secret. Then it runs `@polyxd/runtime` with the
 * product's Design Direction, its own low-risk capabilities and its seed data, checks and repairs
 * the answer, and streams progress. Anything that doesn't pass is "not yet", never a screen.
 * Nothing about the ask is logged: only counts, timings and check ids.
 */
export interface LiveEnv {
  /** The simplest way on: an Anthropic key. The model is POLYXD_MODEL, or the runtime's default. */
  ANTHROPIC_API_KEY?: string;
  /** Or a provider (anthropic, openai, gemini) with POLYXD_API_KEY and POLYXD_MODEL. */
  POLYXD_PROVIDER?: string;
  POLYXD_API_KEY?: string;
  POLYXD_MODEL?: string;
  /** Development only: "1" answers with a canned generator, on a local host only. */
  POLYXD_DEMOS_FAKE?: string;
}

export interface LiveApiOptions {
  products?: Record<string, LiveProduct>;
  /** Picks the generator for a request. Default: from the environment (see LiveEnv). */
  generator?: (env: LiveEnv, url: URL, product: string) => Generator | undefined;
  /** Asks per client per window. Default 6 a minute. */
  rateLimit?: { max: number; windowMs: number };
  /** Whole-request limit, model calls and repairs included. Default 90 seconds. */
  timeoutMs?: number;
  /** Repairs after the first answer. Default 1, so an ask costs at most two model calls. */
  maxRepairs?: number;
  now?: () => number;
  /** One line per generation: product, outcome, counts and timings. Never the ask. Default console.log. */
  log?: (line: Record<string, unknown>) => void;
}

/** The Worker's execution context: keeps it alive until a stream finishes. */
export interface LiveContext {
  waitUntil(promise: Promise<unknown>): void;
}

const BODY_MAX = 64_000;
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost)$/i;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

/** The model the environment names, or none. A key only ever comes from the environment (a Worker secret). */
export function generatorFromEnv(env: LiveEnv, url: URL, product: string): Generator | undefined {
  const provider = (env.POLYXD_PROVIDER || (env.ANTHROPIC_API_KEY ? "anthropic" : "")).trim().toLowerCase();
  const apiKey = env.POLYXD_API_KEY || (provider === "anthropic" ? env.ANTHROPIC_API_KEY : undefined);
  const model = env.POLYXD_MODEL?.trim() || undefined;
  const fetch = (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init);
  if (provider && apiKey) {
    if (provider === "anthropic") return anthropic({ apiKey, model, fetch });
    if (provider === "openai" && model) return openai({ apiKey, model, fetch });
    if (provider === "gemini" && model) return gemini({ apiKey, model, fetch });
  }
  if (env.POLYXD_DEMOS_FAKE === "1" && LOCAL.test(url.hostname)) return fakeGenerator(product, { delayMs: 40 });
  return undefined;
}

/** A sliding window per client, in this isolate's memory. Clients are kept as a hash, not an address. */
export function rateLimiter({ max, windowMs }: { max: number; windowMs: number }, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (client: string): { ok: true } | { ok: false; retryAfter: number } => {
    const t = now();
    const recent = (hits.get(client) ?? []).filter((at) => t - at < windowMs);
    if (recent.length >= max) {
      hits.set(client, recent);
      return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000)) };
    }
    recent.push(t);
    hits.set(client, recent);
    if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((at) => t - at < windowMs)) hits.delete(k);
    return { ok: true };
  };
}

/** FNV-1a: enough to tell clients apart without keeping their addresses. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}
const clientOf = (request: Request) => hash(request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local");

/** A remembered screen is only passed on when it looks like one and isn't large. */
function previousOf(v: unknown): UIDocument | undefined {
  if (!isDocument(v)) return undefined;
  const { data: _data, ...doc } = v;
  return JSON.stringify(doc).length <= PREVIOUS_MAX ? (doc as UIDocument) : undefined;
}

export function createLiveApi(options: LiveApiOptions = {}) {
  const products: Record<string, LiveProduct> = options.products ?? PRODUCTS;
  const pick = options.generator ?? generatorFromEnv;
  const now = options.now ?? Date.now;
  const limited = rateLimiter(options.rateLimit ?? { max: 6, windowMs: 60_000 }, now);
  const log = options.log ?? ((line) => console.log(JSON.stringify(line)));
  const configured = (env: LiveEnv, url: URL) => pick(env, url, "halden") !== undefined;

  return async function handle(request: Request, env: LiveEnv, ctx?: LiveContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (path === `${LIVE_API}/live`) {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Use GET." }, 405, { allow: "GET, HEAD" });
      return configured(env, url) ? json({ live: true }) : json({ live: false }, 503);
    }
    if (path !== `${LIVE_API}/generate`) return json({ error: "Not found." }, 404);
    if (request.method !== "POST") return json({ error: "Use POST." }, 405, { allow: "POST" });
    if (!configured(env, url)) return json({ live: false }, 503);

    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ error: "Cross-site requests aren't allowed." }, 403);
    const turn = limited(clientOf(request));
    if (!turn.ok) return json({ error: "Too many asks. Try again in a minute." }, 429, { "retry-after": String(turn.retryAfter) });

    if (Number(request.headers.get("content-length") ?? 0) > BODY_MAX) return json({ error: "That request is too large." }, 413);
    let body: Partial<GenerateRequestBody>;
    try {
      const text = await request.text();
      if (text.length > BODY_MAX) return json({ error: "That request is too large." }, 413);
      body = JSON.parse(text);
      if (!body || typeof body !== "object") throw new Error();
    } catch {
      return json({ error: "Send the ask as JSON." }, 400);
    }

    const product = typeof body.product === "string" && Object.hasOwn(products, body.product) ? products[body.product] : undefined;
    if (!product) return json({ error: "No such product." }, 404);
    const ask = typeof body.ask === "string" ? body.ask.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() : "";
    if (!ask) return json({ error: "Ask something." }, 400);
    if (ask.length > ASK_MAX) return json({ error: `Ask in ${ASK_MAX} characters or fewer.` }, 400);
    const intent = typeof body.intent === "string" && INTENT_KEY.test(body.intent) ? body.intent : liveIntentKey(ask);
    const wanted = Array.isArray(body.capabilities) ? body.capabilities.filter((c): c is string => typeof c === "string").slice(0, 100) : undefined;
    const capabilities = liveCapabilities(product.registry, product.spec, wanted);
    const offered = Object.keys(capabilities).sort();

    const generator = pick(env, url, product.spec.product);
    if (!generator) return json({ live: false }, 503);
    const memory = memoryStore();
    const previous = previousOf(body.previous);
    if (previous) memory.set(intent, previous);

    const started = now();
    let summary: Record<string, unknown> = { product: product.spec.product, outcome: "unknown" };
    const onEvent = (e: RuntimeEvent) => {
      if (e.type === "done") summary = { product: product.spec.product, outcome: "done", attempts: e.attempts, warnings: e.warnings, inputTokens: e.inputTokens, outputTokens: e.outputTokens };
      if (e.type === "error") summary = { product: product.spec.product, outcome: e.reason, attempts: e.attempts, status: e.status, checks: e.checks };
    };
    const runtime = createRuntime({
      generator,
      direction: { ...product.direction, exemplars: product.exemplars },
      memory,
      maxRepairs: options.maxRepairs ?? 1,
      onEvent,
    });

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const send = (e: LiveEvent) => writer.write(encoder.encode(sse(e))).catch(() => undefined);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(options.timeoutMs ?? 90_000)]);

    const work = (async () => {
      let attempt = 1;
      let chars = 0;
      let sentAt = 0;
      let finished = false;
      try {
        for await (const p of runtime.stream({ ask, intent, capabilities: capabilities as Record<string, Capability>, data: product.data(), signal })) {
          if (p.type === "started") await send({ type: "started", remembered: p.remembered });
          else if (p.type === "text") {
            if (p.attempt !== attempt) [attempt, chars] = [p.attempt, 0];
            chars += p.text.length;
            if (now() - sentAt >= 120) {
              sentAt = now();
              await send({ type: "progress", attempt, chars });
            }
          } else if (p.type === "attempt") {
            await send({ type: "progress", attempt: p.attempt, chars });
            await send({ type: "attempt", attempt: p.attempt, valid: p.report.valid, errors: p.report.errors, warnings: p.report.warnings });
          } else if (p.type === "done") {
            finished = true;
            const doc = p.result.document;
            // The runtime checked the capabilities; this is the belt to its braces.
            const stray = doc ? actionNames(doc).filter((n) => !offered.includes(n)) : [];
            if (!doc || !isDocument(doc) || stray.length) {
              summary = { ...summary, outcome: "capability" };
              await send({ type: "not-yet", reason: "capability" });
            } else {
              const { data: _seed, ...document } = doc;
              await send({ type: "done", intent, document: document as UIDocument, capabilities: offered, attempts: p.result.attempts, warnings: p.result.report.warnings });
            }
          } else if (p.type === "error") {
            finished = true;
            await send({ type: "not-yet", reason: p.reason });
          }
        }
        if (!finished) await send({ type: "not-yet", reason: signal.aborted ? "aborted" : "incomplete" });
      } catch {
        summary = { ...summary, outcome: "failed" };
        await send({ type: "not-yet", reason: "failed" });
      } finally {
        try {
          log({ at: "demos.live", ...summary, ms: Math.round(now() - started) });
        } catch {
          /* logging never breaks a stream */
        }
        await writer.close().catch(() => undefined);
      }
    })();
    ctx?.waitUntil(work);

    return new Response(readable, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
  };
}
