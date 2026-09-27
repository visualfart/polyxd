/**
 * The three short cuts from SCRIPT-OPTIONS.md, each timed to its own music's bars so the lifts land
 * where the story turns. Every time below is in seconds; `b(n)` is the start of bar n.
 *
 *   A · The ask            Longing, 82 bpm     one person, asked twice
 *   B · Show, don't tell   Rise Up, 81 bpm     a paragraph, then a screen; then two more apps
 *   C · How it works       Yearning, 70 bpm    a screen, its list of parts, written, drawn
 */
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import type { UIDocument } from "@polyxd/react";
import { FORM, formData } from "../surface.tsx";
import returnDoc from "./return-shoes.json";
import addressDoc from "./new-address.json";
import { AppBar, Asked, Checked, Composer, EndCard, Line, MONO, MUTED, PAPER, PaperLine, Phone, Replied, Reveal, Sound, TEXT, Themed, Thinking, Toast, ramp, typedAt, useT, window_, type App } from "./kit.tsx";

export const FPS = 30;
const bars = (bpm: number) => (n: number) => (n * 240) / bpm;

/** The send form, with its button saying what it does (the example's says Continue). */
const SEND = { ...FORM, components: FORM.components.map((c: any) => (c.id === "form" ? { ...c, submit: { ...c.submit, label: "Send £40.00" } } : c)) } as UIDocument;
const SEND_DATA = formData("p_priya", 40, "Dinner", true);
const RETURN = returnDoc as unknown as UIDocument;
const ADDRESS = addressDoc as unknown as UIDocument;

const HALDEN: App = { name: "Halden", theme: "material3" };
const LEDGER: App = { name: "Ledger", theme: "carbon" };
const TIDINGS: App = { name: "Tidings", theme: "polaris" };
const FERNLY: App = { name: "Fernly", theme: "shadcn" };
const COUNCIL: App = { name: "Wexley Council", theme: "govuk" };

/** Between the app bar and the input: the conversation, kept scrolled so its end is in view. */
function Chat({ children, bottom = 96, follow = false }: { children: ReactNode; bottom?: number; follow?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  });
  return (
    <div ref={ref} style={{ position: "absolute", top: 112, left: 0, right: 0, bottom, overflow: "hidden" }}>
      {children}
    </div>
  );
}

/** One app's screen with a question asked and the answer drawn: the layer the style changes cross-fade between. */
function Answered({ app, asked, doc, data, t, from, every = 0.45, tap, askedAt = -1, composer = false }: { app: App; asked: string; doc: UIDocument; data: Record<string, unknown>; t: number; from: number; every?: number; tap?: number; askedAt?: number; composer?: boolean }) {
  return (
    <Themed app={app}>
      <AppBar app={app} />
      <Chat bottom={composer ? 96 : 0}>
        {asked && <Asked text={asked} o={ramp(t, askedAt, 0.35)} />}
        <div style={{ marginTop: -6 }}>
          <Reveal doc={doc} data={data} theme={app.theme} t={t} from={from} every={every} tap={tap} />
        </div>
      </Chat>
      {composer && <Composer text="" caret={false} />}
    </Themed>
  );
}

/** Layers stacked in the phone; each is visible from its start until the next one has faded in. */
function Layers({ t, layers, fade = 0.6 }: { t: number; layers: { at: number; node: ReactNode }[]; fade?: number }) {
  return (
    <>
      {layers.map((l, i) => {
        const next = layers[i + 1];
        const on = ramp(t, l.at, i === 0 ? 0 : fade);
        const gone = next ? ramp(t, next.at + fade, 0.01) : 0;
        if (t < l.at || gone >= 1) return null;
        return (
          <div key={i} style={{ position: "absolute", inset: 0, opacity: on }}>
            {l.node}
          </div>
        );
      })}
    </>
  );
}

// ———————————————————————————————— A · The ask ————————————————————————————————

const bA = bars(82);
export const A = {
  duration: 43,
  music: "music-a.wav",
  ask1: { typing: 0.9, send: 2.7, think: 3.1, reply: 4.2, out: bA(2.5) },
  line: { from: bA(2.5), to: bA(4) },
  ask2: { in: bA(4), typing: 12.2, send: 14.0 },
  screen: { from: bA(5) + 0.1, caption: [17.6, 22.9] as const, tap: 20.6, toast: [21.2, 23.1] as const },
  styles: { from: bA(8), caption: [23.6, 31.9] as const, ledger: 25.4, tidings: 28.6 },
  checked: { from: bA(11), caption: [32.4, 34.9] as const },
  end: bA(12),
};
const ASK_A = "Split dinner with Priya, £40";

