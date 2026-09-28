# @polyxd/react

Renders Polyxd UI documents in React. Behaviour comes from Radix primitives (the same ones shadcn/ui uses); the look comes entirely from a design-system pack's semantic tokens, compiled to CSS variables. Everything that isn't React (the document types, bindings, formatting, and every decision the renderer makes instead of the model) lives in `@polyxd/core`, which `@polyxd/web` shares; a conformance suite in `@polyxd/verifier` holds the two renderers to the same DOM, ARIA and text.

```tsx
import { PolyxdSurface } from "@polyxd/react";
import "@polyxd/react/styles.css";
import "@polyxd/react/themes/material3.css"; // one file per pack: carbon.css, polaris.css, govuk.css…

<PolyxdSurface
  document={doc}                  // a Polyxd UI document (validated with @polyxd/spec)
  data={hostData}                 // data comes from the host, never from the model
  theme="material3"
  mode="light"
  onAction={({ name, context }) => handlers[name]?.(context)}   // capability intents
  onDismiss={() => close()}
  resolveMedia={(ref) => imageUrls[ref]}                        // generated UIs never contain URLs
/>
```

## Exports

| Export | What it is |
|---|---|
| `PolyxdSurface` | Renders one document: a screen, panel or dialog. Props above, plus `derive` (derived data after each input change), `density`, `disclosure`, `locale`, `components`, and `onEvent`, `events` and `ref` for semantic events (below). |
| `PolyxdFrame` | Renders a **shell document** (the product's frame: AppBar, Navigation, Outlet, aside, Footer) with your screens as children in the Outlet; `current={{ key, title }}` marks the navigation and titles the page. |
| `PolyxdSkeleton` | A loading state shaped by a pattern or a shape, for a document that has not arrived. |
| `useFrame()` | The layout the frame chose (`side`, `rail`, `bar`, `drawer`; `compact`) for a host's own screens. |
| `useBindings()`, `useSurface()`, `Render` | For custom renderers. |
| `registry` | The default renderer map, to wrap or replace per component; also where a `Custom`'s host components go, by namespaced name. |
| `formatValue`, `getPointer`, `setPointer` | Formatting and JSON Pointer helpers, re-exported from `@polyxd/core`. |
| `preview/polyxd.js` | A self-contained browser bundle (`window.Polyxd.mount`) used by `polyxd dev` and the editor extension. |

## Semantic events

Pass `onEvent` and the surface emits semantic analytics events (`schema/event.schema.json`): `surface.shown`, `action.taken`, `checkpoint.reached`, `task.completed`, `task.abandoned`, `surface.dismissed`, `input.error`, `status.shown`, `undo`, and from you through the `ref`, `feedback` and `surface.regenerated`. They carry ids, keys, capability names and short codes, never what anyone typed. Without `onEvent` nothing is made. They go to your handler and nowhere else; `@polyxd/analytics` sends them on to PostHog, Segment, GA4 or your endpoint.

```tsx
import { toPostHog } from "@polyxd/analytics";

const surface = useRef<PolyxdSurfaceHandle>(null);
<PolyxdSurface ref={surface} document={doc} onEvent={toPostHog(posthog)} events={{ journey, generator: "my-model@3" }} />;
surface.current?.feedback(1);
```

When each event fires and what it carries: [Capabilities, journeys and events](https://polyxd.com/docs/product/#semantic-analytics-events).

## What the renderer decides (not the model)

- **Controls from semantics.** A `Choice` with 2–4 short options renders as a segmented control, 5–10 as radios, more than 10 as a filterable list; a `Toggle` with an action is a switch, without one a checkbox.
- **Layout from the surface's own width** (container queries): tables become stacked label/value cards, action bars stack with the primary first, detail lists go single-column.
- **Headings** follow nesting depth. **Formatting** of numbers, currency, dates and relative times is localised with `Intl`.
- **Charts** pick their form from `intent` (trend → line, comparison → bars, composition → share bar), always show the written takeaway, and include the data as a table.
- **Confirm** is an alert dialog that portals inside the surface so it stays themed; typed confirmation disables the button until it matches.

## Themes

`npm run build:themes -w @polyxd/react` compiles every `packages/ds-*` pack into `themes/<pack>.css`, scoped by `[data-pxd-theme][data-pxd-mode]`. Only contract tokens are emitted. Each theme also sets shadcn/ui's variable names (`--primary`, `--background`, `--radius`, …), so an existing shadcn app follows the same pack.

## Adapters

Pass `components={{ Status: MyStatus }}` to replace any component renderer. The default adapter is Radix + tokens; others (for example Astryx, see `docs/decisions/0002-astryx.md`) plug in the same way.

## Tests

`npm test -w @polyxd/react` builds, server-renders every spec example, checks formatting, table, chart and heading semantics, and verifies every pack compiles and the stylesheet only uses contract tokens. The gallery (`apps/gallery`, `npm run dev -w @polyxd/gallery`) is for looking at and clicking through every example in every pack, mode and width.
