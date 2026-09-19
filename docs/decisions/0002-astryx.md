# 0002 — Astryx (Meta's open-source design system)

- **Status:** Accepted (2026-09-19)
- **Date:** 2026-09-19
- **Scope:** What Astryx is, what "agent ready" means there, how it relates to Polyxd, and whether to ship a pack, a renderer, borrow ideas, or position against it.
- **Method:** Primary sources read on 2026-09-19: a shallow clone of [facebook/astryx](https://github.com/facebook/astryx) (`main`, pushed 2026-09-19), the GitHub API, the npm registry and download API, the live docs site's `llms.txt` and `/mcp` endpoint, and the repo's own blog posts and issues. Nothing was installed into the Polyxd repo.

## Decision (TL;DR)

**Astryx complements Polyxd. It does not compete with it, and it should not be our foundation.** Astryx is a concrete React component library that is made easy for *coding agents* to write code against, at build time. Polyxd is a runtime semantic layer: a model emits UI *data* and a renderer turns it into native components. The two sit at different layers, so Astryx is a good **renderer target**. Recommendation: **(c) borrow now, (b) add an Astryx renderer adapter after v0.1, (a) only as a token bridge inside that adapter, and (d) don't position against it.** Phase 2 packs are Carbon and Ant Design (decided 2026-09-19); an Astryx look is not one of them.

## 1. What Astryx is

- **Identity.** It describes itself as "An open source design system that's fully customizable and agent ready" ([repo](https://github.com/facebook/astryx)). Meta says it grew internally over eight years and now powers "13,000+ apps" ([README](https://github.com/facebook/astryx/blob/main/README.md)). The public docs site is [astryx.atmeta.com](https://astryx.atmeta.com). The old internal name, **XDS**, still appears in issues and CLI output.
- **Dates.** The GitHub repo was created 2026-01-09. The first npm publish was 2026-06-24. The public launch was **2026-06-18** ([One Month of Astryx](https://github.com/facebook/astryx/blob/main/apps/docsite/src/content/blog/posts/one-month-of-astryx.md)). The project still labels itself "Currently in Beta".
- **Architecture.** It is built on **React 19+ and StyleX**. Consumers import prebuilt CSS, so they need no build plugin. Styles can be overridden with `className` (Tailwind, CSS modules or plain CSS). `swizzle` copies a component's source into your project. The `@astryxdesign/core` 0.6.2 peers are `react`/`react-dom` >=19 and `@stylexjs/stylex` ^0.19. Its only runtime dependency is `intl-messageformat`, so **accessibility is implemented in-house**, with no Radix or React Aria underneath.
- **Platforms.** **Web only.** It does not use react-strict-dom. RSD compatibility ([#3514](https://github.com/facebook/astryx/issues/3514)) and a web + native/Expo contract ([RFC #3912](https://github.com/facebook/astryx/issues/3912)) are both open requests. There is no SwiftUI or Compose work.
- **Packages.** `core`, `cli`, `build`, and seven themes (neutral, butter, chocolate, matcha, stone, gothic, y2k). `charts` and `vega` exist only on the canary tag. `lab` is unpublished.
- **Components.** The README claims "150+". `packages/core/src` has about 120 component folders, and the count includes subparts. The inventory is concrete and rich: AppShell, SideNav/TopNav, Card/ClickableCard/SelectableCard, Table, MetadataList, List/TreeList, Dialog/AlertDialog/BottomSheet, Stepper, RadioList/CheckboxList/Selector/MultiSelector/Typeahead/SegmentedControl, Date/Time/DateRange inputs, Slider, Switch, Banner/Toast/EmptyState/Skeleton/ProgressBar, CommandPalette, and **agentic UI** (Chat, ChatToolCalls, Citation, Markdown, CodeBlock). It also ships page templates and blocks.
- **Token model.** There is **one tier of about 188 semantic CSS custom properties**, declared with StyleX `defineVars` in [`tokens.stylex.ts`](https://github.com/facebook/astryx/blob/main/packages/core/src/theme/tokens.stylex.ts). Examples are `--color-accent`, `--color-background-surface`, `--color-text-secondary`, `--radius-container`, `--spacing-4` and `--duration-fast`. Each token holds both modes as a `light-dark()` value, so light and dark are not separate token sets. The format is **not DTCG**: there is no DTCG or `$value` anywhere in the repo, and the source of truth is TypeScript. On top of the tokens sit "domain" layers (syntax and data-viz), non-portable **theme-local tokens**, and per-component theming targets. The architecture record [theme-tokens.md](https://github.com/facebook/astryx/blob/main/docs/architecture/theme-tokens.md) states "Token names describe semantic roles" (INV3).
- **Theming.** `defineTheme({name, typography: {scale: {base, ratio}, …}, motion: {…}, tokens, components, icons})` is compiled by `astryx theme build` into scoped CSS (`@scope`). Themes can nest, and `astryx theme targets` lists every legal per-component override key. A Figma library exists, but its theme collections are currently empty of variables ([#5923](https://github.com/facebook/astryx/issues/5923)).
- **Accessibility.** An internal **a11y-spec** package writes each WAI-ARIA widget pattern *once, as data*, binds components to it, and checks it in jsdom and in Chromium's accessibility tree ([internal/a11y-spec](https://github.com/facebook/astryx/tree/main/internal/a11y-spec), specs AST-020/021). Usage docs carry do/don't guidance, for example one primary button per view.
- **Maturity and adoption.** Version 0.6.2 is current, with canaries published several times a day (1,457 versions on npm). The project has **13.2k stars and 1.1k forks**, with 427 open issues and PRs. In the last month, `@astryxdesign/core` had **523k downloads** (107k in the last week), `cli` had 346k and `theme-neutral` had 416k. Downloads are likely inflated by CI and canaries. The launch post reports 87 PR authors in month one. I did not check npm dependents.

## 2. What "agent ready" concretely means

In Astryx, "agent ready" means **coding agents can write correct Astryx code**. It does *not* mean that agents can operate the running UI.
- **CLI as the agent interface.** `astryx search | component | docs | template | build | layout` all support `--json`. The JSON comes in typed envelopes with **stable, append-only error codes**, and a `--dense` mode produces "token-efficient" output ([CLI README](https://github.com/facebook/astryx/blob/main/packages/cli/README.md)).
- **Generated agent context.** `astryx init --features agents` writes AGENTS.md, CLAUDE.md or `.cursorrules`, containing a component index, rules such as "no raw divs" and "use tokens", and a template → skeleton → props workflow ([working-with-ai](https://github.com/facebook/astryx/blob/main/packages/cli/assets/docs/working-with-ai.doc.mjs)).
- **Hosted MCP server.** `https://astryx.atmeta.com/mcp` exposes two tools, `search` (a brief of about 1.5K tokens) and `get` (full details). Its index comes from each component's `{Name}.doc.mjs` manifest ([route.ts](https://github.com/facebook/astryx/blob/main/apps/docsite/src/app/mcp/route.ts)). Their own test found that **CLI plus search scored better than MCP** for terminal agents ([#2306](https://github.com/facebook/astryx/issues/2306)). A local, project-aware MCP server is an open RFC ([#5134](https://github.com/facebook/astryx/issues/5134)).
- **`llms.txt`** is live, and it points agents to the CLI.
- **Component manifests.** Each component has a `{Name}.doc.mjs` with props, usage, bestPractices (do/don't), theming targets, keywords and a playground.
- **XLE/XLO.** This is a compressed layout expression language (`VStack[g4] > Text"Hi"`) that is validated and then **expanded to TSX** (`astryx layout check|expand`). It is the part of Astryx closest to UI-as-data, but its output is still code.
- **Vibe tests.** Nightly evaluations measure how well LLMs generate Astryx code compared with baselines, with the expected components hidden from the agent ([internal/vibe-tests](https://github.com/facebook/astryx/tree/main/internal/vibe-tests)).
- **Not present:**
  - Runtime agent semantics. WebMCP tool metadata on components was closed as unscoped ([#2480](https://github.com/facebook/astryx/issues/2480)), and `agentic-states.md` is still a draft.
  - A declarative UI schema, streaming, or A2UI support.

## 3. Astryx compared with Polyxd

| Axis | Astryx | Polyxd |
|---|---|---|
| Vocabulary | About 150 **concrete** React components (Selector, RadioList, SegmentedControl…) | 24 **semantic** components (`Choice` resolves to one of several concrete controls) |
| UI as data | No. The output is TSX written by humans or coding agents. XLE expands to code | Yes. Adjacency-list JSON, with no code, styles or URLs |
| Tokens | One flat semantic tier of ~188 CSS vars, TS source, `light-dark()` modes, theme-local extras | Three DTCG tiers, an 86-token semantic contract, 34 contrast pairs, separate mode sets |
| Cross-platform | Web only. Native is an open RFC | Web first, with a mapping to SwiftUI and Compose in the spec |
| Agent semantics | Docs for coding agents. Nothing for agents operating the UI | Accessibility plus agent semantics per component, with task/done semantics in patterns |
| Generation / JIT | Build time, by an external LLM | Runtime, by a small constrained model |
| Taste | Themes (the look) plus prose do/don't docs, "guidance over enforcement" | Design Direction (profile, voice, rules, exemplars) enforced by the verifier |

**Conclusion.** Astryx and Polyxd overlap on *usage guidance for LLMs* and on *semantic token naming*. Everything that makes Polyxd distinct is absent from Astryx: runtime data, a semantic vocabulary, a verifier, Direction, and capabilities, journeys and memory. Astryx is not a foundation for Polyxd because it is web-only, has no DTCG tokens, ties the renderer to StyleX and React 19, and is pre-1.0 with a very high change rate. It is a strong **target**, because it is a concrete, accessible, themeable web component set with a lot of adoption momentum.

## 4. Recommendation

**(c) Borrow now (Phases 2–4):**
1. **Evaluate the way vibe tests do (Phase 3/4).** Keep the expected components hidden from the model, compare the same prompt under different configurations, and run it nightly. This fits our benchmark and the direction-following metric.
2. **Pattern accessibility contracts as data (Phase 3 verifier).** Write each ARIA pattern once, bind renderer components to it, and run both jsdom and Chromium accessibility-tree harnesses. This is the right shape for our renderer-conformance checks, across renderers.
3. **An agent-facing surface for `@polyxd/spec` (v0.1).** Add a JSON CLI with stable, append-only error codes (for `polyxd verify` too), a `--dense` catalog for generator prompts, `llms.txt`, and a two-tool `search`/`get` MCP with a context budget in `@polyxd/mcp`. Their measurements favour a small tool surface.
4. **Pack-local tokens (Phase 2).** Let design-system packs declare extra tokens outside the portable contract. Renderers and generated UIs must never reference them, which is Astryx's INV8.
5. **Compact notation (Phase 4 experiment).** XLE suggests a compact surface syntax that expands deterministically to our JSON. It could cut output tokens and latency for the 3–4B model, which matters for the first-render budget. Test it against plain JSON under constrained decoding.

**(b) Astryx renderer adapter (after v0.1, before or alongside v0.2).** Add `@polyxd/react-astryx`, which maps our 24 components to Astryx. The mapping is about as rich as shadcn's: Choice → RadioList/Selector/SegmentedControl/CheckboxList, DetailList → MetadataList, Steps → Stepper, Confirm → AlertDialog, Status → Banner/Toast/EmptyState/Skeleton, ActionBar → Toolbar. Chart waits for Astryx's charts to leave canary. This proves the "any design system" promise at the *component-library* level, not only the token level, and it gives Polyxd a path into existing Astryx apps. Prerequisites:
- In **Phase 2**, design `@polyxd/react` around a renderer-adapter interface, so that shadcn is one adapter rather than the only one.
- Run the Phase 3 conformance and a11y checks against both adapters.
- Pin a specific Astryx minor version. It is at 0.x and changes daily.

**(a) Tokens as a bridge, not a first-class pack.** The adapter generates an Astryx `defineTheme` from any Polyxd pack: our semantic tokens map to about 188 Astryx vars, `light-dark()` is built from our mode sets, and gaps (overlay-hover, inset shadows, the `-min`/`-max` durations) are filled with pack-local tokens or derived values. Optionally, add a reverse importer (an Astryx theme to a Polyxd pack) with the Figma/Tokens Studio importer, which is "later". Difficulty is moderate: 1–2 days for the mapping plus contrast-pair checks. **License:** MIT is compatible with our Apache-2.0 code. Keep Meta's copyright and MIT notice in any file derived from Astryx theme values. Theme fonts (DM Sans, Playwrite US Trad, JetBrains Mono) carry their own licenses. Don't ship a pack named `ds-astryx` that looks official without checking Meta's trademark position, so describe it as "compatible with Astryx". Don't make it a Phase 2 pack either (Phase 2 uses Carbon and Ant Design): a shadcn-rendered "Astryx look" proves little compared with a real Astryx adapter.

**(d) Positioning.** State the relationship as "Astryx makes coding agents write good UI code; Polyxd lets a model produce UI at runtime as data, and Astryx can render it." Don't frame it as competition. Their own open gaps (runtime agent semantics, native platforms, UI as data) are Polyxd's core, so watch [#3912](https://github.com/facebook/astryx/issues/3912), [#5134](https://github.com/facebook/astryx/issues/5134) and `agentic-states.md` in case they move into our space.

## 5. Open questions / unverified

- Whether Meta has any trademark policy on "Astryx", and what naming a third-party adapter or pack may use.
- Download numbers include CI, canary and bot traffic. I did not check the real adoption (npm dependents, GitHub "used by").
- The exact component count. "150+" is the project's own claim, and my count of about 120 folders includes non-components and subparts.
- Whether Astryx will adopt DTCG or publish a JSON token export. No issue asks for it. [#918](https://github.com/facebook/astryx/issues/918) (brand theming) is the closest.
- Astryx accessibility quality in real screen readers and agents. The a11y-spec is internal and I did not run it. Affora-style agent success on Astryx UIs is unmeasured, and our Phase 3 agent test could measure it.
- Whether the StyleX runtime and React 19 peer requirements are acceptable in Polyxd host apps and in the MCP Apps bundle size budget.
- Whether XLE's grammar is documented and stable enough to cite, or whether it is internal and still changing.
- The hosted MCP endpoint answered HTTP 200 to `tools/list`. I did not inspect its tool schemas beyond the source.
