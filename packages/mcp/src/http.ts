/**
 * The Polyxd MCP server over Streamable HTTP, as a web-standard `(Request) => Promise<Response>`
 * handler: what `https://mcp.polyxd.com/mcp` runs (apps/mcp), and what any runtime with `fetch`
 * types (Workers, Deno, Bun) can serve.
 *
 * The transport is the SDK's own `createMcpHandler`. It is stateless: every request gets a fresh
 * server from `createServer`, nothing is kept between requests, and there are no sessions. The
 * tools are pure functions of their arguments, so there is nothing a session would hold. For
 * 2025-era clients (`initialize`, then JSON-RPC over POST) GET and DELETE answer 405, which is what
 * the spec asks of a server that offers no standalone stream and no sessions. 2026-07-28 clients,
 * which put the protocol version in every request, are served too.
 *
 * Around it sit the safeguards a public server without authentication needs:
 *
 * - a body limit, checked on Content-Length before anything is read and again by the SDK as it reads;
 * - a per-request timeout, answered with a JSON-RPC error rather than a hung connection;
 * - an optional rate limit, which the caller keys (apps/mcp keys it on the client's IP);
 * - CORS for browser-based clients such as the MCP Inspector. Every origin may call: the server
 *   holds no credentials and no one's data, so there is nothing for another origin to reach that
 *   it could not fetch itself. (The spec's Origin check exists to stop DNS rebinding against
 *   servers on a private network or localhost; this one is public by design.)
 * - one log line per request: method, path, status and duration. Nothing else, ever: not a body,
 *   a header, a query string, an IP address or an error message (which can quote the body).
 */
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer, type ServerOptions } from "./server.ts";

export { VERSION } from "./server.ts";

/** Everything logged about a request. */
export interface RequestLog {
  method: string;
  path: string;
  status: number;
  ms: number;
}

export interface HttpHandlerOptions extends ServerOptions {
  /** The largest request body accepted, in bytes. Larger is answered 413. Default 1 MiB. */
  maxBodyBytes?: number;
  /** How long a request may take before it is answered 504. Default 15 seconds. */
  timeoutMs?: number;
  /** Decides whether a request may go ahead; false answers 429. Called for every request except CORS preflights. */
  rateLimit?: (request: Request) => boolean | Promise<boolean>;
  /** Where the one line per request goes. Default: JSON on the console. */
  log?: (entry: RequestLog) => void;
}

export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 15_000;

const ALLOW_METHODS = "GET, POST, DELETE, OPTIONS";
/** Asked for when a preflight names no headers; otherwise the preflight's own list is allowed (it includes 2026's Mcp-Param-* headers). */
const ALLOW_HEADERS = "Content-Type, Accept, Authorization, Last-Event-ID, Mcp-Session-Id, Mcp-Protocol-Version, Mcp-Method, Mcp-Name";
const EXPOSE_HEADERS = "Mcp-Session-Id, Mcp-Protocol-Version";

/** A JSON-RPC error with no request id, for failures before the request reached the server. */
function rpcError(status: number, code: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code, message } }), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** The JSON-RPC messages in a request body (one, or a batch), or none when it is not JSON. Read from a clone, within the body limit. */
async function requestMessages(request: Request): Promise<any[]> {
  try {
    const parsed = JSON.parse(await request.text());
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

/**
 * The response body, cut off at the deadline. An SSE answer still owed a result gets a JSON-RPC
 * error for each request instead (`lateEvents`), so the client hears why rather than seeing the
 * stream stop; any other body just errors.
 */
function holdToDeadline(body: ReadableStream<Uint8Array>, expired: Promise<"expired">, on: { end: () => void; expire: () => void }, lateEvents: string): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await Promise.race([reader.read(), expired]);
      if (next === "expired") {
        on.expire();
        void reader.cancel().catch(() => {});
        if (lateEvents) {
          controller.enqueue(new TextEncoder().encode(lateEvents));
          controller.close();
        } else controller.error(new DOMException("The request took too long", "TimeoutError"));
      } else if (next.done) {
        on.end();
        controller.close();
      } else controller.enqueue(next.value);
    },
    cancel(reason) {
      on.end();
      return reader.cancel(reason);
    },
  });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-expose-headers", EXPOSE_HEADERS);
  if (response.status === 405 && !headers.has("allow")) headers.set("allow", "POST, OPTIONS");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function preflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": ALLOW_METHODS,
      "access-control-allow-headers": request.headers.get("access-control-request-headers") || ALLOW_HEADERS,
      "access-control-max-age": "86400",
      vary: "Access-Control-Request-Headers",
    },
  });
}

