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
  Table: ["empty"],
  Status: ["action"],
  Confirm: ["summary"],
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
