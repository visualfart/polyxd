/**
 * The ask box: free text in, the nearest intent out. Each intent lists the ways people phrase it;
 * matching is by word overlap with a light stemmer, plus slots (an amount, a name) pulled out of
 * the text with regular expressions. When nothing is close enough the product says so, rather than
 * guessing: a wrong screen is worse than an honest "not yet".
 */
export interface IntentDef {
  id: string;
  /** What the product calls it, for the ask box's suggestions. */
  title: string;
  /** Example asks, in the words people use. */
  ask: string[];
  /** Words that alone point strongly at this intent. */
  keywords?: string[];
  /** Named groups become slot values. */
  slots?: Record<string, RegExp>;
}

export interface Match<I extends IntentDef = IntentDef> {
  intent: I;
  score: number;
  slots: Record<string, string>;
}

const STOP = new Set(["a", "an", "the", "my", "me", "i", "to", "for", "of", "on", "in", "is", "it", "please", "can", "you", "and", "with", "this", "that", "do", "want", "show", "set", "up"]);

function stem(w: string): string {
  return w.replace(/ies$/, "y").replace(/(ing|ed|es|s)$/, (m) => (w.length > 4 ? "" : m));
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9£$€\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const set = new Set(b);
  let hit = 0;
  for (const w of a) if (set.has(w)) hit++;
  return hit / Math.max(a.length, b.length);
}

export function matchAsk<I extends IntentDef>(text: string, intents: I[], threshold = 0.45): Match<I> | null {
  const asked = tokens(text);
  if (!asked.length) return null;
  let best: Match<I> | null = null;
  for (const intent of intents) {
    let score = 0;
    for (const phrase of intent.ask) {
      const p = tokens(phrase);
      let s = overlap(asked, p);
      if (text.toLowerCase().includes(phrase.toLowerCase())) s = Math.max(s, 0.95);
      score = Math.max(score, s);
    }
    for (const k of intent.keywords ?? []) if (asked.includes(stem(k.toLowerCase()))) score = Math.max(score, 0.6) + 0.1;
    if (score > (best?.score ?? 0)) best = { intent, score, slots: {} };
  }
  if (!best || best.score < threshold) return null;
  for (const [name, re] of Object.entries(best.intent.slots ?? {})) {
    const m = re.exec(text);
    const v = m?.groups?.[name] ?? m?.[1];
    if (v) best.slots[name] = v.trim();
  }
  return best;
}

/** A few asks to suggest, rotating so the box never shows the same three. */
export function suggestions(intents: IntentDef[], n = 3, salt = Date.now()): string[] {
  const all = intents.flatMap((i) => [i.ask[0]]);
  const start = Math.floor(salt / 60000) % Math.max(1, all.length);
  return Array.from({ length: Math.min(n, all.length) }, (_, k) => all[(start + k) % all.length]);
}
