---
title: Research log
description: What we tried, what we measured, and what we changed because of it. Updated as experiments run.
order: 45
section: Project
---

This is Polyxd's running improvement report. Each entry states a question, what changed, the measured result, and what happens next. Numbers come from the repository's own tools (the verifier, the benchmark and the scorer), and every run can be reproduced from the commands given. Negative results stay in.

## Where things stand

Five charts, from the same runs as the table below. Each one opens the numbers behind it.

### What a run costs, and what it gets

<!--CHART:QUALITY-SPEED-->

### Whether the output is a valid document at all

<!--CHART:VALID-->

### What training changed

<!--CHART:TRAINING-->

### How the scores are spread

<!--CHART:SPREAD-->

### Where the best run loses its points

<!--CHART:PROBLEMS-->

## Current leaderboard

<!--LEADERBOARD-->

## Entries

### 2026-09-20 · Designing first, then building: what the designs caught that the checks didn't

**Question.** The designer's ranking said the verifier knows safety, not taste. If the interfaces were *designed* first — drawn properly, reviewed, then built into the spec and renderer — would the system's first options get better?

**Setup.** 26 artboards across nine flows (send money, delete, browse, compare, book, add a task, notifications, find a time, reading list), reviewed and approved, then implemented as spec changes and renderer behaviour in three batches. Everything was held to the existing checks: 24 examples across 288 renders (3 design systems × light/dark × phone/desktop), plus the scripted agent.

**Result.** The designs added semantics the spec was missing, not styling knobs: a hero amount, people with faces, receipts with a total, a confirmation that names who it is for and lists what will happen, a filter panel linked to its results, one recommendation with its reason, undo instead of a confirmation, progress on a card, richer empty states. All 24 examples still score 100, agent tasks 216/216.

**What the designs caught that the checks did not:**

| Found by | What it was |
|---|---|
| Looking at a Carbon render | Every Carbon surface was falling back to a serif face. One font name in the pack's tokens (`.SFNSText-Regular`) isn't a valid CSS identifier unquoted, which invalidates the whole `font-family` declaration. Contrast, target size and reading order all passed; the page was simply in the wrong typeface. |
| Building a dense table | A link on a selected row failed contrast in Carbon, because the contract only guarantees link colour on the default surface. Selected rows are now marked at the edge instead of tinted. |
| A designer using the gallery | Density was decoration: `profile.density` moved table rows and nothing else. |

**What changed.** The three batches are in the spec and renderer. The font fix is in the theme compiler, so no pack can reintroduce it.

**Honest limit.** This measures the *system's ceiling*, not the model's output: the model has not been retrained on the new components yet. Whether the first options are better is the next gold-set ranking's question, not this entry's.

---

### 2026-09-20 · Dense B2B: the capability rules pushed back, and they were right

**Question.** Tables, bulk actions, navigation and record pages are most of the software people use at work. Could the same spec carry them without becoming a widget library?

**Setup.** Nine artboards in Carbon (accounts list, bulk selection, record page, side-panel form, overview, settings, phone, and a density comparison), then implemented: `Table` gained saved views, a toolbar, sorting, selection with bulk actions, a row menu, cell kinds and paging; `Navigation`, page headers, detail grids, timelines, inline notices and horizontal forms followed.

**Result.** 26 components (from 24). Two B2B examples score 100 across 24 renders. On phones a table becomes a list of rows, and the per-row action keeps the same name at both widths, so an agent's steps don't depend on screen size.

**The finding.** The first version of the accounts list failed the capability checks: "send payment reminder" for three accounts, "create invoice" and "cancel subscription" all fired straight from a row menu. The rules say a consequential capability needs a confirmation or a review step, and a destructive one needs a `Confirm`. That is correct — a row menu that cancels a subscription on click is how real products lose customers' trust. The list's actions now *start* a flow ("open the cancellation check"), and the check itself is a separate surface with what will happen, a typed confirmation and the money at stake.

