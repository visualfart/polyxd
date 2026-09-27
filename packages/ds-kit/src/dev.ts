/**
 * `polyxd dev`: a local preview for people who author Polyxd documents in their editor.
 *
 *   npx polyxd dev                         the documents in this folder
 *   npx polyxd dev ./screens --port 4310 --theme material3 --data ./sample.json --open
 *   npx polyxd dev ./screens --pack ./ds-acme/manifest.json --verify
 *
 * It watches a folder for documents, renders the selected one with the real renderer in any
 * built-in pack (or one of yours), light or dark, at phone, tablet and desktop widths, and shows
 * beside it what the static check finds, the document, its data, and the actions it dispatches.
 * Save a file and the surface reloads in place, keeping your selection and controls.
 *
 * Nothing but Node here: http, fs.watch, server-sent events, and the renderer's browser bundle
 * from @polyxd/react/preview.
 */
import { spawn } from "node:child_process";
import { existsSync, watch, type FSWatcher } from "node:fs";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { validateDocument, type Issue } from "@polyxd/spec";
import { packCss, type PackCss } from "./dev-pack.ts";
import { devPage } from "./dev-page.ts";

export type Json = any;

export interface DevDocument {
  /** Path relative to the watched folder, with `/` separators: the stable key. */
  file: string;
  /** surface.id */
  id: string;
  title: string;
  /** A bare document, or an intent-shaped file whose `document` is used. */
  kind: "document" | "intent";
  /** surface.origin when the document states one. */
  origin?: string;
  pattern?: string;
  /** Where the data came from. */
  dataFrom: "embedded" | "sibling" | "default" | "none";
  document: Json;
  data?: Json;
  check: StaticCheck;
}

export interface StaticCheck {
  errors: number;
  warnings: number;
  issues: Issue[];
}

export interface Discovery {
  documents: DevDocument[];
  /** JSON files that didn't parse: while someone is mid-edit, usually. */
  broken: { file: string; message: string }[];
}

const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage"]);
const THEMES = ["material3", "carbon", "antd", "fluent", "shadcn", "bootstrap", "mantine", "radix", "polaris", "primer", "spectrum", "govuk", "chakra"];

const isDocument = (v: Json) => !!v && typeof v === "object" && typeof v.specVersion === "string" && Array.isArray(v.components);
const posix = (p: string) => p.split(sep).join("/");

/** The static check: schema and structure, and every binding against the data the surface will show. */
export function checkDocument(document: Json, data?: Json): StaticCheck {
  const doc = data !== undefined ? { ...document, data } : document;
  let issues: Issue[];
  try {
    issues = validateDocument(doc, { missingData: "warning" }).issues;
  } catch (e) {
    issues = [{ severity: "error", at: "/", message: `validator failed: ${(e as Error).message}` }];
  }
  return { errors: issues.filter((i) => i.severity === "error").length, warnings: issues.filter((i) => i.severity === "warning").length, issues };
}

async function* jsonFiles(dir: string, depth = 0): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && depth < 4) yield* jsonFiles(join(dir, e.name), depth + 1);
    } else if (e.name.endsWith(".json")) yield join(dir, e.name);
  }
}

/**
 * Every document under `dir`: a JSON file with `specVersion` and `components`, or an intent-shaped
 * file whose `document` has them. Data is the document's own, else `<name>.data.json` beside it,
 * else `defaultData`. Everything else (packs, reports, registries, tsconfigs) is ignored.
 */
