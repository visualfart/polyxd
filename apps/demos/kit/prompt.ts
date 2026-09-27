import { SYSTEM_PROMPT } from "./prompt.generated.ts";
import type { Registry } from "./types.ts";

export { SYSTEM_PROMPT };

/**
 * The host's turn: the ask, the capabilities it exposes for it, the data the surface may bind to,
 * and the product's Design Direction as instructions. Same text whether a document is produced
 * ahead of time or live.
 */
export function userPrompt(input: { ask: string; intent: string; capabilities: string[]; registry: Registry; data: unknown; direction?: any; pattern?: string }): string {
  const lines = [`Request: ${input.ask}`, `Intent: ${input.intent}`];
  if (input.pattern) lines.push(`Pattern: ${input.pattern}`);
  lines.push("", "Capabilities you may use:");
  for (const name of input.capabilities) {
    const c = input.registry.capabilities[name];
    const inputs = Object.keys((c?.inputs as any)?.properties ?? {}).join(", ");
    lines.push(`- ${name} (risk: ${c?.risk ?? "?"}; inputs: ${inputs || "none"}): ${c?.description ?? ""}`);
  }
  if (!input.capabilities.length) lines.push("- (none)");
  lines.push("", "DATA (bind to it with JSON Pointers; do not copy values into text):", JSON.stringify(input.data));
  if (input.direction) lines.push("", ...directionText(input.direction));
  lines.push("", "Output the JSON document now.");
  return lines.join("\n");
}

/** A Design Direction as instructions: taste rules plus copy and tone. */
export function directionText(d: any): string[] {
  const v = d.voice ?? {};
  const out = [`Design direction (${d.name}):`];
  if (v.guidelines?.length) out.push("- Voice: " + v.guidelines.join(" "));
  if (v.tone) out.push("- Tone: " + Object.entries(v.tone).map(([k, val]) => `${k} ${val}`).join(", "));
  const person = { you: 'address the user as "you"; never say "we"', "we-and-you": 'the product may say "we"', impersonal: 'don\'t say "you" or "we"' }[v.person as string];
  if (person) out.push(`- Person: ${person}`);
  const style: string[] = [];
  if (v.casing) style.push(`${v.casing} case`);
  if (v.spelling) style.push(`${v.spelling} spelling`);
  if (v.readingLevel?.maxGrade) style.push(`reading grade ${v.readingLevel.maxGrade} or below`);
  if (v.punctuation?.exclamation === "never") style.push("no exclamation marks");
  if (v.punctuation?.emoji === "never") style.push("no emoji");
  if (v.labels?.maxWords) style.push(`button labels of at most ${v.labels.maxWords} words, starting with a verb`);
  if (style.length) out.push("- Style: " + style.join("; "));
  const glossary = (v.glossary ?? []).map((g: any) => `say "${g.use}", not ${(g.insteadOf ?? []).map((x: string) => JSON.stringify(x)).join(" or ")}`);
  if (glossary.length) out.push("- Words: " + glossary.join("; "));
  if (v.avoid?.length) out.push("- Never use: " + v.avoid.map((x: string) => JSON.stringify(x)).join(", "));
  for (const [moment, guidance] of Object.entries(v.situations ?? {})) out.push(`- For ${moment} states: ${guidance}`);
  const rules = (d.rules ?? []).map((r: any) => r.description);
  if (rules.length) out.push("- Rules: " + rules.join("; "));
  return out;
}
