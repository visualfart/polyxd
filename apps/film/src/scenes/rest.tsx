/**
 * 0:48–1:22. The turn, Studio and Foundry (the frame drawn as a document, then filled in), the
 * four-product montage with three words between, and the close on the mark.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { INK, Lockup, Mark, MUTED, PAPER, blinkAt } from "../brand.tsx";
import { line } from "../script.ts";
import { Arrive, Big, Caption, Caret, Clip, DISPLAY, Label, MONO, Phone, Scene, Small, Window, between, fall, rise, s, typed, useLayout } from "../ui.tsx";
import frame_ from "../../assets/foundry-frame.json";

/* ─── 0:48–0:52 · The turn ─── */
export function Turn() {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const text = line("turn").text;
  const t = typed(frame, s(0.5), text, 0.05);
  const size = square ? 72 : 110;
  const pad = square ? 72 : 160;
  return (
    <Scene>
      <div style={{ position: "absolute", left: pad, right: pad, top: "50%", transform: "translateY(-50%)", fontFamily: DISPLAY, fontWeight: 800, fontSize: size, letterSpacing: "-0.035em", lineHeight: 1.04, color: INK, minHeight: size * 2.2 }}>
        {t}
        {t.length < text.length && frame >= s(0.5) && <Caret height={size * 0.8} />}
      </div>
    </Scene>
  );
}

/* ─── 0:52–1:04 · Generated or authored ─── */
const STUDIO_END = 5.6;
const REGIONS: [keyof typeof frame_, string][] = [
  ["header", "header"],
  ["navigation", "navigation"],
  ["main", "main"],
  ["footer", "footer"],
];

