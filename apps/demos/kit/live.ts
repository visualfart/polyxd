import type { ActionEvent, UIDocument } from "@polyxd/react";
import type { MemoryStore, StorageLike } from "@polyxd/runtime";
import { matchAsk, tokens, type IntentDef } from "./ask.ts";
import type { IntentFile, Registry } from "./types.ts";

/**
 * Live generation, the part the browser and the endpoint share. When an ask matches nothing in a
 * product's verified library, and the site has a model key, the endpoint (`server/live.ts`) writes
 * a screen for it with `@polyxd/runtime` and streams its progress back as server-sent events. With
 * no key the endpoint answers 503 and the product says "not yet", exactly as it did before.
 *
 * No React here: the endpoint and the tests use it too.
 */

/** Where the endpoint lives, beside the demos. */
export const LIVE_API = "/demos/api";
/** The longest ask the endpoint takes. Longer asks are refused, not cut. */
export const ASK_MAX = 200;
/** The largest remembered screen a request may carry back to the endpoint (JSON characters). */
export const PREVIOUS_MAX = 24_000;

/**
 * What a product lets a generated screen see and do. The data is a fixed set of the product's own
 * views, built from the seed on the server (so nothing a visitor typed or changed leaves the
 * browser) and from the visitor's own data in the browser, with the same keys and shapes.
 */
export interface LiveSpec {
  product: "halden" | "foundry" | "wexley" | "quay";
  /** Surface key → `view:<name>`, the same data map an intent file has. */
  data: Record<string, string>;
  /** Capabilities a generated screen may not use although the registry has them (the shell's own, say). */
  exclude?: string[];
}

/** The risks a generated screen may carry. Consequential ones stay behind the library's verified confirmations. */
export const LIVE_RISKS = new Set(["none", "low"]);

/** The capabilities a generated screen is offered: the product's own, low risk, minus its exclusions, and only those asked for when a list is given. */
export function liveCapabilities(registry: Registry, spec: Pick<LiveSpec, "exclude">, wanted?: readonly string[]): Registry["capabilities"] {
  const out: Registry["capabilities"] = {};
  const only = wanted ? new Set(wanted) : null;
  for (const [name, cap] of Object.entries(registry.capabilities)) {
    if (!LIVE_RISKS.has(cap.risk)) continue;
    if (spec.exclude?.includes(name)) continue;
    if (only && !only.has(name)) continue;
    out[name] = cap;
  }
  return out;
}

/** Every capability a document's actions name (renderer actions, `ui.*`, aside). */
export function actionNames(doc: unknown): string[] {
  const found = new Set<string>();
  const visit = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(visit);
    const o = v as Record<string, unknown>;
    const ev = o.event as { name?: unknown } | undefined;
    if (ev && typeof ev === "object" && typeof ev.name === "string" && !ev.name.startsWith("ui.")) found.add(ev.name);
    for (const x of Object.values(o)) visit(x);
  };
  visit(doc);
  return [...found].sort();
}

/**
 * A stable intent key for an ask the library doesn't cover: the same words give the same key, so
 * interface memory finds the screen shown last time. An ask close to one already answered reuses
 * that one's key.
 */
export function liveIntentKey(ask: string, known: IntentDef[] = []): string {
  const again = matchAsk(ask, known, 0.6);
  if (again) return again.intent.id;
  const words = [...new Set(tokens(ask).map((w) => w.replace(/[^a-z0-9]/g, "")).filter(Boolean))].slice(0, 6);
  // A spec key: segments of lower-case letters, digits and underscores, each starting with a letter.
  const key = words.join("_").slice(0, 58).replace(/_+$/, "");
  return `live.${/^[a-z]/.test(key) ? key : `ask_${key}`.replace(/_+$/, "")}`;
}

/** The shape of a key liveIntentKey makes, and all the endpoint accepts. */
export const INTENT_KEY = /^live\.[a-z][a-z0-9_]{0,62}$/;

/* ---- The protocol ---- */