export function FilmA() {
  const t = useT();
  const k = A;
  const phone1 = window_(t, 0, k.ask1.out, 0.45);
  const phone2 = window_(t, k.ask2.in, k.end, 0.45);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      {t < k.ask1.out && (
        <Phone opacity={phone1}>
          <Themed app={HALDEN}>
            <AppBar app={HALDEN} />
            <Chat>
              {t >= k.ask1.send && <Asked text={ASK_A} o={ramp(t, k.ask1.send, 0.35)} />}
              {t >= k.ask1.think && t < k.ask1.reply && <Thinking t={t} />}
              {t >= k.ask1.reply && <Replied o={ramp(t, k.ask1.reply, 0.4)}>Sorry, I can't help with that.</Replied>}
            </Chat>
            <Composer text={t < k.ask1.send ? typedAt(t, k.ask1.typing, ASK_A) : ""} caret={t < k.ask1.send} />
          </Themed>
        </Phone>
      )}

      {t >= k.line.from && t < k.line.to && <PaperLine t={t} from={k.line.from + 0.25} to={k.line.to - 0.2}>Apps only have the screens someone built in advance.</PaperLine>}

      {t >= k.ask2.in && t < k.end && (
        <Phone opacity={phone2}>
          <Layers
            t={t}
            layers={[
              {
                at: k.ask2.in,
                node: (
                  <Themed app={HALDEN}>
                    <AppBar app={HALDEN} />
                    <Chat bottom={t < k.screen.from ? 96 : 0}>
                      {t >= k.ask2.send && <Asked text={ASK_A} o={ramp(t, k.ask2.send, 0.35)} />}
                      {t >= k.screen.from && (
                        <div style={{ marginTop: -6 }}>
                          <Reveal doc={SEND} data={SEND_DATA} theme="material3" t={t} from={k.screen.from} tap={k.screen.tap} />
                        </div>
                      )}
                    </Chat>
                    {t < k.screen.from && <Composer text={t < k.ask2.send ? typedAt(t, k.ask2.typing, ASK_A) : ""} caret={t < k.ask2.send} />}
                    <Toast text="£40.00 sent to Priya" o={window_(t, k.screen.toast[0], k.screen.toast[1], 0.35)} />
                  </Themed>
                ),
              },
              { at: k.styles.ledger, node: <Answered app={LEDGER} asked={ASK_A} doc={SEND} data={SEND_DATA} t={t} from={-99} /> },
              { at: k.styles.tidings, node: <Answered app={TIDINGS} asked={ASK_A} doc={SEND} data={SEND_DATA} t={t} from={-99} /> },
            ]}
          />
        </Phone>
      )}

      <Line t={t} from={k.screen.caption[0]} to={k.screen.caption[1]}>Polyxd lets AI build the screen you asked for.</Line>
      <Line t={t} from={k.styles.caption[0]} to={k.styles.caption[1]}>In your app's own design.</Line>
      <Line t={t} from={k.checked.caption[0]} to={k.checked.caption[1]}>Checked before anyone sees it.</Line>
      {t >= k.checked.from && t < k.end && <div style={{ opacity: 1 - ramp(t, k.end - 0.45, 0.45) }}><Checked t={t} from={k.checked.from + 0.3} /></div>}

      {t >= k.end && <EndCard t={t} from={k.end} />}
      <Sound music={k.music} end={k.duration} cues={[
        { at: k.screen.tap + 0.25, sfx: "ui-click", gain: 0.55 },
        { at: k.checked.from + 1.0, sfx: "tick", gain: 0.7 },
      ]} />
    </AbsoluteFill>
  );
}

// ———————————————————————————————— B · Show, don't tell ————————————————————————————————

const bB = bars(81);
export const B = {
  duration: 52,
  music: "music-b.wav",
  ask: { typing: 0.9, send: 2.6, think: 3.0, stream: 4.0, streamEnd: 12.4, out: bB(4.5) },
  line: { from: bB(4.5), to: bB(6) },
  screen: { in: bB(6), from: bB(6) + 0.7, caption: [20.9, 29.1] as const, tap: 25.2, toast: [25.8, 29.4] as const },
  apps: { bank: bB(10), council: bB(12), caption: [30.4, 41.1] as const },
  checked: { from: bB(14), caption: [41.8, 44.1] as const },
  end: bB(15),
};
const ASK_B = "Can I return these shoes?";
const PARAGRAPH =
  "Yes, you can return them within 30 days of delivery. To start a return, open the menu and go to Your orders. Find the order with the trail runners and tap View order. Scroll down to Items and tap the pair you want to send back, then choose Return or exchange. Pick a reason from the list. If you'd like a different size, choose Exchange and select your new size, then check it's in stock. Next, choose how you'd like to send them back: drop-off point, locker or courier collection. If you choose drop-off, you'll need to print the label we email you, or show the QR code at the counter. Once we receive them, your refund or exchange is processed within 3 to 5 working days, and you'll get an email when";

