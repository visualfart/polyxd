import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDocument, createDevServer, describe, discoverDocuments, type DevServer } from "../src/dev.ts";
import { packCss } from "../src/dev-pack.ts";

/** A small valid document: a page with a text block bound to /greeting. */
const document = (extra: Record<string, unknown> = {}, data?: unknown) => ({
  specVersion: "0.2.0",
  surface: { id: "hello", title: "Hello", ...extra },
  root: "page",
  components: [
    { id: "page", component: "Section", title: "Hello", children: ["greeting"] },
    { id: "greeting", component: "Text", text: { path: "/greeting" } },
  ],
  ...(data !== undefined ? { data } : {}),
});

async function folder(files: Record<string, unknown>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pxd-dev-"));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(join(dir, name, ".."), { recursive: true });
    await writeFile(join(dir, name), typeof content === "string" ? content : JSON.stringify(content));
  }
  return dir;
}

/** Reads one server-sent event of the given name off a fetch response. */
async function nextEvent(res: Response, name: string, timeoutMs = 4000): Promise<any> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = setTimeout(() => reader.cancel(), timeoutMs);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error(`stream ended before "${name}"`);
      buffer += decoder.decode(value, { stream: true });
      let at: number;
      while ((at = buffer.indexOf("\n\n")) > -1) {
        const chunk = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        const event = /^event: (.+)$/m.exec(chunk)?.[1];
        const data = /^data: (.+)$/m.exec(chunk)?.[1];
        if (event === name && data) return JSON.parse(data);
      }
    }
  } finally {
    clearTimeout(deadline);
    await reader.cancel().catch(() => undefined);
  }
}

