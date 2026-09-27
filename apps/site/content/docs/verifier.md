---
title: Verifier
description: What polyxd-verify checks, how to run it, how the v0 score works, and what it has found so far.
order: 20
section: Guides
---

# Verifier

`@polyxd/verifier` scores a UI document the way it will actually be used: rendered, in every design system, by people and by agents. It is the check that runs before a generated interface ships, whichever generator wrote it, and it is how you compare generators on equal terms.

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
| `flow:entity-first` | warning | A picker of people or things that comes *after* the amount, date or range it belongs to: ask who before how much |
| `safety:typed-confirm` | warning | A typed confirmation ("type DELETE") on an action that isn't destructive, which teaches people to type past it |
| `choice:one-recommendation` | error when several match, warning when none | A comparison whose recommended option matches no option, or more than one |

### Rendered checks in detail

| Check id | Severity | What it catches |
|---|---|---|
| `axe:<rule>` | error for critical or serious, warning otherwise | axe-core violations with the WCAG 2.0, 2.1 and 2.2 A and AA tags |
| `layout:overflow` | error | Content wider than the surface (horizontal scrolling) |
| `layout:target-size` | error | Targets under 24px without the WCAG spacing exception |
| `layout:target-size-pack` | warning | Buttons below the pack's own `size.target.min`. Controls inside a dense row are held to WCAG's 24px instead, since a row is dense by design |
| `layout:consequence-placement` | error | A confirmation's consequence that isn't directly above the buttons it warns about |
| `runtime` | error | Page errors and console errors during rendering |
| `runtime:render` | error | The surface never rendered, or never finished rendering, in that design system, mode and width |

## Other renderers

The rendered checks run through a **harness** page that renders `window.__PXD__` and records what the surface sends; the React and Web Components renderers each ship one, and any renderer can provide its own (`verifyDocument(doc, { harness: { url } | { html } })`). `npm run conformance -w @polyxd/verifier` holds the two shipped renderers to the same DOM, ARIA, text and findings across every document and pack. See [Renderers](/docs/renderers/).

## The default matrix

Material 3, Carbon and Ant Design × light and dark × 390px and 1100px wide. That is 12 renders per document.

## CLI

```bash
npm install -D @polyxd/verifier
npx playwright install chromium   # once

# one or more documents
npx polyxd-verify my-ui.json other-ui.json

# a narrower matrix, with a capability registry, agent tasks and a JSON report
npx polyxd-verify my-ui.json \
  --themes carbon,antd --modes light --widths 390 \
  --registry capabilities.json \
  --tasks tasks.json \
  --json report.json

```

Inside the Polyxd repository, `npm run verify:examples -w @polyxd/verifier` runs every spec example through the full matrix with agent tasks.

| Flag | What it does |
|---|---|
| `--themes a,b` | Design-system packs to render in: any of the thirteen, or a template such as `sketch`. Default `material3,carbon,antd` |
| `--modes light,dark` | Modes. Default both |
| `--widths 390,1100` | Viewport widths in CSS pixels. Default `390,1100` |
| `--registry file` | Capability registry for capability checks |
| `--tasks file` | Agent tasks file. Only tasks whose `document` matches the file name (without `.json`) run |
| `--json out` | Write the full report as JSON |
| `-q`, `--quiet` | Print only the score line per document |

Output looks like this:

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

These weights are a starting point. `npm run gold -w @polyxd/verifier` measures them against a designer's ranking. Known blind spot in v0: vaguer labels, terser empty-state copy and reordered actions aren't checked, so two of the mild-drift variants score the same as their originals.

## What the score is not

A designer has ranked generated output: twelve requests, three generated options each, best to worst, with notes (`bench/rank-set/ranking.json`, `npm run gold -w @polyxd/verifier -- --model`). The verifier agrees with none of it — **0% exact order, mean Kendall tau-b −0.29**.

That number is the most useful result the verifier has produced, because of *how* it disagrees:

