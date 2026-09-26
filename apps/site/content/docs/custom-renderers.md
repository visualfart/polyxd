---
title: Custom renderers
description: Replace any component's renderer with the components prop, and how an Astryx adapter is planned to plug in the same way.
order: 22
section: Guides
---

# Custom renderers

`@polyxd/react` ships one **adapter**: Radix primitives (the same ones shadcn/ui uses) styled only by design-system token variables. You can replace the renderer for any of the 37 components with your own, one component at a time.

## The `components` prop

Pass a map from component name to a React component. Each renderer receives the document node as `node`.

```tsx
import { PolyxdSurface, Render, useBindings, type Node } from "@polyxd/react";

function MyStatus({ node }: { node: Node }) {
  const b = useBindings();
  const urgent = node.kind === "error";
  return (
    <div role={urgent ? "alert" : "status"} className={`my-banner my-banner-${node.kind}`}>
      <strong>{b.text(node.title)}</strong>
      {node.message !== undefined && <p>{b.text(node.message)}</p>}
      {node.action && <Render id={node.action} />}
    </div>
  );
}

<PolyxdSurface document={doc} theme="material3" components={{ Status: MyStatus }} />;
```

Everything you don't override keeps the default renderer. The default map is exported as `registry` if you want to wrap an existing renderer rather than replace it.

## Helpers for renderers

| Export | What it gives you |
|---|---|
| `useBindings()` | Binding helpers for the current scope: `value(v)` resolves a literal or binding; `text(v, format?)` resolves and formats it as text; `write(binding, value)` writes an input's value back to host data; `pointer(binding)` gives the absolute JSON Pointer; `context(c)` resolves an action context |
| `useSurface()` | The surface: the document, `byId`, current `data`, `dispatch(action, scope, sourceId)` for sending actions, `locale`, `resolveMedia`, and the `portal` element dialogs should render into |
| `Render` | `<Render id="child" />` renders another component by id, in the current scope. Use it for children and referenced components |
| `formatValue(value, format, locale)` | The same `Intl`-based formatting the default renderer uses |
| `getPointer`, `setPointer` | JSON Pointer read and immutable write |

Use `dispatch` for every action rather than calling your own handlers, so that `ui.dismiss`, `ui.back` and `ui.next` behave correctly and every capability event reaches the host's `onAction`.

## What a custom renderer must keep

A custom renderer takes over the rendering rules and accessibility guarantees for its component. Keep what the [component definition](/docs/reference/components) requires: the role, the accessible name, live-region behaviour, target sizes, and the rendering rules (for example, `Status` errors are assertive, and a `Confirm` starts focus on the least destructive option).

Use token variables (`var(--pxd-color-status-danger-emphasis)` and so on) rather than raw values, so your renderer still follows whichever pack is loaded. Then run the [verifier](/docs/verifier) over the examples: its rendered and agent checks apply to any renderer, and they are how the default adapter's own bugs were found.

## Astryx (planned)

[Astryx](https://github.com/facebook/astryx) is Meta's open-source React design system. Decision 0002 (`docs/decisions/0002-astryx.md`) looked at how it relates to Polyxd:

- **Different layers.** Astryx is a concrete component library made easy for coding agents to write code against, at build time. Polyxd is a runtime semantic layer: a model emits UI data and a renderer turns it into native components. So Astryx complements Polyxd rather than competing with it, and it is a good renderer target.
- **An adapter, not a pack.** The plan is an `@polyxd/react-astryx` adapter after v0.1 that maps the 24 Polyxd components onto Astryx components, for example `Choice` to RadioList, Selector, SegmentedControl or CheckboxList; `DetailList` to MetadataList; `Steps` to Stepper; `Confirm` to AlertDialog; `Status` to Banner, Toast, EmptyState or Skeleton. `Chart` would wait until Astryx's charts leave canary.
- **Tokens as a bridge.** The adapter would generate an Astryx theme from any Polyxd pack, mapping semantic tokens onto Astryx's CSS variables and building its light/dark values from the pack's modes.
- **Why it matters.** It would prove the "any design system" promise at the component-library level, not only the token level, and give existing Astryx apps a way in.

The `components` prop is the seam this adapter will use: an adapter is a full map of renderers passed the same way. The adapter itself is not built. Any Astryx-based work would pin a specific Astryx version (it is pre-1.0 and changes often) and be described as "compatible with Astryx", not as an official Astryx pack.
