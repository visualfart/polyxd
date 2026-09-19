# Polixd — Project Plan (draft v0)

## 1. What we're building

A small, on-device model that generates **just-in-time interfaces**: you ask for something, a UI appears for that moment, then it goes away. What makes it different:

- **Recognizable.** Interfaces built on the fly still look and behave the same way each time, so people recognize them instead of having to recall them.
- **For humans and agents at once.** Every interface has real accessibility semantics, so screen readers and AI agents can use it as well as people.
- **Any design system.** The model only chooses *meaning* (components, patterns, "primary action"). The look comes from a swappable design system, with no retraining.
- **Directed by designers.** A company's designers set its taste (profile, voice, patterns, rules, exemplars) and review what gets generated (§6).

**What we'll deliver, in order of value:**
1. **The spec:** three-tier tokens, semantic components, patterns and agent semantics.
2. **The verifier and benchmark** for ephemeral-UI usability. Nothing like it exists yet, and it's useful even if the model stalls.
3. **The small model** (1.5–4B) plus a web demo.

**Not in scope for v1:**
- Training a foundation model from scratch.
- Pixel generation.
- Inventing a new protocol. We build on or stay compatible with A2UI.
- A design-system generator. It's a separate product and comes later.
- A paid hosted API. v1 is on-device or self-hosted (§5).
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

**Contract rules that make it embeddable in other software:**
- **Generated UI is data, never code.** The UI JSON contains no scripts, URLs to load or styles. The host's renderer decides what can appear, so embedding Polixd can't run arbitrary code.
- **Actions are declared intents.** The model emits `{"action": "transfer.confirm", ...}`, and the host binds each intent to its own handler. The host keeps control of what actually happens.
- **Data comes from the host.** The model lays out and labels data it is given, and never invents values like balances or prices.
- **The generator is swappable.** Anything that can emit spec-valid JSON can drive the runtime: our small model, a local model, or any hosted LLM. The spec and renderers are useful even to people who never use our model.

## 3. Hardware

- **M5 Pro, 24GB:** everything. That covers dev, rendering, local teacher models (≤14B at 4-bit), MLX LoRA/QLoRA fine-tuning of 1.5–8B models, and small GRPO runs.
- **2017 MacBook Pro:** a render and verifier worker during RL (Phase 6) only, running Playwright and axe-core jobs over the LAN. Unused before then.
- **Kaggle/Colab:** backup only, if a run outgrows 24GB.
- **Cost:** $0. The teacher is an open-weight model run locally. We don't train on outputs from closed models, whose terms often forbid it.

## 4. Phases

Durations assume roughly 15–20 hours a week and are rough. Each phase has an exit test, and we don't move on until it passes.

### Phase 0: Setup and grounding (days 1–3)
- Accept the Xcode license, `git init`, and set up the monorepo structure (§8).
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
- Add a second design system to prove the swap, and two contrasting Design Direction profiles to prove taste control.
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

## 5. Distribution: how other software uses Polixd

The goal is for any app, agent or tool to adopt Polixd one layer at a time. Each layer ships as its own package, so no one has to adopt all of it.

| Layer | Who uses it | Ships as | Channel (free) |
|---|---|---|---|
| **Spec** (schema, types, tokens format) | Anyone generating or rendering UI | `@polixd/spec` (JSON Schema + TS types), `polixd-spec` (Python) | npm, PyPI, docs site |
| **Design-system packs** | Apps bringing their brand | `@polixd/ds-material3`, `@polixd/ds-govuk`, and an importer for Figma variables / Tokens Studio | npm |
| **Web renderer** | Web apps | `@polixd/react` (shadcn/Radix) | npm |
| **Native renderers** (later) | iOS / Android apps | Swift package, Compose library | SPM, Maven Central |
| **Runtime SDK** (generator + memory + validation + streaming) | Apps that want the whole loop | `@polixd/runtime`, `polixd` (Python), with pluggable model backends and memory storage | npm, PyPI |
| **Model** | Runs on-device or self-hosted | Weights in MLX, GGUF and safetensors formats | Hugging Face, Ollama library |
| **Server** | Teams that want to self-host | Docker image: model server + HTTP API with streaming | GitHub Container Registry |
| **Agent integration** | AI agents and assistants | MCP server (MCP Apps compatible), A2UI export | npm (`npx @polixd/mcp`) |
| **Verifier and benchmark** | Anyone evaluating generative UI | `polixd verify` CLI, dataset, leaderboard | npm, Hugging Face Datasets |
| **Demo** | Everyone | Hosted playground | Hugging Face Spaces / GitHub Pages |

