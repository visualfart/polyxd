/**
 * The furniture of the three short cuts (SCRIPT-OPTIONS.md). One rule everywhere: one thing moves at
 * a time, and a caption leaves before the next one arrives.
 *
 * The phone is drawn at 390×844 CSS pixels (a real phone's viewport) and scaled up, so the real
 * renderer inside it lays out exactly as it would on a phone. Its app bar, bubbles and input read
 * the pack's own tokens, so each invented app looks like its design system all the way through.
 */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { PolyxdSurface, type UIDocument } from "@polyxd/react";
import { ACCENT, INK, Lockup, MUTED, Mark, PAPER, blinkAt } from "../brand.tsx";
import { DISPLAY, MONO, TEXT, ease, fall, rise, s } from "../ui.tsx";

export const VW = 390;
export const VH = 844;

/** An invented app: a name, a pack, and the letter on its icon. */
export interface App {
  name: string;
  theme: string;
  mode?: "light" | "dark";
}

/** Seconds on the film's clock, from the current frame. */
export const useT = () => useCurrentFrame() / 30;

/** 0→1 between two seconds, eased. */
export const ramp = (t: number, from: number, dur = 0.4) => (dur <= 0 ? (t >= from ? 1 : 0) : interpolate(t, [from, from + dur], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
/** Visible from `from` to `to`, fading `d` each side. */
export const window_ = (t: number, from: number, to: number, d = 0.35) => Math.min(ramp(t, from, d), 1 - ramp(t, to - d, d));

// ——— Layout: the phone on the right, one line of words on the left ———

export const PHONE_H = 900;
const SCALE = PHONE_H / VH;
export const PHONE_W = VW * SCALE;
const BEZEL = 13;
export const PHONE_X = 1920 * 0.68 - PHONE_W / 2;
export const PHONE_Y = (1080 - PHONE_H) / 2;

/** The phone: an ink shell, a screen at 390×844 scaled to fit. Everything inside is in CSS pixels. */
export function Phone({ children, opacity = 1, style }: { children: ReactNode; opacity?: number; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: PHONE_X - BEZEL, top: PHONE_Y - BEZEL, width: PHONE_W + BEZEL * 2, height: PHONE_H + BEZEL * 2, borderRadius: 64, background: INK, padding: BEZEL, boxShadow: "0 50px 100px rgba(20,20,19,.20)", opacity, ...style }}>
      <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 52, overflow: "hidden", position: "relative", background: "#fff" }}>
        <div style={{ width: VW, height: VH, transform: `scale(${SCALE})`, transformOrigin: "0 0", position: "absolute", left: 0, top: 0 }}>{children}</div>
      </div>
    </div>
  );
}

/** One line of words, left of the phone, Bricolage at 60px. In at `from`, out at `to`. */
export function Line({ t, from, to, children, width = 720 }: { t: number; from: number; to: number; children: ReactNode; width?: number }) {
  const o = window_(t, from, to, 0.45);
  const y = (1 - ramp(t, from, 0.6)) * 16;
  return (
    <div style={{ position: "absolute", left: 150, top: 0, bottom: 0, display: "flex", alignItems: "center", width }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 62, lineHeight: 1.08, letterSpacing: "-0.03em", color: INK, textWrap: "balance", opacity: o, transform: `translateY(${y}px)` }}>{children}</div>
    </div>
  );
}

/** A whole-frame line on paper, centred. */
export function PaperLine({ t, from, to, children, size = 76 }: { t: number; from: number; to: number; children: ReactNode; size?: number }) {
  const o = window_(t, from, to, 0.5);
  const y = (1 - ramp(t, from, 0.7)) * 18;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 220px" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.1, letterSpacing: "-0.035em", color: INK, textAlign: "center", textWrap: "balance", opacity: o, transform: `translateY(${y}px)` }}>{children}</div>
    </AbsoluteFill>
  );
}

// ——— Inside the phone ———

/** The pack's scope, so the app's own chrome reads its tokens. */
export function Themed({ app, children, style }: { app: App; children: ReactNode; style?: CSSProperties }) {
  return (
    <div data-pxd-theme={app.theme} data-pxd-mode={app.mode ?? "light"} style={{ position: "absolute", inset: 0, background: "var(--pxd-color-surface-default)", color: "var(--pxd-color-text-default)", fontFamily: "var(--pxd-type-body-default-family)", ...style }}>
      {children}
    </div>
  );
}

