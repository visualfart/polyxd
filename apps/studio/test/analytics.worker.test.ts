/**
 * Studio's analytics from the Worker (src/worker/analytics.ts), through the Worker itself: nothing
 * without POSTHOG_KEY; with it, signed_up, screen_published, direction_published and api_fetch,
 * tied to ids only, never a name, an email, a workspace's name or address, or a document.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startWorker } from "./support/worker.ts";
import { pathShape } from "../src/app/analytics.ts";

const KEY = "phc_testkey0123456789";
const doc = () => JSON.parse(readFileSync(new URL("../../../packages/spec/examples/money-send-form.json", import.meta.url), "utf8"));

/** Runs `fn` with fetch recording what goes to PostHog. */
async function recording(fn: (sent: { url: string; body: any }[]) => Promise<void>) {
  const real = globalThis.fetch;
  const sent: { url: string; body: any }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("posthog.com")) {
      sent.push({ url, body: JSON.parse(String(init?.body)) });
      return new Response("{}");
    }
    return real(input, init);
  }) as typeof fetch;
  try {
    await fn(sent);
  } finally {
    globalThis.fetch = real;
  }
}
const settle = () => new Promise((r) => setTimeout(r, 30));

/** Sign up, publish a screen and a Direction, and fetch both with an API key. */
async function journey(worker: Awaited<ReturnType<typeof startWorker>>, email: string, workspace: string) {
  const person = await worker.signUp(email, workspace);
  const w = `/api/w/${workspace.toLowerCase()}`;
  assert.equal((await person.call("POST", `${w}/screens`, { name: "Zq Send money to Priya", key: "zq-send-money", document: doc() })).status, 201);
  assert.equal((await person.call("POST", `${w}/screens/zq-send-money/versions/1/publish`)).status, 200);
  assert.equal((await person.call("POST", `${w}/directions`, { name: "Zq Harbour voice" })).status, 201);
  assert.equal((await person.call("POST", `${w}/directions/zq-harbour-voice/versions/1/publish`)).status, 200);
  const key = (await person.call("POST", `${w}/api-keys`, { name: "zq ci key" })).body.key as string;
  const product = worker.client({ key });
  assert.equal((await product.call("GET", `${w}/screens/zq-send-money`)).status, 200);
  assert.equal((await product.call("GET", `${w}/directions/zq-harbour-voice`)).status, 200);
  assert.equal((await product.call("GET", `${w}/screens/zq-nothing`)).status, 404);
  // Studio's own pages read the same address with a session: not a product, not counted.
  assert.equal((await person.call("GET", `${w}/screens/zq-send-money`)).status, 200);
  return { person, me: (await person.call("GET", "/api/me")).body };
}

test("without POSTHOG_KEY nothing is sent, /api/me offers no analytics and /ingest is a 404", async () => {
  await recording(async (sent) => {
    const worker = await startWorker();
    const { me } = await journey(worker, "ada@harbourline.test", "Harbourline");
    await settle();
    assert.equal(sent.length, 0);
    assert.equal(me.analytics, undefined);
    const res = await worker.app.request("http://localhost:8789/ingest/e/", { method: "POST", body: "{}" }, worker.env);
    assert.equal(res.status, 404);
  });
});

test("with POSTHOG_KEY: the Worker's events carry ids and counts, never names, emails or documents", async () => {
  await recording(async (sent) => {
    const worker = await startWorker();
    Object.assign(worker.env, { POSTHOG_KEY: KEY });
    const email = "mira.okafor@harbourline.test";
    const { me } = await journey(worker, email, "Zqharbour");
    await settle();

    assert.deepEqual(me.analytics, { key: KEY, ui: "https://us.posthog.com" });
    const userId = me.user.id as string;
    const workspaceId = me.workspaces[0].id as string;
    assert.ok(sent.every((s) => s.url === "https://us.i.posthog.com/i/v0/e/"));
    const byName = (name: string) => sent.map((s) => s.body).filter((e) => e.event === name);

    const [signedUp] = byName("signed_up");
    assert.equal(signedUp.distinct_id, userId);
    assert.equal(signedUp.properties.method, "email");

    const [screen] = byName("screen_published");
    assert.equal(screen.distinct_id, userId);
    assert.deepEqual(screen.properties.$groups, { workspace: workspaceId });
    assert.deepEqual([screen.properties.version, screen.properties.kind, typeof screen.properties.warnings], [1, "surface", "number"]);

    const [direction] = byName("direction_published");
    assert.equal(direction.distinct_id, userId);
    assert.equal(direction.properties.version, 1);

    const fetches = byName("api_fetch");
    assert.deepEqual(fetches.map((e) => [e.properties.kind, e.properties.status]), [["screen", 200], ["direction", 200], ["screen", 404]], "API-key fetches only, not the signed-in page's");
    for (const e of fetches) {
      assert.equal(e.distinct_id, `workspace:${workspaceId}`);
      assert.equal(e.properties.$process_person_profile, false, "a product is not a person");
      assert.deepEqual(e.properties.$groups, { workspace: workspaceId });
    }
    assert.deepEqual(new Set(sent.map((s) => s.body.event)), new Set(["signed_up", "screen_published", "direction_published", "api_fetch"]));

    for (const s of sent) {
      assert.equal(s.body.api_key, KEY);
      assert.equal(s.body.properties.$geoip_disable, true);
      const text = JSON.stringify(s.body);
      for (const secret of [email, "mira", "harbourline", "Zqharbour", "zqharbour", "zq-send-money", "Zq Send money", "zq-harbour-voice", "zq ci key", "pxs_", "Alex Kim", "£"]) assert.ok(!text.includes(secret), `${s.body.event} carries "${secret}"`);
    }
  });
});

test("the app's events carry the shape of a path, never a workspace's address or a key", () => {
  assert.equal(pathShape("/w/zqharbour/screens/zq-send-money"), "/w/:workspace/screens/:key");
  assert.equal(pathShape("/w/zqharbour/design-systems/import"), "/w/:workspace/design-systems/import");
  assert.equal(pathShape("/w/zqharbour/design-systems/0f3a/versions/9b2c/map"), "/w/:workspace/design-systems/:id/versions/:version/map");
  assert.equal(pathShape("/w/zqharbour/directions/zq-voice"), "/w/:workspace/directions/:key");
  assert.equal(pathShape("/w/zqharbour/insights/money.send"), "/w/:workspace/insights/:intent");
  assert.equal(pathShape("/invite/0f3a-secret"), "/invite/:id");
});