/** The Streamable HTTP endpoint, with its safeguards. Serve it at one path (`/mcp`). */
export function createHttpHandler(options: HttpHandlerOptions): (request: Request) => Promise<Response> {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = options.log ?? ((entry: RequestLog) => console.log(JSON.stringify(entry)));
  const mcp = createMcpHandler(() => createServer(options), {
    legacy: "stateless",
    maxRequestBodySize: maxBodyBytes,
    // The tools never change, so a client listening for list changes hears nothing; keep few such streams open.
    maxSubscriptions: 64,
    // Errors are not logged: their messages can quote what the client sent, and the request's own
    // line already carries the status that says it failed.
    onerror: () => {},
  });

  async function serve(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return preflight(request);
    if (options.rateLimit && !(await options.rateLimit(request))) {
      return rpcError(429, -32000, "Too many requests from this address. Wait a minute and try again.", { "retry-after": "60" });
    }
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > maxBodyBytes) return rpcError(413, -32600, `The request body is larger than ${maxBodyBytes} bytes.`, { connection: "close" });

    // The deadline covers the whole answer, not just its headers: a 2025-era answer is an SSE
    // stream whose headers go out before the result is ready.
    const timeout = new AbortController();
    const signal = AbortSignal.any([request.signal, timeout.signal]);
    const peek = request.method === "POST" ? request.clone() : undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<"expired">((resolve) => (timer = setTimeout(() => resolve("expired"), timeoutMs)));
    // A body nobody reads never clears its deadline; in Node, don't let that keep the process up.
    (timer as { unref?: () => void } | undefined)?.unref?.();
    const expire = () => timeout.abort(new DOMException("The request took too long", "TimeoutError"));
    const late = `The server did not answer within ${timeoutMs} ms.`;
    try {
      const response = await Promise.race([mcp.fetch(new Request(request, { signal })), expired]);
      if (response === "expired") {
        expire();
        void peek?.body?.cancel();
        return rpcError(504, -32603, late);
      }
      const sse = (response.headers.get("content-type") ?? "").includes("text/event-stream");
      // Only a stream needs the request's ids, and the SDK only streams for a body it accepted, so this read stays within the limit.
      if (!sse) void peek?.body?.cancel();
      const messages = sse && peek ? await requestMessages(peek) : [];
      // A subscriptions/listen stream is meant to stay open.
      if (!response.body || (sse && messages.some((m) => m?.method === "subscriptions/listen"))) {
        clearTimeout(timer);
        return response;
      }
      const ids = messages.filter((m) => m && m.id !== undefined && typeof m.method === "string").map((m) => m.id);
      const lateEvents = sse ? ids.map((id) => `\n\nevent: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message: late } })}\n\n`).join("") : "";
      const body = holdToDeadline(response.body, expired, { end: () => clearTimeout(timer), expire }, lateEvents);
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch {
      clearTimeout(timer);
      return rpcError(500, -32603, "The server failed to handle the request.");
    }
  }

  return async (request) => {
    const started = Date.now();
    const response = withCors(await serve(request));
    log({ method: request.method, path: new URL(request.url).pathname.slice(0, 200), status: response.status, ms: Date.now() - started });
    return response;
  };
}

/**
 * A fixed-window rate limit held in memory: at most `limit` requests per `windowMs` for each key
 * (by default the client's IP from `CF-Connecting-IP`). Best effort: each process, or each Worker
 * isolate, counts on its own, so a client spread over several isolates gets more. Use it where the
 * platform has nothing better; apps/mcp uses Cloudflare's rate limiting binding and falls back to this.
 */
export function rateLimiter(options: { limit: number; windowMs: number; key?: (request: Request) => string }): (request: Request) => boolean {
  const key = options.key ?? ((request: Request) => request.headers.get("cf-connecting-ip") ?? "unknown");
  const windows = new Map<string, { start: number; count: number }>();
  return (request) => {
    const now = Date.now();
    // Forget finished windows now and then, so the map cannot grow without bound.
    if (windows.size > 10_000) for (const [k, w] of windows) if (now - w.start >= options.windowMs) windows.delete(k);
    const k = key(request);
    const w = windows.get(k);
    if (!w || now - w.start >= options.windowMs) {
      windows.set(k, { start: now, count: 1 });
      return true;
    }
    w.count++;
    return w.count <= options.limit;
  };
}
