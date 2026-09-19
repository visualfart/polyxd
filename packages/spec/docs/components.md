# Polyxd components

Generated from `components/*.json` (spec 0.1.0). The model chooses these semantic components; each platform renders them with its own native parts.

## Platform mapping

| Component | Category | Web (shadcn/Radix) | iOS (SwiftUI) | Android (Compose M3) | A2UI |
|---|---|---|---|---|---|
| [FilterPanel](#filterpanel) | layout | Sidebar + Sheet (shadcn) | List with a filter sheet | Side sheet / modal bottom sheet | Column |
| [Navigation](#navigation) | layout | Sidebar navigation (shadcn Sidebar) | TabView or a sidebar on iPad | NavigationRail / NavigationDrawer | Column |
| [Card](#card) | structure | shadcn Card (CardHeader/CardTitle/CardContent/CardFooter) | GroupBox, or a Button/NavigationLink with card styling in lists | Card / ElevatedCard / OutlinedCard (onClick variant when actionable) | Card |
| [Disclosure](#disclosure) | structure | shadcn Collapsible (or Accordion for several) | DisclosureGroup | Expandable ListItem / AnimatedVisibility with a toggle row | No direct equivalent; exports as Column (content always shown) |
| [Group](#group) | structure | &lt;div role=group&gt; with flex/grid and semantic spacing tokens | VStack / HStack / Grid (ViewThatFits for inline) | Column / Row / FlowRow | Column or Row |
| [Section](#section) | structure | &lt;section&gt; + heading; shadcn has no Section primitive (plain markup with semantic tokens) | Section(header:) inside List/Form, or VStack with .accessibilityAddTraits(.isHeader) on the title | Column with a Text heading marked Modifier.semantics { heading() } | No direct equivalent; exports as Column with a Text(variant: h2) first child |
| [Views](#views) | structure | shadcn Tabs | Picker(.segmented) switching content, or TabView for top-level | PrimaryTabRow + content | Tabs |
| [Chart](#chart) | content | shadcn Chart (Recharts) | Swift Charts (Chart) | Third-party (e.g. Vico) or Canvas; no built-in M3 chart | No equivalent in the Basic catalog; exports as Text(summary) + List |
| [Collection](#collection) | content | List markup with Card or row template; ScrollArea for long lists | List + ForEach | LazyColumn + items | List (templated children) |
| [DetailList](#detaillist) | content | &lt;dl&gt; with semantic tokens | LabeledContent rows in a Form/List section | ListItem(headlineContent, trailingContent) rows | Column of Row(Text, Text) |
| [Media](#media) | content | &lt;img&gt; / shadcn AspectRatio | AsyncImage | AsyncImage (Coil) / Image | Image |
| [Metric](#metric) | content | Card-like block with semantic tokens (no dedicated shadcn primitive) | LabeledContent or a VStack; Gauge for bounded values | Column with Text styles | Column of Text |
| [Table](#table) | content | shadcn Table (optionally Data Table with TanStack) | Table on regular width; List of rows on compact width | LazyColumn of rows with a header row (no built-in M3 table) | No direct equivalent; exports as List of Row |
| [Text](#text) | content | &lt;p&gt; with type tokens | Text | Text | Text |
| [Status](#status) | feedback | shadcn Alert / Skeleton / Sonner toast | ContentUnavailableView / ProgressView / inline Label | Snackbar / Card with status color / CircularProgressIndicator | Text + Icon |
| [Choice](#choice) | input | shadcn ToggleGroup / RadioGroup / Select / Combobox (Command + Popover) / Checkbox | Picker (.segmented / .inline / .menu) or multi-select List | SegmentedButton / RadioButton rows / ExposedDropdownMenuBox / Checkbox rows | ChoicePicker |
| [DateInput](#dateinput) | input | shadcn Calendar + Popover (Date Picker) | DatePicker | DatePicker / DateRangePicker | DateTimeInput |
| [Form](#form) | input | shadcn Form (react-hook-form + zod) | Form | Column of fields + Button (no Form primitive) | Column + Button |
| [RangeInput](#rangeinput) | input | shadcn Slider | Slider | Slider | Slider |
| [TextInput](#textinput) | input | shadcn Input / Textarea with Label and FormMessage | TextField / TextEditor with .keyboardType and .textContentType | OutlinedTextField with KeyboardOptions | TextField |
| [Toggle](#toggle) | input | shadcn Switch / Checkbox | Toggle | Switch / Checkbox | CheckBox |
| [Action](#action) | action | shadcn Button (default / secondary / ghost / destructive) | Button with .borderedProminent / .bordered / .borderless; role: .destructive | Button / FilledTonalButton / OutlinedButton / TextButton | Button |
| [ActionBar](#actionbar) | action | Flex row of shadcn Buttons (DialogFooter-style) | .toolbar or .safeAreaInset(edge: .bottom) | BottomAppBar or Row of Buttons | Row of Button |
| [Comparison](#comparison) | flow | shadcn Table or Cards grid | Grid / Table on regular width; List of GroupBox on compact | LazyRow of Cards or Column of Cards | No direct equivalent; exports as List of Card |
| [Confirm](#confirm) | flow | shadcn AlertDialog | .confirmationDialog / .alert with role: .destructive | AlertDialog | Modal with Text and Buttons |
| [Steps](#steps) | flow | Progress + step content (no shadcn stepper primitive) | NavigationStack pushes or a paged view with a ProgressView | Custom stepper Row + content; LinearProgressIndicator | No direct equivalent; exports as Column of the current step |

## FilterPanel

Filters for a list of results, with the result count.

**Required props:** `children`, `results`. **Optional:** `label`, `resultCount`, `clear`.

**Use when**
- Browsing results people narrow by several attributes
- More than two filters, or filters that take space (ranges, long lists)

**Don't use when**
- One or two quick filters: put a Choice (chips) above the results
- Filling in information: use Form

**Accessibility** (role: region (filters) plus the results)
- The result count is announced politely when it changes
- Each active filter can be removed with a named button ('Remove filter: Desk')

**Agents:** Set filter inputs by label; read the result count; remove filters by their Remove buttons.

**Rendering rules**
- Wide: filters in a sidebar beside the results
- Compact: a 'Filters · n' button opens a bottom sheet whose action says 'Show n results'
- Active filters show as removable chips above the results
- Filters apply as they change (no separate Apply on wide)

## Navigation

The product's main navigation.

**Required props:** `items`, `current`. **Optional:** `label`.

**Use when**
- Software with sections people move between (B2B apps, dashboards)
- Only when the host doesn't already provide navigation

**Don't use when**
- Steps of one task: use Steps
- Sections of one record: use Views
- A surface embedded in a host that has its own navigation

**Accessibility** (role: navigation)
- The current item carries aria-current="page"
- Badges say what they count ('12 overdue')

**Agents:** Move between sections by activating items by their labels.

**Rendering rules**
- Wide: a side navigation with grouped items
- Compact: a menu button that opens the navigation
- Badges sit at the end of their item

## Card

One self-contained entity (an account, an order, a place), optionally actionable as a whole.

**Required props:** `title`. **Optional:** `subtitle`, `media`, `badge`, `children`, `action`, `progress`.

**Use when**
- Items in a Collection that each represent an entity
- A single entity summary in a larger surface

**Don't use when**
- Plain grouping: use Group
- Tabular data with many attributes: use Table

**Accessibility** (role: article (or link/button when it has an action))
- Title is the accessible name
- When actionable, the title is the card's one link; controls inside it (a Toggle, an Action) stay separate targets with their own names

**Agents:** Activate the card by its title; use controls inside it by their own labels.

**Rendering rules**
- If 'action' is set, the whole card opens it; controls in children (e.g. a habit's done Toggle) sit above that target and act on their own
- Uses surface.raised and radius.default
- 'progress' renders a progress bar with its label or percentage

## Disclosure

Progressive disclosure: secondary content hidden behind a toggle.

**Required props:** `summary`, `children`. **Optional:** `open`.

**Use when**
- Details most people don't need (fees breakdown, advanced options, help text)

**Don't use when**
- Content everyone needs to complete the task
- Primary navigation

**Accessibility** (role: button (aria-expanded) + region)
- Summary is a button with expanded state
- Hidden content is not in the tab order while closed

**Agents:** Expand by the summary text; state is exposed as expanded/collapsed.

**Rendering rules**
- Never hide required inputs or the primary action inside a closed Disclosure

## Group

Visually groups closely related items without a heading (proximity).

**Required props:** `children`. **Optional:** `label`, `arrangement`.

**Use when**
- A few items that belong together (a key figure and its caption, several metrics)

**Don't use when**
- The group needs a heading: use Section
- Choosing between items: use Choice or Comparison

**Accessibility** (role: group)
- Has an accessible name when it contains interactive items

**Agents:** Treated as one unit when its label is present.

**Rendering rules**
- 'inline' collapses to a stack below the compact breakpoint
- Gap uses space.stack.default or space.inline.default

## Section

A titled region of the surface that groups related content under a heading.

**Required props:** `title`, `children`. **Optional:** `description`.

**Use when**
- The surface has two or more distinct topics (e.g. 'Recipient' and 'Amount')
- Content would otherwise exceed one screen and needs signposting

**Don't use when**
- Only one topic: put content directly under the root
- Visual grouping without a heading: use Group

**Accessibility** (role: region (with heading))
- Title is rendered as a real heading; nesting depth sets the heading level
- Title is the region's accessible name

**Agents:** Navigate by heading; the title names the region.

**Rendering rules**
- Heading level follows nesting depth, never chosen by the model
- Spacing between sections uses space.stack.section

## Views

Switch between alternative views of the same subject (tabs).

**Required props:** `views`. **Optional:** `selected`, `variant`.

**Use when**
- 2–6 peer views of the same data (Overview / Transactions / Settings)

**Don't use when**
- Sequential steps: use Steps
- Filtering one list: use Choice

**Accessibility** (role: tablist / tab / tabpanel)
- Each tab has a visible label
- Arrow keys move between tabs

**Agents:** Select a view by its label.

**Rendering rules**
- More than 4 views on compact screens become a menu or scrollable tabs
- Counts sit beside their labels and are part of the tab's accessible name

## Chart

A visual summary of data, always paired with a text summary.

**Required props:** `intent`, `data`, `title`, `summary`, `x`, `series`. **Optional:** none.

**Use when**
- A trend, comparison, share or spread matters more than exact values

**Don't use when**
- Exact values matter most: use Table or Metric
- A single number: use Metric

**Accessibility** (role: img (figure) with the summary as description, plus a data-table alternative)
- 'summary' states the takeaway in words
- Series are distinguishable without color (labels, markers)
- The underlying data is available as a table

**Agents:** Reads the summary, and the data through the table alternative.

**Rendering rules**
- trend → line, comparison → bar, composition → stacked bar (pie only for ≤ 4 parts), distribution → histogram
- Series colors use color.data.categorical.N in order

## Collection

A list of items from host data, each rendered with the same template.

**Required props:** `items`, `label`. **Optional:** `empty`, `selection`, `selected`, `layout`.

**Use when**
- Browsing a set of similar entities
- Search results

**Don't use when**
- Attributes compared across items: use Table or Comparison
- Choosing an option in a form: use Choice

**Accessibility** (role: list / listitem (listbox when selectable))
- Announces the item count
- An empty state is provided

**Agents:** Items are enumerated with their titles; each item exposes its own actions.

**Rendering rules**
- Long lists are virtualized by the renderer
- Items keep their order from host data
- grid: 2 columns on phones, more as width allows; list: one item per row
- auto: grid when the item template is a Card with media, otherwise list
- 'timeline' marks each item on a line, newest first, for activity feeds

## DetailList

Label/value pairs describing one thing (a summary, a receipt, a review step).

**Required props:** `items`. **Optional:** `title`, `variant`, `layout`.

**Use when**
- Reviewing before submitting
- Showing the attributes of one entity
- Receipts
- Fees, prices and totals before someone commits (variant 'receipt')

**Don't use when**
- Many entities with the same attributes: use Table
- Comparing entities: use Comparison

**Accessibility** (role: list of term/definition pairs (dl))
- Label and value are programmatically associated

**Agents:** Read each label with its value.

**Rendering rules**
- Keeps the item order stable across generations (keys are remembered)
- receipt: values right-aligned in tabular figures, the total row emphasised; people read amounts from the right
- 'grid' lays fields out in columns by width, label above value

## Media

An image supplied by the host.

**Required props:** `src`. **Optional:** `alt`, `decorative`, `aspect`.

**Use when**
- Photos or illustrations that help identify something (a product, a place, a person)

**Don't use when**
- Decoration with no information
- Icons for actions (renderer supplies those)

**Accessibility** (role: img)
- Has alt text unless decorative (then hidden from assistive technology)

**Agents:** Reads the alt text.

**Rendering rules**
- Images never convey information that is not also in text

## Metric

A key figure with a label, and optionally its change.

**Required props:** `label`, `value`. **Optional:** `format`, `change`, `caption`.

**Use when**
- One to four headline numbers the user asked about

**Don't use when**
- Many numbers: use Table or DetailList
- Trends over time: use Chart

**Accessibility** (role: group (label + value))
- Change direction is conveyed in text as well as color
- Screen readers read label, value and change as one sentence

**Agents:** Read label and value.

**Rendering rules**
- Value uses type.numeric.display
- Change uses color.data.positive / negative according to 'favorable'

## Table

Tabular data: many items sharing the same attributes.

**Required props:** `rows`, `caption`, `columns`. **Optional:** `rowAction`, `empty`, `sort`, `selection`, `selected`, `rowValuePath`, `bulkActions`, `rowActions`, `toolbar`, `search`, `filters`, `views`, `view`, `page`.

**Use when**
- Scanning or comparing many rows by several attributes
- Records people scan, sort, select and act on in bulk (B2B lists)

**Don't use when**
- One entity: use DetailList
- A few entities where the user must choose: use Comparison

**Accessibility** (role: table with caption and column headers)
- Has a caption
- Column headers are real header cells
- Numeric columns are right-aligned by format
- Sortable headers carry aria-sort and say what sorting does
- The select-all checkbox is mixed when some rows are selected
- The bulk-action bar names how many rows are selected, announced politely
- Each row's action menu is named after its row

**Agents:** Read by row and column headers; rows with rowAction are activatable. Sort by activating a column header; select rows by their checkboxes; act in bulk from the bar that appears.

**Rendering rules**
- On compact screens, rows become stacked cards with label/value pairs
- Alignment follows the column format, never chosen by the model
- Numbers and currency are right-aligned with tabular figures; 'status' renders as a tag using 'tones'
- On compact surfaces the table becomes a list of rows: the entity, the key fields in one line, and the status
- Selection replaces the toolbar with the bulk-action bar while rows are selected
- Paging shows rows per page, the range and the total

## Text

A run of text.

**Required props:** `text`. **Optional:** `variant`, `format`.

**Use when**
- Explanations, instructions, messages

**Don't use when**
- Headings: use Section title
- Label/value pairs: use DetailList
- Key figures: use Metric

**Accessibility** (role: text)
- Body text is at least 16px (type.body.default)
- Line length is capped by measure.max

**Agents:** Read as text.

**Rendering rules**
- 'supporting' uses color.text.muted
- No inline styling; emphasis comes from structure

## Status

Feedback about state: info, success, warning, error, empty or loading.

**Required props:** `kind`, `title`. **Optional:** `message`, `action`, `icon`, `variant`.

**Use when**
- Results of an action
- Empty collections
- Errors with a way to recover
- Loading states
- 'undo': after a reversible action ran, say what happened and offer Undo instead of asking first

**Don't use when**
- Validation errors on a field: inputs show their own errors
- Confirmation before acting: use Confirm

**Accessibility** (role: status or alert (live region))
- success/info/loading are polite live regions; error is assertive
- Meaning is in text, not only color or icon

**Agents:** Reads the title and message; the recovery action is exposed.

**Rendering rules**
- error and warning use color.status.* tokens and an icon
- empty states explain why and what to do next
- loading shows a skeleton when layout is known, otherwise a progress indicator
- 'undo' renders as a snackbar at the bottom of the surface, announced politely, with the Undo action
- Empty states may carry an ActionBar: one primary and one secondary action
- 'inline' renders a bordered notice with its action on the right

## Choice

Pick one or several options from a known set. The renderer chooses the control.

**Required props:** `label`, `options`, `value`. **Optional:** `mode`, `help`, `required`.

**Use when**
- Any choice from a known set of options

**Don't use when**
- On/off setting: use Toggle
- Picking between rich entities by comparing attributes: use Comparison

**Accessibility** (role: radiogroup / group of checkboxes / listbox / combobox (depends on rendering))
- Visible group label
- Every option has a text label

**Agents:** Select options by label.

**Rendering rules**
- single, 2–4 short options → segmented control or radios
- single, 5–10 → radios (or select on compact screens)
- single, > 10 → searchable select
- multiple, ≤ 10 → checkboxes; > 10 → searchable multi-select
- Option order comes from host data or remembers the last order used

## DateInput

A date, time, date-time or date range.

**Required props:** `label`, `value`. **Optional:** `kind`, `min`, `max`, `help`, `required`.

**Use when**
- Any date or time entry

**Don't use when**
- Relative choices like 'This month / Last month': use Choice

**Accessibility** (role: group of spinbuttons or a date picker dialog)
- Typing the date is always possible, not only picking from a calendar

**Agents:** Fill by label with an ISO date.

**Rendering rules**
- Memorable dates (birthdays) use separate day/month/year fields; near dates use a calendar

## Form

Collects inputs and submits them together.

**Required props:** `children`, `submit`. **Optional:** `cancel`, `aside`, `layout`.

**Use when**
- Any set of inputs that are submitted together

**Don't use when**
- Settings that apply immediately: use Toggles with actions
- Several distinct stages: use Steps

**Accessibility** (role: form)
- Submit is a real submit button
- On submit errors, focus moves to an error summary that links to each field

**Agents:** Fill fields by label, then activate the submit button by its label.

**Rendering rules**
- One column; labels above fields
- Submit is the primary action; cancel is secondary
- Submit context is built from the form's input bindings
- 'aside' sits beside the form and stays in view on wide surfaces; on compact ones it comes after the fields, just before the submit action
- 'horizontal' becomes stacked on compact surfaces

## RangeInput

A number, or a range between two numbers, within known bounds.

**Required props:** `label`, `value`, `min`, `max`. **Optional:** `step`, `format`, `mode`.

**Use when**
- Approximate values within a range (budget cap, volume)
- A price or date range for filtering (mode 'range')

**Don't use when**
- Exact values: use TextInput with kind 'number' or 'currency'

**Accessibility** (role: slider)
- Current value is shown as text
- Keyboard arrows change the value by step

**Agents:** Set the value directly by label.

**Rendering rules**
- Shows min, max and the current formatted value
- mode 'range' shows two thumbs and min/max fields that stay in sync

## TextInput

A single text-like value: text, number, email, phone, currency, search or long text.

**Required props:** `label`, `value`. **Optional:** `kind`, `currency`, `help`, `required`, `validation`, `autocomplete`, `placeholder`, `size`.

**Use when**
- Free-form values the user types

**Don't use when**
- A value from a known set: use Choice
- Dates: use DateInput
- Secrets (passwords, card numbers): not generated; hosts provide their own secure flows

**Accessibility** (role: textbox / searchbox / spinbutton)
- Visible label, never placeholder-only
- Help and errors are associated with the field
- Kind sets the right keyboard and autocomplete

**Agents:** Fill by label.

**Rendering rules**
- Width suggests expected length
- Errors appear after the user leaves the field or submits, not while typing
- kind 'search' renders as a pill search field with an icon; the label stays as its accessible name
- size 'hero' renders a large centred amount with the currency symbol dimmed

## Toggle

An on/off setting.

**Required props:** `label`, `value`. **Optional:** `description`, `action`.

**Use when**
- Settings that take effect immediately
- A single yes/no inside a form

**Don't use when**
- Choosing between named options: use Choice

**Accessibility** (role: switch (immediate) / checkbox (in a form))
- Label says what 'on' means

**Agents:** Toggle by label; state is exposed as on/off.

**Rendering rules**
- With 'action' it renders as a switch; inside a Form without action, as a checkbox

## Action

A button that triggers a host capability.

**Required props:** `label`, `action`. **Optional:** `emphasis`, `tone`, `disabled`.

**Use when**
- Anything the user can do that isn't typing or choosing

**Don't use when**
- Navigating between views: use Views
- Confirming something destructive: wrap in Confirm

**Accessibility** (role: button)
- Label describes the outcome
- Target at least size.target.min
- Disabled actions explain why nearby

**Agents:** Activate by label.

**Rendering rules**
- At most one primary action visible at a time
- danger tone uses color.action.danger.*

## ActionBar

The set of actions for a surface or section; the renderer places it where that platform expects.

**Required props:** `children`. **Optional:** none.

**Use when**
- Two or more actions that apply to the whole surface or section

**Don't use when**
- A single action inline with content: use Action directly

**Accessibility** (role: toolbar / group)
- Order in the accessibility tree is order of importance

**Agents:** Actions are listed together.

**Rendering rules**
- Web: bottom of the section, primary last on desktop and first on mobile stacks
- iOS/Android: toolbar or bottom bar on compact screens

## Comparison

Compare a few options across the same attributes, and choose one.

**Required props:** `items`, `itemTitle`, `attributes`. **Optional:** `choose`, `recommended`, `summary`, `recommendedReason`.

**Use when**
- Choosing between 2–4 plans, products, routes or offers

**Don't use when**
- More than ~5 items: use Table with sorting
- No decision needed: use Table

**Accessibility** (role: table (items as columns on wide screens) or list of cards)
- Attribute names are headers
- 'better' is conveyed in text, not only color

**Agents:** Reads attributes per item; choose actions are named with the item title.

**Rendering rules**
- Wide: items as columns; compact: one card per item with the same attribute order
- Best values per attribute are marked when 'better' is set
- Exactly one item may be recommended; its badge carries recommendedReason
- Attributes with the same group sit under one heading
- Boolean values render as a check or a dash with text alternatives ('Included' / 'Not included')
- On compact surfaces the recommended item comes first

## Confirm

Asks the user to confirm a consequential or destructive action, showing what will happen.

**Required props:** `title`, `severity`, `confirm`. **Optional:** `message`, `consequence`, `summary`, `cancel`, `typeToConfirm`, `amount`, `subject`, `consequences`.

**Use when**
- Moving money, deleting data, sending on someone's behalf, anything irreversible

**Don't use when**
- Routine reversible actions (prefer undo)
- Information only: use Status

**Accessibility** (role: alertdialog)
- Focus starts on the least destructive option
- Confirm label repeats the action verb
- Escape cancels

**Agents:** Reads title and consequence; confirm and cancel are named buttons.

**Rendering rules**
- destructive uses color.action.danger.*
- Capabilities with high risk level must use Confirm (enforced by the verifier)
- the consequence sits directly above the confirm button
- amount and subject lead the dialog when set
- consequences render as an icon list, two columns on wide surfaces

## Steps

A task split into ordered steps with visible progress.

**Required props:** `steps`, `finish`. **Optional:** `current`.

**Use when**
- Tasks with dependent stages or too many inputs for one view (checkout, onboarding)

**Don't use when**
- Independent views: use Views
- Under ~6 inputs: a single Form

**Accessibility** (role: group with step progress (aria-current on the current step))
- Current step and total are announced
- Back never loses entered data

**Agents:** Reads 'step N of M'; next/back are exposed as buttons.

**Rendering rules**
- Renderer provides Back (ui.back) and Next (ui.next); the last step shows 'finish'
- Each step validates before moving on
