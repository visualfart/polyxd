/**
 * A stand-in for the network: every URL the job calls answers with a response recorded on
 * 2026-09-28 (test/fixtures). `marketplace.json` is the recorded Marketplace answer with a
 * `statistics` block added in the shape the API returns for extensions that have one (Polyxd's did
 * not yet); `npm-search.json` is written in the search API's shape, since the real search did not
 * index the scope yet (`npm-search-empty.json` is what it returned).
 */
import { readFileSync } from "node:fs";

export const fixture = (name: string): any => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

export interface Call {
  url: string;
  method: string;
  body?: any;
}

export type Override = (url: string, init?: RequestInit) => Response | undefined;

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A fetch that answers from fixtures, records every call, and lets a test replace any answer. */
export function fakeNetwork(override: Override = () => undefined) {
  const calls: Call[] = [];
  const fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    const replaced = override(url, init);
    if (replaced) return replaced;
    if (url.startsWith("https://registry.npmjs.org/-/v1/search")) return ok(fixture("npm-search.json"));
    if (url === "https://api.npmjs.org/downloads/point/last-day/polyxd") return ok(fixture("last-day.json"));
    if (url.startsWith("https://api.npmjs.org/downloads/range/")) {
      if (url.endsWith("/@polyxd/spec")) return ok(fixture("downloads-spec.json"));
      if (url.endsWith("/polyxd")) return ok(fixture("downloads-polyxd.json"));
      return ok({ error: "package not found" }, 404);
    }
    if (url === "https://registry.npmjs.org/@polyxd%2fspec") return ok(fixture("registry-spec.json"));
    if (url === "https://registry.npmjs.org/polyxd") return ok(fixture("registry-polyxd.json"));
    if (url.startsWith("https://registry.npmjs.org/")) return ok({ error: "Not found" }, 404);
    if (url === "https://open-vsx.org/api/polyxd/polyxd-vscode") return ok(fixture("openvsx.json"));
    if (url === "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery") return ok(fixture("marketplace.json"));
    if (url === "https://api.github.com/repos/visualfart/polyxd") return ok(fixture("github.json"));
    if (url === "https://registry.modelcontextprotocol.io/v0.1/servers/com.polyxd%2Fmcp/versions/latest") return ok(fixture("mcp-registry.json"));
    if (url.endsWith("/batch/")) return ok({ status: "Ok" });
    throw new Error(`unexpected fetch ${url}`);
  };
  return { fetch, calls, posthogCalls: () => calls.filter((c) => c.url.endsWith("/batch/")) };
}

export { ok as jsonResponse };

/** 02:00 UTC on 2026-09-28: the run that files yesterday, 2026-09-27, which npm has finished counting. */
export const NIGHT = new Date("2026-09-28T02:00:00Z");
export const PACKAGES = ["polyxd", "@polyxd/spec"];
export const noSleep = async () => {};
export const quiet = () => {};