**What changed.** The registry distinguishes starting a flow from committing it, and the B2B examples follow the same safety rules as the consumer ones.

---

### 2026-09-20 · Models agree with each other about UI quality, and with a designer at chance

**Question.** The verifier can't rank three honest attempts at the same request (tau −0.07). Can a frontier model, looking at the same screens a designer looked at?

**Setup.** 23 groups from two ranking rounds — a request, three candidates from `sft-v3`, all rendered at 390 and 1100 px. Option letters shuffled per group, judged blind by agents with no access to the designer's ranking and no path to the repository that holds it. Then the whole thing again with a second, independent judge as a control. Separately, six already-ranked groups were rebuilt under fresh letters and the designer ranked them a second time (`npm run rerank -w @polyxd/verifier`).

**Result.**

| | tau-b | exact order | same top pick |
|---|---|---|---|
| Verifier reward vs designer | −0.07 / −0.11 | 0% | — |
| Judge A vs designer | +0.10 | 22% | 26% |
| Judge B vs designer | +0.16 | 22% | 30% |
| Judge A vs judge B | **+0.71** | 65% | 83% |
| Designer vs himself | **+0.67** | 67% | 67% |
| Chance | 0 | 17% | 33% |

**What it means.** Two reliable raters, each reproducing itself, measuring different things. The models are not failing to judge — they converge strongly with each other, and on the 15 groups where they ranked identically, agreement with the designer is still 0.24. They are judging something else.

Reading their reasons against his, the split is plain. The judges rank on defects in the artefact: a binding that renders `[object Object]`, an empty state where data exists, a missing call to action, copy that repeats itself. The designer ranked on which thing should be biggest, what order the page reads in, whether the visual form suits the data, and what the equivalent screen looks like in products he knows.

So: **conventional quality is recoverable from the artefact; taste is not.** That is this project's premise, measured rather than asserted — and it settles the question that prompted the experiment, which was whether a cheaper or faster judge would give us a reward for taste. Speed was never what was missing.

**Where the designer flipped, the options were equivalent.** The two groups he re-ordered are the two the judges had independently called near-identical. That is information, not error: best-versus-worst survived in 5 of 6 groups, the adjacent pairs in 10 of 12. Preference training now weights a pair by the distance between its members and drops the ones a re-rank reverses — 69 pairs, 23 at weight 2.

**What it changed.** A model judge is worth keeping as a second verifier even though it can't rank taste: it found three defect classes the static checks missed, and all three are checks now (`text:template-placeholder`, `data:not-text`, `copy:raw-identifier`) and rules in the generator's prompt. The reward's coverage term multiplies rather than adds, because on "find 30 minutes with Tom and Priya" the candidate that attempted nothing scored 96 and was ranked last — a document that doesn't try can't make mistakes.

**Caveats.** One designer, 23 groups for the judge comparison and 6 for the self-consistency; tau over samples this size is noisy, and the differences between reward shapes are inside that noise. What survives the noise is the gap between 0.71 and 0.10, which is large.

### 2026-09-20 · The mean score hides a bimodal result

**Question.** The best run scores 79 on average. Is that "mostly good with rough edges", or two populations?

**Setup.** Plotted the per-request scores of `gemma-4-e4b + SFT v2 · tree` as a distribution rather than a mean (chart above).

**Result.** 26 of 50 requests score 80 or more; 3 score below 40, 10 between 40 and 59, 11 between 60 and 79. The distribution has a clear upper mass and a long tail, not a hump around the mean.

**What this implies.** Work that lifts everything a little is the wrong shape of work. Grouped by kind of finding, the tail is mostly agent tasks (21) and missing components (19) — surfaces that are valid, safe and well-formed, but leave something out that the request asked for. Pattern and capability-wiring findings come next. Accessibility findings are 3.

**What changed.** The next training round's selection weights capability wiring, and the benchmark charts now show the distribution, so a mean can't hide this again.

