/**
 * The Polyxd mark, the design system's `Mark` as a React component (brand/BRAND-2026.md): an
 * orange p (bowl and stem), a white firm-squircle window, and a solid ink pupil drawn on top.
 * Only the pupil moves: `state` sets `data-state`, and brand/mark.css (loaded by styles.css)
 * moves it. The paths are brand/build.ts's BOWL, STEM, WINDOW and TICK; colours come from
 * brand/tokens.css, so the mark follows a themed island.
 */
import { useState } from "react";

export type MarkState = "idle" | "reading" | "looking" | "attention" | "thinking" | "blink" | "checked" | "asleep";
const STATES: MarkState[] = ["idle", "reading", "looking", "attention", "thinking", "blink", "checked", "asleep"];

const BOWL = "M13 6H19C22.864 6 26 9.136 26 13V19C26 22.864 22.864 26 19 26H13C9.136 26 6 22.864 6 19V13C6 9.136 9.136 6 13 6Z";
const STEM = "M8.5 14H8.5C9.88 14 11 15.12 11 16.5V25.5C11 26.88 9.88 28 8.5 28H8.5C7.12 28 6 26.88 6 25.5V16.5C6 15.12 7.12 14 8.5 14Z";
const WINDOW = "M16 11.2H16C20.224 11.2 20.8 11.776 20.8 16V16C20.8 20.224 20.224 20.8 16 20.8H16C11.776 20.8 11.2 20.224 11.2 16V16C11.2 11.776 11.776 11.2 16 11.2Z";
const TICK = "M13.9 16.3l1.5 1.5 2.8-3.1";

export interface MarkProps {
  /** In px. Below 12 the pupil is left out, as the brand's small mark. */
  size?: number;
  state?: MarkState;
  /** Pass when the mark stands alone as the brand; leave it out beside the wordmark. */
  title?: string;
  /** One colour: `ink` on light grounds, `paper` on dark ones. */
  mono?: "ink" | "paper";
  className?: string;
}

export function Mark({ size = 32, state = "idle", title, mono, className }: MarkProps) {
  const s = STATES.includes(state) ? state : "idle";
  const p = mono === "ink" ? "var(--ink)" : mono === "paper" ? "var(--ground)" : "var(--signal)";
  const win = mono === "ink" ? "var(--ground)" : mono === "paper" ? "var(--ink)" : "var(--mark-window)";
  const pupil = mono === "ink" ? "var(--ink)" : mono === "paper" ? "var(--ground)" : "var(--mark-pupil)";
  const small = size < 12;
  return (
    <svg
      className={className ? `pxb-mark ${className}` : "pxb-mark"}
      data-state={s}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d={BOWL} fill={p} />
      <path d={STEM} fill={p} />
      <path d={WINDOW} fill={win} />
      {!small && <circle className="pxb-pupil" cx={16} cy={16} r={2.4} fill={pupil} />}
      {!small && <path className="pxb-tick" d={TICK} pathLength={1} fill="none" stroke={pupil} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** The mark with the wordmark "polyxd" in Young Serif beside it: a gap of 5/32 of the mark, the word at 0.8 of it. */
export function Lockup({ size = 40, state, mono, className }: { size?: number; state?: MarkState; mono?: "ink" | "paper"; className?: string }) {
  return (
    <span className={className ? `pxb-lockup ${className}` : "pxb-lockup"} style={{ gap: `${Math.round((size * 5) / 32)}px` }} role="img" aria-label="Polyxd">
      <Mark size={size} state={state} mono={mono} />
      <span className="pxb-word" aria-hidden="true" style={{ fontSize: `${Math.round(size * 0.8)}px`, marginTop: `${-Math.round(size * 0.04)}px` }}>
        polyxd
      </span>
    </span>
  );
}

/**
 * Studio's own name: the lockup, then "Studio" in the UI face. The pupil reads while the pointer
 * is on it, and returns to idle when it leaves.
 */
export function StudioLockup({ size = 28, className }: { size?: number; className?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <span className={className ? `studio-lockup ${className}` : "studio-lockup"} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      <Lockup size={size} state={hover ? "reading" : "idle"} />
      <span className="studio-product" style={{ fontSize: `${Math.round(size * 0.6)}px` }}>
        Studio
      </span>
    </span>
  );
}
