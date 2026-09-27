# Quay

The store admin of Lantern & Wick, a small candle and home-fragrance brand shipping from Portland, Oregon. Polaris, desktop first, `en-US`, USD.

## Why it exists

Quay is the commerce case for just-in-time interfaces: an admin whose screens (orders, products, customers, discounts, analytics) mirror what a merchant already knows, and whose long tail is the question a merchant types into support between packing boxes: *"why did sales drop last week"*, *"what's about to sell out"*, *"refund order #1042"*. Quay answers by generating the screen in Polaris, checked in thirteen design systems before it shows, wired to capabilities the store actually has. Money-moving and customer-notifying capabilities only run from a confirmation; the verifier holds the documents to that.

## Screens the product has

| Route | Screen | Notes |
|---|---|---|
| `/` | Home | Today's sales, orders to fulfill, sessions; a "what's next" list; the ask box |
| `/orders` | Orders | Index with views All / Unfulfilled / Unpaid / Open / Archived; search; payment, fulfillment and date filters; bulk Fulfill, Print packing slips, Archive; CSV export |
| `/orders/:id` | Order | Unfulfilled / Fulfilled items, Paid receipt, Timeline with comments, Notes, Customer with addresses, Tags; Fulfill items, Refund, Print, Mark as paid, Archive, Cancel |
| `/orders/drafts` | Draft orders | Send invoice, mark as paid (becomes a real order), delete |
| `/orders/checkouts` | Abandoned checkouts | Email and recovery status; Send reminders |
| `/products` | Products | Product / Status / Inventory / Type / Vendor; views All / Active / Draft / Archived / Low stock; bulk status changes |
| `/products/:id` | Product | Media, Pricing, Inventory, Shipping or the Variants table, Status, Product organization; a contextual save bar while it's dirty |
| `/products/collections` | Collections | Automated and manual, with the rule |
| `/products/inventory` | Inventory | Committed, available (editable), incoming, days of stock |
| `/customers` | Customers | Customer / Email subscription / Location / Orders / Amount spent; views All / New / Returning / Subscribers |
| `/customers/:id` | Customer | Amount spent, orders, last order, notes, marketing, tags |
| `/discounts` | Discounts | Shopify's types and methods; Active / Scheduled / Expired / Inactive; usage |
| `/marketing` | Marketing | Campaigns with pause and resume; sales by source |
| `/analytics` | Analytics | Total sales, orders, sessions, conversion, AOV, returning rate over a range, against the previous period; sales over time; top products |
| `/settings` | Settings | Store details, your account, appearance, reset the demo |

`⌘K` (`Ctrl+K`) opens the palette: the ask box, orders by number, products and customers by name, the screens. The same box sits in the top bar.

## What people ask for that has no screen

| Intent | Ask | Pattern | Capabilities |
|---|---|---|---|
| `revenue.dip` | "why did sales drop last week" | – | `restock.open`, `products.open` |
| `inventory.low` | "what's about to sell out" | filter-and-browse | `product.open`, `restock.open` |
| `inventory.restock` | "restock the lavender candle" | multi-step-form (undo in the toast) | `inventory.adjust` |
| `orders.late` | "which orders are stuck" | – → confirm-destructive | `fulfillment.review`, `orders.fulfill` |
| `discount.create` | "make a discount code for returning customers" | multi-step-form → confirm-destructive | `discount.review`, `discount.create` |
| `order.refund` | "refund order #1042" | multi-step-form → confirm-destructive | `refund.review`, `order.refund` |
| `products.reprice` | "raise prices 5% on candles" | – → confirm-destructive (undo in the toast) | `pricing.review`, `products.reprice` |
| `checkouts.recover` | "send reminders for abandoned checkouts" | – → confirm-destructive | `recovery.review`, `checkouts.recover` |

Each intent's document lives in `intents/<id>.json` with the ask phrases that reach it and the views that give it data; its verifier report in `reports/<id>.json`. Intents ending in `.confirm` have no ask phrases: they only follow from another surface.

The low-stock filters, the restock note, the discount review, the refund receipt and the price preview are live: `views.ts`'s `live` recomputes them from the store as the surface's inputs change, through the kit's `derive`.

## Data

`seed.ts` builds sixty products across candles, diffusers, wax melts, gift sets and accessories with sizes, packs and finishes as variants; 180 orders over ninety days on a weekday/weekend curve with a real dip last week (the two best sellers sold out for six days and the launch campaign was paused for five); ninety customers, some returning; six discounts; the carts people left; two campaigns; daily sessions. Everything on Home, Orders and Analytics is computed from the same orders, so the numbers agree. Product pictures are SVGs drawn from a media reference (`media.ts`), which is also the renderer's `resolveMedia`. Everything persists in the browser; Settings → Reset puts the seed back.