---

### 2026-09-20 · One unrenderable candidate ended a training run

**Question.** Why did a retrain produce a model from a single example?

**Setup.** Phase 5c: 550 scenarios, 4 candidates each, scored by the verifier to pick the best per scenario, then LoRA fine-tuning on what survived.

**Result.** Three minutes in, one candidate's page never became ready within the harness's 10-second timeout. `renderPage` threw, nothing caught it, and the exception ended the scoring of all 2,200 candidates. Selection wrote one training example. Training then failed on an empty dataset, and the evaluation dutifully reported a run of 0 requests scoring 0.

**What changed.** A page that never finishes rendering is now recorded as a finding against that document, like any other renderer failure, and the run continues; the selection script also skips a candidate it can't score. Re-run: 262 of 550 scenarios kept, mean best score 91.2 (the previous round kept 186 of 400 at 91.4).

**Worth stating plainly.** The failure was loud and easy to find, and it still produced a "finished" pipeline with a summary table full of zeros. A pipeline that reports success on an empty result is worse than one that crashes.

---

### 2026-09-20 · A designer ranked the gold set: the verifier knows safety, not taste (Phase 3 exit)

**Question.** Does the verifier's score agree with a designer's judgement? This was the last Phase 3 exit test.

**Setup.** Neel ranked all 10 gold groups (three versions of the same interface each) blind, in a shuffled order with neutral names, trying them live in the ranking page (`/?rank` in the local gallery). He also left 20 option notes, 5 group notes and 5 element-level annotations. `npm run gold -w @polyxd/verifier` compared his order with the verifier's.

**Result.**

| | |
|---|---|
| Groups where the verifier's order exactly matches the designer's | 5 of 10 |
| Mean rank correlation (Kendall tau-b; 1 = identical, 0 = unrelated) | 0.63 |

**Where they agree:** safety and clarity. Confirmations that don't say what will happen, destructive actions with no way back, two controls with the same name, missing summaries before paying. These are what the verifier's checks were built for, and the designer ranked them the same way.

**Where they disagree:**

- **Flow order.** In "send money" and "find a time" the designer preferred the version the verifier ranked last. That version had real flaws the verifier caught (money sent with no review; two fields with the same name), but it asked *who* first, and the designer valued the order of questions more. The verifier has no notion of a good question order.
- **Copy quality.** In "browse lamps" and "reading list" the verifier tied versions the designer clearly separated: vague labels ("Options"), weaker empty-state copy, a single price box instead of a range.
- **Field order.** In "add task" the designer preferred notes right after the task name; the verifier can't see field order at all.

**What the notes say, beyond the ranking.** The strongest theme is visual quality, which the verifier doesn't measure and the renderer doesn't yet deliver: "bland and vanilla — where is the taste?", "everything looks tabular, like key-value pairs", "the amount should be much larger", "spacing between all these layouts is completely off", filters that should be chips, a bottom sheet on mobile or a sidebar on desktop, cards that should form a grid on desktop, a real search bar, a price range, a more visual recipient, one "Best" rather than two, and a strict limit on typed confirmation to genuinely high-risk actions.

**What it means.** The verifier is a good *floor* (unsafe, unclear or inaccessible interfaces lose) but not a measure of *quality*. And the model can only be as good as the renderer and the examples it learns from, which are now the ceiling. Training harder against this verifier would optimise the floor, not the product.

**Next.** A design pass before more model training: design the key flows properly (desktop and mobile), review them with the designer, then work backwards into missing spec components (search, range, filter chips and sheets, grid collections, prominent amounts, visual entities), renderer hierarchy, spacing and density, rebuilt examples and gold set, and new verifier checks for question order and visual hierarchy. Then return to the model with a higher ceiling.

### 2026-09-20 · How to ship the fine-tune: keep the adapter separate (Phase 5, packaging)

