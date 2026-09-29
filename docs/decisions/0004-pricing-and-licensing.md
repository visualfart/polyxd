# 0004 — Pricing and licensing

Status: **being built** (29 Sep 2026): Studio plans, limits and billing (2 and 3) are built on `feat/studio-billing`; the rest in the order under [Build plan](#build-plan).

## Decision

**Everything that runs on your machine or in your app is free and open. We charge for what we host and for what a team needs to work on its own design system together.**

- No "commercial use" licence and no per-render or runtime fees. Apache code can't enforce them, and they'd stop adoption of the spec.
- The product we sell is **Studio**, priced per editor. Viewers are free.
- Hosted services (publishing screens by key, private packs through the hosted MCP) are part of Studio plans, not metered separately.
- Screens, packs and Directions can always be exported as JSON on every plan, so there's no lock-in.

## Licensing

Neelank is the sole copyright holder (every commit is his; AI co-authors hold no copyright). 0.3.0 and earlier stay Apache-2.0 for good. Every later version can be licensed however we choose.

| Part | From 0.4.0 | Why |
|---|---|---|
| `spec`, `core`, `react`, `web`, `polyxd` CLI, `a2ui`, `python-spec`, all `ds-*` packs | Apache-2.0 (unchanged) | Adoption. Anyone must be able to implement the spec and render it. |
| `verifier`, `runtime`, `server`, `mcp` | Apache-2.0 for now | We can move them to FSL-1.1-Apache-2.0 in a later version if a hosted competitor appears. |
| `apps/studio` | FSL-1.1-ALv2 (done 28 Sep 2026) | Source stays public. Free to self-host for your own team or company; no competing hosted service. Each version becomes Apache-2.0 two years after release. Commits before the change remain Apache-2.0. |
| `apps/vscode` | Apache-2.0 (unchanged) | Funnel into Studio. |

**CLA (Contributor License Agreement).** Before any outside contribution is merged, require a CLA. It keeps our right to relicense future versions. Use CLA Assistant (a GitHub app, which the user installs) with a CLA text in the repo.

**Trademark policy.** "Polyxd", the mark, and "Polyxd Conformant" belong to us:
- Anyone may say their renderer is *Polyxd Conformant* if it passes the conformance suite. This is free.
- Nobody may name a product or hosted service "Polyxd …" without permission.

**Never charge for the packs modelled on named design systems** (Material 3, Carbon, Polaris, …). Their token licences allow it (all MIT or Apache, see NOTICE), but selling them invites trademark trouble.

## Plans

Prices and limits are proposals. **The user sets the final numbers.** Lowered on 29 Sep 2026 from $20 and $45 per editor, which the user judged too much for individuals and small teams.

| | Free | Pro | Team | Enterprise |
|---|---|---|---|---|
| For | trying it, side projects | one designer | small and growing teams | companies with security and procurement needs |
| Price, monthly | $0 | $8 / month | $12 / editor / month | custom, from about $10k / year |
| Price, yearly (2 months free) | $0 | $80 / year | $120 / editor / year | custom |
| Workspaces | 1 | 3 | unlimited | unlimited |
| Editors (owner, design-system, designer, product, engineer) | 2 | 1 | unlimited | unlimited |
| Viewers | unlimited | unlimited | unlimited | unlimited |
| Custom design systems (import or from template) | 1 | unlimited | unlimited | unlimited |
| Directions | 1 | unlimited | unlimited | unlimited |
| Published screens | 10 | unlimited | unlimited | unlimited |
| Fetches by key (screens, Directions, tokens) per month | 10k | 250k | 1M | 10M or more, with an SLA |
| Private packs, screens and Directions through hosted MCP | — | ✓ | ✓ | ✓ |
| Version history | last 10 | full | full | full |
| Approval before publish | — | — | ✓ | ✓ |
| Google sign-in, shared libraries across workspaces | — | — | ✓ | ✓ |
| SAML/SCIM, audit log, support for self-hosted Studio, SLA, indemnity | — | — | — | ✓ |
| Export everything as JSON | ✓ | ✓ | ✓ | ✓ |

**Why these numbers.** Studio sits beside a team's design tool, not in place of it, so it must cost well under a design tool's paid seat. $8 is an easy personal expense. A five-person team pays $60 a month, which a team lead can approve without procurement. Free keeps 2 editors so a pair can try Studio together; Pro is for one person who needs more than Free's limits.

**Founding offer.** The first 100 paying workspaces keep half price for as long as they stay subscribed ($4 for Pro, $6 per editor for Team). It rewards early users while there are none yet, and the cap makes it end on its own.

**Always free, no plan needed:** every open package, the CLI, the local verifier, the VS Code extension, self-hosting `@polyxd/server` and `@polyxd/mcp`, and the hosted MCP for public packs (no sign-in; per-IP rate limit only to stop abuse).

**Limits are soft where production depends on them.** Going over the fetch quota never breaks a live app. We warn in Studio and by email at 80% and 100%, and after a 7-day grace period fetches stay up but editing is locked until the workspace upgrades. Hard limits (editors, design systems, Directions, published screens) only block creating new ones.

**Services:** "We build your design-system pack", a fixed fee (proposal: $3–5k). It leads into Team or Enterprise.

## Build plan

Each workstream is its own branch **from `origin/main`**, not local main, because other sessions commit to main. The rule that docs stay current applies: `apps/site/scripts/check-docs.ts` must pass, and every agent brief names the docs it must update.

### 1. Licensing files (small, do first)

- `CONTRIBUTING.md`: how to contribute, the CLA requirement, DCO sign-off for small fixes.
- `CLA.md`: individual CLA text (based on the Apache ICLA).
- `TRADEMARKS.md`: the policy above.
- ~~`apps/studio/LICENSE`~~: done. FSL-1.1-ALv2, `"license": "FSL-1.1-ALv2"`, README, NOTICE and site docs updated.
- README: a "Licence" section that says what's open, what Studio is, and links to the trademark policy.
- `PLAN.md`: replace "A paid hosted API" under *Not in scope for v1* with a link to this decision.
- **User:** install CLA Assistant on the repo.

### 2. Studio plans and limits

Built on `feat/studio-billing` (29 Sep 2026). Everything here applies only when the Worker's `BILLING` is `on`, which only the hosted Studio sets: a self-hosted Studio has no limits and no Billing page (tested both ways).

- ~~Migration `apps/studio/migrations/0007_plans.sql`~~: done.
  - `workspaces` gains `plan` (default `free`), `plan_status`, `billing_interval`, `seats`, `stripe_customer_id`, `stripe_subscription_id`, `period_end`, `over_quota_since`
  - `usage (workspace_id, metric, period, count, updated_at)`: monthly totals, `period` as `YYYY-MM`
- ~~`apps/studio/src/worker/plans.ts`~~: done. `LIMITS` (the one table), `limitsFor`, `editorCount`, `assertCanCreate`, `assertCanEdit`, `pruneHistory`, `planSummary` (what the Billing page shows). `viewer` is free; every other role is an editor.
- ~~Enforcement points~~: done.
  - `POST /api/workspaces`: a person may own as many workspaces as the most generous plan among the ones they own allows (Free 1, Pro 3)
  - invites and invite accept: editor seats, with open editor invites holding a seat; viewers always allowed. New: `DELETE /api/w/:slug/invites/:id` and `DELETE /api/w/:slug/members/:user` (owners), so a seat can be freed
  - design-system import (a new design system, not a new version of one) and from-template
  - `POST …/directions`
  - screen publish (republishing a published screen doesn't count)
  - Free keeps the last 10 versions of each screen, Direction and design system on save; the published or live one is always kept
- ~~Fetch metering~~: done. A `GET` by API key of a published screen, a Direction or a design-system export writes one Workers Analytics Engine data point (`FETCHES`, dataset `polyxd_studio_fetches`). The cron runs **hourly** (fresher warnings than daily, and the query is cheap), reads this month and last month back through the Analytics Engine SQL API into `usage`, and sets or clears `over_quota_since`. Seven days over: every change answers 402 `over_quota` until the workspace upgrades or the month turns; fetches, reads and billing keep working. The API key's `last_used_at` is now written at most hourly too.
- ~~Errors~~: done. 402 `{ error, code: "plan_limit", limit, plan, current, max }`.
- ~~Tests~~: done, `apps/studio/test/billing.worker.test.ts`.
- Still to do: warning emails at 80% and 100% (the Billing page shows both); approval before publish and shared libraries (Team) are flags in the table, not features yet.

### 3. Billing (Stripe)

Built on `feat/studio-billing` (29 Sep 2026), with Stripe's REST API through fetch (no SDK), tested with Stripe stood in for; not yet run against Stripe test mode.

- ~~Worker routes~~: done.
  - `POST /api/w/:slug/billing/checkout` (owners): `{ plan: "pro" | "team", interval: "month" | "year" }`. Team's quantity is the editor count; Pro is refused for a workspace with more than one editor. The founding coupon (`STRIPE_COUPON_FOUNDING`) is applied while Stripe accepts it, then Checkout opens at full price with promotion codes allowed.
  - `POST /api/w/:slug/billing/portal` (owners)
  - `POST /api/billing/webhook`: `Stripe-Signature` checked with Web Crypto (HMAC-SHA256, constant-time, 5-minute tolerance); `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed`. Sets `plan`, `plan_status`, `billing_interval`, `seats` and `period_end` from the subscription's price; a deleted subscription puts the workspace back on Free. Enterprise is set by hand and left alone.
  - `GET /api/w/:slug/billing`: the plan, limits and usage for the app
- ~~Seat sync~~: done. An editor joining or leaving a Team workspace sets the subscription item's quantity, `proration_behavior: create_prorations`.
- ~~App~~: done. Workspace → Billing (plan, seats, usage bars, notices for 80%, over quota, paused and past due, monthly or yearly, upgrade and manage for owners) and an upgrade dialog on any 402. Team has Remove and Withdraw.
- **User:** create the Stripe account, the business details and tax settings; in test mode first, the products and prices (Pro $8/month and $80/year; Team per unit $12/month and $120/year), the founding coupon (50% off, `duration: forever`, max redemptions 100), the Customer Portal settings (switch between those prices, change quantity, cancel), and a webhook endpoint at `https://studio.polyxd.com/api/billing/webhook` for the five events above. A Cloudflare API token with Account Analytics Read. Then `wrangler secret put … --env production` for `BILLING` (`on`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTH`, `STRIPE_PRICE_PRO_YEAR`, `STRIPE_PRICE_TEAM_MONTH`, `STRIPE_PRICE_TEAM_YEAR`, `STRIPE_COUPON_FOUNDING`, `CF_ACCOUNT_ID`, `CF_ANALYTICS_TOKEN`, and apply migration 0007 remotely. We never enter keys.

### 4. Site

- `/pricing`: picture-first, following the site design rules (one headline, one line, CTA right under it). Four plan cards, the "always free" list, a short FAQ ("Can I use Polyxd commercially? Yes, free." · "What's open?" · "What happens if I go over?" · "Can I leave?"). Enterprise and the pack-building service get a contact button that emails through Resend.
- `/trademarks`: the trademark policy.
- `/terms` (on `feat/legal-listing`, not yet approved): add plans, billing, renewals, refunds, over-quota handling, and the enterprise contract precedence.
- Nav and footer links; a Studio sign-up CTA from pricing; `check-docs.ts` coverage for the new pages; a social card for `/pricing`.
- **User:** approve the terms; OK the deploy.

### 5. Hosted MCP: sign-in for private resources

Depends on `feat/mcp-remote` merging.

- Public packs stay authless. Add a per-IP limit with the Workers Rate Limiting binding.
- Studio as the OAuth provider, using better-auth's MCP/OIDC plugin (Studio already uses better-auth). A signed-in MCP client can list and fetch its workspace's design systems, screens and Directions. Only Pro and above; Free gets a clear message saying which plan unlocks it.
- Update `packages/mcp/listing` and the directory submission notes: sign-in is optional.

### 6. Enterprise (later; tonight only the contact path)

- Self-hosting Studio is free under FSL. Enterprise sells what self-hosters need on top: SAML/SCIM through better-auth plugins, an audit log table, a support SLA and indemnity. A packaged self-host build (Docker, D1 swapped for SQLite or Postgres) when the first enterprise lead asks.

## Later, only when people ask

- Hosted verification in CI (a GitHub check running the full pack × width × light/dark grid), priced by render-minutes.
- Hosted generation with Polyxd paying the model, sold as credits. It conflicts with "no bundled model", so only on demand.
- A pack marketplace with a revenue share for pack authors.

## Open decisions for the user

1. Final prices and Free limits (the table above is a proposal).
2. The legal entity for Stripe and the terms.
3. ~~Self-hosted Studio~~: decided 28 Sep. Free under FSL; Enterprise sells SAML, audit, SLA and indemnity.
4. CLA Assistant, or DCO only (DCO is lighter but doesn't give relicensing rights as clearly).
