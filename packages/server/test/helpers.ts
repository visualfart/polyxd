import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { GenerateRequest, Generator } from "@polyxd/runtime";
import { createServer, type LogEntry, type ServerOptions } from "../src/index.ts";

export const SPEC = new URL("../../spec/examples/", import.meta.url);
export const readSpec = (path: string) => JSON.parse(readFileSync(new URL(path, SPEC), "utf8"));
export const registry = readSpec("registry/capabilities.json");
export const calmFinance = () => readSpec("directions/calm-finance.json");

/** The data the confirmation is shown with. */
export const data = readSpec("money-send-confirm.json").data;

/** A confirmation that passes every check with `data` and the transfer.confirm capability. */
export function confirmDoc(): any {
  const doc = readSpec("money-send-confirm.json");
  delete doc.data;
  delete doc.$schema;
  return doc;
}

/** The same confirmation with a summary that points at nothing: a structural error. */
export function brokenDoc(): any {
  const doc = confirmDoc();
  doc.components[0].summary = "missing";
  return doc;
}

/** What a caller sends for the confirmation. */
export const askBody = { ask: "Send £250 to Alex for the rent", intent: "money.send", capabilities: ["transfer.confirm"], data };

export interface Fake extends Generator {
  requests: GenerateRequest[];
  /** Resolves when a request's signal aborts. */
  aborted: Promise<void>;
}

/**
 * A generator that answers from a script, streaming each answer in pieces. An answer that's a
 * function runs instead (to throw, or to hang until aborted).
 */
export function fake(answers: (string | ((req: GenerateRequest) => Promise<string> | string))[]): Fake {
  const requests: GenerateRequest[] = [];
  let onAbort: () => void = () => {};
  const aborted = new Promise<void>((r) => (onAbort = r));
  let i = 0;
  return {
    name: "fake",
    requests,
    aborted,
    async generate(req) {
      requests.push(req);
      req.signal?.addEventListener("abort", () => onAbort(), { once: true });
      const a = answers[Math.min(i++, answers.length - 1)];
      const text = typeof a === "function" ? await a(req) : a;
      for (let k = 0; k < text.length; k += 400) req.onText?.(text.slice(k, k + 400));
      return { text, usage: { inputTokens: 100, outputTokens: text.length } };
    },
  };
}

/** An answer that never comes: it waits for the request to be aborted, then fails as fetch does. */
export const hang = (req: GenerateRequest) =>
  new Promise<string>((_, reject) => req.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }));

export interface Running {
  url: string;
  logs: LogEntry[];
  close(): Promise<void>;
}

/** Starts a server on an ephemeral port, logging into an array. */
export async function start(options: Omit<ServerOptions, "log">): Promise<Running> {
  const logs: LogEntry[] = [];
  const server = createServer({ registry, ...options, log: (e) => logs.push(e) });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    logs,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}

export const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

/** Server-sent events from a response, as { event, data } with the data parsed. */
export async function events(res: Response): Promise<{ event: string; data: any }[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((block) => block.trim() && !block.startsWith(":"))
    .map((block) => {
      const lines = block.split("\n");
      const event = lines.find((l) => l.startsWith("event: "))!.slice(7);
      const data = JSON.parse(lines.filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n"));
      return { event, data };
    });
}

/** Waits until `check` is true, for up to a second. */
export async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
}
