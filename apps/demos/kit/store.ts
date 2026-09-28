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

// Seed helpers live apart from React so a server (the live endpoint) can build a product's seed.
export { daysFromNow, ids, rng } from "./seeding.ts";