export async function discoverDocuments(dir: string, options: { defaultData?: Json } = {}): Promise<Discovery> {
  const documents: DevDocument[] = [];
  const broken: Discovery["broken"] = [];
  for await (const path of jsonFiles(dir)) {
    if (path.endsWith(".data.json")) continue;
    const file = posix(relative(dir, path));
    let raw: Json;
    try {
      raw = JSON.parse(await readFile(path, "utf8"));
    } catch (e) {
      broken.push({ file, message: (e as Error).message });
      continue;
    }
    const kind: DevDocument["kind"] | undefined = isDocument(raw) ? "document" : isDocument(raw?.document) ? "intent" : undefined;
    if (!kind) continue;
    const document = kind === "intent" ? raw.document : raw;
    let data: Json = document.data;
    let dataFrom: DevDocument["dataFrom"] = data !== undefined ? "embedded" : "none";
    if (data === undefined) {
      const sibling = path.replace(/\.json$/, ".data.json");
      if (existsSync(sibling)) {
        try {
          data = JSON.parse(await readFile(sibling, "utf8"));
          dataFrom = "sibling";
        } catch (e) {
          broken.push({ file: posix(relative(dir, sibling)), message: (e as Error).message });
        }
      }
    }
    if (data === undefined && options.defaultData !== undefined) {
      data = options.defaultData;
      dataFrom = "default";
    }
    const surface = document.surface ?? {};
    documents.push({
      file,
      id: String(surface.id ?? (kind === "intent" ? raw.id : "") ?? ""),
      title: String(surface.title ?? raw.title ?? basename(file, ".json")),
      kind,
      origin: surface.origin,
      pattern: surface.pattern,
      dataFrom,
      document,
      data,
      check: checkDocument(document, data),
    });
  }
  return { documents, broken };
}

