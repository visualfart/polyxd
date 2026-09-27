/**
 * The mark, drawn from the same definition as brand/build.ts: a solid p, a squircle in the accent,
 * and a pupil cut through both so the paper shows. Only the pupil moves; the letter never does.
 */
import { interpolate } from "remotion";

export const INK = "#141413";
export const PAPER = "#f4f1ea";
export const ACCENT = "#ff5a1f";
export const MUTED = "#6b675e";

const c = 16;
const half = 4.8;
const k = 0.73 * half;
const SQUIRCLE = `M${c} ${c - half}C${c + k} ${c - half} ${c + half} ${c - k} ${c + half} ${c}S${c + k} ${c + half} ${c} ${c + half} ${c - half} ${c + k} ${c - half} ${c} ${c - k} ${c - half} ${c} ${c - half}z`;
const P = "M13 6h6a7 7 0 0 1 7 7v6a7 7 0 0 1-7 7h-6a7 7 0 0 1-7-7v-6a7 7 0 0 1 7-7z";
const circle = (cx: number, cy: number, r: number) => (r > 0.01 ? `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z` : "");

export interface MarkProps {
  size: number;
  /** Pupil radius: 2.4 idle, 3 attention, 0 closed. */
  pupil?: number;
  /** 0–1: how much of the blink line is drawn. */
  blink?: number;
  /** 0–1: how much of the tick is drawn (the "checked" state). */
  tick?: number;
  ink?: string;
  accent?: string;
  style?: React.CSSProperties;
}

export function Mark({ size, pupil = 2.4, blink = 0, tick = 0, ink = INK, accent = ACCENT, style }: MarkProps) {
  const hole = circle(c, c, pupil);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: "block", ...style }}>
      <path fillRule="evenodd" d={P + hole} fill={ink} />
      <rect x={6} y={14} width={5} height={14} rx={2.5} fill={ink} />
      <path fillRule="evenodd" d={SQUIRCLE + hole} fill={accent} />
      {blink > 0 && <rect x={16 - 2.6 * blink} y={15.2} width={5.2 * blink} height={1.6} rx={0.8} fill={ink} />}
      {tick > 0 && (
        <path d="M13.9 16.3l1.5 1.5 2.8-3.1" stroke={ink} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tick} />
      )}
    </svg>
  );
}

/** The pupil closing and opening again: one blink, `frames` long, starting at `start`. */
export function blinkAt(frame: number, start: number, frames = 8) {
  const t = interpolate(frame, [start, start + frames / 2, start + frames], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { pupil: 2.4 * (1 - t), blink: t };
}

/** The wordmark: Bricolage Grotesque 800, −4% tracking, always beside the mark with a gap of one stem width. */
export function Wordmark({ size, ink = INK, style }: { size: number; ink?: string; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        fontWeight: 800,
        fontSize: size,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        color: ink,
        display: "inline-block",
        ...style,
      }}
    >
      polyxd
    </span>
  );
}

/** Mark and wordmark together, sized by the mark. */
export function Lockup({ mark, pupil, blink, tick, wordStyle, style }: { mark: number; pupil?: number; blink?: number; tick?: number; wordStyle?: React.CSSProperties; style?: React.CSSProperties }) {
  const gap = (mark * 5) / 32;
  return (
    <div style={{ display: "flex", alignItems: "center", gap, ...style }}>
      <Mark size={mark} pupil={pupil} blink={blink} tick={tick} />
      <Wordmark size={mark * 0.8} style={{ marginTop: -mark * 0.02, ...wordStyle }} />
    </div>
  );
}
