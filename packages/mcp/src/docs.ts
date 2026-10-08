/**
 * polyxd_docs: the polyxd.com docs, bundled into the package (scripts/sync.ts writes
 * docs.generated.ts), so answers match the released version and work offline.
 *
 * Search is plain keyword scoring over the docs' sections (each "## " heading and what follows),
 * with a section's heading and its page's title counting more than its body. Small and
 * predictable; the docs are a couple of hundred sections.
 */
import { DOCS, type DocPage } from "./docs.generated.ts";

export { DOCS, type DocPage };

export interface DocSection {
  page: string;
  title: string;
  heading: string;
  url: string;
  text: string;
}

/** How much a search answer may carry, so one call stays a reasonable part of a context window. */
export const SEARCH_LIMIT_CHARS = 12_000;
export const PAGE_LIMIT_CHARS = 40_000;

/**
 * A heading's anchor on polyxd.com. The site slugifies the heading as marked renders it
 * (apps/site/scripts/build.ts), so this renders the inline Markdown the same way first: links to
 * their text, code and emphasis marks dropped, and marked's escapes (an apostrophe is &#39;).
 */
export const anchorFor = (heading: string) =>
  heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Every section of every page. A page's text before its first "## " is a section headed by the page's title. */
export function sections(): DocSection[] {
  return DOCS.flatMap((p) => {
    const parts = p.markdown.split(/^(?=## )/m);
    return parts
      .map((part) => {
        const m = /^## (.*)\n/.exec(part);
        const heading = m ? m[1].trim() : p.title;
        return { page: p.slug, title: p.title, heading, url: m ? `${p.url}#${anchorFor(heading)}` : p.url, text: part.trim() };
      })
      .filter((s) => s.text.length > 0);
  });
}

/** Words that say nothing about which section is meant. */
const STOP = new Set("a an and are as at be by can do does for from how i in is it my of on or polyxd the this to use what when where which with you your".split(" "));

/** A word's stem, so "verify" finds "verifier" and "verified": common endings off, at least four letters kept. */
const stem = (w: string) => {
  const s = w.replace(/(ications?|ations?|ers?|ings?|ied|ies|ed|es|s|y)$/, "");
  return s.length >= 4 ? s : w;
};

const terms = (q: string) => [...new Set(q.toLowerCase().split(/[^a-z0-9@/._-]+/).filter((t) => t.length > 1 && !STOP.has(t)).map(stem))];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Occurrences of a stem at the start of a word: "ci" in "CI", never in "decide". */
const count = (hay: string, needle: string) => (hay.match(new RegExp(`(?<![a-z0-9])${escape(needle)}`, "g")) ?? []).length;

/** The sections that best match the question, best first, within {@link SEARCH_LIMIT_CHARS}. */
export function searchDocs(query: string, limit = 5): DocSection[] {
  const words = terms(query);
  if (!words.length) return [];
  // The question's own words in a row ("web components", "design direction"), stop words dropped.
  const phrase = query.toLowerCase().split(/[^a-z0-9@/._-]+/).filter((t) => t && !STOP.has(t)).join(" ");
  const scored = sections()
    .map((s) => {
      const heading = s.heading.toLowerCase();
      const title = s.title.toLowerCase();
      const body = s.text.toLowerCase();
      let score = 0;
      let matched = 0;
      for (const w of words) {
        const inBody = count(body, w);
        const inHeading = count(heading, w) > 0;
        const inTitle = count(title, w) > 0;
        if (inBody || inHeading || inTitle) matched++;
        score += Math.min(inBody, 8) + (inHeading ? 6 : 0) + (inTitle ? 4 : 0);
      }
      if (words.length > 1 && phrase.includes(" ")) score += 10 * Math.min(count(body, phrase), 3) + (heading.includes(phrase) ? 15 : 0);
      // A section that has every word of the question beats one that repeats a single word.
      return { s, score: score * (matched / words.length) ** 2 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const out: DocSection[] = [];
  let used = 0;
  for (const { s } of scored) {
    if (out.length >= limit) break;
    const room = SEARCH_LIMIT_CHARS - used;
    if (room < 400) break;
    const text = s.text.length > room ? `${s.text.slice(0, room)}\n…(cut: read the whole page with "page": "${s.page}")` : s.text;
    out.push({ ...s, text });
    used += text.length;
  }
  return out;
}

/** A page by its slug, title or URL: "quickstart", "Quickstart", "https://polyxd.com/docs/quickstart/". */
export function docPage(name: string): DocPage | undefined {
  const q = name.trim().toLowerCase().replace(/^https?:\/\/(www\.)?polyxd\.com/, "").replace(/^\/?docs\/?/, "").replace(/\/$/, "").replace(/\.md$/, "");
  return DOCS.find((p) => p.slug === q || p.title.toLowerCase() === q) ?? (q === "" || q === "index" ? DOCS.find((p) => p.slug === "") : undefined);
}
