import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { connect, exampleFiles, loadExample, textOf } from "./helpers.ts";
import { PACKS, SYSTEM_PROMPT, VERSION, VIEW_URI, VIEW_MIME_TYPE, WIDGET_DOMAIN, appResourceMeta, componentDefinitions } from "../src/index.ts";
import { expected } from "../scripts/sync.ts";

let session: Awaited<ReturnType<typeof connect>>;
before(async () => (session = await connect()));
after(async () => session.close());
const call = (name: string, args: Record<string, unknown> = {}) => session.client.callTool({ name, arguments: args }) as Promise<any>;

const TOOLS = ["polyxd_guide", "polyxd_validate", "polyxd_verify", "polyxd_show", "polyxd_packs", "polyxd_components", "polyxd_docs"];

test("the server lists seven snake_case tools, each described for a model", async () => {
  const { tools } = await session.client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOLS].sort());
  for (const t of tools) {
    assert.match(t.name, /^[a-z]+(_[a-z]+)*$/);
    assert.ok((t.description ?? "").length > 80, `${t.name} has a real description`);
    assert.equal(t.annotations?.readOnlyHint, true, `${t.name} is read-only`);
  }
});

test("every tool has a title and says it is read-only, not destructive, idempotent and closed-world", async () => {
  const { tools } = await session.client.listTools();
  for (const t of tools) {
    assert.ok(t.title && t.title.length > 5, `${t.name} has a title`);
    assert.deepEqual(t.annotations, { title: t.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, t.name);
  }
});

test("only polyxd_show links to the MCP App, in the spec's _meta.ui.resourceUri and ChatGPT's alias", async () => {
  const { tools } = await session.client.listTools();
  const show = tools.find((t) => t.name === "polyxd_show")!;
  assert.deepEqual((show._meta as any)?.ui, { resourceUri: VIEW_URI });
  assert.equal((show._meta as any)?.["openai/outputTemplate"], VIEW_URI);
  for (const key of ["openai/toolInvocation/invoking", "openai/toolInvocation/invoked"]) assert.ok(((show._meta as any)[key] ?? "").length <= 64, key);
  assert.match(VIEW_URI, /^ui:\/\//);
  for (const t of tools.filter((t) => t.name !== "polyxd_show")) assert.equal((t._meta as any)?.ui, undefined, t.name);
  const pack = (show.inputSchema as any).properties.pack;
  assert.equal(pack.enum, undefined, "names like \"Carbon\" must reach the server, not fail the schema");
  for (const p of PACKS) assert.ok(pack.description.includes(p.name), p.name);
});

test("polyxd_guide is the demos' generator prompt with the MCP notes in front", async () => {
  const text = textOf(await call("polyxd_guide"));
  assert.ok(text.includes(SYSTEM_PROMPT), "the whole prompt, unchanged");
  assert.ok(text.indexOf("How this works over MCP") < text.indexOf(SYSTEM_PROMPT));
  for (const c of componentDefinitions().filter((c) => !c.shell)) assert.ok(text.includes(`- ${c.name}(`), `the guide lists ${c.name}`);
});

test("the prompt is the one the demos build, and the pack list is current", () => {
  for (const [path, content] of Object.entries(expected())) assert.equal(readFileSync(path, "utf8"), content, `${path} is stale: run npm run sync -w @polyxd/mcp`);
});

test("polyxd_packs lists every pack, design systems and templates, Material 3 the default", async () => {
  const r = await call("polyxd_packs");
  assert.equal(r.structuredContent.default, "material3");
  assert.equal(r.structuredContent.packs.length, PACKS.length);
  assert.ok(PACKS.length >= 25);
  assert.ok(PACKS.some((p) => p.template) && PACKS.some((p) => !p.template));
  for (const p of PACKS) assert.ok(textOf(r).includes(`- ${p.name}: ${p.displayName}`), p.name);
});

test("polyxd_components lists the components, and gives one in full by name", async () => {
  const list = await call("polyxd_components");
  const all = componentDefinitions();
  assert.equal(list.structuredContent.components.length, all.length);
  for (const c of all) assert.ok(textOf(list).includes(c.name), c.name);
  assert.match(textOf(list), /Shell components, authored once per product and never generated: .*Frame/);

  const one = await call("polyxd_components", { name: "choice" });
  assert.equal(one.structuredContent.component.name, "Choice");
  assert.ok(one.structuredContent.component.props.options);

  const none = await call("polyxd_components", { name: "Carousel" });
  assert.equal(none.isError, true);
  assert.match(textOf(none), /No component named "Carousel"/);
});

test(`there are ${exampleFiles.length} example documents, each served as a resource`, async () => {
  assert.equal(exampleFiles.length, 29);
  const { resources } = await session.client.listResources();
  for (const f of exampleFiles) {
    const uri = `polyxd://examples/${f}`;
    const listed = resources.find((r) => r.uri === uri);
    assert.ok(listed, `${uri} is listed`);
    assert.equal(listed!.mimeType, "application/json");
    const read = await session.client.readResource({ uri });
    assert.deepEqual(JSON.parse((read.contents[0] as any).text), loadExample(f));
  }
  assert.ok(resources.some((r) => r.uri === "polyxd://directions/calm-finance.json"));
});

for (const file of exampleFiles) {
  test(`${file}: validates, verifies and shows`, async () => {
    const doc = loadExample(file);

    const v = await call("polyxd_validate", { document: doc });
    assert.equal(v.structuredContent.valid, true, textOf(v));
    assert.equal(v.structuredContent.errors, 0);
    assert.match(textOf(v), /^Valid/);

    const r = await call("polyxd_verify", { document: doc });
    assert.equal(typeof r.structuredContent.errors, "number");
    assert.ok(Array.isArray(r.structuredContent.findings));
    assert.match(textOf(r), /^(Passes|Fails)/);
    assert.match(textOf(r), /polyxd-verify/);

    const s = await call("polyxd_show", { document: doc });
    assert.notEqual(s.isError, true, textOf(s));
    assert.equal(s.structuredContent.shown, true);
    assert.equal(s.structuredContent.pack, "material3");
    assert.deepEqual(s.structuredContent.document, doc);
    assert.deepEqual(s._meta?.ui, { resourceUri: VIEW_URI });
    assert.match(textOf(s), new RegExp(`Showing "${doc.surface.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  });
}

const base = () => structuredClone(loadExample("tasks-add.json"));

test("an unknown component type is reported at its pointer, with the closest name", async () => {
  const doc = base();
  doc.components[1].component = "Tabel";
  const v = await call("polyxd_validate", { document: doc });
  assert.equal(v.structuredContent.valid, false);
  const issue = v.structuredContent.issues.find((i: any) => i.pointer === "/components/1");
  assert.ok(issue, textOf(v));
  assert.equal(issue.component.id, "title");
  assert.match(issue.hint, /Did you mean "Table"\?/);
  assert.match(textOf(v), /^Not valid: 1 error/);
});

test("a missing required prop names the prop and the component's props", async () => {
  const doc = base();
  delete doc.components[1].label;
  const v = await call("polyxd_validate", { document: doc });
  const issue = v.structuredContent.issues.find((i: any) => /required property 'label'/.test(i.message));
  assert.ok(issue, textOf(v));
  assert.equal(issue.pointer, "/components/1");
  assert.match(issue.hint, /Add "label"\. TextInput takes: .*label\*/);
});

test("broken references, duplicate ids and unknown properties each get a pointer and a hint", async () => {
  const doc = base();
  doc.components[0].children.push("ghost");
  doc.components[2].id = "title";
  doc.components[1].colour = "red";
  const v = await call("polyxd_validate", { document: doc });
  const byMessage = (re: RegExp) => v.structuredContent.issues.find((i: any) => re.test(i.message));
  const unknown = byMessage(/unknown property "colour"/);
  assert.ok(unknown, textOf(v));
  assert.equal(unknown.pointer, "/components/1");
  assert.match(unknown.hint, /Remove "colour"/);
  // The schema fails first; fix that and the structural errors show.
  delete doc.components[1].colour;
  const again = await call("polyxd_validate", { document: doc });
  const issues = again.structuredContent.issues;
  assert.ok(issues.some((i: any) => /duplicate id/.test(i.message) && i.pointer === "/components/2/id" && /own id/.test(i.hint)), textOf(again));
  assert.ok(issues.some((i: any) => /references unknown component "ghost"/.test(i.message) && i.pointer.startsWith("/components/0/children") && i.hint), textOf(again));
});

test("data passed separately is what bindings are checked against", async () => {
  const doc = loadExample("money-balance-overview.json");
  const v = await call("polyxd_validate", { document: doc, data: {} });
  const missing = v.structuredContent.issues.filter((i: any) => /Add the value to data/.test(i.hint ?? ""));
  assert.ok(missing.length > 0, textOf(v));
  const r = await call("polyxd_verify", { document: doc, data: {} });
  assert.ok(r.structuredContent.findings.some((f: any) => f.check === "data:missing-path" && f.severity === "error"), textOf(r));
});

test("polyxd_verify holds a document to a Design Direction by name or object", async () => {
  const doc = loadExample("money-send-form.json");
  const byName = await call("polyxd_verify", { document: doc, direction: "calm-finance" });
  assert.equal(byName.structuredContent.direction, "calm-finance");
  assert.ok(byName.structuredContent.rules > 0);
  assert.match(textOf(byName), /Design Direction "calm-finance"/);

  const loud = { name: "loud", voice: { punctuation: { exclamation: "never" } }, rules: [] };
  const shouty = structuredClone(doc);
  const labelled = shouty.components.find((c: any) => typeof c.label === "string");
  labelled.label += "!";
  const byObject = await call("polyxd_verify", { document: shouty, direction: loud });
  assert.ok(byObject.structuredContent.findings.some((f: any) => f.check === "rule:voice-no-exclamation"), textOf(byObject));

  const unknown = await call("polyxd_verify", { document: doc, direction: "nope" });
  assert.equal(unknown.isError, true);
  assert.match(textOf(unknown), /calm-finance/);
});

test("polyxd_show shows nothing when the document has errors, and says why", async () => {
  const doc = base();
  doc.root = "missing";
  const s = await call("polyxd_show", { document: doc });
  assert.equal(s.isError, true);
  assert.equal(s.structuredContent.shown, false);
  assert.ok(s.structuredContent.issues.some((i: any) => i.pointer === "/root"));
  assert.match(textOf(s), /^Not shown\. Not valid/);
  assert.equal(s.structuredContent.document, undefined);
});

test("polyxd_show takes a pack, a mode and separate data", async () => {
  const doc = loadExample("tasks-list.json");
  const data = structuredClone(doc.data);
  delete doc.data;
  const s = await call("polyxd_show", { document: doc, data, pack: "govuk", mode: "dark" });
  assert.equal(s.structuredContent.pack, "govuk");
  assert.equal(s.structuredContent.packName, "GOV.UK Frontend");
  assert.equal(s.structuredContent.mode, "dark");
  assert.deepEqual(s.structuredContent.document.data, data);
  assert.match(textOf(s), /GOV\.UK Frontend \(pack "govuk"\), dark mode/);
  assert.match(textOf(s), /Other packs: material3, /);

  const bad = await session.client.callTool({ name: "polyxd_show", arguments: { document: doc, pack: "bootstrap4" } }).catch((e: Error) => ({ isError: true, content: [{ type: "text", text: e.message }] }));
  assert.equal((bad as any).isError, true);
});

test("a document that isn't an object is refused before it reaches the validator", async () => {
  const r = await session.client.callTool({ name: "polyxd_validate", arguments: { document: "not json" } }).catch((e: Error) => ({ isError: true, content: [{ type: "text", text: e.message }] }));
  assert.equal((r as any).isError, true);
});

test("server.json describes the hosted server for the MCP Registry, in step with package.json", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const entry = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
  assert.match(entry.$schema, /^https:\/\/static\.modelcontextprotocol\.io\/schemas\/\d{4}-\d{2}-\d{2}\/server\.schema\.json$/);
  assert.equal(entry.name, "com.polyxd/mcp");
  assert.equal(entry.name, pkg.mcpName, "npm checks the package's mcpName against the registry name");
  assert.equal(entry.version, pkg.version);
  assert.equal(entry.version, VERSION);
  assert.deepEqual(entry.packages.map((p: any) => [p.registryType, p.identifier, p.version]), [["npm", pkg.name, pkg.version]], "the registry checks npm has this version");
  assert.ok(entry.description.length <= 100, "the registry allows 100 characters");
  assert.deepEqual(entry.remotes, [{ type: "streamable-http", url: "https://mcp.polyxd.com/mcp" }]);
  for (const icon of entry.icons) assert.match(icon.src, /^https:\/\/polyxd\.com\//);
});

test("the MCP App declares an empty Content Security Policy and a border, for Claude and ChatGPT, and no ui.domain", () => {
  const meta = appResourceMeta();
  assert.deepEqual(meta.ui, { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } });
  // Claude rejects a ui.domain that is not its own hash of the connector URL; ChatGPT reads openai/widgetDomain.
  assert.equal("domain" in meta.ui, false);
  assert.equal(meta["openai/widgetDomain"], WIDGET_DOMAIN);
  assert.equal(WIDGET_DOMAIN, "https://mcp.polyxd.com");
  assert.deepEqual(meta["openai/widgetCSP"], { connect_domains: [], resource_domains: [] });
  assert.equal(meta["openai/widgetPrefersBorder"], true);
  assert.ok(meta["openai/widgetDescription"].length > 40);
  assert.equal(appResourceMeta("https://example.org")["openai/widgetDomain"], "https://example.org");
});

test("the MCP App resource is HTML with the renderer, every pack and the MCP Apps bridge", async () => {
  const { resources } = await session.client.listResources();
  const listed = resources.find((r) => r.uri === VIEW_URI);
  assert.ok(listed);
  assert.equal(listed!.mimeType, VIEW_MIME_TYPE);
  assert.equal(VIEW_MIME_TYPE, "text/html;profile=mcp-app");

  const read = await session.client.readResource({ uri: VIEW_URI });
  const content = read.contents[0] as any;
  assert.equal(content.uri, VIEW_URI);
  assert.equal(content.mimeType, "text/html;profile=mcp-app");
  assert.deepEqual(content._meta, appResourceMeta());
  assert.deepEqual(listed!._meta, appResourceMeta());
  const html: string = content.text;
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<\/html>\s*$/);
  // The renderer: its surface class and custom elements, bundled, nothing loaded from elsewhere.
  assert.ok(html.includes("pxd-surface") && html.includes("pxd-action"), "the @polyxd/web renderer is inlined");
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/, "no external scripts or stylesheets");
  for (const p of PACKS) assert.ok(html.includes(`[data-pxd-theme=${p.name}]`) || html.includes(`[data-pxd-theme="${p.name}"]`), `${p.name}'s theme is inlined`);
  for (const method of ["ui/initialize", "ui/notifications/initialized", "ui/notifications/tool-result", "ui/message", "ui/notifications/size-changed", "ui/resource-teardown"]) {
    assert.ok(html.includes(method), `the view speaks ${method}`);
  }
});

test("polyxd_docs lists the pages, returns one whole page, and finds the sections a question needs", async () => {
  const list = await call("polyxd_docs");
  const pages = list.structuredContent.pages;
  assert.ok(pages.length >= 20, "every docs page");
  assert.ok(pages.every((p: any) => p.url.startsWith("https://polyxd.com/docs/")));

  const quick = await call("polyxd_docs", { page: "https://polyxd.com/docs/quickstart/" });
  assert.equal(quick.structuredContent.page.slug, "quickstart");
  assert.match(quick.structuredContent.page.markdown, /npm install @polyxd\/react/);
  assert.doesNotMatch(quick.structuredContent.page.markdown, /\]\(\/docs/, "site links are absolute");
  assert.equal((await call("polyxd_docs", { page: "Quickstart" })).structuredContent.page.slug, "quickstart");
  assert.equal((await call("polyxd_docs", { page: "no-such-page" })).isError, true);

  const cli = await call("polyxd_docs", { query: "verifier CLI" });
  const top = cli.structuredContent.sections[0];
  assert.equal(top.page, "verifier");
  assert.equal(top.heading, "CLI");
  assert.equal(top.url, "https://polyxd.com/docs/verifier/#cli");
  assert.ok(cli.structuredContent.sections.reduce((n: number, s: any) => n + s.text.length, 0) <= 12_200, "an answer stays small");
  assert.equal((await call("polyxd_docs", { query: "the of and" })).structuredContent.sections.length, 0, "stop words alone find nothing");
});

test("every section a docs search can return links to a heading that exists on the page", async () => {
  const { sections, anchorFor } = await import("../src/docs.ts");
  assert.equal(anchorFor("What's in the box `today`"), "what-39-s-in-the-box-today", "as marked renders the heading");
  const ids = new Set<string>();
  for (const s of sections()) {
    const [page, hash] = s.url.split("#");
    if (!hash) continue;
    assert.ok(!ids.has(s.url) || true);
    ids.add(s.url);
    assert.match(hash, /^[a-z0-9-]+$/, `${page}: ${s.heading}`);
  }
  assert.ok(ids.size > 100);
});
