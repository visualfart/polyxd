# Polyxd

**An open spec, renderer and verifier for interfaces generated on demand** — rendered natively in your design system, operable by people and agents alike, and checked before anyone sees them.

A request comes in. Something — a model, a backend, a rules engine, a person — writes a **UI document**: a small JSON file of semantic components ("a choice", "a confirmation", "a table") bound to data your app provides. A renderer turns it into your design system's components. A verifier checks it for accessibility, safety and whether an agent can operate it. Then it's used, and thrown away.

```
request ──► generator (any model or program that emits spec-valid JSON)
                      │  UI document: meaning only — no pixels, colours or fonts
                      ▼
              renderer (@polyxd/react, themed by a design-system pack)
                      │
                      ▼
              verifier → score, findings, agent task results
```

**Site and docs:** [polyxd.com](https://polyxd.com) · **Live gallery:** [polyxd.com/gallery](https://polyxd.com/gallery/) · **Research log:** [polyxd.com/docs/research](https://polyxd.com/docs/research/)

## What works today

| | |
|---|---|
| **Spec** | 26 semantic components, 6 patterns with self-checking rules, capability registry with risk levels, Design Direction for a designer's taste, JSON Schema, A2UI export |
| **Renderer** | `@polyxd/react` on Radix primitives: token-only CSS, container queries, dense B2B tables and navigation, density scale with a touch floor |
| **Design systems** | 13 packs on one token contract — Material 3, Carbon, Ant Design, Fluent 2, shadcn/ui, Bootstrap 5, Mantine, Radix Themes, Shopify Polaris, GitHub Primer, Adobe Spectrum 2, GOV.UK Frontend, Chakra UI — plus a command to make one from your own tokens |
| **Verifier** | Schema, structure, pattern, capability and copy checks; axe-core, contrast and target-size audits in every pack, mode and width; scripted agents completing tasks through the accessibility tree alone |

All 24 examples score 100 across **1,248 renders** (13 packs × 2 widths × light and dark), **936 of 936** agent tasks complete by name alone, and the verifier catches **20 of 20** deliberately injected defects.

**What doesn't work yet: the model.** A small on-device model to generate these documents is in development, and it isn't good enough to release. Any model that can emit JSON can drive Polyxd today. See [The model](#the-model).

## Try it

The packages aren't on npm yet, so work inside the repo. Tested on Node 26; the scripts run TypeScript directly, so you need a Node that strips types without a flag.

```sh
git clone https://github.com/visualfart/polyxd.git && cd polyxd
npm install
npm run dev -w @polyxd/gallery          # every example, in every pack, at phone, tablet and desktop
npm run test:all                        # every workspace's tests, with one total
npm run verify:packs -w @polyxd/verifier   # the 1,248 renders
```

Render a document:

```tsx
import { PolyxdSurface } from "@polyxd/react";
import "@polyxd/react/styles.css";
import "@polyxd/react/themes/carbon.css";

<PolyxdSurface
  document={doc}                     // a UI document
  data={{ quote }}                   // your data; the document binds to it
  theme="carbon"
  mode="light"
  onAction={({ name, context }) => {  // capabilities the document may trigger
    if (name === "transfer.confirm") sendMoney(context.quoteId);
  }}
/>
```

Point it at **your** design system:

```sh
node packages/ds-kit/src/polyxd.ts pack ./src/tokens.css
```

It reads your CSS custom properties, maps what it can onto the contract, writes a pack plus a mapping file of every guess it made, and reports what's still missing — including any of your own colour pairs that fail contrast. [How it guesses](https://polyxd.com/docs/your-design-system/).

## Who it's for

- **Products with an assistant** that can answer in text but can't show the confirmation dialog, because building a screen per intent is unbounded work. Especially where generated UI has to be safe and accessible, not just plausible.
- **Server-driven UI, with no AI at all.** The document format is the product; anything that emits JSON can drive it.
- **Internal tools** — the long tail of admin screens nobody will fund as code.
- **Anyone whose product someone else's agent will operate.** Every surface is operable through its accessibility tree by construction.

Not for: a handful of intents in one design system (hand-build them), or the flagship flow that *is* your product.

## The model

A LoRA fine-tune of Gemma 4 E4B (4-bit), trained with MLX on verifier-selected examples. Best so far is `sft-v2`, scoring **78** on a 50-request held-out benchmark; the base model scores 68. Two rounds of expert iteration haven't beaten it. Adapters are not published.

The more useful result so far is about measurement. A designer ranked the model's own output; two independent blind runs of a frontier model ranked the same screenshots.

| | agreement (Kendall tau-b) |
|---|---|
| model judge vs model judge | 0.71 |
| designer vs designer, on a re-rank | 0.67 |
| model judge vs designer | 0.10 |

Both raters are reliable; they measure different things. Correctness is recoverable from a screen and taste isn't — so taste has to come from a designer's preferences, which is what [Design Direction](https://polyxd.com/docs/design-direction/) and preference training are for. One designer and small samples; the [research log](https://polyxd.com/docs/research/) has the caveats and every negative result.

## Repository

| | |
|---|---|
| `packages/spec` | The spec: components, patterns, token contract, validator, JSON Schema |
| `packages/react` | The React renderer and the compiled theme CSS for every pack |
| `packages/verifier` | Static, rendered and agent checks; the benchmark scorer and leaderboard |
| `packages/ds-*` | Thirteen design-system packs, each generated from vendored, version-pinned sources |
| `packages/ds-kit` | Builds packs — including the `polyxd pack` command for yours |
| `packages/a2ui` | Export to A2UI v1.0 |
| `apps/gallery`, `apps/site` | The gallery and polyxd.com |
| `bench/` | Benchmark requests, agent tasks, the gold set and the designer's rankings |
| `model/` | Training, generation and evaluation (Python, MLX) |
| `design/flows` | Source of the approved flow designs the spec and renderer are built against |
| `research/` | The research log |

[PLAN.md](PLAN.md) is the project plan; `docs/decisions/` records why things are the way they are.

## Contributing

Issues and pull requests are welcome. The most useful single contribution is **a pack for a design system that isn't here** — `polyxd pack` does most of the work, and [Design systems](https://polyxd.com/docs/design-systems/) explains the rule every pack follows: where a role fails contrast, move along that system's own ramp, and write down why.

Before a pull request: `npm run test:all` and `npm run check:licences`.

## Licence

Code is [Apache-2.0](LICENSE); the spec and documentation are [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/). [NOTICE](NOTICE) lists every vendored source and its licence.

The design-system packs are Polyxd's work, reading each system's published tokens. Polyxd is not affiliated with, endorsed by or sponsored by any of those projects or their owners, and each name is the trademark of its owner.
