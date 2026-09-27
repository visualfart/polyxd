/**
 * The Polyxd mark, as drawn in brand/build.ts: a p, a squircle, a circle cut through both, so
 * whatever the mark sits on shows in the pupil. The static mark is always idle; the other states
 * (brand/mark-states.svg) are for a real state, only the pupil moves.
 */
export type MarkState = "idle" | "reading" | "looking" | "blink" | "attention" | "checked" | "asleep";

const C = 16;
const R = 2.4;
/** A circle as a subpath, so the squircle and the bowl can carry it as a hole (evenodd). */
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
/** Only the pupil moves; blink and checked draw one ink shape in the window; asleep dims the squircle. */
const STATES: Record<MarkState, { pupil: false | { cx?: number; cy?: number; r?: number }; accent?: (ink: string) => string }> = {
  idle: { pupil: {} },
  reading: { pupil: { cx: 17.3, cy: 14.9 } },
  looking: { pupil: { cx: 14.7, cy: 17.1 } },
  blink: { pupil: false },
  attention: { pupil: { r: 3 } },
  checked: { pupil: false },
  asleep: { pupil: false, accent: (ink) => `color-mix(in srgb, ${ink} 25%, transparent)` },
};

export function Mark({ size = 28, ink = "currentColor", accent = "var(--signal)", state = "idle", title }: { size?: number; ink?: string; accent?: string; state?: MarkState; title?: string }) {
  const s = STATES[state];
  const hole = s.pupil ? circle(s.pupil.cx ?? C, s.pupil.cy ?? C, s.pupil.r ?? R) : "";
  const fill = s.accent ? s.accent(ink) : accent;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined} focusable="false">
      {title && <title>{title}</title>}
      <path fillRule="evenodd" d={`M13 6h6a7 7 0 0 1 7 7v6a7 7 0 0 1-7 7h-6a7 7 0 0 1-7-7v-6a7 7 0 0 1 7-7z${hole}`} fill={ink} />
      <rect x="6" y="14" width="5" height="14" rx="2.5" fill={ink} />
      <path fillRule="evenodd" d={`M16 11.2C19.504 11.2 20.8 12.496 20.8 16S19.504 20.8 16 20.8 11.2 19.504 11.2 16 12.496 11.2 16 11.2z${hole}`} fill={fill} />
      {state === "blink" && <rect x="13.4" y="15.2" width="5.2" height="1.6" rx="0.8" fill={ink} />}
      {state === "checked" && <path d="M13.9 16.3l1.5 1.5 2.8-3.1" stroke={ink} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
