import { useId } from "react";
import { resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { absolute, childPointer, get } from "../data.ts";
import { formatValue } from "../format.ts";
import { Render, useA11y } from "../surface.tsx";
import { Heading } from "./structure.tsx";

export function Text({ node }: { node: Node }) {
  const b = useBindings();
  return (
    <p className={`pxd-text pxd-text-${node.variant ?? "body"}`} {...useA11y(node)}>
      {b.text(node.text, node.format)}
    </p>
  );
}

export function Metric({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const label = b.text(node.label);
  const value = b.text(node.value, node.format);
  let change: { text: string; spoken: string; tone: string } | undefined;
  if (node.change) {
    const raw = b.value<number>(node.change.value);
    if (typeof raw === "number") {
      const favorable = node.change.favorable ?? "increase";
      const dir = raw > 0 ? "up" : raw < 0 ? "down" : "unchanged";
      const good = favorable === "none" || raw === 0 ? "neutral" : (raw > 0) === (favorable === "increase") ? "positive" : "negative";
      const amount = formatValue(Math.abs(raw), resolveFormat(node.change.format, s.data, b.scope), s.locale);
      change = { text: `${raw > 0 ? "▲" : raw < 0 ? "▼" : "■"} ${amount}`, spoken: dir === "unchanged" ? "unchanged" : `${dir} ${amount}`, tone: good };
    }
  }
  const caption = node.caption !== undefined ? b.text(node.caption) : undefined;
  return (
    <div className="pxd-metric" role="group" aria-label={label} {...useA11y(node)}>
      <div className="pxd-metric-label">{label}</div>
      <div className="pxd-metric-value">{value}</div>
      {change && (
        <div className={`pxd-metric-change pxd-data-${change.tone}`}>
          <span aria-hidden="true">{change.text}</span>
          <span className="pxd-sr-only">{change.spoken}</span>
        </div>
      )}
      {caption && <div className="pxd-metric-caption">{caption}</div>}
    </div>
  );
}

export function DetailList({ node }: { node: Node }) {
  const b = useBindings();
  return (
    <div className="pxd-detail-list" {...useA11y(node)}>
      {node.title !== undefined && <Heading className="pxd-detail-title">{b.text(node.title)}</Heading>}
      <dl>
        {node.items.map((item: any, i: number) => (
          <div className="pxd-detail-row" key={item.key ?? i}>
            <dt>{b.text(item.label)}</dt>
            <dd>{b.text(item.value, item.format)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Stable value used for selecting an item: its id when present, else its index. */
const itemValue = (item: any, index: number) => (item && typeof item === "object" && "id" in item ? item.id : index);

export function Collection({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const labelId = useId();
  const pointer = absolute(node.items.path, b.scope);
  const items = (get(s.data, pointer) as unknown[]) ?? [];
  const selection = node.selection ?? "none";
  const selected = selection !== "none" && node.selected ? b.value<unknown>(node.selected) : undefined;
  const isSelected = (v: unknown) => (Array.isArray(selected) ? selected.includes(v) : selected === v);
  const toggle = (v: unknown) => {
    if (!node.selected) return;
    if (selection === "single") return b.write(node.selected, v);
    const cur = Array.isArray(selected) ? selected : [];
    b.write(node.selected, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };
  const label = b.text(node.label);

  if (!items.length && node.empty) return <Render id={node.empty} />;
  return (
    <div className="pxd-collection" {...useA11y(node)}>
      <div className="pxd-collection-label" id={labelId}>
        {label} <span className="pxd-count">({items.length})</span>
      </div>
      <ul className="pxd-collection-list" aria-labelledby={labelId}>
        {items.map((item, i) => {
          const v = itemValue(item, i);
          const scope = { pointer: childPointer(pointer, i) };
          return (
            <li key={String(v)} className="pxd-collection-item">
              {selection !== "none" && (
                <input
                  type={selection === "single" ? "radio" : "checkbox"}
                  className="pxd-collection-select"
                  name={selection === "single" ? `${node.id}-selection` : undefined}
                  checked={isSelected(v)}
                  onChange={() => toggle(v)}
                  aria-label={`Select item ${i + 1} of ${items.length}`}
                />
              )}
              <div className="pxd-collection-content">
                <Render id={node.items.componentId} scope={scope} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const NUMERIC = new Set(["number", "currency", "percent", "duration"]);

export function Table({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const pointer = absolute(node.rows.path, b.scope);
  const rows = (get(s.data, pointer) as any[]) ?? [];
  if (!rows.length && node.empty) return <Render id={node.empty} />;
  return (
    <div className="pxd-table-wrap" {...useA11y(node)}>
      <table className="pxd-table">
        <caption>{b.text(node.caption)}</caption>
        <thead>
          <tr>
            {node.columns.map((c: any) => (
              <th key={c.key} scope="col" className={NUMERIC.has(c.format?.type) ? "pxd-num" : undefined}>
                {b.text(c.label)}
              </th>
            ))}
            {node.rowAction && (
              <th scope="col">
                <span className="pxd-sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const scope = { pointer: childPointer(pointer, i) };
            return (
              <tr key={row?.id ?? i}>
                {node.columns.map((c: any, ci: number) => {
                  const text = formatValue(get(s.data, absolute(c.path, scope)), resolveFormat(c.format, s.data, b.scope), s.locale);
                  const Cell = ci === 0 ? "th" : "td";
                  return (
                    <Cell key={c.key} scope={ci === 0 ? "row" : undefined} data-label={b.text(c.label)} className={NUMERIC.has(c.format?.type) ? "pxd-num" : undefined}>
                      {text}
                    </Cell>
                  );
                })}
                {node.rowAction && (
                  <td className="pxd-table-action">
                    <button type="button" className="pxd-button pxd-button-tertiary" onClick={() => s.dispatch(node.rowAction, scope, node.id)}>
                      Select<span className="pxd-sr-only"> {formatValue(get(s.data, absolute(node.columns[0].path, scope)), resolveFormat(node.columns[0].format, s.data, b.scope), s.locale)}</span>
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Media({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const ref = b.value<string>(node.src);
  const url = ref ? s.resolveMedia?.(ref) : undefined;
  const alt = node.decorative ? "" : b.text(node.alt);
  const cls = `pxd-media pxd-media-${node.aspect ?? "auto"}`;
  if (!url) return <div className={`${cls} pxd-media-placeholder`} role={node.decorative ? "presentation" : "img"} aria-label={alt || undefined} />;
  return <img className={cls} src={url} alt={alt} {...useA11y(node)} />;
}

const STATUS_ICON: Record<string, string> = { info: "ℹ", success: "✓", warning: "!", error: "✕", empty: "○" };

export function Status({ node }: { node: Node }) {
  const b = useBindings();
  const urgent = node.kind === "error";
  return (
    <div className={`pxd-status pxd-status-${node.kind}`} role={urgent ? "alert" : "status"} {...useA11y(node)}>
      {node.kind === "loading" ? (
        <span className="pxd-spinner" aria-hidden="true" />
      ) : (
        <span className="pxd-status-icon" aria-hidden="true">
          {STATUS_ICON[node.kind]}
        </span>
      )}
      <div className="pxd-status-body">
        <p className="pxd-status-title">{b.text(node.title)}</p>
        {node.message !== undefined && <p className="pxd-status-message">{b.text(node.message)}</p>}
        {node.action && (
          <div className="pxd-status-action">
            <Render id={node.action} />
          </div>
        )}
      </div>
    </div>
  );
}
