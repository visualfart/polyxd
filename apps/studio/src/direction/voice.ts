/**
 * The voice settings as the verifier checks them, run on a sample the designer types.
 *
 * `compileVoice` is the spec's (packages/spec/src/direction.ts), copied because the spec's entry
 * module compiles its schemas with ajv at load, which a Worker refuses (see src/screens/schema.ts);
 * a test holds the copy to the original. The checks themselves are the spec's own, from
 * `@polyxd/spec/checks`, run on a small document holding the sample: a heading, a sentence and
 * a button, so the sample is judged exactly as a screen's copy would be.
 */
import { runCheck, type Check } from "@polyxd/spec/checks";
import type { Direction, DirectionRule } from "./model.ts";

/** A Direction's checkable voice settings as rules (identical to the spec's compileVoice). */
export function compileVoice(direction: Pick<Direction, "voice">): DirectionRule[] {
  const v = direction?.voice ?? {};
  const rules: DirectionRule[] = [];
  const add = (id: string, description: string, rule: DirectionRule["rule"], severity: DirectionRule["severity"] = "warning") => rules.push({ id: `voice-${id}`, description, severity, rule });
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
  return rules;
}

export interface Sample {
  heading: string;
  text: string;
  button: string;
}

export const SAMPLE: Sample = {
  heading: "Payment Sent Successfully",
  text: "Oops! We simply couldn't finish your transaction, so we've cancelled it. Please look at the colour-coded fields and try again.",
  button: "Try Sending The Payment Again Now",
};

export interface SampleResult {
  id: string;
  description: string;
  pass: boolean;
  /** The check's own words, with the sample's parts named */
  message: string;
}

/** Each checkable voice setting, run on the sample. Empty strings drop out, as they would on a screen. */
export function checkSample(direction: Pick<Direction, "voice">, sample: Sample): SampleResult[] {
  const components = [
    { id: "Heading", component: "Section", ...(sample.heading.trim() ? { title: sample.heading } : {}), children: ["Text", "Button"] },
    { id: "Text", component: "Text", text: sample.text },
    { id: "Button", component: "Action", label: sample.button },
  ];
  const doc = { root: "Heading", components };
  return compileVoice(direction).map((r) => {
    let res: { pass: boolean; message: string };
    try {
      res = runCheck(r.rule as Check, doc);
    } catch (e) {
      res = { pass: false, message: `couldn't run: ${(e as Error).message}` };
    }
    return { id: r.id, description: r.description, pass: res.pass, message: res.message };
  });
}

/** The words a sample uses that the voice avoids, for marking them in place. */
export function avoidedIn(direction: Pick<Direction, "voice">, text: string): { term: string; suggest?: string }[] {
  const v = direction.voice ?? {};
  const terms = [...(v.avoid ?? []).map((t) => ({ term: t })), ...(v.glossary ?? []).flatMap((g) => (g.insteadOf ?? []).map((t) => ({ term: t, suggest: g.use })))];
  return terms.filter(({ term }) => term.trim() && new RegExp(`(^|[^\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|es)?([^\\p{L}]|$)`, "iu").test(text));
}
