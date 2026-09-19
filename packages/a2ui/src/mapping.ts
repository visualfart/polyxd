/**
 * Per-component export decision: Basic catalog component, or a custom component in the Polixd A2UI catalog.
 *
 * Rule: a Polixd component maps to a Basic component only when every Polixd prop has a Basic
 * equivalent with the same meaning. Otherwise it is exported as a custom component with the same name and
 * props, so the export stays a lossless projection rather than a lossy flattening
 * (docs/decisions/0001 §6: "a faithful export", custom catalogs being the endorsed A2UI path).
 * None of the 24 components currently meets the rule. `basicAnalog` records the nearest Basic
 * construct and `why` records what flattening into it would lose.
 */
export interface MappingDecision {
  target: "basic" | "custom";
  /** Nearest construct in the A2UI v1.0 Basic catalog */
  basicAnalog: string;
  /** What exporting to the Basic analog would lose */
  why: string;
}

export const MAPPING: Record<string, MappingDecision> = {
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
    why: "ChoicePicker options must be literal (Polixd options can come from host data), option descriptions are missing, the value must be a string list, and there is no help text.",
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
    why: "Image takes a URL string. Polixd's src is a host-data binding, and 'decorative' and the aspect hint have no Image equivalent (Image.variant is a size, not an aspect).",
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
    why: "Basic Text interprets Markdown (Polixd text is plain), has no 'supporting' variant and no value format.",
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
};
