<img src="brand/mark.svg" alt="" width="56" align="left">

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

**Site and docs:** [polyxd.com](https://polyxd.com) · **Live gallery:** [polyxd.com/gallery](https://polyxd.com/gallery/)

## What works today

| | |
|---|---|
| **Spec** | 44 semantic components (five of them the product's shell, authored only), 6 patterns with self-checking rules, capability registry with risk levels, Design Direction for a designer's taste, JSON Schema, A2UI export |
| **Renderers** | `@polyxd/react` on Radix primitives and `@polyxd/web` as Web Components, both on `@polyxd/core`: token-only CSS, container queries, dense B2B tables and navigation, density scale with a touch floor. A conformance suite holds the two to the same DOM, ARIA, text and findings across every document and pack; any renderer can be held to it ([Renderers](https://polyxd.com/docs/renderers/)) |
| **Design systems** | 13 packs on one token contract: Material 3, Carbon, Ant Design, Fluent 2, shadcn/ui, Bootstrap 5, Mantine, Radix Themes, Shopify Polaris, GitHub Primer, Adobe Spectrum 2, GOV.UK Frontend, Chakra UI. Bring your own tokens with `npx polyxd pack` and it builds a pack from them |
| **Verifier** | Schema, structure, pattern, capability and copy checks; axe-core, contrast and target-size audits in every pack, mode and width; scripted agents completing tasks through the accessibility tree alone |

All 24 examples score 100 across **1,248 renders** (13 packs × 2 widths × light and dark), **936 of 936** agent tasks complete by name alone, and the verifier catches **20 of 20** deliberately injected defects.

**There is no bundled model.** Any generator that emits spec-valid JSON drives Polyxd. See [Bring your generator](#bring-your-generator).

### The design systems

| | Design system | Pack |
|---|---|---|
| <img src="packages/ds-material3/logo.svg" height="20" alt=""> | Material 3 | [`@polyxd/ds-material3`](packages/ds-material3/) |
| <img src="packages/ds-carbon/logo.svg" height="20" alt=""> | IBM Carbon | [`@polyxd/ds-carbon`](packages/ds-carbon/) |
| <img src="packages/ds-antd/logo.svg" height="20" alt=""> | Ant Design | [`@polyxd/ds-antd`](packages/ds-antd/) |
| <img src="packages/ds-fluent/logo.svg" height="20" alt=""> | Microsoft Fluent 2 | [`@polyxd/ds-fluent`](packages/ds-fluent/) |
| <img src="packages/ds-shadcn/logo.svg" height="20" alt=""> | shadcn/ui | [`@polyxd/ds-shadcn`](packages/ds-shadcn/) |
| <picture><source media="(prefers-color-scheme: dark)" srcset="packages/ds-bootstrap/logo-white.svg"><img src="packages/ds-bootstrap/logo.svg" height="20" alt=""></picture> | Bootstrap 5 | [`@polyxd/ds-bootstrap`](packages/ds-bootstrap/) |
| <img src="packages/ds-mantine/logo.svg" height="20" alt=""> | Mantine 8 | [`@polyxd/ds-mantine`](packages/ds-mantine/) |
| <picture><source media="(prefers-color-scheme: dark)" srcset="packages/ds-radix/logo-white.svg"><img src="packages/ds-radix/logo.svg" height="20" alt=""></picture> | Radix Themes 3 | [`@polyxd/ds-radix`](packages/ds-radix/) |
| <img src="packages/ds-polaris/logo.svg" height="20" alt=""> | Shopify Polaris | [`@polyxd/ds-polaris`](packages/ds-polaris/) |
| <img src="packages/ds-primer/logo.svg" height="20" alt=""> | GitHub Primer | [`@polyxd/ds-primer`](packages/ds-primer/) |
| <img src="packages/ds-spectrum/logo.svg" height="20" alt=""> | Adobe Spectrum 2 | [`@polyxd/ds-spectrum`](packages/ds-spectrum/) |
|  | GOV.UK Design System | [`@polyxd/ds-govuk`](packages/ds-govuk/) |
| <img src="packages/ds-chakra/logo.svg" height="20" alt=""> | Chakra UI 3 | [`@polyxd/ds-chakra`](packages/ds-chakra/) |

Each logo is its owner's own file, unaltered, used to identify the design system a pack is modelled on (where a system has no mark of its own, its company's logo). Several owners' guidelines restrict logo use without permission; each pack's README records the source and the guidelines. GOV.UK's crown and logotype are protected, so it is named in words alone. Twelve original templates (`sketch`, `wireframe`, `editorial`, `brutalist`, `glass`, `terminal`, `pastel`, `civic`, `finance`, `health`, `neon`, `mono`) sit beside them, each with a mark drawn from its own tokens.

## Try it

```sh
npm install @polyxd/react @polyxd/spec
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

Validate and verify it:

```sh
npx polyxd-validate my-ui.json                 # schema and structural rules, from @polyxd/spec
npm install -D @polyxd/verifier && npx playwright install chromium
npx polyxd-verify my-ui.json --themes carbon   # rendered light and dark, phone and desktop; axe, contrast, layout
```

Point it at **your** design system:

```sh
npx polyxd pack ./src/tokens.css
```

It reads your CSS custom properties, maps what it can onto the contract, writes a pack plus a mapping file of every guess it made, and reports what's still missing — including any of your own colour pairs that fail contrast. [How it guesses](https://polyxd.com/docs/your-design-system/).

| Package | |
|---|---|
| [`@polyxd/core`](https://www.npmjs.com/package/@polyxd/core) | The framework-free core every renderer shares: types, bindings, formatting, the renderer's decisions, a headless surface |
| [`@polyxd/react`](https://www.npmjs.com/package/@polyxd/react) | The React renderer, with compiled theme CSS for every pack |
| [`@polyxd/web`](https://www.npmjs.com/package/@polyxd/web) | The Web Components renderer: `<polyxd-surface>`, `<polyxd-frame>`, no framework; Vue and Svelte adapters to copy |
| [`@polyxd/spec`](https://www.npmjs.com/package/@polyxd/spec) | Types, JSON Schema, validator, patterns, token contract; `polyxd-validate` |
| [`@polyxd/verifier`](https://www.npmjs.com/package/@polyxd/verifier) | `polyxd-verify`: static, rendered and agent checks |
| `polyxd-spec` (Python) | The schemas, component catalogue and validator for Python, with the same results as `@polyxd/spec`; `polyxd-spec validate`. In [`packages/python-spec`](packages/python-spec), not yet on PyPI |
| [`@polyxd/a2ui`](https://www.npmjs.com/package/@polyxd/a2ui) | Export to A2UI v1.0 |
| [`@polyxd/mcp`](https://www.npmjs.com/package/@polyxd/mcp) | MCP server (`npx -y @polyxd/mcp`): the spec for the host's model, validation and verification, and an MCP App that shows the screen in any pack. Built, not yet on npm |
| [`polyxd`](https://www.npmjs.com/package/polyxd) | The `polyxd` command: `pack` and `check` |
| [`@polyxd/ds-kit`](https://www.npmjs.com/package/@polyxd/ds-kit) | The library behind `polyxd pack` |
| `@polyxd/ds-*` | The thirteen packs as DTCG tokens, for building your own themes, plus twelve original templates to start from (`sketch`, `wireframe`, `editorial`, `brutalist`, `glass`, `terminal`, `pastel`, `civic`, `finance`, `health`, `neon`, `mono`). The renderer already includes their CSS |

### From source

Tested on Node 26; the repository's scripts run TypeScript directly, so you need a Node that strips types without a flag.

```sh
git clone https://github.com/visualfart/polyxd.git && cd polyxd
npm install
npm run dev -w @polyxd/gallery          # every example, in every pack, at phone, tablet and desktop
npm run test:all                        # every workspace's tests, with one total
npm run verify:packs -w @polyxd/verifier   # the 1,248 renders
npm run conformance -w @polyxd/verifier    # both renderers, every document, 13 packs: same DOM, ARIA, text and findings
```

Polyxd is for **surfaces**, generated or authored. A designer can write the same document on purpose, as a screen of the product; it renders in the same design system and is verified by the same rules. Since spec 0.3 the product's shell (the frame, app bar, navigation and footer around every screen) can be a document too: authored once per product, never generated, with the validator refusing shell components anywhere else. See the [demos](https://polyxd.com/demos/): three products in three design systems, with generated and authored screens side by side.

## Who it's for

- **Products with an assistant** that can answer in text but can't show the confirmation dialog, because building a screen per intent is unbounded work. Especially where generated UI has to be safe and accessible, not just plausible.
- **Server-driven UI, with no AI at all.** The document format is the product; anything that emits JSON can drive it.
- **Internal tools** — the long tail of admin screens nobody will fund as code.
- **Design teams** who want to author screens once, in meaning, and have them render in every design system they ship and be checked before release. [Studio](https://studio.polyxd.com) has a Screens editor for exactly that.
- **Anyone whose product someone else's agent will operate.** Every surface is operable through its accessibility tree by construction.

Not for: a handful of intents in one design system (hand-build them), or the flagship flow that *is* your product.

## Bring your generator

Polyxd ships no model. Any model or program that emits spec-valid JSON drives it: Claude, GPT, Gemini, a model you run yourself, a template, or plain code. Give the generator the spec and the data, take the UI document it writes, and pass it to the renderer. The verifier checks what it wrote, in every pack, mode and width, before anyone sees it. Taste comes from [Design Direction](https://polyxd.com/docs/design-direction/), which a designer sets once and the verifier holds every surface to.

## Repository

| | |
|---|---|
| `packages/spec` | The spec: components, patterns, token contract, validator, JSON Schema |
| `packages/python-spec` | The spec for Python: copies of the schemas and components, and a port of the validator checked against the TypeScript one (`npm run test:python`, needs [uv](https://docs.astral.sh/uv/)) |
| `packages/core` | The framework-free core: document types, bindings, formatting, the renderer's decisions, the headless surface |
| `packages/react` | The React renderer and the compiled theme CSS for every pack |
| `packages/web` | The Web Components renderer, its preview bundle, and the Vue and Svelte adapters |
| `packages/verifier` | Static, rendered and agent checks; the benchmark scorer |
| `packages/ds-*` | Thirteen design-system packs, each generated from vendored, version-pinned sources, plus twelve original templates (`"template": true` in the manifest) meant to be copied and changed |
| `packages/ds-kit` | Builds packs — including the `polyxd pack` command for yours |
| `packages/a2ui` | Export to A2UI v1.0 |
| `packages/mcp` | The MCP server and its MCP App |
| `apps/gallery`, `apps/site` | The gallery and polyxd.com |
| `bench/` | Benchmark requests, agent tasks, the gold set and the designer's rankings |
| `model/` | Training and evaluation experiments (paused; see research/report.md) |
| `design/flows` | Source of the approved flow designs the spec and renderer are built against |
| `research/` | The research log |

[PLAN.md](PLAN.md) is the project plan; `docs/decisions/` records why things are the way they are.

## Contributing

Issues and pull requests are welcome. The most useful single contribution is **a pack for a design system that isn't here** — `polyxd pack` does most of the work, and [Design systems](https://polyxd.com/docs/design-systems/) explains the rule every pack follows: where a role fails contrast, move along that system's own ramp, and write down why.

Before a pull request: `npm run test:all` and `npm run check:licences`.

## Licence

Code is [Apache-2.0](LICENSE); the spec and documentation are [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/). [NOTICE](NOTICE) lists every vendored source and its licence.

The design-system packs are Polyxd's work, reading each system's published tokens. Polyxd is not affiliated with, endorsed by or sponsored by any of those projects or their owners, and each name is the trademark of its owner.