test("discovery: embedded data, sibling data, intent-shaped files; other JSON ignored", async () => {
  const dir = await folder({
    "embedded.json": document({}, { greeting: "hi" }),
    "sibling.json": document({ id: "sib" }),
    "sibling.data.json": { greeting: "from the sibling" },
    "bare.json": document({ id: "bare" }),
    "nested/intent.json": { id: "say.hello", title: "Say hello", ask: ["hello"], document: document({ id: "intent-doc", origin: "authored" }, { greeting: "yo" }), data: { greeting: "view:greeting" } },
    "tsconfig.json": { compilerOptions: { strict: true } },
    "registry.json": { capabilities: [] },
    "manifest.json": { name: "acme", modes: {} },
    "notes.txt": "not json",
  });
  try {
    const { documents, broken } = await discoverDocuments(dir, { defaultData: { greeting: "default" } });
    assert.deepEqual(broken, []);
    assert.deepEqual(
      documents.map((d) => [d.file, d.kind, d.dataFrom, d.data]),
      [
        ["bare.json", "document", "default", { greeting: "default" }],
        ["embedded.json", "document", "embedded", { greeting: "hi" }],
        ["nested/intent.json", "intent", "embedded", { greeting: "yo" }],
        ["sibling.json", "document", "sibling", { greeting: "from the sibling" }],
      ],
    );
    const intent = documents.find((d) => d.file === "nested/intent.json")!;
    assert.equal(intent.id, "intent-doc");
    assert.equal(intent.origin, "authored");
    assert.equal(intent.document.surface.title, "Hello");
    assert.ok(documents.every((d) => d.check.errors === 0 && d.check.warnings === 0), JSON.stringify(documents.map((d) => d.check.issues)));
    const without = await discoverDocuments(dir);
    assert.equal(without.documents.find((d) => d.file === "bare.json")!.dataFrom, "none");
    assert.match(describe(intent), /^ {2}ok {5}nested\/intent\.json +Hello +intent · authored$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the static check reports a missing path against the data, and a schema error as an error", () => {
  const missing = checkDocument(document(), { somethingElse: 1 });
  assert.equal(missing.errors, 0);
  assert.equal(missing.warnings, 1);
  assert.equal(missing.issues[0].code, "data:missing-path");
  assert.match(missing.issues[0].message, /\/greeting/);
  assert.match(describe({ file: "x.json", id: "x", title: "X", kind: "document", dataFrom: "embedded", document: {}, check: missing }), /warn +x\.json.*\(1 warning\)$/);

  const bad = checkDocument({ ...document(), components: [{ id: "page", component: "Nope" }] }, { greeting: "hi" });
  assert.ok(bad.errors > 0);
  assert.match(describe({ file: "bad.json", id: "x", title: "Bad", kind: "document", dataFrom: "embedded", document: {}, check: bad }), /^ {2}error {2}bad\.json/);
});

test("the server answers /, /api/documents and a document's JSON, and streams a change", async () => {
  const dir = await folder({ "one.json": document({}, { greeting: "hi" }), "two.json": document({ id: "two" }), "two.data.json": { greeting: "two" } });
  let server: DevServer | undefined;
  try {
    server = await createDevServer({ dir, port: 0, theme: "carbon" });
    const page = await fetch(server.url);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") ?? "", /text\/html/);
    const html = await page.text();
    assert.match(html, /<title>polyxd dev<\/title>/);
    assert.match(html, /"theme":"carbon"/);
    assert.match(html, /\/preview\/polyxd\.js/);

    const list = await (await fetch(`${server.url}api/documents`)).json();
    assert.equal(list.theme, "carbon");
    assert.deepEqual(
      list.documents.map((d: any) => [d.file, d.dataFrom, d.check]),
      [
        ["one.json", "embedded", { errors: 0, warnings: 0 }],
        ["two.json", "sibling", { errors: 0, warnings: 0 }],
      ],
    );
    assert.equal("document" in list.documents[0], false, "the list carries metadata, not whole documents");

    const two = await (await fetch(`${server.url}api/documents/two.json`)).json();
    assert.equal(two.document.surface.id, "two");
    assert.deepEqual(two.data, { greeting: "two" });
    assert.deepEqual(two.issues, []);
    assert.equal((await fetch(`${server.url}api/documents/none.json`)).status, 404);

    // An SSE client hears about a save: the document changed, and its check now has a warning.
    const stream = await fetch(`${server.url}api/events`);
    assert.match(stream.headers.get("content-type") ?? "", /text\/event-stream/);
    const hello = await nextEvent(stream, "hello");
    assert.equal(hello.documents.length, 2);
    const stream2 = await fetch(`${server.url}api/events`);
    await writeFile(join(dir, "two.data.json"), JSON.stringify({ greetings: "misspelt" }));
    // fs.watch is what a real run relies on; a rescan is also triggered here so the test never waits on a platform's watcher.
    setTimeout(() => void server!.rescan(), 150);
    const change = await nextEvent(stream2, "change");
    assert.deepEqual(change.changed, ["two.json"]);
    assert.deepEqual(change.removed, []);
    assert.deepEqual(change.documents.find((d: any) => d.file === "two.json").check, { errors: 0, warnings: 1 });
    const after = await (await fetch(`${server.url}api/documents/two.json`)).json();
    assert.equal(after.issues[0].code, "data:missing-path");

    // A removed file leaves the list; a file that no longer parses is reported, not dropped silently.
    const stream3 = await fetch(`${server.url}api/events`);
    await rm(join(dir, "one.json"));
    await writeFile(join(dir, "two.json"), "{ not json");
    setTimeout(() => void server!.rescan(), 150);
    const gone = await nextEvent(stream3, "change");
    assert.deepEqual(gone.removed.sort(), ["one.json", "two.json"]);
    assert.equal(gone.broken[0].file, "two.json");
  } finally {
    await server?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("a folder that isn't one, and a --data file used for documents without data", async () => {
  await assert.rejects(createDevServer({ dir: join(tmpdir(), "pxd-dev-does-not-exist"), port: 0 }), /is not a folder/);
  const dir = await folder({ "doc.json": document(), "sample.json": { greeting: "sample" } });
  let server: DevServer | undefined;
  try {
    server = await createDevServer({ dir, port: 0, data: join(dir, "sample.json") });
    const list = await (await fetch(`${server.url}api/documents`)).json();
    assert.deepEqual(list.documents.map((d: any) => [d.file, d.dataFrom]), [["doc.json", "default"]]);
    const doc = await (await fetch(`${server.url}api/documents/doc.json`)).json();
    assert.deepEqual(doc.data, { greeting: "sample" });
  } finally {
    await server?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("--pack: a theme stylesheet is served as itself, under its own name", async () => {
  const dir = await folder({ "doc.json": document({}, { greeting: "hi" }), "acme.css": '[data-pxd-theme="acme"] { --pxd-color-surface-default: #fff; }' });
  let server: DevServer | undefined;
  try {
    const pack = await packCss(join(dir, "acme.css"));
    assert.equal(pack.name, "acme");
    server = await createDevServer({ dir, port: 0, pack: join(dir, "acme.css") });
    const list = await (await fetch(`${server.url}api/documents`)).json();
    assert.equal(list.pack, "acme");
    assert.equal(list.theme, "acme", "with no --theme, the pack given is the one selected first");
    assert.match(await (await fetch(`${server.url}pack.css`)).text(), /--pxd-color-surface-default/);
  } finally {
    await server?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
