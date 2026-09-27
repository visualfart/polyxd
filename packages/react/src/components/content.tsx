import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { asList, absolute, childPointer, get, type Scope } from "../data.ts";
import { formatValue, safeColor } from "../format.ts";
import { STATUS_ICON, calendarMonth, collectionItemValue, collectionLayout, dateParts, monthToShow, moveItem, nearestSlide, orderedIndices, qrEncode, richText, shiftMonth as shiftMonthBy, type RichToken } from "@polyxd/core";
import { Render, useA11y } from "../surface.tsx";
import { Icon } from "./avatar.tsx";
import { Heading } from "./structure.tsx";
import { Paging } from "./table.tsx";

/** A colour value shown as itself: a swatch beside the text. */
export function Swatch({ value }: { value: string }) {
  const color = safeColor(value);
  return <span className={`pxd-swatch${color ? "" : " pxd-swatch-unknown"}`} style={color ? { background: color } : undefined} aria-hidden="true" />;
}

/** The rich-text tokens core parses, as elements. */
function richNodes(tokens: RichToken[]): ReactNode[] {
  return tokens.map((t, i) => {
    if (typeof t === "string") return t;
    if (t.kind === "code") return <code key={i}>{t.text}</code>;
    if (t.kind === "strong") return <strong key={i}>{richNodes(t.children)}</strong>;
    if (t.kind === "em") return <em key={i}>{richNodes(t.children)}</em>;
    if (t.kind !== "link") return null;
    return t.href ? (
      <a key={i} href={t.href} rel="noopener noreferrer">
        {richNodes(t.children)}
      </a>
    ) : (
      <span key={i}>{richNodes(t.children)}</span>
    );
  });
}

