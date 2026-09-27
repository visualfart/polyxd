# Polyxd components

Generated from `components/*.json` (spec 0.3.0). The model chooses these semantic components; each platform renders them with its own native parts. The shell components (category `shell`) are the exception: they belong only in a shell document (`surface.kind` "shell", `surface.origin` "authored"), which a person writes once per product; a generator never uses them.

## Platform mapping

| Component | Category | Web (shadcn/Radix) | iOS (SwiftUI) | Android (Compose M3) | A2UI |
|---|---|---|---|---|---|
| [FilterPanel](#filterpanel) | layout | Sidebar + Sheet (shadcn) | List with a filter sheet | Side sheet / modal bottom sheet | Column |
| [Navigation](#navigation) | layout | Sidebar navigation (shadcn Sidebar) | TabView or a sidebar on iPad | NavigationRail / NavigationDrawer | Column |
| [AppBar](#appbar) | shell | Polaris TopBar, Carbon Header, Fluent Nav header, shadcn sidebar header | Navigation bar with toolbar items | TopAppBar | custom |
| [Custom](#custom) | shell | the host's own component | the host's own view | the host's own composable | custom |
| [Footer](#footer) | shell | GOV.UK footer, Polaris FooterHelp, Bootstrap footer | n/a (settings screen) | n/a | custom |
| [Frame](#frame) | shell | Polaris Frame, Carbon UI Shell, Fluent App layout, shadcn Sidebar layout | NavigationSplitView / TabView with a NavigationStack | Scaffold with TopAppBar, NavigationRail or NavigationBar, and content | custom |
| [Outlet](#outlet) | shell | the router's outlet | NavigationStack content | NavHost | custom |
| [Card](#card) | structure | shadcn Card (CardHeader/CardTitle/CardContent/CardFooter) | GroupBox, or a Button/NavigationLink with card styling in lists | Card / ElevatedCard / OutlinedCard (onClick variant when actionable) | Card |
| [Columns](#columns) | structure | GOV.UK grid row, Polaris Layout, Carbon Grid, Bootstrap row/col | HStack with .layoutPriority | Row with weights | Row |
| [Disclosure](#disclosure) | structure | shadcn Collapsible (or Accordion for several) | DisclosureGroup | Expandable ListItem / AnimatedVisibility with a toggle row | No direct equivalent; exports as Column (content always shown) |
| [Group](#group) | structure | &lt;div role=group&gt; with flex/grid and semantic spacing tokens | VStack / HStack / Grid (ViewThatFits for inline) | Column / Row / FlowRow | Column or Row |
| [Panel](#panel) | structure | shadcn Dialog, Sheet, Drawer, Popover | .sheet, .popover, NavigationStack push | ModalBottomSheet, AlertDialog, DropdownMenu | Modal |
| [Section](#section) | structure | &lt;section&gt; + heading; shadcn has no Section primitive (plain markup with semantic tokens) | Section(header:) inside List/Form, or VStack with .accessibilityAddTraits(.isHeader) on the title | Column with a Text heading marked Modifier.semantics { heading() } | No direct equivalent; exports as Column with a Text(variant: h2) first child |
| [Split](#split) | structure | Fluent SplitView, Carbon side panel, shadcn Resizable | NavigationSplitView | ListDetailPaneScaffold | custom |
| [Views](#views) | structure | shadcn Tabs | Picker(.segmented) switching content, or TabView for top-level | PrimaryTabRow + content | Tabs |
| [Chart](#chart) | content | shadcn Chart (Recharts) | Swift Charts (Chart) | Third-party (e.g. Vico) or Canvas; no built-in M3 chart | No equivalent in the Basic catalog; exports as Text(summary) + List |
| [Code](#code) | content | pre &gt; code with a Copy button | Text with monospaced design in a rounded rectangle | Text with FontFamily.Monospace in a Surface | Text |
| [Collection](#collection) | content | List markup with Card or row template; ScrollArea for long lists | List + ForEach | LazyColumn + items | List (templated children) |
| [DetailList](#detaillist) | content | &lt;dl&gt; with semantic tokens | LabeledContent rows in a Form/List section | ListItem(headlineContent, trailingContent) rows | Column of Row(Text, Text) |
| [Identity](#identity) | content | shadcn Avatar | AsyncImage in a Circle + Text | AsyncImage with CircleShape + Text | Row of Image + Text |
| [Media](#media) | content | &lt;img&gt; / &lt;video&gt; / &lt;audio&gt; / shadcn AspectRatio; QR on &lt;canvas&gt; | AsyncImage / VideoPlayer / CoreImage CIQRCodeGenerator | AsyncImage (Coil) / Media3 PlayerView / ZXing | Image (video, audio and gallery export as Image + Text; a QR code as Text of its value) |
| [Metric](#metric) | content | Card-like block with semantic tokens (no dedicated shadcn primitive) | LabeledContent or a VStack; Gauge for bounded values | Column with Text styles | Column of Text |
| [Progress](#progress) | content | shadcn Progress; meter as a native &lt;meter&gt; | ProgressView, Gauge | LinearProgressIndicator, CircularProgressIndicator | Text |
| [Table](#table) | content | shadcn Table (optionally Data Table with TanStack) | Table on regular width; List of rows on compact width | LazyColumn of rows with a header row (no built-in M3 table) | No direct equivalent; exports as List of Row |
| [Tag](#tag) | content | shadcn Badge | Text with capsule background | AssistChip / Badge | Text |
| [Text](#text) | content | &lt;p&gt; with type tokens | Text | Text | Text |
| [Tree](#tree) | content | Radix Accordion primitives (no shadcn tree) | OutlineGroup / List with children | LazyColumn with expandable rows | Nested Column of Text |
| [Status](#status) | feedback | shadcn Alert / Skeleton / Sonner toast | ContentUnavailableView / ProgressView / inline Label | Snackbar / Card with status color / CircularProgressIndicator | Text + Icon |
| [Choice](#choice) | input | shadcn ToggleGroup / RadioGroup / Select / Combobox (Command + Popover) / Checkbox | Picker (.segmented / .inline / .menu) or multi-select List | SegmentedButton / RadioButton rows / ExposedDropdownMenuBox / Checkbox rows | ChoicePicker |
| [CodeInput](#codeinput) | input | shadcn InputOTP | TextField with .oneTimeCode content type | BasicTextField with KeyboardType.NumberPassword | Custom (no Basic equivalent) |
| [ColorInput](#colorinput) | input | input type=color + Radix RadioGroup for swatches | ColorPicker | Custom (no Material picker) | Custom (no Basic equivalent) |
| [DateInput](#dateinput) | input | shadcn Calendar + Popover (Date Picker) | DatePicker | DatePicker / DateRangePicker | DateTimeInput |
| [FileInput](#fileinput) | input | shadcn Input type=file with a drop zone | fileImporter / PhotosPicker | ActivityResultContracts.GetContent | Custom (no Basic equivalent) |
| [Form](#form) | input | shadcn Form (react-hook-form + zod) | Form | Column of fields + Button (no Form primitive) | Column + Button |
| [RangeInput](#rangeinput) | input | shadcn Slider | Slider | Slider | Slider |
| [Rating](#rating) | input | Radix RadioGroup (no shadcn rating) | HStack of Image(systemName: star) buttons | Row of IconButton | Row of Icon |
| [TextInput](#textinput) | input | shadcn Input / Textarea with Label and FormMessage | TextField / TextEditor with .keyboardType and .textContentType | OutlinedTextField with KeyboardOptions | TextField |
| [Toggle](#toggle) | input | shadcn Switch / Checkbox | Toggle | Switch / Checkbox | CheckBox |
| [Action](#action) | action | shadcn Button (default / secondary / ghost / destructive) | Button with .borderedProminent / .bordered / .borderless; role: .destructive | Button / FilledTonalButton / OutlinedButton / TextButton | Button |
| [ActionBar](#actionbar) | action | Flex row of shadcn Buttons (DialogFooter-style) | .toolbar or .safeAreaInset(edge: .bottom) | BottomAppBar or Row of Buttons | Row of Button |
| [ActionMenu](#actionmenu) | action | shadcn DropdownMenu, ContextMenu; split as a ButtonGroup | Menu, contextMenu | DropdownMenu, combinedClickable for context | Custom (no Basic equivalent) |
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

**Required props:** `items`, `current`. **Optional:** `label`, `kind`, `placement`.

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
- 'breadcrumb' is an ordered trail ending with the current item (aria-current="page"), never behind a menu button
- 'nested' shows each group as an expandable section; the group holding the current item starts open
- 'toc' lists the page's sections as anchors, the section in view highlighted
- 'local' lays the items out as tabs, the current one marked
- 'placement' fixes the layout a Frame gives the main navigation: side (240px column), rail (80px, icons with labels), bar (bottom, up to 5 items), drawer (behind the AppBar's menu button)

## AppBar

The bar at the top of the product: brand or title, a leading action, search, trailing actions and the account.

**Required props:** `title`. **Optional:** `brand`, `leading`, `search`, `actions`, `account`, `variant`, `sticky`.

**Use when**
- The header region of a Frame
- A product that needs a persistent place for search, notifications and the account

**Don't use when**
- Inside a generated surface: the frame owns the header
- A page's own title and actions: that is the surface header (surface.title, surface.actions)

**Accessibility** (role: banner)
- The title is the product's name, not a heading; the screen's h1 stays in main
- The menu button (when present) names the navigation it opens and reports expanded state
- Search is a labelled search landmark when present
- Trailing icon actions have visible tooltips and accessible names

**Agents:** Finds the product's search and account here; opens the navigation on compact layouts through the menu button.

**Rendering rules**
- Height 64px (standard), 48px (compact); large variant adds a 56px title row on wide screens
- Background color.surface.default with a bottom border; elevation.raised once content scrolls under it
- Leading action, brand and title at the start; search grows in the middle on wide layouts and becomes an icon on compact; actions and account at the end
- On compact layouts the title shows the current screen's title when the Frame provides one

## Custom

A slot for a component the host implements itself: a logo, a brand moment, a bespoke widget. The document names it and gives it props; the product renders it, and a fallback stands in when it can't.

**Required props:** `name`, `fallback`. **Optional:** `props`, `label`.

**Use when**
- The parts of a product that are truly its own: a logo, an illustration system, a map, a chart type the spec doesn't have
- Only in authored documents: a shell or a screen a person wrote for that product

**Don't use when**
- Anything a spec component can express: a Custom is invisible to the verifier beyond its fallback
- In a generated document: a generator can't know a host's components (the validator refuses it)

**Accessibility** (role: whatever the host component provides; the fallback carries its own)
- The host component is responsible for its own accessibility; the verifier audits the rendered result
- A decorative Custom is hidden from assistive tech; a meaningful one has a name

**Agents:** Reads the host component if it exposes a role and name; otherwise reads the fallback.

**Rendering rules**
- The renderer looks the name up in the host's registry (the same one that overrides components); found, it renders it with the resolved props
- Not found, it renders the fallback and notes the missing name in development
- Never renders the raw props

## Footer

The bar at the bottom of the product: link groups, the legal line, locale or status.

**Required props:** `legal`. **Optional:** `groups`, `aside`.

**Use when**
- The footer region of a Frame
- Public services and marketing-adjacent products where legal and help links belong at the bottom

**Don't use when**
- Dense tools where nothing lives below the fold: leave the Frame's footer out
- Inside a generated surface

**Accessibility** (role: contentinfo)
- Groups are navigation regions named by their headings
- Links are links, not buttons, when they leave the current screen
- The legal line is readable text, not an image

**Agents:** Reads the legal line and reaches help, privacy and terms by name.

**Rendering rules**
- Groups as columns on wide layouts, stacked on compact; headings in type.label.default
- Background color.surface.subtle with a top border; the legal row in type.body.small, color.text.muted
- Never sticky

## Frame

The product's frame: the regions around its screens (header, navigation, main, aside, footer, banner), with an outlet where screens and generated surfaces appear.

**Required props:** `main`. **Optional:** `header`, `navigation`, `aside`, `footer`, `banner`, `skipTarget`, `width`.

**Use when**
- The root of a shell document: the product's frame, authored once, that every screen sits in
- A product whose navigation, header and footer should render in its design system like everything else

**Don't use when**
- In a generated document: a surface lives inside a frame and never draws one (the validator refuses it)
- A dialog or a sheet over a screen: use Panel

**Accessibility** (role: landmarks: banner (header), navigation, main, complementary (aside), contentinfo (footer))
- Exactly one main; a skip link to it is the first focusable thing
- Each landmark is labelled when there is more than one of its kind
- Regions keep their reading order at every width: banner, header, navigation, main, aside, footer
- The navigation's current item is marked; the document title follows the current screen

**Agents:** Reads the landmarks to know where it is; moves between screens through the navigation by name; acts on what is in main.

**Rendering rules**
- Wide (≥ 1024px): header on top, navigation at the start edge as a side column or a rail, main and aside as columns, footer below
- Medium (≥ 640px): navigation becomes a rail; aside stacks below main
- Compact: navigation becomes a bottom bar (up to 5 items) or a drawer behind a menu button in the header; the footer's groups collapse
- Region backgrounds use color.surface.default for main and color.surface.subtle for navigation; borders are color.border.default at border.width.default
- The outlet is where PolyxdSurface documents render: they never repeat the frame's regions

## Outlet

Where the current screen renders inside a Frame: the host fills it with a screen document or a generated surface.

**Required props:** . **Optional:** `label`, `loading`.

**Use when**
- The main region of a Frame

**Don't use when**
- Anywhere else: an outlet is the frame's, and a document has at most one

**Accessibility** (role: main)
- The screen's h1 is the first heading inside it
- Focus moves to the screen's heading when the outlet's content changes on navigation

**Agents:** Everything it can act on is here; the frame around it is for getting elsewhere.

**Rendering rules**
- Takes the main region's width; padding space.inset.comfortable (compact: default)
- While loading, a skeleton shaped by the coming screen's pattern

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

## Columns

Side-by-side columns that collapse to a stack on compact layouts: a main column with a narrower one beside it, or equal halves.

**Required props:** `children`. **Optional:** `layout`, `collapse`, `align`.

**Use when**
- A form with help beside it; a record with a summary beside it; a list beside a preview
- Anywhere a wide screen should use its width without the compact screen paying for it

**Don't use when**
- Metrics in a row: use Group with arrangement 'inline'
- A master–detail pair that keeps both alive: use Split

**Accessibility** (role: none (layout only))
- Reading order is the children's order at every width
- Collapsing never reorders content

**Agents:** Invisible: reads the children in order.

**Rendering rules**
- Gutter space.inline.loose between columns; stacked with space.stack.loose
- Column widths follow the layout; 'sidebar-*' columns never shrink below 16rem
- Collapses at the surface's width, not the viewport's

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

## Panel

Content over the current view: a dialog, a drawer, a bottom sheet or a popover, opened from an action and dismissed to return.

**Required props:** `title`, `children`. **Optional:** `kind`, `actions`, `open`, `dismissible`, `size`.

**Use when**
- A short task on top of the page: edit one thing, pick one thing, see one record
- Detail the person asked for that shouldn't replace where they are
- A small set of options next to the control that opened them (popover)

**Don't use when**
- Confirming a consequential action: use Confirm, which is a dialog with the right words and order
- A whole flow of several steps: use Steps on its own surface
- Passing feedback: use Status

**Accessibility** (role: dialog (aria-modal for dialog, drawer and sheet) named by the title; popover is a non-modal dialog)
- Focus moves into the panel on open and back to the opener on close
- Tab stays inside a modal panel; Escape dismisses a dismissible one
- The page behind a modal panel is inert
- A sheet can be dismissed by dragging down as well as by the close control

**Agents:** Opens, reads the content and closes it by name; the footer actions are exposed like any ActionBar.

**Rendering rules**
- A backdrop of color.surface.inverse at opacity.overlay for modal kinds
- dialog: max 560px on desktop, full width with space.inset.default on phones; drawer: 420px from the end edge; sheet: from the bottom with radius.large on the top corners; popover: color.surface.overlay with elevation.overlay and an arrow
- The title is type.heading.medium with the close control at the end of the header
- The action bar sits in a footer; on phones it is fixed to the bottom, full width
- Motion uses motion.duration.default and motion.easing.standard; reduced motion fades instead

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

## Split

Master and detail side by side: a list that stays while the chosen item's detail shows beside it; on compact layouts the detail replaces the list.

**Required props:** `primary`, `detail`, `selected`. **Optional:** `empty`, `ratio`, `resizable`.

**Use when**
- Mail, tickets, messages, files: a list people move through while reading
- Settings with many sections on wide screens

**Don't use when**
- Under about 640px of surface width: it becomes a list then a page, so don't use it for a single record
- Two unrelated things side by side: use Columns

**Accessibility** (role: none; the primary and detail keep their own roles)
- Selection in the list moves focus to the detail on compact layouts and announces the item's name
- A Back control returns to the list on compact layouts
- The list keeps its scroll position and selection while the detail changes

**Agents:** Selects an item in the primary by name and reads the detail; on compact layouts it goes back to choose another.

**Rendering rules**
- Wide: two panes with a border between; the list scrolls independently
- Compact: the list, then the detail as a page with a back control when an item is selected
- Selection state in the list uses color.selection.*
- Resizable splits keep the handle at size.target.min wide with a visible focus ring

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
- relationship → scatter (x is a measure too), flow → stacked flows from each x value to each series, hierarchy → treemap of the first series, matrix → heatmap of x values by series, range → bars from the first series to the second
- Series colors use color.data.categorical.N in order; a matrix shades one color by value and prints the value in each cell

## Code

Code, a command or preformatted text, shown as written and copyable.

**Required props:** `text`. **Optional:** `label`, `language`, `copyable`, `wrap`, `secret`.

**Use when**
- A command to run, a snippet to paste, an identifier to copy
- Structured text whose spacing matters

**Don't use when**
- Prose: use Text
- Something the person types: use TextInput

**Accessibility** (role: region named by the label, holding a code element; the copy control is a button named 'Copy <label>')
- Text is real text: selectable and read by screen readers line by line
- Copying is announced ('Copied')
- A secret is masked with the same length, with a 'Show' control

**Agents:** Reads the text verbatim; can activate Copy.

**Rendering rules**
- type.mono at type.body.small on color.surface.subtle, with radius.control
- Overflow scrolls sideways unless wrap is set; never clipped
- The copy control sits in the top-right corner and says 'Copied' for two seconds after use

## Collection

A list of items from host data, each rendered with the same template.

**Required props:** `items`, `label`. **Optional:** `empty`, `selection`, `selected`, `layout`, `datePath`, `page`, `bulkActions`, `reorderable`, `order`.

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
- 'carousel' scrolls horizontally with snap points, Previous and Next buttons and an 'N of M' readout; every item stays reachable by keyboard
- 'calendar' is a month grid with the items on their days; Previous and Next move a month at a time
- Paging shows items per page, the range and the total, as a Table does
- Selection shows the bulk-action bar, naming how many items are selected, while any are
- reorderable: a drag handle per item, plus Move up / Move down buttons; the new order is written to 'order'

## DetailList

Label/value pairs describing one thing (a summary, a receipt, a review step).

**Required props:** `items`. **Optional:** `title`, `variant`, `layout`, `rowAction`.

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
- rowAction: each row ends with a 'Change' link whose accessible name includes the row's label; the total row has none

## Identity

A person, team or organisation: picture, name and details, or several of them together.

**Required props:** `name`. **Optional:** `detail`, `image`, `kind`, `size`, `action`, `group`.

**Use when**
- Who something belongs to, was sent by or is assigned to
- The recipient on a payment, the owner on a record, the members on a team
- A list of people where the face helps recognition

**Don't use when**
- Choosing a person from a list: use Choice with avatarPath
- A person's full record: use Card or DetailList

**Accessibility** (role: group named by the name; the picture is decorative and the name is text)
- The name is real text, never only an image or initials
- A group's accessible name lists the first names and how many more
- With an action, the whole element is one button or link named by the name

**Agents:** Reads the name and detail; a group exposes every member's name.

**Rendering rules**
- Initials come from the name's first letters, on a neutral surface with color.text.default; a pack may derive a stable colour from the name
- Sizes: small 24px, default 40px, large 64px; the name uses type.body.default or type.heading.small for large
- A group overlaps pictures by a quarter, with a '+N' tag for the rest
- Images are never stretched; missing images fall back to initials, never to a broken image

## Media

An image, video, audio clip, gallery or QR code supplied by the host.

**Required props:** . **Optional:** `src`, `alt`, `decorative`, `aspect`, `kind`, `poster`, `transcript`, `items`, `imagePath`, `altPath`, `value`.

**Use when**
- Photos or illustrations that help identify something (a product, a place, a person)
- A recording people play, or a code they scan

**Don't use when**
- Decoration with no information
- Icons for actions (renderer supplies those)

**Accessibility** (role: img (video / audio players, list for a gallery))
- Has alt text unless decorative (then hidden from assistive technology)
- Video and audio have native controls and offer a transcript
- A QR code's alt says what scanning it does

**Agents:** Reads the alt text; a gallery's images by their own alt text; a QR code's value.

**Rendering rules**
- Images never convey information that is not also in text
- 'video' shows 'poster' until played; 'audio' is a compact player; both put 'transcript' under a disclosure
- 'gallery' is a grid of the items' images, each with its own alt text
- 'qr' is drawn on a canvas at a size that scans from a phone, with the alt as its accessible name

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

## Progress

How far along something is, or how much of a bounded amount is used: a bar, a ring or a meter.

**Required props:** `label`, `value`. **Optional:** `max`, `kind`, `caption`, `format`, `tone`, `thresholds`, `indeterminate`.

**Use when**
- A task that takes time, with a known share done
- How much of a quota, budget or capacity is used
- Progress towards a goal (pages read, steps walked)

**Don't use when**
- A number the person came to see: use Metric
- Steps of a task the person moves through: use Steps
- A short wait with nothing to measure: Status 'loading'

**Accessibility** (role: progressbar (bar, ring) or meter, named by the label, with aria-valuenow, aria-valuemin, aria-valuemax and aria-valuetext)
- The readout is real text next to the graphic, never only the fill
- A meter's tone is also said in text ('nearly full'), not only shown by colour
- Indeterminate progress has no value attributes and is announced as busy

**Agents:** Reads label, value and max as text.

**Rendering rules**
- The track uses color.surface.subtle; the fill uses color.action.primary.background, or color.status.<tone>.emphasis for a toned meter
- Height is size.control.small / 3 for a bar; a ring is size.control.default across
- Readout in tabular figures, type.body.small, after the label
- The bar's length means the fraction: never used for an amount with no bound

## Table

Tabular data: many items sharing the same attributes.

**Required props:** `rows`, `caption`, `columns`. **Optional:** `rowAction`, `empty`, `sort`, `selection`, `selected`, `rowValuePath`, `bulkActions`, `rowActions`, `expandable`, `detail`, `toolbar`, `search`, `views`, `view`, `page`.

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
- expandable: each row starts with a toggle (aria-expanded) named after the row; the open row's 'detail' spans the table beneath it

## Tag

A short label, status or count attached to something else.

**Required props:** `label`. **Optional:** `kind`, `tone`, `count`, `remove`.

**Use when**
- The state of a record, next to its name: 'Past due', 'Draft', 'Live'
- A category or label a thing carries
- How many of something, on a navigation item or a section heading
- Chosen items a person can take off again

**Don't use when**
- A whole sentence of feedback: use Status
- Something the person switches on or off: use Toggle
- A metric the person came for: use Metric

**Accessibility** (role: text; for 'count', the label is the accessible name of the number; for a removable tag, a button named 'Remove <label>')
- Tone is conveyed by the label, never only by colour
- A count reads as '<label>: <count>' to a screen reader
- The remove control is at least size.target.min and named for what it removes

**Agents:** Reads label, tone and count; can activate the remove control by its name.

**Rendering rules**
- status uses color.status.<tone>.background and .foreground; label and count use neutral tokens
- count is set in tabular figures
- A tag never wraps: long labels are truncated with the full text on hover and in the accessible name
- Fits inline with text and in a Card header; radius.small unless the pack sets a pill

## Text

A run of text.

**Required props:** `text`. **Optional:** `variant`, `format`, `items`, `itemPath`, `ordered`, `cite`.

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
- 'rich' renders only the four markup forms, as real elements; anything else, including HTML, is shown as typed, and only http, https, mailto and tel links are live
- 'list' renders a ul or ol; entries are shown as text, or by 'itemPath' when they are objects
- 'quote' is a blockquote, the cite on its own line after it
- format 'color' shows a swatch of the value beside it; 'bytes' shows a size like 1.2 MB

## Tree

A hierarchy people expand, browse and pick from: folders, an org chart, nested categories.

**Required props:** `label`, `items`, `labelPath`, `childrenPath`. **Optional:** `valuePath`, `detailPath`, `selection`, `selected`, `expanded`, `action`.

**Use when**
- Things that contain things: folders and files, an organisation, nested categories
- Picking a place in a hierarchy (move to folder, choose a category)

**Don't use when**
- A flat list, however long: use Collection or Table
- Nested navigation of the product itself: use Navigation
- Progressive disclosure of one section: use Disclosure

**Accessibility** (role: tree with treeitem nodes; aria-expanded on nodes with children, aria-selected when selectable)
- Arrow keys move and expand; Home and End jump; typing jumps to a label
- Level and position are exposed (aria-level, aria-setsize, aria-posinset)
- Expanded state is announced; selection is announced

**Agents:** Reads every node by label and level; expands a node by name and selects or activates one by name.

**Rendering rules**
- Indent per level uses space.inline.default; the expander is a chevron at size.target.min
- Leaves have no expander and align with siblings' labels
- Selection uses color.selection.background; the focused node shows color.border.focus
- Beyond 200 nodes the renderer virtualises rows

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

## CodeInput

A one-time code or PIN, typed into one box per character.

**Required props:** `label`, `value`. **Optional:** `length`, `kind`, `help`, `required`, `action`.

**Use when**
- A verification code from email or SMS
- A PIN or a short recovery code

**Don't use when**
- A password: the host's own sign-in flow, never a generated screen
- Any text longer than twelve characters: use TextInput

**Accessibility** (role: a group named by the label; one text input per character, each named 'Digit N of M')
- Typing moves focus forward; Backspace moves it back; pasting the whole code fills every box
- The numeric kind opens the numeric keyboard and accepts autofill of one-time codes
- Errors are said against the group, not one box

**Agents:** Reads the label and length; enters the code.

**Rendering rules**
- Boxes are size.control.large squares with radius.control, type.heading.small, centred, in type.mono
- The active box shows color.border.focus; a filled box shows color.border.strong
- Boxes are grouped in threes or fours by a wider gap past six characters

## ColorInput

Pick a colour: from swatches the host offers, or any colour.

**Required props:** `label`, `value`. **Optional:** `swatches`, `format`, `alpha`, `help`, `required`.

**Use when**
- A colour for a label, a tag, a calendar, a theme
- Choosing from a set of brand colours

**Don't use when**
- A choice that happens to be shown as colours (a plan, a size): use Choice

**Accessibility** (role: swatches are a radiogroup of radios named by their labels; the free picker is a native color input plus a text field for the value)
- Every swatch has a name; colour alone is never the only identification
- The value is editable as text, so it can be typed and read
- The chosen colour is shown beside its text value

**Agents:** Reads the swatch names; picks one by name or types a value.

**Rendering rules**
- Swatches are size.control.default squares with radius.control and a 1px color.border.default ring; the chosen one shows color.border.focus
- The free picker is the platform's, with the text value beside it in type.mono

## DateInput

A date, time, date-time or date range.

**Required props:** `label`, `value`. **Optional:** `kind`, `multiple`, `min`, `max`, `help`, `required`.

**Use when**
- Any date or time entry

**Don't use when**
- Relative choices like 'This month / Last month': use Choice

**Accessibility** (role: group of spinbuttons or a date picker dialog)
- Typing the date is always possible, not only picking from a calendar

**Agents:** Fill by label with an ISO date.

**Rendering rules**
- Memorable dates (birthdays) use separate day/month/year fields; near dates use a calendar
- 'month' and 'year' take only that part; the year field is typed, four digits
- multiple: each chosen date becomes a chip with a remove control; the field adds another

## FileInput

Choose or drop files to attach or upload.

**Required props:** `label`, `value`. **Optional:** `accept`, `multiple`, `maxSize`, `help`, `required`.

**Use when**
- Attaching a document, a receipt, a photo
- Importing a file the product reads

**Don't use when**
- Taking a photo with the camera: the host's own flow
- Pasting text: use TextInput

**Accessibility** (role: a native file input, labelled; the drop zone is a large target for the same input)
- Keyboard opens the chooser; drag-and-drop is an addition, never the only way
- Chosen files are listed as text with a 'Remove <name>' button each
- Type and size limits are said before choosing and in any refusal

**Agents:** Reads the label and limits; attaches files through the host.

**Rendering rules**
- A dashed drop zone on color.surface.subtle with radius.control, the chooser control inside it
- Each chosen file shows name, size and a remove control; a progress bar while the host uploads
- Refusals use color.status.danger text under the zone

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
- 'horizontal' becomes stacked on compact surfaces
- 'aside' sits beside the form on wide surfaces; on compact ones it comes first, before the fields, so people read what they are agreeing to

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

## Rating

A score out of N: given by the person, or shown as others gave it.

**Required props:** `label`, `value`. **Optional:** `max`, `readOnly`, `count`, `help`, `required`, `action`.

**Use when**
- Asking how something went, out of five
- Showing a product's or place's rating with the count behind it

**Don't use when**
- A number within bounds that isn't a score: use RangeInput
- Yes or no: use Toggle or Choice

**Accessibility** (role: radiogroup of radios named '1 star' to 'N stars' when it can be given; an image named '4.6 out of 5' when read-only)
- Every star is a real control at size.target.min when the person can rate
- The current value is announced; half values are said as such
- Read-only ratings carry the score as text, not only as filled shapes

**Agents:** Reads the score and the count; sets a score by choosing '<n> stars'.

**Rendering rules**
- Filled shapes use color.status.warning.emphasis; empty ones use color.border.default
- The readout ('4.6') is shown after the shapes in tabular figures, with the count in color.text.muted
- A rating that can be given shows the label above, like every input

## TextInput

A single text-like value: text, number, email, phone, currency, search or long text.

**Required props:** `label`, `value`. **Optional:** `kind`, `options`, `mask`, `currency`, `help`, `required`, `validation`, `autocomplete`, `placeholder`, `size`.

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
- 'suggestions' and 'mentions' are comboboxes: the list opens as you type, arrow keys move through it, Enter takes an option, Escape closes it
- 'richtext' is an editable area with Bold, Italic and List controls; the value is text with **bold**, *italic* and '- ' items
- 'tags' shows each value as a chip with a remove control; Enter or a comma adds what was typed, Backspace in an empty field removes the last chip; the value is a list of strings
- 'code' uses type.numeric (monospace) and turns off autocorrect, autocapitalize and spellcheck
- 'masked' fills the mask's literal characters as you type and stores the text as shown
- 'inline' renders the value as text with an Edit control; Enter saves, Escape restores the previous value

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

**Required props:** `label`, `action`. **Optional:** `emphasis`, `tone`, `disabled`, `description`, `copy`, `shortcut`.

**Use when**
- Anything the user can do that isn't typing or choosing

**Don't use when**
- Navigating between views: use Views
- Confirming something destructive: wrap in Confirm

**Accessibility** (role: button)
- Label describes the outcome
- Target at least size.target.min
- Disabled actions explain why nearby
- A shortcut is a hint, never the only way: the button itself stays clickable and focusable

**Agents:** Activate by label.

**Rendering rules**
- At most one primary action visible at a time
- danger tone uses color.action.danger.*
- 'description' sits under the label in type.body.small, muted; the button's accessible description
- ui.copy is handled by the renderer: it copies 'copy' (or the context's 'text') and announces 'Copied' politely
- 'shortcut' shows as a keyboard hint (kbd) beside the label, with mod written as ⌘ or Ctrl for the platform; it fires only while focus is inside the surface, never over the host page, and never on a disabled action

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

## ActionMenu

Secondary actions behind one control: an overflow menu, a dropdown, a split button or a context menu.

**Required props:** `label`, `children`. **Optional:** `kind`, `primary`.

**Use when**
- Three or more secondary actions on a row, a card or a page header
- One usual action with rarer alternatives (split: 'Save' with 'Save as draft')
- Actions that belong to the thing under the pointer (context)

**Don't use when**
- One or two actions: use Action or ActionBar, where they are visible
- The main thing to do on the surface: never hidden in a menu
- Navigation between views: use Views or Navigation

**Accessibility** (role: a menu button (aria-haspopup, aria-expanded) opening a menu of menuitems; a split's main part is a plain button)
- Every action is reachable by keyboard: arrows move, Enter activates, Escape closes and returns focus
- An overflow control is named for what it holds ('More actions for Acme Corp'), never just '…'
- A context menu's actions are also reachable another way (an overflow control), since right-click and long-press aren't discoverable

**Agents:** Opens the menu by its name and activates an action by its label.

**Rendering rules**
- The menu uses color.surface.overlay with elevation.overlay and radius.default; items are size.control.default tall with space.inset.default
- A danger-toned Action shows in color.status.danger.emphasis after a divider
- The overflow control is an icon-only button at size.target.min with the label as its accessible name; a dropdown shows the label with a chevron
- A split's two parts share one outline; the menu part is at least size.target.min wide

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

**Required props:** `steps`, `finish`. **Optional:** `kind`, `current`.

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
- 'tasklist' is a list of tasks with a status tag each (GOV.UK task list); a task opens its content in place, and 'finish' follows the list, saying how many are done
- 'guide' shows every step's title and content in a numbered list, with 'finish' after the last
