---
title: Roadmap
description: The project phases and where each one stands, how Polyxd will be distributed, and what stays free.
order: 40
section: Project
---

# Roadmap

Polyxd has no fixed timeline. Work is split into phases ordered by dependency, and each phase has an exit test that must pass before the next one starts.

## Phases

| Phase | What | Status |
|---|---|---|
| 0 | **Setup and grounding.** Monorepo, research on A2UI, design tokens and prior work. Decision 0001: own schema, exported to A2UI and MCP Apps | Done |
| 1 | **Spec v0.** 24 components, UI schema and validator, 5 patterns and the check vocabulary, capability, journey, event and Design Direction schemas, 20 examples, the Material 3 pack, A2UI export | Done |
| 2 | **Web renderer and theming.** `@polyxd/react`, the theme compiler, thirteen design-system packs and twelve templates, the gallery; then `@polyxd/core` and the Web Components renderer `@polyxd/web`, held to each other by a conformance suite. Decision 0002 on Astryx | Done |
| 3 | **Verifier and benchmark.** Document, rendered, agent and consistency checks; 50 requests, 10 multi-turn sequences and a gold set | In progress. The verifier is done (20 of 20 injected defects caught). The benchmark is in progress: the requests, sequences and gold documents exist, and the designer ranking that the gold-set exit test needs is still to do |
| 4–6 | **Generator experiments.** Baselines and tuning of small local models, scored by the verifier | Paused. Polyxd ships no model; any generator that emits spec-valid JSON drives it |
| 7 | **Demo and release.** Four demo products (ask, a UI appears, it goes away, ask again, it's recognisable), the 0.3 release of every package then built, on npm, and Studio at studio.polyxd.com. The write-up waits on the benchmark | Done, except the write-up |

Polyxd does not depend on a model of its own. The spec, renderer and verifier work with any generator, and the verifier is what lets you compare generators on equal terms.

The [runtime SDK](/docs/runtime), `@polyxd/runtime`, the [MCP server](/docs/mcp/), `@polyxd/mcp`, and the [generation server](/docs/server/), `@polyxd/server`, are on npm since 0.4.0. The runtime generates a document with the model you choose and applies a Design Direction as it does. The MCP server lets a chat app's own model write, check and show a screen. The generation server puts the runtime behind an HTTP API with streaming, with a Dockerfile to build its image. **Next:** the Python runtime and PyPI. **Later:** SwiftUI and Compose renderers (the spec already maps every component to both), a design-system generator, and an importer for Figma variables (Studio already imports Tokens Studio, DTCG and CSS files and npm packages).

### Release milestones

| Release | After | Contents | Status |
|---|---|---|---|
| v0.1 | Phase 3 | Spec, design-system packs, React renderer, verifier. Works with any LLM. The first npm release | Released |
| v0.2 | | Authored screens, more components, the demos, Studio's first version | Released |
| v0.3 | | The shell components, `@polyxd/core`, the Web Components renderer, twelve templates, `polyxd dev` | Released |
| v0.4 | | Runtime SDK, MCP server (local and hosted at mcp.polyxd.com), generation server, precompiled spec validators, `@polyxd/verifier/static` | Released |
| v0.4.1 | | Semantic analytics events from both renderers, `@polyxd/analytics`, chart axis labels that thin themselves | Released |
| v1.0 | | Spec frozen, then native renderers | Planned |

Before v1.0 the spec may break. Every document carries `specVersion`, releases follow semver, and breaking changes will come with migration notes.

## Distribution

Each layer ships as its own package, so nobody has to adopt all of it. What exists today is on npm, except where the row says otherwise; the rest is planned.

| Layer | Planned package | Channel | Today |
|---|---|---|---|
| Spec | `@polyxd/spec`, `polyxd-spec` (Python) | npm, PyPI | `@polyxd/spec` exists. `polyxd-spec` exists in the repository (`packages/python-spec`), not yet on PyPI |
| Design-system packs | `@polyxd/ds-material3`, `ds-carbon`, `ds-antd` | npm | Exist |
| Web renderer | `@polyxd/react` | npm | Exists |
| Verifier and benchmark | `polyxd-verify` CLI, dataset | npm, Hugging Face Datasets | Verifier exists; dataset in progress |
| Runtime SDK (generator, memory, validation, streaming) | `@polyxd/runtime`, `polyxd` (Python) | npm, PyPI | `@polyxd/runtime` on npm; Python planned |
| Semantic analytics events and adapters | `@polyxd/react` and `@polyxd/web` emit them; `@polyxd/analytics` sends them to PostHog, Segment, GA4 or an endpoint | npm | `@polyxd/analytics` is on npm, and the renderers emit the events from 0.4.1 on. Amplitude and OpenTelemetry adapters are not written |
| Agent integration | MCP server (MCP Apps compatible) and A2UI export | npm (`npx @polyxd/mcp`) | A2UI export exists; the MCP server ([`@polyxd/mcp`](/docs/mcp/)) is on npm and hosted at `mcp.polyxd.com` |
| Server | Generation server and HTTP API with streaming, pointed at the model endpoint you choose | Docker image on GitHub Container Registry, and npm (`npx @polyxd/server`) | [`@polyxd/server`](/docs/server/) on npm, with a Dockerfile to build the image |
| Native renderers | Swift package, Compose library | SPM, Maven Central | Later |

The runtime points at any generator: Claude, GPT or Gemini through their APIs, or a model on your own machine or server behind an OpenAI-compatible endpoint. Interface memory is stored on the client. There is no telemetry.

## Open core

The spec, design-system packs, React renderer, runtime, MCP server, verifier and benchmark are meant to be free and open: code under Apache-2.0, and the spec and docs under CC-BY-4.0. [Studio](/docs/studio) exists for teams (hosted at studio.polyxd.com, free for one workspace, and source-available under the Functional Source License to run yourself): design systems, what generated screens may use, rules, whole Design Directions (edited, versioned and fetched by key), authored screens and delivery, and Insights: how each screen does in a team's product, counted from the semantic events the product sends. Reviewing generated screens there is planned. Paid plans for bigger teams are planned and will be published before they start; one workspace stays free. The intent is that anything that runs inside someone else's product stays free, with no usage metering.
