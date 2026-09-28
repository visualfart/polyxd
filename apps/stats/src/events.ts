/**
 * The events this job sends to PostHog. Each describes one day and carries noon UTC on that day as
 * its timestamp, so a daily chart puts it in the right bucket whatever the viewer's time zone.
 * All go to one fixed distinct id with person profiles off: these are facts about the project, not
 * about anyone.
 */
import { noonOf, type Day } from "./days.ts";
import type { GitHubCounts } from "./sources.ts";

export const DISTINCT_ID = "polyxd-adoption";

export interface NpmDaily {
  package: string;
  day: Day;
  downloads: number;
  /** A version of this package was published on this day or the day before. Most of that day's downloads are mirrors and scanners fetching the new version. */
  release_day: boolean;
  /** The versions of this package published on this day. */
  versions_published: string[];
}

export interface VscodeDaily {
  /** "open-vsx" or "vs-marketplace". */
  store: string;
  /** "downloads" (Open VSX, Marketplace) or "installs" (Marketplace). */
  metric: string;
  day: Day;
  /** The store's cumulative count, read around 02:00 UTC the next day. */
  total: number;
  /** `total` minus the previous reading, or null for the first reading. */
  delta: number | null;
  /** How many days `delta` covers: 1 normally, more when a run was missed. Null with `delta`. */
  delta_days: number | null;
}

export interface GitHubDaily extends GitHubCounts {
  day: Day;
}

export interface RegistryDaily {
  day: Day;
  listed: boolean;
  version: string | null;
}

export type AdoptionEvent =
  | { event: "adoption_npm_daily"; properties: NpmDaily }
  | { event: "adoption_vscode_daily"; properties: VscodeDaily }
  | { event: "adoption_github_daily"; properties: GitHubDaily }
  | { event: "adoption_registry"; properties: RegistryDaily };

/** What makes an event unique within its day: the ledger remembers this. */
export function eventKey(e: AdoptionEvent): string {
  switch (e.event) {
    case "adoption_npm_daily":
      return `${e.event}:${e.properties.package}`;
    case "adoption_vscode_daily":
      return `${e.event}:${e.properties.store}:${e.properties.metric}`;
    default:
      return e.event;
  }
}

/** Whether `versions` (with publish times) put `day` inside a release: a publish on the day itself or the day before. */
export function releaseTag(versions: Array<{ version: string; at: string }>, day: Day, dayBefore: Day): { release_day: boolean; versions_published: string[] } {
  const versions_published = versions.filter((v) => v.at.slice(0, 10) === day).map((v) => v.version);
  const release_day = versions_published.length > 0 || versions.some((v) => v.at.slice(0, 10) === dayBefore);
  return { release_day, versions_published };
}

/** A capture-API batch item. */
export interface PostHogEvent {
  event: string;
  timestamp: string;
  uuid: string;
  properties: Record<string, unknown>;
}

/**
 * A UUID derived from the event's day and key (version-5 layout over SHA-1), so the same fact always
 * has the same id. The ledger is what prevents double counting; the stable id lets PostHog drop a
 * duplicate that slips past it (the local script and the Worker sending the same day).
 */
export async function stableUuid(name: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`polyxd-adoption:${name}`))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function toPostHog(e: AdoptionEvent): Promise<PostHogEvent> {
  return {
    event: e.event,
    timestamp: noonOf(e.properties.day),
    uuid: await stableUuid(`${e.properties.day}:${eventKey(e)}`),
    properties: { distinct_id: DISTINCT_ID, $process_person_profile: false, ...e.properties },
  };
}
