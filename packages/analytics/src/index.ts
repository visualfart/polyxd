/**
 * Sends Polyxd's semantic events (schema/event.schema.json) to the host's own analytics: PostHog,
 * Segment, Google Analytics 4, or any endpoint that takes a JSON POST. Each adapter returns a
 * handler for a surface's `onEvent`. Every event passes `redact` first, which keeps only what the
 * schema allows. Polyxd itself receives none of these events.
 *
 * No dependencies: the adapters take the host's client (posthog, analytics, gtag) or a URL.
 */

export type SemanticEventType =
  | "surface.shown" | "surface.dismissed" | "surface.regenerated"
  | "action.taken" | "checkpoint.reached" | "task.completed" | "task.abandoned"
  | "input.error" | "status.shown" | "undo" | "feedback";

/** A semantic event, the shape @polyxd/core emits and schema/event.schema.json defines. */
export interface SemanticEvent {
  type: SemanticEventType;
  timestamp: string;
  sessionId: string;
  surface: {
    id: string;
    intent: string;
    pattern?: string;
    journey?: string;
    specVersion?: string;
    generator?: string;
    direction?: string;
    experiment?: Record<string, string>;
  };
  actor: { kind: "human" | "agent"; assistiveTech?: boolean };
  component?: { id?: string; key?: string; type?: string };
  capability?: string;
  checkpoint?: string;
  durationMs?: number;
  steps?: number;
  reason?: string;
  rating?: -1 | 0 | 1;
}

/** A handler for a surface's onEvent. */
export type EventHandler = (event: SemanticEvent) => void;

/** Every event type, in the schema's order. */
export const EVENT_TYPES: readonly SemanticEventType[] = [
  "surface.shown", "surface.dismissed", "surface.regenerated",
  "action.taken", "checkpoint.reached", "task.completed", "task.abandoned",
  "input.error", "status.shown", "undo", "feedback",
];

/** The property names the schema allows, by object. Anything else is dropped by redact. */
export const ALLOWED_PROPERTIES = {
  event: ["type", "timestamp", "sessionId", "surface", "actor", "component", "capability", "checkpoint", "durationMs", "steps", "reason", "rating"],
  surface: ["id", "intent", "pattern", "journey", "specVersion", "generator", "direction", "experiment"],
  actor: ["kind", "assistiveTech"],
  component: ["id", "key", "type"],
} as const;

/** A reason is a short code, never free text. */
const REASON = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const count = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);
/** Keeps only the keys whose values are defined. */
const defined = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/**
 * Defence in depth: rebuilds an event from the schema's allow-list, so a property the schema
 * doesn't define (a field value, a label, anything a future change let slip) never leaves the
 * page. Values of the wrong type are dropped too, and so is a reason that isn't a short code.
 * Returns undefined for anything that isn't an event at all.
 */
export function redact(input: unknown): SemanticEvent | undefined {
  if (!isObject(input) || !EVENT_TYPES.includes(input.type as SemanticEventType)) return undefined;
  const s = input.surface;
  const a = input.actor;
  const timestamp = str(input.timestamp);
  const sessionId = str(input.sessionId);
  if (!timestamp || !sessionId || !isObject(s) || !str(s.id) || !str(s.intent) || !isObject(a) || (a.kind !== "human" && a.kind !== "agent")) return undefined;
  const experiment = isObject(s.experiment) ? Object.fromEntries(Object.entries(s.experiment).filter(([, v]) => typeof v === "string")) as Record<string, string> : undefined;
  const c = input.component;
  const component = isObject(c) ? defined({ id: str(c.id), key: str(c.key), type: str(c.type) }) : undefined;
  const reason = str(input.reason);
  const rating = input.rating === -1 || input.rating === 0 || input.rating === 1 ? (input.rating as -1 | 0 | 1) : undefined;
  return defined({
    type: input.type as SemanticEventType,
    timestamp,
    sessionId,
    surface: defined({
      id: s.id as string,
      intent: s.intent as string,
      pattern: str(s.pattern),
      journey: str(s.journey),
      specVersion: str(s.specVersion),
      generator: str(s.generator),
      direction: str(s.direction),
      experiment: experiment && Object.keys(experiment).length ? experiment : undefined,
    }),
    actor: defined({ kind: a.kind as "human" | "agent", assistiveTech: typeof a.assistiveTech === "boolean" ? a.assistiveTech : undefined }),
    component: component && Object.keys(component).length ? component : undefined,
    capability: str(input.capability),
    checkpoint: str(input.checkpoint),
    durationMs: count(input.durationMs),
    steps: count(input.steps),
    reason: reason && REASON.test(reason) ? reason : undefined,
    rating,
  });
}

