/**
 * The film's own furniture: easing, kinetic type, captions, phone and window frames, hairlines,
 * the pointer. Motion follows the packs: cubic-bezier(0.2, 0, 0, 1), 200–500ms, nothing bouncy.
 */
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { INK, MUTED, PAPER } from "./brand.tsx";
import { FPS, line } from "./script.ts";

export const ease = Easing.bezier(0.2, 0, 0, 1);
export const s = (seconds: number) => Math.round(seconds * FPS);

/** 0→1 over `frames`, starting at `start`, with the packs' easing. */
export function rise(frame: number, start: number, frames = 12) {
  if (frames <= 0) return frame >= start ? 1 : 0;
  return interpolate(frame, [start, start + frames], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}
/** 1→0 over `frames`, ending at `end`. */
export function fall(frame: number, end: number, frames = 10) {
  if (frames <= 0) return frame < end ? 1 : 0;
  return interpolate(frame, [end - frames, end], [1, 0], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}
/** 1 between `from` and `to` (inclusive of from), else 0: a hard cut. */
export const between = (frame: number, from: number, to: number) => (frame >= from && frame < to ? 1 : 0);
/** How many characters of `text` have been typed by `frame`, starting at `start`, one every `every` seconds. */
export const typed = (frame: number, start: number, text: string, every: number) => text.slice(0, Math.max(0, Math.min(text.length, Math.floor((frame - start) / s(every) + 1e-6))));
/** A deterministic noise in [-1, 1] for a hand-drawn wobble. */
export function noise(i: number, j: number) {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
export const TEXT = "'Geist', system-ui, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, monospace";
export const HAND = "'Caveat', 'Bradley Hand', cursive";

export interface Layout {
  w: number;
  h: number;
  square: boolean;
}
const LayoutContext = createContext<Layout>({ w: 1920, h: 1080, square: false });
export const LayoutProvider = LayoutContext.Provider;
export const useLayout = () => useContext(LayoutContext);

/** Paper, and a scene that can fade in and out at its edges (default: hard cuts). */
export function Scene({ children, fadeIn = 0, fadeOut = 0, background = PAPER, style }: { children: ReactNode; fadeIn?: number; fadeOut?: number; background?: string; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = Math.min(fadeIn ? rise(frame, 0, fadeIn) : 1, fadeOut ? fall(frame, durationInFrames, fadeOut) : 1);
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <AbsoluteFill style={{ opacity, ...style }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

/** A caption: fades and rises 12px in 400ms at its line's `at` (relative to the scene's `base`), out at `until`. */
export function Caption({ id, base, size, width, style, align = "left", color = INK }: { id: string; base: number; size?: number; width?: number; style?: CSSProperties; align?: "left" | "center"; color?: string }) {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const l = line(id);
  const t = rise(frame, s(l.at - base), 12);
  const out = fall(frame, s(l.until - base), 8);
  return (
    <div
      style={{
        fontFamily: TEXT,
        fontWeight: 500,
        fontSize: size ?? (square ? 28 : 32),
        lineHeight: 1.35,
        color,
        maxWidth: width ?? (square ? 900 : 640),
        textAlign: align,
        textWrap: "pretty",
        opacity: t * out,
        transform: `translateY(${(1 - t) * 12}px)`,
        ...style,
      }}
    >
      {l.text}
    </div>
  );
}

/** Kinetic type: Bricolage 800, arriving in 400ms with a 14px rise. */
export function Big({ children, at = 0, until, size, color = INK, style }: { children: ReactNode; at?: number; until?: number; size?: number; color?: string; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const t = rise(frame, s(at), 12);
  const out = until !== undefined ? fall(frame, s(until), 8) : 1;
  return (
    <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size ?? (square ? 64 : 84), letterSpacing: "-0.035em", lineHeight: 1.02, color, textWrap: "balance", opacity: t * out, transform: `translateY(${(1 - t) * 14}px)`, ...style }}>{children}</div>
  );
}

/** A small muted line, Geist 500. */
export function Small({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontFamily: TEXT, fontWeight: 500, fontSize: 22, color: MUTED, letterSpacing: "0.01em", ...style }}>{children}</div>;
}

/** A mono label in small caps, the drafting-table voice. */
export function Label({ children, style, color = MUTED }: { children: ReactNode; style?: CSSProperties; color?: string }) {
  return <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", color, ...style }}>{children}</div>;
}

/** Scales in from 0.96 as it arrives. */
export function Arrive({ children, at = 0, frames = 12, style }: { children: ReactNode; at?: number; frames?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const t = rise(frame, at, frames);
  return <div style={{ opacity: t, transform: `scale(${0.96 + 0.04 * t})`, transformOrigin: "center", ...style }}>{children}</div>;
}

export interface ClipProps {
  /** Asset name without extension: assets/<name>.mp4 */
  name: string;
  /** Where in the clip to start, in seconds. */
  from: number;
  rate?: number;
  width: number;
  height: number;
  style?: CSSProperties;
}

/** A captured clip, trimmed and scaled. */
export function Clip({ name, from, rate = 1, width, height, style }: ClipProps) {
  return <OffthreadVideo src={staticFile(`${name}.mp4`)} startFrom={s(from)} playbackRate={rate} muted style={{ width, height, display: "block", objectFit: "cover", objectPosition: "top", ...style }} />;
}

/** A phone: an ink shell around a 390×844 screen. */
export function Phone({ width, children, style, shell = 1 }: { width: number; children: ReactNode; style?: CSSProperties; shell?: number }) {
  const height = (width * 844) / 390;
  const bezel = Math.round(width * 0.028);
  return (
    <div style={{ width: width + bezel * 2, height: height + bezel * 2, background: `rgba(20,20,19,${shell})`, borderRadius: width * 0.14, padding: bezel, boxShadow: `0 40px 90px rgba(20,20,19,${0.22 * shell})`, ...style }}>
      <div style={{ width, height, borderRadius: width * 0.14 - bezel, overflow: "hidden", background: "#fff" }}>{children}</div>
    </div>
  );
}

/** A window: a thin ink edge, a top strip with three dots, a shadow. */
export function Window({ width, ratio = 800 / 1280, children, style, dark = false }: { width: number; ratio?: number; children: ReactNode; style?: CSSProperties; dark?: boolean }) {
  const height = width * ratio;
  const bar = Math.round(width * 0.026);
  const dot = Math.max(6, Math.round(bar * 0.32));
  return (
    <div style={{ width, borderRadius: 14, overflow: "hidden", background: dark ? "#0a0a0a" : "#fff", boxShadow: "0 40px 90px rgba(20,20,19,.22), 0 0 0 1px rgba(20,20,19,.12)", ...style }}>
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: dot * 0.8, paddingLeft: bar * 0.55, background: dark ? "#1b1b1b" : "#eae7e0" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: dot, height: dot, borderRadius: dot, background: dark ? "rgba(244,241,234,.28)" : "rgba(20,20,19,.22)" }} />
        ))}
      </div>
      <div style={{ width, height, overflow: "hidden", position: "relative" }}>{children}</div>
    </div>
  );
}

