---
title: Verifier
description: What polyxd-verify checks, how to run it, how the v0 score works, and what it has found so far.
order: 20
section: Guides
---

# Verifier

`@polyxd/verifier` scores a UI document the way it will actually be used: rendered, in every design system, by people and by agents. It is the check that runs before a generated interface ships, and it will be the reward signal when the model is trained.

## What it checks

| Layer | Checks |
|---|---|
| **Document** | Spec validation (schema, references, one primary action per view, data bindings); the declared pattern's rules; capability safety, when you pass a registry; Design Direction or acceptance rules, when you pass them; at most 6 inputs per view; no empty text; unique control names; labels that say what happens |
| **Rendered** | Headless Chromium, per design system × mode × width: axe-core WCAG 2.2 AA (including contrast), horizontal overflow, target size (WCAG 2.5.8 and the pack's own minimum), runtime errors |
| **Agent** | Scripted tasks performed only through the accessibility tree. The host must receive the expected capability event |
| **Consistency** | `compare(previous, current)` between two generations of the same intent |

A document that fails the spec schema or structural rules is not rendered.

### Document checks in detail

Besides the validator, pattern, capability and rule checks, the document layer adds agent-readiness heuristics:

| Check id | Severity | What it catches |
|---|---|---|
| `load:inputs-per-view` | error | More than 6 inputs in one view (on every surface, not just `multi-step-form`) |
| `text:empty` | error | An empty title, label, summary, caption, text, message or consequence |
| `agent:ambiguous-name` | error | Two controls in one view with the same name, so neither people nor agents can tell them apart |
| `copy:generic-label` | warning | A button labelled "OK", "Yes", "Submit", "Click here", "Continue", "Done" and similar |
| `copy:long-label` | warning | A button label over 40 characters |

### Rendered checks in detail

| Check id | Severity | What it catches |
|---|---|---|
| `axe:<rule>` | error for critical or serious, warning otherwise | axe-core violations with the WCAG 2.0, 2.1 and 2.2 A and AA tags |
| `layout:overflow` | error | Content wider than the surface (horizontal scrolling) |
| `layout:target-size` | error | Targets under 24px without the WCAG spacing exception |
| `layout:target-size-pack` | warning | Buttons below the pack's own `size.target.min` |
| `runtime` | error | Page errors and console errors during rendering |

## The default matrix

Material 3, Carbon and Ant Design × light and dark × 390px and 1100px wide. That is 12 renders per document.

## CLI

Inside the monorepo (the packages are not on npm yet; they are coming with v0.1):

```bash
# once: build the render harness the verifier loads in Chromium
npm run build:harness -w @polyxd/verifier

# one or more documents
npm run verify -w @polyxd/verifier -- my-ui.json other-ui.json

# a narrower matrix, with a capability registry, agent tasks and a JSON report
npm run verify -w @polyxd/verifier -- my-ui.json \
  --themes carbon,antd --modes light --widths 390 \
  --registry capabilities.json \
  --tasks tasks.json \
  --json report.json

# all 20 spec examples, full matrix, with agent tasks
npm run verify:examples -w @polyxd/verifier
```

| Flag | What it does |
|---|---|
| `--themes a,b` | Design-system packs to render in. Default `material3,carbon,antd` |
| `--modes light,dark` | Modes. Default both |
| `--widths 390,1100` | Viewport widths in CSS pixels. Default `390,1100` |
| `--registry file` | Capability registry for capability checks |
| `--tasks file` | Agent tasks file. Only tasks whose `document` matches the file name (without `.json`) run |
| `--json out` | Write the full report as JSON |
| `-q`, `--quiet` | Print only the score line per document |

When published, the binary is `polyxd-verify`. Output looks like this:

```
100  money-send-confirm  (0 errors, 0 warnings agent 12/12)

1 documents · 12 renders · mean score 100.0 · agent tasks 12/12
```

Without `--quiet`, each distinct finding is listed once with the check id, message and the first target it appeared in. The CLI exits with 1 if any document has an error or a failed agent run.

### From code

```ts
import { verifyDocument, compare } from "@polyxd/verifier";

const report = await verifyDocument(doc, {
  registry,                     // capability registry
  rules: direction.rules,       // Design Direction or journey acceptance rules
  tasks,                        // agent tasks for this document
  themes: ["material3"], modes: ["light"], widths: [390],
});

report.score;        // 0–100
report.static;       // document findings
report.targets;      // per theme/mode/width: findings and agent results
```

## Score (v0)

Start at 100. Then:

- Each **distinct** failing error check costs 20. A check that fails in all 12 renders still costs 20 once, so one broken thing isn't counted twelve times.
- Each distinct warning costs 4.
- Failed agent runs cost up to 40, in proportion: `40 × (1 − successes / runs)`.
- The score floors at 0. A document that fails the spec schema or structure scores 0.

These weights are a starting point. The gold set in `bench/gold` (30 documents in 10 groups of original, mild drift and clearly worse) exists to calibrate them against a designer's ranking with `npm run gold -w @polyxd/verifier`. The human ranking has not been recorded yet. Known blind spot in v0: vaguer labels, terser empty-state copy and reordered actions aren't checked, so two of the mild-drift variants score the same as their originals.

## Consistency

`compare(previous, current)` measures whether something the user saw last time still looks and sits the same way. It matches the two documents by semantic [key](/docs/ui-documents#keys-and-memory), not by id.

| Part | Weight | Measures |
|---|---|---|
| `pattern` | 0.15 | Same declared pattern (1 or 0) |
| `coverage` | 0.15 | Shared keys ÷ all keys in either document |
| `components` | 0.30 | Share of shared keys that use the same component |
| `order` | 0.20 | Share of pairs of shared keys that keep their relative order |
| `labels` | 0.20 | Share of shared keys with the same label |

```ts
const { score, parts, differences } = compare(lastTime, now);
// differences: ['"fee" changed from DetailList.item to Text', '"reference" relabelled: "Reference" → "Note"']
```

The score runs from 0 (nothing recognisable) to 1 (same structure, order and labels). The benchmark's multi-turn sequences use it to measure consistency across turns.

## Results today

- **Injected defects:** 20 of 20 deliberately injected defects are caught (`test/defects.test.ts`). They span schema, structure, patterns, capabilities, copy, rendered accessibility, layout and agent operability: two primary actions, a destructive capability outside a confirmation, a generic "OK" confirm label, results before filters, eight inputs in one view, an image without alt text, a hard-coded balance, a required field removed so the task can't be done, unbreakable text overflowing on a phone, and more. The Phase 3 exit test asks for at least 90%.
- **Examples:** all 20 spec examples score 100 across 240 renders.
- **Agents:** 216 of 216 agent task runs succeed (18 tasks × 12 targets).

## Bugs it found in the renderer

Building the verifier found real bugs in `@polyxd/react`, all since fixed:

- Graphics-only colours were used for text, which failed WCAG contrast in Carbon and Ant Design.
- Selection rows were smaller than each pack's target size.
- "(required)" markers and option descriptions leaked into accessible names.
- Root confirmations blocked the host page.
