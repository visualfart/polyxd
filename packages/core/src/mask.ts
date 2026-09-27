/** Fills a mask as you type: # takes a digit, A a letter, * either; other characters are typed for you. */
export function applyMask(mask: string, text: string, deleting = false): string {
  const chars = text.replace(/[^A-Za-z0-9]/g, "").split("");
  let out = "";
  let ci = 0;
  for (const m of mask) {
    if (ci >= chars.length) break;
    if (m === "#" || m === "A" || m === "*") {
      const ok = m === "#" ? /\d/ : m === "A" ? /[A-Za-z]/ : /./;
      while (ci < chars.length && !ok.test(chars[ci])) ci++;
      if (ci >= chars.length) break;
      out += chars[ci++];
    } else out += m;
  }
  // Deleting past a literal would put it straight back; drop trailing literals so Backspace moves on.
  if (deleting) while (out.length && !/[#A*]/.test(mask[out.length - 1])) out = out.slice(0, -1);
  return out;
}

/** A mask of digits only gets the numeric keyboard. */
export const maskIsNumeric = (mask: string): boolean => !/[A*]/.test(mask);

/** What a numeric text field writes: the number typed, or null when nothing (or not a number) was. */
export function numericValue(text: string): number | null {
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return text.trim() === "" || Number.isNaN(n) ? null : n;
}

/** What a numeric field shows when not being typed in: currency to two places. */
export const storedText = (raw: unknown, kind: string): string => (raw === null || raw === undefined ? "" : kind === "currency" && typeof raw === "number" ? raw.toFixed(2) : String(raw));

/** Several short values: Enter or a comma makes a chip; the same value twice is one chip. */
export function addTag(tags: string[], draft: string): string[] {
  const t = draft.trim().replace(/,$/, "").trim();
  return t && !tags.includes(t) ? [...tags, t] : tags;
}
