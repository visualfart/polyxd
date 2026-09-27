/**
 * 0:30–0:48. Checked: the scan line with ticks beside each control, the 13 × 2 × 2 grid of real
 * renders ticking in a wave, the real Checked mark and its Report. Then people and agents: the
 * real screen beside its accessibility tree, a pointer and a highlight moving together, then the
 * agent alone by name.
 */
import { useMemo, useState } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { ACCENT, INK, MUTED, PAPER } from "../brand.tsx";
import { Caption, Clip, Label, MONO, Pointer, Scene, TEXT, Window, between, fall, rise, s, useLayout } from "../ui.tsx";
import { CONFIRM, CONFIRM_DATA, FORM_PARTS, PACKS, Surface, formData, type Measured } from "../surface.tsx";
import a11y from "../../assets/halden-a11y.json";

const OK = "#1f7a3f";

/* ─── 0:30–0:40 · Checked ─── */
const CHECKS: [string, string, string][] = [
  ["title", "reading order", "h1 first"],
  ["recipient", "label", "named"],
  ["amount", "target size", "44px"],
  ["reference", "contrast", "4.5:1"],
  ["details", "reading order", "ok"],
  ["continue", "target size", "44px"],
];
const GRID_AT = 2.4;
const WAVE_AT = 3.6;
const REAL_AT = 7.0;

