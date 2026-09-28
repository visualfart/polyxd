# @polyxd/web

Renders Polyxd UI documents as Web Components: `<polyxd-surface>` and `<polyxd-frame>`. No framework, no shadow DOM, no dependencies beyond `@polyxd/core`. The DOM, the `pxd-*` classes and the ARIA are the same as `@polyxd/react`'s, so the same stylesheet, the same themes, the verifier's checks and the agent tasks apply unchanged; the conformance suite in `@polyxd/verifier` holds the two renderers to each other.

```html
<link rel="stylesheet" href="node_modules/@polyxd/web/styles.css" />
<link rel="stylesheet" href="node_modules/@polyxd/web/themes/material3.css" />

<polyxd-surface id="send" theme="material3" mode="light"></polyxd-surface>

<script type="module">
  import { defineElements } from "@polyxd/web";
  defineElements();

  const el = document.getElementById("send");
  el.document = doc;                       // a Polyxd UI document (validated with @polyxd/spec)
  el.data = { quote };                     // data comes from the host, never from the model
  el.resolveMedia = (ref) => imageUrls[ref];
  el.addEventListener("polyxd-action", (e) => handlers[e.detail.name]?.(e.detail.context));
  el.addEventListener("polyxd-dismiss", () => close());
</script>
```

Without a bundler, `preview/polyxd-web.js` and `preview/polyxd-web.css` are a self-contained build (the renderer, the validator that runs in browsers, and every theme) that defines the elements and puts `window.PolyxdWeb` on the page.

## `<polyxd-surface>`

| Property | Attribute | What it does |
|---|---|---|
| `document` | | The UI document to render. A new document remounts. |
| `data` | | Host data the document binds to. Defaults to `document.data`. The surface keeps its own copy as inputs change it; `surfaceData` reads that copy. |
| `theme` | `theme` | Design-system pack name, matching a loaded theme CSS file. |
| `mode` | `mode` | `"light"` or `"dark"`. |
| `density` | `density` | `"compact"`, `"comfortable"` or `"spacious"`. |
| `locale` | `locale` | For number, currency and date formatting. Default `"en-GB"`. |
| `disclosure` | `disclosure` | `"show-everything"` opens every Disclosure by default. |
| `resolveMedia` | | `(ref) => url`: turns a media reference from host data into a URL. |
| `derive` | | `(data) => data`: derived data after each input change (a receipt, a total), pure. |
| `components` | | Renderer overrides by component name (`(node, ctx) => element`), and the host's own components a `Custom` names by a namespaced key (`"brand.logo"`: `(props) => element`). |
| `onAction`, `onDataChange`, `onDismiss` | | Callback properties, called before the events below. |
| `onEvent` | | Semantic analytics events (`SemanticEvent`), called before `polyxd-event`. Setting it switches them on. |
| `events` | | What the events say beyond the document: `{ sessionId, actor, journey, generator, direction, experiment }`. Setting it switches them on too. |

Events, all bubbling and composed: `polyxd-action` (`detail` is the `ActionEvent`: `{ name, context, source }`), `polyxd-datachange` (`detail` is the new data), `polyxd-dismiss`, and `polyxd-event` (`detail` is a `SemanticEvent`). Semantic events are off until the host listens: sets `onEvent` or `events`, or adds a `polyxd-event` listener to the element itself. They carry ids, keys, capability names and short codes, never what anyone typed, and go nowhere but the host. `el.feedback(rating, reason?)` and `el.regenerated(reason?)` report the host's side. The renderer handles `ui.back` and `ui.next` inside `Steps`, and `ui.copy`; every other action name reaches the host.

## `<polyxd-frame>`

Renders a shell document (a `Frame` with an `Outlet`) around the host's current screen. The same properties, plus:

| Property | What it does |
|---|---|
| `current` | `{ key, title }`: which navigation item is current; the title shows in the AppBar on compact layouts and becomes the document title. |
| `loading` | A screen is on its way: the Outlet shows a skeleton. |
| `outlet` | The element to show in the Outlet. The element's own light-DOM children at connection time are used when `outlet` is not set. |

A shell adopts each new `data` object the host passes, so a badge count changes when the host's store does.

```html
<polyxd-frame id="shell" theme="polaris">
  <h1 class="pxd-surface-title">Orders</h1>
  <!-- the current screen, or a <polyxd-surface> for a generated one -->
</polyxd-frame>
```

## `mount(el, props)`

For hosts whose DOM is owned by something else, `mount(element, { document, data, theme, onAction, … })` renders without the custom elements and returns `{ update(props), unmount(), data, feedback(rating), regenerated(reason) }`. `props` are the surface's properties above as one object, plus `outlet`, `current` and `loading` for a shell.

## Vue and Svelte

Thin wrappers to copy into a project, in `adapters/`: [`PolyxdSurface.vue`](./adapters/PolyxdSurface.vue) (Vue 3, `<script setup>`) and [`PolyxdSurface.svelte`](./adapters/PolyxdSurface.svelte) (Svelte 5 runes). Each takes the same props (and `onEvent`/`events`, or `onevent` in Svelte, for semantic events), forwards the element's events as `action`, `datachange` and `dismiss`, and stays a few dozen lines because the element does the work. They are documented, not published as packages.

## What the renderer decides (not the model)

The same rules as `@polyxd/react`, from `@polyxd/core`: which control a `Choice` becomes, when a `Table` stacks into rows, where a `Frame` puts its navigation at each width, what an action dispatches. Overlays are native `<dialog>` elements shown modally (focus trap, Escape, focus return) with the surface's scrim; menus, comboboxes, tabs, radios, checkboxes, switches and sliders are written for the DOM with the roles, names and keyboard handling Radix gives the React renderer.

## Tests

`demo/index.html` mounts the money-send form and the shell for a look in a browser: serve the `packages/` folder and open `web/demo/`.

`npm test -w @polyxd/web` renders every spec example through a small DOM in Node and checks the same things the React tests do. The real check is `npm run conformance -w @polyxd/verifier`: both renderers, every document, 13 packs, light and dark, phone and desktop, same fingerprint, same findings, same agent results.
