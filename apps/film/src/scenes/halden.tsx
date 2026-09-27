/**
 * 0:12–0:30. The screen arrives on the phone (a pencil skeleton keyed to the real form's geometry
 * snaps into the real footage), then the screen lifts off, unfolds into its JSON as cards in a
 * tree, and a swarm of real tokens re-forms it as the real renderer in pack after pack.
 */
import { useMemo } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { ACCENT, GRAPHITE, INK, MUTED, PAPER } from "../brand.tsx";
import { Big, Caption, Clip, DISPLAY, HAND, Label, MONO, Phone, Scene, Still, between, fall, noise, rise, s, useLayout } from "../ui.tsx";
import { FORM, Surface, formData } from "../surface.tsx";
import geometry from "../../assets/halden-geometry.json";

/* ─── The pencil skeleton, from the real form's measurements ─── */

interface Item {
  kind: string;
  role: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
}
const ITEMS: Item[] = (geometry.items as Item[]).filter((i) => i.x >= 0 && i.y + i.h <= geometry.viewport.h - 4 && i.kind !== "text").sort((a, b) => a.y - b.y || a.x - b.x);
const SURFACE_TOP = geometry.frame.y;

/** A rectangle as a pencil would draw it: overshot corners, a little wobble that changes every other frame. */
function hand(r: { x: number; y: number; w: number; h: number }, rx: number, seed: number, f: number, k = 1) {
  const j = (n: number) => noise(seed * 17 + n, Math.floor(f / 2)) * 1.1 * k;
  const { x, y, w, h } = r;
  const c = Math.min(rx, w / 2, h / 2);
  return `M${x + c + j(1)} ${y + j(2)} L${x + w - c + j(3)} ${y + j(4)} Q${x + w} ${y} ${x + w + j(5)} ${y + c + j(6)} L${x + w + j(7)} ${y + h - c + j(8)} Q${x + w} ${y + h} ${x + w - c + j(9)} ${y + h + j(10)} L${x + c + j(11)} ${y + h + j(12)} Q${x} ${y + h} ${x + j(13)} ${y + h - c + j(14)} L${x + j(15)} ${y + c + j(16)} Q${x} ${y} ${x + c + 3 + j(17)} ${y + j(18)}`;
}
const stroke = (x1: number, y1: number, x2: number, y2: number, seed: number, f: number) => {
  const j = (n: number) => noise(seed * 31 + n, Math.floor(f / 2)) * 1.2;
  return `M${x1 + j(1)} ${y1 + j(2)} L${x2 + j(3)} ${y2 + j(4)}`;
};

