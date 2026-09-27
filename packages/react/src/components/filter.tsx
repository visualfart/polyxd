import { useLayoutEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { formatValue } from "../format.ts";
import { Render, useA11y } from "../surface.tsx";
import { Icon } from "./avatar.tsx";
import { optionsOf } from "@polyxd/core";
import { Heading } from "./structure.tsx";

/** Below this width the filters move into a bottom sheet. */
const COMPACT_PX = 640;

interface ActiveFilter {
  key: string;
  label: string;
  remove: () => void;
}

/**
 * FilterPanel: filters beside their results on wide surfaces; on compact ones a "Filters · n"
 * button opens a bottom sheet that ends in "Show n results". Search fields stay above the results
 * everywhere. Active filters show as removable chips; the result count is announced politely.
 */
export function FilterPanel({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const a11y = useA11y(node);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setCompact(el.getBoundingClientRect().width < COMPACT_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const label = node.label !== undefined ? b.text(node.label) : "Filters";
  const children: Node[] = (node.children ?? []).map((id: string) => s.byId.get(id)).filter(Boolean);
  const searches = children.filter((c) => c.component === "TextInput" && c.kind === "search");
  const filters = children.filter((c) => !searches.includes(c));
  const active = activeFilters(filters, s, b);
  const count = node.resultCount !== undefined ? b.value<number>(node.resultCount) : undefined;
  const countText = count === undefined ? undefined : `${formatValue(count, { type: "number" }, s.locale)} ${count === 1 ? "result" : "results"}`;
  const clearAll = () => {
    for (const f of active) f.remove();
    if (node.clear) s.dispatch(node.clear, b.scope, node.id);
  };

  const filterFields = filters.map((c) => <Render key={c.id} id={c.id} />);
  const results = (
    <div className="pxd-filter-results">
      {searches.map((c) => (
        <Render key={c.id} id={c.id} />
      ))}
      <div className="pxd-filter-status">
        {compact && (
          <Dialog.Trigger className="pxd-chip pxd-filter-trigger">
            <Icon name="filter" size={18} />
            {label}
            {active.length > 0 && <span aria-hidden="true"> · {active.length}</span>}
            {active.length > 0 && <span className="pxd-sr-only">, {active.length} active</span>}
          </Dialog.Trigger>
        )}
        {countText && (
          <p className="pxd-filter-count" aria-live="polite">
            {countText}
          </p>
        )}
      </div>
      {active.length > 0 && (
        <ul className="pxd-filter-chips" aria-label="Active filters">
          {active.map((f) => (
            <li key={f.key}>
              <button type="button" className="pxd-chip pxd-filter-chip" onClick={f.remove} aria-label={`Remove filter: ${f.label}`}>
                {f.label}
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="pxd-button pxd-button-tertiary pxd-filter-clear" onClick={clearAll}>
              Clear all
            </button>
          </li>
        </ul>
      )}
      <Render id={node.results} />
    </div>
  );

  return (
    <div ref={ref} className={`pxd-filter-panel${compact ? " pxd-filter-compact" : ""}`} {...a11y}>
      {compact ? (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          {results}
          <Dialog.Portal container={s.portal}>
            <Dialog.Overlay className="pxd-overlay" />
            <Dialog.Content className="pxd-sheet" aria-describedby={undefined}>
              <div className="pxd-sheet-header">
                <Dialog.Title className="pxd-sheet-title">{label}</Dialog.Title>
                <Dialog.Close className="pxd-icon-button" aria-label="Close">
                  <Icon name="close" />
                </Dialog.Close>
              </div>
              <div className="pxd-sheet-body pxd-stack">{filterFields}</div>
              <div className="pxd-sheet-footer">
                {active.length > 0 && (
                  <button type="button" className="pxd-button pxd-button-secondary" onClick={clearAll}>
                    Clear all
                  </button>
                )}
                <Dialog.Close className="pxd-button pxd-button-primary">{countText ? `Show ${countText}` : "Show results"}</Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : (
        <div className="pxd-filter-layout">
          <section className="pxd-filter-sidebar" aria-label={label}>
            <Heading className="pxd-filter-title">{label}</Heading>
            <div className="pxd-stack">{filterFields}</div>
          </section>
          {results}
        </div>
      )}
    </div>
  );
}

/** What each filter input currently narrows by, and how to remove it. */
function activeFilters(filters: Node[], s: ReturnType<typeof useSurface>, b: ReturnType<typeof useBindings>): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  for (const c of filters) {
    if (!c.value || typeof c.value !== "object" || !("path" in c.value)) continue;
    const v = b.value<unknown>(c.value);
    const name = b.text(c.label);
    const fmt = (n: number) => formatValue(n, resolveFormat(c.format ?? { type: "number" }, s.data, b.scope), s.locale);
    switch (c.component) {
      case "Choice": {
        const options = optionsOf(c, s.data, b.scope, b.text);
        const labelOf = (x: unknown) => options.find((o) => o.value === x)?.label ?? String(x);
        if (Array.isArray(v)) for (const x of v) out.push({ key: `${c.id}:${x}`, label: labelOf(x), remove: () => b.write(c.value, v.filter((y) => y !== x)) });
        else if (v !== null && v !== undefined && v !== "") out.push({ key: c.id, label: labelOf(v), remove: () => b.write(c.value, null) });
        break;
      }
      case "RangeInput": {
        if (c.mode === "range" && Array.isArray(v)) {
          const [lo, hi] = v.map(Number);
          if (lo > c.min || hi < c.max) out.push({ key: c.id, label: `${name}: ${fmt(lo)} – ${fmt(hi)}`, remove: () => b.write(c.value, [c.min, c.max]) });
        } else if (typeof v === "number" && v < c.max) out.push({ key: c.id, label: `${name}: ${fmt(v)}`, remove: () => b.write(c.value, c.max) });
        break;
      }
      case "Toggle":
        if (v === true) out.push({ key: c.id, label: name, remove: () => b.write(c.value, false) });
        break;
      case "TextInput":
        if (typeof v === "string" && v.trim()) out.push({ key: c.id, label: `${name}: ${v}`, remove: () => b.write(c.value, "") });
        break;
      case "DateInput":
        if (v) out.push({ key: c.id, label: `${name}: ${String(v)}`, remove: () => b.write(c.value, null) });
        break;
    }
  }
  return out;
}