/** One line per document, the way the pack command reports. */
export function describe(d: DevDocument): string {
  const status = d.check.errors ? "error" : d.check.warnings ? "warn " : "ok   ";
  const counts = [d.check.errors ? `${d.check.errors} error${d.check.errors === 1 ? "" : "s"}` : "", d.check.warnings ? `${d.check.warnings} warning${d.check.warnings === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ");
  const what = [d.kind === "intent" ? "intent" : "document", d.origin, d.dataFrom === "none" ? "no data" : d.dataFrom === "embedded" ? "" : `data: ${d.dataFrom}`].filter(Boolean).join(" · ");
  return `  ${status}  ${d.file.padEnd(32)} ${d.title.slice(0, 28).padEnd(28)} ${what}${counts ? `  (${counts})` : ""}`;
}

/** Where the renderer's browser bundle lives, if @polyxd/react is installed with one. */
export function findBundle(): string | undefined {
  try {
    const js = fileURLToPath(import.meta.resolve("@polyxd/react/preview/polyxd.js"));
    return existsSync(js) && existsSync(js.replace(/\.js$/, ".css")) ? dirname(js) : undefined;
  } catch {
    return undefined;
  }
}

/** The verifier's command line, if @polyxd/verifier is installed. */
export function findVerifier(): string | undefined {
  try {
    const cli = fileURLToPath(import.meta.resolve("@polyxd/verifier/dist/cli.js"));
    return existsSync(cli) ? cli : undefined;
  } catch {
    return undefined;
  }
}

export interface DevServerOptions {
  dir: string;
  port?: number;
  theme?: string;
  /** A JSON file used as data for documents that have none. */
  data?: string;
  /** A manifest.json or theme .css to add to the pack switcher. */
  pack?: string;
  /** Show the Verify button; runs @polyxd/verifier when it is installed. */
  verify?: boolean;
  /** Directory holding polyxd.js and polyxd.css. Default: @polyxd/react/preview. */
  bundle?: string;
}

export interface DevServer {
  url: string;
  port: number;
  documents: () => DevDocument[];
  broken: () => Discovery["broken"];
  pack?: PackCss;
  /** Re-reads the folder and tells open pages what changed. Called by the watcher; tests call it directly. */
  rescan: () => Promise<void>;
  close: () => Promise<void>;
}

const meta = (d: DevDocument) => ({ file: d.file, id: d.id, title: d.title, kind: d.kind, origin: d.origin, pattern: d.pattern, dataFrom: d.dataFrom, check: { errors: d.check.errors, warnings: d.check.warnings } });

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};
const text = (res: ServerResponse, status: number, body: string, type = "text/plain") => {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
  res.end(body);
};
const sse = (res: ServerResponse) => {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
  res.write(": polyxd dev\n\n");
  return (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

export async function createDevServer(options: DevServerOptions): Promise<DevServer> {
  const dir = resolve(options.dir);
  const info = await stat(dir).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`${options.dir} is not a folder`);
  const dataFile = options.data ? resolve(options.data) : undefined;
  const readDefaultData = async () => (dataFile ? JSON.parse(await readFile(dataFile, "utf8")) : undefined);
  const pack = options.pack ? await packCss(resolve(options.pack)) : undefined;
  const bundle = options.bundle ?? findBundle();
  const theme = options.theme ?? (pack?.name ?? "material3");

  let defaultData = await readDefaultData();
  let found = await discoverDocuments(dir, { defaultData });
  const clients = new Set<(event: string, data: unknown) => void>();
  const broadcast = (event: string, data: unknown) => {
    for (const send of clients) send(event, data);
  };
  const listing = () => ({ dir, theme, pack: pack?.name, verify: !!options.verify, bundle: !!bundle, documents: found.documents.map(meta), broken: found.broken });

  const rescan = async () => {
    try {
      defaultData = await readDefaultData();
    } catch {
      // A half-saved default data file: keep the last good one until the next save.
    }
    const before = new Map(found.documents.map((d) => [d.file, JSON.stringify({ d: d.document, x: d.data })]));
    found = await discoverDocuments(dir, { defaultData });
    const changed = found.documents.filter((d) => before.get(d.file) !== JSON.stringify({ d: d.document, x: d.data })).map((d) => d.file);
    const removed = [...before.keys()].filter((f) => !found.documents.some((d) => d.file === f));
    broadcast("change", { changed, removed, ...listing() });
  };

  let timer: NodeJS.Timeout | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void rescan(), 80);
  };
  const watchers: FSWatcher[] = [];
  try {
    watchers.push(watch(dir, { recursive: true }, schedule));
  } catch {
    watchers.push(watch(dir, schedule));
  }
  if (dataFile && !dataFile.startsWith(dir + sep)) watchers.push(watch(dataFile, schedule));

  let verifying = false;
  const verify = async (doc: DevDocument, send: (event: string, data: unknown) => void, done: () => void) => {
    const cli = findVerifier();
    if (!cli) {
      send("line", { text: "The verifier isn't installed here. It renders in a real browser, so it's a separate package:" });
      send("line", { text: "  npm install -D @polyxd/verifier && npx playwright install chromium" });
      send("done", { code: 2 });
      return done();
    }
    if (verifying) {
      send("line", { text: "A verification is already running; wait for it to finish." });
      send("done", { code: 3 });
      return done();
    }
    verifying = true;
    const tmp = await mkdtemp(join(tmpdir(), "polyxd-dev-verify-"));
    const file = join(tmp, `${basename(doc.file, ".json")}.json`);
    await writeFile(file, JSON.stringify(doc.data !== undefined ? { ...doc.document, data: doc.data } : doc.document));
    send("line", { text: `polyxd-verify ${basename(file)} --themes ${THEMES.join(",")} --modes light,dark --widths 390,1100` });
    const child = spawn(process.execPath, [cli, file, "--themes", THEMES.join(","), "--modes", "light,dark", "--widths", "390,1100"], { stdio: ["ignore", "pipe", "pipe"] });
    let rest = "";
    const lines = (chunk: Buffer, stream: "out" | "err") => {
      rest += chunk.toString();
      const parts = rest.split("\n");
      rest = parts.pop() ?? "";
      for (const line of parts) send("line", { text: line, stream });
    };
    child.stdout.on("data", (c: Buffer) => lines(c, "out"));
    child.stderr.on("data", (c: Buffer) => lines(c, "err"));
    child.on("close", async (code) => {
      if (rest) send("line", { text: rest });
      send("done", { code: code ?? 1 });
      verifying = false;
      await rm(tmp, { recursive: true, force: true });
      done();
    });
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = decodeURIComponent(url.pathname);
    if (path === "/") return text(res, 200, devPage({ dir, theme, pack: pack?.name, verify: !!options.verify, bundle: !!bundle, themes: THEMES }), "text/html");
    if (path === "/preview/polyxd.js" || path === "/preview/polyxd.css") {
      if (!bundle) return text(res, 404, "The renderer bundle isn't installed: npm install @polyxd/react");
      const body = await readFile(join(bundle, basename(path))).catch(() => null);
      if (!body) return text(res, 404, "not found");
      res.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8", "cache-control": "no-store" });
      return res.end(body);
    }
    if (path === "/pack.css") return pack ? text(res, 200, pack.css, "text/css") : text(res, 404, "no --pack");
    if (path === "/api/documents") return json(res, 200, listing());
    if (path === "/api/events") {
      const send = sse(res);
      clients.add(send);
      send("hello", listing());
      req.on("close", () => clients.delete(send));
      return;
    }
    const doc = (prefix: string) => (path.startsWith(prefix) ? found.documents.find((d) => d.file === path.slice(prefix.length)) : undefined);
    if (path.startsWith("/api/documents/")) {
      const d = doc("/api/documents/");
      return d ? json(res, 200, { ...meta(d), document: d.document, data: d.data, issues: d.check.issues }) : json(res, 404, { error: "no such document" });
    }
    if (path.startsWith("/api/verify/")) {
      const d = doc("/api/verify/");
      if (!d) return json(res, 404, { error: "no such document" });
      const send = sse(res);
      return verify(d, send, () => res.end());
    }
    text(res, 404, "not found");
  };

  const server: Server = createServer((req, res) => {
    handle(req, res).catch((e: Error) => {
      if (!res.headersSent) json(res, 500, { error: e.message });
      else res.end();
    });
  });
  const port = await new Promise<number>((ok, fail) => {
    server.once("error", fail);
    server.listen(options.port ?? 4310, "127.0.0.1", () => ok((server.address() as { port: number }).port));
  });

  return {
    url: `http://localhost:${port}/`,
    port,
    documents: () => found.documents,
    broken: () => found.broken,
    pack,
    rescan,
    close: async () => {
      clearTimeout(timer);
      for (const w of watchers) w.close();
      for (const send of clients) send("bye", {});
      // Event streams never end on their own; close them so the server can.
      const closed = new Promise<void>((ok) => server.close(() => ok()));
      server.closeAllConnections();
      await closed;
    },
  };
}