/** The skeleton over the phone screen: strokes drawn one after another from `start`, over `draw` frames each. */
export function Pencil({ width, start, draw = 9, gap = 1.3, opacity = 1, color = GRAPHITE }: { width: number; start: number; draw?: number; gap?: number; opacity?: number; color?: string }) {
  const frame = useCurrentFrame();
  const k = width / geometry.viewport.w;
  const paths: { d: string; faint?: boolean }[] = [];
  const sheet = { x: 0, y: SURFACE_TOP + 2, w: geometry.viewport.w, h: geometry.viewport.h - SURFACE_TOP + 40 };
  paths.push({ d: hand(sheet, 28, 99, frame, 1.6) });
  ITEMS.forEach((it, i) => {
    const seed = i + 1;
    if (it.kind === "label") paths.push({ d: stroke(it.x, it.y + it.h * 0.72, it.x + Math.min(it.w, it.text.length * it.h * 0.55), it.y + it.h * 0.72, seed, frame) });
    else if (it.kind === "avatar") {
      const cx = it.x + it.w / 2;
      const cy = it.y + it.h / 2;
      const r = it.w / 2;
      const j = (n: number) => noise(seed * 7 + n, Math.floor(frame / 2)) * 1.1;
      paths.push({ d: `M${cx + r + j(1)} ${cy + j(2)} A${r} ${r} 0 1 1 ${cx - r + j(3)} ${cy + j(4)} A${r} ${r} 0 1 1 ${cx + r + 2 + j(5)} ${cy + j(6)}` });
    } else if (it.kind === "option" && it.h > 70) {
      // A person tile: the circle above carries it; a short name line beneath.
      paths.push({ d: stroke(it.x + 14, it.y + it.h - 8, it.x + it.w - 14, it.y + it.h - 8, seed, frame), faint: true });
    } else if (it.kind === "option") {
      paths.push({ d: hand(it, it.radius, seed, frame) });
      paths.push({ d: stroke(it.x + 68, it.y + it.h * 0.4, it.x + it.w * 0.55, it.y + it.h * 0.4, seed + 50, frame), faint: true });
    } else if (it.kind === "input") {
      paths.push({ d: hand(it, it.radius || 6, seed, frame) });
    } else if (it.kind === "button") {
      paths.push({ d: hand(it, it.radius, seed, frame) });
      paths.push({ d: stroke(it.x + it.w * 0.38, it.y + it.h / 2, it.x + it.w * 0.62, it.y + it.h / 2, seed + 50, frame), faint: true });
    }
  });
  return (
    <svg width={width} height={width * (geometry.viewport.h / geometry.viewport.w)} viewBox={`0 0 ${geometry.viewport.w} ${geometry.viewport.h}`} style={{ position: "absolute", left: 0, top: 0, opacity, overflow: "visible" }}>
      {paths.map((p, i) => {
        const t = rise(frame, start + i * gap, draw);
        return t > 0 ? <path key={i} d={p.d} fill="none" stroke={color} strokeWidth={(p.faint ? 1.2 : 1.8) / k} strokeLinecap="round" strokeLinejoin="round" opacity={p.faint ? 0.5 : 0.95} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} /> : null;
      })}
    </svg>
  );
}

/* ─── 0:12–0:18 · The screen arrives ─── */
const CLIP_FORM = 6.0; // the clip's second where the form is settled (the still was shot at 5.96s)
const SNAP = 1.35; // scene second where the pencil snaps to the real form
export const ARRIVE_RATE = 1.15;

export function Arrives() {
  const frame = useCurrentFrame();
  const { w, h, square } = useLayout();
  const width = square ? 330 : 400;
  const height = (width * 844) / 390;
  const bezel = Math.round(width * 0.028);
  const phoneX = square ? 60 : 360;
  const phoneY = (h - height) / 2 - bezel;
  const cover = fall(frame, s(SNAP + 0.2), 6);
  const pencil = fall(frame, s(SNAP + 0.5), 10);
  const capX = square ? 60 + width + 60 : phoneX + width + 200;
  const size = square ? 40 : 58;
  return (
    <Scene>
      <div style={{ position: "absolute", left: phoneX, top: phoneY }}>
        <Phone width={width}>
          <div style={{ position: "relative", width, height }}>
            {frame < s(SNAP) ? (
              <Still name="halden-form" width={width} height={height} />
            ) : (
              <Sequence from={s(SNAP)} layout="none">
                <Clip name="halden-send" from={CLIP_FORM} rate={ARRIVE_RATE} width={width} height={height} />
              </Sequence>
            )}
            {cover > 0 && <div style={{ position: "absolute", left: 0, top: (SURFACE_TOP / 844) * height, width, height: height - (SURFACE_TOP / 844) * height, background: "#fef7ff", opacity: cover }} />}
            {pencil > 0 && <Pencil width={width} start={s(0.1)} opacity={pencil} />}
          </div>
        </Phone>
      </div>
      <div style={{ position: "absolute", left: capX, top: square ? h / 2 - size * 2.6 : h / 2 - size * 2.4, width: w - capX - (square ? 40 : 160) }}>
        {["arrive-1", "arrive-2", "arrive-3"].map((id, i) => (
          <Big key={id} at={[1.7, 3.1, 4.9][i]} size={size} style={{ marginBottom: size * 0.5 }}>
            {["Drawn the moment you ask.", "In the product's own design system.", "Checked before you see it."][i]}
          </Big>
        ))}
      </div>
    </Scene>
  );
}

