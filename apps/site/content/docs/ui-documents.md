---
title: UI documents
description: The structure of a Polyxd UI document, how it binds to host data, how actions work, and why keys matter.
order: 10
section: Concepts
---

# UI documents

A UI document is one interface, generated or authored: a JSON object that lists semantic components, says which one is the root, and binds them to data the host provides. It is validated by `packages/spec/schema/ui.schema.json`, published at `https://polyxd.com/schema/0.3/ui.schema.json`.

## A real example

This is `packages/spec/examples/money-send-confirm.json`, the confirmation step of sending money:

```json
{
  "$schema": "https://polyxd.com/schema/0.3/ui.schema.json",
  "specVersion": "0.3.0",
  "surface": {
    "id": "send-confirm",
    "title": "Confirm payment",
    "intent": "money.send",
    "pattern": "confirm-destructive"
  },
  "root": "confirm",
  "components": [
    {
      "id": "confirm",
      "component": "Confirm",
      "title": "Send £250.00 to Alex Kim?",
      "severity": "consequential",
      "consequence": "The money leaves your account immediately and can't be recalled.",
      "summary": "summary",
      "confirm": {
        "label": "Send £250.00",
        "action": {
          "event": {
            "name": "transfer.confirm",
            "context": { "quoteId": { "path": "/quote/id" } }
          }
        }
      }
    },
    {
      "id": "summary",
      "component": "DetailList",
      "items": [
        { "key": "recipient", "label": "To", "value": { "path": "/quote/recipient" } },
        { "key": "amount", "label": "Amount", "value": { "path": "/quote/amount" },
          "format": { "type": "currency", "currency": "GBP" } },
        { "key": "fee", "label": "Fee", "value": { "path": "/quote/fee" },
          "format": { "type": "currency", "currency": "GBP" } },
        { "key": "reference", "label": "Reference", "value": { "path": "/quote/reference" } }
      ]
    }
  ],
  "data": {
    "quote": { "id": "q_91", "recipient": "Alex Kim", "amount": 250, "fee": 0, "reference": "Rent share" }
  }
}
```

## Structure

| Field | Required | What it is |
|---|---|---|
| `$schema` | No | The schema the document follows, `https://polyxd.com/schema/0.3/ui.schema.json`, so editors validate and complete it as you type. |
| `specVersion` | Yes | The spec version the document follows. Currently `0.3.x`; `0.2.x` and `0.1.x` documents still validate. |
| `surface` | Yes | What this interface is for (see below). |
| `root` | Yes | Id of the top-level component. |
| `components` | Yes | A flat list of components. |
| `data` | No | A snapshot of host data, for tests and examples. In an app, the host passes data to the renderer instead. |

### The surface

