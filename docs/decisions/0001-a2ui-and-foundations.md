# 0001 — A2UI and foundations (Phase 0 decision note)

- **Status:** Accepted (2026-09-19)
- **Date:** 2026-09-19
- **Scope:** Protocol base (A2UI vs own schema), token format and tooling, Material 3 token source, preprint claims, Phase 4 base models.
- **Method:** Web research on primary sources (specs, repos, arXiv, npm/PyPI/Hugging Face metadata) on 2026-09-19. Package versions were read from the registries. Some claims come from secondary summaries and are marked as such.

## Decision (TL;DR)

**Option (b): Polyxd defines its own schema as the source of truth, and exports to A2UI (and MCP Apps).** The Polyxd component layer should still be a strict *superset-by-design* of A2UI: A2UI-shaped envelope, flat adjacency list, JSON Pointer bindings, `event {name, context}` actions, a catalog-style component registry. That way the A2UI export is a near-lossless projection rather than a translation. Re-evaluate once A2UI v1.0 is final (see open questions).

## 1. Generative-UI protocols

### A2UI (Agent-to-User Interface)
- **Status and version:** v0.9.1 is the "production" release. **v1.0 is a release candidate.** The project still calls itself an "early stage public preview" whose spec is "still evolving." v0.9 was announced in July 2026 (InfoQ, 2026-07). v1.0 is **backward-incompatible** with v0.9. ([repo](https://github.com/a2ui-project/a2ui), [site](https://a2ui.org/), [v1.0 RC spec](https://a2ui.org/specification/v1.0-a2ui/), [InfoQ](https://www.infoq.com/news/2026/07/google-a2ui-genui/))
- **License and governance:** Apache-2.0. Created by Google with CopilotKit and others, and moved from `google/A2UI` to the `a2ui-project` GitHub org. I found no foundation or formal governance charter.
- **Format:** Streamed JSON messages (JSONL, WebSocket or SSE), one message type per envelope, each with a `"version"`. v1.0 messages are `createSurface` (which can now inline `components` and `dataModel`), `updateComponents`, `updateDataModel`, `deleteSurface`, `callRendererFunction` and `agentFunctionResponse`. In the other direction the renderer sends `action`, `callAgentFunction`, `rendererFunctionResponse` and `error`.
- **Components:** A flat adjacency list `{id, component: "Button", ...props}`, where children are referenced by id and `id: "root"` mounts the surface. Templated lists use `children: {path, componentId}`. Renderers must tolerate forward references, which is what makes progressive streaming work.
- **Catalogs:** `catalog.json` is a JSON Schema document with `catalogId` (a URI), `protocolVersion`, `instructions` (Markdown guidance for LLMs), `components` (name → schema with `component: {const}`), `functions` (name → schema with `returnType` and `allowedCallers`), and optional `allowedParents`/`allowedChildren`. v1.0 adds per-component `catalogId` so catalogs can be mixed, with no fallback. The **Basic catalog** (Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Divider, Modal, Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput) is explicitly optional. v0.9 renamed "Standard" to "Basic" to push people toward **custom catalogs mapped to their own design-system components**. ([basic catalog guide](https://a2ui.org/specification/v1.0-basic-catalog-implementation-guide/))
- **Data binding:** RFC 6901 JSON Pointers, absolute or template-relative. Values can be `Dynamic*` types (literal, `{path}` or `{call}`). Inputs update the local model two-way, and the model syncs to the agent on actions (`sendDataModel`).
- **Actions:** `action.event {name, context}` goes to the agent, and `action.functionCall` runs catalog-declared client functions such as `openUrl`, validation or formatting. The host decides what functions exist.
- **Safety:** Data, not code. The client only renders from pre-approved catalogs.
- **Theming:** v0.9 had theme fields (e.g. `primaryColor`). The v1.0 RC **removes hard-coded branding**, defers visual style to the renderer's native theme, and adds semantic `variant` props. There are **no tokens in the protocol.** A secondary source says `theme` was renamed `surfaceProperties`; I could not confirm this in the spec text.
- **Accessibility:** v1.0 adds a per-component `accessibility {label, description, live, hidden}` block that renderers MUST map to ARIA or Flutter `Semantics`. There are no roles, landmarks, task semantics or agent affordances beyond this.
- **Renderers:** Official ones are Lit, Angular, React and Flutter (GenUI SDK), with a shared web-core. SwiftUI and Compose are on the roadmap. Community renderers exist: Compose (`lmee/A2UI-Android`), React/shadcn/Radix (`@a2ui-sdk/react`, `ai-kit-a2ui`) and React Native. npm has `@a2ui/react` 0.11.1 and `@a2ui/lit` 0.11.0 (2026-09-12), and PyPI has `a2ui-agent-sdk` 0.6.0, which does partial-output "healing" for streaming. ([renderers](https://a2ui.org/ecosystem/renderers/))
- **Transports:** A2A, AG-UI and MCP.

### MCP Apps (SEP-1865)
- Stable since **2026-01-26** as an official MCP extension. `@modelcontextprotocol/ext-apps` is at 2.0.0 on npm (2026-09-17). Supported by Claude, VS Code, Goose, Postman, and adopted by OpenAI (per secondary reports). ([spec](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx), [SEP](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp))
- **Model:** A predeclared `ui://` resource of type `text/html;profile=mcp-app`, rendered in a **sandboxed iframe**, talking JSON-RPC over `postMessage` (`tools/call`, `ui/message`, `ui/update-model-context`, …).
- **Safety:** This is **code** (HTML/JS), contained by the iframe sandbox and a CSP (`default-src 'none'` by default, declared domains only). It is not "UI as data."
- **Theming:** The host passes about 60 standardized CSS variables in `HostContext.styles.variables`, covering colors, type, borders and shadows. This is a useful target for mapping our semantic tokens.
- **Streaming:** `ui/notifications/tool-input-partial` (best effort), then `tool-input`.
- **Accessibility:** Left to the app's HTML. The spec defines nothing.
- **For Polyxd:** Export by shipping a single prebuilt `@polyxd/react` bundle as the `ui://` resource, with the generated UI JSON as tool input. The generated content stays data and only our renderer is code.

### Vercel AI SDK / json-render
- AI SDK is at `ai` 7.0.107. **AI SDK RSC (`streamUI`) development is paused.** Vercel recommends AI SDK UI (typed tool parts rendered by the app's own React components). That is generative UI as "tool call → developer-written component," not a portable format. ([RSC docs](https://ai-sdk.dev/docs/ai-sdk-rsc/overview))
- **`json-render`** (vercel-labs, Apache-2.0, `@json-render/core` 0.21.0) has more traction. It uses a flat `{root, elements}` map, a Zod catalog, `$state`/`$cond`/`$computed` expressions, JSON-Patch streaming, and many renderers (React, Vue, Svelte, RN, PDF, email…). It is data, not code. It has no tokens and no accessibility model. ([repo](https://github.com/vercel-labs/json-render))

### Microsoft Adaptive Cards
- Schema 1.6 is current, but Teams and several hosts cap at 1.5. There has been no major version for years. It is data, not code. Theming is through host-controlled "HostConfig". Accessibility uses `altText`, `label`, `speak`, `isRequired` and similar. Actions (`Action.Submit`/`Execute`/`OpenUrl`) are host-bound. **There is no streaming or incremental update.** It still matters for M365/Copilot, but it is not where the generative-UI momentum is. ([learn.microsoft.com](https://learn.microsoft.com/en-us/microsoft-copilot-studio/adaptive-cards-overview))

### Others with traction in 2025–26 (not deeply verified)
- **AG-UI** (CopilotKit) is an agent↔frontend *event* protocol that carries A2UI. It is not a component format.
- **OpenAI Apps SDK** is converging on MCP Apps.
- **Oracle Agent Spec** is named by InfoQ as a competitor. I did not review it.

**Cross-cutting gap:** None of these formats carries design tokens, task or journey semantics, capability risk levels, or consistency memory. A2UI v1.0's `accessibility` block is the most complete a11y model among the data formats, and it is still thin compared with what Polyxd needs.

## 2. Material 3 design tokens
- **Tiers:** M3 uses three official tiers: `md.ref.*` (reference/primitive palettes and typefaces), `md.sys.*` (system/semantic: color roles, typescale, shape, elevation, motion, state) and `md.comp.*` (component, e.g. `md.comp.fab.primary.container.color`). This maps 1:1 onto Polyxd's primitive → semantic → component. ([m3 tokens](https://m3.material.io/foundations/design-tokens/overview). I could not render this page; the tier names were confirmed via the material-web file names.)
- **No official DTCG export found.** The machine-readable sources are:
  - **Material Web** (`@material/web` 2.5.0, Apache-2.0, **in maintenance mode "pending new maintainers"**, though Google still commits to it in Sept 2026). `tokens/versions/v0_192/sass/_md-{ref,sys,comp}-*.scss` are **auto-generated from Google's internal token set**, with a README warning that they can break on any minor or patch release. ([repo](https://github.com/material-components/material-web))
  - **material-color-utilities** (Apache-2.0; `@material/material-color-utilities` 0.4.0, Jan 2026) generates HCT tonal palettes and dynamic-color schemes for `sys.color` roles, including contrast levels. ([repo](https://github.com/material-foundation/material-color-utilities))
  - **Material Theme Builder** exports "Material Theme (JSON)" in its own schemes/palettes format, not DTCG, with a known palette/scheme mismatch bug (#308). ([repo](https://github.com/material-foundation/material-theme-builder))
- **License:** The code sources are Apache-2.0. The M3 *guidelines site* content has its own terms (not checked). We should derive tokens from the Apache-2.0 code, not by scraping the site.
- **Recommendation:** Build `@polyxd/ds-material3` by (1) generating `ref` and `sys.color` with material-color-utilities from a seed color, and (2) transcribing `sys` typescale, shape, motion and state plus the `comp` tokens we need from the material-web `v0_192` SCSS into DTCG JSON with a small one-off converter. Pin the source version and record provenance in `$extensions`.

## 3. W3C DTCG format and tooling
- **Spec:** The **Design Tokens Format Module 2025.10 is the first stable release** (Final Community Group Report, 2025-10-28). It is not on the W3C standards track. A separate **Resolver Module 2025.10** handles themes, modes and sets. Key features: `$value`, `$type`, `$description`, `$extensions`, `$deprecated`, `{alias}` and `$ref` JSON-Pointer references, group `$extends`/`$root`, structured `color` (`colorSpace` + `components`, so OKLCH is possible) and `dimension` (`{value, unit}`) objects, plus the composite types typography, shadow, border, transition and gradient. ([format](https://www.designtokens.org/tr/2025.10/format/), [announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/))
- **Style Dictionary:** **5.5.4** (published 2026-09-18). DTCG is the base format, but **2025.10 support is still partial** ([issue #1590](https://github.com/style-dictionary/style-dictionary/issues/1590), open). Color, border, shadow and dimension are done. Gradient and duration/motion are in progress. **The resolver module is not addressed.**
- **Terrazzo:** `@terrazzo/cli` 2.7.1 (Aug 2026) is a DTCG-native alternative. I did not verify its 2025.10 or resolver coverage.
- **Tokens Studio:** It reads and writes DTCG. `@tokens-studio/sd-transforms` is 2.0.3 (Jan 2026). I did not verify its 2025.10 coverage.
- **Recommendation:** Author tokens in **DTCG 2025.10**, and restrict ourselves to the subset Style Dictionary 5 handles today (color objects, dimension objects, aliases, typography, shadow, border). Model light/dark/contrast as **separate token sets selected by our own small resolver** until SD supports the Resolver Module. Validate token files with our own JSON Schema in CI. Keep Terrazzo as the fallback if SD's 2025.10 gaps block us. Put the Figma-variables / Tokens Studio importer in "later," as the plan already says.

## 4. Preprints
All three items were checked against the arXiv HTML full text and the arXiv API metadata.

- **Maru** exists. [arXiv:2608.25565](https://arxiv.org/abs/2608.25565), Kim, Choi, Min, Yi, Jiang, Juho Kim (KAIST KIXLAB), UIST '26, submitted 2026-08-26.
  - **Claim:** Persisting user-constructed **Information Architecture** (partition, hierarchy, order, vocabulary) as rules keeps generated UIs aligned across a session.
  - **Setup:** The UIs are React components in 9 layout types. The study had **N=12**, a within-subjects design against a baseline, and two tasks plus one free task.
  - **Numbers:** Approval went 74%→61% across the session for Maru versus 71%→33% for the baseline. Satisfactory output took 5.58 versus 7.75 generations (p=.008). Maru UIs were 2.08× more likely to be accepted (95% CI 1.25–3.47). The study produced 838 rules, 76% of them inferred from UI interactions, and 94% of the rules that got explicit feedback were accepted.
  - **Caveat:** The participants with the most rules (~195) gave the *lowest* approval (33–50%), so rule accumulation needs pruning.
  - **Code:** The paper says the code is open source (`github.com/kixlab/Maru`), but **the GitHub API returned 404 today**.
  - **Relevance to Polyxd:** This is direct support for deterministic interface memory. Its four IA elements are a good schema for our memory records.
- **Affora** exists. [arXiv:2609.19125](https://arxiv.org/abs/2609.19125), Jin Gao (independent), 2026-09-16, a single-author preprint with no peer review.
  - **Claim:** A design system plus **executable checks** (component S1–S8, flow FC1–FC8, site K1–K3) makes UIs reliable for computer-use agents without constraining the visuals.
  - **Numbers:**
    - Semantic HTML reached 91% agent success versus 68.3–86.7% across 9 component libraries. Fixing semantics took success 43%→67%→90%.
    - Across 16 themes × 6 layouts, DOM-channel completion stayed at 99.5%.
    - Transfer to other interfaces was mixed. WebShop went from 8% (published rules) to 68% (extended coverage). shadcn-admin with unpredictable labels went 23%→64%. MUI went 79%→81%. Magento showed no gain.
    - In a workflow case, actions fell 21–40% and tokens fell 24–41%.
  - **Caveats:** The agent names ("Luna", "Terra") are as reported, and I could not identify them. I found no code repository.
  - **Relevance to Polyxd:** It directly informs the verifier's agent semantics and its checks. It also finds that confirmation steps and multi-step forms *add* agent cost, which matters for our pattern choices.
- **Harness4GenUI is not a preprint.** It is the **1st Workshop on Harness Engineering for Generative UI** at ASE 2026, Munich, Oct 12–16 2026 ([site](https://conf.researchr.org/home/ase-2026/harness4genui-2026)). The workshop accepted 3 papers. The relevant one is **"Toward Frontier-Quality Declarative UI Generation at Small-Model Cost"** ([arXiv:2609.04184](https://arxiv.org/abs/2609.04184), Amazon).
  - **Setup:** LoRA SFT for **A2UI** generation on Qwen3.5 0.8B/2B/4B and SmolLM 3B, with 86- and 47-component catalogs and ~1.5k training pairs.
  - **Numbers:** A 4B student recovers **~98% of teacher semantic and ~97% of teacher visual quality** at under 1/10 of the cost. Perturbed-catalog augmentation (shuffle, dropout, 20% renames) Pareto-dominates. Path-binding correctness is 88–98%. Latency is ~8.1 s per request at 4B, which is **far over our 1 s first-render budget** unless we stream.
  - **Caveats:** It uses no grammar-constrained decoding, and it releases no code or data. If "Harness4GenUI" was meant to point at a specific paper, that attribution is unverified.
  - **Relevance to Polyxd:** This is the closest prior work to Phase 5. Adopt perturbed-catalog augmentation. Compare against it rather than claim novelty for "small model + A2UI".

## 5. Base models and MLX tooling

**Licenses checked on Hugging Face (2026-09-19):**

| Model | Size | License | Notes |
|---|---|---|---|
| Qwen3.5-2B / 4B / 9B | 2B, 4B, 9B dense | Apache-2.0 | Released Feb–Mar 2026. Native vision, hybrid thinking, 262K ctx. 4B is the paper's best student. |
| Gemma 4 E2B / E4B | ~2.3B / ~4.5B effective | **Apache-2.0** (a first for Gemma) | Released Apr 2026. Multimodal and audio. |
| Ministral 3 3B / 8B | 3B, 8B | Apache-2.0 | Dense. |
| Granite 4.1 3B / 8B | 3B, 8B | Apache-2.0 | Released Apr 2026. Strong tool calling (secondary sources). |
| SmolLM3-3B | 3B | Apache-2.0 | Fully open data and recipe. Used in the paper. |
| Phi-4-mini | 3.8B | MIT | Released Feb 2025, so it is older. |

Newer Qwen releases (3.6 and 3.8, per secondary sources) appear to be 27B and above, with no new small dense models. I did not verify this.

**Recommended Phase 4 slate:**
- **Small tier:** Qwen3.5-4B (primary), Gemma-4-E4B, Granite-4.1-3B, Qwen3.5-2B (floor).
- **Mid tier:** Qwen3.5-9B, Ministral-3-8B, Granite-4.1-8B.
- **Teacher:** A ~14B–31B open model that fits in 24 GB at 4-bit. Gemma-4-31B is too tight on 24 GB, so pick a ~14B at the time.

The 2.5 GB at 4-bit target favours 3–4B models.

**mlx-lm** (0.31.3, MIT; I inspected the source):
- `mlx_lm.lora` supports `--fine-tune-type lora|dora|full` and trains on quantized models (QLoRA-style).
- The tuner has **no built-in DPO or GRPO**. The losses module only has KL and JS divergence (useful for distillation). GRPO will need a custom loop or a third-party package.
- There is **no built-in JSON-schema or grammar decoding**. Instead, `generate`/`stream_generate` accept `logits_processors`, and the server wires them through.
- **Outlines** (1.3.3, Apache-2.0) has an official `outlines.from_mlxlm` backend with JSON-schema/CFG output types, which is the lowest-risk path.
- **llguidance** (1.8.0, MIT; best JSON-Schema coverage per JSONSchemaBench) and **XGrammar** (0.2.7, Apache-2.0; supports Metal via `xgrammar[metal]`) list **no official MLX integration**. Using either means computing token masks ourselves and applying them via `logits_processors`. That is feasible but unverified for throughput.
- **mlx-vlm** (0.7.1) exists if we ever condition generation on screenshots.

## 6. Recommendation and reasoning

**Chosen option: (b), our own schema as source of truth, with A2UI v1.0 and MCP Apps as export targets.** Reasoning tied to Polyxd's needs:

1. **Stability.** A2UI is pre-1.0 and has just made a breaking v0.9 → v1.0 change (theme removed, function model rewritten). Plan §8 already names "A2UI changes under us" as a risk. Owning the schema lets us version with `specVersion` and semver on our own terms, while an exporter absorbs A2UI churn.
2. **Three-tier tokens.** A2UI deliberately has no tokens (v1.0 defers style to the native theme). Our tokens live beside the UI JSON anyway, so there is no conflict. But our components need `variant`/emphasis semantics tied to *our* semantic tokens, and our verifier checks token-only values. None of that exists in A2UI.
3. **Design Direction, capabilities, journeys, events.** Profile, voice, rules, exemplars, capability risk levels, journey checkpoints and semantic analytics events are all outside A2UI's scope. Hanging them off A2UI would mean vendor extensions on every object. As first-class schema they can be validated and used in constrained decoding.
4. **Consistency memory.** Maru's evidence argues for persistent structure (partition, hierarchy, order, vocabulary) carried across generations. That needs stable semantic identities (pattern ids, slot roles, stable component keys) that A2UI's surface-local `id`s do not provide.
5. **Agent and a11y semantics.** A2UI's `accessibility` block is a minimum. Affora shows that agent success depends on named, enumerable, recoverable interaction semantics. We need roles, task and done semantics, and state recoverability in the core schema.
6. **Native renderers and ecosystem reach.** A2UI's value is reach: Flutter, Lit, Angular, React, and planned SwiftUI and Compose, plus A2A, AG-UI and MCP transports. We get that reach through a **faithful export**, not by making A2UI our internal model. Custom catalogs are the officially endorsed path, so our export is a Polyxd A2UI catalog (`catalogId: https://polyxd.com/catalog/…`) whose `instructions` carry our usage rules.
7. **Why not (a)?** Extending A2UI's catalog directly would tie the internal representation, the training data and the constrained-decoding grammar to a moving RC. Every A2UI break would then mean regenerating training data and retraining.

**To keep export cheap, mirror A2UI's shapes internally:**
- Use a flat adjacency list with `id`/`component`.
- Use JSON Pointer bindings with the `{path}` form.
- Use `action: {event: {name, context}}`, where `name` is our capability intent (e.g. `transfer.confirm`).
- Put the same a11y fields under `accessibility`, with our additions next to them.
- Use message-style streaming (`createSurface`, `updateComponents`, `updateDataModel`).
- Make every component name UAX #31-valid.

**Exit test for the exporter (Phase 1):**
- All 20 example UIs round-trip to A2UI v1.0 and validate against the official catalog schema.
- They render in the official React renderer using our exported catalog.
- The lossy fields (direction, journey and memory metadata) are listed explicitly.

**MCP Apps:** Ship `@polyxd/mcp`. Its `ui://` resource is our renderer bundle, the UI JSON travels as tool input, and our semantic tokens map onto the ~60 MCP host CSS variables so the UI inherits host theming.

**Token tooling:**
- Author in DTCG 2025.10 using the Style Dictionary 5–compatible subset.
- Build with Style Dictionary 5.x to CSS variables.
- Handle modes with our own resolver for now.
- Seed M3 from material-color-utilities plus the material-web `v0_192` SCSS.
- Keep Terrazzo as a fallback.

## 7. Open questions / unverified
- A2UI v1.0 **final** release date, and whether the RC's `theme` → `surfaceProperties` rename and the `actionResponse` naming (reported by secondary sources) match the final spec. The spec text I read shows `callRendererFunction`/`agentFunctionResponse` instead.
- A2UI governance: I found no neutral foundation, and the project is still Google-led. There is no stated stability or compatibility policy for post-1.0.
- The official A2UI SwiftUI and Compose renderer timelines. Only community Compose and React Native renderers exist today.
- The M3 guideline site's content license, and whether Google publishes an official DTCG or JSON token set. I found none. The m3.material.io page did not render for me.
- Whether material-web's maintenance-mode status will freeze `v0_192` tokens relative to M3 Expressive updates.
- Coverage of DTCG 2025.10 and the Resolver Module in Terrazzo and Tokens Studio. I did not test either.
- Throughput of llguidance or XGrammar masks through mlx-lm `logits_processors` on an M5. This needs a spike in Phase 4.
- The Maru code repo (404 today). The Affora agent identities and code. Whether "Harness4GenUI" referred to a specific paper other than arXiv:2609.04184.
- All preprint numbers are the authors' own, and none are peer-reviewed except Maru (UIST '26). Per plan §8, rely only on results we reproduce.
- Small-model rankings (Granite and Ministral versus Qwen and Gemma) come from secondary blogs. Phase 4 must produce our own leaderboard.
