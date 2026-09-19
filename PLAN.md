# Polixd — Project Plan (draft v0)

## 1. What we're building

A small, on-device model that generates **just-in-time interfaces**: you ask for something, a UI appears for that moment, then it goes away. What makes it different:

- **Recognizable.** Interfaces built on the fly still look and behave the same way each time, so people recognize them instead of having to recall them.
- **For humans and agents at once.** Every interface has real accessibility semantics, so screen readers and AI agents can use it as well as people.
- **Any design system.** The model only chooses *meaning* (components, patterns, "primary action"). The look comes from a swappable design system, with no retraining.

**What we'll deliver, in order of value:**
1. **The spec:** three-tier tokens, semantic components, patterns and agent semantics.
2. **The verifier and benchmark** for ephemeral-UI usability. Nothing like it exists yet, and it's useful even if the model stalls.
3. **The small model** (1.5–4B) plus a web demo.

**Not in scope for v1:**
- Training a foundation model from scratch.
- Pixel generation.
- Inventing a new protocol. We build on or stay compatible with A2UI.
- A design-system generator. It's a separate product and comes later.
- Native iOS/Android renderers. The spec maps to SwiftUI/Compose, but v1 only renders on the web.

## 2. Architecture

```
request ──► generator (small model, constrained to spec schema)
               ▲                      │  UI JSON (semantic only)
               │ rules/examples       ▼
        interface memory ◄──── renderer (web: React + shadcn/Radix, themed by tokens)
                                      │
                                      ▼
                               verifier → score (used for eval + RL reward)
```

| Part | What it is | AI or code |
|---|---|---|
| Spec | JSON Schema: tokens (primitive → semantic → component, W3C DTCG format), ~20 semantic components, 5 patterns, agent semantics | Written by hand |
| Renderer | UI JSON → shadcn/Radix components. Tokens → CSS variables via Style Dictionary | Code |
| Interface memory | Per-user record of how things appeared before (pattern chosen, placement, labels), fed back to the generator as constraints | Code (deterministic) |
| Verifier | Schema validity, axe-core, token compliance, contrast, target size, responsive widths, consistency vs. memory, agent task completion | Code + small local LLM agent |
| Generator | Small open-weight model, JSON-schema constrained decoding | AI |

## 3. Hardware

- **M5 Pro, 24GB:** everything. That covers dev, rendering, local teacher models (≤14B at 4-bit), MLX LoRA/QLoRA fine-tuning of 1.5–8B models, and small GRPO runs.
- **2017 MacBook Pro:** a render and verifier worker during RL (Phase 6) only, running Playwright and axe-core jobs over the LAN. Unused before then.
- **Kaggle/Colab:** backup only, if a run outgrows 24GB.
- **Cost:** $0. The teacher is an open-weight model run locally. We don't train on outputs from closed models, whose terms often forbid it.

## 4. Phases

Durations assume roughly 15–20 hours a week and are rough. Each phase has an exit test, and we don't move on until it passes.

### Phase 0: Setup and grounding (days 1–3)
- Accept the Xcode license, `git init`, and set up the repo structure (§6).
- Read the current A2UI spec, Material 3 tokens, GOV.UK patterns, and the Maru / Affora / Harness4GenUI preprints (check their claims against the PDFs).
- **Output:** a one-page decision note on whether we extend the A2UI catalog or define our own schema with A2UI export.

### Phase 1: Spec v0 (weeks 1–2)
- Token tiers in DTCG format, filled from the first design system.
- ~20 semantic components (choice, form field, confirm-destructive, compare, progress-steps, list, card, chart, empty/error/loading states, …). Each one has:
  - Props.
  - Required accessibility and agent semantics.
  - Usage rules ("when to pick it").
  - A mapping to shadcn, SwiftUI and Compose.
- 5 patterns in the chosen domain, each with task semantics (goal, steps, done-condition).
- **Exit:** 20 hand-written example UIs validate against the schema, and the mapping table is complete.

