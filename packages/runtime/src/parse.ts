/**
 * The JSON inside a model's answer. Models wrap it in a code fence, or put a sentence before it,
 * however firmly they're told not to: take the first fenced block that holds an object, else
 * everything from the first `{` to the last `}`.
 */
export function extractJson(text: string): string {
  for (const m of text.matchAll(/```[a-zA-Z]*[ \t]*\r?\n?([\s\S]*?)```/g)) {
    const inner = m[1].trim();
    if (inner.startsWith("{")) return inner;
  }
  // An opening fence the answer never closed (it ran out of tokens, or the stream was cut).
  const open = /```[a-zA-Z]*[ \t]*\r?\n/.exec(text);
  const body = open ? text.slice(open.index + open[0].length) : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body.trim();
}

export type Parsed = { document: Record<string, unknown>; error?: undefined } | { document?: undefined; error: string };

/** Parses a model's answer into a JSON object, or says why it couldn't. */
export function parseDocument(text: string): Parsed {
  const json = extractJson(text);
  if (!json) return { error: "the answer was empty" };
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (e) {
    return { error: `the answer is not valid JSON (${(e as Error).message})` };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "the answer is JSON, but not one object" };
  return { document: value as Record<string, unknown> };
}
