import { COMPONENTS, PATTERNS, SPEC_VERSION } from "./catalog.generated.ts";
import { relevantPatterns } from "./direction.ts";
import type { Capability, Direction, Exemplar, Finding, UIDocument } from "./types.ts";

export interface SystemPromptOptions {
  /**
   * The components generated screens may use. Leave it out for every component the spec defines
   * for surfaces. Shell components are never offered either way.
   */
  components?: string[];
}

const EXAMPLE = {
  specVersion: SPEC_VERSION,
  surface: { id: "add-task", title: "New task", intent: "tasks.create" },
  root: "form",
  components: [
    { id: "form", component: "Form", children: ["title", "due", "priority"], submit: { label: "Add task", action: { event: { name: "task.save", context: { title: { path: "/draft/title" }, due: { path: "/draft/due" }, priority: { path: "/draft/priority" } } } } } },
    { id: "title", component: "TextInput", key: "title", label: "Task", value: { path: "/draft/title" }, required: true },
    { id: "due", component: "DateInput", key: "due", label: "Due", value: { path: "/draft/due" } },
    { id: "priority", component: "Choice", key: "priority", label: "Priority", value: { path: "/draft/priority" }, options: [{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }] },
  ],
};

/**
 * The generator's system prompt, built from the spec: the document shape, the rules a generated
 * document must follow, every component it may use with its props, and the patterns. The same
 * text for every ask, so a provider's prompt cache can hold it.
 */
export function systemPrompt(options: SystemPromptOptions = {}): string {
  const allowed = options.components ? new Set(options.components) : undefined;
  const components = COMPONENTS.filter((c) => !c.shell && (!allowed || allowed.has(c.name)));
  const shellNames = COMPONENTS.filter((c) => c.shell)
    .map((c) => c.name)
    .join(", ")
    .replace(/, ([^,]*)$/, " or $1");
  const rules = [
    'Data comes from the host. Bind values with {"path":"/json/pointer"}; pointers start at the root of the DATA object (DATA {"card":{"id":"c1"}} → {"path":"/card/id"}, never "/data/card/id"). Never type numbers, prices, names or dates from the data as literal text; never invent data.',
    'Inside a repeated item (Collection items template, Table columns, Chart series, Comparison attributes) use paths RELATIVE to the item, e.g. {"path":"amount"}.',
    'Actions: {"event":{"name":"<capability>","context":{...}}}. Use ONLY the capabilities listed. "ui.dismiss" closes the surface.',
    "Destructive capabilities must be triggered from a Confirm. Consequential ones need a Confirm or a review step first.",
    "At most one primary action visible at a time (a Form's submit counts). At most 6 inputs per view; use Steps for more.",
    'Labels say what happens ("Send £20", "Freeze card"), in sentence case. Give every component that represents a thing from the data a stable "key" in lower_snake_case (e.g. "card_status").',
    'Collections and Tables need an "empty" Status when the list may be empty.',
    "If no listed capability can do what was asked, show a Status explaining that instead of a fake interface.",
    'Format numbers, money and dates with "format", never by writing them into strings.',
    'There is no template engine. Text is either literal or a binding; "{{budget}}" or "${spent}" in a string reaches the screen exactly as written.',
    'Bind text to a field that holds text. A pointer at an object or a list prints as "[object Object]"; point at the string inside it.',
    'Show people names, not internal ids. If a record has both "id" and "name", the screen gets "name"; the id belongs in an action\'s context.',
    `Never use ${shellNames}: the product's shell is authored, and your surface renders inside it. Never draw navigation, a header or a footer around a surface.`,
  ];
  if (allowed) rules.push("Use only the components listed below.");
  return `You generate just-in-time user interfaces as JSON, in the Polyxd UI document format. Output ONE JSON object and nothing else.

Document shape: {"specVersion":"${SPEC_VERSION}","surface":{"id","title","intent","pattern"?},"root":"<id>","components":[...]}.
Components are a FLAT list; each has a unique "id" and "component" (its type). Containers reference children by id STRINGS ("children": ["a","b"]); never nest component objects inside other components.

Rules:
${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Components (* = required):
${components.map((c) => c.line).join("\n")}

Patterns (set surface.pattern when one applies):
${PATTERNS.map((p) => `- ${p.id}: ${p.summary} Structure: ${p.structure.join(" → ")}`).join("\n")}

Example:
${JSON.stringify(EXAMPLE)}`;
}

/** Everything the user turn is built from. */
export interface PromptInput {
  /** What the person asked, in their words. */
  ask: string;
  /** A stable key for what they're trying to do, such as `money.send`. */
  intent: string;
  /** A spec pattern the surface should follow, when the host already knows. */
  pattern?: string;
  /** The capabilities this surface may trigger, by name. */
  capabilities?: Record<string, Capability>;
  /** The host data the surface binds to by JSON Pointer. */
  data?: unknown;
  direction?: Direction;
  /** Exemplars already chosen for this ask. */
  exemplars?: Exemplar[];
  /** The document shown last time for this intent. */
  previous?: UIDocument;
}

