/**
 * polyxd.com's analytics: the /ingest proxy (worker/analytics.ts) and the build's tag
 * (scripts/analytics.ts). Off without a key; with one, nothing personal passes through.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { countryOf, ingest, posthogConfig, withCountry } from "../worker/analytics.ts";
import { analyticsKey, analyticsScript, HEAD_TAG, withTag } from "../scripts/analytics.ts";

const KEY = "phc_testkey0123456789";

async function withFetch(fn: (calls: Request[]) => Promise<void>) {
  const real = globalThis.fetch;
  const calls: Request[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new Request(input, init));
    return new Response("{}", { headers: { "content-type": "application/json", "set-cookie": "ph=1; Path=/" } });
  }) as typeof fetch;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = real;
  }
}

test("/ingest is a 404 and reaches nothing without POSTHOG_KEY", async () => {
  await withFetch(async (calls) => {
    for (const env of [{}, { POSTHOG_KEY: "" }, { POSTHOG_KEY: "sk_not_a_project_key" }]) {
      const res = await ingest(new Request("https://polyxd.com/ingest/e/", { method: "POST", body: "{}" }), env);
      assert.equal(res.status, 404);
    }
    assert.equal(calls.length, 0);
  });
  assert.equal(posthogConfig({}), null);
});

test("/ingest forwards to PostHog's US cloud without cookies or credentials, and returns no cookie", async () => {
  await withFetch(async (calls) => {
    const res = await ingest(
      new Request("https://polyxd.com/ingest/e/?ver=1", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "studio.session_token=secret", authorization: "Bearer secret", "cf-connecting-ip": "203.0.113.5", "user-agent": "Mozilla/5.0", referer: "https://polyxd.com/docs/?q=private" },
        body: '{"batch":[]}',
      }),
      { POSTHOG_KEY: KEY },
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("set-cookie"), null);
    assert.equal(calls.length, 1);
    const sent = calls[0];
    assert.equal(sent.url, "https://us.i.posthog.com/e/?ver=1");
    assert.equal(sent.headers.get("cookie"), null);
    assert.equal(sent.headers.get("authorization"), null);
    assert.equal(sent.headers.get("referer"), null);
    assert.equal(sent.headers.get("x-forwarded-for"), "203.0.113.5", "for the country, which PostHog is set to keep without the address");
    assert.equal(await sent.text(), '{"batch":[]}');

    await ingest(new Request("https://polyxd.com/ingest/static/array.js"), { POSTHOG_KEY: KEY, POSTHOG_HOST: "https://eu.i.posthog.com" });
    assert.equal(calls[1].url, "https://eu-assets.i.posthog.com/static/array.js");
    assert.equal((await ingest(new Request("https://polyxd.com/ingest/e/", { method: "DELETE" }), { POSTHOG_KEY: KEY })).status, 405);
  });
});

test("the build adds analytics only with a project key, and the page's stub respects DNT and GPC", () => {
  assert.equal(analyticsKey({}), null);
  assert.equal(analyticsKey({ POSTHOG_KEY: " " }), null);
  assert.equal(analyticsKey({ POSTHOG_KEY: KEY }), KEY);
  assert.throws(() => analyticsKey({ POSTHOG_KEY: "phs_personal_key_123456" }), /project key/);
  assert.throws(() => analyticsKey({}, true), /deploy/, "a deploy with no key stops rather than ship pages without analytics");
  assert.equal(analyticsKey({ POSTHOG_KEY: "off" }, true), null, "off deploys without analytics on purpose");
  assert.equal(analyticsKey({ POSTHOG_KEY: KEY }, true), KEY);

  const page = "<html><head><title>x</title></head><body></body></html>";
  assert.equal(withTag(withTag(page)).split(HEAD_TAG).length, 2, "one tag, before </head>");

  const run = (navigator: Record<string, unknown>) => {
    const appended: { src?: string; type?: string }[] = [];
    const window: Record<string, unknown> = {};
    const document = { createElement: () => ({}), head: { appendChild: (s: { src?: string }) => appended.push(s) } };
    runInNewContext(HEAD_TAG.replace(/^<script>|<\/script>$/g, ""), { navigator, window, document });
    return { window, appended };
  };
  for (const nav of [{ doNotTrack: "1" }, { globalPrivacyControl: true }, { msDoNotTrack: "1" }]) {
    const { window, appended } = run(nav);
    assert.equal(window.pxdTrack, undefined, JSON.stringify(nav));
    assert.equal(appended.length, 0, "the script isn't even fetched");
  }
  const { window, appended } = run({});
  assert.equal(typeof window.pxdTrack, "function");
  assert.equal(appended[0].src, "/assets/analytics.js");

  const script = analyticsScript(KEY, "https://us.posthog.com");
  for (const setting of ['cookieless_mode: "always"', 'persistence: "memory"', "autocapture: false", "disable_session_recording: true", "disable_external_dependency_loading: true", 'api_host: "/ingest"']) assert.ok(script.includes(setting), setting);
});

test("/ingest adds Cloudflare's country to the page's events, and nothing finer", async () => {
  await withFetch(async (calls) => {
    const batch = JSON.stringify([{ event: "$pageview", properties: { $current_url: "https://polyxd.com/" } }, { event: "cta_clicked", properties: { $geoip_country_code: "NZ" } }]);
    await ingest(new Request("https://polyxd.com/ingest/e/?ver=1", { method: "POST", headers: { "cf-ipcountry": "AU" }, body: batch }), { POSTHOG_KEY: KEY });
    const sent = JSON.parse(await calls[0].text());
    assert.equal(sent[0].properties.$geoip_country_code, "AU");
    assert.equal(sent[0].properties.$geoip_country_name, "Australia");
    assert.equal(sent[1].properties.$geoip_country_code, "NZ", "an event that has a country keeps it");
    assert.deepEqual(Object.keys(sent[0].properties).filter((k) => k.startsWith("$geoip")).sort(), ["$geoip_country_code", "$geoip_country_name"]);

    const single = JSON.stringify({ event: "$pageleave", properties: {} });
    await ingest(new Request("https://polyxd.com/ingest/i/v0/e/", { method: "POST", headers: { "cf-ipcountry": "DE" }, body: single }), { POSTHOG_KEY: KEY });
    assert.equal(JSON.parse(await calls[1].text()).properties.$geoip_country_code, "DE");
  });
  const url = (u: string) => new URL(u);
  const body = new TextEncoder().encode('{"batch":[{"properties":{}}]}').buffer;
  assert.equal(withCountry(body, url("https://polyxd.com/ingest/e/?compression=gzip-js"), "AU"), null, "compressed bodies pass untouched");
  assert.equal(withCountry(body, url("https://polyxd.com/ingest/flags/"), "AU"), null, "only event endpoints");
  assert.equal(withCountry(body, url("https://polyxd.com/ingest/e/"), null), null, "no country, no change");
  assert.equal(withCountry(new TextEncoder().encode("not json").buffer, url("https://polyxd.com/ingest/e/"), "AU"), null);
  assert.match(withCountry(body, url("https://polyxd.com/ingest/batch/"), "AU")!, /"\$geoip_country_code":"AU"/);
  for (const cc of ["XX", "T1", "au", "", null]) assert.equal(countryOf(new Request("https://polyxd.com/", { headers: cc ? { "cf-ipcountry": cc } : {} })), null, String(cc));
});
