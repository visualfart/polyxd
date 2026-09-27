/**
 * The launch film, scene by scene. Times are seconds on the composition's clock; each scene is a
 * Sequence and works in its own seconds from 0. The wide (1920×1080) and square (1080×1080) cuts
 * are the same scenes re-framed through `useLayout()`.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { ACCENT, INK, Lockup, PAPER, blinkAt } from "./brand.tsx";
import { Act, Arrive, Caption, Clip, DISPLAY, LayoutProvider, Phone, Scene, Skeleton, Small, Still, Window, fall, rise, s, useLayout } from "./ui.tsx";
import { ACTS } from "./script.ts";

/* ─── Scene 1 · 0–4s: the mark blinks once, the wordmark settles beside it ─── */
function Opening() {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const mark = square ? 168 : 200;
  const word = mark * 0.8 * 2.7; // the wordmark's width, near enough, to keep the lockup centred as it arrives
  const gap = (mark * 5) / 32;
  const markIn = rise(frame, s(0.3), 14);
  const { pupil, blink } = blinkAt(frame, s(1.5), 8);
  const wordIn = rise(frame, s(2.3), 16);
  const shift = (word + gap) / 2;
  return (
    <Scene fadeIn={0}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `translateX(${shift * (1 - wordIn)}px)` }}>
          <div style={{ opacity: markIn, transform: `scale(${0.96 + 0.04 * markIn})` }}>
            <Lockup mark={mark} pupil={pupil} blink={blink} wordStyle={{ opacity: wordIn, transform: `translateX(${(1 - wordIn) * 16}px)` }} />
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
}

/* ─── Scene 2 · 4–10s: the line, one line at a time ─── */
function Headline() {
  const frame = useCurrentFrame();
  const { square, w } = useLayout();
  const size = square ? 78 : 132;
  const l1 = rise(frame, s(0.6), 16);
  const l2 = rise(frame, s(1.35), 16);
  const lockIn = rise(frame, s(0.2), 12);
  const pad = square ? 72 : 160;
  return (
    <Scene>
      <div style={{ position: "absolute", left: pad, top: square ? 64 : 96, opacity: lockIn }}>
        <Lockup mark={square ? 40 : 48} />
      </div>
      <div style={{ position: "absolute", left: pad, right: pad, top: "50%", transform: "translateY(-50%)", fontFamily: DISPLAY, fontWeight: 800, fontSize: size, letterSpacing: "-0.035em", lineHeight: 1.02, color: INK, textWrap: "balance" }}>
        <div style={{ opacity: l1, transform: `translateY(${(1 - l1) * 14}px)` }}>Interfaces that show up</div>
        <div style={{ opacity: l2, transform: `translateY(${(1 - l2) * 14}px)` }}>when you need them.</div>
      </div>
      <div style={{ position: "absolute", left: pad, bottom: square ? 64 : 96, width: w - pad * 2 }}>
        <Small style={{ opacity: l2 }}>Open spec, renderer and verifier · generated or authored · your design system</Small>
      </div>
    </Scene>
  );
}

