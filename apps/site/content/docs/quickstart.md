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
| `resolveMedia` | `(ref: string) => string \| undefined` | Turns a media reference from host data into a URL. Documents never contain URLs. |
| `components` | `Partial<Record<string, ComponentRenderer>>` | Replace the renderer for any component. See [Custom renderers](/docs/custom-renderers). |
| `locale` | `string` | Locale for number, currency and date formatting. Defaults to `"en-GB"`. |
| `className` | `string` | Extra class on the surface element. |

The renderer handles `ui.back` and `ui.next` itself inside `Steps`. Every other action name goes to `onAction`, and your app decides what it does.

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
