/**
 * The film's words and timing, in seconds. The compositions draw from this and `npm run render`
 * writes it out as captions.srt, so subtitles or a voice-over later match what's on screen.
 * No JSX here: Node imports it directly.
 */
export const FPS = 30;
export const DURATION = 72;

export interface Line {
  id: string;
  at: number;
  until: number;
  text: string;
}

export const LINES: Line[] = [
  { id: "headline", at: 4.6, until: 9.6, text: "Interfaces that show up when you need them." },
  { id: "ask", at: 11.4, until: 21.6, text: "Ask for something. A real, accessible interface is drawn for that moment, in your design system, and checked before you see it." },
  { id: "packs", at: 22.6, until: 27.8, text: "Thirteen design systems' real tokens. Twelve templates to make your own. Two of them hand-drawn." },
  { id: "products", at: 28.4, until: 31.7, text: "Four products, four design systems: Material 3, shadcn/ui, GOV.UK, Polaris." },
  { id: "agents", at: 32.8, until: 38.9, text: "Screen readers read exactly what agents press." },
  { id: "checked", at: 39.6, until: 43.7, text: "Checked in every design system, light and dark, phone and desktop, before anyone sees it." },
  { id: "studio", at: 44.6, until: 49.6, text: "Designers write the rest of the product the same way." },
  { id: "shell", at: 50.2, until: 55.7, text: "The shell too. Authored once, never touched by a generator." },
  { id: "yours", at: 57.2, until: 65.6, text: "Open spec. Any model, or none. Your design system. Your code: React, Web Components, or your own renderer." },
  { id: "close", at: 67.2, until: 71.8, text: "polyxd.com. Open source, Apache-2.0." },
];

/** The act titles, shown large as each chapter opens. */
export const ACTS: Record<string, string> = {
  ask: "Ask.",
  packs: "Any design system.",
  agents: "People and agents.",
  checked: "Verified.",
  studio: "Generated or authored.",
  yours: "Yours.",
};

export const line = (id: string): Line => {
  const l = LINES.find((x) => x.id === id);
  if (!l) throw new Error(`no line ${id}`);
  return l;
};

const stamp = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(sec)},${p(rest, 3)}`;
};

export const srt = () => LINES.map((l, i) => `${i + 1}\n${stamp(l.at)} --> ${stamp(l.until)}\n${l.text}\n`).join("\n");