const MAX_PATHS = 80;

/** RFC 6901: `~` and `/` inside a key are escaped. */
const escapeKey = (k: string) => k.replace(/~/g, "~0").replace(/\//g, "~1");

function kind(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "list";
  return typeof v;
}

/**
 * The pointers a surface can bind to, one per line. A list is described once, with the fields its
 * items have, since a repeated item binds to them with relative paths.
 */
export function dataPaths(data: unknown): string[] {
  const out: string[] = [];
  const walk = (value: unknown, at: string) => {
    if (Array.isArray(value)) {
      const objects = value.filter((v) => v && typeof v === "object" && !Array.isArray(v)).slice(0, 5) as Record<string, unknown>[];
      const fields = [...new Set(objects.flatMap((o) => Object.keys(o)))];
      const itemKinds = [...new Set(value.slice(0, 5).map(kind))].join("|") || "empty";
      out.push(`${at} (list of ${value.length}${fields.length ? `; each item has ${fields.join(", ")}` : `; items: ${itemKinds}`})`);
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, `${at}/${escapeKey(k)}`);
      return;
    }
    if (at) out.push(`${at} (${kind(value)})`);
  };
  walk(data, "");
  return out.length > MAX_PATHS ? [...out.slice(0, MAX_PATHS), `… and ${out.length - MAX_PATHS} more`] : out;
}

/** A document as the model reads it: no data snapshot, no `$schema`, on one line. */
function compact(doc: UIDocument): string {
  const { data: _data, ...rest } = doc as UIDocument & { $schema?: string };
  delete (rest as { $schema?: string }).$schema;
  return JSON.stringify(rest);
}

function capabilityLines(capabilities: Record<string, Capability>): string[] {
  const names = Object.keys(capabilities);
  if (!names.length) return ["- (none)"];
  return names.map((name) => {
    const c = capabilities[name];
    const required = new Set(c.inputs?.required ?? []);
    const inputs = Object.keys(c.inputs?.properties ?? {}).map((k) => (required.has(k) ? `${k}*` : k));
    const facts = [`risk: ${c.risk ?? "unknown"}`, `inputs: ${inputs.join(", ") || "none"}`];
    if (c.undo) facts.push(`undo: ${c.undo}`);
    return `- ${name} (${facts.join("; ")}): ${c.description ?? ""}`;
  });
}

const DENSITY: Record<string, string> = {
  compact: "Density: compact. Fit more on one screen.",
  comfortable: "Density: comfortable.",
  spacious: "Density: spacious. Show fewer things on one screen.",
};
const DATA_DISPLAY: Record<string, string> = {
  "prefer-charts": "Show numbers over time, or parts of a whole, as a Chart where it helps.",
  "prefer-tables": "Show lists of records as a Table.",
  "prefer-metrics": "Lead with the key figures as Metric components.",
};
const DISCLOSURE: Record<string, string> = {
  progressive: "Put secondary detail behind a Disclosure.",
  "show-everything": "Show detail directly; don't hide it behind a Disclosure.",
};
const FREEDOM: Record<string, string> = {
  strict: "Freedom: strict. Stay close to the preferred patterns and the examples; don't invent new kinds of layout.",
  guided: "Freedom: guided. New layouts are fine, built from the listed components.",
  open: "Freedom: open. Any layout is fine if it passes the checks.",
};

