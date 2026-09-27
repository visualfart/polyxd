---
title: Rendering a shell
description: How a product renders its shell document with PolyxdFrame, puts screens in the Outlet, routes navigation actions, and supplies its own components through Custom.
section: Guides
order: 22
---

# Rendering a shell

A **shell document** is the product's frame: the app bar, the main navigation, an aside, a footer, and an `Outlet` where every screen renders. It has `surface.kind: "shell"`, a `Frame` at the root, and is always authored (see [Generated or authored](/docs/authored-screens/#the-shell)). `@polyxd/react` renders it with `PolyxdFrame`.

```tsx
import { PolyxdFrame } from "@polyxd/react";
import shell from "./authored/shell.json";

<PolyxdFrame
  document={shell.document}
  data={shellData}                 // what the shell binds to: the person, badges, the current item
  theme="material3"
  mode={mode}
  current={{ key: route.key, title: route.title }}   // marks the navigation item; the AppBar shows the title on phones
  components={{ "halden.fab": Fab }}                  // host components a Custom names
  onAction={(e) => {
    if (e.name === "nav.go") navigate(e.context.to as string);
    if (e.name === "ask.open") openAsk();
  }}
>
  <Routes>…</Routes>               {/* whatever the product shows: PolyxdSurface documents, React screens, both */}
</PolyxdFrame>
```

## What the frame does

- **Landmarks.** A skip link first, then banner, header, navigation, main, aside, footer, in that reading order at every width. There is exactly one `main`: the Outlet.
- **Layout by width**, measured on the frame itself, not the viewport: at 1024px and above the navigation is a side column or a rail, with the aside as a third column; from 640px a rail with the aside below; on compact widths a bottom bar (up to five items) or a drawer behind the menu button the AppBar shows. `Navigation.placement` fixes one of these instead.
- **Current screen.** `current.key` marks the navigation item; `current.title` becomes the AppBar's title on compact layouts and the document title (`Payments · Halden`). Focus moves to the screen's heading when the Outlet's content changes.
- **Actions.** Navigation items, AppBar actions and Footer links dispatch through `onAction` like any action; the host routes. Nothing in the document knows about URLs.
- **Custom.** A `Custom` component names one of the host's own (`"halden.fab"`), passed in `components`; when the host has none of that name, the document's `fallback` renders instead, so the shell stands on its own.

`useFrame()` gives a host's own screens the layout the frame chose (`{ navigation: "side" | "rail" | "bar" | "drawer", compact }`), so a React screen can, say, leave room for the bottom bar.

## Data

A shell is long-lived, so unlike a surface it **adopts each new `data` object** the host passes: a badge count changes, the frame follows. Keep `shellData` derived from the product's store.

## Verification

A shell is verified like any document: `polyxd-verify authored/shell.json` renders it in every pack with a stand-in screen in the Outlet and audits landmarks, target sizes, contrast and the [shell rules](/docs/authored-screens/#the-shell). The demos' pipeline treats `authored/shell.json` like every other authored document.

## What stays in code

Screens can be documents or React; the frame can be a document or React; the two mix freely. What has no document form is behaviour that isn't a component: routing, data fetching, animation beyond the packs' motion tokens, and anything a `Custom` names. Halden's shell is a document with one `Custom` (the floating ask button); Foundry's and Wexley's frames are still React on the same tokens, and look the same.
