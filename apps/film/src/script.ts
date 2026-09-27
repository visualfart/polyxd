/**
 * The film's clock: every word on screen with its in and out time, and every sound cue, in seconds,
 * following SCRIPT.md's timecodes. The scenes read the lines by id, the audio layer plays the cues,
 * and `npm run render` writes the lines out as captions.srt, so subtitles or a voice-over later
 * match what is on screen. No JSX here: Node imports it directly.
 */
export const FPS = 30;
export const DURATION = 82;

export interface Line {
  id: string;
  at: number;
  until: number;
  text: string;
}

/** Everything said on screen, in order. Kinetic type and captions alike, so the SRT carries the whole film. */
export const LINES: Line[] = [
  { id: "hook-1", at: 0.0, until: 0.4, text: "No results." },
  { id: "hook-2", at: 0.4, until: 0.8, text: "That feature is coming soon." },
  { id: "hook-3", at: 0.8, until: 1.2, text: "I can't help with that here." },
  { id: "hook-4", at: 1.2, until: 1.6, text: "Please contact support." },
  { id: "hook-5", at: 1.6, until: 2.0, text: "Try the desktop version." },
  { id: "hook-6", at: 2.0, until: 3.0, text: "…" },
  { id: "line-1", at: 3.2, until: 7.0, text: "Every product has a screen for what you asked last year." },
  { id: "line-2", at: 5.4, until: 7.0, text: "Nothing for what you're asking now." },
  { id: "ask", at: 9.3, until: 12.0, text: "send £40 to priya for dinner" },
  { id: "halden", at: 9.6, until: 12.0, text: "Halden · a current account · Material 3" },
  { id: "arrive-1", at: 13.7, until: 18.0, text: "Drawn the moment you ask." },
  { id: "arrive-2", at: 15.1, until: 18.0, text: "In the product's own design system." },
  { id: "arrive-3", at: 16.9, until: 18.0, text: "Checked before you see it." },
  { id: "meaning", at: 19.8, until: 22.2, text: "The interface is a document. Meaning only. No pixels, no colours, no fonts." },
  { id: "packs", at: 27.6, until: 30.0, text: "Thirteen design systems' real tokens. Twelve templates to make your own." },
  { id: "verified", at: 33.2, until: 36.9, text: "Verified in every design system, light and dark, phone and desktop. Before anyone sees it." },
  { id: "agents", at: 41.4, until: 45.0, text: "Screen readers read exactly what agents press." },
  { id: "alone", at: 46.0, until: 48.0, text: "If an agent can't finish by name alone, the surface fails." },
  { id: "turn", at: 48.5, until: 52.0, text: "And the rest of the product?" },
  { id: "studio", at: 53.4, until: 57.5, text: "Designers write screens in the same format. Same renderer. Same checks." },
  { id: "shell", at: 59.8, until: 63.9, text: "The shell too. Authored once. A generated screen can never draw it." },
  { id: "yours", at: 64.6, until: 71.8, text: "Open spec. Any model, or none. Your design system. Your stack." },
  { id: "word-1", at: 65.7, until: 66.1, text: "React" },
  { id: "word-2", at: 67.8, until: 68.2, text: "Web Components" },
  { id: "word-3", at: 69.9, until: 70.3, text: "your renderer" },
  { id: "url", at: 77.0, until: 81.6, text: "polyxd.com" },
  { id: "licence", at: 77.6, until: 81.6, text: "Open source · Apache-2.0" },
];

export const line = (id: string): Line => {
  const l = LINES.find((x) => x.id === id);
  if (!l) throw new Error(`no line ${id}`);
  return l;
};

/** The scene boundaries, in seconds, as SCRIPT.md has them. */
export const T = {
  hook: 0,
  line: 3,
  reversal: 7,
  arrives: 12,
  meaning: 18,
  checked: 30,
  agents: 40,
  turn: 48,
  authored: 52,
  yours: 64,
  close: 72,
  end: 82,
};

export interface Cue {
  sfx: string;
  at: number;
  /** Linear gain on top of the file's −18 dBFS. */
  gain?: number;
}

/** A row of the same cue: for typing. */
const typing = (from: number, count: number, every: number, gain = 0.7): Cue[] => Array.from({ length: count }, (_, i) => ({ sfx: "type-click", at: from + i * every, gain }));

