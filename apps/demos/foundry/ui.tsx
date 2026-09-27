import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { initials as initialsOf } from "./seed.ts";

export { money, compact, shortDate, longDate, dateOnly, time, relative, daysWord, percent, plural } from "./format.ts";

/* ---- Icons: 24-unit grid, stroke 1.75, round joins; the shapes shadcn apps use (Lucide-like). ---- */

const PATHS: Record<string, string> = {
  overview: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  accounts: "M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2",
  tickets: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z",
  renewals: "M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6",
  team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2 2 2 0 1 1-2.8-2.8A1.7 1.7 0 0 0 2.1 14a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9 2 2 0 1 1 2.8-2.8A1.7 1.7 0 0 0 9 3.1a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2 2 2 0 1 1 2.8 2.8A1.7 1.7 0 0 0 21 10a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 1z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M18 6 6 18M6 6l12 12",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  check: "M20 6 9 17l-5-5",
  plus: "M12 5v14M5 12h14",
  back: "M19 12H5M12 19l-7-7 7-7",
  alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6",
  dots: "M12 5h.01M12 12h.01M12 19h.01",
  sun: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  undo: "M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13",
  note: "M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
  trend: "M22 7l-8.5 8.5-5-5L2 17M16 7h6v6",
  dollar: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  ban: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8",
  play: "M6 4l14 8-14 8z",
  seats: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z",
  dot: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
};

export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] ?? PATHS.dot} />
    </svg>
  );
}

/* ---- shadcn chrome ---- */

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export function Button({ children, onClick, variant = "outline", size = "default", to, type = "button", icon, disabled, className, title, "aria-label": ariaLabel }: { children?: ReactNode; onClick?: () => void; variant?: Variant; size?: "default" | "sm" | "icon"; to?: string; type?: "button" | "submit"; icon?: string; disabled?: boolean; className?: string; title?: string; "aria-label"?: string }) {
  const cls = `fd-btn fd-btn-${variant}${size === "default" ? "" : ` fd-btn-size-${size}`}${className ? ` ${className}` : ""}`;
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </>
  );
  if (to) return <Link className={cls} to={to} title={title} aria-label={ariaLabel}>{inner}</Link>;
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel}>
      {inner}
    </button>
  );
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "outline";
export function Badge({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`fd-badge fd-badge-${tone}`}>
      {dot && <span className="fd-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 24, square }: { name: string; size?: number; square?: boolean }) {
  return (
    <span className={`fd-avatar${square ? " fd-avatar-square" : ""}`} style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)) }} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

/** A person: face and name on one line, the way a CS desk names its people. */
export function Person({ name, detail, size = 24 }: { name: string; detail?: string; size?: number }) {
  return (
    <span className="fd-person">
      <Avatar name={name} size={size} />
      <span className="fd-person-text">
        <span className="fd-person-name">{name}</span>
        {detail && <span className="fd-person-detail">{detail}</span>}
      </span>
    </span>
  );
}

