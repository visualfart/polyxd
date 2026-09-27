# @polyxd/spec

The Polyxd spec: what a just-in-time interface is made of, and the tools to check one.

A generated interface is a **UI document**: a flat list of semantic components (the same adjacency-list shape as A2UI), bound to data the host provides, with actions that name capabilities the host has registered. The document is data, never code. A renderer turns it into native components (shadcn on the web, SwiftUI, Compose), and a design-system pack decides how it looks.

## What's here

| Path | What |
|---|---|
| `components/*.json` | The 44 semantic components (source of truth): props, when to use, accessibility and agent semantics, rendering rules, platform mappings. Five are the shell (`Frame`, `AppBar`, `Footer`, `Outlet`, `Custom`), marked `"shell": true`: authored only |
| `schema/ui.schema.json` | JSON Schema for a UI document, generated from the components (validation and constrained decoding) |
| `catalog/catalog.json` | Usage guidance per component, generated |
| `docs/components.md` | Readable component reference with the web / iOS / Android / A2UI mapping table, generated |
| `patterns/*.json` | 6 core patterns, each with self-checking rules and journey semantics |
| `tokens/semantic-contract.json` | The 87 semantic tokens every design-system pack must provide, plus 34 WCAG contrast pairs and constraints |
| `schema/design-system.schema.json` | Design-system pack manifest |
| `schema/check.schema.json` | The shared rule vocabulary used by patterns, Design Direction rules and acceptance criteria |
| `schema/capabilities.schema.json` | Capability registry (features): risk levels, inputs, flags |
| `schema/journey.schema.json` | Journeys (flows): goal, checkpoints, done event, acceptance criteria, agent task |
| `schema/event.schema.json` | Semantic analytics events |
| `schema/direction.schema.json` | Design Direction (a company's taste): profile, voice, patterns, rules, exemplars |
| `examples/` | 29 UI documents across six domains (one of them a product's shell), a capability registry, journeys, two contrasting directions and an event |

## Using it

```bash
npm install @polyxd/spec

npx polyxd-validate my-ui.json                  # schema + structural and design rules
npx polyxd-check-ds path/to/manifest.json       # a design-system pack against the token contract
```

Inside the Polyxd repository:

```bash
npm run validate -w @polyxd/spec -- examples/*.json

# after editing components/*.json or schema/common.defs.json
npm run build:schema -w @polyxd/spec

npm test -w @polyxd/spec
```

From code:

```ts
import { validateDocument, checkDesignSystem } from "@polyxd/spec";
import { checkPattern, evaluateRules } from "@polyxd/spec/patterns";
import { checkCapabilities } from "@polyxd/spec/capabilities";
```

## Rules the validator enforces beyond the schema

- Every referenced component exists, has one parent, and is reachable from the root; no cycles.
- References have allowed types (e.g. `ActionBar` holds only `Action`s; `Confirm.summary` is a `DetailList`).
- At most one primary action is visible at a time (a `Form` submit counts; each `Views` panel, `Steps` step and `Confirm` dialog is its own context).
- Relative data paths only inside repeated items; absolute paths should exist in the data when data is given.
- Only `ui.dismiss`, `ui.back` and `ui.next` in the reserved `ui.` action namespace.
- Key figures and images must be bound to host data: the model can't invent a balance or load a URL.
- The shell components appear only in a shell document (`surface.kind` `"shell"`, `surface.origin` `"authored"`): a shell's root is a `Frame` with exactly one `Outlet` under its `main`, a `Custom` has a `fallback` the renderer can draw, and `Navigation.placement` is read only under a `Frame`. A generator never writes a shell.

With a capability registry, `checkCapabilities` also enforces that destructive capabilities are only triggered from a `Confirm`, and consequential ones from a `Confirm`, a review surface or a `Steps` flow ending in a review.

Code is Apache-2.0; the spec content (schemas, components, patterns, docs) is CC-BY-4.0.
