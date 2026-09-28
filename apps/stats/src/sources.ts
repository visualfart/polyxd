/**
 * The public sources, one fetcher and one parser each. The parsers take the decoded JSON and are
 * what the tests exercise against recorded responses (test/fixtures); the fetchers only add the URL,
 * the headers and a status check. No source needs a key: GitHub takes an optional token.
 */
import type { Day } from "./days.ts";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export const USER_AGENT = "polyxd-stats/1 (+https://github.com/visualfart/polyxd/tree/main/apps/stats)";
export const REPO = "visualfart/polyxd";
export const OPEN_VSX_EXTENSION = "polyxd/polyxd-vscode";
export const MARKETPLACE_EXTENSION = "Polyxd.polyxd-vscode";
export const REGISTRY_SERVER = "com.polyxd/mcp";

export type Sleep = (ms: number) => Promise<void>;
export const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `fetch` that waits and tries again when a host says it is busy (429 or 503): after its
 * Retry-After, or 2, 4, 8 seconds, at most 30 seconds a wait. npm's downloads API rate-limits a
 * few dozen quick calls, which is about what one run makes.
 */
export function politely(fetch: Fetch, wait: Sleep = sleep, retries = 3): Fetch {
  return async (url, init) => {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, init);
      if ((response.status !== 429 && response.status !== 503) || attempt >= retries) return response;
      const after = Number(response.headers.get("retry-after"));
      await wait(Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 2000 * 2 ** attempt, 30_000));
    }
  };
}

/** The decoded body, or `missing` when the answer is 404 and the caller passed one. */
async function getJson(fetch: Fetch, url: string, init: RequestInit = {}, missing?: unknown): Promise<unknown> {
  const response = await fetch(url, { ...init, headers: { "user-agent": USER_AGENT, accept: "application/json", ...(init.headers as Record<string, string> | undefined) } });
  if (response.status === 404 && missing !== undefined) return missing;
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${url}: HTTP ${response.status}`);
  return response.json();
}

const record = (value: unknown, what: string): Record<string, any> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${what}: expected an object`);
  return value as Record<string, any>;
};

