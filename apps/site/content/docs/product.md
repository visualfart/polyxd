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

All three have schemas in `@polyxd/spec` today. Capabilities and journeys are checked by the validator and verifier. The runtime that emits events is planned.

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

Every generated UI already knows its intent, pattern, components and capabilities, so the planned runtime will emit standard events with no manual tracking (`schema/event.schema.json`):

| Event | When |
|---|---|
| `surface.shown`, `surface.dismissed` | A UI appears or is closed |
| `surface.regenerated` | The user had to ask again |
| `action.taken` | A capability action is triggered |
| `checkpoint.reached` | A journey checkpoint is reached |
| `task.completed`, `task.abandoned` | A journey finishes or is given up |
| `input.error` | A field fails validation |
| `status.shown` | A `Status` is shown |
| `undo` | The user undoes something |
| `feedback` | Optional quick rating (−1, 0, 1) |

Each event carries the surface (id, intent, pattern, journey, spec version, generator, Direction, experiment variants), the actor (`human` or `agent`, and whether assistive technology is in use), and where relevant the component, capability, checkpoint, duration and step count. So metrics can be split by human versus agent from the start.

```json
{
  "type": "action.taken",
  "timestamp": "2026-09-19T21:04:11Z",
  "sessionId": "s_8f2",
  "surface": {
    "id": "send-confirm", "intent": "money.send", "pattern": "confirm-destructive",
    "journey": "money.send", "specVersion": "0.2.0",
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

Events carry keys and semantics, **never field values or personal data**. `reason` is a short code, never free text from the user. Events go to the host's own analytics through adapters (PostHog, Amplitude, Segment or OpenTelemetry are the planned targets). **Polyxd itself collects nothing** and has no telemetry.
