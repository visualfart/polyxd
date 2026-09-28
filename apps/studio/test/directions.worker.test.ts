/**
 * The Directions API, through the Worker itself (test/support/worker.ts): create, save versions
 * checked against the schema, publish, and a product fetching the published Direction by key
 * with an API key, the way it fetches a published screen.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { startWorker } from "./support/worker.ts";
import { blankPattern, screenPath } from "../src/direction/model.ts";

const spec = new URL("../../../packages/spec/", import.meta.url);
const json = (path: URL) => JSON.parse(readFileSync(path, "utf8"));
const ajv = new Ajv2020.default({ allErrors: true, strict: false });
ajv.addSchema(json(new URL("schema/check.schema.json", spec)), "check.schema.json");
const valid = ajv.compile(json(new URL("schema/direction.schema.json", spec)));
const validPattern = ajv.compile(json(new URL("schema/pattern.schema.json", spec)));
const halden = () => json(new URL("../../apps/demos/halden/direction.json", spec));

test("a Direction is saved in versions, checked against the schema, published and fetched by key", async () => {
  const worker = await startWorker();
  const mira = await worker.signUp("mira@harbourline.test", "Harbourline");
  const w = "/api/w/harbourline";

  // A workspace rule, which every Direction in it carries.
  assert.equal((await mira.call("POST", `${w}/rules`, { name: "Money only moves from a confirmation", why: "", severity: "error", check: { check: "actionInside", capabilities: ["transfer.confirm"], container: ["Confirm"] } })).status, 201);
  // A screen to use as an exemplar.
  const send = json(new URL("examples/money-send-form.json", spec));
  assert.equal((await mira.call("POST", `${w}/screens`, { name: "Send money", key: "send-money", document: send })).status, 201);

  // Blank: the schema's defaults, valid from the start.
  const made = await mira.call("POST", `${w}/directions`, { name: "Harbourline" });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(made.body.key, "harbourline");
  assert.equal((await mira.call("POST", `${w}/directions`, { name: "Harbourline" })).status, 409);
  const v1 = await mira.call("GET", `${w}/directions/harbourline/versions/1`);
  assert.equal(v1.body.snapshot.direction.profile.density, "comfortable");
  assert.deepEqual(v1.body.export.rules.map((r: { id: string }) => r.id), ["money-only-moves-from-a-confirmation"], "the workspace's rules, as the Direction's");
  assert.ok(valid(v1.body.export), JSON.stringify(valid.errors));

  // Not published yet: a product gets a 404.
  assert.equal((await mira.call("GET", `${w}/directions/harbourline`)).status, 404);

  // A Direction that doesn't fit the schema isn't saved; the answer says where.
  const bad = halden();
  bad.profile.density = "cosy";
  bad.voice.labels.maxWords = 40;
  const refused = await mira.call("POST", `${w}/directions/harbourline/versions`, { direction: bad, patterns: [] });
  assert.equal(refused.status, 422);
  assert.deepEqual(refused.body.issues.map((i: { at: string }) => i.at).sort(), ["/profile/density", "/voice/labels/maxWords"]);
  assert.match(refused.body.error, /Density must be one of/);
  assert.equal((await mira.call("GET", `${w}/directions/harbourline/versions`)).body.versions.length, 1);
  // A team pattern that doesn't fit the pattern schema is refused the same way.
  const badPattern = await mira.call("POST", `${w}/directions/harbourline/versions`, { direction: halden(), patterns: [{ id: "Refund", name: "Refund" }] });
  assert.equal(badPattern.status, 422);
  assert.ok(badPattern.body.issues.every((i: { pattern?: string }) => i.pattern === "Refund"));

  // A good one: Halden's settings, a team pattern, a screen as an exemplar.
  const refund = { ...blankPattern("Refund a payment", []), summary: "Say what comes back, to where, and when.", whenToUse: ["payments.refund"], structure: ["DetailList", "Confirm"] };
  const direction = { ...halden(), exemplars: [{ request: "send Alex the rent", document: screenPath("send-money") }] };
  const saved = await mira.call("POST", `${w}/directions/harbourline/versions`, { direction, patterns: [refund], notes: "Halden's voice" });
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.equal(saved.body.number, 2);
  // The file's own rules gave way to the workspace's.
  assert.deepEqual(saved.body.snapshot.direction.rules.map((r: { id: string }) => r.id), ["money-only-moves-from-a-confirmation"]);
  assert.equal(saved.body.snapshot.direction.name, "harbourline");

  const published = await mira.call("POST", `${w}/directions/harbourline/versions/2/publish`);
  assert.equal(published.status, 200);
  assert.equal(published.body.url, "http://localhost:8789/api/w/harbourline/directions/harbourline");

  // A product, with an API key: the Direction, valid against the schema, and its version.
  const key = (await mira.call("POST", `${w}/api-keys`, { name: "harbourline web" })).body.key;
  const product = worker.client({ key });
  const got = await product.call("GET", `${w}/directions/harbourline`);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get("x-polyxd-direction-version"), "2");
  assert.ok(valid(got.body), JSON.stringify(valid.errors));
  assert.equal(got.body.name, "harbourline");
  assert.equal(got.body.$schema, "https://polyxd.com/schema/0.3/direction.schema.json");
  assert.equal(got.body.voice.spelling, "en-GB");
  assert.deepEqual(got.body.patterns.custom, ["harbourline/patterns/refund-a-payment.json"]);

  // Its paths resolve against its own address: the team's pattern file, and the exemplar screen.
  const base = `http://localhost:8789${w}/directions/harbourline`;
  const patternUrl = new URL(got.body.patterns.custom[0], base).pathname;
  const pattern = await product.call("GET", patternUrl);
  assert.equal(pattern.status, 200);
  assert.ok(validPattern(pattern.body), JSON.stringify(validPattern.errors));
  assert.equal(pattern.body.name, "Refund a payment");
  assert.equal(new URL(got.body.exemplars[0].document, base).pathname, `${w}/screens/send-money`);
  assert.equal((await product.call("GET", `${w}/directions/harbourline/patterns/nope.json`)).status, 404);

  // A key reads; it doesn't write.
  assert.equal((await product.call("POST", `${w}/directions/harbourline/versions`, { direction: halden() })).status, 403);
  assert.equal((await product.call("POST", `${w}/directions`, { name: "Sneaky" })).status, 403);

  // A new version doesn't change what products get until it is published.
  const next = { ...direction, version: "1.1.0", profile: { ...direction.profile, density: "compact" } };
  assert.equal((await mira.call("POST", `${w}/directions/harbourline/versions`, { direction: next, patterns: [refund] })).status, 201);
  assert.equal((await product.call("GET", `${w}/directions/harbourline`)).body.profile.density, "comfortable");
  await mira.call("POST", `${w}/directions/harbourline/versions/3/publish`);
  const now = await product.call("GET", `${w}/directions/harbourline`);
  assert.equal(now.body.profile.density, "compact");
  assert.equal(now.headers.get("x-polyxd-direction-version"), "3");

  // The list says what's published.
  const list = await mira.call("GET", `${w}/directions`);
  assert.deepEqual(list.body.directions.map((d: { key: string; published: number; versions: number; version: string }) => [d.key, d.published, d.versions, d.version]), [["harbourline", 3, 3, "1.1.0"]]);
  const history = await mira.call("GET", `${w}/directions/harbourline/versions`);
  assert.deepEqual(history.body.versions.map((v: { number: number; status: string }) => `${v.number}:${v.status}`), ["3:published", "2:draft", "1:draft"]);

  // Renaming the key moves the address, and the Direction's name with it.
  assert.equal((await mira.call("PUT", `${w}/directions/harbourline`, { key: "harbourline-web" })).status, 200);
  const moved = await product.call("GET", `${w}/directions/harbourline-web`);
  assert.equal(moved.body.name, "harbourline-web");
  assert.deepEqual(moved.body.patterns.custom, ["harbourline-web/patterns/refund-a-payment.json"]);

  // Unpublished, it's a 404 again; deleted, it's gone.
  await mira.call("POST", `${w}/directions/harbourline-web/unpublish`);
  assert.equal((await product.call("GET", `${w}/directions/harbourline-web`)).status, 404);
  assert.equal((await mira.call("DELETE", `${w}/directions/harbourline-web`)).status, 200);
  assert.equal((await mira.call("GET", `${w}/directions/harbourline-web/versions`)).status, 404);
});

test("an imported Direction starts as its first version, and other workspaces can't see it", async () => {
  const worker = await startWorker();
  const mira = await worker.signUp("mira@harbourline.test", "Harbourline");
  const tom = await worker.signUp("tom@quay.test", "Quay");
  const made = await mira.call("POST", "/api/w/harbourline/directions", { name: "Halden", direction: halden(), notes: "Imported" });
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const v = await mira.call("GET", "/api/w/harbourline/directions/halden/versions/1");
  assert.equal(v.body.notes, "Imported");
  assert.equal(v.body.snapshot.direction.voice.readingLevel.maxGrade, 7);
  // No workspace rules yet, so none are carried.
  assert.equal(v.body.export.rules, undefined);
  assert.equal((await tom.call("GET", "/api/w/harbourline/directions")).status, 404);
  // An imported file that doesn't fit is refused whole.
  const broken = halden();
  delete broken.version;
  assert.equal((await mira.call("POST", "/api/w/harbourline/directions", { name: "Broken", direction: broken })).status, 422);
});
