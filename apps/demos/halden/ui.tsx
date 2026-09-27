import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import { money } from "./format.ts";
export { money, dayLabel, time, longDate, shortDate, greeting } from "./format.ts";

/* ---- Icons: 24px, stroke 2, round joins. ---- */

const PATHS: Record<string, string> = {
  home: "M4 11 12 4l8 7M6 10v10h12V10",
  payments: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  people: "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6",
  insights: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  card: "M2 6h20v13H2zM2 10h20",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2 2 2 0 1 1-2.8-2.8A1.7 1.7 0 0 0 2.1 14a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9 2 2 0 1 1 2.8-2.8A1.7 1.7 0 0 0 9 3.1a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2 2 2 0 1 1 2.8 2.8A1.7 1.7 0 0 0 21 10a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 1z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3",
  add: "M12 5v14M5 12h14",
  back: "M15 5l-7 7 7 7",
  close: "M18 6 6 18M6 6l12 12",
  chevron: "M9 6l6 6-6 6",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  basket: "M3 9h18l-2 11H5zM8 9V6a4 4 0 0 1 8 0v3",
  restaurant: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6v3h3v9",
  cup: "M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9h2a2 2 0 0 1 0 4h-2M6 3l1 2M10 3l1 2",
  car: "M5 11l1.5-5h11L19 11M3 11h18v6h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3zM7 14h.01M17 14h.01",
  bag: "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  repeat: "M17 2l4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3",
  ticket: "M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4zM12 8v8",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  "arrow-down": "M12 4v16M5 13l7 7 7-7",
  dot: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  snow: "M12 2v20M2 12h20M5 5l14 14M19 5 5 19",
  check: "M20 6 9 17l-5-5",
  alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  more: "M12 5h.01M12 12h.01M12 19h.01",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7V5a2 2 0 0 1 2-2h11v4M16 13h4",
};

export function Icon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] ?? PATHS.dot} />
    </svg>
  );
}

/* ---- Material 3 chrome ---- */

export function TopBar({ title, back, trailing, large }: { title: ReactNode; back?: string | (() => void); trailing?: ReactNode; large?: boolean }) {
  return (
    <header className={`hal-top${large ? " hal-top-large" : ""}`}>
      <div className="hal-top-row">
        {back !== undefined && (typeof back === "string" ? (
          <Link className="hal-icon-button" to={back} aria-label="Back">
            <Icon name="back" />
          </Link>
        ) : (
          <button type="button" className="hal-icon-button" onClick={back} aria-label="Back">
            <Icon name="back" />
          </button>
        ))}
        {!large && <h1 className="hal-top-title">{title}</h1>}
        <div className="hal-top-trailing">{trailing}</div>
      </div>
      {large && <h1 className="hal-top-headline">{title}</h1>}
    </header>
  );
}

const NAV = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/payments", label: "Payments", icon: "payments" },
  { to: "/payees", label: "Payees", icon: "people" },
  { to: "/budgets", label: "Budgets", icon: "wallet" },
  { to: "/insights", label: "Insights", icon: "insights" },
];

export function Nav({ onAsk }: { onAsk: () => void }) {
  return (
    <nav className="hal-nav" aria-label="Halden">
      <button type="button" className="hal-fab hal-fab-rail" onClick={onAsk}>
        <Icon name="spark" />
        <span>Ask</span>
      </button>
      <ul>
        {NAV.map((n) => (
          <li key={n.to}>
            <NavLink to={n.to} end={n.to === "/"} className={({ isActive }) => `hal-nav-item${isActive ? " is-active" : ""}`}>
              <span className="hal-nav-pill">
                <Icon name={n.icon} />
              </span>
              <span className="hal-nav-label">{n.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Fab({ onClick, label = "Ask Halden" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="hal-fab hal-fab-floating" onClick={onClick}>
      <Icon name="spark" />
      <span>{label}</span>
    </button>
  );
}

export function Card({ children, tone = "filled", className, as: As = "section" }: { children: ReactNode; tone?: "filled" | "elevated" | "outlined"; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={`hal-card hal-card-${tone}${className ? ` ${className}` : ""}`}>{children}</As>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="hal-section-title">
      <h2>{children}</h2>
      {action}
    </div>
  );
}

export function ListItem({ leading, title, supporting, trailing, to, onClick, className }: { leading?: ReactNode; title: ReactNode; supporting?: ReactNode; trailing?: ReactNode; to?: string; onClick?: () => void; className?: string }) {
  const body = (
    <>
      {leading && <span className="hal-li-leading">{leading}</span>}
      <span className="hal-li-text">
        <span className="hal-li-title">{title}</span>
        {supporting && <span className="hal-li-supporting">{supporting}</span>}
      </span>
      {trailing && <span className="hal-li-trailing">{trailing}</span>}
    </>
  );
  const cls = `hal-li${to || onClick ? " hal-li-interactive" : ""}${className ? ` ${className}` : ""}`;
  if (to) return <Link className={cls} to={to}>{body}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/** Initials in a coloured circle; the hue comes from the name so it's stable everywhere. */
export function Avatar({ name, size = 40, icon }: { name: string; size?: number; icon?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="hal-avatar" style={{ width: size, height: size, fontSize: size * 0.4, ["--hal-avatar-hue" as string]: h }} aria-hidden="true">
      {icon ? <Icon name={icon} size={size * 0.55} /> : initials}
    </span>
  );
}

export function Amount({ value, className, whole }: { value: number; className?: string; whole?: boolean }) {
  return <span className={`hal-amount${value > 0 ? " is-in" : ""}${className ? ` ${className}` : ""}`}>{money(value, { sign: value > 0, whole })}</span>;
}

export function Button({ children, onClick, tone = "tonal", to, type = "button", icon, disabled, className }: { children: ReactNode; onClick?: () => void; tone?: "filled" | "tonal" | "text" | "outlined"; to?: string; type?: "button" | "submit"; icon?: string; disabled?: boolean; className?: string }) {
  const cls = `hal-button hal-button-${tone}${className ? ` ${className}` : ""}`;
  const inner = (
    <>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </>
  );
  if (to) return <Link className={cls} to={to}>{inner}</Link>;
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

export function Chip({ children, selected, onClick, icon }: { children: ReactNode; selected?: boolean; onClick?: () => void; icon?: string }) {
  return (
    <button type="button" className={`hal-chip${selected ? " is-selected" : ""}`} onClick={onClick} aria-pressed={selected}>
      {selected ? <Icon name="check" size={18} /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
}

export function Empty({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="hal-empty">
      <span className="hal-empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <p className="hal-empty-title">{title}</p>
      {body && <p className="hal-empty-body">{body}</p>}
      {action}
    </div>
  );
}
