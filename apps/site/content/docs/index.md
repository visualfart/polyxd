---
title: Introduction
description: What Polyxd is, the four ideas behind it, what exists today and what is still planned.
order: 1
section: Start
---

# Introduction

Polyxd is an open spec and runtime for **just-in-time interfaces**: UI that is generated when someone needs it, used, and then thrown away. A small on-device model to generate those interfaces is planned.

A just-in-time interface is not code. It is a **UI document**, a small JSON file that lists semantic components ("a choice", "a confirmation", "a table") bound to data your app provides. A renderer turns that document into native components in your design system, and a verifier checks it before anyone sees it.

```
request ──► generator (any model that emits spec-valid JSON)
                      │  UI document (semantic only)
                      ▼
              renderer (@polyxd/react, themed by a design-system pack)
                      │
                      ▼
              verifier (polyxd-verify) → score
```

## Four ideas

### The model picks meaning

The generator chooses *what* to show: which components, which pattern, which action is primary, what the labels say. It never chooses pixels, colours, fonts or control types. A `Choice` with three short options becomes a segmented control and one with twelve becomes a filterable list, but the renderer makes that call, not the model. See [Components](/docs/components).

### Your design system picks the look

Every visual value comes from a design-system pack's semantic tokens. Swap Material 3 for IBM Carbon or Ant Design and the same document renders in that system, with no change to the JSON and no retraining. See [Design systems](/docs/design-systems).

### Built for people and agents

Every component carries accessibility semantics: roles, names, headings, live regions. The same accessibility tree that a screen reader uses is what an AI agent uses to operate the UI. The verifier proves this by completing tasks through the accessibility tree alone. See [People and agents](/docs/people-and-agents).

### Verified before it ships

A document is checked against the schema, structural rules, the pattern it declares, the capabilities it triggers, and any design or product rules. It is then rendered in every design system, mode and width and audited with axe-core, and scripted agent tasks are run against it. See [Verifier](/docs/verifier).

## Contract rules

These rules make a Polyxd surface safe to embed in other software:

- **UI is data, never code.** A document contains no scripts, no URLs to load and no styles.
- **Actions are declared intents.** A button emits `{"event": {"name": "transfer.confirm", ...}}`. Your app decides what that does.
- **Data comes from the host.** The model lays out and labels data it is given. Key figures and images must be bound to host data, so a model cannot invent a balance or load an image.
- **The generator is swappable.** Anything that can emit spec-valid JSON can drive the renderer: a hosted LLM, a local model, a template, or code.

## What's in the box today

All packages live in one monorepo. None is published to npm yet; they are coming to npm with v0.1.

| Package | What it does |
|---|---|
| `@polyxd/spec` | JSON Schema and TypeScript types for UI documents; 25 semantic components; 6 core patterns and a shared check vocabulary; the semantic token contract; schemas for capabilities, journeys, analytics events and Design Direction; a validator; 20 example documents across six domains |
| `@polyxd/react` | React renderer for all 25 components, built on Radix primitives and styled only by token CSS variables; a theme compiler |
| `@polyxd/ds-material3` | Material 3 design-system pack (DTCG tokens, light and dark) |
| `@polyxd/ds-carbon` | IBM Carbon pack (White and Gray 100 themes) |
| `@polyxd/ds-antd` | Ant Design pack (light and dark) |
| `@polyxd/a2ui` | Exports UI documents to A2UI v1.0 (release candidate) messages, with a Polyxd A2UI catalog |
| `@polyxd/verifier` | The `polyxd-verify` CLI and library: document checks, rendered accessibility and layout checks, scripted agent tasks, and a consistency score |
| `bench/` | 50 single-turn requests, 10 multi-turn sequences, agent tasks, and a 30-document gold set |
| `apps/gallery` | Every example in every pack, mode and width, with an action log |

## Status

Polyxd is an **early preview**. The spec is at `specVersion` 0.1 and may still change in breaking ways before v1.0.

| Phase | Status |
|---|---|
| 0: Setup and grounding | Done |
| 1: Spec v0 | Done |
| 2: Web renderer and theming | Done |
| 3: Verifier and benchmark | In progress. The verifier is done; the benchmark is in progress |
| 4–7: Model baselines, fine-tuning, RL, demo and release | Planned |

**The small model does not exist yet.** Today you can write or generate UI documents with any tool, validate them, render them in three design systems, and verify them. Training and releasing the model are Phases 4 to 7. See the [roadmap](/docs/roadmap).

## Next steps

- [Quickstart](/docs/quickstart): render, validate and verify a document.
- [UI documents](/docs/ui-documents): how a document is put together.
- [Components reference](/docs/reference/components): every component and its props.
