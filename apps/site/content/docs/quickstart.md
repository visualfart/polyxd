---
title: Quickstart
description: Render a UI document with @polyxd/react, validate it with @polyxd/spec, and verify it with polyxd-verify.
order: 2
section: Start
---

# Quickstart

This page takes one UI document through the three steps: render it, validate it, and verify it.

Install the renderer and the spec:

```bash
npm install @polyxd/react @polyxd/spec
```

## 1. Render a document

`@polyxd/react` needs React 19. Import the base stylesheet and the theme CSS for each design system you want to use.

```tsx
import { PolyxdSurface } from "@polyxd/react";
import "@polyxd/react/styles.css";
import "@polyxd/react/themes/material3.css"; // one file per pack: carbon.css, polaris.css, govuk.css…

import doc from "./money-send-confirm.json";

export function SendConfirm({ quote, close }) {
  return (
    <PolyxdSurface
      document={doc}
      data={{ quote }}
      theme="material3"
      mode="light"
      onAction={({ name, context, source }) => {
        if (name === "transfer.confirm") sendMoney(context.quoteId);
      }}
      onDismiss={close}
      resolveMedia={(ref) => imageUrls[ref]}
    />
  );
}
```

### Props

| Prop | Type | What it does |
|---|---|---|
| `document` | `UIDocument` | The UI document to render. Validate it first (step 2). |
| `data` | `object` | Host data the document binds to. Defaults to `document.data`. The surface keeps its own copy as inputs change it. |
| `theme` | `string` | Design-system pack name, such as `"material3"`, `"carbon"` or `"polaris"`. Must match a theme CSS file you imported. See [Design systems](/docs/design-systems) for all thirteen. |
| `mode` | `"light" \| "dark"` | Colour mode. Without it the pack's default mode (light) applies. |
| `onAction` | `(event) => void` | Called for every capability action. `event` is `{ name, context, source }`: the capability name, the resolved context values, and the id of the component that sent it. |
| `onDismiss` | `() => void` | Called for `ui.dismiss`, for example Cancel on a confirmation dialog. |
| `onDataChange` | `(data) => void` | Called with the new data whenever an input changes it. |
| `derive` | `(data) => data \| void` | Derived data: called after each input change and may return a replacement, so a receipt or a filtered list follows what the person types without a remount. Pure. |
| `density` | `"compact" \| "comfortable" \| "spacious"` | Row heights and spacing; compact is for pointer-first tools. |
| `resolveMedia` | `(ref: string) => string \| undefined` | Turns a media reference from host data into a URL. Documents never contain URLs. |
| `components` | `Partial<Record<string, ComponentRenderer>>` | Replace the renderer for any component. See [Custom renderers](/docs/custom-renderers). |
| `locale` | `string` | Locale for number, currency and date formatting. Defaults to `"en-GB"`. |
| `className` | `string` | Extra class on the surface element. |

The renderer handles `ui.back` and `ui.next` itself inside `Steps`, and `ui.copy`. Every other action name goes to `onAction`, and your app decides what it does.

**Not React?** `@polyxd/web` renders the same documents as `<polyxd-surface>` and `<polyxd-frame>`, no framework and no shadow DOM, with the same DOM, styles and checks; Vue and Svelte wrappers are a file each. See [Renderers](/docs/renderers/).

Two more exports: `PolyxdSkeleton` shows a loading state shaped by the coming document's pattern (`<PolyxdSkeleton pattern="multi-step-form" title="Send money" theme="material3" />`) while a document is on its way; `PolyxdFrame` renders a **shell document**, the product's frame, with your screens in its Outlet (see [Rendering a shell](/docs/shell/)).

### Write documents with help

Add `"$schema": "https://polyxd.com/schema/0.3/ui.schema.json"` to a document and VS Code, Cursor, Zed and JetBrains validate and complete it. `npx polyxd dev ./screens` previews a folder of documents in every pack as you edit (see [Your design system](/docs/your-design-system/#preview-documents-as-you-write-them)); the [Polyxd extension](/docs/your-design-system/#in-your-editor) adds a preview panel and diagnostics inside the editor.

### Try it without writing code

The [gallery](/gallery/) renders every example in every pack, mode and width, and logs each action.

## 2. Validate it

`validateDocument` runs the JSON Schema first, then the structural rules the schema can't express: every reference resolves, each component has one parent, at most one primary action is visible at a time, relative paths only appear inside repeated items, and so on.

```ts
import { validateDocument } from "@polyxd/spec";
import { checkPattern } from "@polyxd/spec/patterns";
import { checkCapabilities } from "@polyxd/spec/capabilities";

const { valid, issues } = validateDocument(doc);
// issues: [{ severity: "error" | "warning", at: "/components/1/value/path", message: "..." }]

// Rules of the pattern the document declares in surface.pattern
const patternResults = checkPattern(doc);

// Actions checked against your capability registry
const capabilityIssues = checkCapabilities(doc, registry);
```

From the command line:

```bash
npx polyxd-validate my-ui.json
```

```
✓ examples/money-send-confirm.json
✗ my-ui.json
    error /components/1/value/path: relative path "draft/title" used outside a repeated item
```

### From Python

The Python package `polyxd-spec` runs the same checks and reports the same paths and messages. It is not on PyPI yet, so install it from a clone of the repository:

```bash
pip install ./packages/python-spec
polyxd-spec validate my-ui.json
```

```python
from polyxd_spec import validate_document

result = validate_document(doc)
for issue in result.errors:
    print(issue.path, issue.message, issue.hint)
```

## 3. Verify it

The verifier renders the document in headless Chromium, in each design system, mode and width, and checks it the way it will actually be used. It needs Playwright's Chromium.

```bash
npm install -D @polyxd/verifier
npx playwright install chromium   # once

npx polyxd-verify my-ui.json \
  --themes carbon --modes light --widths 390 \
  --registry capabilities.json \
  --json report.json
```

Each document gets a score from 0 to 100:

```
100  money-send-confirm  (0 errors, 0 warnings agent 12/12)
```

See [Verifier](/docs/verifier) for every flag and check.

## Next

- [UI documents](/docs/ui-documents): what goes in a document.
- [Design systems](/docs/design-systems): switching and building packs.
- [Verifier](/docs/verifier): what the score means.
- [Generated or authored](/docs/authored-screens/): screens a person writes in the same format, and the shell.
- [Studio](/docs/studio/): where a team brings its design system and authors screens.
