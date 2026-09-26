# @polyxd/verifier

Scores a Polyxd UI document the way it will actually be used: rendered, in every design system, by people and by agents.

```bash
npm install -D @polyxd/verifier
npx playwright install chromium    # once
npx polyxd-verify my-ui.json --themes carbon --modes light --widths 390 --json report.json
```

Inside the Polyxd repository, `npm run verify:examples -w @polyxd/verifier` runs every spec example through the full matrix with agent tasks.

## What it checks

| Layer | Checks |
|---|---|
| **Document** | Spec validation (schema, references, one primary action per view, data bindings…), the declared pattern's rules, capability safety (destructive only in a Confirm, consequential only after review), Design Direction / acceptance rules, at most 6 inputs per view, no empty text, unique control names, labels that say what happens |
| **Rendered** (headless Chromium, per design system × mode × width) | axe-core WCAG 2.2 AA, horizontal overflow, target size (WCAG 2.5.8 and the pack's own minimum), runtime errors |
| **Agent** | Scripted tasks (`bench/tasks.json`) performed only through the accessibility tree: roles and accessible names, never CSS selectors. The host must receive the expected capability event |
| **Consistency** | `compare(previous, current)`: pattern, key coverage, component per key, relative order and labels, with a plain-language list of differences |

Default matrix: Material 3, Carbon and Ant Design × light and dark × 390px and 1100px.

## Score (v0)

Start at 100. Each distinct failing error check costs 20, each distinct warning 4, and failed agent runs cost up to 40 in proportion. A document that fails the schema scores 0. The weights are a starting point; the gold set (`bench/gold`) exists to calibrate them against designers' rankings.

## Results today

- All 20 spec examples score 100 across 240 renders; 216/216 agent task runs succeed.
- 20/20 injected defects are caught (`test/defects.test.ts`), across schema, structure, patterns, capabilities, copy, rendered accessibility, layout and agent operability.
- Building the verifier found real renderer bugs, since fixed: graphics-only colours used for text (failed WCAG contrast in Carbon and Ant), selection rows below each pack's target size, "(required)" and option descriptions leaking into accessible names, and root confirmations blocking the host page.
