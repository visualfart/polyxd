/** A model provider refused or failed. The message never contains the key or the prompt. */
export class GeneratorError extends Error {
  readonly provider: string;
  /** The HTTP status, when the provider answered with one. */
  readonly status?: number;
  constructor(provider: string, message: string, status?: number) {
    super(message);
    this.name = "GeneratorError";
    this.provider = provider;
    this.status = status;
  }
}

/** Options every adapter takes. */
export interface HttpOptions {
  /** Your own `fetch`, for a proxy, retries or tests. Defaults to the global one. */
  fetch?: typeof fetch;
  /** Extra request headers. */
  headers?: Record<string, string>;
}

/** POSTs JSON and returns the streaming response, or throws a `GeneratorError` for a non-2xx answer. */
export async function post(provider: string, http: HttpOptions, url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const f = http.fetch ?? globalThis.fetch;
  const res = await f(url, { method: "POST", headers: { "content-type": "application/json", ...headers, ...http.headers }, body: JSON.stringify(body), signal });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      // The status alone will do.
    }
    throw new GeneratorError(provider, `${provider} answered ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
  }
  if (!res.body) throw new GeneratorError(provider, `${provider} answered with no body`, res.status);
  return res.body;
}

export interface ServerEvent {
  event?: string;
  data: string;
}

/** Server-sent events from a response body, whatever the chunk boundaries. */
export async function* serverEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event: string | undefined;
  let data: string[] = [];
  const ready: ServerEvent[] = [];
  const line = (l: string) => {
    if (l === "") {
      if (data.length) ready.push({ event, data: data.join("\n") });
      event = undefined;
      data = [];
    } else if (l.startsWith(":")) {
      // A comment, used as a keep-alive.
    } else {
      const colon = l.indexOf(":");
      const field = colon < 0 ? l : l.slice(0, colon);
      const value = colon < 0 ? "" : l.slice(colon + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        line(buffer.slice(0, nl).replace(/\r$/, ""));
        buffer = buffer.slice(nl + 1);
      }
      if (done) {
        if (buffer) line(buffer.replace(/\r$/, ""));
        line("");
      }
      yield* ready.splice(0);
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}

/** Parses one event's data, or throws a `GeneratorError` that says which provider sent something odd. */
export function json(provider: string, data: string): any {
  try {
    return JSON.parse(data);
  } catch {
    throw new GeneratorError(provider, `${provider} sent an event that isn't JSON`);
  }
}

export const trimSlash = (url: string) => url.replace(/\/+$/, "");