export interface GenerateRequestBody {
  product: string;
  ask: string;
  /** From liveIntentKey. The endpoint makes one when it's missing or malformed. */
  intent?: string;
  /** The screen shown last time for this intent, from interface memory, without its data. */
  previous?: UIDocument;
  /** Narrow the capabilities offered to these (never widens them). */
  capabilities?: string[];
}

/** A screen the endpoint wrote and the runtime's checks passed. */
export interface LiveDone {
  intent: string;
  document: UIDocument;
  /** The capabilities it was offered, so the browser can refuse anything else. */
  capabilities: string[];
  attempts: number;
  warnings: number;
}

/** What the stream says, in order: started, progress and attempt per try, then done or not-yet. */
export type LiveEvent =
  | { type: "started"; remembered: boolean }
  | { type: "progress"; attempt: number; chars: number }
  | { type: "attempt"; attempt: number; valid: boolean; errors: number; warnings: number }
  | ({ type: "done" } & LiveDone)
  | { type: "not-yet"; reason: string };

/** One server-sent event, as the endpoint writes it. */
export function sse(event: LiveEvent): string {
  const { type, ...data } = event;
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Server-sent events from a byte stream. Tolerates events split across chunks; skips what it can't read. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<LiveEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (block: string): LiveEvent | null => {
    let type = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) type = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    try {
      return { type, ...(data.length ? JSON.parse(data.join("\n")) : {}) } as LiveEvent;
    } catch {
      return null;
    }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let at: number;
      while ((at = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const block = buffer.slice(0, at);
        buffer = buffer.slice(at).replace(/^\r?\n\r?\n/, "");
        const e = block.trim() ? parse(block) : null;
        if (e) yield e;
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const e = parse(buffer);
      if (e) yield e;
    }
  } finally {
    reader.releaseLock();
  }
}

/** A generated document is only shown when it has the shape a surface needs. */
export function isDocument(doc: unknown): doc is UIDocument {
  const d = doc as UIDocument | null;
  return Boolean(d && typeof d === "object" && d.surface && typeof d.surface.title === "string" && typeof d.root === "string" && Array.isArray(d.components) && d.components.length > 0);
}

/* ---- The browser's side ---- */

export type LiveOutcome = { kind: "live"; intent: IntentFile; capabilities: string[] } | { kind: "miss"; reason: string };

export interface LiveClientOptions {
  spec: LiveSpec;
  fetch?: typeof fetch;
  /** Interface memory and the asks answered before. Defaults to localStorage when there is one. */
  storage?: StorageLike | null;
  base?: string;
}

export interface LiveClient {
  /** Whether the endpoint has a model to call. Asked once per page; any failure reads as no. */
  available(): Promise<boolean>;
  /** Writes a screen for an ask. Never throws: anything short of a checked document is a miss. */
  generate(ask: string, options?: { signal?: AbortSignal; onEvent?: (e: LiveEvent) => void }): Promise<LiveOutcome>;
  /**
   * The runtime's interface memory (`storageStore` on localStorage): the screen shown last time for
   * each intent, sent back with the next ask for it so the new one is recognisable. The runtime is
   * loaded on first use, so a page that never generates never downloads it.
   */
  memory(): Promise<MemoryStore>;
}

interface Remembered {
  id: string;
  title: string;
  ask: string[];
}

const defaultStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Storage that forgets: private mode, or a browser that won't give us any. */
const nowhere = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

/** Storage that never throws: a full or blocked store only loses memory, never the screen. */
const safe = (s: StorageLike): StorageLike => ({
  getItem: (k) => {
    try {
      return s.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      s.setItem(k, v);
    } catch {
      /* memory is a convenience */
    }
  },
  removeItem: (k) => {
    try {
      s.removeItem(k);
    } catch {
      /* nothing to remove */
    }
  },
});