/* ─── Scene 3 · 10–22s: Ask. Halden on a phone ─── */
const ASK_FROM = 1.1; // clip seconds where the scene starts; Enter at 5.35s of the clip, the form at 5.56s
function Ask() {
  const frame = useCurrentFrame();
  const { square, w, h } = useLayout();
  const width = square ? 330 : 400;
  const height = (width * 844) / 390;
  // The skeleton: on the phone from just after Enter until the surface has drawn under it.
  const skIn = rise(frame, s(5.3 - ASK_FROM), 4);
  const skOut = fall(frame, s(6.2 - ASK_FROM), 10);
  const skeleton = skIn * skOut;
  const phone = (
    <Arrive at={s(0.2)}>
      <Phone width={width}>
        <div style={{ position: "relative", width, height }}>
          <Clip name="halden-send" from={ASK_FROM} width={width} height={height} />
          <Skeleton width={width} height={height - width * 0.19} opacity={skeleton} style={{ top: width * 0.19, borderRadius: `${width * 0.07}px ${width * 0.07}px 0 0` }} />
        </div>
      </Phone>
    </Arrive>
  );
  if (square) {
    return (
      <Scene>
        <div style={{ position: "absolute", left: 72, right: 72, top: 64 }}>
          <Act text={ACTS.ask} at={0.4} />
          <Caption id="ask" base={10} style={{ marginTop: 18 }} size={27} width={940} />
        </div>
        <div style={{ position: "absolute", left: "50%", top: h - 40, transform: "translate(-50%, -100%)" }}>{phone}</div>
      </Scene>
    );
  }
  return (
    <Scene>
      <div style={{ position: "absolute", left: 250, top: "50%", transform: "translateY(-50%)" }}>{phone}</div>
      <div style={{ position: "absolute", left: 800, top: 330, width: w - 800 - 160 }}>
        <Act text={ACTS.ask} at={0.4} />
        <Caption id="ask" base={10} style={{ marginTop: 28 }} />
      </div>
    </Scene>
  );
}

/* ─── Scene 4 · 22–32s: Any design system. One document in seven packs, then four products ─── */
const PACKS: [string, string, number][] = [
  ["material3", "Material 3", 0],
  ["carbon", "Carbon", 0.55],
  ["polaris", "Polaris", 1.1],
  ["govuk", "GOV.UK", 1.65],
  ["shadcn", "shadcn/ui", 2.2],
  ["sketch", "Sketch · hand-drawn", 2.85],
  ["wireframe", "Wireframe · hand-drawn", 4.45],
];
const HOMES: [string, string][] = [
  ["home-halden-desk", "Halden · Material 3"],
  ["home-foundry", "Foundry · shadcn/ui"],
  ["home-wexley", "Wexley · GOV.UK"],
  ["home-quay", "Quay · Polaris"],
];
const PACKS_END = 6.0;
function Packs() {
  const frame = useCurrentFrame();
  const { square, w, h } = useLayout();
  const t = frame / 30;
  const current = PACKS.filter((p) => p[2] <= t).at(-1) ?? PACKS[0];
  const stillH = square ? 600 : 860;
  const stage = (
    <div style={{ opacity: Math.min(rise(frame, s(0.2), 12), fall(frame, s(PACKS_END), 8)) }}>
      <div style={{ position: "relative", height: stillH, display: "flex", justifyContent: "center" }}>
        {PACKS.map(([name]) => (
          <Still key={name} name={`gallery-${name}`} height={stillH} fit="contain" style={{ position: "absolute", top: 0, width: stillH * 0.6, objectPosition: "center top", opacity: current[0] === name ? 1 : 0, filter: "drop-shadow(0 24px 50px rgba(20,20,19,.18))" }} />
        ))}
      </div>
      <Small style={{ textAlign: "center", marginTop: 26, color: INK }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 10, background: ACCENT, marginRight: 12, verticalAlign: "middle" }} />
        {current[1]}
      </Small>
    </div>
  );
  const homesIn = rise(frame, s(PACKS_END + 0.2), 10);
  const winW = square ? 470 : 420;
  const homes = (
    <div style={{ opacity: homesIn, display: "grid", gridTemplateColumns: square ? "1fr 1fr" : "repeat(4, 1fr)", gap: square ? 32 : 24, justifyItems: "center" }}>
      {HOMES.map(([name, label], i) => {
        const a = rise(frame, s(PACKS_END + 0.25 + i * 0.12), 14);
        return (
          <div key={name} style={{ opacity: a, transform: `translateY(${(1 - a) * 12}px) scale(${0.96 + 0.04 * a})` }}>
            <Window width={winW}>
              <Still name={name} width={winW} height={winW * 0.625} />
            </Window>
            <Small style={{ marginTop: 16, textAlign: "center" }}>{label}</Small>
          </div>
        );
      })}
    </div>
  );
  if (square) {
    return (
      <Scene>
        <div style={{ position: "absolute", left: 72, right: 72, top: 64 }}>
          <Act text={ACTS.packs} at={0.4} until={PACKS_END} />
          <Caption id="packs" base={22} style={{ marginTop: 18 }} size={27} width={940} />
          <Caption id="products" base={22} style={{ position: "absolute", top: 0 }} size={27} width={940} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 300 }}>{stage}</div>
        <div style={{ position: "absolute", left: 60, right: 60, top: 220 }}>{homes}</div>
      </Scene>
    );
  }
  return (
    <Scene>
      <div style={{ position: "absolute", left: 160, top: 330, width: 560 }}>
        <Act text={ACTS.packs} at={0.4} until={PACKS_END} />
        <Caption id="packs" base={22} style={{ marginTop: 28 }} />
      </div>
      <div style={{ position: "absolute", left: 860, right: 0, top: (h - stillH - 70) / 2 }}>{stage}</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center" }}>
        <Caption id="products" base={22} align="center" width={1100} />
      </div>
      <div style={{ position: "absolute", left: 84, right: 84, top: (h - winW * 0.625 - 60) / 2 + 30 }}>{homes}</div>
    </Scene>
  );
}

