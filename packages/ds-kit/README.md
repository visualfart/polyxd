# @polyxd/ds-kit

The `polyxd` command, and the shared parts of building a Polyxd design-system pack: reading CSS custom properties, converting values to DTCG, writing the tiers and the manifest.

```sh
npx polyxd pack ./src/tokens.css                  # a pack from your tokens, plus a mapping to correct
npx polyxd check ./ds-acme/manifest.json          # the pack against the semantic token contract
npx polyxd studio push ./ --to https://studio.polyxd.com/api/w/acme
npx polyxd dev ./screens                          # preview the documents in a folder as you edit them
```

## polyxd dev

A local preview for people who write Polyxd documents in their editor.

```sh
npx polyxd dev [dir] [--port 4310] [--theme material3] [--data <file.json>] [--pack <manifest.json|theme.css>] [--verify] [--open]
```

It watches `dir` (default: the current folder) for documents: a JSON file with `specVersion` and `components`, or an intent-shaped file with a `document` inside (the document and its `data` are used). A document without embedded data takes `<name>.data.json` beside it, else the file given with `--data`. Packs, registries, reports and other JSON are ignored.

The page at `http://localhost:4310/` lists the documents with a dot for the static check (green clean, amber warnings, red errors), renders the selected one with the real renderer, and lets you switch between all built-in packs (plus one of yours with `--pack`), light and dark, phone, tablet and desktop widths with a draggable edge, and density. Beside the surface: the static check's issues, run in the page with `@polyxd/spec/browser` against the data (a binding that reads nothing is a warning); the document JSON with a copy button; the data, and the data as edited in the surface; and a log of the actions the surface dispatches, with their context resolved. Save any file and the surface reloads in place, keeping your selection and controls.

`--verify` adds a button that runs the full verifier for the selected document (13 packs × light/dark × 390/1100 with axe and the layout check) and streams its output into the panel. It needs `@polyxd/verifier` installed (`npm install -D @polyxd/verifier playwright && npx playwright install chromium`).

The renderer comes from `@polyxd/react/preview`, a single script and stylesheet with React, the renderer, the validator and every theme, so nothing is built on your side. Everything else is Node: `http`, `fs.watch`, and server-sent events.

## Library

```ts
import { cssVars, resolveVars, length, duration, bezier, shadowLayers, writePack } from "@polyxd/ds-kit";
import { inferMapping } from "@polyxd/ds-kit/infer";
```

`cssVars` reads every custom property under the selectors you choose, `resolveVars` follows `var()` references, the converters turn CSS values into DTCG dimensions, durations, easings and shadows, and `writePack` writes the tiers, the manifest and a package.json. `inferMapping` guesses which of your variables fill which contract tokens, from their names and, failing that, by measuring them; `polyxd pack` is built on it.

[Docs](https://polyxd.com/docs/your-design-system/) · [Polyxd](https://polyxd.com) · [Source](https://github.com/visualfart/polyxd)
