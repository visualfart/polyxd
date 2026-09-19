import { readingOrder } from "@polyxd/spec/checks";

/**
 * Consistency between two generations of the same intent: does the thing the user saw last time
 * look and sit the same way now? Components are matched by their semantic `key`, which the
 * generator keeps stable and interface memory records (see Maru, docs/decisions/0001).
 */
export interface Consistency {
  /** 0 (nothing recognisable) to 1 (same structure, order and labels) */
  score: number;
  parts: { pattern: number; coverage: number; components: number; order: number; labels: number };
  differences: string[];
}

interface Keyed {
  component: string;
  label?: string;
  index: number;
}

const WEIGHTS = { pattern: 0.15, coverage: 0.15, components: 0.3, order: 0.2, labels: 0.2 };

/** Keyed things in reading order: components with a key, plus keyed items inside them (detail rows, columns, steps…). */
export function signature(doc: any): Map<string, Keyed> {
  const out = new Map<string, Keyed>();
  let index = 0;
  const add = (key: string | undefined, component: string, label: unknown) => {
    if (!key || out.has(key)) return;
    out.set(key, { component, label: typeof label === "string" ? label : undefined, index: index++ });
  };
  for (const c of readingOrder(doc)) {
    add(c.key, c.component, c.label ?? c.title ?? c.summary);
    for (const list of [c.items, c.columns, c.attributes, c.steps, c.views, c.series]) {
      if (Array.isArray(list)) for (const item of list) add(item?.key, `${c.component}.item`, item?.label ?? item?.title);
    }
  }
  return out;
}

/** Fraction of ordered pairs that keep their relative order (1 = identical order). */
function orderAgreement(a: string[], b: string[]): number {
  const pos = new Map(b.map((k, i) => [k, i]));
  let agree = 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      total++;
      if (pos.get(a[i])! < pos.get(a[j])!) agree++;
    }
  }
  return total ? agree / total : 1;
}

export function compare(previous: any, current: any): Consistency {
  const a = signature(previous);
  const b = signature(current);
  const shared = [...a.keys()].filter((k) => b.has(k));
  const union = new Set([...a.keys(), ...b.keys()]);
  const differences: string[] = [];

  const pattern = previous.surface?.pattern === current.surface?.pattern ? 1 : 0;
  if (!pattern) differences.push(`pattern changed: ${previous.surface?.pattern ?? "none"} → ${current.surface?.pattern ?? "none"}`);

  const coverage = union.size ? shared.length / union.size : 1;
  for (const k of a.keys()) if (!b.has(k)) differences.push(`"${k}" disappeared`);
  for (const k of b.keys()) if (!a.has(k)) differences.push(`"${k}" is new`);

  const sameComponent = shared.filter((k) => a.get(k)!.component === b.get(k)!.component);
  for (const k of shared) if (a.get(k)!.component !== b.get(k)!.component) differences.push(`"${k}" changed from ${a.get(k)!.component} to ${b.get(k)!.component}`);
  const components = shared.length ? sameComponent.length / shared.length : 1;

  const orderA = shared.sort((x, y) => a.get(x)!.index - a.get(y)!.index);
  const order = orderAgreement(orderA, [...orderA].sort((x, y) => b.get(x)!.index - b.get(y)!.index));
  if (order < 1) differences.push(`order changed (${Math.round(order * 100)}% of pairs kept their order)`);

  const labelled = shared.filter((k) => a.get(k)!.label !== undefined || b.get(k)!.label !== undefined);
  const sameLabel = labelled.filter((k) => a.get(k)!.label === b.get(k)!.label);
  for (const k of labelled) if (a.get(k)!.label !== b.get(k)!.label) differences.push(`"${k}" relabelled: "${a.get(k)!.label}" → "${b.get(k)!.label}"`);
  const labels = labelled.length ? sameLabel.length / labelled.length : 1;

  const parts = { pattern, coverage, components, order, labels };
  const score = Object.entries(WEIGHTS).reduce((s, [k, w]) => s + w * parts[k as keyof typeof parts], 0);
  return { score: Math.round(score * 1000) / 1000, parts, differences };
}