/* ─── A window with a caption column: scenes 5, 6 and 7 share this ─── */
/** `captionTop` is where the caption starts under the act title: 100 for a one-line title, 170 for two lines (wide only; square titles fit on one). */
function Chapter({ acts, captions, base, winW, ratio, dark, captionTop = 100, children }: { acts: [string, number, number?][]; captions: string[]; base: number; winW: number; ratio: number; dark?: boolean; captionTop?: number; children: React.ReactNode }) {
  const { square, w, h } = useLayout();
  const words = (
    <>
      {acts.map(([text, at, until]) => (
        <Act key={text} text={text} at={at} until={until} style={{ position: "absolute", top: 0, left: 0 }} />
      ))}
      {captions.map((id) => (
        <Caption key={id} id={id} base={base} style={{ position: "absolute", top: square ? 78 : captionTop, left: 0 }} size={square ? 27 : undefined} width={square ? 940 : undefined} />
      ))}
    </>
  );
  const win = (
    <Arrive at={s(0.2)}>
      <Window width={winW} ratio={ratio} dark={dark}>
        {children}
      </Window>
    </Arrive>
  );
  if (square) {
    const winH = winW * ratio + winW * 0.026;
    return (
      <Scene>
        <div style={{ position: "absolute", left: 72, right: 72, top: 64, height: 200 }}>{words}</div>
        <div style={{ position: "absolute", left: (w - winW) / 2, top: h - 48 - winH }}>{win}</div>
      </Scene>
    );
  }
  const winH = winW * ratio + winW * 0.026;
  return (
    <Scene>
      <div style={{ position: "absolute", left: 140, top: 330, width: 460, height: 400 }}>{words}</div>
      <div style={{ position: "absolute", left: w - 100 - winW, top: (h - winH) / 2 }}>{win}</div>
    </Scene>
  );
}

/* ─── Scene 5 · 32–44s: People and agents, then Verified. Foundry, dark ─── */
// Two cuts of one take: the ask and the filter narrowing, then the Checked mark and its report.
const VERIFIED_CUT = 7.0;
function Verified() {
  const { square } = useLayout();
  const winW = square ? 980 : 1220;
  const h = winW * 0.625;
  return (
    <Chapter acts={[[ACTS.agents, 0.4, VERIFIED_CUT - 0.3], [ACTS.checked, VERIFIED_CUT + 0.2]]} captions={["agents", "checked"]} base={32} winW={winW} ratio={800 / 1280} dark captionTop={170}>
      <Sequence from={0} durationInFrames={s(VERIFIED_CUT)} layout="none">
        <Clip name="foundry-filter" from={2.4} rate={1.3} width={winW} height={h} />
      </Sequence>
      <Sequence from={s(VERIFIED_CUT)} layout="none">
        <Clip name="foundry-filter" from={13.0} rate={1.2} width={winW} height={h} />
      </Sequence>
    </Chapter>
  );
}

