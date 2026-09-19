/**
 * A small, declarative check vocabulary shared by patterns, Design Direction rules and journey
 * checkpoints / acceptance criteria. Each check is plain JSON so non-engineers' rules can be stored,
 * diffed and versioned, and each one explains itself when it fails.
 */
type Component = Record<string, any> & { id: string; component: string };
interface Doc {
  root: string;
  components: Component[];
  data?: unknown;
}

export type Check =
  | { check: "rootIs"; components: string[] }
  | { check: "contains"; component: string; where?: Record<string, unknown>; min?: number; max?: number }
  | { check: "precedes"; before: string[]; after: string[] }
  | { check: "maxInputsPerView"; max: number }
  | { check: "requires"; component: string; where?: Record<string, unknown>; props: string[] }
  | { check: "labelMatches"; component: string; where?: Record<string, unknown>; prop?: string; pattern: string; flags?: string }
  | { check: "noLabelMatches"; pattern: string; flags?: string }
  | { check: "actionInside"; capabilities: string[]; container: string[] }
  | { check: "casing"; style: "sentence" | "title" }
  | { check: "maxWords"; max: number }
  | { check: "readingLevel"; maxGrade: number }
  | { check: "avoidTerms"; terms: string[]; suggest?: string }
  | { check: "noEmoji" }
  | { check: "spelling"; variant: "en-GB" | "en-US" }
  | { check: "person"; style: "you" | "we-and-you" | "impersonal" }
  | { check: "anyOf"; checks: Check[] }
  | { check: "allOf"; checks: Check[] }
  | { check: "not"; checks: [Check] };

export interface CheckResult {
  pass: boolean;
  message: string;
}

/** Props holding a single component id (other props with the same name hold text or actions). */
const SINGLE_REFS: Record<string, string[]> = {
  Card: ["media"],
  Collection: ["empty"],
  Table: ["empty", "toolbar", "bulkActions", "rowActions", "search"],
  Status: ["action"],
  Confirm: ["summary"],
  FilterPanel: ["results"],
};

const INPUTS = new Set(["TextInput", "Choice", "Toggle", "DateInput", "RangeInput"]);

/** Components in reading order (depth-first from root, following every reference). */
export function readingOrder(doc: Doc): Component[] {
  const byId = new Map(doc.components.map((c) => [c.id, c]));
  const out: Component[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    const c = byId.get(id);
    if (!c || seen.has(id)) return;
    seen.add(id);
    out.push(c);
    for (const ref of childIds(c)) visit(ref);
  };
  visit(doc.root);
  return out;
}

/** Ids a component references, in order. Mirrors the reference props in the schema. */
export function childIds(c: Component): string[] {
  const ids: string[] = [];
  // A Form's summary is read before its fields: it says what you are agreeing to.
  if (c.component === "Form" && typeof c.aside === "string") ids.push(c.aside);
  if (Array.isArray(c.children)) ids.push(...c.children);
  for (const p of SINGLE_REFS[c.component] ?? []) if (typeof c[p] === "string") ids.push(c[p]);
  if (c.items && typeof c.items === "object" && "componentId" in c.items) ids.push(c.items.componentId);
  for (const list of [c.views, c.steps]) if (Array.isArray(list)) ids.push(...list.map((v: any) => v.content));
  return ids;
}

const matches = (c: Component, component: string, where?: Record<string, unknown>) =>
  (component === "*" || c.component === component) &&
  Object.entries(where ?? {}).every(([k, v]) => JSON.stringify(c[k]) === JSON.stringify(v));

/** Visible text labels a component carries, for voice/copy rules. Bindings are skipped (host data). */
function labels(c: Component): string[] {
  const out: string[] = [];
  const add = (v: unknown) => typeof v === "string" && out.push(v);
  for (const p of ["label", "title", "subtitle", "text", "message", "consequence", "summary", "caption", "help", "description"]) {
    if (p === "summary" && c.component !== "Disclosure" && c.component !== "Chart" && c.component !== "Comparison") continue;
    add(c[p]);
  }
  for (const p of ["submit", "cancel", "confirm", "finish", "choose"]) add(c[p]?.label);
  for (const list of [c.items, c.options, c.columns, c.attributes, c.views, c.steps, c.series]) {
    if (Array.isArray(list)) list.forEach((x: any) => (add(x?.label), add(x?.title)));
  }
  return out;
}