export function createLiveClient({ spec, fetch: f = (...a) => globalThis.fetch(...a), storage = defaultStorage(), base = LIVE_API }: LiveClientOptions): LiveClient {
  const store = safe(storage ?? nowhere());
  const prefix = `polyxd-demo:${spec.product}:live:`;
  let memoryStore: Promise<MemoryStore> | undefined;
  const memory = () => (memoryStore ??= import("@polyxd/runtime").then(({ storageStore }) => storageStore(store, { prefix: `${prefix}screen:` })));
  const asksKey = `${prefix}asks`;
  const remembered = (): Remembered[] => {
    try {
      const list = JSON.parse(store.getItem(asksKey) ?? "[]");
      return Array.isArray(list) ? list.filter((r) => r && typeof r.id === "string" && Array.isArray(r.ask)) : [];
    } catch {
      return [];
    }
  };
  const remember = (id: string, title: string, ask: string) => {
    const list = remembered().filter((r) => r.id !== id);
    const was = remembered().find((r) => r.id === id);
    const asks = [ask, ...(was?.ask ?? []).filter((a) => a !== ask)].slice(0, 5);
    store.setItem(asksKey, JSON.stringify([{ id, title, ask: asks }, ...list].slice(0, 20)));
  };

  let probe: Promise<boolean> | undefined;
  return {
    memory,
    available() {
      probe ??= f(`${base}/live`, { headers: { accept: "application/json" } }).then(
        async (r) => r.ok && (await r.json().catch(() => null))?.live === true,
        () => false,
      );
      return probe;
    },
    async generate(ask, { signal, onEvent } = {}) {
      const text = ask.trim();
      if (!text) return { kind: "miss", reason: "empty" };
      if (text.length > ASK_MAX) return { kind: "miss", reason: "too-long" };
      const intent = liveIntentKey(text, remembered());
      const mem = await memory().catch(() => null);
      const previous = await mem?.get(intent);
      const body: GenerateRequestBody = { product: spec.product, ask: text, intent };
      if (previous && JSON.stringify(previous).length <= PREVIOUS_MAX) body.previous = previous;
      let res: Response;
      try {
        res = await f(`${base}/generate`, { method: "POST", headers: { "content-type": "application/json", accept: "text/event-stream" }, body: JSON.stringify(body), signal });
      } catch {
        return { kind: "miss", reason: signal?.aborted ? "aborted" : "network" };
      }
      if (!res.ok || !res.body) return { kind: "miss", reason: res.status === 429 ? "busy" : res.status === 503 ? "off" : "refused" };
      try {
        for await (const e of readEvents(res.body)) {
          onEvent?.(e);
          if (e.type === "not-yet") return { kind: "miss", reason: e.reason };
          if (e.type === "done") {
            if (!isDocument(e.document) || e.intent !== intent) return { kind: "miss", reason: "malformed" };
            const { data: _seed, ...document } = e.document;
            await mem?.set(intent, document as UIDocument);
            remember(intent, document.surface.title, text);
            return { kind: "live", capabilities: e.capabilities, intent: { id: intent, title: document.surface.title, ask: [text], capabilities: e.capabilities, data: spec.data, document: document as UIDocument } };
          }
        }
      } catch {
        return { kind: "miss", reason: signal?.aborted ? "aborted" : "network" };
      }
      return { kind: "miss", reason: "incomplete" };
    },
  };
}

/**
 * Where an ask goes: the verified library first, always; then, only when the library has nothing
 * and the endpoint has a model, a live screen; otherwise an honest "not yet".
 */
export async function routeAsk<M>(text: string, match: (text: string) => M | null, client: Pick<LiveClient, "available"> | null): Promise<{ kind: "library"; match: M } | { kind: "live" } | { kind: "miss" }> {
  const m = match(text);
  if (m) return { kind: "library", match: m };
  if (client && (await client.available())) return { kind: "live" };
  return { kind: "miss" };
}

/** An action from a generated screen reaches the product's handlers only when it was offered. */
export function allowAction(e: Pick<ActionEvent, "name">, offered: readonly string[]): boolean {
  return e.name.startsWith("ui.") || offered.includes(e.name);
}