export function Text({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const a11y = useA11y(node);
  const variant = node.variant ?? "body";
  const color = node.format?.type === "color";
  const content = (v: unknown, format = node.format) => {
    const text = b.text(v, format);
    return format?.type === "color" ? (
      <>
        <Swatch value={text} />
        {text}
      </>
    ) : (
      text
    );
  };
  if (variant === "rich") {
    return (
      <p className="pxd-text pxd-text-body pxd-text-rich" {...a11y}>
        {richNodes(richText(b.text(node.text)))}
      </p>
    );
  }
  if (variant === "quote") {
    return (
      <figure className="pxd-text-quote" {...a11y}>
        <blockquote>
          <p className="pxd-text pxd-text-body">{content(node.text)}</p>
        </blockquote>
        {node.cite !== undefined && <figcaption className="pxd-text-cite">{b.text(node.cite)}</figcaption>}
      </figure>
    );
  }
  if (variant === "list") {
    const pointer = node.items ? absolute(node.items.path, b.scope) : undefined;
    const entries = pointer ? asList(get(s.data, pointer)) : [];
    const List = node.ordered ? "ol" : "ul";
    const intro = b.text(node.text);
    return (
      <div className="pxd-text-list" {...a11y}>
        {intro && <p className="pxd-text pxd-text-body">{intro}</p>}
        <List className={`pxd-text-list-items${node.ordered ? " pxd-text-list-ordered" : ""}`}>
          {entries.map((entry, i) => {
            const raw = node.itemPath && pointer ? get(s.data, absolute(node.itemPath, { pointer: childPointer(pointer, i) })) : entry;
            return <li key={i}>{content(raw)}</li>;
          })}
        </List>
      </div>
    );
  }
  return (
    <p className={`pxd-text pxd-text-${variant}${color ? " pxd-text-color" : ""}`} {...a11y}>
      {content(node.text)}
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
    if (receipt && item.format?.type === "currency" && raw === 0 && !item.total) return { text: "Free", free: true, color: false };
    return { text: b.text(item.value, item.format), free: false, color: item.format?.type === "color" };
  };
  // The 'Change' link per row (GOV.UK summary list). The row's key travels with the context.
  const change = (item: any, label: string) =>
    node.rowAction ? (
      <button
        type="button"
        className="pxd-link pxd-detail-change"
        onClick={() => s.dispatch({ event: { name: node.rowAction.event.name, context: { key: item.key ?? label, ...(node.rowAction.event.context ?? {}) } } }, b.scope, node.id)}
      >
        Change<span className="pxd-sr-only"> {label}</span>
      </button>
    ) : null;
  const rows = (node.items as any[]).filter((i) => !i.total);
  const totals = (node.items as any[]).filter((i) => i.total);
  return (
    <div className={`pxd-detail-list${receipt ? " pxd-receipt" : ""}${node.layout === "grid" ? " pxd-detail-grid" : ""}${node.rowAction ? " pxd-detail-actions" : ""}`} {...useA11y(node)}>
      {node.title !== undefined && <Heading className="pxd-detail-title">{b.text(node.title)}</Heading>}
      <dl>
        {rows.map((item: any, i: number) => {
          const v = value(item);
          const label = b.text(item.label);
          return (
            <div className="pxd-detail-row" key={item.key ?? i}>
              <dt>{label}</dt>
              <dd className={v.free ? "pxd-free" : undefined}>
                {v.color && <Swatch value={v.text} />}
                {v.text}
              </dd>
              {node.rowAction && <dd className="pxd-detail-row-action">{change(item, label)}</dd>}
            </div>
          );
        })}
        {totals.map((item: any, i: number) => (
          <div className="pxd-detail-row pxd-total" key={item.key ?? `t${i}`}>
            <dt>{b.text(item.label)}</dt>
            <dd>{value(item).text}</dd>
            {node.rowAction && <dd className="pxd-detail-row-action" />}
          </div>
        ))}
      </dl>
    </div>
  );
}

const itemValue = collectionItemValue;

export function Collection({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const labelId = useId();
  const pointer = absolute(node.items.path, b.scope);
  const items = asList(get(s.data, pointer));
  const selection = node.selection ?? "none";
  const selected = selection !== "none" && node.selected ? b.value<unknown>(node.selected) : undefined;
  const isSelected = (v: unknown) => (Array.isArray(selected) ? selected.includes(v) : selected === v);
  const toggle = (v: unknown) => {
    if (!node.selected) return;
    if (selection === "single") return b.write(node.selected, v);
    const cur = Array.isArray(selected) ? selected : [];
    b.write(node.selected, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };
  const selectedCount = Array.isArray(selected) ? selected.length : 0;
  const label = b.text(node.label);
  // Grid for visual items (a Card with media), list otherwise, unless the document says which.
  const template = s.byId.get(node.items.componentId);
  const { grid, timeline, carousel, calendar } = collectionLayout(node, template);

  // Items in the order people put them ('order' holds item values); unknown values keep host order at the end.
  const reorderable = node.reorderable === true;
  const order = reorderable && node.order ? b.value<unknown[]>(node.order) : undefined;
  const values = items.map((item, i) => itemValue(item, i));
  const indices = orderedIndices(values, order);
  const move = (from: number, to: number) => {
    const next = node.order ? moveItem(indices, values, from, to) : undefined;
    if (next) b.write(node.order, next);
  };
  const [dragging, setDragging] = useState<number | null>(null);

  // Carousel: which item is in view, for the readout and the buttons.
  const track = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState(0);
  const slides = () => Array.from(track.current?.children ?? []) as HTMLElement[];
  const measure = () => {
    const el = track.current;
    if (!el) return;
    setPosition(nearestSlide(slides().map((c) => c.offsetLeft - el.offsetLeft), el.scrollLeft));
  };
  const goTo = (i: number) => {
    const el = track.current;
    const target = slides()[Math.max(0, Math.min(items.length - 1, i))];
    if (el && target) el.scrollTo({ left: target.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };

  // Calendar: the month shown starts at the first dated item (or today) and moves a month at a time.
  const dated = calendar ? items.map((_, i) => dateParts(node.datePath ? get(s.data, absolute(node.datePath, { pointer: childPointer(pointer, i) })) : undefined)) : [];
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const shown = monthToShow(month, dated.find(Boolean));
  const shiftMonth = (by: number) => setMonth(shiftMonthBy(shown, by));

  if (!items.length && node.empty) return <Render id={node.empty} />;

  const itemEl = (i: number, pos: number) => {
    const item = items[i];
    const v = values[i];
    const scope = { pointer: childPointer(pointer, i) };
    return (
      <li
        key={String(v)}
        className={`pxd-collection-item${dragging === pos ? " pxd-collection-dragging" : ""}`}
        draggable={reorderable || undefined}
        onDragStart={reorderable ? () => setDragging(pos) : undefined}
        onDragOver={reorderable ? (e) => e.preventDefault() : undefined}
        onDrop={
          reorderable
            ? () => {
                if (dragging !== null) move(dragging, pos);
                setDragging(null);
              }
            : undefined
        }
        onDragEnd={reorderable ? () => setDragging(null) : undefined}
      >
        {reorderable && (
          <div className="pxd-collection-reorder">
            <span className="pxd-collection-handle" aria-hidden="true">
              <Icon name="menu" size={16} />
            </span>
            <button type="button" className="pxd-icon-button pxd-collection-move" aria-label={`Move item ${pos + 1} up`} disabled={pos === 0} onClick={() => move(pos, pos - 1)}>
              <Icon name="sortUp" size={16} />
            </button>
            <button type="button" className="pxd-icon-button pxd-collection-move" aria-label={`Move item ${pos + 1} down`} disabled={pos === items.length - 1} onClick={() => move(pos, pos + 1)}>
              <Icon name="sortDown" size={16} />
            </button>
          </div>
        )}
        {selection !== "none" && (
          <input
            type={selection === "single" ? "radio" : "checkbox"}
            className="pxd-collection-select"
            name={selection === "single" ? `${node.id}-selection` : undefined}
            checked={isSelected(v)}
            onChange={() => toggle(v)}
            aria-label={`Select item ${pos + 1} of ${items.length}`}
          />
        )}
        <div className="pxd-collection-content">
          <Render id={node.items.componentId} scope={scope} />
        </div>
      </li>
    );
  };

  const bulk = selection === "multiple" && selectedCount > 0 && (
    <div className="pxd-table-toolbar pxd-table-bulk" role="toolbar" aria-label={`Actions for ${selectedCount} selected`}>
      <p className="pxd-bulk-count" aria-live="polite">
        {selectedCount} selected
      </p>
      {node.bulkActions && <Render id={node.bulkActions} />}
      <button type="button" className="pxd-button pxd-button-tertiary" onClick={() => b.write(node.selected, [])}>
        Cancel
      </button>
    </div>
  );

  let body: ReactNode;
  if (carousel) {
    body = (
      <div className="pxd-carousel" role="group" aria-roledescription="carousel" aria-labelledby={labelId}>
        <ul className="pxd-collection-list pxd-carousel-track" aria-labelledby={labelId} ref={track} onScroll={measure}>
          {indices.map((i, pos) => itemEl(i, pos))}
        </ul>
        <div className="pxd-carousel-controls">
          <button type="button" className="pxd-icon-button" aria-label="Previous item" disabled={position <= 0} onClick={() => goTo(position - 1)}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <p className="pxd-carousel-position" aria-live="polite">
            {position + 1} of {items.length}
          </p>
          <button type="button" className="pxd-icon-button" aria-label="Next item" disabled={position >= items.length - 1} onClick={() => goTo(position + 1)}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </div>
    );
  } else if (calendar) {
    const { monthName, weekdays, weeks } = calendarMonth(shown, s.locale);
    const onDay = (d: number) => indices.filter((i) => dated[i] && dated[i]!.y === shown.y && dated[i]!.m === shown.m && dated[i]!.d === d);
    body = (
      <div className="pxd-calendar">
        <div className="pxd-calendar-header">
          <button type="button" className="pxd-icon-button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <p className="pxd-calendar-month" aria-live="polite">
            {monthName}
          </p>
          <button type="button" className="pxd-icon-button" aria-label="Next month" onClick={() => shiftMonth(1)}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
        <table className="pxd-calendar-grid">
          <caption className="pxd-sr-only">
            {label}, {monthName}
          </caption>
          <thead>
            <tr>
              {weekdays.map((w) => (
                <th key={w} scope="col">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((d, di) =>
                  d === null ? (
                    <td key={di} className="pxd-calendar-empty" />
                  ) : (
                    <td key={di} className={`pxd-calendar-day${onDay(d).length ? " pxd-calendar-has-items" : ""}`}>
                      <span className="pxd-calendar-date">{d}</span>
                      {onDay(d).length > 0 && (
                        <ul className="pxd-calendar-items">
                          {onDay(d).map((i) => (
                            <li key={String(values[i])} className="pxd-collection-item">
                              {selection !== "none" && (
                                <input type={selection === "single" ? "radio" : "checkbox"} className="pxd-collection-select" name={selection === "single" ? `${node.id}-selection` : undefined} checked={isSelected(values[i])} onChange={() => toggle(values[i])} aria-label={`Select item on ${d}`} />
                              )}
                              <div className="pxd-collection-content">
                                <Render id={node.items.componentId} scope={{ pointer: childPointer(pointer, i) }} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    body = (
      <ul className={`pxd-collection-list${grid ? " pxd-collection-grid" : ""}${timeline ? " pxd-timeline" : ""}${reorderable ? " pxd-collection-reorderable" : ""}`} aria-labelledby={labelId}>
        {indices.map((i, pos) => itemEl(i, pos))}
      </ul>
    );
  }

  return (
    <div className="pxd-collection" {...useA11y(node)}>
      <div className="pxd-collection-label" id={labelId}>
        {label} <span className="pxd-count">({items.length})</span>
      </div>
      {bulk}
      {body}
      {node.page && <Paging node={node} rows={items.length} />}
    </div>
  );
}

/**
 * Media: an image by default; a video or audio player with native controls and a transcript; a
 * gallery of the host's images; or a QR code of a value, drawn here so no URL leaves the surface.
 */
export function Media({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const a11y = useA11y(node);
  // Which gallery picture the viewer shows (null when closed), and the button that opened it.
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const kind = node.kind ?? "image";
  const ref = node.src ? b.value<string>(node.src) : undefined;
  const url = ref ? s.resolveMedia?.(ref) : undefined;
  const alt = node.decorative ? "" : b.text(node.alt);
  const cls = `pxd-media pxd-media-${node.aspect ?? "auto"}`;

  if (kind === "qr") return <QRCode text={b.text(node.value)} alt={alt} a11y={a11y} />;

  if (kind === "gallery") {
    const pointer = node.items ? absolute(node.items.path, b.scope) : undefined;
    const entries = pointer ? asList(get(s.data, pointer)) : [];
    const items = entries.map((_, i) => {
      const scope: Scope = { pointer: childPointer(pointer!, i) };
      const imageRef = node.imagePath ? get(s.data, absolute(node.imagePath, scope)) : undefined;
      const src = imageRef ? s.resolveMedia?.(String(imageRef)) : undefined;
      const itemAlt = node.altPath ? String(get(s.data, absolute(node.altPath, scope)) ?? "") : "";
      return { src, alt: itemAlt };
    });
    // Only pictures that resolved can be opened; the viewer counts and moves among those.
    const pictures = items.filter((it): it is Picture => Boolean(it.src));
    return (
      <>
        <ul className="pxd-gallery" aria-label={alt || undefined} {...a11y}>
          {items.map((it, i) => {
            const at = pictures.indexOf(it as Picture);
            return (
              <li key={i}>
                {at >= 0 ? (
                  <button
                    type="button"
                    className="pxd-gallery-item"
                    aria-label={it.alt ? `Open ${it.alt}` : `Open image ${at + 1} of ${pictures.length}`}
                    onClick={(e) => {
                      opener.current = e.currentTarget;
                      setOpen(at);
                    }}
                  >
                    <img className={`${cls} pxd-gallery-image`} src={it.src} alt={it.alt} />
                  </button>
                ) : (
                  <div className={`${cls} pxd-media-placeholder pxd-gallery-image`} role="img" aria-label={it.alt || undefined} />
                )}
              </li>
            );
          })}
        </ul>
        {open !== null && pictures[open] && <GalleryViewer name={alt} pictures={pictures} index={open} onIndex={setOpen} onClose={() => setOpen(null)} returnTo={opener} />}
      </>
    );
  }

  if (kind === "video" || kind === "audio") {
    const transcript = node.transcript !== undefined ? b.text(node.transcript) : undefined;
    const posterRef = node.poster !== undefined ? b.text(node.poster) : undefined;
    const poster = posterRef ? s.resolveMedia?.(posterRef) : undefined;
    return (
      <figure className={`pxd-media-player pxd-media-${kind}`} {...a11y}>
        {kind === "video" ? (
          url ? (
            <video className={cls} controls src={url} poster={poster} aria-label={alt || undefined} />
          ) : (
            <div className={`${cls} pxd-media-placeholder`} role="img" aria-label={alt || undefined} />
          )
        ) : url ? (
          <audio className="pxd-media-audio-player" controls src={url} aria-label={alt || undefined} />
        ) : (
          <div className="pxd-media-placeholder pxd-media-audio-placeholder" role="img" aria-label={alt || undefined} />
        )}
        {alt && <figcaption className="pxd-media-caption">{alt}</figcaption>}
        {transcript && (
          <details className="pxd-media-transcript">
            <summary>Transcript</summary>
            <p className="pxd-text pxd-text-body">{transcript}</p>
          </details>
        )}
      </figure>
    );
  }

  if (!url) return <div className={`${cls} pxd-media-placeholder`} role={node.decorative ? "presentation" : "img"} aria-label={alt || undefined} />;
  return <img className={cls} src={url} alt={alt} {...a11y} />;
}

type Picture = { src: string; alt: string };

/** A left or right chevron: the icon set only has the downward one. */
function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

/**
 * One gallery picture at a time, large, with previous/next and a counter. The arrow keys move
 * while it is open; Escape closes (Radix Dialog). It portals into the surface, like every overlay.
 */
function GalleryViewer({ name, pictures, index, onIndex, onClose, returnTo }: { name: string; pictures: Picture[]; index: number; onIndex: (i: number) => void; onClose: () => void; returnTo: React.RefObject<HTMLElement | null> }) {
  const s = useSurface();
  const prev = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const n = pictures.length;
  const { src, alt } = pictures[index];
  const go = (i: number) => onIndex(Math.max(0, Math.min(n - 1, i)));
  // At either end the button just used goes disabled; focus moves to the other one rather than dying.
  useEffect(() => {
    const active = prev.current?.ownerDocument.activeElement as HTMLButtonElement | null;
    if (active?.disabled) (active === prev.current ? next : prev).current?.focus();
  }, [index]);
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal container={s.portal}>
        <Dialog.Overlay className="pxd-overlay" />
        <Dialog.Content
          className="pxd-viewer"
          aria-describedby={undefined}
          // Focus goes back to the picture that was opened, whichever picture was shown last.
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnTo.current?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") go(index - 1);
            else if (e.key === "ArrowRight") go(index + 1);
          }}
        >
          <Dialog.Title className="pxd-sr-only">{name || "Pictures"}</Dialog.Title>
          <div className="pxd-viewer-bar">
            <span className="pxd-viewer-counter" aria-live="polite">{`${index + 1} of ${n}`}</span>
            <Dialog.Close className="pxd-icon-button pxd-viewer-close" aria-label="Close">
              <Icon name="close" />
            </Dialog.Close>
          </div>
          <figure className="pxd-viewer-figure">
            <img className="pxd-viewer-image" src={src} alt={alt} />
            {alt && <figcaption className="pxd-viewer-caption">{alt}</figcaption>}
          </figure>
          <div className="pxd-viewer-bar pxd-viewer-nav">
            <button ref={prev} type="button" className="pxd-icon-button pxd-viewer-step" aria-label="Previous picture" disabled={index === 0} onClick={() => go(index - 1)}>
              <Arrow dir="left" />
            </button>
            <button ref={next} type="button" className="pxd-icon-button pxd-viewer-step" aria-label="Next picture" disabled={index === n - 1} onClick={() => go(index + 1)}>
              <Arrow dir="right" />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A QR code on a canvas, in the surface's text and surface colours; too long a value falls back to text. */
function QRCode({ text, alt, a11y }: { text: string; alt: string; a11y: Record<string, unknown> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const grid = useMemo(() => (text ? qrEncode(text) : undefined), [text]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !grid) return;
    const scale = 4;
    const quiet = 4;
    const size = grid.length;
    canvas.width = canvas.height = (size + quiet * 2) * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const style = getComputedStyle(canvas);
    const dark = style.getPropertyValue("--pxd-color-text-default").trim() || "#000";
    const light = style.getPropertyValue("--pxd-color-surface-default").trim() || "#fff";
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = dark;
    grid.forEach((row, y) => row.forEach((on, x) => on && ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale)));
  }, [grid]);
  if (!grid) {
    return (
      <div className="pxd-qr pxd-qr-placeholder" role="img" aria-label={alt || `QR code: ${text}`} {...a11y}>
        <span className="pxd-qr-mark" aria-hidden="true">
          QR
        </span>
        <span className="pxd-qr-text">{text}</span>
      </div>
    );
  }
  return <canvas ref={ref} className="pxd-qr" role="img" aria-label={alt || `QR code: ${text}`} {...a11y} />;
}

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
