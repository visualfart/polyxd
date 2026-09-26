---
title: Dense software
description: How Polyxd handles B2B interfaces: data tables, bulk actions, navigation, record pages and density.
order: 13.5
section: Concepts
---

# Dense software

Consumer apps and internal tools need different amounts of information on screen. A payment screen shows one amount; an accounts list shows 1,284 rows, each with seven fields, that people scan, sort, select and act on in bulk.

Polyxd handles both with the same principle: **the generator states meaning, the renderer decides density**. The generator never sets a row height. It says "this is a list of records with these columns, people can select several and act on them", and Design Direction plus the renderer decide how tightly that is packed on each screen.

## Density

Design Direction's `profile.density` sets row heights and spacing:

| Density | Row height | For |
|---|---|---|
| `compact` | 32px | Data-heavy tools on pointer surfaces |
| `comfortable` | 40px | Most B2B software (the default) |
| `spacious` | 48px | Consumer apps, touch |

Touch targets keep their minimum whatever the density: inside a dense row, WCAG 2.2's 24px minimum applies, and on phones rows never fall below 44px. The verifier checks this on every render.

## Tables

`Table` is the component most B2B software is made of. Beyond rows and columns it carries:

- **Saved views** (`views`, `view`): All, Mine, Past due, with counts, as tabs above the table.
- **A toolbar** (`search`, `toolbar`): search on the left, actions like New and Export on the right.
- **Sorting** (`sort`): which column and direction the host sorted by. Sortable headers expose `aria-sort` and send an action so the host can re-query.
- **Selection** (`selection: "multiple"`, `selected`, `rowValuePath`): a checkbox column with a select-all that shows a mixed state. While rows are selected, the toolbar becomes a bulk-action bar (`bulkActions`) that names how many are selected and announces it.
- **A menu per row** (`rowActions`): named after its row, so "Actions for Acme Corp" rather than "Actions".
- **Cell kinds** (`columns[].kind`): `entity` (avatar, name, second line), `status` (a tag, coloured by a `tones` map), `currency` and `number` (right-aligned, tabular figures), `date`, `link`.
- **Paging** (`page`): rows per page, "1–50 of 1,284", previous and next.

**On phones a table becomes a list of rows**: the entity, the key fields in one line, and the status. Seven columns don't fit a phone, and a horizontally scrolling table is worse than a list. The per-row action keeps the same name at every width, so an agent's steps don't depend on screen size.

## The shell around the page

- **`Navigation`**: the product's sections, grouped, with counts that need attention. A side navigation on wide surfaces, a menu on compact ones. Use it only when the host doesn't already provide navigation.
- **Page header**: `surface.breadcrumbs`, `surface.subtitle`, `surface.badge` (the record's status), `surface.avatar` and `surface.actions` (an `ActionBar`: what you can do to this record).
- **`Views` with counts**: sections of one record, as tabs.
- **`surface.presentation: "panel"`**: creating or editing something opens beside the list it came from, so the list stays in view. Full screen on compact surfaces.

## Record pages

- **`DetailList layout: "grid"`** packs many short fields into columns, label above value.
- **A group of `Metric`s** renders as one strip of tiles.
- **`Collection layout: "timeline"`** for activity.
- **`Status variant: "inline"`** for a notice inside the page, such as an overdue invoice, with one action beside it.
- **`Form layout: "horizontal"`** for settings: label and help on the left, control on the right, stacking on compact surfaces.

## What stays the same

Everything the rest of the spec guarantees still applies. Bulk actions go through registered capabilities with their risk levels, so "Cancel 3 subscriptions" still needs a confirmation. The verifier checks contrast, target size, reading order and agent tasks on dense screens exactly as it does on a payment screen.
