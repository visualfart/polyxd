/**
 * Studio Insights on the Worker: the ingest endpoint a workspace's products send their semantic
 * events to, and the ingest keys that let them.
 *
 *   POST /api/w/<workspace>/events   { "events": [ ... ] }   x-polyxd-key: pxi_…
 *
 * That is `toFetch(url, { headers: { "x-polyxd-key": key } })` from @polyxd/analytics. The key is
 * publishable: it sits in a product's pages and can send events to its own workspace, nothing
 * else. It is never read as an API key or a session, so it opens no other door. Browsers may call
 * from any origin (CORS, without credentials; cookies are never read here).
 *
 * Each request is at most 100 events and 64 KB. Events are checked against the schema, redacted,
 * and added to daily counts (src/insights/events.ts); the events themselves are not kept, and
 * neither is anything else from the request. Requests are limited per key and per address, in
 * this isolate's memory, the address kept as a short hash and never written anywhere.
 */
import { MAX_BODY, MAX_EVENTS, aggregate, folded, type Measures, type Row } from "../insights/events.ts";
import { RETENTION_DAYS } from "../insights/report.ts";
import type { Env } from "./auth.ts";

export const INGEST_HEADER = "x-polyxd-key";
const KEY = /^pxi_[a-f0-9]{48}$/;
/** Rows one workspace may add in a day before new combinations are folded into "(other)". */
export const MAX_ROWS_PER_DAY = 20_000;
/** Requests a minute, per key and per address, in one isolate. */
export const LIMITS = { key: 1200, address: 120 };

/** A random ingest key: shown in Studio, meant for a product's pages. */
export function newIngestKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return "pxi_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": `content-type, ${INGEST_HEADER}`,
  "access-control-max-age": "86400",
};
const answer = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...CORS, ...(body === null ? {} : { "content-type": "application/json; charset=utf-8" }), "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers },
  });

export const preflight = () => answer(null, 204);

/** A fixed window a minute long per client, in this isolate's memory. */
export function limiter(max: number, now: () => number = Date.now) {
  const hits = new Map<string, { window: number; n: number }>();
  return (client: string): number => {
    const t = now();
    const window = Math.floor(t / 60_000);
    const h = hits.get(client);
    if (!h || h.window !== window) {
      if (hits.size > 50_000) for (const [k, v] of hits) if (v.window !== window) hits.delete(k);
      hits.set(client, { window, n: 1 });
      return 0;
    }
    if (h.n >= max) return Math.max(1, Math.ceil(((window + 1) * 60_000 - t) / 1000));
    h.n++;
    return 0;
  };
}
const byKey = limiter(LIMITS.key);
const byAddress = limiter(LIMITS.address);

/** FNV-1a: enough to tell addresses apart without keeping them. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** The body, read no further than `max` bytes; undefined when it is longer. */
async function readCapped(request: Request, max: number): Promise<string | undefined> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return undefined;
    }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.byteLength;
  }
  return new TextDecoder().decode(all);
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
/** When each workspace's old counts were last cleared, in this isolate: once a day is enough. */
const pruned = new Map<string, string>();

const UPSERT = `INSERT INTO insight_counts (workspace_id, day, intent, surface, pattern, type, component, capability, reason, source, actor, count, duration_sum, duration_count, d0, d1, d2, d3, d4, d5, d6, d7, rating_sum, rating_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (workspace_id, day, intent, surface, pattern, type, component, capability, reason, source, actor) DO UPDATE SET
    count = count + excluded.count, duration_sum = duration_sum + excluded.duration_sum, duration_count = duration_count + excluded.duration_count,
    d0 = d0 + excluded.d0, d1 = d1 + excluded.d1, d2 = d2 + excluded.d2, d3 = d3 + excluded.d3, d4 = d4 + excluded.d4, d5 = d5 + excluded.d5, d6 = d6 + excluded.d6, d7 = d7 + excluded.d7,
    rating_sum = rating_sum + excluded.rating_sum, rating_count = rating_count + excluded.rating_count`;

const upsert = (env: Env, workspaceId: string, day: string, r: Row, m: Measures) =>
  env.DB.prepare(UPSERT).bind(workspaceId, day, r.intent, r.surface, r.pattern, r.type, r.component, r.capability, r.reason, r.source, r.actor, m.count, m.durationSum, m.durationCount, ...m.buckets, m.ratingSum, m.ratingCount);

/** POST /api/w/:slug/events */
export async function ingestEvents(request: Request, env: Env, slug: string): Promise<Response> {
  // The address first, so a flood of guesses never reaches the database.
  const address = hash(request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local");
  const waitA = byAddress(address);
  if (waitA) return answer({ error: "Too many requests from this address; try again shortly" }, 429, { "retry-after": String(waitA) });

  const key = request.headers.get(INGEST_HEADER)?.trim() ?? "";
  if (!KEY.test(key)) return answer({ error: `Send the workspace's ingest key in the ${INGEST_HEADER} header` }, 401);
  const waitK = byKey(key);
  if (waitK) return answer({ error: "Too many requests for this key; try again shortly" }, 429, { "retry-after": String(waitK) });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return answer({ error: "A request is at most 64 KB" }, 413);
  const found = await env.DB.prepare("SELECT k.id, k.workspace_id, k.last_used_at FROM ingest_keys k JOIN workspaces w ON w.id = k.workspace_id WHERE k.key = ? AND w.slug = ?")
    .bind(key, slug).first<{ id: string; workspace_id: string; last_used_at: string | null }>();
  // An unknown key and a key for another workspace get the same answer.
  if (!found) return answer({ error: "That ingest key isn't one of this workspace's" }, 401);

  const text = await readCapped(request, MAX_BODY);
  if (text === undefined) return answer({ error: "A request is at most 64 KB" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return answer({ error: 'Send JSON: { "events": [ ... ] }' }, 400);
  }
  const events = (body as { events?: unknown })?.events;
  if (!Array.isArray(events)) return answer({ error: 'Send JSON: { "events": [ ... ] }' }, 400);
  if (events.length > MAX_EVENTS) return answer({ error: `At most ${MAX_EVENTS} events a request` }, 413);

  const { rows, accepted, dropped } = aggregate(events);
  const day = today();
  const statements: D1PreparedStatement[] = [];
  let fold = false;
  if (rows.length) {
    const have = await env.DB.prepare("SELECT COUNT(*) AS n FROM insight_counts WHERE workspace_id = ? AND day = ?").bind(found.workspace_id, day).first<{ n: number }>();
    fold = (have?.n ?? 0) + rows.length > MAX_ROWS_PER_DAY;
    for (const { row, m } of rows) statements.push(upsert(env, found.workspace_id, day, fold ? folded(row) : row, m));
  }
  if (pruned.get(found.workspace_id) !== day) {
    statements.push(env.DB.prepare("DELETE FROM insight_counts WHERE workspace_id = ? AND day < ?").bind(found.workspace_id, daysAgo(RETENTION_DAYS - 1)));
    pruned.set(found.workspace_id, day);
  }
  // When the key was last used, to the hour: enough for Studio's settings to say so.
  if (!found.last_used_at || found.last_used_at < new Date(Date.now() - 3_600_000).toISOString()) {
    statements.push(env.DB.prepare("UPDATE ingest_keys SET last_used_at = ? WHERE id = ?").bind(new Date().toISOString(), found.id));
  }
  if (statements.length) await env.DB.batch(statements);
  return answer({ accepted, dropped: dropped.invalid + dropped.duplicate + dropped.uncoded, why: dropped, ...(fold ? { folded: true } : {}) }, 202);
}
