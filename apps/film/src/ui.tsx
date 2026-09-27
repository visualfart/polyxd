/**
 * The film's own furniture: easing, the caption, the act title, phone and window frames, the skeleton.
 * Motion follows the packs: cubic-bezier(0.2, 0, 0, 1), 300–500ms, nothing bouncy.
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

export const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
export const TEXT = "'Geist', system-ui, sans-serif";

export interface Layout {
  w: number;
  h: number;
  square: boolean;
}
const LayoutContext = createContext<Layout>({ w: 1920, h: 1080, square: false });
export const LayoutProvider = LayoutContext.Provider;
export const useLayout = () => useContext(LayoutContext);

/** Paper, and a scene that fades in and out at its edges. */
export function Scene({ children, fadeIn = 10, fadeOut = 10, style }: { children: ReactNode; fadeIn?: number; fadeOut?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = Math.min(rise(frame, 0, fadeIn), fadeOut ? fall(frame, durationInFrames, fadeOut) : 1);
  return (
    <AbsoluteFill style={{ backgroundColor: PAPER }}>
      <AbsoluteFill style={{ opacity, ...style }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

/** A caption: fades and rises 12px in 400ms at `from` (composition seconds, relative to the scene start `base`), fades out at `until`. */
export function Caption({ id, base, size, width, style, align = "left" }: { id: string; base: number; size?: number; width?: number; style?: CSSProperties; align?: "left" | "center" }) {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const l = line(id);
  const start = s(l.at - base);
  const end = s(l.until - base);
  const t = rise(frame, start, 12);
  const out = fall(frame, end, 9);
  return (
    <div
      style={{
        fontFamily: TEXT,
        fontWeight: 400,
        fontSize: size ?? (square ? 30 : 34),
        lineHeight: 1.35,
        color: INK,
        maxWidth: width ?? (square ? 880 : 520),
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

/** The act's title, large, in Bricolage. */
export function Act({ text, at, until, size, style }: { text: string; at: number; until?: number; size?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const t = rise(frame, s(at), 14);
  const out = until ? fall(frame, s(until), 9) : 1;
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: size ?? (square ? 56 : 64),
        letterSpacing: "-0.03em",
        lineHeight: 1,
        color: INK,
        opacity: t * out,
        transform: `translateY(${(1 - t) * 12}px)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/** A small muted line, Geist 500. */
export function Small({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontFamily: TEXT, fontWeight: 500, fontSize: 22, color: MUTED, letterSpacing: "0.01em", ...style }}>{children}</div>;
}

/** Scales a clip in from 0.96 as it arrives. */
export function Arrive({ children, at = 0, frames = 14, style }: { children: ReactNode; at?: number; frames?: number; style?: CSSProperties }) {
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

/** A captured clip, trimmed and scaled. Clips are transcoded to H.264 by `npm run render`. */
export function Clip({ name, from, rate = 1, width, height, style }: ClipProps) {
  return <OffthreadVideo src={staticFile(`${name}.mp4`)} startFrom={s(from)} playbackRate={rate} muted style={{ width, height, display: "block", objectFit: "cover", ...style }} />;
}

/** A phone: an ink shell around a 390×844 clip. */
export function Phone({ width, children, style }: { width: number; children: ReactNode; style?: CSSProperties }) {
  const height = (width * 844) / 390;
  const bezel = Math.round(width * 0.028);
  return (
    <div style={{ width: width + bezel * 2, height: height + bezel * 2, background: INK, borderRadius: width * 0.14, padding: bezel, boxShadow: "0 40px 90px rgba(20,20,19,.22)", ...style }}>
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
      <div style={{ width, height, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

/** A still, sized to fit. */
export function Still({ name, width, height, style, fit = "cover" }: { name: string; width?: number; height?: number; style?: CSSProperties; fit?: "cover" | "contain" }) {
  return <Img src={staticFile(`${name}.png`)} style={{ width, height, display: "block", objectFit: fit, objectPosition: "top", ...style }} />;
}

/**
 * The skeleton a surface shows before it arrives: a title bar and pattern-shaped blocks in a soft
 * grey, with a slow shimmer. Drawn over the phone while the document is on its way.
 */
export function Skeleton({ width, height, opacity, style }: { width: number; height: number; opacity: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const shimmer = (frame * 4) % (width * 2.2);
  const block = (w: number, h: number, mt: number) => (
    <div style={{ width: w, height: h, marginTop: mt, borderRadius: h > 30 ? 12 : 6, background: "rgba(20,20,19,.08)" }} />
  );
  return (
    <div style={{ position: "absolute", width, height, opacity, background: "#fff", padding: `${width * 0.11}px ${width * 0.07}px`, boxSizing: "border-box", overflow: "hidden", ...style }}>
      {block(width * 0.36, 16, 0)}
      {block(width * 0.5, 30, 24)}
      {block(width * 0.62, 14, 34)}
      <div style={{ display: "flex", gap: width * 0.05, marginTop: 18 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: width * 0.15, height: width * 0.15, borderRadius: "50%", background: "rgba(20,20,19,.08)" }} />
        ))}
      </div>
      {block(width * 0.86, 44, 28)}
      {block(width * 0.86, 44, 12)}
      {block(width * 0.3, 14, 40)}
      {block(width * 0.5, 40, 12)}
      {block(width * 0.86, 44, 40)}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: shimmer - width * 1.1, width: width * 0.6, background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.7), rgba(255,255,255,0))" }} />
    </div>
  );
}
