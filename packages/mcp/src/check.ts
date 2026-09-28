/**
 * Validation and static verification, reported for a model that has to fix what it wrote: each
 * issue carries its JSON Pointer, the component it is in, and a hint saying what to change.
 */
import { validateDocument, directionRules } from "@polyxd/spec/browser";
import { staticAudit } from "@polyxd/verifier/static";
import { componentDefinitions, componentNamed, exampleDirections } from "./spec.ts";

export interface ReportedIssue {
  severity: "error" | "warning";
  /** JSON Pointer into the document */
  pointer: string;
  /** The component the pointer is inside, when it is inside one */
  component?: { id?: string; type?: string };
  message: string;
  /** What to change */
  hint?: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: number;
  warnings: number;
  issues: ReportedIssue[];
}

/** The document with host data merged in: data given separately wins over the document's own. */
export function withData(document: unknown, data?: unknown): unknown {
  if (data === undefined || !document || typeof document !== "object" || Array.isArray(document)) return document;
  return { ...(document as object), data };
}

function valueAt(doc: unknown, pointer: string): unknown {
  let cur: any = doc;
  for (const part of pointer.replace(/^\//, "").split("/").filter(Boolean)) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[part.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return cur;
}

function componentAt(doc: unknown, pointer: string): { id?: string; type?: string } | undefined {
  const m = /^\/components\/(\d+)/.exec(pointer);
  if (!m) return undefined;
  const c = valueAt(doc, `/components/${m[1]}`) as any;
  if (!c || typeof c !== "object") return undefined;
  // No keys set to undefined: the reports are tool results, checked against the tools' output schemas.
  return { ...(typeof c.id === "string" ? { id: c.id } : {}), ...(typeof c.component === "string" ? { type: c.component } : {}) };
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // A swapped pair of letters is one typo, not two.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

function closest(word: string, options: string[]): string | undefined {
  const lower = word.toLowerCase();
  const scored = options.map((o) => ({ o, d: o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase()) ? 1 : distance(lower, o.toLowerCase()) }));
  scored.sort((a, b) => a.d - b.d);
  return scored[0] && scored[0].d <= Math.max(2, Math.floor(word.length / 3)) ? scored[0].o : undefined;
}

const generated = () => componentDefinitions().filter((c) => !c.shell).map((c) => c.name);
const propsOf = (type?: string) => {
  const def = type ? componentNamed(type) : undefined;
  return def ? Object.keys(def.props).map((p) => (def.required.includes(p) ? `${p}*` : p)).join(", ") : undefined;
};

/** A hint for each kind of issue the validator and the verifier report. */
export function hintFor(doc: unknown, issue: { at: string; message: string; code?: string }): string | undefined {
  const { message, at } = issue;
  const type = componentAt(doc, at)?.type;
  let m: RegExpExecArray | null = null;
  if (issue.code === "data:missing-path") return "Add the value to data at this pointer, or point at a field the data has. A binding that reads nothing shows a blank.";
  if (/unknown or missing component type/.test(message) || (m = /unknown component "(.+)"/.exec(message))) {
    const given = (valueAt(doc, at) as any)?.component ?? m?.[1];
    const guess = typeof given === "string" ? closest(given, generated()) : undefined;
    return `${guess ? `Did you mean "${guess}"? ` : ""}Set "component" to one of: ${generated().join(", ")}.`;
  }
  if ((m = /unknown property "(.+)"/.exec(message))) {
    const props = propsOf(type);
    return `Remove "${m[1]}".${props ? ` ${type} takes: ${props} (* = required).` : ""}`;
  }
  if ((m = /must have required property '(.+)'/.exec(message))) {
    const props = propsOf(type);
    return `Add "${m[1]}".${props ? ` ${type} takes: ${props} (* = required).` : ""} polyxd_components gives the full definition.`;
  }
  if (/must be equal to one of the allowed values/.test(message)) return "Use one of the values the component's definition lists (polyxd_components).";
  if (/must be (string|number|boolean|object|array|integer)/.test(message)) return "Check the prop's type in the component's definition (polyxd_components); a bound value is {\"path\": \"/pointer\"}.";
  if (/duplicate id/.test(message)) return "Give every component its own id.";
  if (/^root .* is not a component id/.test(message)) return "Set \"root\" to the id of the outermost component.";
  if (/references unknown component/.test(message)) return "Add a component with that id to \"components\", or remove the reference. Children are id strings, never nested objects.";
  if (/references itself|^cycle:/.test(message)) return "A component cannot contain itself; break the loop.";
  if (/must reference/.test(message)) return "Point this prop at a component of the kind it names.";
  if (/already has parent/.test(message)) return "A component can appear in one place only. Make a copy with a new id for the second place.";
  if (/is not a renderer action/.test(message)) return "Names starting with \"ui.\" are reserved for the renderer. Name your action \"domain.verb\", like \"task.save\".";
  if (/placeholders are only for search/.test(message)) return "Remove the placeholder; put guidance in \"help\" instead.";
  if (/needs alt text/.test(message)) return "Add \"alt\", or set \"decorative\": true if the image carries no information.";
  if (/not reachable from root/.test(message)) return "Add its id to a parent's children, or remove the component.";
  if (/primary actions? visible at once/.test(message)) return "Keep one primary action per view: set \"emphasis\": \"secondary\" on the others, or move them to another step.";
  if (/must point at a list/.test(message)) return "Point at an array in data.";
  if (/relative path .* used outside a repeated item/.test(message)) return "Start the path with \"/\" to read from the top of data. Relative paths are only for inside a Collection, Table, Chart or Comparison item.";
  if (/inputs? per view|more than \d+ inputs/.test(message)) return "Split the inputs across Steps, at most 6 per view.";
  return undefined;
}

/** Reads an absolute JSON Pointer ("/a/0/b") in data; anything else is undefined. */
function readPointer(data: unknown, pointer: string): unknown {
  if (!pointer.startsWith("/")) return undefined;
  let at: any = data;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (at == null || typeof at !== "object") return undefined;
    at = at[key];
  }
  return at;
}

/**
 * A "percent" format takes a fraction (0.12 is 12%). Models often write the percentage itself, which
 * shows as "1,200%". Warn wherever a percent-formatted value, literal or bound by an absolute path, is
 * bigger than 1.5: a real 150%+ is rare, a mistaken 12 is common.
 */
function percentWarnings(doc: any): ReportedIssue[] {
  const out: ReportedIssue[] = [];
  const components: unknown[] = Array.isArray(doc?.components) ? doc.components : [];
  const visit = (node: any, pointer: string, component: ReportedIssue["component"]) => {
    if (!node || typeof node !== "object") return;
    if (node.format?.type === "percent" && "value" in node) {
      const v = node.value;
      const n = typeof v === "number" ? v : v && typeof v.path === "string" ? readPointer(doc.data, v.path) : undefined;
      if (typeof n === "number" && Math.abs(n) > 1.5) {
        const shown = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(n);
        out.push({
          severity: "warning",
          pointer: `${pointer}/value`,
          ...(component ? { component } : {}),
          message: `a "percent" format shows ${n} as "${shown}"`,
          hint: `"percent" takes a fraction. For ${n}%, store ${Number((n / 100).toFixed(6))}${typeof v === "number" ? "" : ` at ${v.path}`}.`,
        });
      }
    }
    for (const [k, child] of Object.entries(node)) if (child && typeof child === "object" && k !== "format") visit(child, `${pointer}/${k}`, component);
  };
  components.forEach((c: any, i) => {
    const component = { ...(typeof c?.id === "string" ? { id: c.id } : {}), ...(typeof c?.component === "string" ? { type: c.component } : {}) };
    visit(c, `/components/${i}`, Object.keys(component).length ? component : undefined);
  });
  return out;
}

export function validate(document: unknown, data?: unknown): ValidationReport {
  const doc = withData(document, data);
  const result = validateDocument(doc);
  const issues = result.issues.map((i): ReportedIssue => {
    const component = componentAt(doc, i.at);
    const hint = hintFor(doc, i);
    return { severity: i.severity, pointer: i.at, ...(component ? { component } : {}), message: i.message, ...(hint ? { hint } : {}) };
  });
  issues.push(...percentWarnings(doc));
  const errors = issues.filter((i) => i.severity === "error").length;
  return { valid: errors === 0, errors, warnings: issues.length - errors, issues };
}

const where = (i: ReportedIssue) => `${i.pointer}${i.component?.id || i.component?.type ? ` (${[i.component.type, i.component.id && `"${i.component.id}"`].filter(Boolean).join(" ")})` : ""}`;

export function formatValidation(r: ValidationReport): string {
  const head = r.valid
    ? `Valid${r.warnings ? `, with ${r.warnings} warning${r.warnings === 1 ? "" : "s"}` : ""}.`
    : `Not valid: ${r.errors} error${r.errors === 1 ? "" : "s"}${r.warnings ? ` and ${r.warnings} warning${r.warnings === 1 ? "" : "s"}` : ""}. Fix the errors and validate again.`;
  const lines = r.issues.map((i) => `- ${i.severity} at ${where(i)}: ${i.message}${i.hint ? `\n  Fix: ${i.hint}` : ""}`);
  return [head, ...lines].join("\n");
}

export interface VerifyReport {
  errors: number;
  warnings: number;
  findings: { severity: "error" | "warning"; check: string; message: string; hint?: string }[];
  direction?: string;
  rules: number;
}

/** A Design Direction by example name, or the object itself. */
export function resolveDirection(direction: unknown): any {
  if (typeof direction !== "string") return direction;
  const found = exampleDirections().find((d) => d.name === direction);
  if (!found) throw new Error(`No example Design Direction named "${direction}". Known: ${exampleDirections().map((d) => d.name).join(", ")}. Or pass the direction object itself.`);
  return JSON.parse(found.json);
}

export function verify(document: unknown, opts: { data?: unknown; direction?: unknown; registry?: unknown } = {}): VerifyReport {
  const doc = withData(document, opts.data);
  const direction = opts.direction === undefined ? undefined : resolveDirection(opts.direction);
  const rules = direction ? directionRules(direction) : undefined;
  const findings = staticAudit(doc, { rules, emphasisBudget: direction?.profile?.emphasisBudget, registry: opts.registry as any }).map((f) => {
    // Findings from the validator carry "<pointer>: <message>"; the same hints apply.
    const m = /^(\/[^:]*|\/): (.*)$/.exec(f.message);
    const hint = m ? hintFor(doc, { at: m[1], message: m[2], code: f.check }) : undefined;
    // A direction passed as an object is not schema-checked, so its rules' severities are taken as error or warning.
    const severity: "error" | "warning" = f.severity === "error" ? "error" : "warning";
    return { severity, check: f.check, message: f.message, ...(hint ? { hint } : {}) };
  });
  const errors = findings.filter((f) => f.severity === "error").length;
  const name = typeof direction?.name === "string" ? direction.name : undefined;
  return { errors, warnings: findings.length - errors, findings, ...(name ? { direction: name } : {}), rules: rules?.length ?? 0 };
}

export function formatVerify(r: VerifyReport): string {
  const scope = r.direction ? ` against Design Direction "${r.direction}" (${r.rules} rules)` : "";
  const head = r.errors
    ? `Fails${scope}: ${r.errors} error${r.errors === 1 ? "" : "s"}, ${r.warnings} warning${r.warnings === 1 ? "" : "s"}.`
    : `Passes${scope}: no errors${r.warnings ? `, ${r.warnings} warning${r.warnings === 1 ? "" : "s"}` : ""}.`;
  const lines = r.findings.map((f) => `- ${f.severity} [${f.check}] ${f.message}${f.hint ? `\n  Fix: ${f.hint}` : ""}`);
  const note = "These are the document checks. Rendered checks (accessibility, layout, agent tasks) need a browser: save the document, run `npx playwright install chromium` once, then `npx -p @polyxd/verifier -p playwright polyxd-verify <file>`.";
  return [head, ...lines, note].join("\n");
}
