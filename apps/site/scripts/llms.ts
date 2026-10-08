/**
 * The docs as Markdown, for people to hand to their agents and for agents to read directly
 * (the llms.txt convention, https://llmstxt.org):
 *
 *   /docs/<page>.md     each docs page (the docs home is /docs/index.md), behind its "Copy page" button
 *   /llms.txt           an index: every page with a one-line summary and a link to its Markdown
 *   /llms-full.txt      every page in one file
 *
 * Written pages keep their own Markdown. The reference pages are generated as HTML from the spec,
 * so they go through a small HTML-to-Markdown pass that knows only the tags they use.
 */
export interface DocForLlms {
  slug: string;
  title: string;
  description: string;
  section: string;
  /** The page's own Markdown, when it was written as Markdown. */
  markdown?: string;
  html: string;
}

export const ORIGIN = "https://polyxd.com";

/** Where a page's Markdown is served: /docs/quickstart.md, /docs/index.md for the docs home. */
export const markdownPath = (slug: string) => `/docs/${slug || "index"}.md`;
const pageUrl = (slug: string) => `${ORIGIN}/docs/${slug ? `${slug}/` : ""}`;

/** Site links made absolute, so the Markdown still works pasted into a chat. */
export const absolute = (md: string) => md.replace(/\]\(\/(?!\/)/g, `](${ORIGIN}/`);

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

/** Markdown from the generated reference pages' HTML: headings, paragraphs, lists, code, tables and links. */
export function htmlToMarkdown(html: string): string {
  const inline = (s: string) =>
    decode(
      s
        .replace(/<a [^>]*class="anchor"[^>]*>.*?<\/a>/g, "")
        .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, (_, h: string, t: string) => `[${t.replace(/<[^>]+>/g, "")}](${h.startsWith("/") ? ORIGIN + h : h})`)
        .replace(/<code>(.*?)<\/code>/g, "`$1`")
        .replace(/<(strong|b)>(.*?)<\/\1>/g, "**$2**")
        .replace(/<(em|i)>(.*?)<\/\1>/g, "*$2*")
        .replace(/<br\s*\/?>/g, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
  const out: string[] = [];
  // Scripts and their data never belong in the text.
  const src = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const blocks = src.match(/<(h[1-6]|p|pre|ul|ol|table|article)\b[\s\S]*?<\/\1>/g) ?? [];
  for (const b of blocks) {
    const tag = /^<(\w+)/.exec(b)![1];
    if (/^h[1-6]$/.test(tag)) out.push(`${"#".repeat(Number(tag[1]))} ${inline(b)}`);
    else if (tag === "p") out.push(inline(b));
    else if (tag === "pre") out.push("```\n" + decode(b.replace(/<[^>]+>/g, "")).replace(/\n$/, "") + "\n```");
    else if (tag === "ul" || tag === "ol") out.push((b.match(/<li\b[\s\S]*?<\/li>/g) ?? []).map((li, i) => `${tag === "ol" ? `${i + 1}.` : "-"} ${inline(li)}`).join("\n"));
    else if (tag === "article") out.push(`- ${inline(b)}`);
    else if (tag === "table") {
      const rows = (b.match(/<tr\b[\s\S]*?<\/tr>/g) ?? []).map((tr) => (tr.match(/<t[hd]\b[\s\S]*?<\/t[hd]>/g) ?? []).map((c) => inline(c).replace(/\|/g, "\\|")));
      if (!rows.length) continue;
      const width = Math.max(...rows.map((r) => r.length));
      const line = (r: string[]) => `| ${[...r, ...Array(width - r.length).fill("")].join(" | ")} |`;
      out.push([line(rows[0]), `|${" --- |".repeat(width)}`, ...rows.slice(1).map(line)].join("\n"));
    }
  }
  return out.filter((x) => x.trim()).join("\n\n");
}

/** One page as a Markdown file: its title, summary and address, then the page. */
export function pageMarkdown(p: DocForLlms): string {
  const body = p.markdown !== undefined ? absolute(p.markdown.trim()) : htmlToMarkdown(p.html);
  return `# ${p.title}\n\n${p.description ? `> ${p.description}\n\n` : ""}Source: ${pageUrl(p.slug)}\n\n${body}\n`;
}

const SUMMARY =
  "Polyxd is an open spec, renderers and tools for UI that models generate and teams author: a small JSON document of meaning that renders natively in any design system (Material 3, Carbon, GOV.UK and ten more), checked by a verifier before anyone sees it. There is also a hosted MCP server at https://mcp.polyxd.com/mcp.";

/** The llms.txt index: the docs grouped by section, in the site's order, each linking to its Markdown. */
export function llmsTxt(pages: DocForLlms[]): string {
  const sections = [...new Set(pages.map((p) => p.section))];
  const groups = sections.map((s) => `## ${s}\n\n${pages.filter((p) => p.section === s).map((p) => `- [${p.title}](${ORIGIN}${markdownPath(p.slug)})${p.description ? `: ${p.description}` : ""}`).join("\n")}`);
  return `# Polyxd\n\n> ${SUMMARY}\n\nEvery page below is Markdown. All of them in one file: ${ORIGIN}/llms-full.txt\n\n${groups.join("\n\n")}\n\n## Optional\n\n- [Gallery](${ORIGIN}/gallery/): every example screen in every design system\n- [Demos](${ORIGIN}/demos/): four products built with Polyxd\n- [GitHub](https://github.com/visualfart/polyxd): the source, Apache-2.0\n`;
}

/** Every page in one file, in the site's order. */
export function llmsFullTxt(pages: DocForLlms[]): string {
  return `# Polyxd docs\n\n> ${SUMMARY}\n\n${pages.map(pageMarkdown).join("\n---\n\n")}`;
}