**Where things run.** On-device is the default: private, free and fast. The same runtime can point at a self-hosted server or any model endpoint.

**Memory is private by default.** It's stored on the client (IndexedDB / SQLite), with storage adapters for hosts that want server-side memory. There's no telemetry.

**Our own hosted API is deferred.** It's the only piece that costs money to run. The server image makes self-hosting possible from day one, and we'll decide on a hosted API after v0.1 based on demand.

**Distribution requirements that affect the build from Phase 1:**
- **Monorepo with publishable packages from the start.** Package boundaries match the layers above (§7).
- **Spec versioning.** Semver, a `specVersion` field in every UI document, and a stated compatibility policy with migration notes. v0.x may break; v1.0 is a stability promise.
- **Streaming.** JIT interfaces must feel instant, so UI JSON is streamed and rendered progressively. Budget: first meaningful render under 1s on the M5, measured in the benchmark.
- **Small footprint.** The renderer bundle has a size budget, and the model targets ≤ 2.5GB at 4-bit.
- **Stable public API** with documentation for every package, plus runnable examples (a React app, a Python agent, an MCP client).
- **Security.** Content is sanitized, intents are allowlisted by the host, and there's a threat model for prompt injection through host data shown in a UI.

**Release milestones.** The repo stays private until v0.1.
- **v0.1** (after Phase 3): spec, design-system packs, React renderer, verifier and benchmark. It works with any LLM.
- **v0.2** (after Phase 5): runtime SDK, MCP server, first model weights.
- **v0.3** (after Phase 6): RL model, Docker server, playground.
- **v1.0:** spec frozen, then native renderers.

**Licensing** (to confirm):
- **Code:** Apache-2.0, for its patent grant.
- **Spec and docs:** CC-BY-4.0.
- **Model weights:** inherit the base model's license, so we pick a base model with a permissive license.
- **Benchmark:** respects the licenses of its sources.

**Names.** "Polixd" is a working name and can change before v0.1. Package names follow whatever the final name is.

## 6. Taste: how a company's designers direct it

Tokens control how things *look*. Taste goes further: how dense a screen is, how much gets emphasized, the tone of the copy, which pattern a team prefers, what to leave out, how motion feels. A designer at a company using Polixd needs to shape all of that **without writing prompts or JSON, and without retraining a model**.

### The Design Direction package

Each company's taste lives in one versioned package, alongside its tokens:

| Layer | What the designer sets | Example | How it's enforced |
|---|---|---|---|
| **Tokens** | Look | Brand colors, type, radii | Renderer (deterministic) |
| **Profile** | Style settings | Density: comfortable. Emphasis budget: 1 primary action per view. Charts over tables for trends. Motion: subtle. | Generator constraints + verifier |
| **Voice** | Copy style + glossary | "Sentence case, no exclamation marks, say 'payment' not 'transaction'" | Generator conditioning + lint checks |
| **Patterns and recipes** | The company's own versions of patterns, and its own components registered with semantics | "Our transfer flow always shows the fee before the amount field" | Pattern library, with company patterns taking precedence over defaults |
| **Rules** | Dos and don'ts in plain language, compiled into checks where possible | "Destructive actions need a typed confirmation." "Never more than 5 options without search." | Verifier (a hard fail or a scored check) |
| **Exemplars** | "This is how we'd do it" examples | 20–100 approved UIs for typical requests | Retrieved as examples at generation time |
| **Learned adapter** (optional) | Taste that's hard to state as rules | Learned from the team's approve/reject history | Small LoRA adapter (tens of MB), swapped per company |

Everything above the last row is deterministic, or close to it. It works on day one, and a designer can see exactly why a UI came out the way it did. The learned adapter comes last and is optional.

**Freedom dial.** The company sets how far the generator may go beyond approved patterns:
- **Strict:** only approved patterns.
- **Guided:** new layouts allowed, built from approved components.
- **Open:** anything that passes the verifier.

When the model has no fitting pattern, it flags the gap for review.

**Precedence.** From highest to lowest:
1. Accessibility floor. Nobody can override it.
2. The end user's accessibility needs (text size, reduced motion, contrast).
3. Company rules.
4. Company profile, voice and patterns.
5. End-user preferences (for example density), within the company's bounds.
6. Model defaults.

### Where designers do this: Polixd Studio