export function Card({ title, description, actions, children, className, padded = true }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={`fd-card${className ? ` ${className}` : ""}`}>
      {(title || actions) && (
        <header className="fd-card-head">
          <div>
            {title && <h2 className="fd-card-title">{title}</h2>}
            {description && <p className="fd-card-desc">{description}</p>}
          </div>
          {actions && <div className="fd-card-actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? "fd-card-body" : "fd-card-body fd-card-flush"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, to, onClick, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; to?: string; onClick?: () => void; tone?: Tone }) {
  const body = (
    <>
      <span className="fd-stat-label">{label}</span>
      <span className={`fd-stat-value${tone ? ` fd-tone-${tone}` : ""}`}>{value}</span>
      {hint && <span className="fd-stat-hint">{hint}</span>}
    </>
  );
  if (to) return <Link className="fd-stat fd-stat-link" to={to}>{body}</Link>;
  if (onClick) return <button type="button" className="fd-stat fd-stat-link" onClick={onClick}>{body}</button>;
  return <div className="fd-stat">{body}</div>;
}

export function Page({ title, description, actions, back, children, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string }; children: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="fd-page">
      <header className="fd-page-head">
        <div className="fd-page-text">
          {back && (
            <Link className="fd-back" to={back.to}>
              <Icon name="back" size={14} />
              {back.label}
            </Link>
          )}
          {eyebrow && <div className="fd-eyebrow">{eyebrow}</div>}
          <h1 className="fd-page-title">{title}</h1>
          {description && <p className="fd-page-desc">{description}</p>}
        </div>
        {actions && <div className="fd-page-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Tabs({ items, value, onChange, label }: { items: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div className="fd-tabs" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className="fd-tab" onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && <span className="fd-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="fd-segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, selected, onClick }: { children: ReactNode; selected?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`fd-chip${selected ? " is-on" : ""}`} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="fd-kbd">{children}</kbd>;
}

export function Empty({ icon = "inbox", title, body, action }: { icon?: string; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="fd-empty">
      <span className="fd-empty-icon">
        <Icon name={icon} size={20} />
      </span>
      <p className="fd-empty-title">{title}</p>
      {body && <p className="fd-empty-body">{body}</p>}
      {action && <div className="fd-empty-action">{action}</div>}
    </div>
  );
}

/** A thin bar: seats used, an agent's load, a health score. */
export function Meter({ value, max, tone, label }: { value: number; max: number; tone?: Tone; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <span className={`fd-meter${tone ? ` fd-meter-${tone}` : ""}`} role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/* ---- Form controls ---- */

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="fd-field">
      <label className="fd-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="fd-hint">{hint}</p>}
    </div>
  );
}

export function Select({ value, onChange, options, label, id, size }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label?: string; id?: string; size?: "sm" }) {
  return (
    <span className={`fd-select${size === "sm" ? " fd-select-sm" : ""}`}>
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
    <label className="fd-search">
      <Icon name="search" size={15} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} autoComplete="off" />
    </label>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  return (
    <label className="fd-switch">
      <span className="fd-switch-text">
        <span>{label}</span>
        {description && <span className="fd-hint">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/* ---- The dense table B2B tools are made of: sortable, keyboard-reachable rows, stacks on phones. ---- */

export interface Column<T> {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  /** Value to sort by; omit for an unsortable column. */
  sort?: (row: T) => string | number;
  align?: "start" | "end";
  width?: string;
  /** Hidden on phones, where three or four facts per row are plenty. */
  secondary?: boolean;
}

export function DataTable<T>({ rows, columns, rowKey, href, caption, defaultSort, empty, dense }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; href?: (row: T) => string; caption: string; defaultSort?: { key: string; dir: "asc" | "desc" }; empty: ReactNode; dense?: boolean }) {
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
  if (!rows.length) return <>{empty}</>;
  return (
    <div className="fd-table-wrap">
      <table className={`fd-table${dense ? " fd-table-dense" : ""}`}>
        <caption className="fd-sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={{ width: c.width }} className={`${c.align === "end" ? "fd-num" : ""}${c.secondary ? " fd-secondary" : ""}`} aria-sort={c.sort ? (sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined}>
                {c.sort ? (
                  <button type="button" className="fd-sort" onClick={() => toggle(c.key)}>
                    {c.label}
                    <Icon name={sort?.key === c.key ? (sort.dir === "asc" ? "chevronDown" : "chevronRight") : "dot"} size={12} className={sort?.key === c.key ? "" : "fd-sort-idle"} />
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const to = href?.(row);
            return (
              <tr key={rowKey(row)} className={to ? "fd-row-link" : undefined} onClick={to ? (e) => !(e.target as HTMLElement).closest("a, button, select, input") && navigate(to) : undefined}>
                {columns.map((c, ci) => (
                  <td key={c.key} data-label={typeof c.label === "string" ? c.label : undefined} className={`${c.align === "end" ? "fd-num" : ""}${c.secondary ? " fd-secondary" : ""}${ci === 0 ? " fd-first" : ""}`}>
                    {ci === 0 && to ? (
                      <Link to={to} className="fd-row-anchor" tabIndex={i === 0 || true ? 0 : -1}>
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

/* ---- Navigation ---- */

export const NAV = [
  { to: "/", label: "Overview", icon: "overview" },
  { to: "/accounts", label: "Accounts", icon: "accounts" },
  { to: "/tickets", label: "Tickets", icon: "tickets" },
  { to: "/renewals", label: "Renewals", icon: "renewals" },
  { to: "/team", label: "Team", icon: "team" },
];

export function NavList({ counts, onNavigate }: { counts: Record<string, number>; onNavigate?: () => void }) {
  return (
    <ul className="fd-nav-list">
      {NAV.map((n) => (
        <li key={n.to}>
          <NavLink to={n.to} end={n.to === "/"} className={({ isActive }) => `fd-nav-item${isActive ? " is-active" : ""}`} onClick={onNavigate}>
            <Icon name={n.icon} size={16} />
            <span>{n.label}</span>
            {counts[n.to] > 0 && <span className="fd-nav-count">{counts[n.to]}</span>}
          </NavLink>
        </li>
      ))}
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

/** Today's greeting, for the overview. */
export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
