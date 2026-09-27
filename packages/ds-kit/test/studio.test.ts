import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, prepare, push } from "../src/studio.ts";

const scan = { format: "dtcg", total: 12, byTier: { primitive: 8, semantic: 4, component: 0 }, modes: [{ name: "light" }, { name: "dark" }], issues: [{ kind: "unresolved-alias", count: 1 }] };

/** A fetch that records the request and answers like Studio. */
function studio(answer: (form: FormData, headers: Headers) => object, status = 201) {
  const seen: { url: string; form: FormData; headers: Headers }[] = [];
  const fetchFn: typeof fetch = async (url, init) => {
    const form = init!.body as FormData;
    const headers = new Headers(init!.headers as HeadersInit);
    seen.push({ url: String(url), form, headers });
    return new Response(JSON.stringify(answer(form, headers)), { status, headers: { "content-type": "application/json" } });
  };
  return { fetchFn, seen };
}

test("a token file is uploaded as itself with the key as a bearer", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pxd-studio-"));
  const file = join(dir, "tokens.css");
  await writeFile(file, ":root { --color-brand: #123456; }");
  const { fetchFn, seen } = studio(() => ({ designSystemId: "ds1", versionId: "v1", number: 1, scan }));
  const r = await push({ path: file, to: "https://studio.example.com/api/w/acme/", key: "sk_test", name: "Acme", fetch: fetchFn });
  assert.equal(seen[0].url, "https://studio.example.com/api/w/acme/design-systems/import");
  assert.equal(seen[0].headers.get("authorization"), "Bearer sk_test");
  assert.equal((seen[0].form.get("file") as File).name, "tokens.css");
  assert.equal(seen[0].form.get("name"), "Acme");
  assert.equal(seen[0].form.get("packageName"), null);
  assert.equal(r.url, "https://studio.example.com/w/acme/design-systems/ds1/versions/v1/scan");
  assert.match(describe(r, "tokens.css"), /Pushed tokens.css as version 1\.\n12 tokens \(dtcg; 8 primitive, 4 semantic\) · modes: light, dark · 1 thing to look at\nReview the mapping: https:/);
});

test("a package directory is packed with npm and named after its package", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pxd-studio-pkg-"));
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: "@acme/tokens", version: "2.4.0", files: ["tokens"] }));
  await mkdir(join(dir, "tokens"));
  await writeFile(join(dir, "tokens", "semantic.json"), JSON.stringify({ color: { brand: { $type: "color", $value: "#123456" } } }));
  const prepared = await prepare(dir);
  try {
    assert.equal(prepared.packageName, "@acme/tokens");
    assert.equal(prepared.packageVersion, "2.4.0");
    assert.match(prepared.fileName, /^acme-tokens-2\.4\.0\.tgz$/);
    assert.ok(prepared.bytes.length > 100);
  } finally {
    await prepared.cleanup();
  }
  const { fetchFn, seen } = studio((form) => ({ designSystemId: "ds2", versionId: "v9", number: 3, scan, url: "https://studio.example.com/w/acme/design-systems/ds2/versions/v9/scan" }));
  const r = await push({ path: dir, to: "https://studio.example.com/api/w/acme", key: "sk", fetch: fetchFn });
  assert.equal(seen[0].form.get("packageName"), "@acme/tokens");
  assert.equal(seen[0].form.get("packageVersion"), "2.4.0");
  assert.equal(r.number, 3);
});

test("errors are Studio's words, and a bad --to or a missing key stops before any upload", async () => {
  const { fetchFn } = studio(() => ({ error: "That file is over 25 MB" }), 413);
  const dir = await mkdtemp(join(tmpdir(), "pxd-studio-err-"));
  const file = join(dir, "t.json");
  await writeFile(file, "{}");
  await assert.rejects(push({ path: file, to: "https://studio.example.com/api/w/acme", key: "sk", fetch: fetchFn }), /over 25 MB/);
  await assert.rejects(push({ path: file, to: "https://studio.example.com/", key: "sk", fetch: fetchFn }), /--to should look like/);
  await assert.rejects(push({ path: file, to: "https://studio.example.com/api/w/acme", key: "", fetch: fetchFn }), /POLYXD_STUDIO_KEY/);
  await assert.rejects(push({ path: join(dir, "missing.json"), to: "https://studio.example.com/api/w/acme", key: "sk", fetch: fetchFn }), /does not exist/);
});