export function FilmB() {
  const t = useT();
  const k = B;
  const words = PARAGRAPH.split(" ");
  const shown = Math.max(0, Math.min(words.length, Math.floor(((t - k.ask.stream) / (k.ask.streamEnd - k.ask.stream)) * words.length)));
  const phone1 = window_(t, 0, k.ask.out, 0.45);
  const phone2 = window_(t, k.screen.in, k.end, 0.45);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      {t < k.ask.out && (
        <Phone opacity={phone1}>
          <Themed app={FERNLY}>
            <AppBar app={FERNLY} />
            <Chat follow>
              {t >= k.ask.send && <Asked text={ASK_B} o={ramp(t, k.ask.send, 0.35)} />}
              {t >= k.ask.think && t < k.ask.stream && <Thinking t={t} />}
              {t >= k.ask.stream && <Replied>{words.slice(0, shown).join(" ")}</Replied>}
              <div style={{ height: 12 }} />
            </Chat>
            <Composer text={t < k.ask.send ? typedAt(t, k.ask.typing, ASK_B) : ""} caret={t < k.ask.send} />
          </Themed>
        </Phone>
      )}

      {t >= k.line.from && t < k.line.to && (
        <PaperLine t={t} from={k.line.from + 0.25} to={k.line.to - 0.2}>
          AI can answer anything.
          <br />
          But it answers in paragraphs.
        </PaperLine>
      )}

      {t >= k.screen.in && t < k.end && (
        <Phone opacity={phone2}>
          <Layers
            t={t}
            layers={[
              {
                at: k.screen.in,
                node: (
                  <>
                    <Answered app={FERNLY} asked={ASK_B} doc={RETURN} data={(RETURN as any).data} t={t} from={k.screen.from} tap={k.screen.tap} askedAt={k.screen.in + 0.2} />
                    <Themed app={FERNLY} style={{ background: "transparent", pointerEvents: "none" }}>
                      <Toast text="Return started. Your label is in your email." o={window_(t, k.screen.toast[0], k.screen.toast[1], 0.35)} />
                    </Themed>
                  </>
                ),
              },
              { at: k.apps.bank, node: <Answered app={HALDEN} asked="Send Priya £40 for dinner" doc={SEND} data={SEND_DATA} t={t} from={k.apps.bank + 0.8} every={0.35} askedAt={k.apps.bank + 0.3} /> },
              { at: k.apps.council, node: <Answered app={COUNCIL} asked="I've moved" doc={ADDRESS} data={(ADDRESS as any).data} t={t} from={k.apps.council + 0.8} every={0.35} askedAt={k.apps.council + 0.3} /> },
            ]}
          />
        </Phone>
      )}

      <Line t={t} from={k.screen.caption[0]} to={k.screen.caption[1]}>Polyxd turns the answer into a screen.</Line>
      <Line t={t} from={k.apps.caption[0]} to={k.apps.caption[1]}>Any app. In its own design.</Line>
      <Line t={t} from={k.checked.caption[0]} to={k.checked.caption[1]}>Checked before anyone sees it.</Line>
      {t >= k.checked.from && t < k.end && <div style={{ opacity: 1 - ramp(t, k.end - 0.45, 0.45) }}><Checked t={t} from={k.checked.from + 0.3} /></div>}

      {t >= k.end && <EndCard t={t} from={k.end} />}
      <Sound music={k.music} end={k.duration} cues={[
        { at: k.screen.tap + 0.25, sfx: "ui-click", gain: 0.55 },
        { at: k.checked.from + 1.0, sfx: "tick", gain: 0.7 },
      ]} />
    </AbsoluteFill>
  );
}

// ———————————————————————————————— C · How it works ————————————————————————————————

const bC = bars(70);
export const C = {
  duration: 42,
  music: "music-c.wav",
  screen: { caption: [0.8, 6.5] as const },
  parts: { from: bC(2) + 0.35, every: 0.5, caption: [7.3, 13.3] as const },
  write: { from: bC(4), prompt: 14.4, lines: 16.3, every: 0.5, caption: [14.4, 20.2] as const },
  draw: { from: bC(6), parts: bC(6) + 0.4, every: 0.5, ledger: 26.0, caption: [21.2, 30.5] as const },
  checked: { from: bC(9), caption: [31.2, 34.0] as const },
  end: bC(10),
};
const PROMPT_C = "Send Priya £40 for dinner";