/** Button labels: what the user presses. */
function actionLabels(c: Component): string[] {
  const out: string[] = [];
  if (c.component === "Action" && typeof c.label === "string") out.push(c.label);
  for (const p of ["submit", "cancel", "confirm", "finish", "choose"]) if (typeof c[p]?.label === "string") out.push(c[p].label);
  return out;
}

/** Running text (sentences people read), as opposed to labels and titles. */
function runningText(c: Component): string[] {
  const out: string[] = [];
  for (const p of ["text", "message", "consequence", "description", "help", "caption"]) if (typeof c[p] === "string") out.push(c[p]);
  if (c.component === "Chart" || c.component === "Comparison") if (typeof c.summary === "string") out.push(c.summary);
  return out;
}

const syllables = (word: string) => {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
};

/** Flesch–Kincaid grade level of a passage. */
export function readingGrade(text: string): number {
  const sentences = Math.max(1, (text.match(/[.!?]+(\s|$)/g) ?? []).length || 1);
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  if (!words.length) return 0;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59;
}

/** en-US ↔ en-GB spellings common in interfaces. */
const SPELLING: [string, string][] = [
  ["color", "colour"], ["favorite", "favourite"], ["organize", "organise"], ["organization", "organisation"], ["center", "centre"],
  ["canceled", "cancelled"], ["canceling", "cancelling"], ["license", "licence"], ["personalize", "personalise"], ["customize", "customise"],
  ["prioritize", "prioritise"], ["authorize", "authorise"], ["recognize", "recognise"], ["catalog", "catalogue"], ["gray", "grey"],
  ["check", "cheque"], ["behavior", "behaviour"], ["labeled", "labelled"], ["traveling", "travelling"], ["enrollment", "enrolment"],
];

const EMOJI = /\p{Extended_Pictographic}/u;

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with", "vs"]);

/** A title-cased phrase: its later words (other than small words) are capitalised. Acronyms and one proper noun pass. */
const isTitleCase = (s: string) => {
  const later = s.trim().split(/\s+/).slice(1).filter((w) => /^[A-Za-z]/.test(w) && !SMALL_WORDS.has(w.toLowerCase()));
  const capped = later.filter((w) => /^[A-Z][a-z]/.test(w)).length;
  return (later.length >= 2 && capped === later.length) || capped >= 3;
};

function actionNames(c: Component): string[] {
  const names: string[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, any>;
    if (o.event && typeof o.event.name === "string") names.push(o.event.name);
    for (const x of Object.values(o)) walk(x);
  };
  walk(c);
  return names;
}

