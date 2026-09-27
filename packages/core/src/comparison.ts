/** Comparison decisions: the best item per attribute, attribute groups, and who comes first. */

/** Best item per attribute, when the attribute says which direction is better and one item wins outright. */
export function bestPerAttribute(attributes: any[], count: number, at: (path: string, i: number) => unknown): Map<string, number> {
  const best = new Map<string, number>();
  for (const a of attributes) {
    if (!a.better || a.better === "none") continue;
    const vals = Array.from({ length: count }, (_, i) => Number(at(a.path, i)));
    const target = a.better === "higher" ? Math.max(...vals) : Math.min(...vals);
    if (vals.filter((v) => v === target).length === 1) best.set(a.key, vals.indexOf(target));
  }
  return best;
}

/** Attributes under their group headings, in first-seen order. */
export function groupAttributes<T extends { group?: unknown }>(attributes: T[], text: (v: unknown) => string): { label?: string; attributes: T[] }[] {
  const groups: { label?: string; attributes: T[] }[] = [];
  for (const a of attributes) {
    const label = a.group !== undefined ? text(a.group) : undefined;
    const g = groups.find((x) => x.label === label);
    if (g) g.attributes.push(a);
    else groups.push({ label, attributes: [a] });
  }
  return groups;
}

/** The recommended item comes first, so it's read (and seen on phones) first. */
export function recommendedFirst(titles: string[], recommended: string | undefined): number[] {
  const order = titles.map((_, i) => i);
  const ri = order.findIndex((i) => titles[i] === recommended);
  if (ri > 0) order.unshift(...order.splice(ri, 1));
  return order;
}

/** Items under their group headings (Navigation), in first-seen order. */
export function groupItems<T extends { group?: unknown }>(items: T[], text: (v: unknown) => string): { label?: string; items: T[] }[] {
  const groups: { label?: string; items: T[] }[] = [];
  for (const item of items) {
    const g = item.group !== undefined ? text(item.group) : undefined;
    const found = groups.find((x) => x.label === g);
    if (found) found.items.push(item);
    else groups.push({ label: g, items: [item] });
  }
  return groups;
}

/** A navigation's accessible name by kind, when the document gives none. */
export const navigationLabel = (kind: string): string => (kind === "breadcrumb" ? "Breadcrumb" : kind === "toc" ? "On this page" : "Main");
