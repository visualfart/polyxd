/**
 * What a Direction's settings are called in plain words: the editor's labels and help, the
 * validator's field names and the diff's lines all read from here, so a setting has one name.
 */

export interface Option {
  value: string;
  label: string;
  help: string;
}

export interface ProfileField {
  key: "density" | "dataDisplay" | "motion" | "disclosure" | "freedom";
  label: string;
  help: string;
  default: string;
  options: Option[];
}

/** The profile's choices, in the schema's order, with the schema's defaults. */
export const PROFILE_FIELDS: ProfileField[] = [
  {
    key: "density",
    label: "Density",
    help: "How tightly rows pack. Touch targets keep their 44px minimum either way.",
    default: "comfortable",
    options: [
      { value: "compact", label: "Compact", help: "32px rows. For pointer-heavy tools where people scan a lot at once." },
      { value: "comfortable", label: "Comfortable", help: "40px rows. The usual balance." },
      { value: "spacious", label: "Spacious", help: "48px rows. Calm, for screens people read slowly." },
    ],
  },
  {
    key: "dataDisplay",
    label: "Numbers and data",
    help: "What a generator reaches for first when a screen has numbers to show.",
    default: "auto",
    options: [
      { value: "auto", label: "Whatever fits", help: "The generator picks per screen." },
      { value: "prefer-charts", label: "Charts", help: "Trends and shapes over exact figures." },
      { value: "prefer-tables", label: "Tables", help: "Rows people can sort and compare." },
      { value: "prefer-metrics", label: "Key figures", help: "A few big numbers, each with a label." },
    ],
  },
  {
    key: "motion",
    label: "Motion",
    help: "How much things move when they appear, change or go. Reduced-motion settings always win.",
    default: "subtle",
    options: [
      { value: "none", label: "None", help: "Things appear and change in place." },
      { value: "subtle", label: "Subtle", help: "Short fades and slides that explain a change." },
      { value: "expressive", label: "Expressive", help: "Bigger, livelier movement where it helps." },
    ],
  },
  {
    key: "disclosure",
    label: "Secondary detail",
    help: "How eagerly extra detail goes behind a Disclosure, so the main thing stays in view.",
    default: "progressive",
    options: [
      { value: "progressive", label: "Tuck it away", help: "Detail waits behind a Disclosure until someone asks." },
      { value: "show-everything", label: "Show everything", help: "Every Disclosure opens on arrival." },
    ],
  },
  {
    key: "freedom",
    label: "Freedom",
    help: "How far a generator may go beyond your patterns.",
    default: "guided",
    options: [
      { value: "strict", label: "Strict", help: "Only approved patterns." },
      { value: "guided", label: "Guided", help: "New layouts, built from approved components." },
      { value: "open", label: "Open", help: "Anything that passes the verifier." },
    ],
  },
];

export const EMPHASIS = {
  label: "Primary actions per view",
  help: "How many buttons in the brand's strongest style one view may carry. The accessibility floor still holds most platforms to one.",
  default: 1,
};

export interface ToneField {
  key: "formality" | "energy" | "warmth" | "humor";
  label: string;
  default: string;
  options: Option[];
}

/** Tone, as sliders from one end to the other. Given to the generator; not checked. */
export const TONE_FIELDS: ToneField[] = [
  { key: "formality", label: "Formality", default: "neutral", options: [
    { value: "formal", label: "Formal", help: "“Your payment has been received.”" },
    { value: "neutral", label: "Neutral", help: "“We've got your payment.”" },
    { value: "casual", label: "Casual", help: "“Got it, thanks.”" },
  ] },
  { key: "energy", label: "Energy", default: "neutral", options: [
    { value: "calm", label: "Calm", help: "Even and quiet, whatever happens." },
    { value: "neutral", label: "Neutral", help: "Matches the moment." },
    { value: "upbeat", label: "Upbeat", help: "Lively, glad to help." },
  ] },
  { key: "warmth", label: "Warmth", default: "friendly", options: [
    { value: "reserved", label: "Reserved", help: "Polite and to the point." },
    { value: "friendly", label: "Friendly", help: "Approachable, never chummy." },
    { value: "warm", label: "Warm", help: "Kind, and it shows." },
  ] },
  { key: "humor", label: "Humour", default: "none", options: [
    { value: "none", label: "None", help: "Never jokes." },
    { value: "light", label: "Light", help: "A light touch where nothing is at stake." },
  ] },
];

export const PERSON: Option[] = [
  { value: "you", label: "You", help: "“Your card is frozen.” The product never says “we”." },
  { value: "we-and-you", label: "We and you", help: "“We've frozen your card.”" },
  { value: "impersonal", label: "Impersonal", help: "“Card frozen.” Neither you nor we." },
];

