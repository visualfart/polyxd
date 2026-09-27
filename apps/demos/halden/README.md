# Halden

A current account for one person, on a phone first. Material 3, `en-GB`, calm.

## Why it exists

Halden shows the plainest case for just-in-time interfaces: a consumer app where most of what people want is a screen the product already has (balance, payments, a payee), and a long tail is not: *"what did I spend on eating out this month"*, *"I was charged twice by Bolt"*. Halden answers the long tail by generating the screen, in its own design system, checked before it shows.

## Screens the product has

Polyxd is for surfaces, generated or authored; the shell (top bar, navigation, the FAB, the snackbar) stays
the product's React. Three of the screens are *authored* Polyxd documents in `authored/<id>.json`: written by
a person in the same shape as an intent file, bound to the same views as the generated surfaces, verified in
the same 13 design systems, and rendered through the kit's `JitSurface` inside the shell (`authored.tsx`).
The mark under them reads "Authored · Checked".

| Route | Screen | Written as | Notes |
|---|---|---|---|
| `/` | Home | React | Balance, a "this month" line, recent payments, the ask box |
| `/payments` | Payments | React | Every payment, grouped by day; search; filter by category |
| `/payments/:id` | Payment | React | Merchant, amount, category, card, a map-less "where", report a problem |
| `/payees` | Payees | React | People you've paid; add a payee |
| `/payees/:id` | Payee | React | Their details and your history with them |
| `/budgets` | Budgets | Authored document `screen.budgets` | Per-category budgets with a meter for the month; a category opens the set-budget ask |
| `/cards` | Card | Authored document `screen.card` | The debit card: freeze and unfreeze with undo, online payments switch, limits |
| `/insights` | Insights | Authored document `screen.insights` | Month by month spend; choosing a month refigures the screen; a category opens its spend |
| `/settings` | Settings | React | Name, notifications, appearance, reset the demo |
| `/welcome` | Onboarding | React | Three screens on first visit |

## What people ask for that has no screen

| Intent | Ask | Pattern | Capabilities |
|---|---|---|---|
| `money.send` | "send £40 to Priya for dinner" | multi-step-form → confirm | `transfer.review`, `transfer.confirm` |
| `spend.category` | "what did I spend on eating out this month" | – | `payment.open` |
| `budget.set` | "set a £150 budget for coffee" | undo-over-confirm | `budget.setLimit` |
| `payment.dispute` | "I was charged twice by Bolt" | confirm-destructive (consequential) | `payment.open`, `dispute.raise` |
| `card.freeze` | "freeze my card" | undo-over-confirm | `card.freeze`, `card.unfreeze` |
| `payee.add` | "add my landlord as a payee" | multi-step-form | `payee.create` |
| `subscriptions.list` | "what am I paying for every month" | filter-and-browse | `payment.open`, `subscription.cancel` |
| `spend.compare` | "how does this month compare with last" | – | – |

Each intent's document lives in `intents/<id>.json` with the ask phrases that reach it and the JSON Pointers that give it data; its verifier report in `reports/<id>.json`. The authored screens' documents live in `authored/<id>.json` in the same shape (with no ask phrases) and report to the same `reports/` folder; their buttons are capabilities too (`budget.open`, `card.setOnline`, `card.ask`, `spend.category`, `spend.compare`, `subscriptions.open`), handled in `actions.ts` like any other.

## Data

`seed.ts` builds three months of payments for one person (Maya Okafor, Bristol), with payees, categories, budgets, one card and a handful of subscriptions. Everything persists in the browser; Settings → Reset puts the seed back.
