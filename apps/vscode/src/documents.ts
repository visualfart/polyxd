/**
 * What a Polyxd document is, where its data comes from, and what the static check says about it.
 * The rules are `polyxd dev`'s (packages/ds-kit/src/dev.ts), copied here because the extension
 * bundles for a CommonJS extension host and ds-kit doesn't export them: a document is a JSON file
 * with `specVersion` and `components`, or an intent-shaped file whose `document` has them; data is
 * the document's own, else `<name>.data.json` beside it.
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { validateDocument, type Issue } from "@polyxd/spec/browser";
import { parseJson, type JsonNode, type ParseResult } from "./json.ts";

export type Json = any;

export interface StaticCheck {
  errors: number;
  warnings: number;
  issues: Issue[];
}

export interface Classified {
  kind: "document" | "intent";
  document: Json;
  /** Pointer prefix from the file's root to the document: "" or "/document". */
  prefix: string;
  id: string;
  title: string;
  origin?: string;
}

/** The thirteen built-in packs, in the order `polyxd dev` and the verifier list them. */
export const THEMES = ["material3", "carbon", "antd", "fluent", "shadcn", "bootstrap", "mantine", "radix", "polaris", "primer", "spectrum", "govuk", "chakra"];

export const isDocument = (v: Json): boolean => !!v && typeof v === "object" && !Array.isArray(v) && typeof v.specVersion === "string" && Array.isArray(v.components);

/** A parsed JSON value as a document, if it is one. */
export function classify(raw: Json): Classified | undefined {
  const kind: Classified["kind"] | undefined = isDocument(raw) ? "document" : isDocument(raw?.document) ? "intent" : undefined;
  if (!kind) return undefined;
  const document = kind === "intent" ? raw.document : raw;
  const surface = document.surface ?? {};
  return {
    kind,
    document,
    prefix: kind === "intent" ? "/document" : "",
    id: String(surface.id ?? (kind === "intent" ? raw.id : "") ?? ""),
    title: String(surface.title ?? raw.title ?? ""),
    origin: typeof surface.origin === "string" ? surface.origin : undefined,
  };
}

/** The static check: schema and structure, and every binding against the data the surface will show. */
export function checkDocument(document: Json, data?: Json): StaticCheck {
  const doc = data !== undefined ? { ...document, data } : document;
  let issues: Issue[];
  try {
    issues = validateDocument(doc, { missingData: "warning" }).issues;
  } catch (e) {
    issues = [{ severity: "error", at: "/", message: `validator failed: ${(e as Error).message}` }];
  }
  if (data !== undefined) issues = issues.map((i) => (i.code === "data:missing-path" && !i.message.includes("did you mean") ? { ...i, message: withSuggestion(i.message, data) } : i));
  return { errors: issues.filter((i) => i.severity === "error").length, warnings: issues.filter((i) => i.severity === "warning").length, issues };
}

/** Every absolute pointer into `data`, a few levels deep: what a binding could have named. */
export function pointersOf(data: Json, prefix = "", depth = 0, out: string[] = []): string[] {
  if (!data || typeof data !== "object" || depth > 4) return out;
  for (const k of Array.isArray(data) ? data.slice(0, 3).map((_, i) => String(i)) : Object.keys(data)) {
    const p = `${prefix}/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`;
    out.push(p);
    pointersOf(data[k], p, depth + 1, out);
  }
  return out;
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

/** The pointer in data nearest to `path` by edit distance, when it is near enough to be a slip. */
export function nearestPointer(path: string, data: Json): string | undefined {
  let best: { p: string; d: number } | undefined;
  for (const p of pointersOf(data)) {
    const d = distance(path.toLowerCase(), p.toLowerCase());
    if (!best || d < best.d) best = { p, d };
  }
  return best && best.d <= Math.max(2, Math.floor(path.length / 3)) ? best.p : undefined;
}

/** The validator says "did you mean" when the field exists elsewhere; a typo gets the same help here. */
function withSuggestion(message: string, data: Json): string {
  const path = /path "([^"]+)" does not exist in data/.exec(message)?.[1];
  const near = path && nearestPointer(path, data);
  return near ? `${message} (did you mean "${near}"?)` : message;
}

/** The `<name>.data.json` that would sit beside a document file. */
export const siblingDataPath = (file: string) => file.replace(/\.json$/i, ".data.json");
export const isDataFile = (file: string) => /\.data\.json$/i.test(file);

export interface Loaded {
  parse: ParseResult;
  root: JsonNode;
  classified: Classified;
  data?: Json;
  dataFrom: "embedded" | "sibling" | "none";
  check: StaticCheck;
}

/**
 * A file's text as a checked document. `siblingData` is the text of `<name>.data.json` when the
 * caller has it (an open editor's buffer wins over the disk).
 */
export function loadDocument(text: string, siblingData?: string): Loaded | undefined {
  const parse = parseJson(text);
  if (!parse.root) return undefined;
  const classified = classify(parse.value);
  if (!classified) return undefined;
  let data: Json = classified.document.data;
  let dataFrom: Loaded["dataFrom"] = data !== undefined ? "embedded" : "none";
  if (data === undefined && siblingData !== undefined) {
    try {
      data = JSON.parse(siblingData);
      dataFrom = "sibling";
    } catch {
      // A half-saved data file: check the document without it until the next save.
    }
  }
  return { parse, root: parse.root, classified, data, dataFrom, check: checkDocument(classified.document, data) };
}

export interface DiscoveredDocument {
  /** Absolute path. */
  path: string;
  /** Path relative to the folder searched, with `/` separators. */
  file: string;
  id: string;
  title: string;
  kind: Classified["kind"];
  origin?: string;
  dataFrom: Loaded["dataFrom"];
  check: { errors: number; warnings: number };
}

const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", "out"]);
const posix = (p: string) => p.split(sep).join("/");

async function* jsonFiles(dir: string, depth = 0): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && depth < 6) yield* jsonFiles(join(dir, e.name), depth + 1);
    } else if (e.name.endsWith(".json")) yield join(dir, e.name);
  }
}

/** Every document under `dir`, with its static status, the way `polyxd dev` lists a folder. */
export async function discoverDocuments(dir: string): Promise<DiscoveredDocument[]> {
  const out: DiscoveredDocument[] = [];
  for await (const path of jsonFiles(dir)) {
    if (isDataFile(path)) continue;
    const text = await readFile(path, "utf8").catch(() => undefined);
    // Registries, reports and lockfiles are JSON too; a cheap look before parsing megabytes.
    if (text === undefined || !text.includes('"components"')) continue;
    const sibling = siblingDataPath(path);
    const loaded = loadDocument(text, existsSync(sibling) ? await readFile(sibling, "utf8").catch(() => undefined) : undefined);
    if (!loaded) continue;
    out.push({
      path,
      file: posix(relative(dir, path)),
      id: loaded.classified.id,
      title: loaded.classified.title || basename(path, ".json"),
      kind: loaded.classified.kind,
      origin: loaded.classified.origin,
      dataFrom: loaded.dataFrom,
      check: { errors: loaded.check.errors, warnings: loaded.check.warnings },
    });
  }
  return out;
}

/** Documents by the folder they sit in (relative, "/"-separated, "" for the root), folders sorted. */
export function groupByFolder<T extends { file: string }>(documents: T[]): { folder: string; documents: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const d of documents) {
    const folder = d.file.includes("/") ? d.file.slice(0, d.file.lastIndexOf("/")) : "";
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push(d);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([folder, documents]) => ({ folder, documents }));
}