const count = (value: unknown, what: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${what}: expected a count, got ${JSON.stringify(value)}`);
  return Math.round(value);
};

// ---------- npm ----------

/** Package names from the registry's search (`scope:polyxd`). New packages take a while to be indexed, so this only adds to the list in src/packages.ts. */
export function parseNpmSearch(json: unknown): string[] {
  const objects = record(json, "npm search").objects;
  if (!Array.isArray(objects)) throw new Error("npm search: no objects");
  return objects.map((o) => o?.package?.name).filter((name): name is string => typeof name === "string" && (name === "polyxd" || name.startsWith("@polyxd/")));
}

export const fetchNpmSearch = async (fetch: Fetch) => parseNpmSearch(await getJson(fetch, "https://registry.npmjs.org/-/v1/search?text=scope:polyxd&size=250"));

/** The last day npm has finished counting. Earlier days read as 0 until it has, so a run never reports past this. */
export function parseLastDay(json: unknown): Day {
  const end = record(json, "npm last-day").end;
  if (typeof end !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error("npm last-day: no end day");
  return end;
}

export const fetchLastCompleteDay = async (fetch: Fetch, pkg = "polyxd") => parseLastDay(await getJson(fetch, `https://api.npmjs.org/downloads/point/last-day/${pkg}`));

/** Downloads per day from npm's range API. */
export function parseDownloadRange(json: unknown): Map<Day, number> {
  const body = record(json, "npm downloads");
  if (body.error) throw new Error(`npm downloads: ${body.error}`);
  if (!Array.isArray(body.downloads)) throw new Error("npm downloads: no downloads array");
  return new Map(body.downloads.map((d: any) => [String(d.day), count(d.downloads, `npm downloads ${d.day}`)]));
}

/**
 * One call per package: npm's bulk queries do not take scoped names. A package npm has not counted
 * yet (published after the last complete day) answers 404, which reads as no days.
 */
export const fetchDownloadRange = async (fetch: Fetch, pkg: string, start: Day, end: Day) =>
  parseDownloadRange(await getJson(fetch, `https://api.npmjs.org/downloads/range/${start}:${end}/${pkg}`, {}, { downloads: [] }));

export interface PublishHistory {
  /** The day the package was created. Days before it get no event. */
  created: Day | null;
  /** Every version and when it was published, oldest first. */
  versions: Array<{ version: string; at: string }>;
}

/** The registry document's `time` field: `created`, `modified`, and one entry per version. */
export function parsePublishHistory(json: unknown): PublishHistory {
  const time = record(record(json, "npm registry").time ?? {}, "npm registry time");
  const versions = Object.entries(time)
    .filter(([key, at]) => key !== "created" && key !== "modified" && key !== "unpublished" && typeof at === "string")
    .map(([version, at]) => ({ version, at: at as string }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const created = typeof time.created === "string" ? time.created.slice(0, 10) : (versions[0]?.at.slice(0, 10) ?? null);
  return { created, versions };
}

/** A package not yet published answers 404, which reads as no versions. */
export const fetchPublishHistory = async (fetch: Fetch, pkg: string) =>
  parsePublishHistory(await getJson(fetch, `https://registry.npmjs.org/${pkg.replace("/", "%2f")}`, {}, { time: {} }));

// ---------- The editor extension ----------

/** Open VSX's cumulative download count. */
export const parseOpenVsx = (json: unknown): number => count(record(json, "Open VSX").downloadCount, "Open VSX downloadCount");

export const fetchOpenVsx = async (fetch: Fetch) => parseOpenVsx(await getJson(fetch, `https://open-vsx.org/api/${OPEN_VSX_EXTENSION}`));

/**
 * The VS Marketplace's cumulative installs and downloads, from the public gallery API. A new
 * extension has no `statistics` until the Marketplace first computes them, which reads as 0.
 */
export function parseMarketplace(json: unknown): { installs: number; downloads: number } {
  const extension = record(json, "Marketplace").results?.[0]?.extensions?.[0];
  if (!extension) throw new Error(`Marketplace: ${MARKETPLACE_EXTENSION} not found`);
  const stats = new Map<string, unknown>((extension.statistics ?? []).map((s: any) => [s.statisticName, s.value]));
  return {
    installs: stats.has("install") ? count(stats.get("install"), "Marketplace install") : 0,
    downloads: stats.has("downloadCount") ? count(stats.get("downloadCount"), "Marketplace downloadCount") : 0,
  };
}

/** Flag 256 is IncludeStatistics; filter type 7 is the extension's full name. */
export const MARKETPLACE_QUERY = { filters: [{ criteria: [{ filterType: 7, value: MARKETPLACE_EXTENSION }], pageNumber: 1, pageSize: 1 }], flags: 256 };

export const fetchMarketplace = async (fetch: Fetch) =>
  parseMarketplace(
    await getJson(fetch, "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json;api-version=7.2-preview.1" },
      body: JSON.stringify(MARKETPLACE_QUERY),
    }),
  );

// ---------- GitHub ----------

export interface GitHubCounts {
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
}

/**
 * The repository's counts. GitHub's `watchers_count` is a legacy alias for stars; the people
 * watching the repository are `subscribers_count`. `open_issues_count` includes open pull requests.
 */
export function parseGitHub(json: unknown): GitHubCounts {
  const repo = record(json, "GitHub");
  return {
    stars: count(repo.stargazers_count, "GitHub stargazers_count"),
    forks: count(repo.forks_count, "GitHub forks_count"),
    watchers: count(repo.subscribers_count, "GitHub subscribers_count"),
    open_issues: count(repo.open_issues_count, "GitHub open_issues_count"),
  };
}

export const fetchGitHub = async (fetch: Fetch, token?: string) =>
  parseGitHub(
    await getJson(fetch, `https://api.github.com/repos/${REPO}`, {
      headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    }),
  );

// ---------- The MCP Registry ----------

export interface RegistryListing {
  listed: boolean;
  version: string | null;
  status: string | null;
}

/** The registry's latest version of the server. A deleted entry is not listed. */
export function parseRegistry(json: unknown): RegistryListing {
  const body = record(json, "MCP Registry");
  const version = typeof body.server?.version === "string" ? body.server.version : null;
  const status = body._meta?.["io.modelcontextprotocol.registry/official"]?.status;
  const statusText = typeof status === "string" ? status : null;
  return { listed: version !== null && statusText !== "deleted", version, status: statusText };
}

export async function fetchRegistry(fetch: Fetch): Promise<RegistryListing> {
  const url = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(REGISTRY_SERVER)}/versions/latest`;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" } });
  if (response.status === 404) return { listed: false, version: null, status: null };
  if (!response.ok) throw new Error(`GET ${url}: HTTP ${response.status}`);
  return parseRegistry(await response.json());
}
