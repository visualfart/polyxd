# The harness contract

The verifier renders a document by opening a **harness**: a page that draws one UI document with one theme and reports what the surface sends to the host. Any renderer can be verified, audited and compared with the shipped ones by providing such a page. The verifier's own two harnesses (`harness/`, React; `harness-web/`, Web Components) are examples of the contract, and `npm run conformance` holds them to each other.

## What the page must do

1. **Read `window.__PXD__`** before rendering. The verifier sets it before any script runs:

   ```ts
   window.__PXD__ = { document: UIDocument, theme: string, mode: "light" | "dark" };
   ```

   `document` is the flat-form UI document (spec 0.3), `theme` the design-system pack name (`"material3"`, `"carbon"`, …) and `mode` the colour mode. The viewport width is the page's own; the verifier sets it (390 or 1100 by default).

2. **Render the document into `#root`** with that theme and mode, so that the surface's outer element carries `class="pxd-surface"` and `data-pxd-theme="<theme>"` / `data-pxd-mode="<mode>"`. The audits select `.pxd-surface`. Load the base stylesheet and every theme the run may ask for (the shipped harnesses bundle all of them).

   - Every element a component rendered carries `data-pxd-id` (the component's id) and `data-pxd-component` (its name). The rendered fingerprint reads these in DOM order.
   - Overlays (dialogs, menus, sheets) must render **inside** `.pxd-surface`, so they are themed and audited.
   - A **shell document** (`surface.kind: "shell"`) is rendered as the product's frame with a stand-in screen in its Outlet: an `<h1 class="pxd-surface-title">Screen</h1>` and a paragraph, with `current` set to the first navigation item's key and the title `"Screen"`.
   - Media references are resolved to a placeholder: a grey `data:image/svg+xml` square whose `<title>` is the reference. Generated documents never contain URLs.

3. **Record what the surface sends.**

   ```ts
   window.__pxdActions = [];           // every ActionEvent, in order: { name, context, source }
   window.__pxdDismissed = 0;          // incremented on each ui.dismiss
   window.__pxdEvents = [];            // optional: every semantic event (schema/event.schema.json), in order
   ```

   The agent tasks check `__pxdActions` for the expected capability event with the expected (resolved) context. The shipped harnesses also pass `onEvent`, so every rendered check runs with semantic events on, and the verifier's tests compare the events both renderers emit for the same clicks.

4. **Say when it is ready.** After the first paint, set `window.__pxdReady = true`. The shipped harnesses do it two animation frames after mounting. The verifier then waits for any finite CSS animation to finish (an entrance fade) before measuring, so a renderer need not avoid them.

5. **Nothing else.** No network (the page is served from disk through request interception; assets must be relative to the page), no timers that keep changing the DOM, no console errors: every page error and `console.error` is a `runtime` finding.

## Serving

Pass the page to `verifyDocument` as its `harness`:

```ts
import { verifyDocument, HARNESSES } from "@polyxd/verifier";

await verifyDocument(doc, { harness: HARNESSES.web });                        // a shipped harness
await verifyDocument(doc, { harness: { name: "mine", html: "./harness/index.html" } });   // a directory of static files
await verifyDocument(doc, { harness: { name: "mine", url: "http://localhost:5173/harness.html" } });   // a page you serve
```

With `html`, the file's directory is served at `http://harness.polyxd.local/` through Playwright's request interception, so nothing listens on a port and relative asset paths work. With `url`, the verifier opens that address as it is.

## What is compared

`npm run conformance -w @polyxd/verifier` renders every spec example and every demo document with both shipped harnesses in 13 packs × light/dark × 390/1100 and compares, per target:

- the **fingerprint**: `[data-pxd-id, data-pxd-component]` in DOM order, Playwright's ARIA snapshot of `.pxd-surface` (roles, accessible names, states, in reading order; generated ids in skip-link hrefs normalised), and the surface's visible text;
- the **findings**: axe-core WCAG 2.2 AA, layout (overflow, target size, consequence placement) and runtime errors, by check id and count;
- the **agent tasks**: each task's success.

Both renderers must score 100 and the three must match. `verifyDocument(doc, { fingerprint: true })` records a fingerprint on each `TargetReport`, and `compareFingerprints(a, b)` explains any difference.

## Why a contract and not a component API

A renderer for another framework or platform will not share code with the React one; what it must share is what a person or an agent gets: the same components in the same order, the same roles and names, the same text, the same findings. The contract is on the rendered page, so it holds for a React app, a Web Components page, a Vue island or, through a bridge, a native view rendered into a WebView for auditing. `@polyxd/core` gives a renderer every decision the React one makes (which control a Choice becomes, when a Table stacks, what an action dispatches), so meeting the contract is a matter of drawing, not of deciding.
