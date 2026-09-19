# Polyxd — Project Plan (draft v0)

## Status (2026-09-20)

- **Phase 0 — done.** Decision [0001](docs/decisions/0001-a2ui-and-foundations.md): own schema as source of truth, exported to A2UI v1.0 and MCP Apps.
- **Phase 1 — done.** `@polyxd/spec` (now 26 components, UI schema, validator, 6 patterns, check vocabulary, capability/journey/event/direction schemas, 24 examples), `@polyxd/ds-material3`, `@polyxd/a2ui` (every example exports to A2UI v1.0 RC and validates against the official schemas; allowed children are derived from the spec's own reference table).
  - Finding: no component maps losslessly onto A2UI's Basic catalog, so the export is a custom Polyxd catalog. The official `@a2ui/react` renderer supports only v0.8/v0.9, so rendering an exported surface in it is a follow-up.
- **Phase 2 — done.** `@polyxd/react` (all 26 components on Radix, styled only by token variables, container-query layouts, adapter overrides), theme compiler, `@polyxd/ds-carbon` and `@polyxd/ds-antd` alongside Material 3, and `apps/gallery`. Decision [0002](docs/decisions/0002-astryx.md): Astryx is a complement and a future renderer adapter.
  - Findings: Ant Design's and Carbon's defaults fail WCAG in several places, so the packs move those to the nearest passing step of their own palettes. Carbon's font stack contained a name that isn't a valid CSS identifier, which silently dropped every Carbon surface to a serif face; the theme compiler now quotes names and appends a generic family.
- **Phase 3 — done.** `@polyxd/verifier`: document checks, rendered checks (axe-core WCAG 2.2 AA, overflow, target size) in 3 packs × light/dark × phone/desktop, an accessibility-tree agent (which now opens progressive disclosure rather than reporting a missing control), and a consistency score. All 24 examples score 100 across 288 renders with 216/216 agent runs; 20/20 injected defects are caught. Benchmark in `bench/`: 50 requests, 10 multi-turn sequences, 43 capabilities, 37 agent tasks, gold set.
  - Exit criterion met: the designer ranked the gold set. Agreement was exact in 5/10 groups, tau 0.63 — the verifier knows safety, not taste. That result started the design pass below.
- **Design pass — done (batches 1–4).** 26 approved artboards for nine consumer flows and nine for dense B2B, implemented as semantics rather than styling: hero amounts, people with faces, receipts, confirmations that name who and list consequences, filter panels, one recommendation with its reason, undo instead of confirm, card progress, richer empty states; then tables with saved views, sorting, selection with bulk actions, row menus, cell kinds and paging, plus navigation, page headers, detail grids, timelines and horizontal forms. Four new checks (who before how much; typed confirmation only for destructive actions; one recommendation; consequence next to the action). Density, `emphasisBudget` and `disclosure` from Design Direction now actually drive the renderer and validator.
- **Website:** polyxd.com landing page, docs (18 pages, including Dense software and The designer's job), research log with charts, and the live gallery, on Cloudflare Workers with a KV-backed waitlist.
- **Phase 4 — done.** Four local models on the benchmark with llguidance-constrained decoding and a tree authoring format compiled to the flat spec. Best: Gemma-4-E4B, 98% valid, mean score 71, 14/37 agent tasks, 3.5 s median. Format and grammar mattered far more than size (Qwen3.5-4B: 2% → 90% valid without changing the model).
- **Phase 5 — done (v2), retraining for the new spec (v3).** Usefulness-aware selection beat score-only selection: 100% valid, mean score 79, 16/37 agent tasks. Adapters ship separately from the base model (fusing loses quality). Run 3 (`sft-v3`) is training on 262 scenarios selected from 550, including business-heavy ones, against the 26-component spec.
- **Next:** re-rank a gold set built from the retrained model (the real test of whether designing first helped), then Phase 6 — reinforcement learning with the verifier's score, agent success and capability wiring as the reward.

## 1. What we're building

A small, on-device model that generates **just-in-time interfaces**, so people can build real AI-first software, or their own personal software, without drawing screens: you ask for something, a UI appears for that moment, then it goes away. What makes it different:

- **Recognizable.** Interfaces built on the fly still look and behave the same way each time, so people recognize them instead of having to recall them.
- **For humans and agents at once.** Every interface has real accessibility semantics, so screen readers and AI agents can use it as well as people.
- **Any design system.** The model only chooses *meaning* (components, patterns, "primary action"). The look comes from a swappable design system, with no retraining.
- **Directed by designers.** A company's designers set its taste (profile, voice, patterns, rules, exemplars) and review what gets generated (§6).
- **Run like a product.** PMs define capabilities, journeys, acceptance checks and metrics instead of screens. Analytics come built in (§7).

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
- **Generated UI is data, never code.** The UI JSON contains no scripts, URLs to load or styles. The host's renderer decides what can appear, so embedding Polyxd can't run arbitrary code.
- **Actions are declared intents.** The model emits `{"action": "transfer.confirm", ...}`, and the host binds each intent to its own handler. The host keeps control of what actually happens.
- **Data comes from the host.** The model lays out and labels data it is given, and never invents values like balances or prices.
- **The generator is swappable.** Anything that can emit spec-valid JSON can drive the runtime: our small model, a local model, or any hosted LLM. The spec and renderers are useful even to people who never use our model.

## 3. Hardware

- **M5 Pro, 24GB:** everything. That covers dev, rendering, local teacher models (≤14B at 4-bit), MLX LoRA/QLoRA fine-tuning of 1.5–8B models, and small GRPO runs.
- **2017 MacBook Pro:** a render and verifier worker during RL (Phase 6) only, running Playwright and axe-core jobs over the LAN. Unused before then.
- **Kaggle/Colab:** backup only, if a run outgrows 24GB.
- **Cost:** $0. The teacher is an open-weight model run locally. We don't train on outputs from closed models, whose terms often forbid it.

## 4. Phases

No fixed timeline. Each phase has an exit test, and we don't move on until it passes.

### Phase 0: Setup and grounding
- Accept the Xcode license, `git init`, and set up the monorepo structure (§10).
- Read the current A2UI spec, Material 3 tokens, GOV.UK patterns, and the Maru / Affora / Harness4GenUI preprints (check their claims against the PDFs).
- **Output:** a one-page decision note on whether we extend the A2UI catalog or define our own schema with A2UI export.

### Phase 1: Spec v0
- Token tiers in DTCG format, filled from the first design system.
- ~20 semantic components (choice, form field, confirm-destructive, compare, progress-steps, list, card, chart, empty/error/loading states, …). Each one has:
  - Props.
  - Required accessibility and agent semantics.
  - Usage rules ("when to pick it").
  - A mapping to shadcn, SwiftUI and Compose.
- 5 core patterns that aren't tied to any domain (e.g. confirm-destructive, multi-step form, compare-and-choose, filter-and-browse, review-and-submit), each with task semantics (goal, steps, done-condition).
- **Exit:** 20 hand-written example UIs validate against the schema, and the mapping table is complete.

### Phase 2: Web renderer and theming
- React + Vite + shadcn/Radix renderer, with tokens compiled to CSS variables.
- Add a second design system to prove the swap, and two contrasting Design Direction profiles to prove taste control.
- **Exit:** all examples render. Swapping the design system changes the look without editing any UI JSON.

### Phase 3: Verifier and benchmark
- Hard checks: schema, axe-core, contrast, target sizes, token-only values, 3 viewport widths.
- Consistency score: how similar the semantic tree is to memory for the same intent (pattern choice, component-for-datatype, relative placement, labels).
- Agent test: given a task, a scripted Playwright agent and a small local LLM agent try to complete it using only the accessibility tree. We measure success, steps and dead ends.
- Benchmark: 50 single requests plus 10 multi-turn sequences (where consistency matters), spread across ~6 domains: money, productivity, commerce, travel, settings/admin, and personal software. No domain gets special treatment.
- **Exit:** the verifier catches at least 90% of 20 deliberately injected defects, and its scores agree with your manual ranking of a 30-item gold set.

### Phase 4: Baselines
- Run 3B, 7–8B and ~14B open models locally with constrained decoding, with and without interface memory. Pick the models from what's current at that point.
- **Output:** a leaderboard.
- **Decision gate:**
  - If the 14B model is already good, the goal becomes making the 3B match it (distillation).
  - If every model fails on consistency, the effort goes into memory design, not training.

### Phase 5: Supervised fine-tuning
- Rejection sampling: the teacher generates N candidates per request, the verifier keeps the best, and we LoRA-train the 3B model on them in MLX.
- **Exit:** the 3B model clearly beats its own baseline and closes most of the gap to the teacher on held-out requests.

### Phase 6: RL with the verifier as reward
- GRPO on the fine-tuned 3B model, with the old Mac rendering in parallel.
- Every round, a human audits 50 samples for reward hacking. Each hack found becomes a new check.
- **Exit:** beats the fine-tuned model on held-out requests, with no unaddressed hacks in the audit.

### Phase 7: Demo and release
- Demo app (ask → UI appears → gone → ask again → it's recognizable).
- Publish the spec and benchmark, with a short write-up.

**Later:** SwiftUI/Compose renderers, the design-system generator (OKLCH palettes, modular type scale, and so on, checked by the same verifier), and a bring-your-own-design-system importer (Figma variables / Tokens Studio).

## 5. Distribution: how other software uses Polyxd

The goal is for any app, agent or tool to adopt Polyxd one layer at a time. Each layer ships as its own package, so no one has to adopt all of it.

| Layer | Who uses it | Ships as | Channel (free) |
|---|---|---|---|
| **Spec** (schema, types, tokens format) | Anyone generating or rendering UI | `@polyxd/spec` (JSON Schema + TS types), `polyxd-spec` (Python) | npm, PyPI, docs site |
| **Design-system packs** | Apps bringing their brand | `@polyxd/ds-material3`, `@polyxd/ds-govuk`, and an importer for Figma variables / Tokens Studio | npm |
| **Web renderer** | Web apps | `@polyxd/react` (shadcn/Radix) | npm |
| **Native renderers** (later) | iOS / Android apps | Swift package, Compose library | SPM, Maven Central |
| **Runtime SDK** (generator + memory + validation + streaming) | Apps that want the whole loop | `@polyxd/runtime`, `polyxd` (Python), with pluggable model backends and memory storage | npm, PyPI |
| **Model** | Runs on-device or self-hosted | Weights in MLX, GGUF and safetensors formats | Hugging Face, Ollama library |
| **Server** | Teams that want to self-host | Docker image: model server + HTTP API with streaming | GitHub Container Registry |
| **Agent integration** | AI agents and assistants | MCP server (MCP Apps compatible), A2UI export | npm (`npx @polyxd/mcp`) |
| **Verifier and benchmark** | Anyone evaluating generative UI | `polyxd verify` CLI, dataset, leaderboard | npm, Hugging Face Datasets |
| **Demo** | Everyone | Hosted playground | Hugging Face Spaces / GitHub Pages |

**Where things run.** On-device is the default: private, free and fast. The same runtime can point at a self-hosted server or any model endpoint.

**Memory is private by default.** It's stored on the client (IndexedDB / SQLite), with storage adapters for hosts that want server-side memory. There's no telemetry.

**Our own hosted API is deferred.** It's the only piece that costs money to run. The server image makes self-hosting possible from day one, and we'll decide on a hosted API after v0.1 based on demand.

**Distribution requirements that affect the build from Phase 1:**
- **Monorepo with publishable packages from the start.** Package boundaries match the layers above (§10).
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

**Names.** The project is **Polyxd**, with the domain **polyxd.com** (bought 2026-09-19). Schema and catalog ids live under `https://polyxd.com/`. Packages are `@polyxd/*`.

## 6. Taste: how a company's designers direct it

Tokens control how things *look*. Taste goes further: how dense a screen is, how much gets emphasized, the tone of the copy, which pattern a team prefers, what to leave out, how motion feels. A designer at a company using Polyxd needs to shape all of that **without writing prompts or JSON, and without retraining a model**.

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

### Where designers do this: Polyxd Studio

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

## 7. Product layer: features, flows and metrics

With static software, a PM defines features, a designer draws the screens and flows, engineering builds them, and analytics measures funnels. When screens are generated, **PMs and designers stop drawing screens and define what sits one level above them**: what the product can do, which journeys must hold, and how success is measured. Polyxd has to make each of these explicit.

| Today | In Polyxd | Who owns it |
|---|---|---|
| Feature | **Capability**: a registered thing the product can do | PM + engineering |
| Flow / user journey | **Journey**: a goal with required checkpoints | PM + designer (+ compliance) |
| Screen | Generated UI (pattern + components) | Model, directed by the designer (§6) |
| Acceptance criteria | **Checks** run against the company's request set | PM |
| Analytics / funnels | **Automatic semantic events** + outcome metrics | PM |
| A/B test | **Experiments** on direction, patterns, journeys or model | PM + designer |

### Features become capabilities
- The model can only build UI over capabilities the product has **registered**. A registered capability has:
  - A name and a description.
  - Inputs and outputs.
  - Data sources.
  - Preconditions ("account verified").
  - Side effects.
  - A **risk level**.
- Risk level drives design automatically. For example, anything that moves money must use the confirm pattern and show a summary first.
- **Feature flags and plans** switch capabilities on or off per user, through **OpenFeature**, a standard that works with LaunchDarkly, PostHog, GrowthBook and others. A capability that's off simply can't appear.
- Capabilities are the same thing as the action intents in §2. Here they gain PM-owned metadata.

### Flows become journeys
- A journey is **a goal, required checkpoints and a done-condition**. Example: "Send money. The fee is visible before confirmation, confirmation is explicit, the receipt is shown. Done = transfer created."
- **Three levels of control:**
  - **Fixed:** exact steps, for regulated or legal flows like KYC and consent.
  - **Guided:** checkpoints are required, and the layout between them is generated.
  - **Open:** only the goal and the done-condition are fixed.
- The benchmark tasks and the agent tests in Phase 3 already use this goal/done-condition shape. **Journey specs, acceptance tests and agent tests are one format.**
- **Emergent flow map.** Paths through a product are no longer fixed, so Studio shows the paths people and agents *actually* took for each goal, along with where they dropped off.

### Metrics come built in
- Every generated UI already knows its intent, pattern, components and capabilities. So the runtime emits **standard semantic events** with no manual tracking:
  - UI shown.
  - Action taken.
  - Checkpoint reached.
  - Task completed or abandoned.
  - Error.
  - Undo.
  - "Asked again" or regenerated.
  - Optional quick feedback.
- **Core metrics:**
  - Task success rate.
  - Time and steps to complete.
  - Abandonment by step.
  - **Regeneration rate**: the user had to ask again, so the UI missed. This is new and specific to JIT interfaces.
  - **Recognition gain**: repeat tasks get faster.
  - Accessibility pass rate.
- **All metrics split by human vs. agent**, and by assistive-technology use.
- Events go to the company's own analytics (PostHog, Amplitude, Segment or OpenTelemetry) through adapters. Polyxd itself collects nothing.
- **Unmet demand.** Requests that no registered capability could serve are logged as a ranked list: "what users asked for that we can't do yet." That's a feature backlog generated from real demand.

### Acceptance criteria and experiments
- PMs write criteria in plain language ("transfer in ≤ 3 steps", "fee always before amount"). These compile into checks, like design rules do, and run on every direction, pattern or model change. Nothing ships if they fail.
- **Experiments** vary a Design Direction, a pattern, a journey or a model version. Assignment goes through the feature-flag provider, and results show in Studio against the metrics above, with guardrail metrics.

### What this changes in the build
- **Spec (Phase 1):** the capability, journey and event schemas join the spec. Phase 1 includes small example capability registries for a few domains to exercise the schemas.
- **Verifier and benchmark (Phase 3):** benchmark tasks are written as journeys. Journey-compliance checks are added, along with regeneration and recognition metrics.
- **Runtime (v0.2):** capability registry, OpenFeature flags, event emission and analytics adapters.
- **Studio (v0.3):** flow map, metrics dashboard, unmet-demand report, experiments.
- **Scope guard:** v0.1 ships only the *schemas* and the events. Dashboards and experiments wait for Studio.

## 8. Business model: open core (to review later)

Proposed 2026-09-19; not yet decided. **Everything that runs inside someone else's product is free and Apache-licensed. Studio, where a company's designers and PMs work together, is paid.**

**Free forever (open source):** spec, design-system packs, React renderer, runtime SDK, MCP server, verifier and benchmark, model weights.
- These are how people find and adopt Polyxd. "Works with any LLM, private, on-device, no telemetry" falls apart if the runtime has a paywall or usage meter.
- Per-generation pricing doesn't work anyway: on-device use has nowhere to count requests, and it punishes the heaviest users.

**Paid: Polyxd Studio (§6–7).**
- Companies buy it, not developers. Designers and PMs are budget holders.
- It's naturally multi-user and hosted: review queues, approvals, versioned publishing, rollouts, flow maps and experiments all need shared state.
- It improves with use. Approvals become exemplars and corrections become rules, so a team's Design Direction gets better over time and customers stay.

| Tier | Price | Includes |
|---|---|---|
| Free | $0 | 1 Design Direction, up to 3 editors, preview and review, local-only |
| Team | ~$30–50 per editor per month (viewers free) | Unlimited directions, publish diffs, rule suggestions, metrics dashboard, flow map, unmet-demand report |
| Enterprise | Annual, ~$25k+ | SSO/SCIM, audit log, fixed-mode journeys, gradual rollouts, experiments, managed adapter training, self-hosted Studio, SLA |

Charge per **editor**, never per end user or per generation, so the runtime stays free.

**Later:** a usage-priced hosted API (the one piece that costs money per call; deferred until after v0.1), managed adapter training (code stays open, we run it), and paid custom packs and onboarding for regulated industries (fintech, government, healthcare).

**To settle before going public:**
1. **Timing.** Nothing to sell until after v0.1 (Phase 3). Launch the verifier and benchmark first to build credibility.
2. **Where Studio lives and ships: open, decide later.** No need to split it into another repo now. Before the first public push, decide its license (Apache-2.0 can't be taken back; a source-available license such as BSL/FSL is an option) and where it's published: npm if it fits, otherwise a free alternative (GitHub Releases or GitHub Packages, a Cloudflare Pages/Workers deploy as a hosted app, or JSR).
3. **Publicly commit to what stays free:** spec, runtime, model, verifier. Projects that move features behind a paywall later lose trust.
4. **Spec governance.** If the spec is adopted, a neutral home (foundation or open RFC process) will matter to enterprises more than the license. Not needed for v0.1; plan for it.

**Where the advantage is:** owning the spec, owning the benchmark people use to compare generated UIs, and Studio being the obvious place to direct them. Pricing should protect all three.

## 9. Risks

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
| Product layer bloats v1 | v0.1 ships only schemas + events; dashboards and experiments wait for Studio |
| Regulated flows can't vary | Journeys support fixed mode for exact, audited steps |
| Embedding is abused (injection, unsafe actions) | UI-as-data, host-allowlisted intents, threat model before v0.1 |
| Breaking changes hurt early adopters | Semver, `specVersion`, migration notes; nothing public before v0.1 |

## 10. Repo layout

```
packages/
  spec/            @polyxd/spec: JSON Schema, TS types, components, patterns, mapping table
  ds-material3/    @polyxd/ds-material3 (DTCG tokens)
  ds-govuk/        @polyxd/ds-govuk
  react/           @polyxd/react: shadcn/Radix renderer
  runtime/         @polyxd/runtime: generator backends, memory, validation, streaming
  verifier/        @polyxd/verifier + `polyxd verify` CLI
  mcp/             @polyxd/mcp: MCP server
  direction/       Design Direction schema, precedence engine, rule compiler
  product/         capability registry, journeys, events, analytics + OpenFeature adapters
python/            polyxd SDK + polyxd-spec (PyPI)
model/             Python (uv + MLX): baselines, SFT, GRPO, export (MLX/GGUF)
server/            Dockerfile + HTTP API
bench/             requests, multi-turn sequences, tasks, gold set
apps/playground/   demo
                   (Studio: location and publishing decided later, see §8)
docs/              docs site, decisions, write-ups
```
TypeScript (npm workspaces, Changesets for versioning and releases) and Python (uv). GitHub Actions for CI and publishing.

## 11. Decisions made

1. **Domain-generic.** Spec, components and patterns are generic, and the benchmark spans several domains. Trade-off: a narrow domain would make the small model's job easier. If the Phase 4 baselines show the small model struggling across domains, we revisit with domain adapters, not a narrower spec.
2. **Design systems: Material 3, Carbon and Ant Design** (Carbon and Ant chosen 2026-09-19 by usage and visual contrast). Later, in order of usage: MUI, Atlassian, Fluent, Bootstrap. GOV.UK remains a source of pattern guidance.
3. **Web stack: React + Vite + shadcn/Radix.** No Next.js. The renderer is a library, so there's no server framework.
4. **No fixed timeline.** Phases are ordered by dependency and gated by exit tests.
5. **Licenses:** Apache-2.0 for code, CC-BY-4.0 for the spec and docs.