/** Status bar and the app's bar: its icon, its name, "Assistant". */
export function AppBar({ app }: { app: App }) {
  return (
    <div style={{ height: 112, borderBottom: "1px solid var(--pxd-color-border-default)", background: "var(--pxd-color-surface-default)" }}>
      <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px", fontFamily: TEXT, fontWeight: 600, fontSize: 15 }}>
        <span>9:41</span>
        <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ width: 17, height: 11, borderRadius: 2, border: "1.5px solid currentColor", opacity: 0.8 }} />
        </span>
      </div>
      <div style={{ height: 62, display: "flex", alignItems: "center", gap: 12, padding: "0 20px" }}>
        <div style={{ width: 34, height: 34, borderRadius: "var(--pxd-radius-default)", background: "var(--pxd-color-action-primary-background)", color: "var(--pxd-color-action-primary-foreground)", display: "grid", placeItems: "center", fontFamily: "var(--pxd-type-title-item-family)", fontWeight: 700, fontSize: 18 }}>{app.name[0]}</div>
        <div style={{ fontFamily: "var(--pxd-type-title-section-family)", fontWeight: 700, fontSize: 19 }}>{app.name}</div>
        <div style={{ marginLeft: "auto", fontSize: 14, color: "var(--pxd-color-text-muted)" }}>Assistant</div>
      </div>
    </div>
  );
}

/** What the person asked, on the right, in the app's primary colour. */
export function Asked({ text, o = 1 }: { text: string; o?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "18px 16px 6px", opacity: o, transform: `translateY(${(1 - o) * 8}px)` }}>
      <div style={{ maxWidth: 280, padding: "11px 15px", borderRadius: 20, borderBottomRightRadius: 6, background: "var(--pxd-color-action-primary-background)", color: "var(--pxd-color-action-primary-foreground)", fontSize: 16, lineHeight: 1.35 }}>{text}</div>
    </div>
  );
}

/** The assistant's reply as words, on the left. */
export function Replied({ children, o = 1 }: { children: ReactNode; o?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", padding: "8px 16px", opacity: o, transform: `translateY(${(1 - o) * 8}px)` }}>
      <div style={{ maxWidth: 300, padding: "11px 15px", borderRadius: 20, borderBottomLeftRadius: 6, background: "var(--pxd-color-surface-subtle)", color: "var(--pxd-color-text-default)", fontSize: 16, lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

/** Three dots while the assistant thinks. */
export function Thinking({ t, o = 1 }: { t: number; o?: number }) {
  return (
    <Replied o={o}>
      <span style={{ display: "inline-flex", gap: 5, padding: "4px 2px" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: 7, background: "currentColor", opacity: 0.3 + 0.5 * Math.max(0, Math.sin((t * 5 - i * 0.7) % (Math.PI * 2))) }} />
        ))}
      </span>
    </Replied>
  );
}

/** The input at the bottom: what's being typed, or a placeholder. */
export function Composer({ text, caret }: { text: string; caret: boolean }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, padding: "12px 14px 34px", borderTop: "1px solid var(--pxd-color-border-default)", background: "var(--pxd-color-surface-default)", display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ flex: 1, height: 46, borderRadius: 23, border: "1px solid var(--pxd-color-border-default)", display: "flex", alignItems: "center", padding: "0 16px", fontSize: 16, color: text ? "var(--pxd-color-text-default)" : "var(--pxd-color-text-muted)", whiteSpace: "nowrap", overflow: "hidden" }}>
        {text || "Ask anything"}
        {caret && <span style={{ width: 2, height: 20, background: "var(--pxd-color-text-default)", marginLeft: 1 }} />}
      </div>
      <div style={{ width: 46, height: 46, borderRadius: 23, background: text ? "var(--pxd-color-action-primary-background)" : "var(--pxd-color-surface-subtle)", display: "grid", placeItems: "center" }}>
        <svg width="20" height="20" viewBox="0 0 20 20">
          <path d="M10 15V5M5.5 9.5 10 5l4.5 4.5" stroke={text ? "var(--pxd-color-action-primary-foreground)" : "var(--pxd-color-text-muted)"} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

/** Characters typed by `t`, starting at `from`, one every `every` seconds. */
export const typedAt = (t: number, from: number, text: string, every = 0.055) => text.slice(0, Math.max(0, Math.min(text.length, Math.floor((t - from) / every))));

/** A dark pill near the bottom: what just happened. */
export function Toast({ text, o }: { text: string; o: number }) {
  return (
    <div style={{ position: "absolute", left: 20, right: 20, bottom: 112, opacity: o, transform: `translateY(${(1 - o) * 14}px)` }}>
      <div style={{ padding: "14px 18px", borderRadius: "var(--pxd-radius-default)", background: "var(--pxd-color-surface-inverse)", color: "var(--pxd-color-text-inverse)", fontSize: 15, display: "flex", gap: 10, alignItems: "center" }}>
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path d="M4 9.5l3.2 3L14 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {text}
      </div>
    </div>
  );
}

/**
 * The real renderer, one part at a time. The parts are the surface's title, each field of its form
 * and the form's buttons, in reading order; part i fades and rises in at `from + i × every`.
 * `hide` fades parts out again, in the same order (Option C turns the screen into its list).
 * `press` darkens the submit button, as a finger on it would.
 */