/* ─── Scene 6 · 44–56s: Generated or authored. Studio, then Wexley ─── */
function Authored() {
  const { square } = useLayout();
  const winW = square ? 980 : 1220;
  return (
    <Chapter acts={[[ACTS.studio, 0.4]]} captions={["studio"]} base={44} winW={winW} ratio={800 / 1280} captionTop={170}>
      <Clip name="studio-editor" from={8.4} rate={1.3} width={winW} height={winW * 0.625} />
    </Chapter>
  );
}
function Shell() {
  const { square } = useLayout();
  const winW = square ? 860 : 1100;
  return (
    <Chapter acts={[[ACTS.studio, 0]]} captions={["shell"]} base={49.6} winW={winW} ratio={800 / 1024} captionTop={170}>
      <Clip name="wexley-move" from={7.0} rate={1.4} width={winW} height={winW * (800 / 1024)} />
    </Chapter>
  );
}

/* ─── Scene 7 · 56–66s: Yours. Quay ─── */
function Yours() {
  const { square } = useLayout();
  const winW = square ? 980 : 1220;
  return (
    <Chapter acts={[[ACTS.yours, 0.4]]} captions={["yours"]} base={56} winW={winW} ratio={800 / 1280}>
      <Clip name="quay-dip" from={0.9} width={winW} height={winW * 0.625} />
    </Chapter>
  );
}

/* ─── Scene 8 · 66–72s: close on the mark; it goes to "checked" as the last thing that moves ─── */
function Close() {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const mark = square ? 150 : 176;
  const lockIn = rise(frame, s(0.2), 14);
  const urlIn = rise(frame, s(1.2), 12);
  const licIn = rise(frame, s(1.8), 12);
  // The pupil closes, then the tick draws through it.
  const pupil = 2.4 * (1 - rise(frame, s(3.5), 5));
  const tick = rise(frame, s(3.7), 12);
  return (
    <Scene fadeOut={0}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: lockIn, transform: `scale(${0.96 + 0.04 * lockIn})` }}>
          <Lockup mark={mark} pupil={pupil} tick={tick} />
        </div>
        <div style={{ marginTop: square ? 44 : 56, fontFamily: DISPLAY, fontWeight: 800, fontSize: square ? 40 : 46, letterSpacing: "-0.02em", color: INK, opacity: urlIn, transform: `translateY(${(1 - urlIn) * 12}px)` }}>polyxd.com</div>
        <Small style={{ marginTop: 14, fontSize: 26, opacity: licIn, transform: `translateY(${(1 - licIn) * 12}px)` }}>Open source · Apache-2.0</Small>
      </AbsoluteFill>
    </Scene>
  );
}

const SCENES: [React.FC, number, number][] = [
  [Opening, 0, 4],
  [Headline, 4, 10],
  [Ask, 10, 22],
  [Packs, 22, 32],
  [Verified, 32, 44],
  [Authored, 44, 49.6],
  [Shell, 49.6, 56],
  [Yours, 56, 66],
  [Close, 66, 72],
];

export function Film({ square }: { square: boolean }) {
  const layout = square ? { w: 1080, h: 1080, square: true } : { w: 1920, h: 1080, square: false };
  return (
    <LayoutProvider value={layout}>
      <AbsoluteFill style={{ backgroundColor: PAPER }}>
        {SCENES.map(([C, from, to]) => (
          <Sequence key={C.name} from={s(from)} durationInFrames={s(to) - s(from)} name={C.name}>
            <C />
          </Sequence>
        ))}
      </AbsoluteFill>
    </LayoutProvider>
  );
}