export function Checked() {
  const frame = useCurrentFrame();
  const { w, h, square } = useLayout();
  const [m, setM] = useState<Measured>({});
  const data = useMemo(() => formData("p_priya", 40, "Dinner", true), []);
  // The surface where Meaning left it (the same maths), so the snap back to Material 3 is a hard cut in place.
  const surfW = square ? 360 : 390;
  const surfScale = square ? 0.78 : 0.92;
  const surfX = square ? (w - surfW * surfScale) / 2 + 150 : w / 2 - (surfW * surfScale) / 2 - 40;
  const surfY = square ? 290 : (h - 1000 * surfScale) / 2;
  const surfH = m.root?.h ?? 900;

  // The scan: from the top of the surface to its bottom over 1.7 s.
  const scan = rise(frame, s(0.3), s(1.7));
  const scanY = surfY + scan * surfH * surfScale;
  const scanOn = between(frame, s(0.3), s(2.1));

  // The grid: 13 columns × 4 rows (light phone, dark phone, light desktop, dark desktop).
  const gridIn = rise(frame, s(GRID_AT), 12);
  const cols = 13;
  const gx = square ? 40 : 90;
  const gy = square ? 150 : 70;
  const cellW = (w - gx * 2) / cols;
  const cellH = square ? 150 : 196;
  const phoneK = (cellW - 12) / 390;
  const deskK = (cellW - 12) / 760;
  const single = fall(frame, s(GRID_AT) + 12, 12);
  // The single surface travels to its cell (material3, light, phone) as the grid rises.
  const homeX = gx + 6;
  const homeY = gy + 4;
  const travel = rise(frame, s(GRID_AT), 12);
  const real = frame >= s(REAL_AT);
  const winW = square ? 1000 : 1280;
  const winH = winW * (800 / 1280);

  return (
    <Scene>
      {!real && (
        <>
          {/* The one surface: in place until the grid, then travelling to its cell */}
          {single > 0 && (
            <div style={{ position: "absolute", left: surfX + (homeX - surfX) * travel, top: surfY + (homeY - surfY) * travel, transform: `scale(${surfScale + (phoneK - surfScale) * travel})`, transformOrigin: "0 0", opacity: single }}>
              <div style={{ boxShadow: "0 30px 80px rgba(20,20,19,.18)" }}>
                <Surface theme="material3" width={surfW} data={data} measure={FORM_PARTS} onMeasure={setM} />
              </div>
              {/* The scan line, in the surface's own coordinates */}
              {scanOn && (
                <div style={{ position: "absolute", left: -20, width: surfW + 40, top: scan * surfH, height: 2, background: ACCENT, boxShadow: `0 0 0 0.5px ${ACCENT}` }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: 2, height: 36, background: "linear-gradient(rgba(255,90,31,.14), rgba(255,90,31,0))" }} />
                </div>
              )}
            </div>
          )}
          {/* Ticks beside each control as the scan passes it */}
          {single > 0 &&
            CHECKS.map(([part, label, value]) => {
              const r = m[part];
              if (!r) return null;
              const y = surfY + (r.y + r.h / 2) * surfScale;
              const on = scanY >= surfY + r.y * surfScale;
              const t = on ? rise(frame, frame - 1, 0) : 0;
              const appear = on ? 1 : 0;
              const x = surfX + surfW * surfScale + 28;
              return (
                <div key={part} style={{ position: "absolute", left: x, top: y - 15, opacity: appear * single, transform: `translateX(${(1 - t) * 8}px)`, display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 16, color: INK, whiteSpace: "nowrap" }}>
                  <div style={{ width: 22, height: 1, background: INK, opacity: 0.5, marginLeft: -22 }} />
                  <span style={{ width: 20, height: 20, borderRadius: 10, background: OK, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</span>
                  {label}
                  <span style={{ color: MUTED, marginLeft: 4 }}>{value}</span>
                </div>
              );
            })}
          {/* The grid */}
          {gridIn > 0 &&
            PACKS.map((p, c) =>
              [0, 1, 2, 3].map((r) => {
                const first = c === 0 && r === 0;
                const dark = r % 2 === 1;
                const desk = r >= 2;
                const x = gx + c * cellW + 6;
                const y = gy + r * cellH + 4;
                const d = Math.hypot(c, r * 1.6);
                const cellIn = rise(frame, s(GRID_AT) + 4 + d * 1.4, 10);
                const tick = rise(frame, s(WAVE_AT) + (c + r * 0.5) * 3.2, 5);
                return (
                  <div key={`${p.key}-${r}`} style={{ position: "absolute", left: x, top: y, width: cellW - 12, height: cellH - 8, opacity: first ? Math.max(gridIn, 1 - single) : cellIn, transform: `translateY(${(1 - cellIn) * 10}px)` }}>
                    <div style={{ width: cellW - 12, height: cellH - 8, overflow: "hidden", borderRadius: 4, background: dark ? "#111" : "#fff", boxShadow: "0 6px 18px rgba(20,20,19,.14)", position: "relative" }}>
                      <div style={{ transform: `scale(${desk ? deskK : phoneK})`, transformOrigin: "0 0" }}>
                        <Surface theme={p.key} mode={dark ? "dark" : "light"} width={desk ? 760 : 390} data={data} />
                      </div>
                      {tick > 0 && (
                        <div style={{ position: "absolute", right: 5, top: 5, width: 18, height: 18, borderRadius: 9, background: OK, color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.7 + 0.3 * tick})`, opacity: tick }}>✓</div>
                      )}
                    </div>
                  </div>
                );
              }),
            )}
          {gridIn > 0 && (
            <div style={{ position: "absolute", left: gx, top: gy + 4 * cellH + 6, display: "flex", gap: 28, opacity: gridIn }}>
              <Label>13 design systems</Label>
              <Label>light · dark</Label>
              <Label>phone · desktop</Label>
              <Label color={OK}>{Math.min(52, Math.max(0, Math.floor((frame - s(WAVE_AT)) / 3.2 * 1.9)))} / 52 verified</Label>
            </div>
          )}
        </>
      )}
      {real && (
        <div style={{ position: "absolute", left: (w - winW) / 2, top: (h - winH) / 2 - 20 }}>
          <Window width={winW} dark>
            <Sequence from={s(REAL_AT)} layout="none">
              <Clip name="foundry-filter" from={13.9} rate={1.3} width={winW} height={winH} />
            </Sequence>
          </Window>
          <Label style={{ marginTop: 22 }}>Foundry · the Checked mark · Report</Label>
        </div>
      )}
      <div style={{ position: "absolute", left: square ? 60 : 160, bottom: square ? 20 : 40, width: square ? 960 : 1000 }}>
        <Caption id="verified" base={30} width={square ? 960 : 1000} size={square ? 24 : 30} />
      </div>
    </Scene>
  );
}

/* ─── 0:40–0:48 · People and agents ─── */

interface A11yLine {
  depth: number;
  role: string;
  name: string;
  state: string;
  value: string;
}
/** Playwright's ARIA snapshot line → role · name · state · value. */
function parse(lines: string[]): A11yLine[] {
  const out: A11yLine[] = [];
  for (const raw of lines) {
    const m = /^(\s*)- (\/?[a-z]+)(?: "([^"]*)")?(?: \[([^\]]*)\])?(?::\s*(.*))?$/.exec(raw);
    if (!m || m[2].startsWith("/")) continue;
    const [, indent, role, name = "", state = "", value = ""] = m;
    const prev = out.at(-1);
    if (role === "text" && prev && prev.role === "textbox" && indent.length / 2 > prev.depth) {
      prev.value = value.replace(/^"|"$/g, "");
      continue;
    }
    // A text node's words are its value; keep them as the name.
    out.push({ depth: indent.length / 2, role, name: name || (role === "text" || role === "paragraph" || role === "term" || role === "definition" ? value.replace(/^"|"$/g, "") : ""), state: state.replace(/level=\d/, "").trim(), value: name ? value.replace(/^"|"$/g, "") : "" });
  }
  return out;
}
const FORM_LINES = parse(a11y.form);
const CONFIRM_LINES = parse(a11y.confirm);

type Step = "form-0" | "form-1" | "form-4" | "form-40" | "confirm";
const stepData = (step: Step) => (step === "form-0" ? formData(null, null) : step === "form-1" ? formData("p_priya", null) : step === "form-4" ? formData("p_priya", 4) : formData("p_priya", 40));

/** The pointer's path: where it is at a scene second, from where the real controls were measured. */
function pointerAt(t: number, m: Measured, k: number, ox: number, oy: number) {
  const centre = (part: string, dx = 0.5, dy = 0.5) => {
    const r = m[part];
    return r ? { x: ox + (r.x + r.w * dx) * k, y: oy + (r.y + r.h * dy) * k } : { x: ox + 100 * k, y: oy + 600 * k };
  };
  const start = { x: ox + 200 * k, y: oy + 980 * k };
  const priya = centre("priya", 0.5, 0.4);
  const amount = centre("amountInput", 0.6, 0.5);
  const cont = centre("continue");
  const legs: [number, number, { x: number; y: number }, { x: number; y: number }][] = [
    [1.2, 1.8, start, priya],
    [2.4, 2.9, priya, amount],
    [4.0, 4.5, amount, cont],
  ];
  let p = start;
  for (const [a, b, from, to] of legs) {
    if (t < a) break;
    const u = Math.min(1, (t - a) / (b - a));
    const e = u * u * (3 - 2 * u);
    p = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
  }
  return p;
}

export function Agents() {
  const frame = useCurrentFrame();
  const { w, h, square } = useLayout();
  const t = frame / 30;
  const [m, setM] = useState<Measured>({});
  const surfW = 390;
  const k = square ? 0.6 : 0.92;
  const ox = square ? (w - surfW * k) / 2 : 200;
  const oy = square ? 50 : (h - 940 * k) / 2;
  const alone = t >= 5.3;
  // The person's steps, then the agent's.
  const step: Step = alone ? (t >= 6.4 ? "confirm" : t >= 5.9 ? "form-40" : t >= 5.5 ? "form-1" : "form-0") : t >= 4.8 ? "confirm" : t >= 3.5 ? "form-40" : t >= 3.2 ? "form-4" : t >= 1.9 ? "form-1" : "form-0";
  const confirm = step === "confirm";
  const lines = confirm ? CONFIRM_LINES : FORM_LINES;
  const built = alone ? 1 : 1;
  // Which line is lit: the radio, the textbox, the button; on the confirm, its dialog.
  const lit = confirm ? (l: A11yLine) => l.role === "alertdialog" : alone ? (l: A11yLine) => (t >= 6.3 ? l.role === "button" && l.name === "Continue" : t >= 5.9 ? l.role === "textbox" && l.name === "Amount" : t >= 5.5 ? l.role === "radio" && l.name === "Priya Raman" : false) : (l: A11yLine) => (t >= 4.6 ? l.role === "button" && l.name === "Continue" : t >= 3.0 ? l.role === "textbox" && l.name === "Amount" : t >= 1.9 ? l.role === "radio" && l.name === "Priya Raman" : false);
  const pointerOn = !alone && t >= 1.2 && t < 5.0;
  const press = !alone ? Math.max(rise(frame, s(1.9), 3) * fall(frame, s(2.1), 3), rise(frame, s(3.0), 3) * fall(frame, s(3.2), 3), rise(frame, s(4.6), 3) * fall(frame, s(4.8), 3)) : 0;
  const p = pointerAt(t, m, k, ox, oy);
  const panelX = square ? 40 : 1000;
  const panelY = square ? 640 : 100;
  const panelW = square ? w - 80 : 800;
  const lineH = square ? 20 : 30;
  const fontSize = square ? 13 : 19;
  const surfIn = confirm ? rise(frame, s(alone ? 6.4 : 4.8), 8) : 1;

  return (
    <Scene>
      {/* Left: the real screen */}
      <div key={step} style={{ position: "absolute", left: ox, top: oy, transform: `scale(${k})`, transformOrigin: "0 0", opacity: surfIn }}>
        <div style={{ boxShadow: "0 30px 80px rgba(20,20,19,.18)", width: surfW, minHeight: 940, background: "#fef7ff", position: "relative", transform: "translateZ(0)", overflow: "hidden" }}>
          {confirm ? <Surface theme="material3" width={surfW} doc={CONFIRM} data={CONFIRM_DATA} height={940} /> : <Surface theme="material3" width={surfW} data={stepData(step)} measure={FORM_PARTS} onMeasure={setM} />}
        </div>
      </div>
      {pointerOn && <Pointer x={p.x} y={p.y} press={press} />}

      {/* Right: the same screen as its accessibility tree, built from the real DOM */}
      <div style={{ position: "absolute", left: panelX, top: panelY, width: panelW, background: "#ebe7de", borderRadius: 16, padding: square ? "14px 18px" : "22px 26px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: square ? 8 : 14 }}>
          <Label>{alone ? "agent · by name alone" : "accessibility tree · role · name · state"}</Label>
          {alone && t >= 6.6 && <Label color={OK}>done in 1.2 s ✓</Label>}
        </div>
        {lines.slice(0, square ? 13 : 22).map((l, i) => {
          const a = confirm ? rise(frame, s(alone ? 6.4 : 4.8) + i * 1.5, 6) : alone ? 1 : rise(frame, i * 2, 6);
          const on = lit(l);
          const value = l.role === "textbox" && l.name === "Amount" ? (step === "form-4" ? "4" : step === "form-40" || (alone && t >= 5.9) ? "40.00" : "") : l.value;
          const checked = l.role === "radio" && l.name === "Priya Raman" ? (step !== "form-0" ? "checked" : "") : l.state;
          return (
            <div key={`${confirm}-${i}`} style={{ position: "relative", height: lineH, lineHeight: `${lineH}px`, paddingLeft: 14 + l.depth * 22, fontFamily: MONO, fontSize, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: a * built, transform: `translateX(${(1 - a) * 8}px)`, background: on ? "rgba(255,90,31,.14)" : "transparent", borderRadius: 6 }}>
              {on && <span style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 3, background: ACCENT, borderRadius: 2 }} />}
              <span style={{ color: MUTED }}>{l.role}</span>
              {l.name && <span style={{ marginLeft: 10 }}>{l.name}</span>}
              {value && <span style={{ marginLeft: 10, color: MUTED }}>: {value}</span>}
              {checked && <span style={{ marginLeft: 10, color: on ? ACCENT : OK }}>[{checked}]</span>}
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: square ? 40 : 1000, top: square ? 985 : 820, width: square ? 1000 : 800 }}>
        <Caption id="agents" base={40} width={square ? 1000 : 800} size={square ? 26 : undefined} />
        <Caption id="alone" base={40} width={square ? 1000 : 800} size={square ? 26 : undefined} style={{ position: "absolute", top: 0, left: 0 }} />
      </div>
    </Scene>
  );
}
