/**
 * The limited markup of a 'rich' Text: **bold**, *italic*, `code` and [text](href). Parsed into
 * tokens a renderer turns into elements, never injected as HTML, so anything else (including
 * tags) is shown exactly as typed.
 */

export type RichToken = string | { kind: "code"; text: string } | { kind: "strong" | "em"; children: RichToken[] } | { kind: "link"; href?: string; children: RichToken[] };

/** Only these link targets are live; anything else stays text. */
const LINK_OK = /^(https?:|mailto:|tel:|\/|#)/i;

export function richText(text: string): RichToken[] {
  const out: RichToken[] = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) out.push(buf);
    buf = "";
  };
  while (i < text.length) {
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ kind: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ kind: "strong", children: richText(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ kind: "em", children: richText(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (text[i] === "[") {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(i));
      if (m) {
        flush();
        out.push({ kind: "link", href: LINK_OK.test(m[2]) ? m[2] : undefined, children: richText(m[1]) });
        i += m[0].length;
        continue;
      }
    }
    buf += text[i++];
  }
  flush();
  return out;
}
