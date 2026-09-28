---
title: Capabilities, journeys and events
description: How product teams define what a product can do, which flows must hold, and what gets measured, when screens are generated.
order: 15
section: Concepts
---

# Capabilities, journeys and events

When screens are generated, product managers and designers stop drawing screens and define what sits one level above them:

| Today | In Polyxd |
|---|---|
| Feature | **Capability**: a registered thing the product can do |
| Flow or user journey | **Journey**: a goal with required checkpoints |
| Acceptance criteria | **Checks** that run against generated UIs |
| Analytics and funnels | **Semantic events**, emitted automatically |

All three have schemas in `@polyxd/spec` today. Capabilities and journeys are checked by the validator and verifier. Both renderers emit the events to a handler you pass, and `@polyxd/analytics` sends them on to your own analytics. Polyxd receives none of them.

## Capabilities

A generated UI can only trigger capabilities the host has registered. The action intents in a [UI document](/docs/ui-documents#actions-are-capability-intents) are capability names. A registry (`schema/capabilities.schema.json`) gives each one metadata:

```json
{
  "name": "polyxd-examples",
  "capabilities": {
    "transfer.confirm": {
      "description": "Send money for a reviewed quote",
      "risk": "consequential",
      "inputs": {
        "type": "object",
        "properties": { "quoteId": { "type": "string" } },
        "required": ["quoteId"],
        "additionalProperties": false
      },
      "preconditions": ["Quote not expired"],
      "sideEffects": ["Moves money out of the account"],
      "agentMayInvoke": false
    }
  }
}
```

| Field | What it is |
|---|---|
| `description` | What it does. Required. |
| `risk` | `none`, `low`, `consequential` or `destructive`. Required. |
| `inputs` | JSON Schema of the event context it accepts. |
| `preconditions` | Plain-language conditions, e.g. "Payment method on file". |
| `sideEffects` | Plain-language effects, e.g. "Charges the payment method". |
| `flag` | An OpenFeature flag key. When the flag is off, the capability can't appear. |
| `agentMayInvoke` | Whether an AI agent may trigger it without a human confirming. Defaults to `true`. |

### What risk levels enforce

`checkCapabilities(doc, registry, flags)` checks every action in a document:

| Risk | Rule |
|---|---|
| `none`, `low` | Can be triggered from anywhere |
| `consequential` | Only from inside a `Confirm`, from a surface that declares the `review-and-submit` pattern, or from the `finish` of a `Steps` whose last step contains a `DetailList` review |
| `destructive` | Only from inside a `Confirm` |

It also reports an error for any action that isn't registered or whose flag is off, and a warning when the event context sends an input the capability doesn't declare, or leaves out a required one.

```ts
import { checkCapabilities } from "@polyxd/spec/capabilities";

const issues = checkCapabilities(doc, registry, { "reading-import": false });
// [{ severity: "error", at: "/components/6/action/event/name",
//    message: "\"books.import\" is switched off by flag \"reading-import\"" }]
```

A product can offer fewer capabilities to a screen written at request time than to one it verified ahead of time. The [demos](/demos/) have a live path, off until the site has a model key, that offers a generated screen only the product's `none` and `low` capabilities. Anything consequential stays behind the verified confirmations in the product's library. The browser also refuses any action the screen wasn't offered, before the product's own handlers see it.

`agentMayInvoke` is recorded in the schema; enforcing it at runtime is planned. The spec's example registry is `packages/spec/examples/registry/capabilities.json`, and the benchmark has a larger one (`bench/registry.json`, 58 capabilities).

## Journeys

A journey is a goal, required checkpoints and a done-condition (`schema/journey.schema.json`). The same file is a flow spec for PMs and designers, a set of acceptance tests, and an agent task.

```json
{
  "id": "money.send",
  "goal": "Send money to someone I've paid before",
  "intent": "money.send",
  "mode": "guided",
  "capabilities": ["transfer.review", "transfer.confirm"],
  "checkpoints": [
    { "key": "details", "description": "Recipient and amount entered", "event": "transfer.review" },
    { "key": "fee-visible", "description": "The fee is shown before the user confirms",
      "rule": { "check": "contains", "component": "DetailList" } },
    { "key": "confirmed", "description": "User explicitly confirms the exact amount",
      "rule": { "check": "rootIs", "components": ["Confirm"] } }
  ],
  "done": { "event": "transfer.confirm" },
  "acceptance": [
    { "id": "confirm-names-amount", "description": "The confirm button states the amount being sent",
      "severity": "error",
      "rule": { "check": "labelMatches", "component": "Confirm", "pattern": "£[0-9]", "prop": "confirm.label" } }
  ],
  "task": {
    "instruction": "Send £250 to Alex Kim with the reference 'Rent share'.",
    "inputs": { "recipient": "Alex Kim", "amount": 250, "reference": "Rent share" },
    "maxSteps": 8
  }
}
```

### Modes

| Mode | What's fixed | For |
|---|---|---|
| `fixed` | The exact surfaces | Regulated or legal flows such as KYC and consent. The example `account.delete` journey is fixed |
| `guided` | The checkpoints; the layout between them is generated | Most flows |
| `open` | Only the goal and done-condition | Open-ended tasks |

### Parts

- **Checkpoints** have a `key` and description, and either a `rule` (a [check](/docs/patterns#the-check-vocabulary) that must hold on the surface where the checkpoint happens) or an `event` (the capability event that marks it reached).
- **Done** is the capability event that completes the journey.
- **Acceptance criteria** are rules that should hold on every direction, pattern or generator change. Run them with `evaluateRules(journey.acceptance, doc)` or pass them to the verifier as `rules`.
- **Task** is what a simulated user is asked to do, with what inputs and a step budget.

The verifier's scripted agent tasks (`bench/tasks.json`) use this goal and done-event shape. See [People and agents](/docs/people-and-agents#agent-tasks).

## Semantic analytics events

Every screen already knows its intent, pattern, components and capabilities. So the renderers can report what people do with it in those terms, with no tracking code. Both renderers, `@polyxd/react` and `@polyxd/web`, emit the events defined in `schema/event.schema.json` when you give them a handler. Without a handler they make none.

**Polyxd itself receives none of these events.** They go to your handler and nowhere else, and Polyxd has no telemetry.

These are about people using a rendered screen. The [runtime's](/docs/runtime#events-and-privacy) `onEvent` is a different hook: it reports on generating a screen.

### Receive them

```tsx
<PolyxdSurface
  document={doc}
  onEvent={(event) => console.log(event.type)}
  events={{ journey, generator: "my-model@3", direction: "calm-finance@0.1.0" }}
/>
```

On the Web Components renderer, listen for `polyxd-event` on the element, or set `el.onEvent`. See [Renderers](/docs/renderers/#semantic-events).

`events` is optional. It holds what the document can't say: `sessionId`, `actor`, `journey`, `generator`, `direction` and `experiment` (experiment key to variant). It is read when the surface is shown.

### The events

| Event | When it fires | Also carries |
|---|---|---|
| `surface.shown` | The surface first mounts in a browser. Once per surface. A server render emits nothing | |
| `action.taken` | An action reaches your `onAction`: a button, a Form's submit, a Confirm's confirm, an item's action. Not `ui.dismiss`, and not Back or Continue inside Steps | `component`, `capability` |
| `checkpoint.reached` | You passed a journey, and an action's name is one of its checkpoints' `event`. Once per checkpoint | `component`, `capability`, `checkpoint` |
| `task.completed` | With a journey: its `done.event`. Without one: the primary action of a Form (submit), a Confirm (confirm) or a Steps (finish). Once | `component`, `capability` |
| `task.abandoned` | The surface is dismissed or taken down after at least one interaction, and it neither completed nor handed on | `reason`: `dismiss` or `unmount` |
| `surface.dismissed` | `ui.dismiss` fired (Cancel on a root Confirm, closing a root Panel, any action named `ui.dismiss`): `reason` is `dismiss`. Or the surface was taken down (unmounted, or replaced by a new document) before it completed or handed on: `reason` is `unmount` | `reason` |
| `input.error` | A control fails the browser's validation, on a Form's submit or a Steps' Continue. Or a FileInput refuses a file | `component`, `reason` |
| `status.shown` | A Status appears. Again if it goes and comes back, not on a redraw | `component`, `reason`: the Status kind (`error`, `success`, `undo`, `empty`, …) |
| `undo` | The action of an `undo` Status fires, straight after its `action.taken` | `component`, `capability` |
| `feedback` | You report a rating: `feedback(rating)` on the surface's handle | `rating`: -1, 0 or 1, and an optional `reason` code |
| `surface.regenerated` | You report that the person asked again and this surface is being replaced: `regenerated(reason?)`. Nothing else follows from it | optional `reason` |

A surface **hands on** when it reaches a journey checkpoint, or when a Form, Confirm or Steps primary action fires that isn't the journey's done event. It has done its part, so leaving it afterwards is not abandoning it. That is how a journey spread over two surfaces, such as the form and then the confirmation of `money.send`, reads as one task.

A Panel or a Confirm that isn't the surface's root closes only itself. Closing it is not the surface being dismissed.

`input.error` reason codes: `required`, `type`, `pattern`, `too-short`, `too-long`, `too-low`, `too-high`, `step`, `bad-input`, `custom` and `invalid` from the browser's validity checks, and `file-too-large` or `file-type` from a FileInput.

A shell (a document with `surface.kind` of `shell`) is the product's frame. It reports `surface.shown`, its actions and `surface.dismissed`, but it has no task, so never `task.completed` or `task.abandoned`.

### What each event carries

- `type`, `timestamp` and `sessionId`. The session id is random for each surface a renderer shows, unless you pass `events.sessionId`.
- `surface`: `id`, `intent` (the surface id when the document has none), `pattern`, `journey`, `specVersion`, and `generator`, `direction` and `experiment` when you pass them.
- `actor`: `kind` is `human` or `agent`. Pass `events.actor` when you know. Otherwise it is `agent` when the browser says it is automated (`navigator.webdriver`), and `human` if not. `assistiveTech` is only there when you pass it; it is never guessed.
- `component`: the document's `id` for the component, its `key` when the document gives one (the stable semantic key, such as `amount`), and its `type`.
- After `surface.shown`, every event has `durationMs` (time since `surface.shown`) and `steps` (interactions since then). Each action is a step, and so is each field edited. Typing into one field is one step until you move to another.

```json
{
  "type": "action.taken",
  "timestamp": "2026-09-19T21:04:11Z",
  "sessionId": "s_8f2",
  "surface": {
    "id": "send-confirm", "intent": "money.send", "pattern": "confirm-destructive",
    "journey": "money.send", "specVersion": "0.3.0",
    "generator": "polyxd-3b@0.1.0", "direction": "calm-finance@0.1.0"
  },
  "actor": { "kind": "human", "assistiveTech": false },
  "component": { "id": "confirm", "type": "Confirm" },
  "capability": "transfer.confirm",
  "durationMs": 5400,
  "steps": 1
}
```

This example is from `packages/spec/examples/events/`. The generator name in it is illustrative: record whichever generator wrote the surface, so metrics can be split by generator as well.

### Privacy

- Events carry ids, keys, capability names and short codes. **Never field values, never text from your data, never the document's data.**
- `reason` is a short code: letters, digits, dots, dashes and underscores, up to 64 characters. Anything else is never sent. An input error's reason becomes `invalid` instead.
- The adapters below run `redact` on every event first. It rebuilds the event from the schema's allow-list, so a property the schema doesn't define never leaves the page.
- **Polyxd receives nothing.** The events go to your handler, and the adapters send them only where you point them.

### Send them to PostHog

`@polyxd/analytics` has adapters with no dependencies. It is in the repository at `packages/analytics`, not yet on npm.

```tsx
import posthog from "posthog-js";
import { toPostHog } from "@polyxd/analytics";

<PolyxdSurface document={doc} onEvent={toPostHog(posthog)} />
```

Each event becomes `posthog.capture("polyxd action.taken", properties)`. The properties are flat: `surface_id`, `intent`, `pattern`, `journey`, `spec_version`, `generator`, `direction`, `experiment_<key>`, `actor`, `assistive_tech`, `component`, `component_key`, `component_type`, `capability`, `checkpoint`, `duration_ms`, `steps`, `reason`, `rating` and `polyxd_session_id`, whichever the event has. For PostHog groups, pass `toPostHog(posthog, { groups: { company: "acme" } })`, or a function of the event. Every adapter takes `eventName` to rename events.

The others are one line each:

```ts
toSegment(analytics)             // analytics.track("polyxd action.taken", properties)
toGA4(gtag)                      // gtag("event", "polyxd_action_taken", properties)
toFetch("/analytics/polyxd")     // POST { "events": [...] } to your endpoint; make it once, not on every render
el.onEvent = toPostHog(posthog); // on <polyxd-surface>
```

GA4 names can't hold dots or spaces, so `ga4EventName` turns `action.taken` into `polyxd_action_taken`, and values are cut to GA4's limits. `toFetch` sends the events as the schema defines them, not flattened, in batches: 20 at a time, after 5 seconds, or when the page is hidden. It uses `keepalive`, so a batch sent as the page closes still arrives. Its handler also has `flush()` and `close()`.

For another tool, `flatten(event)` gives the same flat properties and `defaultEventName(type)` the same name, so a handler is one line: `(e) => amplitude.track(defaultEventName(e.type), flatten(redact(e)!))`. `EVENT_TYPES` and `ALLOWED_PROPERTIES` are the event types and the allow-list, both checked against the schema in the package's tests.

### Not built yet

- Checkpoints that a journey defines with a `rule` instead of an `event` are not detected while the screen is in use. They stay checks for the [verifier](/docs/verifier).
- There are no Amplitude or OpenTelemetry adapters. The one-line handler above covers Amplitude.