/** The send form as a person would describe it: what each part is, and what it says. */
const PARTS: [string, string][] = [
  ["Title", "Send money"],
  ["Question", "Who are you sending to? Priya"],
  ["Amount", "£40.00"],
  ["Text", "Reference: Dinner"],
  ["Summary", "You send, fee, they get"],
  ["Button", "Send £40.00"],
];

function PartsList({ o }: { o: (i: number) => number }) {
  return (
    <div style={{ position: "absolute", left: 28, right: 24, top: 150, display: "flex", flexDirection: "column", gap: 26 }}>
      {PARTS.map(([kind, text], i) => {
        const v = o(i);
        return (
          <div key={kind} style={{ display: "flex", flexDirection: "column", gap: 6, opacity: v, transform: `translateY(${(1 - v) * 10}px)` }}>
            <div style={{ fontFamily: MONO, fontSize: 12.5, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>{kind}</div>
            <div style={{ fontFamily: TEXT, fontWeight: 500, fontSize: 21, color: "#141413" }}>{text}</div>
          </div>
        );
      })}
    </div>
  );
}

export function FilmC() {
  const t = useT();
  const k = C;
  const phone = window_(t, 0, k.end, 0.45);
  const n = PARTS.length;
  // The app around the screen: there in the first scene, gone while the screen is only its parts, back when it's drawn.
  const chrome = t < k.draw.from ? 1 - ramp(t, k.parts.from - 0.2, 0.4) : ramp(t, k.draw.from + 0.05, 0.4);
  // The list: appears as the screen's parts leave; clears for the AI to write it; leaves as the screen is drawn.
  const listO = (i: number) => {
    if (t < k.write.from) return ramp(t, k.parts.from + i * k.parts.every + 0.25, 0.4);
    if (t < k.write.lines - 0.1) return 1 - ramp(t, k.write.from + 0.1, 0.4);
    if (t < k.draw.from) return ramp(t, k.write.lines + i * k.write.every, 0.3);
    return 1 - ramp(t, k.draw.parts + i * k.draw.every, 0.3);
  };
  const drawing = t >= k.draw.from;
  const promptO = t < k.draw.from ? ramp(t, k.write.prompt - 0.3, 0.3) : 1 - ramp(t, k.draw.from, 0.3);
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      {t < k.end && (
        <Phone opacity={phone}>
          <Layers
            t={t}
            layers={[
              {
                at: 0,
                node: (
                  <Themed app={HALDEN}>
                    <div style={{ opacity: chrome }}>
                      <AppBar app={HALDEN} />
                    </div>
                    <div style={{ position: "absolute", top: 112, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
                      {!drawing && t < k.write.from && <Reveal doc={SEND} data={SEND_DATA} theme="material3" t={t} from={-99} hideFrom={k.parts.from} hideEvery={k.parts.every} />}
                      {drawing && <Reveal doc={SEND} data={SEND_DATA} theme="material3" t={t} from={k.draw.parts} every={k.draw.every} />}
                    </div>
                    {t >= k.write.from && t < k.draw.from + 0.4 && (
                      <div style={{ position: "absolute", top: 56, left: 0, right: 0, opacity: promptO }}>
                        <Asked text={typedAt(t, k.write.prompt, PROMPT_C, 0.06) || " "} />
                      </div>
                    )}
                    {t >= k.parts.from && <PartsList o={listO} />}
                  </Themed>
                ),
              },
              { at: k.draw.ledger, node: <Answered app={LEDGER} asked="" doc={SEND} data={SEND_DATA} t={t} from={-99} askedAt={999} /> },
            ]}
          />
        </Phone>
      )}

      <Line t={t} from={k.screen.caption[0]} to={k.screen.caption[1]}>This is a screen.</Line>
      <Line t={t} from={k.parts.caption[0]} to={k.parts.caption[1]}>Polyxd describes it as a list of parts.</Line>
      <Line t={t} from={k.write.caption[0]} to={k.write.caption[1]}>So an AI can write one.</Line>
      <Line t={t} from={k.draw.caption[0]} to={k.draw.caption[1]}>Your app draws it in its own design.</Line>
      <Line t={t} from={k.checked.caption[0]} to={k.checked.caption[1]}>And checks it works for everyone.</Line>
      {t >= k.checked.from && t < k.end && <div style={{ opacity: 1 - ramp(t, k.end - 0.45, 0.45) }}><Checked t={t} from={k.checked.from + 0.3} /></div>}

      {t >= k.end && <EndCard t={t} from={k.end} sub="polyxd.com · open source" />}
      <Sound music={k.music} end={k.duration} cues={[{ at: k.checked.from + 1.0, sfx: "tick", gain: 0.7 }]} />
    </AbsoluteFill>
  );
}
