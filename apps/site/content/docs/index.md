---
title: Introduction
description: What Polyxd is, the four ideas behind it, what exists today and what is still planned.
order: 1
section: Start
---

# Introduction

Polyxd is an open spec and runtime for **just-in-time interfaces**: UI that is generated when someone needs it, used, and then thrown away. Any generator that emits spec-valid JSON can write those interfaces: Claude, GPT, Gemini, or a model or program of your own. Polyxd ships no model.

A document doesn't have to be generated, either. Designers author screens in the same format, and they render and verify the same way. Since spec 0.3 the product's shell (the frame, app bar, navigation and footer around every screen) can be a document too, authored once per product and never generated: a generator's surfaces render inside it. See [Generated or authored](/docs/authored-screens/), and the [demos](/demos/): three products in three design systems, with generated and authored screens side by side.

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

### The generator picks meaning

The generator chooses *what* to show: which components, which pattern, which action is primary, what the labels say. It never chooses pixels, colours, fonts or control types. A `Choice` with three short options becomes a segmented control and one with twelve becomes a filterable list, but the renderer makes that call, not the generator. See [Components](/docs/components).

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
- **Data comes from the host.** The generator lays out and labels data it is given. Key figures and images must be bound to host data, so a generator cannot invent a balance or load an image.
- **The generator is swappable.** Anything that can emit spec-valid JSON can drive the renderer: a hosted LLM, a local model, a template, or code.

## What's in the box today

Everything is on npm under the [`@polyxd`](https://www.npmjs.com/org/polyxd) scope, from one [open-source monorepo](https://github.com/visualfart/polyxd).

| Package | What it does |
|---|---|
| `@polyxd/spec` | JSON Schema and TypeScript types for UI documents; 44 semantic components, five of them the authored-only shell; 6 core patterns and a shared check vocabulary; the semantic token contract; schemas for capabilities, journeys, analytics events and Design Direction; a validator (`polyxd-validate`); example documents across six domains |
| `@polyxd/react` | React renderer for all 44 components, built on Radix primitives and styled only by token CSS variables, with theme CSS for every pack |
| `@polyxd/ds-*` | Thirteen design-system packs as DTCG tokens: Material 3, Carbon, Ant Design, Fluent 2, shadcn/ui, Bootstrap 5, Mantine, Radix Themes, Shopify Polaris, GitHub Primer, Adobe Spectrum 2, GOV.UK Frontend and Chakra UI |
| `polyxd` | The `polyxd pack` command, which makes a pack from your own tokens. See [Your design system](/docs/your-design-system) |
| `@polyxd/a2ui` | Exports UI documents to A2UI v1.0 (release candidate) messages, with a Polyxd A2UI catalog |
| `@polyxd/verifier` | The `polyxd-verify` CLI and library: document checks, rendered accessibility and layout checks, scripted agent tasks, and a consistency score |

The repository also holds the benchmark (`bench/`: 50 requests, multi-turn sequences, agent tasks and a gold set) and the [gallery](/gallery/).

## Status

Polyxd is an **early preview**. The spec is at `specVersion` 0.3 and may still change in breaking ways before v1.0.

| Phase | Status |
|---|---|
| 0: Setup and grounding | Done |
| 1: Spec v0 | Done |
| 2: Web renderer and theming | Done |
| 3: Verifier and benchmark | In progress. The verifier is done; the benchmark is in progress |
| 4–6: Generator experiments | Paused |
| 7: Demo and release | Done: [three demo products](/demos/), packages at 0.2 |

**There is no bundled model.** Today you write or generate UI documents with any generator, validate them, render them in thirteen design systems, and verify them. See the [roadmap](/docs/roadmap).

## Next steps

- [Quickstart](/docs/quickstart): render, validate and verify a document.
- [UI documents](/docs/ui-documents): how a document is put together.
- [Components reference](/docs/reference/components): every component and its props.
