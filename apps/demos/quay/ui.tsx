import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { initials as initialsOf } from "./seed.ts";
import { resolveMedia } from "./media.ts";

export { money, compact, shortDate, longDate, dateOnly, time, relative, daysWord, percent, plural, isoDay } from "./format.ts";

/* ---- Icons: 20-unit grid, the outline shapes a Polaris admin uses. ---- */

const PATHS: Record<string, string> = {
  home: "M3 9.5 10 3l7 6.5V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1z",
  orders: "M4 3h12v14l-2-1.5L12 17l-2-1.5L8 17l-2-1.5L4 17zM7 7h6M7 10h6M7 13h4",
  products: "M3 6l7-3 7 3v8l-7 3-7-3zM3 6l7 3 7-3M10 9v8",
  customers: "M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 17a7 7 0 0 1 14 0",
  discounts: "M3 10l7-7h7v7l-7 7zM13.5 6.5h.01",
  marketing: "M3 9v2h3l6 4V5L6 9zM14 7a3.5 3.5 0 0 1 0 6",
  analytics: "M3 17h14M5 14v-4M9 14V6M13 14V9M17 14V4",
  settings: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM16 10l1.3-1-1-2.4-1.6.2a5 5 0 0 0-1.4-1.4l.2-1.6L11.1 3 10 4.3 8.9 3 6.5 3.8l.2 1.6A5 5 0 0 0 5.3 6.8l-1.6-.2-1 2.4L4 10l-1.3 1 1 2.4 1.6-.2a5 5 0 0 0 1.4 1.4l-.2 1.6 2.4.8 1.1-1.3 1.1 1.3 2.4-.8-.2-1.6a5 5 0 0 0 1.4-1.4l1.6.2 1-2.4z",
  search: "M9 14A5 5 0 1 0 9 4a5 5 0 0 0 0 10zM17 17l-4.5-4.5",
  spark: "M10 3l1.5 4.5L16 9l-4.5 1.5L10 15l-1.5-4.5L4 9l4.5-1.5zM15.5 13l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z",
  menu: "M3 5h14M3 10h14M3 15h14",
  close: "M5 5l10 10M15 5 5 15",
  chevronRight: "M8 5l5 5-5 5",
  chevronDown: "M5 8l5 5 5-5",
  chevronLeft: "M12 5l-5 5 5 5",
  check: "M4 10.5l4 4 8-9",
  plus: "M10 4v12M4 10h12",
  back: "M17 10H3M9 4l-6 6 6 6",
  alert: "M10 3 2 17h16zM10 8v4M10 14.5h.01",
  clock: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 6v4l3 2",
  mail: "M3 5h14v10H3zM3 6l7 5 7-5",
  dots: "M5 10h.01M10 10h.01M15 10h.01",
  sun: "M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5 5l1 1M14 14l1 1M5 15l1-1M14 6l1-1M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  moon: "M17 11A7 7 0 0 1 9 3a7 7 0 1 0 8 8z",
  undo: "M3 7v5h5M17 14a7 7 0 0 0-13-4L3 12",
  note: "M11 3v4h4M14 17H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5l4 4v9a1 1 0 0 1-1 1z",
  tag: "M3 3h7l7 7-7 7-7-7zM6.5 6.5h.01",
  dollar: "M10 3v14M13.5 6H8.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H6",
  user: "M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM4 17a6 6 0 0 1 12 0",
  ban: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM5 5l10 10",
  truck: "M2 5h10v8H2zM12 8h4l2 3v2h-6zM5 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM15 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  box: "M3 6l7-3 7 3v8l-7 3-7-3zM3 6l7 3 7-3M10 9v8",
  cart: "M3 4h2l2 9h8l2-6H6M8 16.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM14 16.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  print: "M6 7V3h8v4M5 7h10a2 2 0 0 1 2 2v4h-3v4H6v-4H3V9a2 2 0 0 1 2-2zM6 13h8",
  archive: "M3 4h14v3H3zM4 7v9h12V7M8 11h4",
  refresh: "M17 10a7 7 0 1 1-2-4.9M17 3v4h-4",
  inbox: "M3 11h4l1.5 2h3L13 11h4v5H3zM5 4h10l2 7H3z",
  card: "M2 5h16v10H2zM2 8h16M5 12h3",
  pause: "M6 4v12M14 4v12",
  play: "M6 4l10 6-10 6z",
  external: "M11 3h6v6M17 3l-8 8M14 11v5H4V6h5",
  image: "M3 4h14v12H3zM3 13l4-4 3 3 2-2 5 5M13 8h.01",
  trend: "M3 14l5-5 3 3 6-7M14 5h3v3",
  dot: "M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  edit: "M13 3l4 4-9 9H4v-4zM11 5l4 4",
  filter: "M3 5h14l-5 6v4l-4 2v-6z",
  sort: "M6 4v12M6 16l-3-3M6 16l3-3M14 16V4M14 4l-3 3M14 4l3 3",
};

