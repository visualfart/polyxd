/** JSON Pointer helpers and binding resolution. Every binding resolves to an absolute pointer. */

export type Data = Record<string, unknown>;

/** Where relative paths resolve: the pointer of the current repeated item, or "" at top level. */
export interface Scope {
  pointer: string;
}

export const ROOT_SCOPE: Scope = { pointer: "" };

const decode = (s: string) => s.replace(/~1/g, "/").replace(/~0/g, "~");
const encode = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");

export const isBinding = (v: unknown): v is { path: string } =>
  !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as { path?: unknown }).path === "string";

/** Absolute pointer for a path: absolute paths stay; relative ones join the item scope. */
export function absolute(path: string, scope: Scope): string {
  return path.startsWith("/") ? path : `${scope.pointer}/${path}`;
}

export function childPointer(pointer: string, key: string | number): string {
  return `${pointer}/${encode(String(key))}`;
}

export function get(data: unknown, pointer: string): unknown {
  if (pointer === "") return data;
  let cur: any = data;
  for (const part of pointer.slice(1).split("/").map(decode)) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

/** Immutable set; creates intermediate objects (or arrays for numeric keys). */
export function set(data: Data, pointer: string, value: unknown): Data {
  const parts = pointer.slice(1).split("/").map(decode);
  const write = (node: any, i: number): any => {
    const key = parts[i];
    const copy = Array.isArray(node) ? [...node] : { ...(node ?? {}) };
    if (i === parts.length - 1) copy[key] = value;
    else copy[key] = write(node?.[key] ?? (/^\d+$/.test(parts[i + 1]) ? [] : {}), i + 1);
    return copy;
  };
  return write(data, 0);
}

/**
 * Host data as a list. A binding that a component repeats over should point at an array; when the
 * host (or a generated document) points it somewhere else, the component shows nothing instead of
 * throwing. The validator reports the mismatch.
 */
export const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Resolves a literal-or-binding value. */
export function resolve<T = unknown>(value: unknown, data: unknown, scope: Scope): T {
  return (isBinding(value) ? get(data, absolute(value.path, scope)) : value) as T;
}

/** Resolves every value in an action context. */
export function resolveContext(context: Record<string, unknown> | undefined, data: unknown, scope: Scope): Record<string, unknown> {
  return Object.fromEntries(Object.entries(context ?? {}).map(([k, v]) => [k, resolve(v, data, scope)]));
}
