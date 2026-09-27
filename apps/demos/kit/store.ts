import { useSyncExternalStore } from "react";

/**
 * A product's data, kept in the browser. Every action in a demo changes it for real, so the
 * screens after an action reflect what happened; a change can be undone while its snackbar
 * is showing; and Reset puts the seed back. Nothing leaves the browser.
 */
export interface Store<T> {
  get: () => T;
  /** Replace the state (already-new object). */
  set: (next: T) => void;
  /** Change the state through a mutator on a deep copy; returns an undo handle. */
  commit: (label: string, mutate: (draft: T) => void) => Undo;
  /** Put back the state a commit replaced. */
  undo: (u: Undo) => void;
  reset: () => void;
  subscribe: (fn: () => void) => () => void;
  useState: () => T;
}

export interface Undo {
  label: string;
  at: number;
  before: unknown;
}

export function createStore<T>(key: string, version: number, seed: () => T): Store<T> {
  const storageKey = `polyxd-demo:${key}:v${version}`;
  const listeners = new Set<() => void>();
  let state: T = load() ?? seed();

  function load(): T | null {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* private mode, full storage: the session still works, it just doesn't persist */
    }
  }
  function emit() {
    for (const fn of listeners) fn();
  }
  const set = (next: T) => {
    state = next;
    save();
    emit();
  };
  return {
    get: () => state,
    set,
    commit(label, mutate) {
      const before = state;
      const draft = structuredClone(state);
      mutate(draft);
      set(draft);
      return { label, at: Date.now(), before };
    },
    undo(u) {
      set(u.before as T);
    },
    reset() {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* nothing to remove */
      }
      set(seed());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    useState() {
      return useSyncExternalStore(
        (fn) => {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        () => state,
        () => state,
      );
    },
  };
}

/** Deterministic pseudo-random numbers, so a seed is the same for everyone. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable id from a counter, readable in devtools ("txn_0042"). */
export function ids(prefix: string) {
  let n = 0;
  return () => `${prefix}_${String(++n).padStart(4, "0")}`;
}

/** ISO date `days` before (negative) or after today at a fixed hour; demos should look current. */
export function daysFromNow(days: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
