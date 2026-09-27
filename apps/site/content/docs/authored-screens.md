---
title: Generated or authored
description: A document doesn't have to come from a generator. Designers author screens in the same format, they render in the same design system, and the verifier holds them to the same rules.
section: Concepts
order: 10.5
---

# Generated or authored

Polyxd is for **surfaces**: the screens, panels and dialogs a product shows. Where a surface comes from is not part of the format. A generator can write one for a request nobody anticipated; a designer can write one on purpose, as a screen of the product. Both are the same JSON, rendered by the same renderer in the same design system, and checked by the same verifier.

What stays the product's own is the **shell** around surfaces: navigation, app bars, drawers, routing, brand moments. The [coverage survey](/docs/reference/coverage/) files those under app chrome and layout on purpose: the product keeps its craft, and a generated screen can never take it over.

## Why author a screen as a document

- **One set of rules.** An authored screen is verified like a generated one: schema, bindings against real data, accessibility and layout in every design system, your Design Direction's rules. The screen a designer signs off is the screen people get.
- **One design system, many products.** The document says *what* the screen means; the pack says what it looks like. The same Budgets screen renders in Material 3 for the phone app and in your own tokens for the web, with no second build.
- **Agents can operate it.** Every component carries its role and name, so a person's screen reader and someone else's agent get the same structure.
- **It ages well.** A generated surface and an authored one can share components, keys and data shapes, so the long tail matches the screens people already know.

## How to mark one

Set `surface.origin` to `"authored"`. It changes nothing in how the document is validated or rendered; it lets a renderer say so (the demos' "Checked" mark reads *Authored · Checked in 13 design systems*), and lets tooling list a product's authored screens apart from its generated ones.

```json
{
  "specVersion": "0.2.0",
  "surface": { "id": "budgets", "title": "Budgets", "intent": "budgets.overview", "origin": "authored", "presentation": "page" },
  "root": "page",
  "components": [ … ]
}
```

## Where to author

- **In a file.** The [demos](/demos/) keep authored screens next to generated ones (`authored/*.json`), snapshot their data from the product's own views, and verify them in the same run. Halden's Budgets, Insights and Card, Foundry's Renewals, Team and account overview, and Wexley's Council tax, Bins and Benefits are documents, rendered inside each product's own shell.
- **In Studio.** [Studio](https://studio.polyxd.com) has a Screens editor made for designers: a component tree, a property panel generated from the spec, a live preview in the workspace's design system at phone, tablet and desktop widths, issues as you go, versions, and a published document your product fetches by key.

## What a document can't be

The shell. An authored document is a surface within the product, not the product. If a screen is mostly navigation, custom brand components or animation, it belongs in code, on the same tokens; the [renderer](/docs/custom-renderers/) lets you swap any component's implementation for your own when a document needs a piece of it.
