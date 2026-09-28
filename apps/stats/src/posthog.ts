/** PostHog's capture API, batch form: https://posthog.com/docs/api/capture */
import type { Fetch } from "./sources.ts";
import type { PostHogEvent } from "./events.ts";

export const DEFAULT_HOST = "https://us.i.posthog.com";
/** Events per request (about 300 bytes each; PostHog takes up to 20 MB). A 30-day backfill of ~36 packages is two requests. */
export const BATCH_SIZE = 1000;

export interface PostHogConfig {
  /** The project API key (phc_...), which can only write events. */
  key: string;
  host?: string;
}

export async function sendBatch(fetch: Fetch, config: PostHogConfig, events: PostHogEvent[]): Promise<void> {
  const url = `${(config.host || DEFAULT_HOST).replace(/\/+$/, "")}/batch/`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: config.key, batch: events }),
  });
  if (!response.ok) throw new Error(`PostHog ${url}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
}
