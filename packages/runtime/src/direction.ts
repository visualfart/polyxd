import type { Capability, CatalogPattern, Direction, Rule } from "./types.ts";

/**
 * Every rule a Direction holds a surface to: its explicit rules plus its voice compiled into
 * checks. The same result as `directionRules` in `@polyxd/spec`, whose root entry reads files and
 * so can't run in a browser; a test holds the two to each other.
 */
export function directionRules(direction: Direction | undefined): Rule[] {
  const v = direction?.voice ?? {};
  const rules: Rule[] = [];
  const add = (id: string, description: string, rule: Rule["rule"], severity: Rule["severity"] = "warning") => rules.push({ id: `voice-${id}`, description, severity, rule });
  if (v.casing) add("casing", `Use ${v.casing} case for titles, labels and buttons`, { check: "casing", style: v.casing });
  if (v.punctuation?.exclamation === "never") add("no-exclamation", "No exclamation marks", { check: "noLabelMatches", pattern: "!" });
  if (v.punctuation?.emoji === "never") add("no-emoji", "No emoji", { check: "noEmoji" });
  if (v.labels?.maxWords) add("label-length", `Button labels of at most ${v.labels.maxWords} words`, { check: "maxWords", max: v.labels.maxWords });
  if (v.readingLevel?.maxGrade) add("reading-level", `Running text at reading grade ${v.readingLevel.maxGrade} or below`, { check: "readingLevel", maxGrade: v.readingLevel.maxGrade });
  if (v.spelling) add("spelling", `${v.spelling} spelling`, { check: "spelling", variant: v.spelling });
  if (v.person && v.person !== "we-and-you") add("person", v.person === "you" ? 'Address people as "you"; the product doesn\'t say "we"' : "Impersonal: neither you nor we", { check: "person", style: v.person });
  if (Array.isArray(v.avoid) && v.avoid.length) add("avoid", `Never say: ${v.avoid.join(", ")}`, { check: "avoidTerms", terms: v.avoid });
  for (const g of v.glossary ?? []) {
    if (g.insteadOf?.length) add(`glossary-${g.use.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, `Say "${g.use}", not ${g.insteadOf.map((x: string) => `"${x}"`).join(" or ")}`, { check: "avoidTerms", terms: g.insteadOf, suggest: g.use });
  }
  return [...(direction?.rules ?? []), ...rules];
}

const STOP = new Set(
  "a an and any are as at be by can do for from get has have i in is it its me my of on or our please show that the their them this to up use want we what when where which with you your".split(" "),
);

function stem(w: string): string {
  return w.length > 4 ? w.replace(/ies$/, "y").replace(/(ing|ed|es|s)$/, "") : w;
}

/** Lower-case words without the common ones, lightly stemmed. `money.send` gives `money`, `send`. */
export function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9£$€]+/)
      .filter((w) => w && !STOP.has(w))
      .map(stem),
  );
}

function shared(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

/** The words an ask brings: what was asked, the intent key, and what the offered capabilities do. */
export function askWords(ask: string, intent: string, capabilities: Record<string, Capability> = {}): Set<string> {
  const parts = [ask, intent];
  for (const [name, c] of Object.entries(capabilities)) parts.push(name, c.description ?? "");
  return words(parts.join(" "));
}

/**
 * The Direction's preferred patterns that fit this ask, best first. A pattern fits when it shares
 * words with the ask, or when it's written for the risk of a capability on offer (a consequential
 * one points at `confirm-destructive`; one with an undo at `undo-over-confirm`). Ties keep the
 * Direction's order, so the result is the same every time.
 */
export function relevantPatterns(preferred: string[], catalog: CatalogPattern[], ask: string, intent: string, capabilities: Record<string, Capability> = {}): CatalogPattern[] {
  const query = askWords(ask, intent, capabilities);
  const risks = new Set(Object.values(capabilities).map((c) => c.risk).filter((r) => r === "consequential" || r === "destructive"));
  const undoable = Object.values(capabilities).some((c) => c.undo);
  const scored: { p: CatalogPattern; score: number; index: number }[] = [];
  preferred.forEach((id, index) => {
    const p = catalog.find((x) => x.id === id);
    if (!p) return;
    const text = [p.id, p.name, p.summary, ...p.whenToUse].join(" ");
    let score = shared(query, words(text));
    for (const r of risks) if (text.includes(r)) score += 2;
    if (undoable && /\bundo\b/i.test(text)) score += 1;
    if (score > 0) scored.push({ p, score, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.p);
}

/** The exemplars whose request shares the most words with this ask, best first, at most `limit`. */
export function relevantExemplars<T extends { request: string }>(exemplars: T[], ask: string, intent: string, limit: number): T[] {
  const query = words(`${ask} ${intent}`);
  return exemplars
    .map((e, index) => ({ e, index, score: shared(query, words(e.request)) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map((s) => s.e);
}
