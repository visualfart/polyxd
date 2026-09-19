import type { Rule } from "./patterns.ts";

/**
 * Compiles a Design Direction's copy-and-tone settings into checkable rules. Tone settings that
 * can't be checked mechanically (formality, warmth, situation guidance) are for the generator only.
 */
export function compileVoice(direction: any): Rule[] {
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
  return rules;
}

/** Every rule a Design Direction holds a surface to: its explicit rules plus its compiled voice. */
export function directionRules(direction: any): Rule[] {
  return [...(direction?.rules ?? []), ...compileVoice(direction)];
}