**Question.** Run 2's adapter slowed generation from 74 to 56 tokens/s. Merging the adapter into the model should restore speed, but at what cost?

**Result.** Same fine-tuned model, packaged four ways, same benchmark:

| Packaging | Size on disk | Mean score | Agent tasks | Tokens/s | Median latency |
|---|---|---|---|---|---|
| **4-bit base + separate LoRA adapter** | 2.5 GB + adapter | **79** | **16/37** | 56 | 4.1 s |
| Merged at full precision, re-quantised to 8-bit | 7.4 GB | 76 | 15/37 | 47 | 4.8 s |
| Merged at full precision, re-quantised to 6-bit | 5.7 GB | 76 | 12/37 | 57 | 4.2 s |
| Merged directly into 4-bit | 3.9 GB | 74 | 12/37 | **76** | **3.4 s** |

**What it means.** Merging means re-quantising, and the fine-tune's changes are small enough that rounding erases part of them: more at 4-bit, less at 8-bit, but even 8-bit (three times the size) doesn't match the separate adapter. Keeping the adapter separate is the best trade: highest quality, the same speed as 6-bit, and a far smaller download. It also fits the product: one shared base model on a device, with small swappable adapters per company (the "learned taste" layer in the Design Direction plan).

**Caveats.**

- These are single greedy runs on 37 agent tasks, so differences of one to four tasks are within noise. The pattern (merging costs quality, more at lower precision) is consistent, but the exact numbers aren't precise.
- The 8-bit and 6-bit runs used prompt v4, which adds structured copy-and-tone text for the 5 requests with a Design Direction. The other 45 prompts are identical.

**Decision.** Ship the base model plus a separate adapter. Fix the benchmark's noise before the next comparison: run each configuration with several samples and report spread, not single numbers.

### 2026-09-20 · Rewarding usefulness fixes it: best model so far (Phase 5, run 2)

**Change from run 1.** Same 1,600 candidates, different selection. When the host offers capabilities, a candidate must wire at least one to something a person or agent can operate. Candidates are ranked by verifier score plus the share of offered capabilities they wire up. "Can't do that" examples are capped at 10%. That kept 186 of 400 scenarios (168 for training, 18 for validation), fewer than run 1's 316 but more useful. Training ran 400 steps.

**Result on the held-out benchmark (Gemma-4-E4B):**

| | Base | Run 1: score-only selection | **Run 2: usefulness-aware** |
|---|---|---|---|
| Valid | 98% | 100% | **100%** |
| Mean verifier score | 71 | 76 | **79** |
| Agent tasks completed | 14/37 | 10/37 | **16/37** |
| Expected components present | **64%** | 42% | 56% |
| Median latency | **3.5 s** | 3.4 s | 4.1 s |

Validation loss fell at every checkpoint (0.53, 0.29, 0.24, 0.24, 0.23), with no sign of the overfitting in run 1.

*Disclosure:* between run 1 and run 2's evaluation, the two example Design Directions gained structured copy-and-tone settings. The 5 benchmark requests that use a direction therefore saw slightly reworded direction text (the same guidance, reorganised). The other 45 prompts are identical.

**What it means.**

- **What you select for is what you get.** The same candidates, filtered two ways, produced a model that got less useful (run 1) and one that got more useful (run 2). For a generator of interfaces, "no errors" and "helps someone finish the task" are different targets, and the training signal has to name both.
- **Fewer, better examples beat more, safer ones.** Run 2 trained on about half as many examples and did better everywhere except expected components.
- **The latency increase is the adapter, not the model.** Generation drops from 74 to 56 tokens/s because the LoRA weights are applied separately at each step. Merging the adapter into the model should recover the base speed. That's measured next.
- **What's still weak:** 21 of 37 agent tasks still fail, and expected components are below the base model. Both point to the same gap: the model doesn't reliably choose the specific structure a request calls for (a `Chart` for a trend, a `Toggle` for a done-state). That's what the next step's reward is designed around.

