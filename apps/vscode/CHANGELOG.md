# Changelog

## 0.4.0

- Built on the Polyxd 0.4.0 packages: the spec's validators are compiled ahead of time, and people's initials stay visible on a selected row in the preview.

## 0.3.0

The first release for the Visual Studio Marketplace and Open VSX.

- Completion and hover text from the bundled schema for `*.polyxd.json` files and for files in `authored/`, `intents/` and `screens/`. Intent files are checked inside their `document`, not at their root.
- The static check as you type, against the document's own `data` or a `<name>.data.json` beside it.
- A live preview in the 13 built-in design systems or your own (`polyxd.pack`), light or dark, at any width. It opens in the editor's own light or dark.
- Selection both ways between the JSON and the preview, and a log of the actions the surface dispatches.
- Commands: Open preview, Verify document, Insert component, Open in Studio, Push to Studio, Set Studio API key.
- The Polyxd documents view in the Explorer.
- The preview runs under a content-security policy without `'unsafe-eval'`: the spec's validator is compiled ahead of time.