export type FlatProperties = Record<string, string | number | boolean>;

/**
 * One level of snake_case properties, for tools that want flat events: surface_id, intent,
 * pattern, journey, spec_version, generator, direction, experiment_<key>, actor, assistive_tech,
 * component (its id), component_key, component_type, capability, checkpoint, duration_ms, steps,
 * reason, rating, polyxd_session_id. Only those present are set.
 */
export function flatten(event: SemanticEvent): FlatProperties {
  const e = event;
  const out: Record<string, string | number | boolean | undefined> = {
    surface_id: e.surface.id,
    intent: e.surface.intent,
    pattern: e.surface.pattern,
    journey: e.surface.journey,
    spec_version: e.surface.specVersion,
    generator: e.surface.generator,
    direction: e.surface.direction,
    actor: e.actor.kind,
    assistive_tech: e.actor.assistiveTech,
    component: e.component?.id,
    component_key: e.component?.key,
    component_type: e.component?.type,
    capability: e.capability,
    checkpoint: e.checkpoint,
    duration_ms: e.durationMs,
    steps: e.steps,
    reason: e.reason,
    rating: e.rating,
    polyxd_session_id: e.sessionId,
  };
  for (const [k, v] of Object.entries(e.surface.experiment ?? {})) out[`experiment_${k.replace(/[^A-Za-z0-9_]/g, "_")}`] = v;
  return defined(out) as FlatProperties;
}

/** The event name every adapter uses unless told otherwise: "polyxd surface.shown". */
export const defaultEventName = (type: SemanticEventType): string => `polyxd ${type}`;

export interface AdapterOptions {
  /** The name each event is sent under. Defaults to "polyxd " + type (GA4: polyxd_ + type with dots as underscores). */
  eventName?: (type: SemanticEventType) => string;
}

/** Runs a send for each redacted event; an event redact refuses is not sent, and an adapter that throws never breaks the surface. */
const handler = (send: (event: SemanticEvent) => void): EventHandler => (input) => {
  const event = redact(input);
  if (!event) return;
  try {
    send(event);
  } catch {
    // The host's analytics failing is not the surface's problem.
  }
};

/** The part of a PostHog client the adapter uses (posthog-js or posthog-node's shape for browsers). */
export interface PostHogLike {
  capture: (event: string, properties?: Record<string, unknown>) => unknown;
}

export interface PostHogOptions extends AdapterOptions {
  /** PostHog group analytics: sent as `$groups`, e.g. { company: "acme" }. Fixed, or worked out per event. */
  groups?: Record<string, string> | ((event: SemanticEvent) => Record<string, string> | undefined);
}

/**
 * PostHog: `posthog.capture("polyxd " + type, flatten(event))`, with `$groups` when given.
 *
 *   <PolyxdSurface document={doc} onEvent={toPostHog(posthog)} />
 */
export function toPostHog(posthog: PostHogLike, options: PostHogOptions = {}): EventHandler {
  const name = options.eventName ?? defaultEventName;
  return handler((event) => {
    const groups = typeof options.groups === "function" ? options.groups(event) : options.groups;
    posthog.capture(name(event.type), groups && Object.keys(groups).length ? { ...flatten(event), $groups: groups } : flatten(event));
  });
}

/** The part of a Segment client (analytics.js, or Analytics Next) the adapter uses. */
export interface SegmentLike {
  track: (event: string, properties?: Record<string, unknown>) => unknown;
}