export function runCheck(check: Check, doc: Doc): CheckResult {
  const order = readingOrder(doc);
  const ok = (message: string) => ({ pass: true, message });
  const fail = (message: string) => ({ pass: false, message });

  switch (check.check) {
    case "rootIs": {
      const root = doc.components.find((c) => c.id === doc.root);
      return root && check.components.includes(root.component)
        ? ok(`root is ${root.component}`)
        : fail(`root must be ${check.components.join(" or ")}, is ${root?.component ?? "missing"}`);
    }
    case "contains": {
      const n = order.filter((c) => matches(c, check.component, check.where)).length;
      const min = check.min ?? 1;
      const what = `${check.component}${check.where ? ` ${JSON.stringify(check.where)}` : ""}`;
      if (n < min) return fail(`needs at least ${min} ${what}, found ${n}`);
      if (check.max !== undefined && n > check.max) return fail(`allows at most ${check.max} ${what}, found ${n}`);
      return ok(`${n} ${what}`);
    }
    case "precedes": {
      const firstAfter = order.findIndex((c) => check.after.includes(c.component));
      const lastBefore = order.map((c) => check.before.includes(c.component)).lastIndexOf(true);
      if (firstAfter === -1 || lastBefore === -1) return fail(`needs both ${check.before.join("/")} and ${check.after.join("/")}`);
      return lastBefore < firstAfter
        ? ok(`${check.before.join("/")} come before ${check.after.join("/")}`)
        : fail(`${check.before.join("/")} must all come before ${check.after.join("/")}`);
    }
    case "maxInputsPerView": {
      // Inputs inside a Steps step or a Views panel count separately.
      const byId = new Map(doc.components.map((c) => [c.id, c]));
      const counts: number[] = [];
      const count = (id: string, seen = new Set<string>()): number => {
        const c = byId.get(id);
        if (!c || seen.has(id)) return 0;
        seen.add(id);
        if (c.component === "Steps" || c.component === "Views") {
          for (const p of c.steps ?? c.views) counts.push(count(p.content, seen));
          return 0;
        }
        return (INPUTS.has(c.component) ? 1 : 0) + childIds(c).reduce((n, r) => n + count(r, seen), 0);
      };
      counts.push(count(doc.root));
      const worst = Math.max(...counts);
      return worst <= check.max ? ok(`at most ${worst} inputs per view`) : fail(`${worst} inputs in one view; split into Steps (max ${check.max})`);
    }
    case "requires": {
      const missing = order.filter((c) => matches(c, check.component, check.where) && check.props.some((p) => c[p] === undefined));
      return missing.length
        ? fail(`${missing.map((c) => c.id).join(", ")} must set ${check.props.join(", ")}`)
        : ok(`${check.component} sets ${check.props.join(", ")}`);
    }
    case "labelMatches": {
      const re = new RegExp(check.pattern, check.flags);
      const texts = (c: Component) => (check.prop ? [check.prop.split(".").reduce((v: any, k) => v?.[k], c)].filter((v) => typeof v === "string") : labels(c));
      const bad = order.filter((c) => matches(c, check.component, check.where)).filter((c) => !texts(c).some((l) => re.test(l)));
      return bad.length ? fail(`${bad.map((c) => c.id).join(", ")}: no label matches /${check.pattern}/`) : ok(`labels match /${check.pattern}/`);
    }
    case "noLabelMatches": {
      const re = new RegExp(check.pattern, check.flags);
      const hits = order.flatMap((c) => labels(c).filter((l) => re.test(l)).map((l) => `${c.id}: "${l}"`));
      return hits.length ? fail(`avoid /${check.pattern}/ — ${hits.join("; ")}`) : ok(`no label matches /${check.pattern}/`);
    }
    case "actionInside": {
      const byId = new Map(doc.components.map((c) => [c.id, c]));
      const parents = new Map<string, string>();
      for (const c of doc.components) for (const r of childIds(c)) parents.set(r, c.id);
      const inside = (id: string): boolean => {
        for (let cur: string | undefined = id; cur; cur = parents.get(cur)) {
          if (check.container.includes(byId.get(cur)!.component)) return true;
        }
        return false;
      };
      const bad = order.filter((c) => actionNames(c).some((n) => check.capabilities.includes(n)) && !inside(c.id));
      return bad.length
        ? fail(`${bad.map((c) => c.id).join(", ")} trigger ${check.capabilities.join("/")} outside ${check.container.join("/")}`)
        : ok(`${check.capabilities.join("/")} only inside ${check.container.join("/")}`);
    }
    case "casing": {
      const texts = order.flatMap((c) => [...actionLabels(c), ...["title", "label"].map((p) => c[p]).filter((v) => typeof v === "string")].map((t) => ({ id: c.id, t })));
      const bad = check.style === "sentence" ? texts.filter(({ t }) => isTitleCase(t)) : texts.filter(({ t }) => !isTitleCase(t) && t.trim().split(/\s+/).length > 2);
      return bad.length ? fail(`use ${check.style} case: ${bad.slice(0, 4).map(({ id, t }) => `${id}: "${t}"`).join("; ")}`) : ok(`${check.style} case`);
    }
    case "maxWords": {
      const bad = order.flatMap((c) => actionLabels(c).filter((l) => l.trim().split(/\s+/).length > check.max).map((l) => `${c.id}: "${l}"`));
      return bad.length ? fail(`button labels over ${check.max} words: ${bad.join("; ")}`) : ok(`button labels ≤ ${check.max} words`);
    }
    case "readingLevel": {
      const text = order.flatMap(runningText).join(" ");
      // Readability formulas are noise on a sentence or two; measure only when there's enough text.
      if ((text.match(/[A-Za-z]+/g) ?? []).length < 30) return ok("too little running text to measure");
      const grade = readingGrade(text);
      return grade <= check.maxGrade ? ok(`reading grade ${grade.toFixed(1)}`) : fail(`reading grade ${grade.toFixed(1)} is above ${check.maxGrade}; use shorter sentences and plainer words`);
    }
    case "avoidTerms": {
      const all = order.flatMap((c) => [...labels(c), ...actionLabels(c), ...runningText(c)].map((t) => ({ id: c.id, t })));
      const hits = all.flatMap(({ id, t }) => check.terms.filter((term) => new RegExp(`(^|[^\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|es)?([^\\p{L}]|$)`, "iu").test(t)).map((term) => `${id}: "${term}"`));
      return hits.length ? fail(`avoid ${hits.join("; ")}${check.suggest ? ` (say "${check.suggest}")` : ""}`) : ok("no avoided terms");
    }
    case "noEmoji": {
      const hits = order.flatMap((c) => [...labels(c), ...actionLabels(c), ...runningText(c)].filter((t) => EMOJI.test(t)).map((t) => `${c.id}: "${t}"`));
      return hits.length ? fail(`no emoji: ${hits.slice(0, 3).join("; ")}`) : ok("no emoji");
    }
    case "spelling": {
      const wrong = SPELLING.map(([us, gb]) => (check.variant === "en-GB" ? [us, gb] : [gb, us]));
      const all = order.flatMap((c) => [...labels(c), ...actionLabels(c), ...runningText(c)].map((t) => ({ id: c.id, t })));
      const hits = all.flatMap(({ id, t }) => wrong.filter(([w]) => new RegExp(`\\b${w}`, "i").test(t)).map(([w, right]) => `${id}: "${w}" → "${right}"`));
      return hits.length ? fail(`${check.variant} spelling: ${hits.slice(0, 4).join("; ")}`) : ok(`${check.variant} spelling`);
    }
    case "person": {
      if (check.style === "we-and-you") return ok("any person");
      const re = check.style === "you" ? /\b(we|we're|we'll|our|us)\b/i : /\b(you|your|you're|we|our|us)\b/i;
      const hits = order.flatMap((c) => [...labels(c), ...actionLabels(c), ...runningText(c)].filter((t) => re.test(t)).map((t) => `${c.id}: "${t}"`));
      return hits.length ? fail(`address people as ${check.style === "you" ? '"you" (not "we")' : "neither you nor we"}: ${hits.slice(0, 3).join("; ")}`) : ok(`person: ${check.style}`);
    }
    case "anyOf": {
      const results = check.checks.map((c) => runCheck(c, doc));
      return results.some((r) => r.pass) ? ok(results.find((r) => r.pass)!.message) : fail(`none of: ${results.map((r) => r.message).join(" | ")}`);
    }
    case "allOf": {
      const failed = check.checks.map((c) => runCheck(c, doc)).filter((r) => !r.pass);
      return failed.length ? fail(failed.map((r) => r.message).join("; ")) : ok("all passed");
    }
    case "not": {
      const r = runCheck(check.checks[0], doc);
      return r.pass ? fail(`must not: ${r.message}`) : ok(`not: ${r.message}`);
    }
  }
}
