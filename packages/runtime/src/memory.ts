import type { UIDocument } from "./types.ts";

/**
 * Interface memory: the document last shown for each intent, kept on the client. The runtime reads
 * it before generating, gives it to the model as the screen to keep recognisable, and writes the
 * new one back once it passes the checks. Documents are stored without their data snapshot.
 */
export interface MemoryStore {
  get(intent: string): UIDocument | undefined | Promise<UIDocument | undefined>;
  set(intent: string, document: UIDocument): void | Promise<void>;
  delete(intent: string): void | Promise<void>;
}

/** The part of the Web Storage API a store needs: `localStorage`, `sessionStorage`, or your own. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A store that lives as long as the page or process does. */
export function memoryStore(): MemoryStore {
  const map = new Map<string, string>();
  return {
    get: (intent) => {
      const json = map.get(intent);
      return json === undefined ? undefined : (JSON.parse(json) as UIDocument);
    },
    set: (intent, document) => void map.set(intent, JSON.stringify(document)),
    delete: (intent) => void map.delete(intent),
  };
}

/** A store on `localStorage` or anything shaped like it. A corrupt entry reads as nothing. */
export function storageStore(storage: StorageLike, options: { prefix?: string } = {}): MemoryStore {
  const prefix = options.prefix ?? "polyxd:memory:";
  return {
    get: (intent) => {
      const json = storage.getItem(prefix + intent);
      if (json === null) return undefined;
      try {
        const doc = JSON.parse(json);
        return doc && typeof doc === "object" && !Array.isArray(doc) ? (doc as UIDocument) : undefined;
      } catch {
        return undefined;
      }
    },
    set: (intent, document) => storage.setItem(prefix + intent, JSON.stringify(document)),
    delete: (intent) => storage.removeItem(prefix + intent),
  };
}

/** A document as memory keeps it: without the data it was shown with. */
export function forMemory(document: UIDocument): UIDocument {
  const { data: _data, ...rest } = document;
  return rest as UIDocument;
}