| Field | Required | What it is |
|---|---|---|
| `id` | Yes | Id of the surface. |
| `title` | Yes | Short title (page title or dialog title). The web renderer shows it as the page's `h1`, except when the root is a `Confirm`. |
| `intent` | No | What the user is trying to do, as a stable key such as `money.send`. Interface memory and analytics are organised by intent. |
| `pattern` | No | Id of the [pattern](/docs/patterns) the surface follows. The validator runs that pattern's checks. |
| `journey` | No | Id of the [journey](/docs/product) this surface is a step of. |
| `dismissible` | No | Whether the surface can be dismissed. Defaults to `true`. |
| `kind` | No | `surface` (the default: a screen, panel or dialog that lives inside a shell) or `shell` (the product's frame: a `Frame` at the root with an `Outlet` for screens). A shell is always authored, and the shell components are allowed only in one; see [Components](/docs/components/#shell). |
| `origin` | No | `generated` or `authored`: whether a generator wrote it for a request, or a person authored it as a screen of the product. Validation and rendering are the same either way; see [Generated or authored](/docs/authored-screens/). |

### A flat list of components

Components are not nested. Each one has an `id`, and components refer to their children by id. This is the same adjacency-list shape A2UI uses, which is what makes [A2UI export](/docs/a2ui) a near one-to-one projection and makes progressive streaming possible.

Every component has these common fields:

| Field | What it is |
|---|---|
| `id` | Unique within the document. Starts with a letter; letters, digits, `_` and `-`. |
| `component` | One of the 44 [component](/docs/components) names. |
| `key` | Optional stable semantic key (see [Keys](#keys-and-memory)). |
| `visible` | Optional boolean or binding. The component is hidden when it is `false`. |
| `accessibility` | Optional `{label, description, live, hidden}`, the same fields as A2UI v1.0. Only needed to add to what the component's semantics already provide. |

The validator checks the tree beyond the schema:

- Every referenced id exists, every component has exactly one parent, and there are no cycles. Components not reachable from the root produce a warning.
- References have allowed types. For example, `ActionBar` holds only `Action`s, `Confirm.summary` must be a `DetailList`, and `Collection.empty` must be a `Status`.
- At most one primary action is visible at a time. A `Form` submit counts as primary. Each `Views` panel, `Steps` step and `Confirm` dialog is its own context.
- `Media` needs `alt` unless it is `decorative`.
- The shell components (`Frame`, `AppBar`, `Footer`, `Outlet`, `Custom`) appear only in a document whose `surface.kind` is `shell` and whose `surface.origin` is `authored`; a shell's root is a `Frame` with exactly one `Outlet` under its `main`.

The validator is `validateDocument` in `@polyxd/spec`. Import it from `@polyxd/spec/browser` to use it anywhere: Node, browsers and Cloudflare Workers. Its schema check is compiled ahead of time. It never uses `eval` or `new Function`, so it also works on a page with a strict content security policy.

## Bindings

Any value that comes from the host is a **binding**: `{ "path": "<JSON Pointer>" }`. Paths are RFC 6901 JSON Pointers into host data.

```json
{ "component": "Metric", "label": "Balance", "value": { "path": "/account/balance" },
  "format": { "type": "currency", "currency": "GBP" } }
```

Many text props accept either a literal string or a binding. Input components (`TextInput`, `Choice`, `Toggle`, `DateInput`, `RangeInput`) bind their `value` two ways: the renderer writes the user's input back to that path.

Values are never pre-formatted by the generator. A `format` (`text`, `number`, `currency`, `percent`, `date`, `time`, `datetime`, `relativeTime`, `duration`) tells the renderer how to present a raw value, and the renderer localises it.

### Relative paths inside repeated items

A `Collection` repeats one component per item in an array. Inside that template, paths without a leading `/` resolve against the current item. From `personal-reading-log.json`:

```json
{
  "id": "books",
  "component": "Collection",
  "label": "Books to read",
  "items": { "path": "/books", "componentId": "book" },
  "empty": "empty"
},
{
  "id": "book",
  "component": "Card",
  "title": { "path": "title" },
  "subtitle": { "path": "author" },
  "action": { "event": { "name": "book.open", "context": { "id": { "path": "id" } } } }
}
```

Some props are also item-scoped by definition: `Table` columns and `rowAction` resolve against each row, `Chart` `x` and `series` against each data point, and `Comparison` attributes and `choose` against each option. A relative path anywhere else is a validation error. An absolute path that doesn't exist in `data` (when `data` is given) is a warning.

## Actions are capability intents

An action never contains code. It names a capability the host has registered, plus the values to send with it:

```json
{ "event": { "name": "task.save", "context": { "title": { "path": "/draft/title" } } } }
```

The renderer resolves the context bindings and calls the host's `onAction({ name, context, source })`. The host decides what happens. Capability names are dotted, lowercase-first identifiers such as `transfer.confirm`.

The `ui.` namespace is reserved for actions the renderer handles itself. Only three exist:

| Action | What the renderer does |
|---|---|
| `ui.dismiss` | Closes the surface (calls `onDismiss`). The default cancel of a `Confirm`. |
| `ui.back` | Goes to the previous step inside `Steps`. |
| `ui.next` | Goes to the next step inside `Steps`. |

Any other `ui.*` name is a validation error. With a capability registry, the verifier also checks that every action names a registered capability and that risky ones sit behind a confirmation. See [Product](/docs/product).

## Data comes from the host

The generator lays out and labels data; it never supplies it. The schema enforces this where it matters most: `Metric.value`, `Media.src`, `Table.rows` and `Chart.data` must be bindings, and a `Collection` can only repeat over an array path in host data, so a document can't hard-code a balance or embed an image URL. The `data` field in a document is only a snapshot for tests and examples.

## UI is data, never code

A UI document has no scripts, no styles, no class names and no URLs. Media is a reference in host data that the host turns into a URL through `resolveMedia`. Everything visual comes from the design-system pack, and everything that happens comes from the host's handlers. That is what makes a generated surface safe to embed: the worst a bad document can do is fail validation or be ugly.

## Keys and memory

A `key` is a stable semantic name for a thing on screen, such as `fee` or `recipient.name` (lowercase, dotted, `_` allowed). Ids are local to one document. Keys are meant to be the same across generations: if the fee appeared last time with the key `fee`, it should have the key `fee` next time too.

Keys can go on components and on items inside them (detail rows, table columns, steps, views, chart series, comparison attributes).

They matter because recognition depends on them. The verifier's consistency check matches two generations of the same intent by key, then compares which component each key uses, their relative order, and their labels. The runtime's [interface memory](/docs/runtime#memory) keeps the screen shown for each intent on the client and gives it back to the model next time, with the instruction to keep its keys, structure, order and labels, so the same task keeps the same shape. See [Verifier](/docs/verifier#consistency).