Studio is a web app for designers.
- **Set direction.** Edit the profile, voice, rules and patterns through visual controls. Import tokens from Figma variables or Tokens Studio.
- **Preview at scale.** Run the company's typical requests (their own benchmark set) under the current direction, and see every result side by side on web and mobile.
- **Review.** Approve, reject or edit generated UIs directly.
  - Approvals become exemplars.
  - Edits and rejections become preference pairs.
  - A repeated correction is suggested as a new rule ("you've moved the fee above the amount 6 times: make it a rule?").
- **Pattern gaps.** Review the patterns the model had to invent in production, and promote good ones into the library.
- **Publish safely.** Direction changes are versioned. Before publishing, the whole request set is re-run and a before/after diff is shown, like visual regression testing for taste. Changes can then be rolled out gradually.
- **Later:** a Figma plugin to author patterns and exemplars where designers already work.

### What this changes in the build

- **Spec (Phase 1):** the Design Direction schema (profile, voice, rules, patterns, exemplars) sits beside tokens. Rules can be machine-checkable or advisory.
- **Verifier (Phase 3):** direction-compliance checks, plus a new benchmark metric, *direction following*. The same request under two contrasting directions must give different outputs that each comply. We ship **two deliberately contrasting direction profiles** to prove taste control, the way two design systems prove the look swap.
- **Training (Phases 5–6):** training data is generated under **many randomized directions**. The model should learn to *follow* a direction instead of memorizing one taste. This is the key training decision for taste.
- **Runtime (v0.2):** loads a Design Direction package, retrieves exemplars, applies precedence, and optionally loads a company adapter.
- **Studio:** a basic review and preview tool arrives with v0.2. The full Studio (rule suggestions, publish diffs, rollout) comes with v0.3. The team's review history can train its adapter (DPO) from v0.3.
- **Privacy:** a company's exemplars, feedback and adapter stay in its own deployment. Nothing is collected by default.

## 7. Risks

| Risk | Mitigation |
|---|---|
| A2UI changes under us | Phase 0 decision; keep our schema as the source of truth, with A2UI as an export |
| Small model can't stay consistent across turns | Keep consistency in deterministic memory and constraints, not model weights |
| Reward hacking | Audits every round, hard checks gate the soft scores, aesthetic judge weighted low |
| Scope creep (two products) | Design-system generator is explicitly postponed |
| Preprint numbers are wrong | Rely only on results we reproduce ourselves |
| Licensing | MIT/Apache/OGL sources only; learn from Apple HIG, don't copy it |
| Designers can't express taste, or can't see why a UI came out as it did | Direction stays deterministic and explainable first; learned adapter is optional and comes last |
| Model memorizes one taste instead of following directions | Train under randomized directions; direction-following metric in the benchmark |
| Embedding is abused (injection, unsafe actions) | UI-as-data, host-allowlisted intents, threat model before v0.1 |
| Breaking changes hurt early adopters | Semver, `specVersion`, migration notes; nothing public before v0.1 |

## 8. Repo layout

```
packages/
  spec/            @polixd/spec: JSON Schema, TS types, components, patterns, mapping table
  ds-material3/    @polixd/ds-material3 (DTCG tokens)
  ds-govuk/        @polixd/ds-govuk
  react/           @polixd/react: shadcn/Radix renderer
  runtime/         @polixd/runtime: generator backends, memory, validation, streaming
  verifier/        @polixd/verifier + `polixd verify` CLI
  mcp/             @polixd/mcp: MCP server
  direction/       Design Direction schema, precedence engine, rule compiler
python/            polixd SDK + polixd-spec (PyPI)
model/             Python (uv + MLX): baselines, SFT, GRPO, export (MLX/GGUF)
server/            Dockerfile + HTTP API
bench/             requests, multi-turn sequences, tasks, gold set
apps/playground/   demo
apps/studio/       designer Studio
docs/              docs site, decisions, write-ups
```
TypeScript (npm workspaces, Changesets for versioning and releases) and Python (uv). GitHub Actions for CI and publishing.

## 9. Decisions needed before Phase 1

1. **Domain.** Recommended: **personal finance**. It has forms, tables, charts, destructive confirms and repeated tasks, so consistency matters and agent tasks are easy to specify. Health brings privacy and medical-accuracy issues. Travel needs live data.
2. **First design system.** Recommended: **Material 3** for tokens and guidance (it maps to web and Android and is well documented), with **GOV.UK** as the second system to prove the swap. The pair is deliberately very different visually.
3. **Web stack.** Recommended: React + Vite + shadcn/Radix.
4. **Time per week.** This sets the real timeline.
5. **Licenses.** Recommended: Apache-2.0 for code, CC-BY-4.0 for spec and docs.
