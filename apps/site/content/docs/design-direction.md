---
title: Design Direction
description: The taste layer, in which a company's designers set profile, voice, patterns, rules and exemplars without writing prompts or retraining a model.
order: 14
section: Concepts
---

# Design Direction

Tokens control how things look. Taste goes further: how dense a screen is, how much gets emphasised, how the copy sounds, which patterns a team prefers, and what to leave out. A **Design Direction** holds a company's taste as one versioned JSON package next to its design-system pack.

The goal is that designers shape generated UI without writing prompts or JSON by hand, and without retraining a model. Today the Direction **schema** exists (`schema/direction.schema.json`), with two example directions, and its rules run in the verifier. Applying a Direction during generation is planned, as is Studio, the tool designers would use to edit it.

## What a Direction contains

| Part | What the designer sets | How it's used today |
|---|---|---|
| `designSystem` | The pack it goes with, e.g. `material3` | Reference only |
| `profile` | Density, emphasis budget, data display, motion, disclosure, freedom | Planned: generator constraints |
| `voice` | Copy guidelines, casing, glossary | Planned: generator conditioning. Voice rules can be written as `rules` today |
| `patterns` | Preferred and disallowed patterns, plus the company's own pattern files | Planned: pattern library with company precedence |
| `rules` | Dos and don'ts, each written in plain language and as a check | **Checked by the verifier today** |
| `exemplars` | "This is how we'd do it" pairs of request and UI document | Planned: retrieved as examples at generation time |

### Profile

| Setting | Values | Default |
|---|---|---|
| `density` | `compact`, `comfortable`, `spacious` | `comfortable` |
| `emphasisBudget` | Primary actions allowed per view, 1–3 | `1` |
| `dataDisplay` | `auto`, `prefer-charts`, `prefer-tables`, `prefer-metrics` | `auto` |
| `motion` | `none`, `subtle`, `expressive` | `subtle` |
| `disclosure` | `show-everything`, `progressive` (how eagerly secondary detail goes behind a `Disclosure`) | `progressive` |
| `freedom` | `strict`, `guided`, `open` | `guided` |

The validator currently enforces one primary action per view regardless of `emphasisBudget`, since the accessibility floor caps it at one on most platforms.

### Rules

Rules use the same [check vocabulary](/docs/patterns#the-check-vocabulary) as patterns and journeys. The description is what a designer would say; the `rule` is how a machine checks it.

```json
{
  "id": "money-moves-in-confirm",
  "description": "Money only moves from a confirmation",
  "severity": "error",
  "rule": { "check": "actionInside", "capabilities": ["transfer.confirm"], "container": ["Confirm"] }
}
```

Pass a Direction's rules to the verifier to hold a document to them:

```ts
import { verifyDocument } from "@polyxd/verifier";

const report = await verifyDocument(doc, { registry, rules: direction.rules });
```

## The freedom dial

`profile.freedom` sets how far the generator may go beyond approved patterns:

- **Strict:** only approved patterns.
- **Guided:** new layouts are allowed, built from approved components.
- **Open:** anything that passes the verifier.

When the model has no fitting pattern, the plan is for it to flag the gap for review. This behaviour is planned along with the model.

## Precedence

When layers disagree, higher ones win:

1. The accessibility floor. Nobody can override it.
2. The end user's accessibility needs (text size, reduced motion, contrast).
3. Company rules.
4. Company profile, voice and patterns.
5. End-user preferences (for example density), within the company's bounds.
6. Model defaults.

The precedence engine that applies this order at generation time is planned.

## Two contrasting examples

The spec ships two deliberately different Directions in `packages/spec/examples/directions/`. The same request under each should produce different UIs that each comply. Both use Material 3.

| | `calm-finance` | `playful-personal` |
|---|---|---|
| Density | comfortable | compact |
| Data display | prefer-metrics | prefer-charts |
| Motion | subtle | expressive |
| Disclosure | progressive | show-everything |
| Freedom | strict | open |
| Voice | "Plain, calm and specific. Say what happens to the user's money." No exclamation marks, no jokes about money | "Warm and encouraging, like a friend keeping you on track." Short labels; celebrate streaks |
| Glossary | "payment" instead of "transaction" or "txn"; "send" instead of "transfer" | none |
| Patterns | prefer `confirm-destructive`, `review-and-submit` | none |
| Rules | No exclamation marks (error); money only moves from a confirmation (error); say "payment", not "transaction" (warning) | Personal dashboards show progress visually, i.e. contain a `Chart` (warning) |
| Exemplars | The send-money form and confirmation examples | none |

The "say payment" rule shows how voice becomes a check:

```json
{
  "id": "say-payment",
  "description": "Say 'payment', not 'transaction'",
  "severity": "warning",
  "rule": { "check": "noLabelMatches", "pattern": "\\btransactions?\\b", "flags": "i" }
}
```

## Studio (planned)

Studio is a planned web app where designers would set a Direction through visual controls, preview a company's typical requests under it, approve, reject or edit generated UIs, and publish Direction changes with a before-and-after diff. Approvals would become exemplars, and repeated corrections would be suggested as new rules. None of it exists yet. See the [roadmap](/docs/roadmap).
