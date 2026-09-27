# Halden

A current account for one person, on a phone first. Material 3, `en-GB`, calm.

## Why it exists

Halden shows the plainest case for just-in-time interfaces: a consumer app where most of what people want is a screen the product already has (balance, payments, a payee), and a long tail is not: *"what did I spend on eating out this month"*, *"I was charged twice by Bolt"*. Halden answers the long tail by generating the screen, in its own design system, checked before it shows.

## Screens the product has

| Route | Screen | Notes |
|---|---|---|
| `/` | Home | Balance, a "this month" line, recent payments, the ask box |
| `/payments` | Payments | Every payment, grouped by day; search; filter by category |
| `/payments/:id` | Payment | Merchant, amount, category, card, a map-less "where", report a problem |
| `/payees` | Payees | People you've paid; add a payee |
| `/payees/:id` | Payee | Their details and your history with them |
| `/budgets` | Budgets | Per-category budgets with progress for the month |
| `/cards` | Cards | The debit card: frozen or not, limits, PIN reminder |
| `/insights` | Insights | Month by month spend, top categories |
| `/settings` | Settings | Name, notifications, appearance, reset the demo |
| `/welcome` | Onboarding | Three screens on first visit |

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

Each intent's document lives in `intents/<id>.json` with the ask phrases that reach it and the JSON Pointers that give it data; its verifier report in `reports/<id>.json`.

## Data

`seed.ts` builds three months of payments for one person (Maya Okafor, Bristol), with payees, categories, budgets, one card and a handful of subscriptions. Everything persists in the browser; Settings → Reset puts the seed back.