const USAGE = `polyxd dev [dir] [--port 4310] [--theme material3] [--data <file.json>] [--pack <manifest.json|theme.css>] [--verify] [--open]

  Previews the Polyxd documents in a folder (default: this one) in the browser, rendered with the
  real renderer in any built-in design system, light or dark, at phone, tablet and desktop widths,
  with the static check, the document, its data and the actions it dispatches beside it. Save a
  file and the surface reloads in place.`;

export async function main(argv: string[]): Promise<number> {
  let values: Record<string, string | boolean | undefined>;
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { port: { type: "string" }, theme: { type: "string" }, data: { type: "string" }, pack: { type: "string" }, verify: { type: "boolean" }, open: { type: "boolean" }, help: { type: "boolean", short: "h" } },
    }));
  } catch (e) {
    console.error((e as Error).message);
    console.log(USAGE);
    return 2;
  }
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const port = values.port === undefined ? 4310 : Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`--port should be a number, not ${values.port}`);
    return 2;
  }
  if (values.theme && !THEMES.includes(String(values.theme)) && !values.pack) {
    console.error(`--theme should be one of ${THEMES.join(", ")}, or the pack given with --pack`);
    return 2;
  }
  let server: DevServer;
  try {
    server = await createDevServer({ dir: positionals[0] ?? ".", port, theme: values.theme as string | undefined, data: values.data as string | undefined, pack: values.pack as string | undefined, verify: !!values.verify });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    console.error(err.code === "EADDRINUSE" ? `Port ${port} is taken; pass --port with another.` : err.message);
    return 1;
  }
  const docs = server.documents();
  const absolute = resolve(positionals[0] ?? ".");
  const rel = relative(process.cwd(), absolute);
  const dir = rel === "" ? "." : rel.startsWith("..") ? absolute : rel;
  console.log(`polyxd dev  ${server.url}`);
  console.log(`${docs.length} document${docs.length === 1 ? "" : "s"} in ${dir}, watching for changes${server.pack ? ` · pack ${server.pack.name} from --pack` : ""}${values.verify ? findVerifier() ? " · verifier ready" : " · verifier not installed (npm install -D @polyxd/verifier)" : ""}`);
  if (!findBundle()) console.log("The renderer bundle isn't installed, so the page can list and check documents but not render them: npm install @polyxd/react");
  for (const d of docs) console.log(describe(d));
  for (const b of server.broken()) console.log(`  error  ${b.file.padEnd(32)} did not parse: ${b.message}`);
  if (!docs.length) console.log("  (no documents yet: a document is a JSON file with specVersion and components, or an intent file with a document inside)");
  if (values.open) {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    spawn(opener, [server.url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).on("error", () => undefined).unref();
  }
  return 0;
}