export function Authored() {
  const frame = useCurrentFrame();
  const { w, h, square } = useLayout();
  const winW = square ? 1000 : 1180;
  const winH = winW * (800 / 1280);
  const winX = square ? 40 : w - 140 - winW;
  const winY = square ? 240 : (h - winH) / 2;
  const studio = frame < s(STUDIO_END);
  const k = winW / frame_.viewport.w;
  const drawAt = s(STUDIO_END + 0.1);
  const fill = rise(frame, s(7.0), 12);
  const linesOut = fall(frame, s(7.7), 10);
  const capX = square ? 40 : 160;
  return (
    <Scene>
      <div style={{ position: "absolute", left: winX, top: winY }}>
        {studio ? (
          <Arrive at={0} frames={10}>
            <Window width={winW}>
              <Clip name="studio-editor" from={9.5} rate={1.15} width={winW} height={winH} />
            </Window>
          </Arrive>
        ) : (
          <Window width={winW} dark>
            {fill > 0 && (
              <div style={{ opacity: fill }}>
                <Sequence from={s(7.0)} layout="none">
                  <Clip name="foundry-filter" from={1.2} rate={1.3} width={winW} height={winH} />
                </Sequence>
              </div>
            )}
            {linesOut > 0 && (
              <svg width={winW} height={winH} style={{ position: "absolute", left: 0, top: 0, opacity: linesOut }}>
                {REGIONS.map(([key, label], i) => {
                  const r = frame_[key] as { x: number; y: number; w: number; h: number } | null;
                  if (!r) return null;
                  const x = r.x * k + 4;
                  const y = r.y * k + 4;
                  const rw = Math.min(r.w * k, winW - x) - 8;
                  const rh = Math.min(r.h * k, winH - y) - 8;
                  const t = rise(frame, drawAt + i * 7, 12);
                  return (
                    <g key={key}>
                      <rect x={x} y={y} width={rw} height={rh} rx={6} fill="none" stroke={PAPER} strokeWidth={1} opacity={0.8} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
                      <text x={x + 12} y={y + 24} fill={PAPER} opacity={rise(frame, drawAt + i * 7 + 8, 6) * 0.85} style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </Window>
        )}
        <Label style={{ marginTop: 22 }}>{studio ? "Studio · Screens · the workspace's design system" : "Foundry · the shell, authored as a document · shadcn/ui"}</Label>
      </div>
      <div style={{ position: "absolute", left: capX, top: square ? 60 : h / 2 - 120, width: square ? 1000 : 400 }}>
        <Caption id="studio" base={52} width={square ? 1000 : 400} size={square ? 26 : 30} />
        <Caption id="shell" base={52} width={square ? 1000 : 400} size={square ? 26 : 30} style={{ position: "absolute", top: 0, left: 0 }} />
      </div>
    </Scene>
  );
}

/* ─── 1:04–1:12 · Yours ─── */
const MONTAGE: { at: number; until: number; kind: "clip" | "word"; label?: string; clip?: string; from?: number; rate?: number; phone?: boolean; text?: string }[] = [
  { at: 0.0, until: 1.7, kind: "clip", clip: "quay-dip", from: 3.2, rate: 1.0, label: "Quay · “why did sales drop last week” · Polaris" },
  { at: 1.7, until: 2.1, kind: "word", text: "React" },
  { at: 2.1, until: 3.8, kind: "clip", clip: "wexley-move", from: 4.35, rate: 1.0, label: "Wexley · “I've moved” · GOV.UK" },
  { at: 3.8, until: 4.2, kind: "word", text: "Web Components" },
  { at: 4.2, until: 5.9, kind: "clip", clip: "foundry-filter", from: 8.9, rate: 1.5, label: "Foundry · “accounts renewing with open tickets” · shadcn/ui" },
  { at: 5.9, until: 6.3, kind: "word", text: "your renderer" },
  { at: 6.3, until: 8.0, kind: "clip", clip: "halden-send", from: 8.2, rate: 1.4, phone: true, label: "Halden · “send £40 to Priya for dinner” · Material 3" },
];

export function Yours() {
  const frame = useCurrentFrame();
  const { w, h, square } = useLayout();
  const winW = square ? 1000 : 1240;
  const t = frame / 30;
  const shot = MONTAGE.find((m) => t >= m.at && t < m.until);
  const phoneW = square ? 300 : 380;
  return (
    <Scene>
      {shot?.kind === "clip" && shot.phone && (
        <div style={{ position: "absolute", left: (w - phoneW) / 2 - 12, top: square ? 100 : 40 }}>
          <Phone width={phoneW}>
            <Sequence from={s(shot.at)} layout="none">
              <Clip name={shot.clip!} from={shot.from!} rate={shot.rate} width={phoneW} height={(phoneW * 844) / 390} />
            </Sequence>
          </Phone>
        </div>
      )}
      {shot?.kind === "clip" && !shot.phone && (
        <div style={{ position: "absolute", left: (w - winW) / 2, top: square ? 200 : 80 }}>
          <Window width={winW} ratio={shot.clip === "wexley-move" ? 800 / 1024 : 800 / 1280} dark={shot.clip === "foundry-filter"}>
            <Sequence from={s(shot.at)} layout="none">
              <Clip name={shot.clip!} from={shot.from!} rate={shot.rate} width={winW} height={winW * (shot.clip === "wexley-move" ? 800 / 1024 : 800 / 1280)} />
            </Sequence>
          </Window>
        </div>
      )}
      {shot?.kind === "clip" && <Label style={{ position: "absolute", left: square ? 40 : 160, top: square ? 150 : 40 }}>{shot.label}</Label>}
      {shot?.kind === "word" && (
        <div style={{ position: "absolute", left: square ? 72 : 160, top: "50%", transform: "translateY(-50%)", fontFamily: DISPLAY, fontWeight: 800, fontSize: square ? 96 : 150, letterSpacing: "-0.04em", lineHeight: 1, color: INK }}>{shot.text}</div>
      )}
      <div style={{ position: "absolute", left: square ? 40 : 160, bottom: square ? 40 : 60, width: square ? 1000 : 1200, opacity: shot?.kind === "word" ? 0 : 1 }}>
        <Caption id="yours" base={64} width={1200} />
      </div>
    </Scene>
  );
}

/* ─── 1:12–1:22 · Close ─── */
export function Close() {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const mark = square ? 220 : 260;
  const markIn = rise(frame, s(0.4), 12);
  const { pupil: bp, blink } = blinkAt(frame, s(3.0), 8);
  const wordIn = rise(frame, s(4.0), 16);
  const urlIn = rise(frame, s(5.0), 12);
  const licIn = rise(frame, s(5.6), 12);
  // The pupil closes, then the tick draws through it: the last thing that moves.
  const closing = rise(frame, s(7.0), 4);
  const pupil = Math.min(bp, 2.4 * (1 - closing));
  const tick = rise(frame, s(7.15), 10);
  const word = mark * 0.8 * 2.7;
  const gap = (mark * 5) / 32;
  const shift = (word + gap) / 2;
  const black = frame >= s(9.6);
  return (
    <Scene>
      {!black && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `translateX(${shift * (1 - wordIn)}px)`, opacity: markIn }}>
            <Lockup mark={mark} pupil={pupil} blink={blink} tick={tick} wordStyle={{ opacity: wordIn, transform: `translateX(${(1 - wordIn) * 16}px)` }} />
          </div>
          <div style={{ marginTop: square ? 48 : 60, fontFamily: DISPLAY, fontWeight: 800, fontSize: square ? 40 : 48, letterSpacing: "-0.02em", color: INK, opacity: urlIn, transform: `translateY(${(1 - urlIn) * 12}px)` }}>{line("url").text}</div>
          <Small style={{ marginTop: 14, fontSize: 26, opacity: licIn, transform: `translateY(${(1 - licIn) * 12}px)` }}>{line("licence").text}</Small>
        </AbsoluteFill>
      )}
      {black && <AbsoluteFill style={{ background: "#000" }} />}
    </Scene>
  );
}
