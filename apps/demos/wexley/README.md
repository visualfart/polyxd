# Wexley Borough Council

A resident's account with a fictional English council, in the GOV.UK Design System. `en-GB`, forms, plain words, one thing per page.

## Why it exists

Wexley is the public-service case for just-in-time interfaces. A council has hundreds of things a resident might need and screens for a few dozen of them; the rest is a phone call or a PDF form. Wexley answers *"I've moved, update the address on my permit"* or *"my bin wasn't collected"* by writing the page for it, in GOV.UK's own patterns (question pages, check your answers, a confirmation that says what happens), checked in 13 design systems before it shows. The generated pages are pages, not sheets: they sit under `/ask/<intent>` with a Back link, breadcrumbs and the "Checked" mark, because that is what GOV.UK would do and what a keyboard or screen reader expects.

Polyxd is for surfaces, generated or authored; the product's shell stays the product's. So three of Wexley's own screens are Polyxd documents a person wrote (`authored/`), rendered inside the same header, phase banner, breadcrumbs and footer as the React screens, and held to the same verifier. Their mark says "Authored".

## Screens the product has

| Route | Screen | Notes |
|---|---|---|
| `/signin` | Sign in | Email, then a 6-digit code "sent" to it (any code works; nothing is sent) |
| `/` | Your account | Things to do, the services you use, messages, the ask box |
| `/permits` | Parking permit | Zone, vehicle, expiry, address; the penalty charge notice; renew, change address, appeal |
| `/permits/fine/pay` | Pay a fine | The council's own page: summary, one green button, a receipt in Messages |
| `/council-tax` | Council tax | Authored document: paid and still to pay, the account, how you pay, bills and payments |
| `/repairs`, `/repairs/:id`, `/repairs/new` | Repairs | Tracker, appointment, notes; report a repair; report a problem with one |
| `/bins`, `/bins/request` | Bins | Authored document: collection days, missed collections (withdraw), bins asked for, garden waste (subscribe or cancel, through a confirmation); request a bin is a React form |
| `/benefits` | Housing benefit | Authored document: the claim, the documents as a task list, what we still need and by when |
| `/messages`, `/messages/:id` | Messages | Letters from the council; every action posts one |
| `/settings` | Your details | Name, contact preferences, reset the demo |
| `/ask`, `/ask/:intent` | Ask | Free text in; the generated page out |

## What people ask for that has no screen

| Intent | Ask | Pattern | Capabilities |
|---|---|---|---|
| `permit.address-change` | "I've moved, update the address on my permit" | multi-step-form (Steps, check your answers with Change links) → confirm | `permit.review`, `answer.change`, `permit.update` |
| `fine.appeal` | "appeal this parking fine" | review-and-submit → confirm-destructive | `appeal.review`, `appeal.submit` |
| `repair.status` | "where is my repair request" | – (status table, visit, actions) | `appointment.change`, `repair.problem` |
| `appointment.rebook` | "change my repair appointment" | multi-step-form, undo | `appointment.rebook` |
| `counciltax.instalments` | "pay my council tax in instalments" | multi-step-form → confirm-destructive | `instalments.review`, `instalments.set` |
| `bin.missed` | "my bin wasn't collected" | multi-step-form, undo | `bin.reportMissed` |
| `permit.renew` | "renew my parking permit" | confirm-destructive | `permit.renew` |
| `benefit.evidence` | "what do you need for my housing benefit claim" | – (status table, uploads) | `evidence.upload` |

Each intent's document lives in `intents/<id>.json` with the ask phrases that reach it and the JSON Pointers that give it data; its verifier report in `reports/<id>.json`. Anything sent to the council (`permit.update`, `permit.renew`, `appeal.submit`, `instalments.set`, `garden.subscribe`, `garden.cancel`) can only be triggered from a Confirm; `direction.json` says so and the verifier holds every document to it.

## Screens that are authored documents

| Route | Document | Capabilities it uses |
|---|---|---|
| `/council-tax` | `authored/screen.council_tax.json` (`screen.council_tax`) | `counciltax.instalments` (opens the instalments ask) |
| `/bins` | `authored/screen.bins.json` (`screen.bins`) | `bin.missed` (opens the missed-collection ask), `bin.requestNew` (the request-a-bin form), `bin.missed.withdraw` (undo), `garden.change` (opens `garden.cancel.confirm` or `garden.subscribe.confirm`, whose Confirm fires `garden.cancel` or `garden.subscribe`) |
| `/benefits` | `authored/screen.benefits.json` (`screen.benefits`) | `benefit.evidence` (opens the evidence ask) |

An authored document has the same shape as an intent file (a data map of `view:` names, a `sample`, the document with its snapshot) with `surface.origin: "authored"`, `presentation: "page"` and no ask phrases: a route renders it, not the ask box. `authored.tsx` looks the document up by id, builds its data from the store with `surfaceData`, and renders it through the kit's `JitSurface` in the page furniture; the surface's title is the page's h1 and takes focus on navigation like every other screen. Every number on them comes from a view in `views.ts` (`councilTaxScreen`, `binsScreen`, `benefitScreen`), every link or button is a capability in `registry.json` handled in `actions.ts`, and the store changing is what redraws the screen, so a missed-collection report, a withdrawn one and an undo all show at once with the notification banner. `scripts/snapshot.ts` and `scripts/verify.ts` cover `authored/` alongside `intents/`; the reports land in `reports/` like the rest.

## Data

`seed.ts` builds one resident (Amira Haddad, 14 Larch Close, Wexley) with a zone C permit for WX21 TFR, a penalty charge notice, a band C council tax account four instalments in, a leaking kitchen tap with a plumber booked, bins on Tuesdays, a housing benefit claim waiting for two documents, and the letters that go with all of it. Everything persists in the browser; Your details → Reset puts the seed back.
