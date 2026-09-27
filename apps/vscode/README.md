# Polyxd for VS Code

Polyxd documents in your editor. Works in VS Code, Cursor and Windsurf.

- **Completion and hover text** for `*.polyxd.json`, `authored/*.json`, `intents/*.json` and `screens/*.json`, from the spec's JSON Schema, bundled. A file that names `"$schema": "https://polyxd.com/schema/0.3/ui.schema.json"` gets the same wherever it lives.
- **The static check as you type.** The spec's validator runs on every edit (debounced) and on save, against the document's own `data` or a `<name>.data.json` beside it. Structural problems are errors; a binding that reads nothing is a warning with a "did you mean". Each one is underlined at its JSON.
- **A live preview** beside the editor (the title-bar icon, or *Polyxd: Open preview*), rendered with the real renderer in any of the 13 built-in packs or your own (`polyxd.pack`), light or dark (the editor's theme picks the default), phone, tablet, desktop or any width by dragging the edge, compact to spacious. The surface stays mounted as you edit, so what you typed into an input survives a keystroke in the JSON. Click a component in the preview and the cursor goes to its JSON; put the cursor in a component's JSON and it is outlined in the preview. Actions the surface dispatches log at the bottom with their context resolved.
- **Commands.** *Verify document* runs `polyxd-verify` from the workspace (or `npx`) in a task terminal in all 13 packs, light and dark, 390 and 1100. *Insert component* picks one of the 44 by category and drops a valid skeleton at the cursor with tab stops on the placeholders. *Open in Studio* puts the document on the clipboard and opens Studio, where "Paste JSON" makes a screen of it. *Push to Studio* runs `polyxd studio push` with the key from `POLYXD_STUDIO_KEY` or the editor's secret storage (*Set Studio API key*), never from settings.
- **Polyxd documents** in the Explorer: every document in the workspace by folder, with the check's status as a dot.

## Install from the .vsix

```sh
npm run build -w polyxd-vscode
npx --workspace polyxd-vscode vsce package --no-dependencies
code --install-extension apps/vscode/polyxd-vscode-*.vsix        # or: cursor --install-extension …
```

Cursor and Windsurf take the same file through *Extensions → … → Install from VSIX*.

## Settings

| Setting | What it does |
|---|---|
| `polyxd.pack` | A `manifest.json` written by `polyxd pack`, compiled for the preview's pack switcher, or a compiled theme stylesheet. Relative to the workspace folder. |
| `polyxd.defaultPack` | The pack the preview opens with (`material3`). |
| `polyxd.studio.workspaceUrl` | Your Studio workspace's API base, `https://studio.polyxd.com/api/w/<workspace>`, for *Push to Studio*. |

The Studio API key is stored with the editor's secret storage (*Polyxd: Set Studio API key*), or read from `POLYXD_STUDIO_KEY` in the editor's environment.

## What the screenshots would show

1. `authored/screen.budgets.json` open on the left with a yellow squiggle under `"path": "/budgets/daysLef"` and the hover *path "/budgets/daysLef" does not exist in data (did you mean "/budgets/daysLeft"?)*; the preview on the right rendering the Budgets screen in Material 3, dark, at 390px, with the `days_left` Metric outlined because the cursor is inside it.
2. The preview's toolbar: Pack `polaris`, Light/Dark, Phone/Tablet/Desktop with `820px` and the drag handle, Density `compact`; the Actions log below with `budget.open from budget · 10:42:07` and its context `{ "category": "groceries" }`.
3. The *Insert component* quick pick, grouped `structure · layout · content · input · action · feedback · flow`, each entry with the spec's one-line summary.
4. The Explorer's *Polyxd documents* view: `authored` and `intents` folders, a green, yellow or red dot beside each file, `intent · authored` as the description.

## Development

```sh
npm run build -w polyxd-vscode        # dist/, schema/ (esbuild; copies the renderer bundle and the schema)
npm run watch -w polyxd-vscode
npm test -w polyxd-vscode             # the pure pieces: pointer ↔ position, discovery, skeletons
npm run test:smoke -w polyxd-vscode   # the built bundle against a stand-in vscode module (no editor)
node apps/vscode/scripts/serve-webview.ts   # the preview page in a plain browser, at /
```

The extension host bundle (`dist/extension.cjs`) carries `@polyxd/spec`'s validator and the pack compiler; the webview loads `@polyxd/react/preview`'s `polyxd.js` and `polyxd.css`, copied at build time. If `packages/react/preview/` is missing, run `npm run build:preview -w @polyxd/react` first.