- **In six of the twelve groups it can't separate the options at all.** All three score the same. Whatever the designer saw — the amount not being the biggest thing on a payment screen, an information architecture that reads in the wrong order, a horizontal bar that means nothing — the score is blind to it.
- **Where it does discriminate, it mostly runs backwards.** Five groups score −0.82 or −1.00.
- **It rewards a document for being small.** On "stop emailing me", the verifier's favourite has one toggle and the designer's has four: the one-toggle version can't trip the ambiguous-name check, has fewer inputs and doesn't attempt the job. The designer ranked it last, because "stop emailing me" is a question about which emails.
- **A document that doesn't attempt the task can't make mistakes.** On "find 30 minutes with Tom and Priya", the two options that tried to send the invitation now carry an error for doing it from a card click; the option that does nothing at all scores 96 and comes top. The designer ranked that one last.

None of this means the checks are wrong — the three added from this ranking each catch something real (see below). It means the score is a **floor**, not a ranking: it answers *is this correct, accessible and operable by an agent*, and it has no term at all for *does this do the job it was asked to do*. Those are two numbers, and flattening them into one makes both worse.

### It measures damage, not quality

The same designer also ranked the hand-made gold set — thirty documents in ten groups of *original*, *mild drift* and *clearly worse*. There the verifier agrees: **50% exact order, mean tau-b +0.63**.

So the verifier is reliable at "is this a degraded version of a good interface" and has nothing to say about "which of these three honest attempts is best". That second case is the one that matters when a generator produces several candidates and something has to pick one.

### What the reward does about it

The reward, not the score, is what picks between candidates when a generator produces several (`--reward` measures that instead). It reads what the bench already declares per request — the capability an answer has to wire, and the control the task presses by name — as a **coverage** term, and coverage multiplies rather than adds:

```
reward = score × (0.2 + 0.8 × coverage) + 20 if an agent could act
```

Multiplying matters. On "find 30 minutes with Tom and Priya", the candidate that attempted nothing scored 96 and the two that tried to send the invitation scored 56, because trying earned them two errors. Adding a coverage bonus left the empty one ahead; multiplying puts it last, which is where the designer put it.

Three honest numbers about this, measured rather than hoped for:

| Reward shape | tau-b on the generated options |
|---|---|
| score alone | −0.29 |
| score + coverage bonus (any additive weight tried) | −0.16 |
| score × coverage (shipped) | −0.07 |

**Coverage separates the candidates in 1 of 12 groups.** In ten of the twelve, all three candidates cover 100% of what the request asked for and the term is silent. So coverage is a gate, not a ranker: it catches the surface that attempted nothing, a real failure mode that picking by score alone would reward, and adds no ordering signal beyond that. Nothing computable that we have separates honest attempts, which is why taste has to come from a designer's preferences rather than from a check.

The length penalty is gone. It existed so that padding a document to satisfy checks wouldn't pay, but it pushed the same way as everything else: on "stop emailing me" the designer ranked the four-toggle version first and the one-toggle version last, and the reward was already biased towards the small one.

### A model judge agrees with other models, not with the designer

If the verifier can't rank honest attempts, can a frontier model? The experiment: 23 groups from both ranking rounds, each candidate rendered at 390 and 1100 px, option letters shuffled per group, judged blind by agents with no access to the designer's ranking — the same screenshots the designer saw. Then the whole thing again with a second, independent judge as a control.

| | tau-b | exact order | same top pick |
|---|---|---|---|
| Verifier reward | −0.07 / −0.11 | 0% | — |
| Judge A vs designer | +0.10 | 22% | 26% |
| Judge B vs designer | +0.16 | 22% | 30% |
| **Judge A vs judge B** | **+0.71** | **65%** | **83%** |
| Chance | 0 | 17% | 33% |

The control is the result. Two judges who never met agree strongly with each other and with the designer at chance — on the 15 groups where they ranked *identically*, agreement with the designer is still only 0.24.

So the task is reliably judgeable, and models converge on an answer. It is simply a different answer. Read the judges' reasons and the split is plain: they rank on defects in the artefact — a binding that renders `[object Object]`, an empty state where data exists, a missing call to action, copy that repeats itself. The designer ranked on which thing should be biggest, what order the page reads in, whether the visual form suits the data, and what the equivalent screen looks like in products they know.

This is the project's premise, measured rather than asserted: **conventional quality is recoverable from the artefact; taste is not.** A model judge is worth having as a second verifier — it found three real defect classes the static checks missed, and they are checks now — but it cannot stand in for a designer, and neither a faster nor a cheaper judge would change that, because speed was never what was missing.