/** A Design Direction as instructions: profile, voice and rules. */
export function directionLines(d: Direction): string[] {
  const out = [`Design direction: ${d.name}${d.designSystem ? ` (design system: ${d.designSystem})` : ""}`];
  const p = d.profile ?? {};
  const profile: string[] = [];
  if (p.density && DENSITY[p.density]) profile.push(DENSITY[p.density]);
  if (p.emphasisBudget) profile.push(`At most ${p.emphasisBudget} primary action${p.emphasisBudget === 1 ? "" : "s"} visible at a time.`);
  if (p.dataDisplay && DATA_DISPLAY[p.dataDisplay]) profile.push(DATA_DISPLAY[p.dataDisplay]);
  if (p.disclosure && DISCLOSURE[p.disclosure]) profile.push(DISCLOSURE[p.disclosure]);
  if (p.freedom && FREEDOM[p.freedom]) profile.push(FREEDOM[p.freedom]);
  if (profile.length) out.push("Profile:", ...profile.map((x) => `- ${x}`));

  const v = d.voice ?? {};
  const voice: string[] = [];
  if (v.guidelines?.length) voice.push("Guidelines: " + v.guidelines.join(" "));
  if (v.tone) voice.push("Tone: " + Object.entries(v.tone).map(([k, val]) => `${k} ${val}`).join(", "));
  const person = ({ you: 'address the user as "you"; never say "we"', "we-and-you": 'the product may say "we"', impersonal: 'don\'t say "you" or "we"' } as Record<string, string>)[v.person];
  if (person) voice.push(`Person: ${person}`);
  const style: string[] = [];
  if (v.casing) style.push(`${v.casing} case`);
  if (v.spelling) style.push(`${v.spelling} spelling`);
  if (v.readingLevel?.maxGrade) style.push(`reading grade ${v.readingLevel.maxGrade} or below`);
  if (v.punctuation?.exclamation === "never") style.push("no exclamation marks");
  if (v.punctuation?.emoji === "never") style.push("no emoji");
  if (v.labels?.maxWords) style.push(`button labels of at most ${v.labels.maxWords} words`);
  if (v.labels && v.labels.verbFirst !== false) style.push("buttons start with a verb");
  if (style.length) voice.push("Style: " + style.join("; "));
  const glossary = (v.glossary ?? []).filter((g: any) => g.insteadOf?.length).map((g: any) => `say "${g.use}", not ${g.insteadOf.map((x: string) => JSON.stringify(x)).join(" or ")}`);
  if (glossary.length) voice.push("Words: " + glossary.join("; "));
  if (v.avoid?.length) voice.push("Never use: " + v.avoid.map((x: string) => JSON.stringify(x)).join(", "));
  for (const [moment, guidance] of Object.entries(v.situations ?? {})) voice.push(`For ${moment} states: ${guidance}`);
  if (voice.length) out.push("Voice:", ...voice.map((x) => `- ${x}`));

  const rules = (d.rules ?? []).map((r) => r.description);
  if (rules.length) out.push("Rules (each one is checked):", ...rules.map((x) => `- ${x}`));
  return out;
}

/**
 * The host's turn: the ask, the capabilities it offers, the data to bind to, the Direction, the
 * patterns that fit, a few exemplars and the screen shown last time. The same input always gives
 * the same text.
 */
export function userPrompt(input: PromptInput): string {
  const capabilities = input.capabilities ?? {};
  const lines = [`Request: ${input.ask}`, `Intent: ${input.intent}`];
  if (input.pattern) lines.push(`Pattern: ${input.pattern}`);
  lines.push("", "Capabilities you may use:", ...capabilityLines(capabilities));
  if (input.data !== undefined) {
    lines.push("", "DATA (bind to it with JSON Pointers; do not copy values into text):", JSON.stringify(input.data));
    const paths = dataPaths(input.data);
    if (paths.length) lines.push("", "Paths you can bind to:", ...paths.map((p) => `- ${p}`));
  }
  const d = input.direction;
  if (d) lines.push("", ...directionLines(d));

  const preferred = d ? relevantPatterns(d.patterns?.prefer ?? [], PATTERNS, input.ask, input.intent, capabilities) : [];
  const named = input.pattern ? PATTERNS.filter((p) => p.id === input.pattern) : [];
  const patterns = [...named, ...preferred.filter((p) => p.id !== input.pattern)];
  if (patterns.length) {
    lines.push("", "Patterns for this request (set surface.pattern to the one you follow):");
    for (const p of patterns) lines.push(`- ${p.id}: ${p.summary} Structure: ${p.structure.join(" → ")}`);
  }
  if (d?.patterns?.disallow?.length) lines.push("", `Never use these patterns: ${d.patterns.disallow.join(", ")}.`);

  if (input.exemplars?.length) {
    lines.push("", "Examples of how this product does it (follow their structure, keys and wording where they fit):");
    for (const e of input.exemplars) lines.push(`Request: ${e.request}`, `Document: ${compact(e.document)}`);
  }
  if (input.previous) {
    lines.push(
      "",
      "Last time, this intent showed the screen below. Keep its keys, structure, order and labels so the person recognises it; change only what this request needs:",
      compact(input.previous),
    );
  }
  lines.push("", "Output the JSON document now.");
  return lines.join("\n");
}

const MAX_FINDINGS = 20;

/** The turn that sends a failed document's problems back to the model. */
export function repairPrompt(findings: Finding[]): string {
  const ordered = [...findings.filter((f) => f.severity === "error"), ...findings.filter((f) => f.severity !== "error")];
  const shown = ordered.slice(0, MAX_FINDINGS).map((f) => `- [${f.check}] ${f.message}`);
  if (ordered.length > MAX_FINDINGS) shown.push(`- … and ${ordered.length - MAX_FINDINGS} more`);
  return ["The document you wrote has these problems:", ...shown, "", "Fix every one and output the whole corrected JSON document again, and nothing else."].join("\n");
}
