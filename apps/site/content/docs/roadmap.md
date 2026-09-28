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
| 2 | **Web renderer and theming.** `@polyxd/react`, the theme compiler, Carbon and Ant Design packs, the gallery. Decision 0002 on Astryx | Done |
| 3 | **Verifier and benchmark.** Document, rendered, agent and consistency checks; 50 requests, 10 multi-turn sequences and a gold set | In progress. The verifier is done (20 of 20 injected defects caught). The benchmark is in progress: the requests, sequences and gold documents exist, and the designer ranking that the gold-set exit test needs is still to do |
| 4–6 | **Generator experiments.** Baselines and tuning of small local models, scored by the verifier | Paused. Polyxd ships no model; any generator that emits spec-valid JSON drives it |
| 7 | **Demo and release.** A demo app (ask, a UI appears, it goes away, ask again, it's recognisable), and publishing the spec and benchmark with a write-up | Planned |

Polyxd does not depend on a model of its own. The spec, renderer and verifier work with any generator, and the verifier is what lets you compare generators on equal terms.

**Later:** SwiftUI and Compose renderers (the spec already maps every component to both), a design-system generator, and an importer for Figma variables and Tokens Studio.

### Release milestones

| Release | After | Contents |
|---|---|---|
| v0.1 | Phase 3 | Spec, design-system packs, React renderer, verifier and benchmark. Works with any LLM. The first npm release |
| v0.2 | | Runtime SDK, MCP server |
| v0.3 | | Docker server, playground |
| v1.0 | | Spec frozen, then native renderers |

Before v1.0 the spec may break. Every document carries `specVersion`, releases follow semver, and breaking changes will come with migration notes.

## Distribution

Each layer is planned to ship as its own package, so nobody has to adopt all of it. Only the first rows exist today, and none is published yet.

| Layer | Planned package | Channel | Today |
|---|---|---|---|
| Spec | `@polyxd/spec`, `polyxd-spec` (Python) | npm, PyPI | `@polyxd/spec` exists. `polyxd-spec` exists in the repository (`packages/python-spec`), not yet on PyPI |
| Design-system packs | `@polyxd/ds-material3`, `ds-carbon`, `ds-antd` | npm | Exist |
| Web renderer | `@polyxd/react` | npm | Exists |
| Verifier and benchmark | `polyxd-verify` CLI, dataset | npm, Hugging Face Datasets | Verifier exists; dataset in progress |
| Runtime SDK (generator, memory, validation, streaming) | `@polyxd/runtime`, `polyxd` (Python) | npm, PyPI | Planned |
| Agent integration | MCP server (MCP Apps compatible) and A2UI export | npm (`npx @polyxd/mcp`) | A2UI export exists; MCP server planned |
| Server | Generation server and HTTP API with streaming, pointed at the model endpoint you choose | Docker image on GitHub Container Registry | Planned |
| Native renderers | Swift package, Compose library | SPM, Maven Central | Later |

The runtime is meant to point at any generator: a hosted API such as Claude, GPT or Gemini, a self-hosted server, or a model running on the device. Interface memory is meant to be stored on the client. There is no telemetry.

## Open core

The spec, design-system packs, React renderer, runtime, MCP server, verifier and benchmark are meant to be free and open: code under Apache-2.0, and the spec and docs under CC-BY-4.0. A paid Studio for teams, where designers and PMs set Design Direction, review generated UIs and publish changes, is being considered, but nothing about it is decided and it does not exist yet. The intent is that anything that runs inside someone else's product stays free, with no usage metering.