export function Reveal({ doc, data, theme, mode = "light", from, every = 0.45, hideFrom, hideEvery = 0.45, t, tap }: { doc: UIDocument; data: Record<string, unknown>; theme: string; mode?: "light" | "dark"; from: number; every?: number; hideFrom?: number; hideEvery?: number; t: number; /** When a finger taps the submit button: its start, in seconds. */ tap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const finger = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const parts = revealParts(root);
    parts.forEach((el, i) => {
      const inn = ramp(t, from + i * every, 0.55);
      const out = hideFrom === undefined ? 0 : ramp(t, hideFrom + i * hideEvery, 0.4);
      const o = inn * (1 - out);
      el.style.opacity = String(o);
      el.style.transform = `translateY(${(1 - inn) * 14}px)`;
    });
    // The finger: lands on the submit button, presses for a moment, lifts (0.7 s in all).
    const submit = root.querySelector<HTMLElement>("button[type=submit]");
    const f = finger.current;
    const p = tap === undefined ? 0 : (t - tap) / 0.7;
    const on = p > 0 && p < 1;
    if (submit) submit.style.filter = on ? `brightness(${1 - 0.16 * Math.sin(Math.PI * p)})` : "";
    if (f) {
      f.style.display = on && submit ? "block" : "none";
      if (on && submit) {
        const scale = root.getBoundingClientRect().width / root.offsetWidth;
        const a = root.getBoundingClientRect();
        const b = submit.getBoundingClientRect();
        const cx = (b.left + b.width * 0.62 - a.left) / scale;
        const cy = (b.top + b.height / 2 - a.top) / scale;
        const r = 22 + 5 * Math.sin(Math.PI * Math.min(1, p * 1.6));
        Object.assign(f.style, { left: `${cx - r}px`, top: `${cy - r}px`, width: `${r * 2}px`, height: `${r * 2}px`, borderRadius: `${r}px`, opacity: String(Math.sin(Math.PI * p)) });
      }
    }
  });
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <PolyxdSurface document={doc} data={data} theme={theme} mode={mode} resolveMedia={() => undefined} />
      <div ref={finger} style={{ position: "absolute", display: "none", background: "rgba(20,20,19,.22)", border: "2px solid rgba(255,255,255,.75)", pointerEvents: "none" }} />
    </div>
  );
}

/** Title, each form field, the form's buttons: the parts a person reads, in order. */
export function revealParts(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const title = root.querySelector<HTMLElement>(".pxd-surface-main > :not(form):not(.pxd-form)");
  if (title) out.push(title);
  root.querySelectorAll<HTMLElement>(".pxd-form-fields > *").forEach((el) => out.push(el));
  const form = root.querySelector<HTMLElement>(".pxd-form");
  if (form) for (const el of Array.from(form.children) as HTMLElement[]) if (!el.classList.contains("pxd-form-fields") && !el.classList.contains("pxd-form-aside")) out.push(el);
  return out;
}

// ——— The mark beside the phone, checking; the end card ———

/** The mark at the phone's top-left corner, its pupil turning into a tick. */
export function Checked({ t, from }: { t: number; from: number }) {
  const o = ramp(t, from, 0.5);
  const tick = ramp(t, from + 0.7, 0.6);
  const size = 132;
  return (
    <div style={{ position: "absolute", left: PHONE_X - size * 0.55, top: PHONE_Y + 70, width: size, height: size, borderRadius: size * 0.3, background: PAPER, boxShadow: "0 18px 40px rgba(20,20,19,.18)", display: "grid", placeItems: "center", opacity: o, transform: `scale(${0.9 + 0.1 * o})` }}>
      {/* The pupil closes as the tick draws: the "checked" state. */}
      <Mark size={size * 0.78} pupil={2.4 * (1 - tick)} tick={tick} />
    </div>
  );
}

/** Paper, the lockup, a blink, the address. */
export function EndCard({ t, from, sub = "polyxd.com" }: { t: number; from: number; sub?: string }) {
  const local = (t - from) * 30;
  const o = ramp(t, from + 0.2, 0.7);
  const b = blinkAt(local, 30 * 1.6, 9);
  const u = ramp(t, from + 1.2, 0.6);
  return (
    <AbsoluteFill style={{ background: PAPER, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 44 }}>
      <div style={{ opacity: o, transform: `translateY(${(1 - o) * 12}px)` }}>
        <Lockup mark={150} pupil={b.pupil} blink={b.blink} />
      </div>
      <div style={{ fontFamily: TEXT, fontWeight: 500, fontSize: 34, color: MUTED, letterSpacing: "0.01em", opacity: u }}>{sub}</div>
    </AbsoluteFill>
  );
}

// ——— Sound: the music, a tap, a tick ———

export function Sound({ music, cues, end }: { music: string; cues: { at: number; sfx: string; gain?: number }[]; end: number }) {
  return (
    <>
      <Audio src={staticFile(music)} />
      {cues.map((c, i) => (
        <Sequence key={i} from={s(c.at)} durationInFrames={Math.max(1, s(end - c.at))}>
          <Audio src={staticFile(`sfx/${c.sfx}.wav`)} volume={c.gain ?? 0.7} />
        </Sequence>
      ))}
    </>
  );
}

export { ACCENT, INK, MONO, MUTED, PAPER, TEXT, fall, rise };
