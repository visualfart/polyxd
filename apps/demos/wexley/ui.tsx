import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

export { money, longDate, date, dayDate, shortDate, time, relativeDays } from "./format.ts";

/* ---- GOV.UK page furniture ---- */

export function Header({ signedIn, unread, onSignOut }: { signedIn: boolean; unread: number; onSignOut: () => void }) {
  return (
    <header className="wx-header" role="banner">
      <div className="wx-width wx-header-inner">
        <Link to="/" className="wx-wordmark">
          Wexley Borough Council
        </Link>
        <span className="wx-service">Your account</span>
        {signedIn && (
          <nav className="wx-header-nav" aria-label="Account">
            <NavLink to="/" end>
              Your account
            </NavLink>
            <NavLink to="/messages">
              Messages{unread > 0 && <span className="wx-header-count"> ({unread})</span>}
            </NavLink>
            <NavLink to="/settings">Your details</NavLink>
            <button type="button" onClick={onSignOut}>
              Sign out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}

export function PhaseBanner() {
  return (
    <div className="wx-phase">
      <Tag tone="info">Beta</Tag>
      <span>
        This is a new service. Nothing here is a real council: it is a demonstration built on <a href="https://polyxd.com">Polyxd</a>, and everything you do stays in your browser.
      </span>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="wx-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) => (
          <li key={i}>{c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

export function BackLink({ to, onClick, children = "Back" }: { to?: string; onClick?: () => void; children?: ReactNode }) {
  if (to) return <Link className="wx-back" to={to}>{children}</Link>;
  return (
    <button type="button" className="wx-back" onClick={onClick}>
      {children}
    </button>
  );
}

export function Footer() {
  return (
    <footer className="wx-footer" role="contentinfo">
      <div className="wx-width wx-footer-inner">
        <ul className="wx-footer-links">
          <li>
            <Link to="/settings">Your details</Link>
          </li>
          <li>
            <a href="https://polyxd.com/demos/">More demos</a>
          </li>
          <li>
            <a href="https://polyxd.com/docs/">How this works</a>
          </li>
        </ul>
        <p className="wx-footer-licence">
          Wexley is a fictional council. The resident, the services and the letters are made up for this demonstration and are available under the Apache 2.0 licence, like <a href="https://polyxd.com">Polyxd</a> itself.
        </p>
      </div>
    </footer>
  );
}

/* ---- Text ---- */

export function Heading({ caption, children, size = "l", id }: { caption?: ReactNode; children: ReactNode; size?: "xl" | "l" | "m"; id?: string }) {
  return (
    <h1 className={`wx-h1 wx-h1-${size}`} id={id} tabIndex={-1}>
      {caption && <span className="wx-caption">{caption}</span>}
      {children}
    </h1>
  );
}

export function Inset({ children }: { children: ReactNode }) {
  return <div className="wx-inset">{children}</div>;
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="wx-warning">
      <span className="wx-warning-icon" aria-hidden="true">
        !
      </span>
      <strong className="wx-warning-text">
        <span className="wx-sr-only">Warning</span>
        {children}
      </strong>
    </div>
  );
}

/* ---- Status and feedback ---- */

const TONES: Record<string, string> = { neutral: "neutral", info: "info", success: "success", warning: "warning", danger: "danger" };

export function Tag({ tone = "info", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <strong className={`wx-tag wx-tag-${TONES[tone]}`}>{children}</strong>;
}

export function Banner({ kind, title, children, action, onDismiss }: { kind: "success" | "important" | "error"; title?: string; children: ReactNode; action?: ReactNode; onDismiss?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} className={`wx-banner wx-banner-${kind}`} role={kind === "important" ? "region" : "alert"} aria-labelledby="wx-banner-title" tabIndex={-1}>
      <div className="wx-banner-head">
        <h2 id="wx-banner-title">{title ?? (kind === "success" ? "Success" : "Important")}</h2>
      </div>
      <div className="wx-banner-body">
        <p className="wx-banner-text">{children}</p>
        {(action || onDismiss) && (
          <p className="wx-banner-actions">
            {action}
            {onDismiss && (
              <button type="button" className="wx-link" onClick={onDismiss}>
                Dismiss
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** GOV.UK error summary: one place that lists what to fix, focused when it appears. */
export function ErrorSummary({ errors }: { errors: { id: string; message: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length) ref.current?.focus();
  }, [errors]);
  if (!errors.length) return null;
  return (
    <div ref={ref} className="wx-error-summary" role="alert" tabIndex={-1} aria-labelledby="wx-error-summary-title">
      <h2 id="wx-error-summary-title">There is a problem</h2>
      <ul>
        {errors.map((e) => (
          <li key={e.id}>
            <a href={`#${e.id}`} onClick={(ev) => (ev.preventDefault(), document.getElementById(e.id)?.focus())}>
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Summary list, tables ---- */

export interface SummaryRow { key: string; value: ReactNode; action?: ReactNode }

export function SummaryList({ rows, bordered = true }: { rows: SummaryRow[]; bordered?: boolean }) {
  return (
    <dl className={`wx-summary${bordered ? "" : " wx-summary-plain"}`}>
      {rows.map((r) => (
        <div className="wx-summary-row" key={r.key}>
          <dt>{r.key}</dt>
          <dd>{r.value}</dd>
          {r.action !== undefined && <dd className="wx-summary-action">{r.action}</dd>}
        </div>
      ))}
    </dl>
  );
}

/* ---- Actions ---- */

export function Button({ children, to, onClick, tone = "primary", type = "button", disabled, className }: { children: ReactNode; to?: string; onClick?: () => void; tone?: "primary" | "secondary" | "warning"; type?: "button" | "submit"; disabled?: boolean; className?: string }) {
  const cls = `wx-button wx-button-${tone}${className ? ` ${className}` : ""}`;
  if (to) return <Link className={cls} to={to} role="button">{children}</Link>;
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function LinkButton({ children, onClick, className }: { children: ReactNode; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`wx-link${className ? ` ${className}` : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

/* ---- Form controls ---- */

export function Field({ label, hint, error, id, children, legend }: { label?: ReactNode; hint?: ReactNode; error?: string; id: string; children: ReactNode; legend?: boolean }) {
  const body = (
    <>
      {label && (legend ? <legend className="wx-label">{label}</legend> : <label className="wx-label" htmlFor={id}>{label}</label>)}
      {hint && (
        <div className="wx-hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
      {error && (
        <p className="wx-error" id={`${id}-error`}>
          <span className="wx-sr-only">Error:</span> {error}
        </p>
      )}
      {children}
    </>
  );
  const cls = `wx-field${error ? " wx-field-error" : ""}`;
  return legend ? <fieldset className={cls} aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}>{body}</fieldset> : <div className={cls}>{body}</div>;
}

export function TextField({ id, label, hint, error, value, onChange, type = "text", autoComplete, width, multiline, rows = 5, maxLength, inputMode }: { id: string; label: ReactNode; hint?: ReactNode; error?: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string; width?: "full" | "20" | "10" | "5"; multiline?: boolean; rows?: number; maxLength?: number; inputMode?: "text" | "numeric" | "email" }) {
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {multiline ? (
        <textarea id={id} className={`wx-input wx-textarea${error ? " wx-input-error" : ""}`} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength} aria-describedby={described} aria-invalid={error ? true : undefined} />
      ) : (
        <input id={id} className={`wx-input${width ? ` wx-input-${width}` : ""}${error ? " wx-input-error" : ""}`} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} aria-describedby={described} aria-invalid={error ? true : undefined} spellCheck={false} />
      )}
    </Field>
  );
}

export function Radios<T extends string>({ id, legend, hint, error, options, value, onChange, small }: { id: string; legend: ReactNode; hint?: ReactNode; error?: string; options: { value: T; label: ReactNode; hint?: ReactNode }[]; value: T | null; onChange: (v: T) => void; small?: boolean }) {
  return (
    <Field id={id} label={legend} hint={hint} error={error} legend>
      <div className={`wx-radios${small ? " wx-radios-small" : ""}`}>
        {options.map((o, i) => {
          const oid = `${id}-${o.value}`;
          return (
            <div className="wx-radio" key={o.value}>
              <input id={oid} type="radio" name={id} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} aria-describedby={o.hint ? `${oid}-hint` : undefined} tabIndex={value === null && i === 0 ? 0 : undefined} />
              <label htmlFor={oid}>{o.label}</label>
              {o.hint && (
                <div className="wx-hint wx-radio-hint" id={`${oid}-hint`}>
                  {o.hint}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Field>
  );
}

export function Checkbox({ id, label, hint, checked, onChange }: { id: string; label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="wx-checkbox">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={hint ? `${id}-hint` : undefined} />
      <label htmlFor={id}>{label}</label>
      {hint && (
        <div className="wx-hint wx-radio-hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * The spec's CodeInput idiom in the product's own chrome: one box per digit, typing moves on,
 * Backspace moves back, a pasted code fills every box, and the first box accepts a one-time code
 * from the keyboard's autofill.
 */
export function CodeBoxes({ id, length = 6, value, onChange, onComplete, error }: { id: string; length?: number; value: string; onChange: (v: string) => void; onComplete?: (code: string) => void; error?: string }) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");
  const commit = (next: string[]) => {
    const code = next.join("");
    onChange(code);
    if (code.length === length && next.every(Boolean)) onComplete?.(code);
  };
  const fill = (from: number, text: string) => {
    const digits = text.replace(/\D/g, "");
    if (!digits) return;
    const next = [...chars];
    let i = from;
    for (const ch of digits) {
      if (i >= length) break;
      next[i++] = ch;
    }
    commit(next);
    boxes.current[Math.min(i, length - 1)]?.focus();
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      e.preventDefault();
      const next = [...chars];
      next[i - 1] = "";
      commit(next);
      boxes.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < length - 1) boxes.current[i + 1]?.focus();
  };
  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const t = e.clipboardData.getData("text").replace(/\D/g, "");
    fill(t.length >= length ? 0 : i, t);
  };
  return (
    <div className="wx-code" role="group" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-error` : `${id}-hint`}>
      {chars.map((ch, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          id={i === 0 ? id : undefined}
          className={`wx-code-box${error ? " wx-input-error" : ""}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={error ? true : undefined}
          value={ch}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const t = e.target.value.replace(/\D/g, "");
            if (!t) {
              const next = [...chars];
              next[i] = "";
              return commit(next);
            }
            fill(t.length >= length ? 0 : i, t.startsWith(ch) && t.length > 1 ? t.slice(ch.length) : t);
          }}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={(e) => onPaste(i, e)}
        />
      ))}
    </div>
  );
}

/** GOV.UK details: a summary people can open for more. */
export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="wx-details">
      <button type="button" className="wx-details-summary" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {summary}
      </button>
      {open && (
        <div className="wx-details-body" id={id}>
          {children}
        </div>
      )}
    </div>
  );
}

/** A dashboard row: a service, its state, and where to go. */
export function ServiceRow({ to, title, status, tone, children }: { to: string; title: string; status?: string; tone?: keyof typeof TONES; children?: ReactNode }) {
  return (
    <li className="wx-service-row">
      <div className="wx-service-head">
        <h3>
          <Link to={to}>{title}</Link>
        </h3>
        {status && <Tag tone={tone}>{status}</Tag>}
      </div>
      {children && <p className="wx-service-body">{children}</p>}
    </li>
  );
}
