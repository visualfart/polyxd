/**
 * The tools' output schemas: every tool declares one, and every result's structuredContent conforms,
 * checked here with Ajv (strict, 2020-12) and with the validator the SDK uses in a Worker. Results
 * with isError may leave structuredContent out; the SDK must pass them through untouched.
 */
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { McpServer, InMemoryTransport, fromJsonSchema } from "@modelcontextprotocol/server";
import { Client } from "@modelcontextprotocol/client";
import { connect, exampleFiles, loadExample, textOf } from "./helpers.ts";
import { PACKS, SPEC_VERSION, componentDefinitions, exampleDirections, guide } from "../src/index.ts";

const TOOLS = ["polyxd_guide", "polyxd_validate", "polyxd_verify", "polyxd_show", "polyxd_packs", "polyxd_components", "polyxd_docs"];

let session: Awaited<ReturnType<typeof connect>>;
// Strict, except that a oneOf branch may require a property the root declares (strictRequired).
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
const cf = new CfWorkerJsonSchemaValidator({ shortcircuit: false });
const checks = new Map<string, { ajv: ValidateFunction; cf: (v: unknown) => { valid: boolean; errorMessage?: string } }>();

before(async () => {
  session = await connect();
  const { tools } = await session.client.listTools();
  for (const t of tools) if (t.outputSchema) checks.set(t.name, { ajv: ajv.compile(t.outputSchema), cf: cf.getValidator(t.outputSchema as any) });
});
after(async () => session.close());

const call = (name: string, args: Record<string, unknown> = {}) => session.client.callTool({ name, arguments: args }) as Promise<any>;

/** Checks a result's structuredContent against the tool's advertised schema, with both validators. */
function conforms(name: string, result: any) {
  const check = checks.get(name)!;
  assert.ok(result.structuredContent && typeof result.structuredContent === "object", `${name} returned structuredContent`);
  assert.ok(check.ajv(result.structuredContent), `${name}: ${ajv.errorsText(check.ajv.errors)}`);
  const worker = check.cf(result.structuredContent);
  assert.ok(worker.valid, `${name} (Worker validator): ${worker.errorMessage}`);
}

/** Every property a schema declares, at any depth, with its path. */
function* properties(schema: any, path = ""): Generator<[string, any]> {
  for (const [key, sub] of Object.entries<any>(schema.properties ?? {})) {
    yield [`${path}/${key}`, sub];
    yield* properties(sub, `${path}/${key}`);
    if (sub.items) yield* properties(sub.items, `${path}/${key}[]`);
  }
}

test("tools/list gives all seven tools an object-rooted output schema, every property described", async () => {
  const { tools } = await session.client.listTools();
  assert.deepEqual(tools.filter((t) => t.outputSchema).map((t) => t.name).sort(), [...TOOLS].sort());
  for (const t of tools) {
    const schema = t.outputSchema as any;
    // A non-object root would make the SDK wrap results as {result: ...} on the 2025-11-25 wire.
    assert.equal(schema.type, "object", t.name);
    assert.equal(schema.$schema, undefined, `${t.name}: no $schema, so every validator reads it as 2020-12`);
    assert.ok(Object.keys(schema.properties).length > 0, t.name);
    for (const [path, sub] of properties(schema)) assert.ok((sub.description ?? "").length > 10, `${t.name} ${path} has a description`);
  }
});

test("polyxd_guide returns the guide as structuredContent too, the same text as its content", async () => {
  const r = await call("polyxd_guide");
  conforms("polyxd_guide", r);
  assert.deepEqual(r.structuredContent, { specVersion: SPEC_VERSION, guide: guide() });
  assert.equal(textOf(r), guide());
});

test("polyxd_packs and polyxd_components (the list and every component by name) conform", async () => {
  conforms("polyxd_packs", await call("polyxd_packs"));
  conforms("polyxd_components", await call("polyxd_components"));
  for (const c of componentDefinitions()) {
    const one = await call("polyxd_components", { name: c.name });
    conforms("polyxd_components", one);
    assert.equal(one.structuredContent.component.name, c.name);
  }
});

for (const file of exampleFiles) {
  test(`${file}: validate, verify and show results conform to their output schemas`, async () => {
    const doc = loadExample(file);
    conforms("polyxd_validate", await call("polyxd_validate", { document: doc }));
    // Data passed separately that leaves every binding empty: a report full of issues.
    conforms("polyxd_validate", await call("polyxd_validate", { document: doc, data: {} }));
    conforms("polyxd_verify", await call("polyxd_verify", { document: doc }));
    conforms("polyxd_verify", await call("polyxd_verify", { document: doc, data: {} }));
    for (const d of exampleDirections()) conforms("polyxd_verify", await call("polyxd_verify", { document: doc, direction: d.name }));
    conforms("polyxd_show", await call("polyxd_show", { document: doc }));
    const pack = PACKS[exampleFiles.indexOf(file) % PACKS.length].name;
    const dark = await call("polyxd_show", { document: doc, pack, mode: "dark" });
    conforms("polyxd_show", dark);
    assert.equal(dark.structuredContent.pack, pack);
  });
}