### Phase 2: Web renderer and theming (weeks 2–4)
- React + Vite + shadcn/Radix renderer, with tokens compiled to CSS variables.
- Add a second design system to prove the swap.
- **Exit:** all examples render. Swapping the design system changes the look without editing any UI JSON.

### Phase 3: Verifier and benchmark (weeks 4–6)
- Hard checks: schema, axe-core, contrast, target sizes, token-only values, 3 viewport widths.
- Consistency score: how similar the semantic tree is to memory for the same intent (pattern choice, component-for-datatype, relative placement, labels).
- Agent test: given a task, a scripted Playwright agent and a small local LLM agent try to complete it using only the accessibility tree. We measure success, steps and dead ends.
- Benchmark: 50 single requests plus 10 multi-turn sequences, where consistency matters.
- **Exit:** the verifier catches at least 90% of 20 deliberately injected defects, and its scores agree with your manual ranking of a 30-item gold set.

### Phase 4: Baselines (weeks 6–7)
- Run 3B, 7–8B and ~14B open models locally with constrained decoding, with and without interface memory. Pick the models from what's current at that point.
- **Output:** a leaderboard.
- **Decision gate:**
  - If the 14B model is already good, the goal becomes making the 3B match it (distillation).
  - If every model fails on consistency, the effort goes into memory design, not training.

### Phase 5: Supervised fine-tuning (weeks 7–10)
- Rejection sampling: the teacher generates N candidates per request, the verifier keeps the best, and we LoRA-train the 3B model on them in MLX.
- **Exit:** the 3B model clearly beats its own baseline and closes most of the gap to the teacher on held-out requests.

### Phase 6: RL with the verifier as reward (weeks 10–14)
- GRPO on the fine-tuned 3B model, with the old Mac rendering in parallel.
- Every round, a human audits 50 samples for reward hacking. Each hack found becomes a new check.
- **Exit:** beats the fine-tuned model on held-out requests, with no unaddressed hacks in the audit.

### Phase 7: Demo and release
- Demo app (ask → UI appears → gone → ask again → it's recognizable).
- Publish the spec and benchmark, with a short write-up.

**Later:** SwiftUI/Compose renderers, the design-system generator (OKLCH palettes, modular type scale, and so on, checked by the same verifier), and a bring-your-own-design-system importer (Figma variables / Tokens Studio).

## 5. Risks

| Risk | Mitigation |
|---|---|
| A2UI changes under us | Phase 0 decision; keep our schema as the source of truth, with A2UI as an export |
| Small model can't stay consistent across turns | Keep consistency in deterministic memory and constraints, not model weights |
| Reward hacking | Audits every round, hard checks gate the soft scores, aesthetic judge weighted low |
| Scope creep (two products) | Design-system generator is explicitly postponed |
| Preprint numbers are wrong | Rely only on results we reproduce ourselves |
| Licensing | MIT/Apache/OGL sources only; learn from Apple HIG, don't copy it |

## 6. Repo layout

```
spec/            JSON Schema, components, patterns, mapping table
design-systems/  material3/, <second>/  (DTCG tokens)
renderer-web/    React + shadcn renderer
memory/          interface memory store + rule extraction
verifier/        Playwright, axe-core, scorers, agent tester
bench/           requests, multi-turn sequences, tasks, gold set
model/           Python (uv + MLX): baselines, SFT, GRPO
docs/            decisions, write-ups
```
TypeScript (npm workspaces) for spec/renderer/verifier; Python for the model.

## 7. Decisions needed before Phase 1

1. **Domain.** Recommended: **personal finance**. It has forms, tables, charts, destructive confirms and repeated tasks, so consistency matters and agent tasks are easy to specify. Health brings privacy and medical-accuracy issues. Travel needs live data.
2. **First design system.** Recommended: **Material 3** for tokens and guidance (it maps to web and Android and is well documented), with **GOV.UK** as the second system to prove the swap. The pair is deliberately very different visually.
3. **Web stack.** Recommended: React + Vite + shadcn/Radix.
4. **Time per week.** This sets the real timeline.
