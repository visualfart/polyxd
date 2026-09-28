# @polyxd/core

The framework-free heart of rendering a Polyxd UI document: the document types, JSON Pointer bindings, localised formatting, every decision the renderer makes instead of the model, and a headless surface model. No DOM, no framework, no dependencies. `@polyxd/react` and `@polyxd/web` are both built on it, and a renderer for another platform starts here.

```ts
import { createSurface } from "@polyxd/core";

const surface = createSurface(doc, {
  data: { quote },
  locale: "en-GB",
  onAction: ({ name, context, source }) => handlers[name]?.(context),
  onDataChange: (data) => save(data),
  onDismiss: () => close(),
});

surface.byId.get(doc.root);                       // walk the tree from the root
surface.text({ path: "/quote/amount" }, { type: "currency", currency: "GBP" });   // "£40.00"
surface.setValue("/draft/amount", 40);            // inputs write here; subscribers redraw
surface.dispatch(node.action, scope, node.id);    // ui.dismiss → onDismiss; everything else → onAction
surface.subscribe((data) => render());
```

## What is here

| Module | Exports |
|---|---|
| Document | `UIDocument`, `Node`, `Action`, `ActionEvent`, `FrameLayout`, `NavigationPlacement`, `COMPONENTS`, `RENDERER_ACTIONS`, `indexById`, `mainNavigation` |
| Bindings | `get`, `set`, `resolve`, `resolveContext`, `resolveDeep`, `absolute`, `childPointer`, `asList`, `isBinding`, `itemScopes`, `ROOT_SCOPE` |
| Formatting | `formatValue`, `resolveFormat`, `safeColor`, `currencySymbol`, `formatCount`, `formatPercent` |
| Surface | `createSurface`, `a11yAttributes`, `dispatchAction`, `contextWithValue`, `copyText`, `rowChangeAction`, `isRendererAction` |
| Semantic events | `createSurfaceEvents` (the emitter a renderer tells what happened; it decides which events that makes), `validityReason`, `fileRefusalReason`, `SEMANTIC_EVENT_TYPES`, `EVENT_PROPERTIES`, `EVENT_SURFACE_PROPERTIES`, `EVENT_ACTOR_PROPERTIES`, `EVENT_COMPONENT_PROPERTIES`, and the `SemanticEvent` type, all checked against `schema/event.schema.json` |
| Choice | `optionsOf`, `planChoice` (chips, people or list; searchable past 10), `optionKey`, `matchesQuery`, `partitionRecent`, `toggleSelection`, `isSelected`, `searchPlaceholder`, `idOf` |
| State machines | `stepsReducer`, `initialStep`, `isLastStep`, `stepsProgress`, `taskStatus`, `tasklistReducer`, `tasklistProgress`; `selectedView`, `viewsReducer`; `splitReducer`, `initialSplit`, `splitPanes`, `splitSelection`, `splitItemValue`, `clampShare` |
| Layout rules | `frameWidth`, `placementFor`, `appBarTitle`, `documentTitle` (the Frame); `TABLE_COMPACT_PX`, `stackedColumns`, `isNumericColumn`, `paging`, `rowValue`, `nextSort`, `columnCount` (Table); `fitActions`, `minShown`, `menuOrder` (ActionBar); `collectionLayout`, `orderedIndices`, `moveItem`, `calendarMonth` (Collection); `treeRows`, `treeKey`, `typeAheadTarget`, `visibleWindow` (Tree); `activeFilters` (FilterPanel) |
| Loading | `skeletonShape`, `SKELETON_SHAPES`, `PATTERN_SHAPE`, `skeletonStatus` |
| Shortcuts | `parseShortcut`, `shortcutMatches`, `unmodified`, `isApplePlatform` |
| Small marks | `metricChange`, `gaugeState`, `meterHint`, `starsLabel`, `ratingSaid`, `maskSecret`, `groupSummary`, `avatarTone`, `initialsOf`, `iconPath` |
| Content | `richText` (tokens for `**bold**`, `*italic*`, `` `code` ``, `[text](href)`), `qrEncode`, chart geometry (`niceMax`, `axisLabel`, `treemap`, `verticalScale`, `flowLayout`, `markerShape`), `applyMask`, colour parsing (`parseColor`, `formatColor`), file limits (`formatBytes`, `refuseFile`, `fileLimits`) |

Every renderer that uses these makes the same decisions from the same document: a `Choice` with three short options is chips everywhere, a Table stacks below 720px everywhere, `ui.dismiss` closes everywhere. The conformance suite in `@polyxd/verifier` checks that it does.

## Tests

`npm test -w @polyxd/core` runs the unit tests: pointer resolution, formatting per locale, the reducers, control selection, the layout rules, shortcuts, the headless surface, and the semantic events (each one validated against the spec's schema).
