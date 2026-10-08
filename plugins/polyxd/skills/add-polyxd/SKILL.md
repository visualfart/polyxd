---
name: add-polyxd
description: Add Polyxd to a codebase. Render Polyxd UI documents with @polyxd/react or @polyxd/web, validate them with @polyxd/spec, verify them in CI with @polyxd/verifier, and make a design-system pack from the project's own tokens. Use when the user wants generated or authored screens in their own app, in their own design system.
---

# Add Polyxd to a codebase

Check details against the docs with the Polyxd MCP server's `polyxd_docs` tool (or https://polyxd.com/llms.txt) before writing code: the docs ship with each release and win over this summary.

## 1. Render

React 19:

```bash
npm install @polyxd/react @polyxd/spec
```

```tsx
import { PolyxdSurface } from "@polyxd/react";
import "@polyxd/react/styles.css";
import "@polyxd/react/themes/material3.css"; // one file per pack you use

<PolyxdSurface
  document={doc}
  data={{ quote }}
  theme="material3"
  mode="light"
  onAction={({ name, context, source }) => {
    // the app decides what each action does
  }}
  onDismiss={close}
/>;
```

Not React: `@polyxd/web` renders the same documents as `<polyxd-surface>`, with no framework and no shadow DOM. Documents never contain URLs; pass `resolveMedia` to turn media references into URLs.

## 2. Validate

```ts
import { validateDocument } from "@polyxd/spec";
const { valid, issues } = validateDocument(doc); // issues carry a JSON Pointer in `at`
```

From the command line: `npx polyxd-validate my-ui.json`. Add `"$schema": "https://polyxd.com/schema/0.3/ui.schema.json"` to a document for completion and checks in the editor.

## 3. Verify, in CI too

```bash
npm install -D @polyxd/verifier playwright
npx playwright install chromium
npx polyxd-verify my-ui.json --themes carbon --modes light --widths 390 --json report.json
```

It renders each document in headless Chromium per design system, mode and width, runs axe and the layout checks, and scores it from 0 to 100.

## 4. The project's own design system

```bash
npx polyxd pack ./src/tokens.css            # --dark ./dark.css when the modes are separate files
npx polyxd check ./ds-<name>/manifest.json
npx polyxd dev ./screens                    # preview documents in every pack as you edit
```

`polyxd pack` maps the project's CSS variables onto Polyxd's token contract, writes `polyxd.mapping.json` with every guess, and lists what it couldn't map. Correct the mapping and run it again; never invent colours the project doesn't have.
