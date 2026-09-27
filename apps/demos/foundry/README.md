# Foundry

The customer-success desk of Basalt, a data platform sold in three annual, seat-based plans. Dense, keyboard first, shadcn/ui, `en-US`.

## Why it exists

Foundry is the B2B case for just-in-time interfaces: a desk whose screens (accounts, tickets, renewals, the team) cover the routine, and whose long tail is a question a lead asks between two calls: *"who's renewing in 30 days with open tickets"*, *"hand Sam's tickets to Lena"*, *"quote Ledgerline's renewal at 120 seats"*. Foundry answers by generating the screen in its own design system, checked in thirteen before it shows, wired to capabilities the desk actually has.

## Screens the product has

| Route | Screen | Made of | Notes |
|---|---|---|---|
| `/signin` | Sign in | React | Any email and password; you are Noor Haddad, the desk's lead |
| `/` | Overview | React | Renewals in 30/60/90 days, tickets by priority, accounts by health, a "needs attention" list |
| `/accounts` | Accounts | React | Dense table; search; plan, health and owner filters; saved views (All, Renewing soon, At risk, Mine, Canceled) |
| `/accounts/:id` | Account | React header and tabs; the **Overview tab is an authored document** | Plan, health and ARR up top; tabs Overview / Tickets / Contacts / Timeline / Notes; notes you can add |
| `/tickets` | Tickets | React | Mine / Unassigned / All; priority and status filters; first-response target per plan |
| `/tickets/:id` | Ticket | React | The thread, a reply box, assignee, priority, status changes with undo |
| `/renewals` | Renewals | **Authored document** | A pipeline: upcoming, quoted, won, churned; quote from here, mark won (with a confirmation) |
| `/team` | Team | **Authored document** | Members, roles, load against capacity, hand-overs, withdrawing an invite |
| `/settings` | Settings | React | Name, appearance, reset the demo |

`⌘K` (`Ctrl+K`) opens the command palette: the ask box, the screens, and accounts by name. The same box sits in the top bar.

## Screens that are authored documents

Polyxd is for surfaces, generated or authored; the product's shell stays the product's. Three of
Foundry's screens are Polyxd documents a person wrote rather than React: `authored/<id>.json`, in
the same shape as an intent file (a `data` map of views, a `sample` for the snapshot, the
`document`), with `surface.origin: "authored"` and `presentation: "page"`. `authored.tsx` looks a
document up by id, builds its data with `surfaceData`, and renders it through the kit's
`JitSurface` inside the normal shell (sidebar, top bar and palette are React), in shadcn, at the
product's mode and `compact` density, with the product's `onAction`. The mark under each reads
"Authored · Checked in 13 design systems": the verifier holds them to the same checks as the
generated ones, and their reports live in `reports/<id>.json` beside the intents'.

| Document | Route | Views it binds to | Capabilities it uses |
|---|---|---|---|
| `screen.renewals` | `/renewals` | `renewalPipeline` | `accounts.renewingWithTickets`, `account.open`, `renewal.quote`, `renewal.requote`, `renewal.win` → `renewal.won.confirm` → `renewal.markWon` |
| `screen.team` | `/team` | `teamPage`, `roles` | `team.invite`, `member.handover` (opens `tickets.reassign` pre-filled), `invite.withdraw` (undo in the toast) |
| `screen.account.overview` | `/accounts/:id` (Overview tab) | `accountOverview` | `ticket.open`, `account.timeline`, `account.contacts` |

Every figure on these pages comes from a view in `views.ts`; every button is a capability in
`registry.json` that `actions.ts` handles, opening an intent (`next`) or committing to the store
with undo. Marking a renewal won changes the account's plan, seats and price, so it is
consequential and goes through `intents/renewal.won.confirm.json`, like a quote or a plan change.

Two things the renderer doesn't do that the product does in `foundry.css`, by component id: lay a
team member out as one row (the renderer stacks a `Group`, whatever its `arrangement`), and put
the overview's two halves side by side. The verifier's renders don't have that CSS and pass
without it.

## What people ask for that has no screen

| Intent | Ask | Pattern | Capabilities |
|---|---|---|---|
| `accounts.renewing-with-tickets` | "accounts renewing in 30 days with open tickets" | filter-and-browse | `account.open` |
| `subscription.cancel` | "cancel Ledgerline's plan with a prorated refund" | multi-step-form → confirm-destructive | `cancellation.review`, `subscription.cancel` |
| `plans.compare` | "compare Growth and Scale for Ledgerline" | compare-and-choose → confirm-destructive | `plan.review`, `plan.change` |
| `tickets.reassign` | "hand Sam's open tickets to Lena" | – (undo in the toast) | `tickets.assign`, `ticket.open` |
| `team.invite` | "invite these three as viewers" | multi-step-form | `member.invite` |
| `account.health` | "why is Ledgerline at risk" | – | `account.open`, `account.tickets` |
| `renewal.quote` | "quote Ledgerline's renewal at 120 seats" | multi-step-form → confirm-destructive | `renewal.review`, `renewal.quote.send` |

Each intent's document lives in `intents/<id>.json` with the ask phrases that reach it and the views that give it data; its verifier report in `reports/<id>.json`. Intents ending in `.confirm` have no ask phrases: they only follow from another surface.

The filter panel and the quote form are live: `live.tsx` watches a surface's data as its inputs change and writes back what `views.ts` recomputes from the store (the filtered list, the receipt). The shared kit's `JitSurface` doesn't pass the renderer's `onDataChange` through, so Foundry wraps the FilterPanel and Form renderers instead.

## Data

`seed.ts` builds fifty invented customers across industries, eight people on the desk, about 120 tickets over ninety days with per-plan first-response targets, and renewals spread across the coming year. Health is computed from seats in use, the support load and how close the renewal is; the reasons are the sentences a lead would say. Everything persists in the browser; Settings → Reset puts the seed back.
