/**
 * Per-component export decision: Basic catalog component, or a custom component in the Polyxd A2UI catalog.
 *
 * Rule: a Polyxd component maps to a Basic component only when every Polyxd prop has a Basic
 * equivalent with the same meaning. Otherwise it is exported as a custom component with the same name and
 * props, so the export stays a lossless projection rather than a lossy flattening
 * (docs/decisions/0001 §6: "a faithful export", custom catalogs being the endorsed A2UI path).
 * Of the 44 components, only Columns meets the rule (a Row of its children, collapsing being the
 * renderer's business). `basicAnalog` records the nearest Basic construct and `why` records what
 * flattening into it would lose. The shell components (Frame, AppBar, Footer, Outlet, Custom) are in
 * the catalog so an authored shell exports faithfully, and out of its generator instructions: a
 * shell is authored, never generated.
 */
export interface MappingDecision {
  target: "basic" | "custom";
  /** Nearest construct in the A2UI v1.0 Basic catalog */
  basicAnalog: string;
  /** What exporting to the Basic analog would lose */
  why: string;
}

export const MAPPING: Record<string, MappingDecision> = {
  Tag: { target: "custom", basicAnalog: "Text", why: "Text has no tone, no count and no remove control; a status tag's meaning is its tone." },
  Identity: { target: "custom", basicAnalog: "Row of Image + Text", why: "Row is layout; it loses the person/team kind, the initials fallback, the group's '+N' and the activation." },
  Tree: { target: "custom", basicAnalog: "Nested Column of Text", why: "Column can't express expand/collapse, levels, selection or the per-node action." },
  Progress: { target: "custom", basicAnalog: "Text", why: "Basic has no progress or meter; the fraction, bound and tone thresholds would be lost." },
  Rating: { target: "custom", basicAnalog: "Row of Icon", why: "Icons can't be a radiogroup that writes a value, and lose the count and read-only distinction." },
  Code: { target: "custom", basicAnalog: "Text", why: "Text loses preformatting, the language, the copy control and the secret mask." },
  FileInput: { target: "custom", basicAnalog: "none", why: "Basic has no file input; the accepted types, size limit and multiple flag have no home." },
  ColorInput: { target: "custom", basicAnalog: "none", why: "Basic has no colour input; swatches with names and the format would be lost." },
  CodeInput: { target: "custom", basicAnalog: "TextField", why: "TextField loses the one-box-per-character entry, the length, the numeric kind and the complete action." },
  Panel: { target: "custom", basicAnalog: "Modal", why: "Modal has no kind (drawer, sheet, popover), no bound open state, no footer action bar and no dismissible flag." },
  ActionMenu: { target: "custom", basicAnalog: "Column of Button", why: "A column of buttons is not a menu: it loses the single trigger, its accessible name, the split primary and the context kind." },
  Action: {
    target: "custom",
    basicAnalog: "Button + Text child",
    why: "Button needs a synthesized Text child and has only default/primary/borderless; it has no danger tone and no disabled state.",
  },
  ActionBar: {
    target: "custom",
    basicAnalog: "Row of Button",
    why: "Row is pure layout. It loses the 'set of actions ordered by importance' semantics and the stacking on narrow screens.",
  },
  Card: {
    target: "custom",
    basicAnalog: "Card > Column(Image, Text, Text, ...)",
    why: "Basic Card is a single-child container with no action. Title, subtitle, badge (with tone), media slot and whole-card action would need synthesized components or would be dropped.",
  },
  Chart: {
    target: "custom",
    basicAnalog: "Text(summary) + List",
    why: "Basic has no chart. Intent, axes, series and formats would be dropped.",
  },
  Choice: {
    target: "custom",
    basicAnalog: "ChoicePicker",
    why: "ChoicePicker options must be literal (Polyxd options can come from host data), option descriptions are missing, the value must be a string list, and there is no help text.",
  },
  Collection: {
    target: "custom",
    basicAnalog: "List (templated children)",
    why: "List has no label, no empty state and no selection model.",
  },
  Comparison: {
    target: "custom",
    basicAnalog: "List of Card",
    why: "Basic has no comparison. Attribute rows, 'better' direction, recommendation and per-item choose action would be flattened away.",
  },
  Confirm: {
    target: "custom",
    basicAnalog: "Modal(trigger, content: Column(Text, Button, Button))",
    why: "Modal needs a trigger component. Severity, consequence, type-to-confirm and the default cancel behaviour have no Basic form.",
  },
  DateInput: {
    target: "custom",
    basicAnalog: "DateTimeInput",
    why: "DateTimeInput has no date-range kind and no help text, and 'required' becomes a check function.",
  },
  DetailList: {
    target: "custom",
    basicAnalog: "Column of Row(Text, Text)",
    why: "The label/value pairing (a description list for assistive tech), stable item keys and value formats would be lost.",
  },
  Navigation: {
    target: "custom",
    basicAnalog: "Column of Button",
    why: "A column of buttons loses which section you are in, the grouping, the counts needing attention, and the side-navigation-or-menu behaviour.",
  },
  FilterPanel: {
    target: "custom",
    basicAnalog: "Column of inputs beside a List, with a Modal on narrow screens",
    why: "Column and Modal are layout. They lose the link between filters and the results they narrow, the result count, removable active-filter chips and the sidebar-or-sheet behaviour.",
  },
  Disclosure: {
    target: "custom",
    basicAnalog: "Column (content always shown)",
    why: "Basic has no expand/collapse.",
  },
  Form: {
    target: "custom",
    basicAnalog: "Column + Button",
    why: "Submit/cancel semantics (Enter submits, cancel defaults to dismiss) and form grouping have no Basic form.",
  },
  Group: {
    target: "custom",
    basicAnalog: "Column or Row",
    why: "Basic forces one axis. The adaptive 'auto'/'inline'/'grid' arrangement hint would be lost.",
  },
  Media: {
    target: "custom",
    basicAnalog: "Image",
    why: "Image takes a URL string. Polyxd's src is a host-data binding, and 'decorative' and the aspect hint have no Image equivalent (Image.variant is a size, not an aspect).",
  },
  Metric: {
    target: "custom",
    basicAnalog: "Column of Text",
    why: "Value format, change value and favourable direction (the colour follows the meaning) would be lost.",
  },
  RangeInput: {
    target: "custom",
    basicAnalog: "Slider",
    why: "Slider has a step count, not a step size, and no value format.",
  },
  Section: {
    target: "custom",
    basicAnalog: "Column with a Text heading",
    why: "Basic Text has no heading level, so the section heading and landmark would be lost.",
  },
  Status: {
    target: "custom",
    basicAnalog: "Row(Icon, Text)",
    why: "Status kinds (loading, empty, error, ...) and their live-region semantics would be lost.",
  },
  Steps: {
    target: "custom",
    basicAnalog: "Column of the current step",
    why: "Basic has no stepper. Step keys, progress and the finish action would be lost.",
  },
  Table: {
    target: "custom",
    basicAnalog: "List of Row",
    why: "Basic has no table. Caption, column headers, formats, row action and empty state would be lost.",
  },
  Text: {
    target: "custom",
    basicAnalog: "Text",
    why: "Basic Text interprets Markdown (Polyxd text is plain), has no 'supporting' variant and no value format.",
  },
  TextInput: {
    target: "custom",
    basicAnalog: "TextField",
    why: "TextField has no currency/email/phone/url/search kinds, help text or autocomplete hint, and validation becomes Basic check functions.",
  },
  Toggle: {
    target: "custom",
    basicAnalog: "CheckBox",
    why: "CheckBox has no description and no immediate-apply action (a setting that saves on change).",
  },
  Views: {
    target: "custom",
    basicAnalog: "Tabs",
    why: "Tabs has no stable view keys and no binding for the selected view.",
  },
  // Spec 0.3: side-by-side layout, and the shell.
  Columns: {
    target: "basic",
    basicAnalog: "Row",
    why: "Nothing: a Row of the children in order says what Columns says. The layout ratio and the collapse width are rendering hints a renderer may ignore.",
  },
  Split: {
    target: "custom",
    basicAnalog: "Row(List, Column)",
    why: "Row loses the shared selection binding, the detail's item scope, the empty state and the list-then-page behaviour on compact layouts.",
  },
  Frame: {
    target: "custom",
    basicAnalog: "Column(Row, Row(Column, Column, Column), Row)",
    why: "Columns and Rows are layout. They lose the landmarks (banner, navigation, main, complementary, contentinfo), the skip link and which region is the outlet.",
  },
  AppBar: {
    target: "custom",
    basicAnalog: "Row(Text, TextField, Button, Image)",
    why: "Row loses the banner role, the title-not-heading rule, the search landmark and the menu button the frame adds on compact layouts.",
  },
  Footer: {
    target: "custom",
    basicAnalog: "Column of Row(Text, Button)",
    why: "Basic has no contentinfo landmark or link groups named by their headings; the legal line becomes plain text with no role.",
  },
  Outlet: {
    target: "custom",
    basicAnalog: "Column (empty)",
    why: "An empty Column is a hole, not an outlet: it loses the main landmark, the label, the loading content and the rule that the host fills it with a screen.",
  },
  Custom: {
    target: "custom",
    basicAnalog: "the fallback component",
    why: "Exporting only the fallback drops the host component's name and props; a host with that component would draw the fallback instead.",
  },
};
