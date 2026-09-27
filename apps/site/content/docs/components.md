---
title: Components
description: The 44 semantic components, what "semantic" means, how the renderer turns meaning into concrete controls, and the shell components a person authors.
order: 11
section: Concepts
---

# Components

> Looking for how your design system's components map onto these? See [All components](/docs/reference/coverage/): every component in 13 systems, and what Polyxd calls it.

Polyxd has 44 components. Each one describes **what something is for**, not what it looks like. The generator picks components; the renderer and the design-system pack decide how they appear on each platform. Five of them, the shell components, are picked by a person, never by a generator: see [Shell](#shell).

For every component's props, usage rules, accessibility requirements and platform mappings, see the generated [components reference](/docs/reference/components). This page explains the ideas behind them.

## By category

| Category | Components |
|---|---|
| Shell | `Frame`, `AppBar`, `Footer`, `Outlet`, `Custom`. Authored only: they belong in a shell document, one per product, and a generator never writes them |
| Structure | `Section`, `Group`, `Card`, `Columns`, `Split`, `Disclosure`, `Views`, `Navigation`, `Panel` |
| Content | `Text`, `Metric`, `DetailList`, `Collection`, `Table`, `Chart`, `Media`, `Tag`, `Identity`, `Tree`, `Progress`, `Code` |
| Feedback | `Status` |
| Input | `TextInput`, `Choice`, `Toggle`, `DateInput`, `RangeInput`, `Form`, `FilterPanel`, `Rating`, `FileInput`, `ColorInput`, `CodeInput` |
| Action | `Action`, `ActionBar`, `ActionMenu` |
| Flow | `Steps`, `Confirm`, `Comparison` |

Spec v0.2 added eleven of these (`Tag`, `Identity`, `Tree`, `Progress`, `Rating`, `Code`, `FileInput`, `ColorInput`, `CodeInput`, `Panel`, `ActionMenu`) and variants on the rest, after a survey of every component in 13 design systems: [design-system coverage](/docs/reference/coverage/). Spec v0.3 added the five shell components, `Columns` and `Split`, and `Navigation.placement`.

The source of truth is `packages/spec/components/*.json`. The UI schema, the A2UI catalog and the reference page are all generated from those files.

## Shell

A product has one frame around all its screens: the app bar, the main navigation, a footer, maybe a banner above everything and a column beside the content. Until v0.3 that frame stayed in code. Now it can be a document too, so it renders in the same design system as the screens inside it and is verified by the same rules.

The shell components are:

- **`Frame`**: the regions, in reading order `banner`, `header`, `navigation`, `main`, `aside`, `footer`. It adds the skip link and the landmarks.
- **`AppBar`**: the bar at the top: title, a leading action, search (a search `TextInput` or a command-palette `Action`), an `ActionBar` of trailing actions and the account (an `Identity` or an `ActionMenu`).
- **`Footer`**: link groups under headings, the legal line, and something at the end of it (a locale `Choice`, a `Tag`, a `Text`).
- **`Outlet`**: where the current screen renders. The host fills it with a screen document or a generated surface.
- **`Custom`**: a slot for a component the host implements itself, named like `brand.logo`, with props and a `fallback` the renderer can draw when the host has no such component.

`Navigation` is not a shell component (a surface may carry its own), but its `placement` (`auto`, `side`, `rail`, `bar`, `drawer`) is read only when it is a `Frame`'s navigation.

The rule that keeps the shell safe: **shell components appear only in a shell document**, one whose `surface.kind` is `"shell"` and whose `surface.origin` is `"authored"`. A generator never writes a shell, and never sees these components in its prompt or in the A2UI catalog's instructions. The validator enforces it with errors:

- a shell component in a surface: *Frame belongs in a shell document: set surface.kind to "shell"*;
- a shell that isn't authored: *a shell is authored; set surface.origin to "authored"*;
- a shell's root is a `Frame`, and it has exactly one `Outlet`, reachable from the `Frame`'s `main`; a surface has none;
- a `Custom` needs a `fallback`, and the fallback is a component the renderer draws itself, never another shell part;
- `Navigation.placement` outside a `Frame` is a warning: nothing reads it.

One shell document per product; every screen, authored or generated, renders in its `Outlet`. The example is `packages/spec/examples/shell-product.json`; [Generated or authored](/docs/authored-screens/#the-shell) shows the shape.

## What "semantic" means

A concrete component library has `RadioGroup`, `Select`, `SegmentedControl` and `Combobox`. Polyxd has one `Choice`: "pick one or several options from a known set." Which control that becomes depends on the number of options, their length, the screen width and the platform. That is a rendering decision, so the generator doesn't make it.

Each component definition carries:

- **Props**, with required and optional fields.
- **When to use it and when not to**, with the component to use instead. For example, `DetailList` is for one entity's attributes; many entities with the same attributes should be a `Table`.
- **Accessibility**: the role it must expose and what must be true (a `Table` has a caption and real header cells; a `Chart` has a text summary and a data-table alternative).
- **Agent semantics**: how an agent operates it ("select options by label", "activate the card by its title").
- **Rendering rules** the renderer must follow.
- **Platform mappings** to shadcn/Radix on the web, SwiftUI, Jetpack Compose (Material 3) and A2UI. Only the web renderer exists today.

Some decisions are deliberately taken away from the generator. Heading levels follow nesting depth. Table column alignment follows the column's format. Chart type follows the chart's intent. The primary action is limited to one per view.

## How the renderer chooses controls

These are the rules the web renderer (`@polyxd/react`) applies today.

### Choice

| Options | Rendered as |
|---|---|
| Single choice, 2–4 options, each label 20 characters or fewer, no descriptions | Segmented control |
| Single choice, otherwise | Radio list |
| Multiple choice | Checkbox list |
| More than 10 options (either mode) | The list gets a filter box above it |

The spec also allows a select on compact screens for 5–10 single-choice options; the web renderer currently keeps radios.

### Toggle

With an `action`, a `Toggle` is a switch that applies immediately. Inside a `Form` without an action, it is a checkbox submitted with the form.

### Table

Tables use the surface's own width, through container queries, not the viewport. Below 36rem the header row is visually hidden and each row becomes a stacked card of label/value pairs. Numeric alignment comes from each column's `format`.

### Chart

A `Chart` states an `intent`, not a chart type:

| Intent | Rendered as |
|---|---|
| `trend` | Line chart, with per-series markers so series differ by more than colour |
| `comparison` | Bar chart |
| `composition` | Share bar with a legend |
| `distribution` | Bar chart (the spec's rule is a histogram) |

Every chart shows its written `summary` and includes the data as a table, so people who can't see the chart and agents reading the accessibility tree get the same information. Series colours use `color.data.categorical.1` to `.6` in order.

### Other layout rules

- **Section** titles are real headings. The surface title is `h1`, and each nested `Section` goes one level deeper.
- **DetailList** rows go to a single column below 30rem.
- **ActionBar** stacks its actions vertically below 30rem.
- **Steps** shows "Step N of M", provides Back (`ui.back`) and Next (`ui.next`) itself, and shows the `finish` action on the last step.
- **Confirm** is an alert dialog. When it is the surface's root, it renders inline as a non-modal `alertdialog`, so it doesn't block the host page. When it is nested, it opens as a modal dialog inside the themed surface, with focus starting on Cancel, the least destructive option. Escape cancels in both cases. With `typeToConfirm`, the confirm button stays disabled until the text matches.
- **Status** with kind `error` is an assertive live region (`role="alert"`); the other kinds are polite (`role="status"`).
- **Numbers, currency and dates** are formatted with `Intl` in the surface's locale.

## Where to go next

- [Components reference](/docs/reference/components): props and rules for each component.
- [Patterns](/docs/patterns): how components combine for common tasks.
- [People and agents](/docs/people-and-agents): the accessibility guarantees in more detail.
