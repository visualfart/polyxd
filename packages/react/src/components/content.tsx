import { useId } from "react";
import { resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { absolute, childPointer, get } from "../data.ts";
import { formatValue } from "../format.ts";
import { Render, useA11y } from "../surface.tsx";
import { Icon } from "./avatar.tsx";
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
  const s = useSurface();
  const receipt = node.variant === "receipt";
  const value = (item: any) => {
    const raw = b.value(item.value);
    // In a receipt, a zero charge reads as "Free".
    if (receipt && item.format?.type === "currency" && raw === 0 && !item.total) return { text: "Free", free: true };
    return { text: b.text(item.value, item.format), free: false };
  };
  const rows = (node.items as any[]).filter((i) => !i.total);
  const totals = (node.items as any[]).filter((i) => i.total);
  return (
    <div className={`pxd-detail-list${receipt ? " pxd-receipt" : ""}${node.layout === "grid" ? " pxd-detail-grid" : ""}`} {...useA11y(node)}>
      {node.title !== undefined && <Heading className="pxd-detail-title">{b.text(node.title)}</Heading>}
      <dl>
        {rows.map((item: any, i: number) => {
          const v = value(item);
          return (
            <div className="pxd-detail-row" key={item.key ?? i}>
              <dt>{b.text(item.label)}</dt>
              <dd className={v.free ? "pxd-free" : undefined}>{v.text}</dd>
            </div>
          );
        })}
        {totals.map((item: any, i: number) => (
          <div className="pxd-detail-row pxd-total" key={item.key ?? `t${i}`}>
            <dt>{b.text(item.label)}</dt>
            <dd>{value(item).text}</dd>
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
  // Grid for visual items (a Card with media), list otherwise, unless the document says which.
  const template = s.byId.get(node.items.componentId);
  const grid = node.layout === "grid" || (node.layout !== "list" && node.layout !== "timeline" && template?.component === "Card" && !!template.media);
  const timeline = node.layout === "timeline";

  if (!items.length && node.empty) return <Render id={node.empty} />;
  return (
    <div className="pxd-collection" {...useA11y(node)}>
      <div className="pxd-collection-label" id={labelId}>
        {label} <span className="pxd-count">({items.length})</span>
      </div>
      <ul className={`pxd-collection-list${grid ? " pxd-collection-grid" : ""}${timeline ? " pxd-timeline" : ""}`} aria-labelledby={labelId}>
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

const STATUS_ICON: Record<string, string> = { info: "info", success: "check", warning: "alert", error: "alert", empty: "inbox", undo: "check" };

/**
 * Status. 'undo' is a snackbar after a reversible action ran (announced politely, with Undo);
 * 'empty' gets an icon tile and may carry an ActionBar (one primary, one secondary).
 */
export function Status({ node }: { node: Node }) {
  const b = useBindings();
  const urgent = node.kind === "error";
  const a11y = useA11y(node);
  if (node.kind === "undo") {
    return (
      <div className="pxd-snackbar" role="status" {...a11y}>
        <p className="pxd-snackbar-text">
          {b.text(node.title)}
          {node.message !== undefined && <span className="pxd-snackbar-message"> {b.text(node.message)}</span>}
        </p>
        {node.action && <Render id={node.action} />}
      </div>
    );
  }
  return (
    <div className={`pxd-status pxd-status-${node.kind}${node.variant === "inline" ? " pxd-status-notice" : ""}`} role={urgent ? "alert" : "status"} {...a11y}>
      {node.kind === "loading" ? (
        <span className="pxd-spinner" aria-hidden="true" />
      ) : (
        <span className="pxd-status-icon" aria-hidden="true">
          <Icon name={node.icon ?? STATUS_ICON[node.kind]} size={node.kind === "empty" ? 28 : 16} />
        </span>
      )}
      <div className="pxd-status-body">
        <p className="pxd-status-title">{b.text(node.title)}</p>
        {node.message !== undefined && <p className="pxd-status-message">{b.text(node.message)}</p>}
        {node.action && node.variant !== "inline" && (
          <div className="pxd-status-action">
            <Render id={node.action} />
          </div>
        )}
      </div>
      {node.action && node.variant === "inline" && (
        <div className="pxd-status-action">
          <Render id={node.action} />
        </div>
      )}
    </div>
  );
}