/** A still, sized to fit. */
export function Still({ name, width, height, style, fit = "cover" }: { name: string; width?: number; height?: number; style?: CSSProperties; fit?: "cover" | "contain" }) {
  return <Img src={staticFile(`${name}.png`)} style={{ width, height, display: "block", objectFit: fit, objectPosition: "top", ...style }} />;
}

/** The pointer: the same arrow the capture rig draws, so the graphics and the footage share one. */
export function Pointer({ x, y, press = 0, style }: { x: number; y: number; press?: number; style?: CSSProperties }) {
  return (
    <svg width={34} height={34} viewBox="0 0 28 28" style={{ position: "absolute", left: x - 7, top: y - 4, transform: `scale(${1 - 0.18 * press})`, transformOrigin: "7px 4px", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.35))", ...style }}>
      <path d="M6 3l15 12-6.5 1 3.8 7.2-2.9 1.5-3.8-7.2L6 22z" fill="#fff" stroke="#141413" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

/** A caret, blinking at 1.1 s. */
export function Caret({ height, color = INK }: { height: number; color?: string }) {
  const frame = useCurrentFrame();
  return <span style={{ display: "inline-block", width: Math.max(2, height * 0.06), height, background: color, marginLeft: 3, verticalAlign: "-0.1em", opacity: Math.floor(frame / 16) % 2 === 0 ? 1 : 0 }} />;
}
