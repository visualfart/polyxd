/**
 * 0:00–0:12. The hook (five dead ends on five fake apps, a bubble that never resolves), the line
 * typed at reading speed, the fold-away, and the mark that blinks and looks toward the ask box.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ACCENT, INK, Mark, MUTED, PAPER, STATES, blinkAt } from "../brand.tsx";
import { line } from "../script.ts";
import { Caret, DISPLAY, MONO, Scene, Small, TEXT, between, fall, rise, s, typed, useLayout } from "../ui.tsx";

/* ─── The hook · 0:00–0:03 ─── */

/** Five fake apps, none of them real: a name, a plain look, and the line everyone knows. */
function Ledger({ w, h }: { w: number; h: number }) {
  const side = Math.min(240, w * 0.16);
  return (
    <div style={{ width: w, height: h, background: "#fff", display: "flex", fontFamily: "Helvetica Neue, Arial, sans-serif", color: "#1f2937" }}>
      <div style={{ width: side, background: "#f3f4f6", borderRight: "1px solid #e5e7eb", padding: 22, fontSize: 15 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 26 }}>Ledger</div>
        {["Invoices", "Customers", "Reports", "Settings"].map((t, i) => (
          <div key={t} style={{ padding: "8px 10px", borderRadius: 6, background: i === 2 ? "#e5e7eb" : "transparent", marginBottom: 2 }}>{t}</div>
        ))}
      </div>
      <div style={{ flex: 1, padding: 32 }}>
        <div style={{ height: 40, border: "1px solid #d1d5db", borderRadius: 6, padding: "9px 12px", fontSize: 15, color: "#6b7280", width: "60%" }}>invoices unpaid over 60 days by region</div>
        <div style={{ marginTop: h * 0.2, textAlign: "center", fontSize: 52, fontWeight: 700 }}>No results.</div>
        <div style={{ textAlign: "center", fontSize: 16, color: "#6b7280", marginTop: 12 }}>Try a different search.</div>
      </div>
    </div>
  );
}
function Tidings({ w, h }: { w: number; h: number }) {
  return (
    <div style={{ width: w, height: h, background: "#eef2f7", fontFamily: "Georgia, 'Times New Roman', serif", color: "#243447", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: Math.min(560, w - 80), background: "#fff", borderRadius: 4, boxShadow: "0 2px 12px rgba(0,0,0,.08)", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "#7b8794", fontFamily: "Arial, sans-serif" }}>Tidings</div>
        <div style={{ fontSize: 34, marginTop: 22, lineHeight: 1.2 }}>That feature is coming soon.</div>
        <div style={{ display: "inline-block", marginTop: 26, padding: "10px 22px", border: "1px solid #243447", fontFamily: "Arial, sans-serif", fontSize: 14 }}>Notify me</div>
      </div>
    </div>
  );
}
function Pilot({ w, h }: { w: number; h: number }) {
  return (
    <div style={{ width: w, height: h, background: "#111827", fontFamily: "Inter, system-ui, sans-serif", color: "#e5e7eb", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 40 }}>
      <div style={{ fontSize: 14, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>Pilot · assistant</div>
      <div style={{ alignSelf: "flex-start", background: "#1f2937", padding: "14px 18px", borderRadius: "18px 18px 18px 4px", fontSize: 22, maxWidth: 620, color: "#9ca3af" }}>Hi! Ask me anything about your account.</div>
      <div style={{ alignSelf: "flex-end", background: "#2563eb", color: "#fff", padding: "14px 18px", borderRadius: "18px 18px 4px 18px", fontSize: 22, marginTop: 16, maxWidth: 620 }}>change the address on my account</div>
      <div style={{ alignSelf: "flex-start", background: "#1f2937", padding: "14px 18px", borderRadius: "18px 18px 18px 4px", fontSize: 30, marginTop: 16, maxWidth: 640, fontWeight: 600 }}>I can't help with that here.</div>
      <div style={{ marginTop: 28, height: 48, borderRadius: 24, background: "#1f2937", display: "flex", alignItems: "center", padding: "0 18px", color: "#6b7280", fontSize: 15 }}>Message Pilot</div>
    </div>
  );
}
function Meridian({ w, h }: { w: number; h: number }) {
  return (
    <div style={{ width: w, height: h, background: "#fbf8f1", fontFamily: "Verdana, Geneva, sans-serif", color: "#2b2b2b", padding: 48 }}>
      <div style={{ fontSize: 14, color: "#8a7f6a" }}>Meridian Help Centre › Billing › Refunds</div>
      <div style={{ fontSize: 30, fontWeight: 700, marginTop: 30, lineHeight: 1.3 }}>Can I get a refund for a duplicate charge?</div>
      <div style={{ fontSize: 22, lineHeight: 1.7, marginTop: 24, maxWidth: 900 }}>Duplicate charges can't be reversed from your account page. <u style={{ color: "#8a5a00", fontWeight: 700 }}>Please contact support.</u> Include the transaction reference and the last four digits of the card.</div>
      <div style={{ fontSize: 14, color: "#8a7f6a", marginTop: 30 }}>Was this article helpful? &nbsp; Yes &nbsp; No</div>
    </div>
  );
}
function Orbit({ w, h }: { w: number; h: number }) {
  const pw = Math.min(300, h * 0.44);
  return (
    <div style={{ width: w, height: h, background: "#d9dde3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, 'SF Pro', Roboto, sans-serif", color: "#111" }}>
      <div style={{ width: pw, height: pw * 1.9, background: "#fff", borderRadius: 32, boxShadow: "0 24px 60px rgba(0,0,0,.18)", padding: 24, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
        <div style={{ fontWeight: 700, fontSize: 20 }}>Orbit</div>
        <div style={{ marginTop: 18, height: 10, borderRadius: 5, background: "#eee", width: "70%" }} />
        <div style={{ marginTop: 10, height: 10, borderRadius: 5, background: "#eee", width: "50%" }} />
        <div style={{ margin: "auto 0", padding: 18, background: "#f3f4f6", borderRadius: 14, fontSize: 19, fontWeight: 600, lineHeight: 1.3 }}>
          Try the desktop version.
          <div style={{ fontSize: 13, fontWeight: 400, color: "#666", marginTop: 8 }}>Bulk export isn't available on mobile.</div>
        </div>
      </div>
    </div>
  );
}
/** The last one: a bubble typing "…" that never resolves. */
function Bubble({ w, h, frame }: { w: number; h: number; frame: number }) {
  const step = Math.floor(frame / 6) % 3;
  return (
    <div style={{ width: w, height: h, background: "#e9e9eb", fontFamily: "-apple-system, 'SF Pro', Roboto, sans-serif", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 48 }}>
      <div style={{ alignSelf: "flex-start", background: "#fff", color: "#111", padding: "14px 20px", borderRadius: 22, fontSize: 24, maxWidth: 620 }}>Thanks for reaching out. How can we help today?</div>
      <div style={{ alignSelf: "flex-end", background: "#34c759", color: "#fff", padding: "14px 20px", borderRadius: 22, fontSize: 24, maxWidth: 680, marginTop: 16 }}>can you show me the accounts renewing this month with open tickets?</div>
      <div style={{ alignSelf: "flex-start", background: "#fff", padding: "20px 24px", borderRadius: 22, marginTop: 16, display: "flex", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 16, height: 16, borderRadius: 16, background: i === step ? "#8e8e93" : "#c7c7cc" }} />
        ))}
      </div>
    </div>
  );
}

export function Hook() {
  const frame = useCurrentFrame();
  const { w, h, square } = useLayout();
  const cw = square ? w - 80 : Math.round(w * 0.74);
  const ch = square ? Math.round(cw * 0.72) : Math.round(h * 0.62);
  const cuts = [Ledger, Tidings, Pilot, Meridian, Orbit];
  return (
    <Scene background={INK}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        {cuts.map((C, i) =>
          between(frame, s(i * 0.4), s(i * 0.4 + 0.4)) ? (
            <div key={i} style={{ width: cw, height: ch, overflow: "hidden", borderRadius: 6 }}>
              <C w={cw} h={ch} />
            </div>
          ) : null,
        )}
        {frame >= s(2.0) && (
          <div style={{ width: cw, height: ch, overflow: "hidden", borderRadius: 6 }}>
            <Bubble w={cw} h={ch} frame={frame - s(2.0)} />
          </div>
        )}
      </AbsoluteFill>
    </Scene>
  );
}

/* ─── The line · 0:03–0:07 ─── */
export function TheLine() {
  const frame = useCurrentFrame();
  const { w, square } = useLayout();
  const l1 = line("line-1").text;
  const l2 = line("line-2").text;
  const t1 = typed(frame, s(0.2), l1, 0.064);
  const t2 = typed(frame, s(2.4), l2, 0.06);
  const size = square ? 68 : 96;
  const pad = square ? 72 : 160;
  return (
    <Scene>
      <div style={{ position: "absolute", left: pad, right: pad, top: "50%", transform: "translateY(-50%)", fontFamily: DISPLAY, fontWeight: 800, fontSize: size, letterSpacing: "-0.035em", lineHeight: 1.04, color: INK }}>
        <div style={{ minHeight: size * 2.1 }}>
          {t1}
          {t1.length < l1.length && <Caret height={size * 0.8} />}
        </div>
        <div style={{ color: ACCENT, marginTop: size * 0.3, minHeight: size * 1.05 }}>
          {frame >= s(2.4) && t2}
          {frame >= s(2.4) && t2.length < l2.length && <Caret height={size * 0.8} color={ACCENT} />}
        </div>
      </div>
    </Scene>
  );
}

/* ─── The reversal · 0:07–0:12 ─── */
export function Reversal() {
  const frame = useCurrentFrame();
  const { w, h, square } = useLayout();
  const size = square ? 68 : 96;
  const pad = square ? 72 : 160;
  // The two lines fold away like paper: hinged at the top, turning up and out of view.
  const fold = rise(frame, 0, 14);
  const markIn = rise(frame, s(0.4), 10);
  const { pupil, blink } = blinkAt(frame, s(1.1), 8);
  const look = rise(frame, s(1.7), 9);
  const at = { x: 16 + (STATES.looking.x - 16) * look, y: 16 + (STATES.looking.y - 16 - 0.9) * look };
  const boxIn = rise(frame, s(1.6), 15);
  const mark = square ? 150 : 200;
  const boxW = square ? w - pad * 2 : 900;
  const boxH = square ? 84 : 96;
  const ask = line("ask").text;
  const t = typed(frame, s(2.3), ask, 0.068);
  const returned = frame >= s(4.5);
  // The mark shifts right to make room as the box arrives; on the square cut the box sits under it.
  const markX = square ? w / 2 - mark / 2 : w / 2 - mark / 2 + boxIn * (w / 2 - pad - boxW / 2 + 60);
  const markY = square ? h / 2 - mark / 2 - 120 : h / 2 - mark / 2;
  const boxX = square ? pad : pad - (1 - boxIn) * (boxW + pad);
  const boxY = square ? h / 2 + 40 : h / 2 - boxH / 2;
  const small = rise(frame, s(2.6), 10);
  return (
    <Scene>
      {fold < 1 && (
        <div style={{ position: "absolute", left: pad, right: pad, top: "50%", transform: `translateY(-50%) perspective(1600px) rotateX(${fold * 92}deg)`, transformOrigin: "50% 0%", opacity: 1 - fold * 0.7, fontFamily: DISPLAY, fontWeight: 800, fontSize: size, letterSpacing: "-0.035em", lineHeight: 1.04, color: INK }}>
          <div style={{ minHeight: size * 2.1 }}>{line("line-1").text}</div>
          <div style={{ color: ACCENT, marginTop: size * 0.3 }}>{line("line-2").text}</div>
        </div>
      )}
      <div style={{ position: "absolute", left: markX, top: markY, opacity: markIn, transform: `scale(${0.96 + 0.04 * markIn})` }}>
        <Mark size={mark} pupil={pupil} at={at} blink={blink} />
      </div>
      {boxIn > 0 && (
        <div style={{ position: "absolute", left: boxX, top: boxY, width: boxW, height: boxH, opacity: square ? boxIn : 1, boxSizing: "border-box", border: `2px solid ${returned ? INK : "rgba(20,20,19,.55)"}`, borderRadius: boxH / 2, background: "#fbf9f4", display: "flex", alignItems: "center", padding: `0 ${boxH * 0.4}px`, gap: 18, fontFamily: TEXT, fontSize: square ? 30 : 36, color: INK, boxShadow: "0 18px 50px rgba(20,20,19,.12)" }}>
          <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>Ask</span>
          <span>
            {t}
            {!returned && <Caret height={square ? 30 : 36} color={ACCENT} />}
          </span>
        </div>
      )}
      <Small style={{ position: "absolute", left: pad, bottom: square ? 64 : 80, opacity: small, transform: `translateY(${(1 - small) * 10}px)` }}>{line("halden").text}</Small>
    </Scene>
  );
}
