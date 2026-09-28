/**
 * Studio's own analytics in the app: the steps a team takes to get going, and nothing else.
 *
 * Off unless /api/me says the Worker has a PostHog key (src/worker/analytics.ts), and only for a
 * signed-in person whose browser doesn't send Do Not Track or Global Privacy Control. Until then
 * posthog-js isn't even downloaded: it is a chunk of its own, loaded here on first use.
 *
 * - Events are tied to the person's user id (Studio's random id, never a name or email) and to
 *   their workspace's id as a PostHog group (never its name or address).
 * - posthog-js keeps everything in memory: no cookies, no local storage. No autocapture, no page
 *   views, no session replay, no surveys, no feature flags, and nothing loaded from elsewhere.
 * - The address on every event is cut to its shape: /w/:workspace/screens/:key, never a workspace's
 *   address or a screen's key.
 *
 *   workspace_created, design_system_imported { source }, roles_mapped { how, count },
 *   components_chosen { change }, rule_added { severity }, screen_authored { start },
 *   api_key_created. (signed_up, screen_published, direction_published and api_fetch are sent by
 *   the Worker, where they are exact.)
 */
import type { PostHog } from "posthog-js/dist/module.slim.no-external";

type Props = Record<string, string | number | boolean>;

let client: Promise<PostHog | null> | null = null;

const refused = () => {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  return n.doNotTrack === "1" || (window as { doNotTrack?: string }).doNotTrack === "1" || n.msDoNotTrack === "1" || n.globalPrivacyControl === true;
};

/** A path with its workspace, keys and ids replaced by what they are. */
export function pathShape(path: string): string {
  return path
    .replace(/\/w\/[^/]+/, "/w/:workspace")
    .replace(/\/(screens|directions)\/(?!import$)[^/]+/g, "/$1/:key")
    .replace(/\/insights\/[^/]+/, "/insights/:intent")
    .replace(/\/design-systems\/(?!import$)[^/]+/, "/design-systems/:id")
    .replace(/\/versions\/[^/]+/, "/versions/:version")
    .replace(/\/invite\/[^/]+/, "/invite/:id")
    .replace(/\/patterns\/[^/]+/, "/patterns/:file");
}

/** A URL cut to origin and the path's shape: no query, no fragment, no names. */
function shape(u: unknown): unknown {
  if (typeof u !== "string" || !/^https?:/i.test(u)) return u;
  try {
    const x = new URL(u);
    return x.origin + (x.origin === location.origin ? pathShape(x.pathname) : x.pathname);
  } catch {
    return u.split(/[?#]/)[0];
  }
}
function scrub(o: Record<string, unknown> | undefined) {
  if (!o) return;
  for (const k of Object.keys(o)) {
    if (/(url|referrer)$/i.test(k)) o[k] = shape(o[k]);
    else if (/pathname$/i.test(k) && typeof o[k] === "string") o[k] = pathShape(o[k] as string);
  }
}

/**
 * Called with what /api/me said, whenever it changes. Starts analytics for a signed-in person when
 * the Worker offers them, and says who it is and which workspace they're in.
 */
export function startAnalytics(config: { key: string; ui: string } | undefined, userId: string | undefined) {
  if (!config || !userId || refused()) return;
  client ??= import("posthog-js/dist/module.slim.no-external")
    .then(({ default: posthog }) => {
      posthog.init(config.key, {
        api_host: "/ingest",
        ui_host: config.ui,
        persistence: "memory",
        person_profiles: "identified_only",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_exceptions: false,
        capture_performance: false,
        rageclick: false,
        save_referrer: false,
        mask_personal_data_properties: true,
        before_send: (event) => {
          if (!event) return event;
          scrub(event.properties);
          scrub(event.$set);
          scrub(event.$set_once);
          return event;
        },
      });
      return posthog;
    })
    .catch(() => null);
  void client.then((ph) => {
    if (!ph) return;
    if (ph.get_distinct_id() !== userId) ph.identify(userId);
  });
}

function send(ph: PostHog, event: string, props: Props, workspace?: string) {
  if (workspace) ph.group("workspace", workspace);
  ph.capture(event, props);
}

/** One of the events above. `workspace` is the workspace's id. Does nothing when analytics are off. */
export function track(event: string, props: Props = {}, workspace?: string) {
  if (!client) return;
  void client.then((ph) => ph && send(ph, event, props, workspace));
}

/** Signed out: forget who it was. */
export function stopAnalytics() {
  void client?.then((ph) => ph?.reset());
}
