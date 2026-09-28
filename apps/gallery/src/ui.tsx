import { Fragment, useEffect, useId, useRef, useState } from "react";

const PATHS: Record<string, string> = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3",
  phone: "M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18.5h2",
  tablet: "M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18.5h2",
  desktop: "M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 21h8M12 17v4",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  rowsTight: "M4 5h16M4 9h16M4 13h16M4 17h16M4 21h16",
  rowsMid: "M4 6h16M4 12h16M4 18h16",
  rowsLoose: "M4 7h16M4 17h16",
  chevron: "M6 9l6 6 6-6",
  check: "M20 6 9 17l-5-5",
  reset: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  code: "M9 18l-6-6 6-6M15 6l6 6-6 6",
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.chevron} />
    </svg>
  );
}

export interface Pack {
  key: string;
  name: string;
  by: string;
  /** Packs with the same group sit under one heading in the picker: real design systems, then templates. */
  group?: string;
  /** The pack's logo file (packages/ds-<key>/logo.svg, as its manifest names it); none for GOV.UK. */
  logo?: string;
}

/**
 * A pack's logo on a white squircle tile: the owner's file, unaltered, for a real design system; a
 * Polyxd-made mark for a template. Decorative, since the name beside it is the label. GOV.UK's
 * crown and logotype are protected, so it has no logo, and gets an empty space the same size.
 */
function PackLogo({ src, size }: { src?: string; size: number }) {
  return (
    <span className={`g-logo${src ? "" : " g-logo-none"}`} aria-hidden="true" style={{ width: size, height: size, padding: Math.round(size * 0.15) }}>
      {src && <img src={src} alt="" width={size} height={size} decoding="async" />}
    </span>
  );
}

/**
 * Design-system picker: a listbox, so each option can carry that pack's logo beside its name.
 * Arrow keys move, Enter and Space choose, Escape closes, and focus returns to the button.
 */
export function PackPicker({ packs, value, onChange }: { packs: Pack[]; value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, packs.findIndex((p) => p.key === value)));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = packs.find((p) => p.key === value) ?? packs[0];

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!listRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (i: number) => {
    onChange(packs[i].key);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="g-picker">
      <button
        ref={buttonRef}
        type="button"
        className="g-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setActive(Math.max(0, packs.findIndex((p) => p.key === value)));
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive(Math.max(0, packs.findIndex((p) => p.key === value)));
            setOpen(true);
          }
        }}
      >
        <PackLogo src={current.logo} size={30} />
        <span className="g-picker-text">
          <span className="g-picker-name">{current.name}</span>
          <span className="g-picker-by">{current.by}</span>
        </span>
        <Icon name="chevron" size={18} />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={id}
          className="g-listbox"
          role="listbox"
          tabIndex={-1}
          aria-label="Design system"
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setActive((i) => (i + 1) % packs.length));
            else if (e.key === "ArrowUp") (e.preventDefault(), setActive((i) => (i - 1 + packs.length) % packs.length));
            else if (e.key === "Home") (e.preventDefault(), setActive(0));
            else if (e.key === "End") (e.preventDefault(), setActive(packs.length - 1));
            else if (e.key === "Enter" || e.key === " ") (e.preventDefault(), choose(active));
            else if (e.key === "Escape" || e.key === "Tab") (setOpen(false), buttonRef.current?.focus());
          }}
        >
          {packs.map((p, i) => (
            <Fragment key={p.key}>
              {p.group && p.group !== packs[i - 1]?.group && (
                <li className="g-listbox-group" role="presentation">
                  {p.group}
                </li>
              )}
              <li
                id={`${id}-${i}`}
                role="option"
                aria-selected={p.key === value}
                className={`g-option${i === active ? " g-option-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <PackLogo src={p.logo} size={32} />
                <span className="g-picker-text">
                  <span className="g-picker-name">{p.name}</span>
                  <span className="g-picker-by">{p.by}</span>
                </span>
                {p.key === value && <Icon name="check" size={18} />}
              </li>
            </Fragment>
          ))}
          <li className="g-listbox-note" role="presentation">
            Same UI document. Only the pack changes.
          </li>
        </ul>
      )}
    </div>
  );
}

/** A labelled group of controls: the label carries the meaning, so the buttons can be icons. */
export function Cluster({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="g-cluster">
      <span className="g-cluster-label">{label}</span>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  showText = true,
}: {
  label: string;
  options: { key: T; text: string; icon?: string }[];
  value: T;
  onChange: (v: T) => void;
  showText?: boolean;
}) {
  return (
    <div className="g-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key} aria-label={showText ? undefined : o.text} title={showText ? undefined : o.text} onClick={() => onChange(o.key)}>
          {o.icon && <Icon name={o.icon} size={18} />}
          {showText && <span>{o.text}</span>}
        </button>
      ))}
    </div>
  );
}
