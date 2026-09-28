---
title: Renderers
description: What a conformant Polyxd renderer must do, the two shipped renderers (React and Web Components), the framework-free core they share, the Vue and Svelte adapters, how to run the conformance suite, and native renderers as the next step.
order: 23
section: Guides
---

# Renderers

A UI document says what an interface means; a renderer turns it into your platform's components. Polyxd ships two, built on one framework-free core, and a conformance suite that holds any renderer to the same contract: the same components in the same order, the same roles and names, the same text, the same findings, the same agent tasks passing.

```
                 @polyxd/core            decisions, bindings, formatting, the headless surface
                 /          \
      @polyxd/react      @polyxd/web     React 19 + Radix       Web Components, no framework
                 \          /
             @polyxd/verifier            conformance: both renderers, every document, 13 packs × 2 × 2
```

## Not React?

`@polyxd/web` renders a document as a custom element with no framework and no shadow DOM:

```html
<link rel="stylesheet" href="node_modules/@polyxd/web/styles.css" />
<link rel="stylesheet" href="node_modules/@polyxd/web/themes/carbon.css" />

<polyxd-surface id="send" theme="carbon" mode="light"></polyxd-surface>

<script type="module">
  import { defineElements } from "@polyxd/web";
  defineElements();
  const el = document.getElementById("send");
  el.document = doc;
  el.data = { quote };
  el.addEventListener("polyxd-action", ({ detail }) => {
    if (detail.name === "transfer.confirm") sendMoney(detail.context.quoteId);
  });
</script>
```