test("reports on broken documents conform: unknown types, missing props, bad references", async () => {
  const doc = loadExample("tasks-add.json");
  doc.components[1].component = "Tabel";
  doc.components[2].colour = "red";
  const v = await call("polyxd_validate", { document: doc });
  conforms("polyxd_validate", v);
  assert.equal(v.structuredContent.valid, false);
  // An issue outside any component has no component; one inside has it, with no empty keys.
  const noRoot = { ...loadExample("tasks-add.json"), root: "missing" };
  const r = await call("polyxd_validate", { document: noRoot });
  conforms("polyxd_validate", r);
  const atRoot = r.structuredContent.issues.find((i: any) => i.pointer === "/root");
  assert.ok(atRoot && !("component" in atRoot), textOf(r));
  conforms("polyxd_verify", await call("polyxd_verify", { document: noRoot }));
  conforms("polyxd_validate", await call("polyxd_validate", { document: {} }));
  conforms("polyxd_verify", await call("polyxd_verify", { document: {} }));
});

test("a direction object without a name, with odd severities, still gives a conforming report", async () => {
  const doc = loadExample("money-send-form.json");
  const labelled = doc.components.find((c: any) => typeof c.label === "string");
  labelled.label += "!";
  const r = await call("polyxd_verify", { document: doc, direction: { voice: { punctuation: { exclamation: "never" } }, rules: [] } });
  conforms("polyxd_verify", r);
  assert.equal("direction" in r.structuredContent, false);
  assert.ok(r.structuredContent.findings.some((f: any) => f.check === "rule:voice-no-exclamation"), textOf(r));
});

test("error results pass through: polyxd_show's not-shown result conforms, and results without structuredContent are left alone", async () => {
  const bad = { ...loadExample("tasks-add.json"), root: "missing" };
  const s = await call("polyxd_show", { document: bad });
  assert.equal(s.isError, true);
  assert.match(textOf(s), /^Not shown\. Not valid/);
  conforms("polyxd_show", s);
  assert.equal(s.structuredContent.shown, false);

  // isError results without structuredContent keep their own message, not an output validation error.
  const none = await call("polyxd_components", { name: "Carousel" });
  assert.equal(none.isError, true);
  assert.equal(none.structuredContent, undefined);
  assert.match(textOf(none), /^No component named "Carousel"/);
  const unknown = await call("polyxd_verify", { document: loadExample("tasks-add.json"), direction: "nope" });
  assert.equal(unknown.isError, true);
  assert.match(textOf(unknown), /^No example Design Direction named "nope"/);
});

test("the SDK checks successful results against the output schema, and skips isError results", async () => {
  const server = new McpServer({ name: "probe", version: "0.0.0" });
  const outputSchema = fromJsonSchema({ type: "object", properties: { n: { type: "integer" } }, required: ["n"], additionalProperties: false });
  const inputSchema = fromJsonSchema<{ kind: string }>({ type: "object", properties: { kind: { type: "string" } }, required: ["kind"] });
  server.registerTool("probe", { description: "probe", inputSchema, outputSchema }, async ({ kind }) => {
    const content = [{ type: "text" as const, text: kind }];
    if (kind === "ok") return { content, structuredContent: { n: 1 } };
    if (kind === "wrong") return { content, structuredContent: { n: "one" } };
    if (kind === "missing") return { content };
    if (kind === "error-bare") return { isError: true, content };
    return { isError: true, content, structuredContent: { other: true } };
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await server.connect(b);
  await client.connect(a);
  try {
    await client.listTools();
    // The client checks results too once it has the schema, so ask the server directly with a raw request.
    const raw = (kind: string) => client.request({ method: "tools/call", params: { name: "probe", arguments: { kind } } } as any) as Promise<any>;
    const ok = await raw("ok");
    assert.deepEqual(ok.structuredContent, { n: 1 });
    const wrong = await raw("wrong");
    assert.equal(wrong.isError, true);
    assert.match(textOf(wrong), /Output validation error: Invalid structured content/);
    const missing = await raw("missing");
    assert.equal(missing.isError, true);
    assert.match(textOf(missing), /has an output schema but no structured content/);
    const bare = await raw("error-bare");
    assert.equal(bare.isError, true);
    assert.equal(textOf(bare), "error-bare");
    const shaped = await raw("error-shaped");
    assert.equal(shaped.isError, true);
    assert.equal(textOf(shaped), "error-shaped");
    assert.deepEqual(shaped.structuredContent, { other: true }, "an error's structuredContent need not match the schema");
  } finally {
    await client.close();
    await server.close();
  }
});

test("polyxd_docs results conform: the list of pages, one page, and a search", async () => {
  conforms("polyxd_docs", await call("polyxd_docs"));
  conforms("polyxd_docs", await call("polyxd_docs", { page: "quickstart" }));
  conforms("polyxd_docs", await call("polyxd_docs", { query: "Web Components renderer" }));
});
