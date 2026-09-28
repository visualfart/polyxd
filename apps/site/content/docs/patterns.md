---
title: Patterns
description: The six core patterns, what each one is for, and the shared check vocabulary that makes them self-checking.
order: 12
section: Concepts
---

# Patterns

A pattern is a known arrangement of components for a kind of task. Patterns are where recognition comes from: if the same task always takes the same shape, people recognise the interface instead of having to work it out again.

A surface declares its pattern in `surface.pattern`. The validator then runs that pattern's checks against the document. Patterns live in `packages/spec/patterns/*.json` and follow `schema/pattern.schema.json`.

## The six core patterns

None of them is tied to a domain. The same `confirm-destructive` pattern covers sending money, deleting a project and closing an account.

| Pattern | Use it for | Shape |
|---|---|---|
| `confirm-destructive` | Moving money, deleting data or accounts, sending on someone's behalf, any `consequential` or `destructive` capability | A `Confirm` at the root that states the consequence, an optional `DetailList` summary, and a confirm button that repeats the verb |
| `multi-step-form` | Any data entry task | One `Form` for 6 inputs or fewer; `Steps` with one topic per step for longer or dependent tasks |
| `compare-and-choose` | Choosing between 2–4 plans, products, routes or offers | One `Comparison` with the same attributes for every option, an optional recommendation, and a choose action per option |
| `filter-and-browse` | Searching or browsing many items | Filters before the results, a `Collection` or `Table` of results, and an empty state that says how to widen the search |
| `undo-over-confirm` | Everyday actions that can be reversed: archive, remove from a list, mark done, move to trash. Any `none` or `low` capability that names an `undo` capability | The action runs straight away; a `Status` of kind `undo` says what happened and offers Undo. No confirmation dialog |
| `review-and-submit` | Bookings, orders, applications: any multi-field commitment | `DetailList` summaries of what will be submitted, any final acknowledgements, and a submit label that states the commitment ("Book and pay £312") |

Each pattern file also records when *not* to use it, its journey semantics (goal, checkpoints, done-condition), how an agent completes it, the example documents that use it, and its sources (for example GOV.UK's "check answers" pattern for `review-and-submit`).

## How a pattern checks itself

A pattern's `checks` are rules. Each rule has an id, a plain-language description, a severity, and a machine-checkable `rule`:

```json
{
  "id": "specific-confirm-label",
  "description": "The confirm button says what it does, never just 'OK' or 'Yes'",
  "severity": "error",
  "rule": { "check": "noLabelMatches", "pattern": "^(OK|Ok|Yes|Confirm|Submit|Done)$" }
}
```

Errors fail the document; warnings lower its verifier score. A failing check explains itself, for example `needs at least 1 DetailList, found 0` or `Filters come before the results: TextInput/Choice/RangeInput/DateInput must all come before Collection/Table`.

```ts
import { checkPattern, evaluateRules } from "@polyxd/spec/patterns";

checkPattern(doc);          // runs the checks of doc.surface.pattern
evaluateRules(rules, doc);  // runs any list of rules
// → [{ id, description, severity, pass, message }]
```

## The check vocabulary

The same small vocabulary is used by patterns, [Design Direction](/docs/design-direction) rules, and [journey](/docs/product) checkpoints and acceptance criteria. It is plain JSON, so rules written by designers and PMs can be stored, diffed and versioned. It is defined in `schema/check.schema.json` and implemented in `src/checks.ts`.

Checks look at components in **reading order**: depth-first from the root, following every reference.

| Check | Passes when | Fields |
|---|---|---|
| `rootIs` | The root component is one of the listed types | `components` |
| `contains` | The document contains between `min` (default 1) and `max` matching components | `component` (or `*`), `where`, `min`, `max` |
| `precedes` | Every `before` component comes before the first `after` component. Fails if either is missing | `before`, `after` |
| `maxInputsPerView` | No view has more than `max` inputs. Each `Steps` step and `Views` panel counts separately | `max` |
| `requires` | Every matching component sets all the listed props | `component`, `where`, `props` |
| `labelMatches` | Every matching component has a label matching the regex (or the one prop named in `prop`, such as `confirm.label`) | `component`, `where`, `prop`, `pattern`, `flags` |
| `noLabelMatches` | No visible label anywhere matches the regex | `pattern`, `flags` |
| `actionInside` | The listed capabilities are only triggered from inside one of the listed containers | `capabilities`, `container` |
| `anyOf` | At least one nested check passes | `checks` |
| `allOf` | Every nested check passes | `checks` |
| `not` | The single nested check fails | `checks` (one item) |

`where` matches props exactly, for example `{ "severity": "destructive" }`. Label checks only look at literal text; bound values come from host data and are skipped.

The inputs counted by `maxInputsPerView` are `TextInput`, `Choice`, `Toggle`, `DateInput` and `RangeInput`.

### Combining checks

`review-and-submit` says review content should come before any last inputs, but only if there are any. That is an `anyOf` with a `not`:

```json
{
  "check": "anyOf",
  "checks": [
    { "check": "not", "checks": [{ "check": "contains", "component": "Toggle" }] },
    { "check": "precedes", "before": ["DetailList"], "after": ["Toggle"] }
  ]
}
```

A journey can pin down its own copy. `money.send` requires the confirm button to state the amount and money to move only from a confirmation:

```json
[
  { "check": "labelMatches", "component": "Confirm", "prop": "confirm.label", "pattern": "£[0-9]" },
  { "check": "actionInside", "capabilities": ["transfer.confirm"], "container": ["Confirm"] }
]
```

## Your own patterns

The [Design Direction](/docs/design-direction) schema has `patterns.custom`: paths to a company's own pattern files, in the same format as the core patterns, which take precedence over them. The schema is in place, and [Studio](/docs/studio)'s Direction editor writes a team's pattern files and serves them beside its Direction; the runtime that loads and applies them is planned.
