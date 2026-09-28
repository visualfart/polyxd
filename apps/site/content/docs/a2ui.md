---
title: Export to A2UI
description: Exporting Polyxd UI documents to A2UI v1.0 messages with a custom Polyxd catalog, what is lossy, and why Polyxd keeps its own schema.
order: 21
section: Guides
---

# Export to A2UI

[A2UI](https://a2ui.org/) (Agent-to-User Interface) is an open protocol for agents to send UI to renderers as streamed JSON messages. `@polyxd/a2ui` exports any Polyxd UI document to **A2UI v1.0** messages, so Polyxd surfaces can travel over A2UI transports (A2A, AG-UI, MCP) and, eventually, be drawn by A2UI renderers.

The target is v1.0 as a **release candidate**: the official schemas at a2ui-project/a2ui commit `04e6f07` (2026-09-18), vendored unmodified in `packages/a2ui/vendor/`.

## Exporting

```ts
import { exportToA2UI, createValidator, checkComponentTree } from "@polyxd/a2ui";

// One createSurface message with components and dataModel inline
const { messages, lossy, idMap } = exportToA2UI(doc);

// Streamed: createSurface, then updateComponents, then updateDataModel
const streamed = exportToA2UI(doc, { mode: "stream" });

// Options
exportToA2UI(doc, { surfaceId: "send-7f3a", extensions: false, sendDataModel: true });

// Validate against the official schemas
const v = createValidator();
v.message(messages[0]);          // [] when valid against agent_to_renderer.json
checkComponentTree(components);  // root exists, ids unique, references resolve
```

`lossy` lists JSON Pointers into the Polyxd document for every field A2UI can't represent. `idMap` lists renamed ids.

## How the projection works

Polyxd's document shape was designed to mirror A2UI where A2UI has an equivalent, so export is a projection rather than a translation:

| Polyxd | A2UI |
|---|---|
| `surface.id` | `createSurface.surfaceId` |
| `data` | `dataModel` (or `updateDataModel` in stream mode) |
| Flat `components` list with ids | The same adjacency list. The root component is renamed `root`, which is how A2UI mounts a surface; every reference is remapped |
| `Collection.items {path, componentId}` | A2UI templated `ChildList`, with the same relative-path scoping |
| `{ "path": ... }` bindings | Copied as they are; A2UI's `DataBinding` has the same shape |
| `action.event {name, context}` | Copied as the A2UI agent action |
| `ui.dismiss`, `ui.back`, `ui.next` | A2UI local actions: `{functionCall: {call: "dismiss" \| "back" \| "next"}}` |
| `accessibility {label, description, live, hidden}` | Copied into A2UI's `accessibility` block |

Polyxd-only metadata goes under `metadata.extensions.com_polyxd`, on the surface (`specVersion`, `title`, `intent`, `pattern`, `journey`, `dismissible`, the original root id) and on each component (`key`). Pass `extensions: false` to leave it out.

## A custom catalog

A2UI's Basic catalog is explicitly optional, and the protocol encourages custom catalogs mapped to a design system's own components. Polyxd uses one.

The rule was: a component maps to a Basic component only if every Polyxd prop has a Basic equivalent with the same meaning. **None of the 24 does.** For example, Basic `ChoicePicker` needs literal options (Polyxd options can come from data), Basic `Image` takes a URL (Polyxd media is a host-data reference), and Basic has no chart, table, stepper or comparison. So all 24 are custom components in the Polyxd catalog, with the same names and props.

The catalog is `packages/a2ui/catalog/catalog.json` (`catalogId` `https://polyxd.com/catalog/0.1/a2ui`, `protocolVersion` `1.0`). It is generated from the spec's component files, and its `instructions` carry each component's usage, rendering, accessibility and agent guidance for LLMs. Each entry records its nearest Basic analog.

## What is lossy

These fields have no A2UI representation. They are carried in the extension metadata (which A2UI renderers must ignore) and reported in `lossy`:

| Polyxd field | Why |
|---|---|
| `specVersion` | A2UI versions messages, not documents |
| `surface.title` | `createSurface` has no title |
| `surface.intent`, `surface.pattern`, `surface.journey` | A2UI has no task, pattern or journey semantics |
| `surface.dismissible` | No surface-level dismiss flag |
| Component `key` | A2UI ids are surface-local; keys are for interface memory |

Two things are dropped outright: `$schema`, and the `context` of a `ui.*` action (A2UI local function calls take no context). Everything else, including formats, `visible`, validation, options from data, tones and nested item keys, survives as props of the custom components.

## Status

- All 20 spec examples export in both modes and every message validates against the official `agent_to_renderer.json` schema. The catalog validates against `catalog_definition.json`.
- **Not yet rendered in an official A2UI renderer.** `@a2ui/react` 0.11.1 only has v0.8 and v0.9 entry points, so nothing can draw a v1.0 stream yet. Even then, a Polyxd catalog implementation on top of `@a2ui/react` would be needed.
- **No Basic-only fallback yet.** A lossy mode that flattens into Basic components, so stock renderers can show something, is not implemented.
- Re-vendoring and re-testing are needed when A2UI v1.0 is final.

## MCP Apps

MCP Apps is the MCP extension for interactive UIs: a `ui://` HTML resource that the host shows in a sandboxed iframe. [`@polyxd/mcp`](/docs/mcp/) is Polyxd's MCP server, and it ships that resource. The page is one prebuilt `@polyxd/web` bundle with every pack's theme. The document arrives in the tool result, and the page renders it in the pack the model chose. It follows the host's light or dark theme, but it does not take the host's CSS variables: the look comes from the pack. The generated content stays data; only Polyxd's renderer is code.

## Why Polyxd keeps its own schema

Decision 0001 (`docs/decisions/0001-a2ui-and-foundations.md`) chose to own the schema and export to A2UI, rather than extend A2UI's catalog directly:

1. **Stability.** A2UI is pre-1.0 and has just made a breaking v0.9 to v1.0 change. Owning the schema lets Polyxd version with `specVersion` and semver, while the exporter absorbs A2UI churn. Training data and the constrained-decoding grammar don't have to be regenerated each time A2UI changes.
2. **Tokens.** A2UI deliberately has no design tokens. Polyxd's components need emphasis and tone semantics tied to its semantic tokens, and its verifier checks token-only values.
3. **Product semantics.** Design Direction, capability risk levels, journeys and analytics events are outside A2UI's scope. As first-class schema they can be validated and used in constrained decoding.
4. **Memory.** Consistency across generations needs stable semantic keys and pattern ids, which A2UI's surface-local ids don't provide.
5. **Agent semantics.** A2UI's `accessibility` block is a minimum. Polyxd needs roles, task and done semantics, and recoverable state in the core schema.

Reach comes through a faithful export instead: A2UI's renderers (Lit, Angular, React, Flutter) and transports become available without making A2UI the internal model.
