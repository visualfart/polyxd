# From the flow designs to the system

Every element of the approved flow designs mapped to what the spec, renderer and verifier need. The rule: the model keeps choosing *meaning*; the renderer decides *how it looks* on each screen size. So most changes are new semantics (a range, a hero amount, a filter panel) plus renderer behaviour, not new styling knobs for the model.

## Batch 1: the building blocks most flows share

| Design element | Flows | Spec change | Renderer behaviour |
|---|---|---|---|
| Search bar (icon, placeholder inside, pill) | Send, Browse | `TextInput kind: "search"` gains `placeholder` | Pill search field with icon; label stays as the accessible name, visually hidden |
| Filter chips | Browse, Find a time, Add task | none: a rule | `Choice` with ≤ 6 short options renders as chips (filter chips when `multiple`, choice chips when `single`) |
| Price range | Browse | `RangeInput mode: "range"`, value is `[min, max]` | Two thumbs plus min/max fields |
| Card grid | Browse, Reading | `Collection layout: "list" \| "grid"` | Grid of cards on wide surfaces (2 on phones for media cards), list otherwise |
| Receipt | Send, Confirm, Booking | `DetailList variant: "receipt"`, items may be `total: true` | Values right-aligned with tabular numbers, total row emphasised, "Free" styled positive |
| Hero amount | Send, Confirm | `TextInput size: "hero"` (currency and number); `Confirm.amount` | Large centred amount entry; large amount at the top of the confirmation |
| People and entities with faces | Send, Find a time, Booking | `Choice.options` `avatarPath`/`imagePath`; `Confirm.subject {title, subtitle, avatar}` | Recent people as an avatar row, then a list; confirmation shows who it's for |
| Primary action at the bottom on phones | Every form | none: a rule | On compact surfaces the submit/primary action is pinned to a bottom bar, full width |

## Batch 2: layouts and patterns

| Design element | Flows | Spec change | Renderer behaviour |
|---|---|---|---|
| Filter panel | Browse | New `FilterPanel { children, resultCount, active }` | Sidebar on wide; "Filters · n" chip opening a bottom sheet with "Show n results" on compact; removable chips for active filters |
| Summary beside the form | Send, Booking | `Form.aside` (component id) | Sticky summary card beside the form on wide; inline before the action on compact |
| Recommendation with a reason | Compare | `Comparison.recommendedReason`; attribute `group` | One recommended badge with the reason; grouped attributes; boolean values as check/dash; recommended first on phones |
| Undo instead of confirm | Delete (low risk) | `Status kind: "undo"` with `action`; pattern `undo-over-confirm` | Snackbar with Undo; capabilities with risk `low` that delete use it instead of `Confirm` |
| Richer empty states | Reading | `Status` may reference an `ActionBar` | Icon tile, encouraging copy, one primary and one secondary action |
| Progress on an entity | Reading | `Card.progress` (binding, 0–1) | Progress bar with percentage |
| Consequence list | Delete | `Confirm.consequences[] {icon?, title, detail}` | Icon list; two columns on wide |

## Batch 3: examples, verifier, gold set

- Rebuild the 20 spec examples so they express the approved designs with the new semantics.
- Verifier checks the review asked for:
  - **question order**: the entity the task is about comes before details (who before how much; who before when);
  - **typed confirmation only for destructive, high-impact capabilities** (and required for them);
  - **one recommendation** in a comparison;
  - **consequence next to the action** it describes.
- Rebuild the gold set from the new designs and ask the designer to rank again, to measure whether agreement improves.

## Batch 4: dense B2B software (CRUD, tables, navigation, headers)

Designed in Carbon (canvas rows "B2B …" and "Density"). Same rule as before: the model states meaning (this is a list of records you can select and act on in bulk); density, row height and the shell come from Design Direction and the renderer.

| Design element | Spec change | Renderer behaviour |
|---|---|---|
| Density | Design Direction `profile.density: comfortable \| default \| compact` | Maps to spacing and control heights from the pack (48 / 40 / 32 px rows); compact only on pointer surfaces, touch never below 44 px |
| App shell and navigation | New `Navigation { items[{label, icon, badge, current, action}], groups }` (host may own it instead) | Side nav on wide (current item marked, `aria-current`), menu button on compact |
| Page header | `surface.breadcrumbs`, `surface.subtitle`, `surface.badge`, `surface.actions` (ActionBar id), `surface.lead` (avatar) | Breadcrumbs, title with status tag, one primary plus secondary actions and an overflow menu |
| Tabs on a record | `Views` gains `variant: "tabs"` with counts | Underlined tabs with counts |
| Saved views | `Table.views[{label, count, value}]` bound to host state | Tab row above the table, "Save view" when the host supports it |
| Table toolbar | `Table.search`, `Table.filters` (FilterPanel id), `Table.toolbar` (ActionBar id) | Search on the left, filter button with removable filter tags, icon tools, primary action on the right |
| Sorting | `Table.columns[].sortable`, `Table.sort {column, direction}` bound; sort sends an action | `aria-sort` headers with arrows |
| Selection and bulk actions | `Table.selection: "multiple"`, `selected` binding, `Table.bulkActions` (ActionBar id) | Checkbox column with select-all (mixed state); the toolbar becomes a bulk-action bar naming the count |
| Row actions | `Table.rowActions` (Actions shown in a menu) | Overflow menu per row, named "Actions for {row}" |
| Cell kinds | `columns[].kind: text \| number \| currency \| date \| status \| entity \| link` with `tones` for status | Numbers right-aligned and tabular; status as tags; entity with avatar and link |
| Pagination | `Table.page {index, size, total}` bound; paging sends an action | Rows per page, "1–50 of 1,284", previous and next |
| Record page | `DetailList layout: "grid"` (columns by width); `Metric` group as KPI strip; activity as `Collection variant: "timeline"` | Dense label-above-value grid, KPI tiles, timeline aside on wide |
| Inline notice | `Status kind: "warning"` with `action`, `variant: "inline"` | Bordered notice with one action |
| Create or edit in a side panel | `surface.presentation: "panel"` | Side sheet over the list on wide (list stays visible), full screen on compact; sticky Cancel and Submit |
| Label-left settings rows | `Form.layout: "horizontal"` | Label and help on the left, control on the right, on wide surfaces |
| Tables on phones | none: a rule | A Table becomes a list of rows: entity, key fields in one line, status tag |

Verifier: dense layouts still meet target size (24 px minimum on pointer surfaces, 44 px on touch), bulk-action bars announce the count, sortable headers expose `aria-sort`, row menus are named per row.

## Out of scope for now

- The desktop availability timeline (Find a time). It's domain-specific; the day strip and suggested slots cover the semantics.
- The notifications matrix layout on desktop. Grouped cards cover the semantics; a matrix may come later as a Table rendering rule.