/* ─── 0:18–0:30 · Meaning, not pixels ─── */

/** The JSON cards: the component type, its id, and one real prop line, from the actual document. */
interface Card {
  id: string;
  type: string;
  prop: string;
  /** Where it sits on the phone screen (CSS px of the 390×844 viewport), for the unfold. */
  from: { x: number; y: number; w: number; h: number };
  /** Its tree slot: column (0–2) and row. */
  col: number;
  row: number;
}
const q = (v: unknown) => JSON.stringify(v);
const COMPONENTS = FORM.components as unknown as Record<string, any>[];
const find = (id: string) => COMPONENTS.find((c) => c.id === id)!;
const region = (kind: string, text?: string) => {
  const it = (geometry.items as Item[]).find((i) => i.kind === kind && i.x >= 0 && (!text || i.text.includes(text)));
  return it ? { x: it.x, y: it.y, w: it.w, h: it.h } : { x: 24, y: 400, w: 342, h: 60 };
};
const CARDS: Card[] = [
  { id: "send", type: "Surface", prop: `intent: ${q(FORM.surface.intent)}`, from: { x: 0, y: SURFACE_TOP, w: 390, h: 60 }, col: 0, row: 1.5 },
  { id: "form", type: "Form", prop: `pattern: ${q(FORM.surface.pattern)} · submit: ${q(find("form").submit.label)}`, from: { x: 24, y: 240, w: 342, h: 520 }, col: 1, row: 1.5 },
  { id: "recipient", type: "Choice", prop: `label: ${q(find("recipient").label)}`, from: region("option", "Priya"), col: 2, row: 0 },
  { id: "amount", type: "TextInput", prop: `kind: ${q(find("amount").kind)} · currency: ${q(find("amount").currency)}`, from: region("label", "Amount"), col: 2, row: 1 },
  { id: "reference", type: "TextInput", prop: `help: ${q(find("reference").help)}`, from: region("label", "Reference"), col: 2, row: 2 },
  { id: "fee-details", type: "DetailList", prop: `variant: ${q(find("fee-details").variant)} · items: ${find("fee-details").items.length}`, from: region("button", "Continue"), col: 2, row: 3 },
];

/** The thirteen tokens that fly in: real `--pxd-*` names from the packs' contract. */
const TOKENS = [
  "--pxd-color-action-primary-background",
  "--pxd-radius-control",
  "--pxd-type-title-page-size",
  "--pxd-color-surface-default",
  "--pxd-space-inset-comfortable",
  "--pxd-type-body-default-family",
  "--pxd-color-border-default",
  "--pxd-size-target-min",
  "--pxd-shadow-raised",
  "--pxd-color-text-muted",
  "--pxd-type-label-default-weight",
  "--pxd-focus-ring-width",
  "--pxd-motion-duration-short",
];

/** The packs in the order they land, with the scene second each one arrives and the face it really sets. */
export const FLIPS: { key: string; name: string; at: number; swarm: number; count: number; face: string }[] = [
  { key: "carbon", name: "Carbon", at: 4.2, swarm: 3.6, count: 13, face: "IBM Plex Sans" },
  { key: "polaris", name: "Polaris", at: 5.6, swarm: 5.0, count: 13, face: "Inter" },
  { key: "govuk", name: "GOV.UK", at: 6.8, swarm: 6.2, count: 13, face: "GDS Transport" },
  { key: "shadcn", name: "shadcn/ui", at: 7.9, swarm: 7.55, count: 6, face: "system-ui" },
  { key: "fluent", name: "Fluent", at: 8.4, swarm: 8.1, count: 6, face: "Segoe UI" },
  { key: "spectrum", name: "Spectrum", at: 8.9, swarm: 8.6, count: 6, face: "Adobe Clean" },
  { key: "sketch", name: "Sketch", at: 9.5, swarm: 9.1, count: 13, face: "Caveat · Nunito" },
  { key: "wireframe", name: "Wireframe", at: 10.8, swarm: 10.35, count: 13, face: "system-ui" },
];

