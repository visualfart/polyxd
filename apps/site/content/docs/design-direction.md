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
| `voice` | Copy and tone: tone, person, reading level, casing, spelling, punctuation, label length, glossary, words to avoid, guidance for recurring situations | **Checkable settings are compiled into rules and checked today**; all of it is given to the generator |
| `patterns` | Preferred and disallowed patterns, plus the company's own pattern files | Planned: pattern library with company precedence |
| `rules` | Dos and don'ts, each written in plain language and as a check | **Checked by the verifier today** |
| `exemplars` | "This is how we'd do it" pairs of request and UI document | Planned: retrieved as examples at generation time |

### Profile

| Setting | Values | Default |
|---|---|---|
| `density` | `compact`, `comfortable`, `spacious`. Sets row heights and how tightly rows pack: 32, 40 and 48px. `compact` is for pointer surfaces; touch targets keep their minimum either way | `comfortable` |
| `emphasisBudget` | Primary actions allowed per view, 1–3. The validator enforces it: above one, a surface may carry two or three primary actions | `1` |
| `dataDisplay` | `auto`, `prefer-charts`, `prefer-tables`, `prefer-metrics` | `auto` |
| `motion` | `none`, `subtle`, `expressive` | `subtle` |
| `disclosure` | `show-everything`, `progressive` (how eagerly secondary detail goes behind a `Disclosure`). `show-everything` also opens every `Disclosure` on arrival | `progressive` |
| `freedom` | `strict`, `guided`, `open` | `guided` |

The validator currently enforces one primary action per view regardless of `emphasisBudget`, since the accessibility floor caps it at one on most platforms.

### Copy and tone

`voice` is where a content designer sets how the product sounds. Settings that can be checked mechanically compile into rules with `compileVoice(direction)`; the rest (tone, situation guidance) steer the generator.

| Setting | Values | Checked by |
|---|---|---|
| `tone.formality` | `formal`, `neutral`, `casual` | Generator guidance |
| `tone.energy` | `calm`, `neutral`, `upbeat` | Generator guidance |
| `tone.warmth` | `reserved`, `friendly`, `warm` | Generator guidance |
| `tone.humor` | `none`, `light` | Generator guidance |
| `person` | `you` (the product never says "we"), `we-and-you`, `impersonal` | `person` check |
| `readingLevel.maxGrade` | Highest Flesch–Kincaid grade for running text (applied once there are 30+ words) | `readingLevel` check |
| `casing` | `sentence`, `title` | `casing` check |
| `spelling` | `en-GB`, `en-US` | `spelling` check (common interface words: colour/color, cancelled/canceled, organise/organize…) |
| `punctuation.exclamation` | `never`, `allowed` | `noLabelMatches` "!" |
| `punctuation.emoji` | `never`, `allowed` | `noEmoji` check |
| `labels.maxWords` | Longest button label | `maxWords` check |
| `labels.verbFirst` | Buttons start with what they do | Generator guidance |
| `glossary` | `{ "use": "payment", "insteadOf": ["transaction"] }` | `avoidTerms` check, with the preferred word as the suggestion (plurals included) |
| `avoid` | Words never to use, e.g. "simply", "oops", "invalid" | `avoidTerms` check |
| `situations` | Guidance for `empty`, `error`, `success`, `confirm`, `loading`, `destructive` moments | Generator guidance |

```json
"voice": {
  "tone": { "formality": "neutral", "energy": "calm", "warmth": "reserved", "humor": "none" },
  "person": "you",
  "readingLevel": { "maxGrade": 8 },
  "casing": "sentence",
  "spelling": "en-GB",
  "punctuation": { "exclamation": "never", "emoji": "never" },
  "labels": { "maxWords": 4, "verbFirst": true },
  "glossary": [{ "use": "payment", "insteadOf": ["transaction", "txn"] }],
  "avoid": ["simply", "just", "oops", "invalid"],
  "situations": { "error": "Say what happened, that nothing was lost, and what to do next. Never blame the user." }
}
```

Hold a document to everything a Direction says, its explicit rules and its compiled voice, with `directionRules`:

```ts
import { directionRules } from "@polyxd/spec";

const report = await verifyDocument(doc, { registry, rules: directionRules(direction) });
```

Copy checks are warnings by default: they flag, and the team decides. Voice and tone are taste, and the verifier's job is to make them visible, not to overrule the people who own them.

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

const report = await verifyDocument(doc, { registry, rules: directionRules(direction) });
```

## The freedom dial

`profile.freedom` sets how far the generator may go beyond approved patterns:

- **Strict:** only approved patterns.
- **Guided:** new layouts are allowed, built from approved components.
- **Open:** anything that passes the verifier.

When the generator has no fitting pattern, the plan is for it to flag the gap for review. This behaviour is planned along with the runtime that applies a Direction during generation.

## Precedence

When layers disagree, higher ones win:

1. The accessibility floor. Nobody can override it.
2. The end user's accessibility needs (text size, reduced motion, contrast).
3. Company rules.
4. Company profile, voice and patterns.
5. End-user preferences (for example density), within the company's bounds.
6. Generator defaults.

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
| Tone | Calm, reserved, neutral formality, no humour | Upbeat, warm, casual, light humour |
| Copy | "you" only; reading grade ≤ 8; en-GB; no exclamation marks or emoji; buttons ≤ 4 words; never "simply", "just", "oops", "invalid", "failed" | "we" and "you"; reading grade ≤ 6; en-US; exclamation marks and emoji allowed; buttons ≤ 3 words; never "should", "failed" |
| Glossary | "payment" instead of "transaction" or "txn"; "send" instead of "transfer" | none |
| Patterns | prefer `confirm-destructive`, `review-and-submit` | none |
| Rules | Money only moves from a confirmation (error), plus the compiled voice checks | Personal dashboards show progress visually, i.e. contain a `Chart` (warning), plus the compiled voice checks |
| Exemplars | The send-money form and confirmation examples | none |

The glossary entry shows how voice becomes a check. `compileVoice` turns `{ "use": "payment", "insteadOf": ["transaction", "txn"] }` into:

```json
{
  "id": "voice-glossary-payment",
  "description": "Say \"payment\", not \"transaction\" or \"txn\"",
  "severity": "warning",
  "rule": { "check": "avoidTerms", "terms": ["transaction", "txn"], "suggest": "payment" }
}
```

On the balance overview example, calm-finance flags "Recent transactions" with this rule, and playful-personal passes the same surface.

## Studio (planned)

Studio is a planned web app where designers would set a Direction through visual controls, preview a company's typical requests under it, approve, reject or edit generated UIs, and publish Direction changes with a before-and-after diff. Approvals would become exemplars, and repeated corrections would be suggested as new rules. None of it exists yet. See the [roadmap](/docs/roadmap).