/** Segment: `analytics.track("polyxd " + type, flatten(event))`. */
export function toSegment(analytics: SegmentLike, options: AdapterOptions = {}): EventHandler {
  const name = options.eventName ?? defaultEventName;
  return handler((event) => void analytics.track(name(event.type), flatten(event)));
}

/** gtag, as Google tag defines it. Only the "event" command is used. */
export type Gtag = (command: "event", eventName: string, params?: Record<string, unknown>) => unknown;

/** GA4's event names: letters, digits and underscores, starting with a letter, at most 40 characters. */
export const ga4EventName = (type: SemanticEventType): string => `polyxd_${type.replace(/[^A-Za-z0-9]/g, "_")}`.slice(0, 40);

/**
 * Google Analytics 4: `gtag("event", "polyxd_surface_shown", flatten(event))`. GA4 names can't
 * hold dots or spaces, so the type's dots become underscores; string values are cut to GA4's 100
 * characters.
 */
export function toGA4(gtag: Gtag, options: AdapterOptions = {}): EventHandler {
  const name = options.eventName ?? ga4EventName;
  return handler((event) => {
    const params = Object.fromEntries(Object.entries(flatten(event)).map(([k, v]) => [k.slice(0, 40), typeof v === "string" ? v.slice(0, 100) : v]));
    gtag("event", name(event.type), params);
  });
}

export interface FetchOptions {
  /** Events per request. Defaults to 20. */
  batchSize?: number;
  /** Longest an event waits before its batch is sent, in ms. Defaults to 5000. */
  flushInterval?: number;
  /** Extra request headers, e.g. an authorisation header for the host's own endpoint. */
  headers?: Record<string, string>;
  /** The fetch to use. Defaults to the global fetch. */
  fetch?: (url: string, init: { method: string; headers: Record<string, string>; body: string; keepalive: boolean }) => Promise<unknown>;
  /** Called when a batch fails to send. The batch is not retried. */
  onError?: (error: unknown, events: SemanticEvent[]) => void;
}

/** A batching sender: a handler, plus flush for when the host wants the queue sent now. */
export interface FetchSender extends EventHandler {
  /** Sends whatever is queued; resolves when the request settles. */
  flush: () => Promise<void>;
  /** Sends what is queued and stops listening for the page being hidden. */
  close: () => Promise<void>;
}

/**
 * A beacon to the host's own endpoint: events are queued and POSTed as `{ "events": [...] }`
 * (JSON, the schema's shape, not flattened) in batches, when a batch fills, when the oldest has
 * waited `flushInterval`, and when the page is hidden. Requests use `keepalive`, so a batch sent
 * as the page closes still arrives.
 */
export function toFetch(url: string, options: FetchOptions = {}): FetchSender {
  const size = Math.max(1, options.batchSize ?? 20);
  const wait = options.flushInterval ?? 5000;
  const send = options.fetch ?? ((u, init) => (globalThis as { fetch?: (u: string, i: unknown) => Promise<unknown> }).fetch!(u, init));
  let queue: SemanticEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = async () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    while (queue.length) {
      const batch = queue.slice(0, size);
      queue = queue.slice(size);
      try {
        await send(url, { method: "POST", headers: { "content-type": "application/json", ...options.headers }, body: JSON.stringify({ events: batch }), keepalive: true });
      } catch (err) {
        options.onError?.(err, batch);
      }
    }
  };

  // The page going away (a tab closed, an app backgrounded) sends what is queued.
  const doc = (globalThis as { document?: { visibilityState?: string; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void } }).document;
  const hidden = () => {
    if (doc?.visibilityState === "hidden") void flush();
  };
  doc?.addEventListener?.("visibilitychange", hidden);

  const sender = handler((event) => {
    queue.push(event);
    if (queue.length >= size) void flush();
    else if (timer === undefined && wait >= 0) timer = setTimeout(() => void flush(), wait);
  }) as FetchSender;
  sender.flush = flush;
  sender.close = () => {
    doc?.removeEventListener?.("visibilitychange", hidden);
    return flush();
  };
  return sender;
}