export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] ?? PATHS.dot} />
    </svg>
  );
}

/* ---- Polaris chrome ---- */

type Variant = "primary" | "secondary" | "tertiary" | "plain" | "critical";
export function Button({ children, onClick, variant = "secondary", size = "default", to, type = "button", icon, disabled, className, title, "aria-label": ariaLabel, "aria-expanded": ariaExpanded }: { children?: ReactNode; onClick?: () => void; variant?: Variant; size?: "default" | "slim" | "icon" | "large"; to?: string; type?: "button" | "submit"; icon?: string; disabled?: boolean; className?: string; title?: string; "aria-label"?: string; "aria-expanded"?: boolean }) {
  const cls = `q-btn q-btn-${variant}${size === "default" ? "" : ` q-btn-size-${size}`}${className ? ` ${className}` : ""}`;
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === "slim" ? 14 : 16} />}
      {children}
    </>
  );
  if (to) return <Link className={cls} to={to} title={title} aria-label={ariaLabel}>{inner}</Link>;
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel} aria-expanded={ariaExpanded}>
      {inner}
    </button>
  );
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "attention";
export function Badge({ tone = "neutral", children, progress }: { tone?: Tone; children: ReactNode; progress?: "incomplete" | "partial" | "complete" }) {
  return (
    <span className={`q-badge q-badge-${tone}`}>
      {progress && <span className={`q-badge-pip q-pip-${progress}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  // A stable pastel per name, the way Polaris colours avatars; the letters stay in the text token.
  const hue = useMemo(() => name.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0) % 360, [name]);
  return (
    <span className="q-avatar" style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)), background: `color-mix(in srgb, hsl(${hue} 60% 70%) 55%, var(--pxd-color-surface-subtle))` }} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

/** A product picture from its media reference. */
export function Thumb({ media, alt = "", size = 40 }: { media?: string; alt?: string; size?: number }) {
  const src = media ? resolveMedia(media) : undefined;
  return src ? <img className="q-thumb" src={src} alt={alt} width={size} height={size} /> : <span className="q-thumb q-thumb-empty" style={{ width: size, height: size }} aria-hidden="true"><Icon name="image" size={16} /></span>;
}

export function Card({ title, actions, children, className, padded = true, subdued }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean; subdued?: boolean }) {
  return (
    <section className={`q-card${subdued ? " q-card-subdued" : ""}${className ? ` ${className}` : ""}`}>
      {(title || actions) && (
        <header className="q-card-head">
          {title && <h2 className="q-card-title">{title}</h2>}
          {actions && <div className="q-card-actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? "q-card-body" : "q-card-body q-card-flush"}>{children}</div>
    </section>
  );
}
/** A divided section inside a card, the way Polaris stacks Unfulfilled / Paid / Customer. */
export function CardSection({ title, actions, children, subdued }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; subdued?: boolean }) {
  return (
    <div className={`q-section${subdued ? " q-section-subdued" : ""}`}>
      {(title || actions) && (
        <div className="q-section-head">
          {title && <h3 className="q-section-title">{title}</h3>}
          {actions && <div className="q-card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Page({ title, subtitle, titleMeta, actions, secondary, back, children, fullWidth, narrow }: { title: ReactNode; subtitle?: ReactNode; titleMeta?: ReactNode; actions?: ReactNode; secondary?: ReactNode; back?: { to: string; label: string }; children: ReactNode; fullWidth?: boolean; narrow?: boolean }) {
  return (
    <div className={`q-page${fullWidth ? " q-page-full" : ""}${narrow ? " q-page-narrow" : ""}`}>
      <header className="q-page-head">
        <div className="q-page-text">
          {back && (
            <Link className="q-back" to={back.to} aria-label={back.label}>
              <Icon name="back" size={16} />
            </Link>
          )}
          <div className="q-page-titles">
            <h1 className="q-page-title">
              {title}
              {titleMeta}
            </h1>
            {subtitle && <p className="q-page-sub">{subtitle}</p>}
          </div>
        </div>
        {(actions || secondary) && (
          <div className="q-page-actions">
            {secondary}
            {actions}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

export function Tabs({ items, value, onChange, label }: { items: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div className="q-tabs" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className="q-tab" onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && <span className="q-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="q-segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="q-kbd">{children}</kbd>;
}

export function Tag({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="q-tag">
      {children}
      {onRemove && (
        <button type="button" className="q-tag-remove" onClick={onRemove} aria-label={`Remove ${typeof children === "string" ? children : "tag"}`}>
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
}

export function Empty({ icon = "inbox", title, body, action }: { icon?: string; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="q-empty">
      <span className="q-empty-icon">
        <Icon name={icon} size={20} />
      </span>
      <p className="q-empty-title">{title}</p>
      {body && <p className="q-empty-body">{body}</p>}
      {action && <div className="q-empty-action">{action}</div>}
    </div>
  );
}

/** Polaris's banner: a toned notice with a title, a line of text and one action. */
export function Banner({ tone = "info", title, children, action, onDismiss }: { tone?: "info" | "success" | "warning" | "danger"; title?: ReactNode; children?: ReactNode; action?: ReactNode; onDismiss?: () => void }) {
  return (
    <div className={`q-banner q-banner-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <span className="q-banner-icon">
        <Icon name={tone === "success" ? "check" : tone === "info" ? "clock" : "alert"} size={16} />
      </span>
      <div className="q-banner-text">
        {title && <p className="q-banner-title">{title}</p>}
        {children && <div className="q-banner-body">{children}</div>}
        {action && <div className="q-banner-action">{action}</div>}
      </div>
      {onDismiss && (
        <button type="button" className="q-icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

/** A headline metric with its change against the previous period. */
export function Stat({ label, value, change, hint, to, favorable = "increase" }: { label: ReactNode; value: ReactNode; change?: number; hint?: ReactNode; to?: string; favorable?: "increase" | "decrease" }) {
  const good = change === undefined ? undefined : favorable === "increase" ? change >= 0 : change <= 0;
  const body = (
    <>
      <span className="q-stat-label">{label}</span>
      <span className="q-stat-value">{value}</span>
      {(change !== undefined || hint) && (
        <span className="q-stat-foot">
          {change !== undefined && Number.isFinite(change) && (
            <span className={`q-stat-change ${good ? "is-up" : "is-down"}`}>
              <Icon name={change >= 0 ? "trend" : "trend"} size={12} className={change < 0 ? "q-flip" : undefined} />
              {`${change >= 0 ? "+" : ""}${Math.round(change * 100)}%`}
            </span>
          )}
          {hint && <span className="q-stat-hint">{hint}</span>}
        </span>
      )}
    </>
  );
  return to ? <Link className="q-stat q-stat-link" to={to}>{body}</Link> : <div className="q-stat">{body}</div>;
}

/* ---- Form controls ---- */

export function Field({ label, hint, children, htmlFor, error }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string; error?: string }) {
  return (
    <div className="q-field">
      <label className="q-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="q-error">{error}</p> : hint ? <p className="q-hint">{hint}</p> : null}
    </div>
  );
}

export function Select({ value, onChange, options, label, id, slim }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label?: string; id?: string; slim?: boolean }) {
  return (
    <span className={`q-select${slim ? " q-select-slim" : ""}`}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={14} />
    </span>
  );
}

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="q-search">
      <Icon name="search" size={15} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} autoComplete="off" />
    </label>
  );
}

export function Checkbox({ checked, onChange, label, indeterminate, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; indeterminate?: boolean; description?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <label className="q-check">
      <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="q-check-text">
        <span>{label}</span>
        {description && <span className="q-hint">{description}</span>}
      </span>
    </label>
  );
}

/* ---- Index table: Polaris's IndexTable, with selection, a bulk-action bar, sortable headers, stacked rows on phones. ---- */

export interface Column<T> {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  align?: "start" | "end";
  width?: string;
  /** Hidden on phones, where three or four facts per row are plenty. */
  secondary?: boolean;
}

export function IndexTable<T>({ rows, columns, rowKey, href, caption, defaultSort, empty, selectable, selected, onSelect, bulk, rowName }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; href?: (row: T) => string; caption: string; defaultSort?: { key: string; dir: "asc" | "desc" }; empty: ReactNode; selectable?: boolean; selected?: Set<string>; onSelect?: (next: Set<string>) => void; bulk?: ReactNode; rowName?: (row: T) => string }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState(defaultSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const by = col.sort;
    return [...rows].sort((a, b) => {
      const x = by(a);
      const y = by(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns]);
  const toggle = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const sel = selected ?? new Set<string>();
  const all = rows.length > 0 && rows.every((r) => sel.has(rowKey(r)));
  const some = rows.some((r) => sel.has(rowKey(r)));
  const setAll = (on: boolean) => onSelect?.(on ? new Set(rows.map(rowKey)) : new Set());
  const setOne = (id: string, on: boolean) => {
    const next = new Set(sel);
    if (on) next.add(id);
    else next.delete(id);
    onSelect?.(next);
  };
  if (!rows.length) return <>{empty}</>;
  return (
    <div className="q-table-wrap">
      {selectable && sel.size > 0 && (
        <div className="q-bulk" role="toolbar" aria-label={`Actions for ${sel.size} selected`}>
          <Checkbox checked={all} indeterminate={some && !all} onChange={setAll} label={`${sel.size} selected`} />
          <div className="q-bulk-actions">{bulk}</div>
        </div>
      )}
      <table className="q-table">
        <caption className="q-sr-only">{caption}</caption>
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="q-table-check">
                <input
                  type="checkbox"
                  checked={all}
                  ref={(el) => {
                    if (el) el.indeterminate = some && !all;
                  }}
                  onChange={(e) => setAll(e.target.checked)}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} scope="col" style={{ width: c.width }} className={`${c.align === "end" ? "q-num" : ""}${c.secondary ? " q-secondary" : ""}`} aria-sort={c.sort ? (sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined}>
                {c.sort ? (
                  <button type="button" className="q-sort" onClick={() => toggle(c.key)}>
                    {c.label}
                    <Icon name={sort?.key === c.key ? (sort.dir === "asc" ? "chevronDown" : "chevronRight") : "sort"} size={12} className={sort?.key === c.key ? "" : "q-sort-idle"} />
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const to = href?.(row);
            const id = rowKey(row);
            const name = rowName?.(row) ?? id;
            return (
              <tr key={id} className={`${to ? "q-row-link" : ""}${sel.has(id) ? " is-selected" : ""}`} onClick={to ? (e) => !(e.target as HTMLElement).closest("a, button, select, input, label") && navigate(to) : undefined}>
                {selectable && (
                  <td className="q-table-check">
                    <input type="checkbox" checked={sel.has(id)} onChange={(e) => setOne(id, e.target.checked)} aria-label={`Select ${name}`} />
                  </td>
                )}
                {columns.map((c, ci) => (
                  <td key={c.key} data-label={typeof c.label === "string" ? c.label : undefined} className={`${c.align === "end" ? "q-num" : ""}${c.secondary ? " q-secondary" : ""}${ci === 0 ? " q-first" : ""}`}>
                    {ci === 0 && to ? (
                      <Link to={to} className="q-row-anchor">
                        {c.render(row)}
                      </Link>
                    ) : (
                      c.render(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Modal: Polaris's dialog for a short task the product's own chrome owns (cancel an order, edit a note). ---- */

export function Modal({ title, onClose, children, primary, secondary, tone }: { title: string; onClose: () => void; children: ReactNode; primary?: ReactNode; secondary?: ReactNode; tone?: "danger" }) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref, onClose);
  return (
    <dialog ref={ref} className={`q-modal${tone ? ` q-modal-${tone}` : ""}`} aria-label={title} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="q-modal-panel">
        <header className="q-modal-head">
          <h2>{title}</h2>
          <button type="button" className="q-icon-btn" onClick={() => ref.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="q-modal-body">{children}</div>
        {(primary || secondary) && (
          <footer className="q-modal-foot">
            {secondary}
            {primary}
          </footer>
        )}
      </div>
    </dialog>
  );
}

/* ---- Timeline ---- */

const EVENT_ICON: Record<string, string> = { placed: "cart", paid: "card", fulfilled: "truck", delivered: "check", refund: "undo", canceled: "ban", comment: "note", email: "mail", print: "print", archived: "archive", note: "clock" };
export function Timeline({ events, format }: { events: { id: string; at: string; kind: string; text: string; author?: string }[]; format: (iso: string) => string }) {
  if (!events.length) return <Empty icon="clock" title="Nothing yet" body="Payments, fulfillments, refunds and comments land here as they happen." />;
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ol className="q-timeline">
      {sorted.map((e) => (
        <li key={e.id} className={`q-tl-item${e.kind === "comment" ? " q-tl-comment" : ""}`}>
          <span className="q-tl-icon">
            <Icon name={EVENT_ICON[e.kind] ?? "dot"} size={12} />
          </span>
          <span className="q-tl-text">
            {e.author && <b>{e.author} </b>}
            {e.text}
          </span>
          <span className="q-tl-when">{format(e.at)}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---- Charts: a line of daily sales drawn in SVG on the pack's tokens. ---- */

export function LineChart({ points, label, format, compare }: { points: { x: string; y: number }[]; label: string; format: (n: number) => string; compare?: number[] }) {
  const w = 640;
  const h = 200;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const max = Math.max(1, ...points.map((p) => p.y), ...(compare ?? []));
  const step = points.length > 1 ? (w - pad.l - pad.r) / (points.length - 1) : 0;
  const X = (i: number) => pad.l + i * step;
  const Y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  const path = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const area = `${path} L${X(points.length - 1).toFixed(1)},${Y(0)} L${X(0)},${Y(0)} Z`;
  const cmp = compare?.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map((f) => max * f);
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  return (
    <figure className="q-chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} preserveAspectRatio="none">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} className="q-chart-grid" />
            <text x={pad.l - 6} y={Y(t) + 4} textAnchor="end" className="q-chart-tick">
              {format(t)}
            </text>
          </g>
        ))}
        <path d={area} className="q-chart-area" />
        {cmp && <path d={cmp} className="q-chart-compare" />}
        <path d={path} className="q-chart-line" />
        {points.map((p, i) => (
          <g key={p.x}>
            <circle cx={X(i)} cy={Y(p.y)} r={2.5} className="q-chart-dot">
              <title>{`${p.x}: ${format(p.y)}`}</title>
            </circle>
            {i % labelEvery === 0 && (
              <text x={X(i)} y={h - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} className="q-chart-tick">
                {p.x}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function Bars({ values, label, max }: { values: number[]; label: string; max?: number }) {
  const top = Math.max(1, max ?? Math.max(...values));
  return (
    <div className="q-bars" role="img" aria-label={label}>
      {values.map((v, i) => (
        <span key={i} style={{ height: `${Math.max(3, (v / top) * 100)}%` }} />
      ))}
    </div>
  );
}

/* ---- Navigation ---- */

export interface NavItem { to: string; label: string; icon: string; children?: { to: string; label: string }[] }
export const NAV: NavItem[] = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/orders", label: "Orders", icon: "orders", children: [{ to: "/orders/drafts", label: "Drafts" }, { to: "/orders/checkouts", label: "Abandoned checkouts" }] },
  { to: "/products", label: "Products", icon: "products", children: [{ to: "/products/collections", label: "Collections" }, { to: "/products/inventory", label: "Inventory" }] },
  { to: "/customers", label: "Customers", icon: "customers" },
  { to: "/discounts", label: "Discounts", icon: "discounts" },
  { to: "/marketing", label: "Marketing", icon: "marketing" },
  { to: "/analytics", label: "Analytics", icon: "analytics" },
];

export function NavList({ counts, onNavigate }: { counts: Record<string, number>; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <ul className="q-nav-list">
      {NAV.map((n) => {
        const inSection = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
        const childActive = n.children?.some((c) => pathname.startsWith(c.to));
        return (
          <li key={n.to}>
            <NavLink to={n.to} end={n.to === "/"} className={() => `q-nav-item${inSection && !childActive ? " is-active" : ""}`} onClick={onNavigate}>
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
              {counts[n.to] > 0 && <span className="q-nav-count">{counts[n.to]}</span>}
            </NavLink>
            {n.children && inSection && (
              <ul className="q-nav-sub">
                {n.children.map((c) => (
                  <li key={c.to}>
                    <NavLink to={c.to} className={({ isActive }) => `q-nav-item q-nav-child${isActive ? " is-active" : ""}`} onClick={onNavigate}>
                      <span>{c.label}</span>
                      {counts[c.to] > 0 && <span className="q-nav-count">{counts[c.to]}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Opens a native dialog once on mount and reports its close (Escape, the scrim, a Close button). */
export function useModal(ref: React.RefObject<HTMLDialogElement | null>, onClose: () => void) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const close = () => latest.current();
    d.addEventListener("close", close);
    return () => d.removeEventListener("close", close);
  }, [ref]);
}

/** Today's greeting, for Home. */
export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