export const CASING: Option[] = [
  { value: "sentence", label: "Sentence case", help: "“Send money to a payee”" },
  { value: "title", label: "Title case", help: "“Send Money to a Payee”" },
];

export const SPELLING: Option[] = [
  { value: "en-GB", label: "British", help: "colour, organise, cancelled" },
  { value: "en-US", label: "American", help: "color, organize, canceled" },
];

export const SITUATIONS: { key: "empty" | "error" | "success" | "confirm" | "loading" | "destructive"; label: string; placeholder: string }[] = [
  { key: "empty", label: "Nothing here yet", placeholder: "Say what would appear here and the one thing to do to make it appear." },
  { key: "error", label: "Something went wrong", placeholder: "Say what didn't happen, that nothing was lost, and what to try." },
  { key: "success", label: "It worked", placeholder: "Say what happened, with the specifics." },
  { key: "confirm", label: "Asking to confirm", placeholder: "Say exactly what will happen, not whether they're sure." },
  { key: "loading", label: "Waiting", placeholder: "Say what is happening and roughly how long it takes." },
  { key: "destructive", label: "Before something is lost", placeholder: "Name what goes, and whether it can come back." },
];

/** Every enum value's words, across the Direction, for diffs and messages. */
export const VALUE_LABELS: Record<string, string> = Object.fromEntries([
  ...PROFILE_FIELDS.flatMap((f) => f.options.map((o) => [`profile.${f.key}:${o.value}`, o.label])),
  ...TONE_FIELDS.flatMap((f) => f.options.map((o) => [`voice.tone.${f.key}:${o.value}`, o.label])),
  ...PERSON.map((o) => [`voice.person:${o.value}`, o.label]),
  ...CASING.map((o) => [`voice.casing:${o.value}`, o.label]),
  ...SPELLING.map((o) => [`voice.spelling:${o.value}`, o.label]),
  ["voice.punctuation.exclamation:never", "Never"], ["voice.punctuation.exclamation:allowed", "Allowed"],
  ["voice.punctuation.emoji:never", "Never"], ["voice.punctuation.emoji:allowed", "Allowed"],
]);

/** A field's name by its JSON Pointer; list indexes count from one. */
export function fieldLabel(at: string): string {
  const parts = at.split("/").slice(1);
  const n = (i: number) => Number(parts[i]) + 1;
  const [a, b, c, d] = parts;
  if (!a) return "The Direction";
  if (a === "name") return "Key";
  if (a === "version") return "Version";
  if (a === "designSystem") return "Design system";
  if (a === "profile") {
    if (!b) return "Profile";
    if (b === "emphasisBudget") return EMPHASIS.label;
    return PROFILE_FIELDS.find((f) => f.key === b)?.label ?? `Profile: ${b}`;
  }
  if (a === "voice") {
    if (!b) return "Voice";
    if (b === "guidelines") return c === undefined ? "Guidelines" : `Guideline ${n(2)}`;
    if (b === "tone") return c ? `Tone: ${TONE_FIELDS.find((f) => f.key === c)?.label ?? c}` : "Tone";
    if (b === "person") return "Person";
    if (b === "readingLevel") return "Reading level";
    if (b === "casing") return "Casing";
    if (b === "spelling") return "Spelling";
    if (b === "punctuation") return c === "exclamation" ? "Exclamation marks" : c === "emoji" ? "Emoji" : "Punctuation";
    if (b === "labels") return c === "maxWords" ? "Longest button label" : c === "verbFirst" ? "Buttons start with a verb" : "Button labels";
    if (b === "glossary") return c === undefined ? "Words to use" : d === "use" ? `Word ${n(2)}: the word to use` : d === "insteadOf" ? `Word ${n(2)}: instead of` : `Word ${n(2)}`;
    if (b === "avoid") return c === undefined ? "Words to avoid" : `Word to avoid ${n(2)}`;
    if (b === "situations") return c ? `Situation: ${SITUATIONS.find((s) => s.key === c)?.label ?? c}` : "Situations";
    return `Voice: ${b}`;
  }
  if (a === "patterns") return b === "prefer" ? "Preferred patterns" : b === "disallow" ? "Patterns to avoid" : b === "custom" ? "Your pattern files" : "Patterns";
  if (a === "rules") return b === undefined ? "Rules" : `Rule ${n(1)}${c ? ` (${c === "rule" ? "its check" : c})` : ""}`;
  if (a === "exemplars") return b === undefined ? "Exemplars" : `Exemplar ${n(1)}${c === "request" ? ": the request it answers" : c === "document" ? ": its screen" : ""}`;
  return `“${parts[parts.length - 1]}”`;
}
