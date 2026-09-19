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
