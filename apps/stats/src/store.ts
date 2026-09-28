/**
 * What the job remembers between runs: which events it has sent for each day (so a rerun or an
 * overlapping backfill never counts a day twice), the last total seen for each cumulative counter
 * (so a daily delta can be worked out), and a same-night cache of npm publish histories.
 *
 * A Workers KV namespace satisfies `Store` as is. The tests and the local script pass `MemoryStore`.
 */
import type { Day } from "./days.ts";

export interface Store {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export class MemoryStore implements Store {
  readonly data = new Map<string, string>();
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.data.set(key, value);
  }
}

async function getJson<T>(store: Store, key: string): Promise<T | null> {
  const text = await store.get(key);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ---------- Sent ledger: one key per day, holding the keys of the events sent for it ----------

const ledgerKey = (day: Day) => `sent:${day}`;

export async function readLedger(store: Store, day: Day): Promise<Set<string>> {
  const keys = await getJson<string[]>(store, ledgerKey(day));
  return new Set(Array.isArray(keys) ? keys : []);
}

/** Adds `keys` to the day's ledger. One write per day, however many events: KV's free tier allows 1,000 writes a day. */
export async function addToLedger(store: Store, day: Day, keys: Iterable<string>): Promise<void> {
  const ledger = await readLedger(store, day);
  for (const key of keys) ledger.add(key);
  await store.put(ledgerKey(day), JSON.stringify([...ledger].sort()));
}

// ---------- Last totals of cumulative counters ----------

export interface TotalSeen {
  day: Day;
  total: number;
}

const totalKey = (counter: string) => `total:${counter}`;

export const readTotal = (store: Store, counter: string) => getJson<TotalSeen>(store, totalKey(counter));

export const writeTotal = (store: Store, counter: string, seen: TotalSeen) => store.put(totalKey(counter), JSON.stringify(seen));

// ---------- Cached npm publish histories and package list ----------

export interface Cached<T> {
  fetchedAt: string;
  value: T;
}

export async function readCache<T>(store: Store, key: string, now: Date, maxAgeMs: number): Promise<T | null> {
  const cached = await getJson<Cached<T>>(store, `cache:${key}`);
  if (!cached || typeof cached.fetchedAt !== "string") return null;
  const age = now.getTime() - Date.parse(cached.fetchedAt);
  return age >= 0 && age <= maxAgeMs ? cached.value : null;
}

export const writeCache = <T>(store: Store, key: string, now: Date, value: T) =>
  store.put(`cache:${key}`, JSON.stringify({ fetchedAt: now.toISOString(), value } satisfies Cached<T>));