`document`, `data`, `resolveMedia`, `derive`, `components`, `onEvent` and `events` are properties; `theme`, `mode`, `density`, `locale` and `disclosure` are attributes as well. The element dispatches `polyxd-action` (the `ActionEvent`), `polyxd-datachange` (the new data), `polyxd-dismiss`, and `polyxd-event` for [semantic events](#semantic-events). `<polyxd-frame>` renders a shell document around the host's screen, with `current` and `loading` like `PolyxdFrame`. For a DOM owned by something else, `mount(el, props)` renders without the elements. Without a bundler, `preview/polyxd-web.js` and `preview/polyxd-web.css` are a self-contained build.

The DOM it produces is the React renderer's: the same `pxd-*` classes, the same ARIA, so the stylesheet and every theme apply unchanged, and so does everything the verifier checks. Overlays are native `<dialog>` elements shown modally; menus, comboboxes, tabs, radios, switches and sliders are written for the DOM with the roles and keyboard handling Radix gives React.

### Vue and Svelte

Two adapters ship as files to copy, in `@polyxd/web`'s `adapters/` folder: `PolyxdSurface.vue` (Vue 3, `<script setup>`) and `PolyxdSurface.svelte` (Svelte 5 runes). Each takes the same props, including a handler for semantic events (`onEvent` in Vue, `onevent` in Svelte), forwards the element's events as `action`, `datachange` and `dismiss`, and stays a few dozen lines because the element does the work. They are documented, not published.

## Semantic events

Both renderers emit the semantic analytics events described in [Capabilities, journeys and events](/docs/product#semantic-analytics-events): `surface.shown`, `action.taken`, `checkpoint.reached`, `task.completed`, `task.abandoned`, `surface.dismissed`, `input.error`, `status.shown`, `undo`, and `feedback` and `surface.regenerated` when you report them. They are off until you pass a handler, and then they go to that handler and nowhere else. Polyxd receives none of them, unless you send them to [Studio Insights](/docs/studio#insights).

In React, pass `onEvent`. The `ref` gives you `feedback(rating, reason?)`, `regenerated(reason?)` and the `sessionId`:

```tsx
import { PolyxdSurface, type PolyxdSurfaceHandle } from "@polyxd/react";

const surface = useRef<PolyxdSurfaceHandle>(null);

<PolyxdSurface
  ref={surface}
  document={doc}
  onEvent={(event) => analytics(event)}
  events={{ journey, generator: "my-model@3" }}   // optional: sessionId, actor, journey, generator, direction, experiment
/>

surface.current?.feedback(1);
```

A component of your own inside the surface (a `Custom`) can reach the same emitter through `useSurface().events`.

On the Web Components renderer, set `onEvent`, or listen for `polyxd-event`:

```js
el.events = { journey };                      // optional; setting it also switches the events on
el.addEventListener("polyxd-event", ({ detail }) => analytics(detail));
el.feedback(1);                               // and el.regenerated("asked-again")
```

The events are on when you set `onEvent` or `events`, or add a `polyxd-event` listener to the element itself. A listener further up the page can't be seen, so set `events` (even `{}`) in that case. `mount()` takes `onEvent` and `events` in its props, and its handle has `feedback` and `regenerated`.

Listening changes nothing in the DOM: the tests render every spec example with and without a handler and compare the markup, and the verifier's harnesses always listen, so the conformance suite runs with events on. The verifier also clicks through the same documents in both renderers and checks they emit the same events.

## The core

`@polyxd/core` is what every renderer shares and what a new one starts from: no DOM, no framework, no dependencies.

| Area | What is there |
|---|---|
| Document | The types (`UIDocument`, `Node`, `Action`, `ActionEvent`, `FrameLayout`, `NavigationPlacement`), the component list `COMPONENTS`, the renderer's own action names `RENDERER_ACTIONS`, `indexById`, `mainNavigation` |
| Bindings | JSON Pointer `get` and immutable `set`; `resolve`, `resolveContext`, `resolveDeep`, `absolute`, `childPointer`, `asList`, `isBinding`, `itemScopes`, `ROOT_SCOPE` |
| Formatting | `formatValue` (numbers, currency, percent, dates, times, relative time, duration, bytes, colours, per locale), `resolveFormat`, `safeColor`, `currencySymbol`, `formatCount`, `formatPercent` |
| The headless surface | `createSurface(document, { data, locale, derive, onAction, onDataChange, onDismiss, events })` returns `{ byId, data, setValue, replaceData, dispatch, subscribe, resolve, text, pointer, write, context, visible }`; `dispatchAction` (ui.dismiss to the host's `onDismiss`, everything else to `onAction` with its context resolved), `contextWithValue`, `copyText`, `rowChangeAction`, `isRendererAction`, `a11yAttributes` |
| Semantic events | `createSurfaceEvents(document, emit, options)` is the emitter a renderer tells what happened: `shown()`, `action(action, source)` (which `dispatchAction` calls for you), `edited(pointer)`, `inputError(node, reason)`, `statusShown(node)`, `feedback(rating)`, `regenerated(reason)` and `unmounted(defer?)`. It decides which events that makes. `validityReason` turns a control's `ValidityState` into a reason code, and `fileRefusalReason` does the same for a refused file. `SEMANTIC_EVENT_TYPES`, `EVENT_PROPERTIES`, `EVENT_SURFACE_PROPERTIES`, `EVENT_ACTOR_PROPERTIES` and `EVENT_COMPONENT_PROPERTIES` are the schema's types and property names, checked against `schema/event.schema.json` in core's tests |
| Choice | `optionsOf`, `planChoice` (chips for a few short options, a people picker for faces, otherwise a list, searchable past ten), `optionKey`, `matchesQuery`, `partitionRecent`, `toggleSelection`, `isSelected`, `searchPlaceholder`, `idOf`, `idGenerator`, `CHIPS_MAX`, `CHIP_LABEL_MAX`, `SEARCHABLE_PAST` |
| State machines | Steps: `stepsReducer`, `initialStep`, `isLastStep`, `stepsProgress`, `TASK_STATUS`, `taskStatus`, `tasklistReducer`, `tasklistProgress`. Views: `selectedView`, `viewsReducer`. Split: `splitReducer`, `initialSplit`, `splitPanes`, `splitSelection`, `splitItemValue`, `clampShare`, `SPLIT_COMPACT_PX`, `SHARE`, `SHARE_MIN`, `SHARE_MAX` |
| Layout rules | Frame: `frameWidth`, `placementFor`, `appBarTitle`, `documentTitle`, `WIDE_PX`, `MEDIUM_PX`, `BAR_MAX`, `NAV_COMPACT_PX`. Table: `TABLE_COMPACT_PX`, `PAGE_SIZES`, `isNumericColumn`, `stackedColumns`, `rowValue`, `rowScopes`, `toggleValue`, `nextSort`, `columnCount`, `paging`. ActionBar: `fitActions`, `minShown`, `menuOrder`, `MORE_ACTIONS`, `TRIGGER_FALLBACK`. Collection: `collectionItemValue`, `collectionLayout`, `orderedIndices`, `moveItem`, `dateParts`, `monthToShow`, `shiftMonth`, `calendarMonth`, `nearestSlide`. Tree: `treeRows`, `treeKey`, `typeAheadTarget`, `visibleWindow`, `VIRTUAL_LIMIT`, `OVERSCAN`, `TYPEAHEAD_MS`. FilterPanel: `activeFilters`, `resultCountText`, `FILTER_COMPACT_PX`. Comparison and Navigation: `bestPerAttribute`, `groupAttributes`, `recommendedFirst`, `groupItems`, `navigationLabel` |
| Loading | `skeletonShape`, `SKELETON_SHAPES`, `SKELETON_GROUP_CLASS`, `PATTERN_SHAPE`, `skeletonStatus` |
| Shortcuts | `parseShortcut`, `shortcutMatches`, `unmodified`, `isApplePlatform`, `SHORTCUT_KEYS`, `MODIFIER_FLAGS` |
| Small marks | `metricChange`, `gaugeState`, `meterHint`, `starsLabel`, `ratingSaid`, `maskSecret`, `groupSummary`, `IDENTITY_SIZE`, `avatarTone`, `initialsOf`, `isMediaRef`, `iconPath`, `ICON_PATHS`, `STATUS_ICON`, `STAR_PATH` |
| Content | `richText` (tokens for bold, italic, code and safe links), `qrEncode`, chart geometry (`niceMax`, `axisLabel`, `axisLabelStep`, `treemap`, `verticalScale`, `flowLayout`, `markerShape`, `seriesColor`, `CHART_W`, `CHART_H`, `CHART_PAD`, `MARKERS`), masks and numeric fields (`applyMask`, `maskIsNumeric`, `numericValue`, `storedText`, `addTag`), colours (`parseColor`, `formatColor`, `toHex6`, `sameColor`, `colorPlaceholder`, `hslToRgb`, `rgbToHsl`, `clamp`), file limits (`formatBytes`, `describeType`, `listText`, `matchesAccept`, `fileLimits`, `refuseFile`) |

`@polyxd/react` imports all of it; its public API and its rendered output did not change. `@polyxd/web` exports `PolyxdSurfaceElement`, `PolyxdFrameElement`, `defineElements`, `mount`, `Renderer`, `registry` (its 44 component renderers, to wrap or replace), `Skeleton`, and the small virtual-DOM it draws with (`h`, `adopt`, `render`, `unmount`), plus `formatValue`, `getPointer` and `setPointer` from core for symmetry with the React package.

## What a conformant renderer must do

The contract is on the rendered page, not on a component API, so it holds for any framework. In full in the verifier's `harness/README.md`; in short:

1. **Read `window.__PXD__ = { document, theme, mode }`** and render the document into `#root`, with the outer element carrying `class="pxd-surface"`, `data-pxd-theme` and `data-pxd-mode`, and every component's element carrying `data-pxd-id` and `data-pxd-component`. Overlays render inside the surface. A shell renders around a stand-in screen (`<h1>Screen</h1>`). Media references resolve to a placeholder.
2. **Record what it sends**: push every `ActionEvent` onto `window.__pxdActions`; count `ui.dismiss` in `window.__pxdDismissed`. Optionally, push every semantic event onto `window.__pxdEvents`, as the shipped harnesses do.
3. **Set `window.__pxdReady = true`** after the first paint. The verifier waits for finite animations to end before it measures.
4. **Make the same decisions.** A `Choice` with three short options is chips, a `Table` stacks below 720px, a `Frame` puts five items in a bar on a phone, `ui.dismiss` closes, an input's action carries the value it just wrote. All of these are in `@polyxd/core`; use it.
5. **Give the same accessibility tree.** The roles, accessible names, states and reading order the [component definitions](/docs/reference/components) require, which the React renderer's output defines in practice: a `Confirm` is an `alertdialog` whose consequence sits directly above its buttons, a rating is a radiogroup of "1 star" to "5 stars", a table's stacked rows keep the Select button an agent presses at any width.

Then run the suite against it:

```ts
import { verifyDocument, HARNESSES } from "@polyxd/verifier";

const report = await verifyDocument(doc, { harness: { name: "mine", html: "./my-harness/index.html" }, fingerprint: true });
```

`harness` is `{ url }` for a page you serve or `{ html }` for a directory of static files (served from disk, nothing listens on a port). `fingerprint: true` records, per target, the components in order, the ARIA snapshot and the visible text; `compareFingerprints(a, b)` explains any difference in words.

## Running the conformance suite

```bash
npm run conformance -w @polyxd/verifier
```

Renders every spec example and every demo document (`apps/demos/*/{intents,authored}/*.json`) with both shipped renderers in 13 packs × light/dark × 390/1100 and compares the fingerprint, the axe and layout findings, and the agent tasks. Both renderers must score 100 and every fingerprint must match; the report is per document and per renderer, and any difference is printed in words (`aria differs at line 12: react "button 'Send money'" vs web "button 'Send'"`). Options: `--only <name>`, `--packs a,b`, `--modes light`, `--widths 390`, `--concurrency 6`, `--json report.json`.

The result today: 90 documents, 4,680 renders per renderer, both at 100 everywhere, fingerprints identical in all 90. Building it found and fixed the differences you would expect between a Radix primitive and a hand-written one (a false `aria-checked` dropped instead of stated, a popover anchor counted as a component) and one the React harness had been getting away with: an entrance fade that axe could catch mid-way, now waited out for every renderer.

## Native renderers: the next step

Each [component definition](/docs/reference/components) carries a per-platform mapping, so a native renderer walks the same tree with the same core and draws with the platform's own components. Examples from the spec:

| Component | iOS | Android |
|---|---|---|
| `Choice` | `Picker` (`.segmented`, `.inline` or `.menu`) or a multi-select `List` | `SegmentedButton`, `RadioButton` rows, `ExposedDropdownMenuBox` or `Checkbox` rows |
| `Table` | `Table` on regular width; `List` of rows on compact width | `LazyColumn` of rows with a header row |
| `Confirm` | `.confirmationDialog` / `.alert` with `role: .destructive` | `AlertDialog` |
| `Steps` | `NavigationStack` pushes or a paged view with a `ProgressView` | A stepper row with content and a `LinearProgressIndicator` |
| `Navigation` | `TabView`, or a sidebar on iPad | `NavigationRail` / `NavigationDrawer` |
| `Frame` | `NavigationSplitView` / `TabView` with a `NavigationStack` | `Scaffold` with `TopAppBar`, `NavigationRail` or `NavigationBar`, and content |
| `AppBar` | Navigation bar with toolbar items | `TopAppBar` |
| `Outlet` | `NavigationStack` content | `NavHost` |

What such a renderer reuses is everything in `@polyxd/core` (the decisions, the bindings, the formatting, `createSurface`), so what it writes is the drawing. What it must still meet is the contract above; the practical way to audit it is to render the native view for a document into a WebView-hosted harness page, or to compare its accessibility tree against the ARIA snapshot the suite records, which is why the fingerprint is roles, names and text rather than DOM.

## Custom renderers inside React

Replacing one component's renderer inside `@polyxd/react` is a different, smaller thing: the `components` prop. See [Custom renderers](/docs/custom-renderers/). The same prop carries a host's own components for a shell's `Custom`; `<polyxd-surface>`'s `components` property does both jobs for the Web renderer.