/** Every sound cue in the film, by name in assets/sfx/, at its second. */
export const CUES: Cue[] = [
  // The hook: a dry click on each dead end, and one on the bubble.
  ...[0, 0.4, 0.8, 1.2, 1.6, 2.0].map((at) => ({ sfx: "paper-click", at, gain: 1 })),
  // The line, typed at reading speed; a bass hit on "now".
  ...typing(3.2, 27, 0.064),
  ...typing(5.4, 17, 0.06),
  { sfx: "bass-hit", at: 6.42, gain: 1.4 },
  // The reversal: the lines fold away, the mark blinks, the box slides in, the ask is typed, Return.
  { sfx: "fold", at: 7.0, gain: 0.9 },
  { sfx: "blink", at: 8.1, gain: 1 },
  { sfx: "slide", at: 8.6, gain: 0.8 },
  ...typing(9.3, 28, 0.068, 0.6),
  { sfx: "ui-click", at: 11.5, gain: 0.9 },
  // The screen arrives: the pencil, the snap to real, the taps.
  { sfx: "pencil", at: 12.1, gain: 1 },
  { sfx: "arrive", at: 13.3, gain: 1 },
  { sfx: "ui-click", at: 14.6, gain: 0.8 },
  { sfx: "confirm", at: 16.8, gain: 1 },
  // Meaning: the unfold, then a woosh per swarm and a paper flip per pack, a pencil for Sketch.
  { sfx: "paper-flip", at: 18.3, gain: 0.8 },
  { sfx: "woosh", at: 21.6, gain: 1 },
  { sfx: "paper-flip", at: 22.2, gain: 1 },
  { sfx: "woosh", at: 23.0, gain: 1 },
  { sfx: "paper-flip", at: 23.6, gain: 1 },
  { sfx: "woosh", at: 24.2, gain: 1 },
  { sfx: "paper-flip", at: 24.8, gain: 1 },
  { sfx: "woosh", at: 25.55, gain: 0.7 },
  { sfx: "paper-flip", at: 25.9, gain: 0.9 },
  { sfx: "paper-flip", at: 26.4, gain: 0.9 },
  { sfx: "paper-flip", at: 26.9, gain: 0.9 },
  { sfx: "woosh", at: 27.1, gain: 1 },
  { sfx: "pencil", at: 27.5, gain: 0.9 },
  { sfx: "woosh", at: 28.35, gain: 1 },
  { sfx: "paper-flip", at: 28.8, gain: 1 },
  // Checked: the snap back, the scan, the ticks, the grid's shimmer, the real mark.
  { sfx: "paper-flip", at: 30.0, gain: 1 },
  { sfx: "scan", at: 30.3, gain: 1 },
  { sfx: "tick-cascade", at: 30.9, gain: 0.9 },
  { sfx: "tick-cascade", at: 31.5, gain: 0.9 },
  { sfx: "woosh", at: 32.4, gain: 0.7 },
  { sfx: "shimmer", at: 33.6, gain: 1 },
  { sfx: "arrive", at: 37.0, gain: 0.8 },
  { sfx: "ui-click", at: 37.7, gain: 0.8 },
  { sfx: "ui-click", at: 38.4, gain: 0.8 },
  // People and agents: a clean click per step, the agent run as a ratchet.
  { sfx: "ui-click", at: 41.9, gain: 1 },
  { sfx: "ui-click", at: 43.0, gain: 1 },
  ...typing(43.2, 2, 0.3, 0.9),
  { sfx: "ui-click", at: 44.6, gain: 1 },
  { sfx: "arrive", at: 44.8, gain: 0.6 },
  { sfx: "ratchet", at: 45.4, gain: 1 },
  { sfx: "tick", at: 46.6, gain: 1 },
  // The turn.
  ...typing(48.5, 28, 0.05),
  // Generated or authored: Studio's clicks, the frame drawn, the fill.
  { sfx: "arrive", at: 52.0, gain: 0.7 },
  { sfx: "ui-click", at: 53.8, gain: 0.7 },
  { sfx: "ui-click", at: 55.6, gain: 0.7 },
  { sfx: "ui-click", at: 56.7, gain: 0.7 },
  { sfx: "pencil", at: 57.7, gain: 1 },
  { sfx: "arrive", at: 59.0, gain: 1 },
  { sfx: "ui-click", at: 61.6, gain: 0.7 },
  // Yours: an arrive per product, a click per word.
  { sfx: "arrive", at: 64.0, gain: 0.7 },
  { sfx: "paper-click", at: 65.7, gain: 1 },
  { sfx: "arrive", at: 66.1, gain: 0.7 },
  { sfx: "paper-click", at: 67.8, gain: 1 },
  { sfx: "arrive", at: 68.2, gain: 0.7 },
  { sfx: "paper-click", at: 69.9, gain: 1 },
  { sfx: "arrive", at: 70.3, gain: 0.7 },
  { sfx: "confirm", at: 71.5, gain: 0.9 },
  // The close: the blink, the tick.
  { sfx: "blink", at: 75.0, gain: 1 },
  { sfx: "tick", at: 79.0, gain: 0.8 },
];

const stamp = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(sec)},${p(rest, 3)}`;
};

/** The SRT: one cue per line, in time order, the kinetic words included. */
export const srt = () =>
  [...LINES]
    .sort((a, b) => a.at - b.at)
    .map((l, i) => `${i + 1}\n${stamp(l.at)} --> ${stamp(l.until)}\n${l.text}\n`)
    .join("\n");
