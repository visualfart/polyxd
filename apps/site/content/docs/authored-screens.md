---
title: Generated or authored
description: A document doesn't have to come from a generator. Designers author screens in the same format, they render in the same design system, and the verifier holds them to the same rules.
section: Concepts
order: 10.5
---

# Generated or authored

Polyxd is for **surfaces**: the screens, panels and dialogs a product shows. Where a surface comes from is not part of the format. A generator can write one for a request nobody anticipated; a designer can write one on purpose, as a screen of the product. Both are the same JSON, rendered by the same renderer in the same design system, and checked by the same verifier.

The **shell** around surfaces (the app bar, the main navigation, the footer, brand moments) is the product's own. Since spec 0.3 it can be a document as well, but only an authored one: a shell is written once per product by a person, and a generated screen can never take it over. See [The shell](#the-shell).

## Why author a screen as a document

- **One set of rules.** An authored screen is verified like a generated one: schema, bindings against real data, accessibility and layout in every design system, your Design Direction's rules. The screen a designer signs off is the screen people get.
- **One design system, many products.** The document says *what* the screen means; the pack says what it looks like. The same Budgets screen renders in Material 3 for the phone app and in your own tokens for the web, with no second build.
- **Agents can operate it.** Every component carries its role and name, so a person's screen reader and someone else's agent get the same structure.
- **It ages well.** A generated surface and an authored one can share components, keys and data shapes, so the long tail matches the screens people already know.

## How to mark one

Set `surface.origin` to `"authored"`. It changes nothing in how the document is validated or rendered; it lets a renderer say so (the demos' "Checked" mark reads *Authored · Checked in 13 design systems*), and lets tooling list a product's authored screens apart from its generated ones.

```json
{
  "$schema": "https://polyxd.com/schema/0.3/ui.schema.json",
  "specVersion": "0.3.0",
  "surface": { "id": "budgets", "title": "Budgets", "intent": "budgets.overview", "origin": "authored", "presentation": "page" },
  "root": "page",
  "components": [ … ]
}
```

## Where to author

- **In a file.** The [demos](/demos/) keep authored screens next to generated ones (`authored/*.json`), snapshot their data from the product's own views, and verify them in the same run. Halden's Budgets, Insights and Card, Foundry's Renewals, Team and account overview, and Wexley's Council tax, Bins and Benefits are documents, rendered inside each product's own shell.
- **In Studio.** [Studio](https://studio.polyxd.com) has a Screens editor made for designers: a component tree, a property panel generated from the spec, a live preview in the workspace's design system at phone, tablet and desktop widths, issues as you go, versions, and a published document your product fetches by key.

## The shell

A product has one frame around all its screens. Spec 0.3 lets that frame be a document: a **shell document**, with `surface.kind` set to `"shell"`, a `Frame` at the root, and an `Outlet` where screens render. It renders in the same design system as the screens inside it, and the verifier holds it to the same rules.

The rule that keeps it safe: the shell components (`Frame`, `AppBar`, `Footer`, `Outlet`, `Custom`) appear only in a shell document, and **a shell is always authored**. The validator refuses a `Frame` in a surface (*Frame belongs in a shell document: set surface.kind to "shell"*) and a shell whose origin isn't `"authored"` (*a shell is authored; set surface.origin to "authored"*). A generator is never shown these components. So a product has one shell document, written by a person, and every screen, authored or generated, renders in its `Outlet`.

```json
{
  "$schema": "https://polyxd.com/schema/0.3/ui.schema.json",
  "specVersion": "0.3.0",
  "surface": { "id": "shell", "title": "Harbourline", "kind": "shell", "origin": "authored" },
  "root": "frame",
  "components": [
    { "id": "frame", "component": "Frame", "header": "bar", "navigation": "nav", "main": "outlet", "footer": "footer" },
    { "id": "bar", "component": "AppBar", "title": "Harbourline", "search": "search", "account": "me" },
    { "id": "search", "component": "TextInput", "kind": "search", "label": "Search", "value": { "path": "/search/query" } },
    { "id": "me", "component": "Identity", "name": { "path": "/account/name" } },
    { "id": "nav", "component": "Navigation", "label": "Main", "placement": "auto", "current": { "path": "/nav/current" },
      "items": [
        { "key": "home", "label": "Home", "icon": "home", "action": { "event": { "name": "nav.go", "context": { "to": "home" } } } },
        { "key": "shipments", "label": "Shipments", "icon": "orders", "action": { "event": { "name": "nav.go", "context": { "to": "shipments" } } } }
      ] },
    { "id": "outlet", "component": "Outlet", "label": "Current screen" },
    { "id": "footer", "component": "Footer", "legal": { "path": "/legal" },
      "groups": [ { "key": "help", "label": "Help", "items": [ { "key": "docs", "label": "Documentation", "action": { "event": { "name": "help.open", "context": { "topic": "docs" } } } } ] } ] }
  ]
}
```

The full example, with a banner, an aside and a `Custom` logo with a `Media` fallback, is `packages/spec/examples/shell-product.json`. A `Custom` is how the shell keeps the parts that are truly the product's own (a logo, a map, a chart type the spec doesn't have): the host renders the component it names, and the fallback stands in when it can't.

What a document still can't be is code. If a screen is mostly animation or bespoke interaction, it belongs in the host, on the same tokens; the [renderer](/docs/custom-renderers/) lets you swap any component's implementation for your own, and a `Custom` in the shell names one.
