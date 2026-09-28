# @polyxd/analytics

Sends Polyxd's semantic events to your own analytics. The renderers emit them (`onEvent` on `<PolyxdSurface>`, `polyxd-event` on `<polyxd-surface>`); this package turns each one into a call to PostHog, Segment, Google Analytics 4 or your own endpoint. No dependencies. Polyxd itself receives none of these events.

```ts
import posthog from "posthog-js";
import { toPostHog } from "@polyxd/analytics";

const onEvent = toPostHog(posthog);
<PolyxdSurface document={doc} onEvent={onEvent} />;
// posthog.capture("polyxd action.taken", { surface_id: "send", intent: "money.send", capability: "transfer.review", … })
```

| Export | What it does |
|---|---|
| `toPostHog(posthog, { groups?, eventName? })` | `posthog.capture("polyxd " + type, flatten(event))`, with `$groups` when you give `groups` (fixed, or a function of the event) |
| `toSegment(analytics, { eventName? })` | `analytics.track("polyxd " + type, flatten(event))` |
| `toGA4(gtag, { eventName? })` | `gtag("event", "polyxd_" + type with dots as underscores, flatten(event))`, names and values cut to GA4's limits |
| `toFetch(url, { batchSize?, flushInterval?, headers?, fetch?, onError? })` | POSTs `{ "events": [...] }` to your endpoint in batches (20 events, or 5 seconds, or when the page is hidden), with `keepalive`. Returns a handler with `flush()` and `close()` |
| `redact(event)` | Rebuilds an event from the schema's allow-list: any property the schema doesn't define is dropped, at every level, and so is a `reason` that isn't a short code. Every adapter runs it first |
| `flatten(event)` | One level of snake_case properties: `surface_id`, `intent`, `pattern`, `journey`, `spec_version`, `generator`, `direction`, `experiment_<key>`, `actor`, `assistive_tech`, `component`, `component_key`, `component_type`, `capability`, `checkpoint`, `duration_ms`, `steps`, `reason`, `rating`, `polyxd_session_id` |
| `EVENT_TYPES`, `ALLOWED_PROPERTIES`, `defaultEventName`, `ga4EventName` | The event types and the allow-list (both checked against `schema/event.schema.json` in the tests), and the default names |

A client that throws never breaks the surface: the adapter catches it.

Which events there are, when each fires and what it carries: [Capabilities, journeys and events](https://polyxd.com/docs/product/#semantic-analytics-events).

## Tests

`npm test -w @polyxd/analytics` runs every adapter against a fake client with real events from `@polyxd/core`, and checks the allow-list and the redacted events against the spec's schema.