### The designer agrees with their own re-rank as much as the models agree with each other

The control on the other side: six already-ranked groups, shown again under freshly shuffled letters. `npm run rerank -w @polyxd/verifier` builds it, `-- --score` compares the two sittings.

| | tau-b | exact order | same top pick |
|---|---|---|---|
| Designer vs their re-rank | **+0.67** | 67% | 67% |
| Judge A vs judge B | +0.71 | 65% | 83% |
| Judge vs designer | +0.10 / +0.16 | 22% | 26–30% |
| Chance | 0 | 17% | 33% |

Two reliable raters, each reproducing itself, measuring different things. That settles it: the rankings are not noise, and the disagreement with models is not a failure of either side — it is the gap the project exists to cross.

**Where the rater flips, the options are equivalent.** The two groups the designer re-ordered are the two where independent judges also called the candidates near-identical ("near-identical confirm dialogs", "2 and 3 are clean"). That is information, not error: it says those pairs carry no preference. The numbers follow — the best-versus-worst pair survived in 5 of 6 groups, the adjacent pairs in 10 of 12. So anyone using these rankings as preference data should weight a pair by the distance between its members and drop the ones a re-rank reverses, rather than treating all three pairs in a group as equal evidence.

### The three checks this ranking added

| Check | What it catches | From |
|---|---|---|
| `data:progress-not-a-fraction` | a progress bar bound to something that isn't a fraction — £40, or a field that isn't there, drawing a bar whose length means nothing | "why show the indicator horizontal bar, it's not useful at all" |
| `flow:unnamed-commit` | a card that runs a capability above risk `none` when the whole card is clicked: a card opens a thing, a button does a thing | "CTA missing in all" |
| `copy:empty-description` | a description that is its own label again with filler around it ("Email" → "Receive email alerts") | "the descriptions of each notification are not useful … must not be redundant" |

### The three the model judges added

| Check | What it catches |
|---|---|
| `text:template-placeholder` | `{{budget}}`, `${budget}` or `{budget}` reaching the screen — the generator writing a template for an engine that doesn't exist |
| `data:not-text` | a binding that resolves to an object or a list where text belongs, which renders as `[object Object]`. An input's own `value` is exempt: a multi-select holds a list |
| `copy:raw-identifier` | `pr_9` shown as a project name when the same record carries `name` right beside it |

### The two the approved designs added

Rating one generator's output against the approved flow designs, 8 of 12 screens showed nothing real: the layout was plausible and every value was blank. A binding to a path that isn't in the data had been a warning, costing 4 points, so a screen of blanks could still score in the 90s.

| Check | What it catches |
|---|---|
| `data:missing-path` | an error now: a binding that reads nothing from the data the screen is shown with. That covers `/status` where the data has `/order/status`, `/airline` inside a flight card where each flight has `airline`, and a table column or item field that no row has. The message names the likely fix. Inputs are exempt for the values they write, and so is anything that reads those back |
| `text:dangling-label` | a short text ending in a colon with nothing after it: "Departs:" where the departure time should be |

The first blind review against the designs named three more, now checks too:

| Check | What it catches |
|---|---|
| `data:not-a-number` | a number, currency or percent format over something that isn't a number: "48 of 50" formatted as a number, a time as money. It renders `NaN` |
| `data:wrong-currency` | money formatted with no currency, which shows US dollars, when the data says it's in pounds |
| `copy:raw-identifier` | now an error, and it looks across the data: `p1` on a payment, where `/payees` has `{ "id": "p1", "name": "Alex Kim" }`. A text field showing an id counts too |

The same change fixed how the verifier reads bindings inside a repeated item. It now resolves them the way the renderer does: a relative path from the item, an absolute path from the top of the data wherever it appears.

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
- **Examples:** all 24 spec examples score 100 across 1,248 renders — 13 design-system packs at two widths, both modes.
- **Agents:** 216 of 216 agent task runs succeed (18 tasks × 12 targets).

## Bugs it found in the renderer

Building the verifier found real bugs in `@polyxd/react`, all since fixed:

- Graphics-only colours were used for text, which failed WCAG contrast in Carbon and Ant Design.
- Selection rows were smaller than each pack's target size.
- "(required)" markers and option descriptions leaked into accessible names.
- Root confirmations blocked the host page.
