/** The docs as Markdown for agents: each page, llms.txt and llms-full.txt (scripts/llms.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { absolute, htmlToMarkdown, llmsFullTxt, llmsTxt, markdownPath, pageMarkdown, type DocForLlms } from "../scripts/llms.ts";

const pages: DocForLlms[] = [
  { slug: "", title: "Introduction", description: "What Polyxd is.", section: "Start", markdown: "Read the [quickstart](/docs/quickstart/).", html: "" },
  { slug: "quickstart", title: "Quickstart", description: "Render a document.", section: "Start", markdown: "```bash\nnpm install @polyxd/react\n```", html: "" },
  {
    slug: "reference/components",
    title: "Components reference",
    description: "Every component.",
    section: "Reference",
    html: '<h2 id="card">Card<a class="anchor" href="#card">#</a></h2><p>A <code>Card</code> groups <a href="/docs/patterns/">related</a> content &amp; actions.</p><table><tr><th>Prop</th><th>Type</th></tr><tr><td>title</td><td>a | b</td></tr></table><script>alert(1)</script>',
  },
];

test("each page is served as Markdown beside its HTML, with site links made absolute", () => {
  assert.equal(markdownPath(""), "/docs/index.md");
  assert.equal(markdownPath("quickstart"), "/docs/quickstart.md");
  assert.equal(absolute("[a](/docs/x/) [b](//cdn.example) [c](https://x.dev/)"), "[a](https://polyxd.com/docs/x/) [b](//cdn.example) [c](https://x.dev/)");
  const intro = pageMarkdown(pages[0]);
  assert.match(intro, /^# Introduction\n\n> What Polyxd is\.\n\nSource: https:\/\/polyxd\.com\/docs\/\n/);
  assert.match(intro, /\(https:\/\/polyxd\.com\/docs\/quickstart\/\)/);
});

test("generated reference pages become readable Markdown: headings, code, links, tables, and no scripts", () => {
  const md = htmlToMarkdown(pages[2].html);
  assert.match(md, /^## Card$/m, "the anchor link is dropped");
  assert.match(md, /A `Card` groups \[related\]\(https:\/\/polyxd\.com\/docs\/patterns\/\) content & actions\./);
  assert.match(md, /\| Prop \| Type \|\n\| --- \| --- \|\n\| title \| a \\\| b \|/);
  assert.doesNotMatch(md, /alert/);
});

test("llms.txt indexes every page by section with its Markdown link; llms-full.txt has them all", () => {
  const index = llmsTxt(pages);
  assert.match(index, /^# Polyxd\n\n> /);
  assert.match(index, /## Start\n\n- \[Introduction\]\(https:\/\/polyxd\.com\/docs\/index\.md\): What Polyxd is\.\n- \[Quickstart\]/);
  assert.match(index, /## Reference\n\n- \[Components reference\]\(https:\/\/polyxd\.com\/docs\/reference\/components\.md\)/);
  assert.ok(index.includes("https://polyxd.com/llms-full.txt"));
  const full = llmsFullTxt(pages);
  for (const p of pages) assert.ok(full.includes(`# ${p.title}\n`), p.title);
  assert.ok(full.includes("npm install @polyxd/react"));
});