**Next.** Merge the adapter and re-measure speed. Then Phase 6: reinforcement learning where the reward is the verifier score *plus* agent task success *plus* capability wiring, so the model is rewarded directly for interfaces that get the job done.

### 2026-09-20 · Fine-tuning on "error-free" examples taught the model to be timid (Phase 5, run 1)

**Question.** Does fine-tuning a small model on its own best outputs, as picked by the verifier, make it better?

**Setup.** All training data comes from local open models and our own verifier. No closed-model outputs are used, so the weights stay clean to publish.

1. **Scenarios.** Gemma-4-E4B wrote 400 training scenarios (a request, the capabilities the host offers, and the host's data) under a constrained scenario schema, spread across seven domains. Anything too close to a benchmark request was rejected, so the 50 benchmark requests stay held out.
2. **Candidates.** Four interfaces per scenario from Gemma-4-E4B (one greedy, three at temperature 0.7), tree format, constrained: 1,600 in total.
3. **Selection.** The verifier rendered and scored every candidate and kept the best per scenario if it scored at least 90. 316 of 400 scenarios qualified (mean best score 93).
4. **Training.** LoRA on 16 layers, 600 steps, batch 1, learning rate 1e-4, loss on the answer only. Peak memory 15.9 GB on the M5 Pro.

**Result on the held-out benchmark.**

| Gemma-4-E4B | Base | Fine-tuned (run 1) |
|---|---|---|
| Valid | 98% | **100%** |
| Mean verifier score | 71 | **76** |
| Agent tasks completed | **14/37** | 10/37 |
| Expected components present | **64%** | 42% |
| Median latency | 3.5 s | 3.4 s |

The model got safer and less useful. Validation loss also rose between steps 500 and 600 (0.168 to 0.205): it was starting to overfit.

**Why.** The selection rewarded the absence of mistakes, and the easiest way to make no mistakes is to do little. Of the 316 kept examples, only 5 contained an `Action`, 14 a `Toggle` and 8 a `Choice`, and 71 came from scenarios where the app offered no capability at all. The fine-tuned model learned to show information and leave it inert, which is exactly the Phase 4 weakness (items the user wants to act on aren't actionable), made worse. It's a textbook case of optimising a proxy: the verifier measures "nothing is wrong", not "this helps".

**Change for run 2.** Selection now also measures usefulness:

- If the host offers capabilities, a candidate must attach at least one to something a person or agent can operate (a button, a form submit, a clickable card or row, a toggle, a confirmation, a choice).
- Candidates are ranked by verifier score plus the share of offered capabilities they wire up.
- Examples where the app could do nothing are capped at 10% of the set.
- Training stops at 400 steps, before the overfitting seen in run 1.

The same idea will shape the Phase 6 reward: agent task success and capability wiring have to be in the reward alongside the verifier score, or reinforcement learning will find the same shortcut.

### 2026-09-20 · Typed references, and four models compared (Phase 4, experiment 4)

**Change.** The tree grammar now also fixes *which* component types each reference may hold (a confirmation's `summary` is a `DetailList`, `Card.media` is `Media`, an `ActionBar` holds `Action`s, images need `alt` unless decorative). The allowed types live in one module shared by the validator and the tree schema, so the grammar and the checker can't disagree.

**Result.** All four models, same prompt (v3), same typed tree grammar, same 50 requests, Apple M5 Pro:

| Model (4-bit) | Valid | Mean score | Agent tasks | Expected parts | Median latency | First token | Tokens/s |
|---|---|---|---|---|---|---|---|
| **Gemma-4-E4B** | **98%** | **71** | **14/37** | 64% | 3.5 s | 0.9 s | 74 |
| Qwen3.5-9B | 86% | 64 | 13/37 | 68% | 6.6 s | 2.4 s | 54 |
| Qwen3.5-4B | 90% | 63 | 13/37 | 75% | 3.9 s | 1.4 s | 87 |
| Qwen3.5-2B | 80% | 43 | 3/37 | 50% | 2.0 s | 0.6 s | 177 |

Typed references alone took Qwen3.5-4B from 70% to 90% valid and from 51 to 63 mean score, with no change in speed.

**What it means.**

- **Format and grammar mattered far more than size.** Across the whole sequence, Qwen3.5-4B went from 2% to 90% valid without touching the model. The 9B model is no better than the 4B one and is 1.7× slower.
- **Gemma-4-E4B is the strongest starting point**: nearly always valid, highest score, and the fastest first token of the capable models. It becomes the primary candidate for fine-tuning, with Qwen3.5-4B as the comparison.
- **Validity is nearly solved; usefulness isn't.** The best model completes 14 of 37 agent tasks. For Gemma, 12 of the misses are the same mistake: the thing the user wants to act on isn't actionable. It lists today's events or recent payments but doesn't attach the capability the host offered (`events.open`, `transactions.open`) to each item. Four more miss a toggle the task needs, and four use a field or option name the task can't find. The remaining invalid outputs are mostly two primary actions in one view.

These are design-judgment errors, not syntax. That's the job Phase 5 was planned for: fine-tuning on verifier-filtered examples, then reinforcement learning with the verifier and agent tasks as the reward.

**Next.** Phase 5: build a training set that is *separate* from the benchmark (the 50 requests stay held out), generate candidates with the strongest available model, keep only those the verifier scores highly and whose agent tasks pass, and LoRA-fine-tune Gemma-4-E4B and Qwen3.5-4B on MLX.

**Reproduce.**

```bash
model/run-baselines.sh            # generates and scores all four models
npm run leaderboard -w @polyxd/verifier
```

### 2026-09-19 · Let the model write a tree: valid output from 8% to 70% (Phase 4, experiment 3)

**Question.** Baseline 2 showed the remaining failures were references between components. If the model writes children inline, as a tree, and a compiler produces the flat document, do those failures go away?

**Change.** No change to the spec or the wire format. We added an *authoring* form:

- `schema/ui-tree.schema.json` is generated from the same component sources as the main schema. Wherever a component holds others (children, media, empty states, summaries, a Collection's item template, view and step content), the tree form holds the child component itself. Ids are optional.
- `flattenTree()` in `@polyxd/spec` compiles a tree into the flat document deterministically. It keeps a model's id only when it's valid and unique, and otherwise generates one from the component's key or type. `toTree()` is the inverse; all 20 spec examples round-trip without loss.
- The generator uses the tree schema as the constraint and a tree-shaped example in the prompt (prompt v3).

**Result.** Qwen3.5-4B, constrained, same benchmark:

| Metric | Flat, constrained | Tree, constrained |
|---|---|---|
| Passes schema and structural rules | 8% | **70%** |
| Mean verifier score (0–100) | 6 | **51** |
| Agent tasks completed | 1 of 37 | **10 of 37** |
| Expected components present | 73% | 76% |
| Median latency | 4.2 s | 3.9 s |

**What's left.** Of the 15 invalid outputs, 7 put a `Status` where a confirmation's `summary` must be a `DetailList`, and several put a `Toggle`, `Choice` or `Collection` inside a `Card`, which the spec doesn't allow. Four have two primary actions in one view. Among the valid ones, the most common problem is a missing expected component (for example no `Chart` for a spending summary) and agent tasks failing because an item the task needs to press isn't actionable.

**Why the tree helps.** A flat list asks the model to keep a table of ids consistent across the whole output. A tree puts each child where it's used, which is how both people and models write nested structures. The flat form remains the right wire format for streaming, diffing and A2UI; the compiler is a few dozen lines.

**Next (running now).** The tree grammar can go further than the flat one: because a child is written in place, the allowed component types for each reference can be part of the grammar. `Confirm.summary` can only be a `DetailList`, `Card.media` only `Media`, and images need `alt` unless marked decorative. The allowed types now live in one module (`src/references.ts`) shared by the validator and the tree schema. Then: the same setup on Qwen3.5-2B, Gemma-4-E4B and Qwen3.5-9B. An open spec question also stands: several outputs put a toggle or button inside a card, which is reasonable UI, and the `Card.children` restriction may be too strict.

### 2026-09-19 · Constrained decoding fixes syntax, not structure (Phase 4, baseline 2)

**Question.** If every token must keep the output valid against the UI schema, how much of baseline 1's failure goes away, and what does it cost?

**First attempt: Outlines.** Outlines compiles the JSON Schema into one regular expression (about 60,000 characters for our schema) and then precomputes which of the model's ~248,000 tokens can follow each state. For our schema that precomputation ran for over 10 minutes on one CPU core without producing a first token, so we stopped it. A large, expressive schema makes up-front compilation impractical.

**Second attempt: llguidance.** llguidance computes allowed tokens lazily at each step, so there is no start-up cost. It rejects JSON Schema `oneOf` by default, because exact "one of" semantics can't be enforced token by token. Every `oneOf` in the Polyxd schema has mutually exclusive branches (a string versus a `{path}` object, a list versus an object, or components distinguished by their `component` value), so treating them as `anyOf` accepts exactly the same documents. With that option it runs as a mlx-lm logits processor (`model/polyxd_model/constrain.py`).

**Result.** Same model, prompt and benchmark as baseline 1.

| Metric | Unconstrained | Constrained (llguidance) |
|---|---|---|
| Output parses as JSON | 56% | **100%** |
| Passes schema and structural rules | 2% | 8% |
| Agent tasks completed | 1 of 37 | 1 of 37 |
| Median latency | 5.8 s | **4.2 s** |
| Generation speed | 93 tokens/s | 87 tokens/s |

Latency went down because constrained outputs can't loop or run to the token limit. The per-token cost of masking is small (about 6% slower generation).

**What's left.** Nearly every remaining failure is a reference problem that JSON Schema can't express. The model lists `"children": ["amount"]` or `"summary": "freeze-card"` and then never defines that component, or sets `"root": "surface"`. Another cluster is `Card.children` holding a `Toggle` or `Action`, which the spec forbids today.

**What it means.** The flat "list of components plus id references" format is right for the wire (it streams, it matches A2UI, it diffs well), but it is hard for a small model to *author*: the model has to keep a table of ids in its head across a long output. In baseline 1 the model's instinct was to nest children inline, which is how models naturally write trees.

**Next.** Let the model author a nested tree (children written inline, no ids), constrained by a recursive schema generated from the same spec, and compile it deterministically into the flat document. Ids and references are then correct by construction, and nothing about the spec or the wire format changes. Separately, the `Card.children` restriction may be too strict: a habit card with a toggle is reasonable UI. That is a spec question, and the model's outputs are evidence for it.

### 2026-09-19 · Small models can't hold the structure (Phase 4, baseline 1)

**Question.** Out of the box, how close is a small local model to producing valid Polyxd interfaces?

**Setup.** Qwen3.5-4B (4-bit, MLX) on an Apple M5 Pro with 24 GB. Greedy decoding, thinking mode off, no fine-tuning. The prompt is built automatically from the spec (component signatures, patterns and nine rules, about 2,800 tokens), plus the request, the capabilities the host exposes, the host's data and any Design Direction. Benchmark: all 50 requests in `bench/requests.json`. Scored with `npm run score -w @polyxd/verifier`.

**Prompt fix before the run (v1 → v2).** The first outputs bound data as `/data/card/id` instead of `/card/id`, because the prompt labelled the data block "DATA" without saying where pointers start. Prompt v2 states the root explicitly, says children are id strings, and gives the key format. That is a prompt ambiguity, not a model limit, so it was fixed before the baseline.

**Result.**

| Metric | Qwen3.5-4B, unconstrained |
|---|---|
| Output parses as JSON | 56% |
| Passes the schema and structural rules | 2% (1 of 50) |
| Agent tasks completed | 1 of 37 |
| Expected components present (where parseable) | 78% |
| Median latency, time to first token | 5.8 s, 1.4 s |
| Generation speed | 93 tokens/s |

**Where it fails.** Of 50 outputs:

| Failure | Count |
|---|---|
| JSON: unbalanced brackets or missing comma | 13 |
| JSON: cut off by a repetition loop or the token limit | 9 |
| Malformed key or id (e.g. `"key": "Last 4"`) | 8 |
| Wrong shape (e.g. a list where a template object is required) | 7 |
| Reference to a component that doesn't exist | 4 |
| Two primary actions in one view | 3 |
| Invented property | 3 |
| Other schema errors | 2 |
| Valid | 1 |

**What it means.** The model understands the task: when it produced something parseable, 78% of the components the benchmark expects were there, and it chose sensible patterns (a confirmation for card freezing, a form for sending money). What it can't do is keep a long, nested JSON structure consistent. About 80% of failures are syntax or schema shape, which is exactly what constrained decoding removes. The rest (missing references, two primary actions) are design-level mistakes that fine-tuning against the verifier should fix.

**Next.** Run the same benchmark with JSON-schema-constrained decoding (Outlines), which makes every schema-level failure above impossible by construction, and measure what it costs in latency. Then run Qwen3.5-2B, Gemma-4-E4B and Qwen3.5-9B for the size comparison.

**Reproduce.**

```bash
cd model && uv run python -m polyxd_model.generate --model mlx-community/Qwen3.5-4B-4bit
npm run score -w @polyxd/verifier -- ../../model/runs/Qwen3.5-4B-4bit
```

### 2026-09-19 · The verifier found real bugs in our own renderer (Phase 3)

**Question.** Does the verifier catch what it should, and does it find anything we didn't know about?

**Result.** 20 of 20 deliberately injected defects are caught, across schema, structure, patterns, capability safety, copy, rendered accessibility, layout and agent operability. All 20 spec examples score 100 across 240 renders (3 design systems × light/dark × phone/desktop), with 216 of 216 agent task runs succeeding through the accessibility tree alone.

Building it found real bugs in `@polyxd/react`, all fixed:

- Metric change indicators and "Best" markers used chart colours for text. The token contract only guarantees those colours at 3:1 (graphics), not the 4.5:1 text needs, and they failed WCAG in Carbon and Ant Design. A stylesheet lint now forbids graphics-only colours in `color:` declarations.
- Radio, checkbox and switch rows were below each design system's own touch-target size. Rows now make the whole label part of the target.
- "(required)" and option descriptions leaked into controls' accessible names ("Express (next day) £4.99"), which breaks screen readers and agents alike.
- A confirmation that was the whole surface became a page-wide modal and blocked the host app.
- The defect test showed the "at most 6 inputs per view" rule only applied to surfaces that declared a pattern; it now applies everywhere.

### 2026-09-19 · Popular design systems fail their own contrast checks

**Question.** Can three widely used design systems satisfy one accessibility-first token contract without changing their character?

**Result.** Material 3 passed every contrast pair unchanged. Carbon needed one change: its light-mode warning colour measured 1.68:1 against white, so the pack uses Carbon's own darker outline token (4.99:1). Ant Design needed several: white text on its primary blue is 4.10:1, warning text on its background 1.83:1, and the default input border 1.41:1. Each moved to the nearest passing step of Ant's own palette. Carbon and Ant both default to 14px body text, below the contract's 16px; each pack maps body text to that system's own 16px size. Details are in each pack's README.

**Also found.** Our contrast checker ignored transparency (Ant's text colours are translucent). It now composites a translucent colour over its background before measuring.