/** A token chip flying in on a curve from an edge to a point, fading as it lands. */
function Swarm({ at, count, target, spread }: { at: number; count: number; target: { x: number; y: number }; spread: number }) {
  const frame = useCurrentFrame();
  const { w, h } = useLayout();
  const t = frame - s(at);
  if (t < -1 || t > s(0.75)) return null;
  return (
    <>
      {TOKENS.slice(0, count).map((name, i) => {
        const p = rise(frame, s(at) + i * 0.7, 15);
        if (p <= 0 || p >= 1) return null;
        const side = i % 4;
        const k = (i / count) * 2 - 1;
        const from = side === 0 ? { x: -320, y: h * 0.5 + k * h * 0.4 } : side === 1 ? { x: w + 40, y: h * 0.5 + k * h * 0.4 } : side === 2 ? { x: w * 0.5 + k * w * 0.4, y: -60 } : { x: w * 0.5 + k * w * 0.4, y: h + 30 };
        const to = { x: target.x + noise(i, 3) * spread, y: target.y + noise(i, 5) * spread * 1.4 };
        const cx = (from.x + to.x) / 2 + (to.y - from.y) * 0.35;
        const cy = (from.y + to.y) / 2 - (to.x - from.x) * 0.35;
        const x = (1 - p) * (1 - p) * from.x + 2 * (1 - p) * p * cx + p * p * to.x;
        const y = (1 - p) * (1 - p) * from.y + 2 * (1 - p) * p * cy + p * p * to.y;
        const fade = p > 0.85 ? (1 - p) / 0.15 : 1;
        return (
          <div key={name} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${1 - 0.35 * p})`, opacity: fade, whiteSpace: "nowrap", fontFamily: MONO, fontSize: 15, color: INK, background: PAPER, border: `1px solid ${INK}`, borderRadius: 5, padding: "5px 9px", boxShadow: "0 8px 22px rgba(20,20,19,.16)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: name.includes("color") ? ACCENT : INK, opacity: name.includes("color") ? 1 : 0.5 }} />
            {name}
          </div>
        );
      })}
    </>
  );
}

/** The whole frame goes hand-drawn: an SVG displacement that changes every third frame. */
function Wobble({ frame, amount = 1 }: { frame: number; amount?: number }) {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={2} seed={Math.floor(frame / 3)} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={4 * amount} />
      </filter>
    </svg>
  );
}

export function Meaning() {
  const frame = useCurrentFrame();
  const { w, h, square } = useLayout();
  const width = square ? 330 : 400;
  const height = (width * 844) / 390;
  const bezel = Math.round(width * 0.028);
  const phoneX = square ? 60 : 360;
  const phoneY = (h - height) / 2 - bezel;

  // 1 · The screen lifts off the phone and lays flat as a small card at the left.
  const lift = rise(frame, s(0.1), 16);
  const flatW = square ? 150 : 220;
  const flatX = square ? 60 : 200;
  const flatY = square ? 160 : h / 2 - (flatW * 844) / 390 / 2;
  const kx = (flatW / width - 1) * lift;
  const shell = 1 - rise(frame, 0, 8);
  const screenOpacity = fall(frame, s(1.5), 10);

  // 2 · It unfolds into its JSON: cards fly from where their component sits on the screen to a tree.
  const cardW = square ? 250 : 320;
  const cardH = square ? 82 : 92;
  const colX = square ? [60, 60, 400] : [flatX + 110, 640, 1000];
  const rowTop = (row: number) => (square ? 120 + row * (cardH + 22) : 190 + row * (cardH + 42));
  const slot = (c: Card) => (square && c.col < 2 ? { x: colX[c.col], y: c.col === 0 ? 560 : 680 } : { x: colX[c.col], y: rowTop(c.row) });
  const unfold = (i: number) => rise(frame, s(0.45) + i * 4, 16);
  const treeGone = fall(frame, s(FLIPS[0].at), 5);

  // 3 · The swarm hits, the tree re-forms as the real renderer, pack after pack.
  const surfW = square ? 360 : 390;
  const surfScale = square ? 0.78 : 0.92;
  const surfX = square ? (w - surfW * surfScale) / 2 + 150 : w / 2 - (surfW * surfScale) / 2 - 40;
  const surfH = 1000;
  const surfY = square ? 290 : (h - surfH * surfScale) / 2;
  const current = FLIPS.filter((f) => frame >= s(f.at)).at(-1);
  const isSketch = current?.key === "sketch";
  const wob = isSketch ? noise(1, Math.floor(frame / 3)) * 0.35 : 0;
  const labelX = square ? 50 : surfX + surfW * surfScale + 120;
  const data = useMemo(() => formData("p_priya", 40, "Dinner", true), []);

  return (
    <Scene>
      <Wobble frame={frame} amount={isSketch ? 1 : 0} />
      <AbsoluteFill style={{ filter: isSketch ? "url(#wobble)" : undefined, transform: isSketch ? `rotate(${wob}deg)` : undefined }}>
        {/* The phone, losing its shell */}
        {screenOpacity > 0 && (
          <div style={{ position: "absolute", left: phoneX + (flatX - phoneX) * lift, top: phoneY + (flatY - phoneY) * lift, transform: `perspective(1400px) rotateX(${lift * 14}deg) scale(${1 + kx})`, transformOrigin: "0 0", opacity: screenOpacity }}>
            <Phone width={width} shell={shell}>
              <Still name="halden-form" width={width} height={height} />
            </Phone>
          </div>
        )}

        {/* The tree: hairlines first, then the cards */}
        {treeGone > 0 && (
          <div style={{ position: "absolute", inset: 0, opacity: treeGone }}>
            <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
              {CARDS.slice(1).map((c, i) => {
                const parent = CARDS[c.col === 1 ? 0 : 1];
                const a = slot(parent);
                const b = slot(c);
                const x1 = a.x + cardW;
                const y1 = a.y + cardH / 2;
                const x2 = b.x;
                const y2 = b.y + cardH / 2;
                const mx = (x1 + x2) / 2;
                const d = square && c.col < 2 ? `M${a.x + cardW / 2} ${a.y + cardH} L${a.x + cardW / 2} ${b.y}` : `M${x1} ${y1} L${mx} ${y1} L${mx} ${y2} L${x2} ${y2}`;
                const t = rise(frame, s(0.7) + (i + 1) * 4, 14);
                return <path key={c.id} d={d} fill="none" stroke={INK} strokeWidth={1} opacity={0.55} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />;
              })}
            </svg>
            {CARDS.map((c, i) => {
              const u = unfold(i);
              const to = slot(c);
              const from = { x: flatX + (c.from.x / 390) * flatW, y: flatY + (c.from.y / 844) * flatW * (844 / 390), w: (c.from.w / 390) * flatW, h: (c.from.h / 844) * flatW * (844 / 390) };
              const x = from.x + (to.x - from.x) * u;
              const y = from.y + (to.y - from.y) * u;
              const cw = from.w + (cardW - from.w) * u;
              const chh = from.h + (cardH - from.h) * u;
              return (
                <div key={c.id} style={{ position: "absolute", left: x, top: y, width: cw, height: chh, boxSizing: "border-box", background: "#fbf9f4", border: `1px solid ${INK}`, borderRadius: 8 + 4 * u, padding: `${12 * u}px ${16 * u}px`, overflow: "hidden", opacity: Math.min(1, u * 3), boxShadow: `0 ${12 * u}px ${30 * u}px rgba(20,20,19,.12)` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", opacity: rise(frame, s(0.45) + i * 4 + 10, 8), whiteSpace: "nowrap" }}>
                    <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: square ? 18 : 22, color: INK }}>{c.type}</span>
                    <span style={{ fontFamily: MONO, fontSize: 14, color: MUTED }}>#{c.id}</span>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: square ? 13 : 15, color: MUTED, marginTop: 8, whiteSpace: "nowrap", opacity: rise(frame, s(0.45) + i * 4 + 14, 8) }}>{c.prop}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* The real renderer, one pack at a time */}
        {FLIPS.map((f, i) => {
          const next = FLIPS[i + 1];
          const inAt = s(f.at);
          const outAt = next ? s(next.at) : s(99);
          if (frame < inAt - 1 || frame >= outAt) return null;
          const t = rise(frame, inAt, 9);
          return (
            <div key={f.key} style={{ position: "absolute", left: surfX, top: surfY, opacity: t, transform: `scale(${surfScale * (0.97 + 0.03 * t)})`, transformOrigin: "0 0", filter: f.key === "wireframe" ? "grayscale(1)" : undefined }}>
              <div style={{ boxShadow: f.key === "sketch" || f.key === "wireframe" ? "none" : "0 30px 80px rgba(20,20,19,.18)", outline: f.key === "wireframe" ? `2px dashed ${GRAPHITE}` : undefined, outlineOffset: 10 }}>
                <Surface theme={f.key} width={surfW} data={data} />
              </div>
            </div>
          );
        })}

        {/* The pack's name, and for Sketch a handwritten one */}
        {current && (
          <div style={{ position: "absolute", left: labelX, top: square ? 60 : h / 2 - 90, width: square ? w - 100 : w - labelX - 100 }}>
            {isSketch ? (
              <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: square ? 64 : 104, color: GRAPHITE, transform: "rotate(-3deg)", lineHeight: 1 }}>
                sketch
                <div style={{ fontSize: square ? 34 : 60, marginTop: 6 }}>{square ? "hand-drawn" : "hand-drawn, wobbly on purpose"}</div>
                <svg width={square ? 320 : 520} height={22} viewBox="0 0 520 22" style={{ display: "block", marginTop: 4 }}>
                  <path d={`M4 ${12 + noise(1, Math.floor(frame / 3))} C120 ${4 + noise(2, Math.floor(frame / 3)) * 3} 260 ${20 + noise(3, Math.floor(frame / 3)) * 3} 516 ${10 + noise(4, Math.floor(frame / 3)) * 2}`} fill="none" stroke={GRAPHITE} strokeWidth={2.2} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - rise(frame, s(current.at) + 6, 12)} />
                </svg>
              </div>
            ) : (
              <div key={current.key} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: square ? 72 : 104, letterSpacing: "-0.035em", lineHeight: 1, color: INK, opacity: rise(frame, s(current.at), 8) }}>
                {current.name}
              </div>
            )}
            <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 17, color: MUTED, opacity: rise(frame, s(current.at) + 4, 8) }}>--pxd-type-body-default-family: {current.face}</div>
            <Label style={{ marginTop: 10, opacity: rise(frame, s(current.at) + 6, 8) }}>{`${String(FLIPS.indexOf(current) + 2).padStart(2, "0")} / 13 · real tokens`}</Label>
          </div>
        )}

        {FLIPS.map((f) => (
          <Swarm key={f.key} at={f.swarm} count={f.count} target={{ x: surfX + (surfW * surfScale) / 2, y: surfY + 450 * surfScale }} spread={square ? 90 : 150} />
        ))}
      </AbsoluteFill>

      <div style={{ position: "absolute", left: square ? 60 : 160, bottom: square ? 56 : 96, width: square ? 960 : 720 }}>
        <Caption id="meaning" base={18} />
        <Caption id="packs" base={18} style={{ position: "absolute", left: 0, bottom: 0 }} />
      </div>
    </Scene>
  );
}
