/** What each filter input currently narrows by, and what removing it writes. */
import { isBinding, resolve, type Scope } from "./data.ts";
import type { Node } from "./document.ts";
import { formatValue, resolveFormat } from "./format.ts";
import { optionsOf } from "./options.ts";

export interface ActiveFilter {
  key: string;
  label: string;
  /** The binding to write, and what to write to clear this filter */
  binding: { path: string };
  cleared: unknown;
}

export function activeFilters(filters: Node[], data: unknown, scope: Scope, locale: string, text: (v: unknown) => string): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  for (const c of filters) {
    if (!isBinding(c.value)) continue;
    const binding = c.value;
    const v = resolve<unknown>(c.value, data, scope);
    const name = text(c.label);
    const fmt = (n: number) => formatValue(n, resolveFormat(c.format ?? { type: "number" }, data, scope), locale);
    switch (c.component) {
      case "Choice": {
        const options = optionsOf(c, data, scope, text);
        const labelOf = (x: unknown) => options.find((o) => o.value === x)?.label ?? String(x);
        if (Array.isArray(v)) for (const x of v) out.push({ key: `${c.id}:${x}`, label: labelOf(x), binding, cleared: v.filter((y) => y !== x) });
        else if (v !== null && v !== undefined && v !== "") out.push({ key: c.id, label: labelOf(v), binding, cleared: null });
        break;
      }
      case "RangeInput": {
        if (c.mode === "range" && Array.isArray(v)) {
          const [lo, hi] = v.map(Number);
          if (lo > c.min || hi < c.max) out.push({ key: c.id, label: `${name}: ${fmt(lo)} – ${fmt(hi)}`, binding, cleared: [c.min, c.max] });
        } else if (typeof v === "number" && v < c.max) out.push({ key: c.id, label: `${name}: ${fmt(v)}`, binding, cleared: c.max });
        break;
      }
      case "Toggle":
        if (v === true) out.push({ key: c.id, label: name, binding, cleared: false });
        break;
      case "TextInput":
        if (typeof v === "string" && v.trim()) out.push({ key: c.id, label: `${name}: ${v}`, binding, cleared: "" });
        break;
      case "DateInput":
        if (v) out.push({ key: c.id, label: `${name}: ${String(v)}`, binding, cleared: null });
        break;
    }
  }
  return out;
}

/** Below this width the filters move into a bottom sheet. */
export const FILTER_COMPACT_PX = 640;

/** "12 results", "1 result". */
export const resultCountText = (count: number | undefined, locale: string): string | undefined => (count === undefined ? undefined : `${formatValue(count, { type: "number" }, locale)} ${count === 1 ? "result" : "results"}`);
