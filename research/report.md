---
title: Research log
description: What we tried, what we measured, and what we changed because of it. Updated as experiments run.
order: 45
section: Project
---

This is Polyxd's running improvement report. Each entry states a question, what changed, the measured result, and what happens next. Numbers come from the repository's own tools (the verifier, the benchmark and the scorer), and every run can be reproduced from the commands given. Negative results stay in.

## Current leaderboard

<!--LEADERBOARD-->

## Entries

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
