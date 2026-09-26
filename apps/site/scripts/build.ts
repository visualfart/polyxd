/**
 * Builds polyxd.com into apps/site/dist:
 *   /                      landing page (src/index.html)
 *   /docs/…                Markdown in content/docs, plus reference pages generated from the spec's own JSON
 *   /gallery/              the live example gallery (apps/gallery, built with Vite)
 *   sitemap.xml, robots.txt, 404.html, assets
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PolyxdSurface, type UIDocument } from "@polyxd/react";
import { loadDesignSystem, loadContract } from "@polyxd/spec";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const SITE = here("../");
const REPO = here("../../../");
const DIST = join(SITE, "dist");
const ORIGIN = "https://polyxd.com";
const SECTIONS = ["Start", "Concepts", "Guides", "Reference", "Project"];

interface Page {
  slug: string; // "" for /docs/, "quickstart", "reference/components"
  title: string;
  description: string;
  section: string;
  order: number;
  html: string;
  toc: { id: string; text: string }[];
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const href = (slug: string) => (slug ? `/docs/${slug}/` : "/docs/");

// ---------- Shared chrome ----------

const LOGO = `<svg width="30" height="25" viewBox="0 0 34 28" fill="none" aria-hidden="true"><rect x="1" y="1" width="18" height="18" rx="9" stroke="currentColor" stroke-width="2"/><rect x="8" y="5" width="18" height="18" stroke="currentColor" stroke-width="2"/><rect x="15" y="9" width="18" height="18" rx="4" fill="#FF5A1F" stroke="currentColor" stroke-width="2"/></svg>`;

function head({ title, description, path, css = [] }: { title: string; description: string; path: string; css?: string[] }) {
  return `<meta name="theme-color" content="#f4f1ea">
<link rel="canonical" href="${ORIGIN}${path}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Polyxd">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${ORIGIN}${path}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400&family=Roboto:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/site.css">
${css.map((c) => `<link rel="stylesheet" href="${c}">`).join("\n")}`;
}

function header(current: "home" | "docs") {
  const cur = (k: string) => (k === current ? ' aria-current="page"' : "");
  return `<header class="site-header"><div class="wrap">
<a class="brand" href="/" aria-label="Polyxd home">${LOGO}<span class="brand-word">polyxd</span></a>
<nav class="site-nav" aria-label="Main">
<a class="nav-optional" href="/#how">How it works</a>
<a class="nav-optional" href="/docs/designers/">For design teams</a>
<a class="nav-wide" href="/gallery/">Gallery</a>
<a href="/docs/"${cur("docs")}>Docs</a>
<a class="btn btn-ink btn-small" href="/#access">Early access</a>
</nav></div></header>`;
}

const footer = `<footer class="site-footer"><div class="wrap">
<a class="brand" href="/" aria-label="Polyxd home">${LOGO}<span class="brand-word">polyxd</span></a>
<nav aria-label="Footer"><a href="/docs/">Docs</a><a href="/docs/reference/components/">Components</a><a href="/docs/verifier/">Verifier</a><a href="/gallery/">Gallery</a><a href="/#access">Early access</a></nav>
<span>© 2026 Polyxd · Apache-2.0 code, CC-BY-4.0 spec</span>
</div></footer>`;

// ---------- Markdown ----------

function renderMarkdown(md: string): { html: string; toc: Page["toc"] } {
  const toc: Page["toc"] = [];
  const seen = new Map<string, number>();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        let id = slugify(text) || "section";
        const n = seen.get(id) ?? 0;
        seen.set(id, n + 1);
        if (n) id = `${id}-${n}`;
        if (depth === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, "") });
        if (depth === 1) return `<h1>${text}</h1>\n`;
        return `<h${depth} id="${id}">${text}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n`;
      },
    },
  });
  const html = (marked.parse(md) as string).replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  return { html, toc };
}

function frontMatter(src: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta = Object.fromEntries(
    m[1]
      .split("\n")
      .map((l) => /^(\w+):\s*(.*)$/.exec(l))
      .filter(Boolean)
      .map((x) => [x![1], x![2].replace(/^["']|["']$/g, "")]),
  );
  return { meta, body: src.slice(m[0].length) };
}

async function markdownPages(): Promise<Page[]> {
  const dir = join(SITE, "content/docs");
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  return Promise.all(
    files.map(async (f) => {
      const { meta, body } = frontMatter(await readFile(join(dir, f), "utf8"));
      const { html, toc } = renderMarkdown(body.replace(/^\s*# .*\n/, ""));
      const slug = f === "index.md" ? "" : f.replace(/\.md$/, "");
      return { slug, title: meta.title ?? slug, description: meta.description ?? "", section: meta.section ?? "Concepts", order: Number(meta.order ?? 50), html, toc };
    }),
  );
}

// ---------- Generated reference pages ----------

const REF_NAMES: Record<string, string> = {
  DynamicString: "text or binding",
  DynamicNumber: "number or binding",
  DynamicBoolean: "boolean or binding",
  DynamicValue: "value or binding",
  Binding: "binding",
  Id: "component id",
  Key: "semantic key",
  Path: "JSON Pointer",
  Format: "format",
  Action: "action",
  ActionSpec: "{ label, action }",
  ChildList: "component ids",
  Template: "{ path, componentId }",
  Options: "options (list or from data)",
  Tone: "tone",
  Accessibility: "accessibility",
};

function typeOf(s: any): string {
  if (!s) return "";
  if (s.$ref) return REF_NAMES[s.$ref.replace("#/$defs/", "")] ?? s.$ref.replace("#/$defs/", "");
  if (s.enum) return s.enum.map((v: unknown) => `"${v}"`).join(" | ");
  if (s.type === "array") return `list of ${s.items?.type === "object" ? "objects" : typeOf(s.items)}`;
  if (s.type === "object") return "object";
  return String(s.type ?? "");
}

async function componentsPage(): Promise<Page> {
  const dir = join(REPO, "packages/spec/components");
  const comps = await Promise.all((await readdir(dir)).filter((f) => f.endsWith(".json")).map(async (f) => JSON.parse(await readFile(join(dir, f), "utf8"))));
  const order = ["structure", "content", "feedback", "input", "action", "flow"];
  comps.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
  const toc = comps.map((c) => ({ id: slugify(c.name), text: c.name }));
  const list = (xs: string[]) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const html = [
    `<p>Generated from <code>packages/spec/components/*.json</code>, the same source the schema, validator and renderer use. Every component also accepts <code>id</code>, <code>component</code>, <code>key</code>, <code>accessibility</code> and <code>visible</code>. For how these map onto the components of 13 design systems, and the 11 planned for v0.2, see <a href="/docs/reference/coverage/">design-system coverage</a>.</p>`,
    `<div class="table-wrap"><table><thead><tr><th>Component</th><th>Web</th><th>iOS</th><th>Android</th></tr></thead><tbody>${comps
      .map((c) => `<tr><td><a href="#${slugify(c.name)}"><strong>${c.name}</strong></a></td><td>${esc(c.mappings.web)}</td><td>${esc(c.mappings.ios)}</td><td>${esc(c.mappings.android)}</td></tr>`)
      .join("")}</tbody></table></div>`,
    ...comps.map((c) => {
      const props = Object.entries(c.props as Record<string, any>)
        .map(([name, s]) => `<tr><td><code>${name}</code>${c.required.includes(name) ? " <span class=\"tag\">required</span>" : ""}</td><td>${esc(typeOf(s))}</td><td>${esc(s.description ?? "")}</td></tr>`)
        .join("");
      return `<section class="ref-card"><h2 id="${slugify(c.name)}">${c.name}<span class="tag">${c.category}</span></h2>
<p>${esc(c.summary)}</p>
<div class="table-wrap"><table><thead><tr><th>Prop</th><th>Type</th><th>Notes</th></tr></thead><tbody>${props}</tbody></table></div>
<h3>Use when</h3>${list(c.whenToUse)}
<h3>Don't use when</h3>${list(c.whenNotToUse)}
<h3>Accessibility <span class="tag">${esc(c.accessibility.role)}</span></h3>${list(c.accessibility.requirements)}
<p><strong>Agents:</strong> ${esc(c.agent)}</p>
<h3>Rendering rules</h3>${list(c.rendering)}
<p><strong>A2UI:</strong> ${esc(c.a2ui)}</p></section>`;
    }),
  ].join("\n");
  return { slug: "reference/components", title: "Components reference", description: "All 26 semantic components: props, when to use them, accessibility, rendering rules and platform mappings.", section: "Reference", order: 30, html, toc };
}

/**
 * Design-system coverage: every component in 13 design systems, and what Polyxd calls it. The data
 * is research/components/build.py's output, committed as content/coverage.json.
 */
async function coveragePage(): Promise<Page> {
  const data = JSON.parse(await readFile(join(SITE, "content/coverage.json"), "utf8")) as {
    systems: string[];
    components: { name: string; group: string; isNew: boolean; summary: string; systems: number; covers: string[]; more: number; newVariants: [string, number][] }[];
    rows: [number, string, string, string, number][];
    counts: Record<string, number>;
    total: number;
    foundations: { name: string; count: number; summary: string; covers: string[] }[];
    patterns: { id: string; name: string; summary: string; covers: string[]; more: number }[];
    renderer: { name: string; summary: string; covers: string[]; more: number; systems: number }[];
  };
  const N = data.systems.length;
  const existing = data.components.filter((c) => !c.isNew).length;
  const planned = data.components.filter((c) => c.isNew).length;
  const covers = (xs: string[], more: number) => (xs.length ? `<p class="covers">Covers <em>${xs.map(esc).join(", ")}</em>${more ? ` and ${more} more` : ""}</p>` : "");
  const dots = (n: number) => `<span class="cov-dots" aria-hidden="true">${Array.from({ length: N }, (_, i) => `<i${i < n ? ' class="on"' : ""}></i>`).join("")}</span><span class="cov-n">${n} of ${N}</span>`;
  const card = (title: string, right: string, summary: string, body: string) =>
    `<article class="cov-card"><div class="cov-head"><code>${esc(title)}</code>${right}</div><p>${esc(summary)}</p>${body}</article>`;
  const groups = [...new Set(data.components.map((c) => c.group))];
  const toc = [
    { id: "components", text: "Components" },
    { id: "foundations", text: "Foundations" },
    { id: "patterns", text: "Patterns" },
    { id: "done-by-the-renderer", text: "Done by the renderer" },
    { id: "out-of-scope", text: "Out of scope" },
    { id: "every-component-by-system", text: "Every component, by system" },
  ];
  const outOf = data.counts["out:layout"] + data.counts["out:utility"] + data.counts["out:app-chrome"];
  const html = [
    `<p>Every component the 13 supported design systems document, read from their official documentation in September 2026, and what Polyxd calls it. Polyxd keeps one component per meaning, and each system's variety becomes a variant of it, so a generator picks from ${data.components.length} choices instead of ${data.total.toLocaleString("en-GB")}. Every component renders in every design system, including the ones that don't have it.</p>`,
    `<p><strong>${existing} components exist today</strong> (the <a href="/docs/reference/components/">components reference</a> has their props). <strong>${planned} are planned for spec v0.2</strong>, marked below; they came out of this survey. The survey itself, with the inventories and the mapping, is <code>research/components/</code> in the repository.</p>`,
    `<h2 id="components">Components<a class="anchor" href="#components" aria-label="Link to this section">#</a></h2>`,
    `<p>The bar on each card is how many of the ${N} systems have their own version. Dashed tags are variants v0.2 adds to a component that exists.</p>`,
    ...groups.map(
      (g) =>
        `<h3>${esc(g)}</h3><div class="cov-grid">${data.components
          .filter((c) => c.group === g)
          .map((c) =>
            card(
              c.name,
              `${c.isNew ? '<span class="tag tag-new">Planned · v0.2</span>' : ""}<span class="cov-right">${dots(c.systems)}</span>`,
              c.summary,
              covers(c.covers, c.more) + (c.newVariants.length ? `<div class="cov-variants" aria-label="New variants">${c.newVariants.map(([v, n]) => `<span title="${n} system${n > 1 ? "s" : ""}">${esc(v)}</span>`).join("")}</div>` : ""),
            ),
          )
          .join("")}</div>`,
    ),
    `<h2 id="foundations">Foundations<a class="anchor" href="#foundations" aria-label="Link to this section">#</a></h2>`,
    `<p>Not components: the 87 token roles every design-system pack provides and every component draws with. A team maps its own tokens onto these; the <a href="/docs/reference/tokens/">tokens reference</a> lists each one.</p>`,
    `<div class="cov-grid">${data.foundations.map((f) => card(f.name, `<span class="cov-right">${f.count} role${f.count > 1 ? "s" : ""}</span>`, f.summary, covers(f.covers, 0))).join("")}</div>`,
    `<h2 id="patterns">Patterns<a class="anchor" href="#patterns" aria-label="Link to this section">#</a></h2>`,
    `<p>Shapes for common jobs, made of components, each with rules the verifier checks. Design systems document these as guidance; Polyxd ships them as <a href="/docs/patterns/">checkable patterns</a>.</p>`,
    `<div class="cov-grid">${data.patterns.map((p) => card(p.name, "", p.summary, covers(p.covers, p.more))).join("")}</div>`,
    `<h2 id="done-by-the-renderer">Done by the renderer<a class="anchor" href="#done-by-the-renderer" aria-label="Link to this section">#</a></h2>`,
    `<p>Things a design system ships as components that a generated screen never has to describe: the renderer does them the same way every time, in that design system's style.</p>`,
    `<div class="cov-grid">${data.renderer.map((r) => card(r.name, `<span class="cov-right">${dots(r.systems)}</span>`, r.summary, covers(r.covers, r.more))).join("")}</div>`,
    `<h2 id="out-of-scope">Out of scope<a class="anchor" href="#out-of-scope" aria-label="Link to this section">#</a></h2>`,
    `<p>${outOf} of the ${data.total.toLocaleString("en-GB")} entries belong to the app around the screen, or to the code that builds it.</p>`,
    `<div class="cov-grid cov-grid-3">${[
      [data.counts["out:layout"], "Layout", "Box, Stack, Grid, Flex, Divider. The renderer lays out; a document only says what belongs together."],
      [data.counts["out:utility"], "Utilities", "Portals, theme providers, visually hidden text. Plumbing for developers, not meaning."],
      [data.counts["out:app-chrome"], "Your app's frame", "Site header and footer, cookie banners, command palettes, chat windows, and password fields: a product collects secrets in its own secure flows, never in a generated screen."],
    ]
      .map(([n, t, d]) => `<article class="cov-card"><div class="cov-head"><strong>${t}</strong><span class="cov-right">${n}</span></div><p>${d}</p></article>`)
      .join("")}</div>`,
    `<h2 id="every-component-by-system">Every component, by system<a class="anchor" href="#every-component-by-system" aria-label="Link to this section">#</a></h2>`,
    `<p>Search a name you know from your design system to see what Polyxd calls it.</p>`,
    `<div class="cov-tools"><input id="cov-q" type="search" placeholder="Search: segmented, snackbar, persona…" aria-label="Search components"><label>System <select id="cov-sys"><option value="">All ${N}</option>${data.systems.map((s, i) => `<option value="${i}">${esc(s)}</option>`).join("")}</select></label><label>Status <select id="cov-st"><option value="">All</option><option value="0">Covered today</option><option value="1">New variant in v0.2</option><option value="2">Planned component</option><option value="3">Not a component</option></select></label><span id="cov-count"></span></div>`,
    `<div class="table-wrap cov-table"><table><thead><tr><th>System</th><th>Their component</th><th>Polyxd</th><th>Variant</th><th>Status</th></tr></thead><tbody id="cov-rows"></tbody></table></div>`,
    `<script id="cov-data" type="application/json">${JSON.stringify({ systems: data.systems, rows: data.rows }).replace(/</g, "\\u003c")}</script>`,
    `<script>(() => {
  const D = JSON.parse(document.getElementById("cov-data").textContent);
  const q = document.getElementById("cov-q"), sys = document.getElementById("cov-sys"), st = document.getElementById("cov-st"), out = document.getElementById("cov-rows"), count = document.getElementById("cov-count");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LABEL = ["Covered today", "New variant", "Planned", "Not a component"];
  function render() {
    const needle = q.value.trim().toLowerCase();
    const rows = D.rows.filter((r) => (sys.value === "" || r[0] == sys.value) && (st.value === "" || r[4] == st.value) && (!needle || (r[1] + " " + r[2] + " " + r[3]).toLowerCase().includes(needle)));
    count.textContent = rows.length.toLocaleString("en-GB") + " of " + D.rows.length.toLocaleString("en-GB");
    out.innerHTML = rows.slice(0, 400).map((r) => {
      const t = r[2].startsWith("renderer:") ? "renderer" : r[2].startsWith("out:") ? "out of scope" : r[2];
      const v = r[2].startsWith("renderer:") ? r[2].slice(9) : r[2].startsWith("out:") ? r[2].slice(4) : r[3];
      return "<tr><td>" + esc(D.systems[r[0]]) + "</td><td>" + esc(r[1]) + "</td><td><code>" + esc(t) + "</code></td><td><code>" + esc(v) + "</code></td><td class='cov-st-" + r[4] + "'>" + LABEL[r[4]] + "</td></tr>";
    }).join("") + (rows.length > 400 ? "<tr><td colspan='5'>Showing the first 400. Narrow the search to see the rest.</td></tr>" : "");
  }
  [q, sys, st].forEach((el) => el.addEventListener("input", render));
  render();
})();</script>`,
  ].join("\n");
  return { slug: "reference/coverage", title: "Design-system coverage", description: `Every component in ${N} design systems, and what Polyxd calls it: ${data.components.length} semantic components, foundations, patterns, and what the renderer does itself.`, section: "Reference", order: 32, html, toc };
}

async function tokensPage(): Promise<Page> {
  const contract = await loadContract();
  const packs = ["material3", "carbon", "antd"];
  const loaded = await Promise.all(packs.map((p) => loadDesignSystem(join(REPO, `packages/ds-${p}/manifest.json`))));
  const light = loaded.map((l) => l.modes.get(l.manifest.defaultMode)!);
  const show = (t: { type: string; value: any } | undefined) => {
    if (!t) return "—";
    const v = t.value;
    if (t.type === "color") {
      const hex = typeof v === "string" ? v : v.hex;
      return `<span class="swatch" style="background:${esc(hex)}"></span><code>${esc(hex)}${v.alpha !== undefined && v.alpha < 1 ? ` / ${v.alpha}` : ""}</code>`;
    }
    if (t.type === "dimension" || t.type === "duration") return `<code>${v.value}${v.unit}</code>`;
    if (t.type === "typography") return `<code>${v.fontSize?.value}${v.fontSize?.unit}/${v.lineHeight} ${v.fontWeight}</code>`;
    if (t.type === "cubicBezier") return `<code>${v.join(", ")}</code>`;
    if (t.type === "shadow") return "<code>shadow</code>";
    return `<code>${esc(JSON.stringify(v))}</code>`;
  };
  const groups = new Map<string, string[]>();
  for (const name of Object.keys(contract.tokens)) {
    const g = name.split(".")[0];
    groups.set(g, [...(groups.get(g) ?? []), name]);
  }
  const toc = [...groups.keys()].map((g) => ({ id: g, text: g }));
  const html = [
    `<p>The semantic tier every design-system pack must provide, in every mode. Generated UIs and renderers only ever reference these names. Values below are each pack's light mode, resolved through its own primitive and system tiers.</p>`,
    `<p>The contract also requires ${contract.contrast.length} contrast pairs (WCAG 2.2 1.4.3 for text, 1.4.11 for graphics) and ${contract.constraints.length} constraints, such as body text of at least 16px. Check a pack with <code>npm run check-ds -w @polyxd/spec -- path/to/manifest.json</code>.</p>`,
    ...[...groups].map(
      ([g, names]) => `<h2 id="${g}">${g}</h2><div class="table-wrap"><table><thead><tr><th>Token</th><th>Material 3</th><th>Carbon</th><th>Ant Design</th></tr></thead><tbody>${names
        .map((n) => `<tr><td><code>${n}</code><br><small>${esc(contract.tokens[n].description)}</small></td>${light.map((set) => `<td>${show(set.get(n))}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>`,
    ),
  ].join("\n");
  return { slug: "reference/tokens", title: "Tokens reference", description: "The semantic token contract, with values from Material 3, Carbon and Ant Design.", section: "Reference", order: 31, html, toc };
}

// ---------- Docs layout ----------

function docsPage(page: Page, pages: Page[]) {
  const nav = SECTIONS.map((s) => {
    const items = pages.filter((p) => p.section === s);
    if (!items.length) return "";
    return `<h2>${s}</h2><ul>${items.map((p) => `<li><a href="${href(p.slug)}"${p.slug === page.slug ? ' aria-current="page"' : ""}>${esc(p.title)}</a></li>`).join("")}</ul>`;
  }).join("");
  const i = pages.indexOf(page);
  const prev = pages[i - 1];
  const next = pages[i + 1];
  const toc = page.toc.length > 1 ? `<aside class="docs-toc" aria-label="On this page"><h2>On this page</h2><ul>${page.toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join("")}</ul></aside>` : "<div></div>";
  const title = `${page.title} · Polyxd docs`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.description)}">
${head({ title, description: page.description, path: href(page.slug), css: ["/assets/docs.css"] })}
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
${header("docs")}
<div class="docs">
<nav class="docs-nav" aria-label="Documentation">
<button class="docs-nav-toggle" type="button" aria-expanded="false" aria-controls="docs-nav-inner">Menu · ${esc(page.title)}</button>
<div class="docs-nav-inner" id="docs-nav-inner">${nav}</div>
</nav>
<main id="content" class="prose">
<h1>${esc(page.title)}</h1>
${page.description ? `<p class="lede">${esc(page.description)}</p>` : ""}
${page.html}
<nav class="pager" aria-label="Previous and next">${prev ? `<a class="prev" href="${href(prev.slug)}"><span>Previous</span>${esc(prev.title)}</a>` : ""}${next ? `<a class="next" href="${href(next.slug)}"><span>Next</span>${esc(next.title)}</a>` : ""}</nav>
<p class="edit-note">Polyxd is an early preview. Found something unclear? It will get better with your feedback.</p>
</main>
${toc}
</div>
${footer}
<script>
(() => {
  const nav = document.querySelector(".docs-nav");
  const btn = nav.querySelector(".docs-nav-toggle");
  btn.addEventListener("click", () => {
    const open = !nav.hasAttribute("data-open");
    nav.toggleAttribute("data-open", open);
    btn.setAttribute("aria-expanded", String(open));
  });
})();
</script>
</body>
</html>
`;
}


// ---------- The landing page's demo ----------

/**
 * The same Confirm document, rendered by every pack the repo ships. The card's markup is fixed;
 * what changes between tabs is only which pack's theme block the surface asks for, exactly as in
 * the renderer. The themes come from @polyxd/react's compiled files, concatenated into one
 * stylesheet so the page depends on nothing built at request time.
 */
async function demoHtml(): Promise<{ html: string; themes: string; count: number; packs: { key: string; name: string }[] }> {
  // ds-kit is the shared builder, not a pack: a pack is a directory with a manifest.
  const dirs = (await readdir(join(REPO, "packages"))).filter((d) => d.startsWith("ds-") && existsSync(join(REPO, "packages", d, "manifest.json"))).sort();
  const packs = await Promise.all(
    dirs.map(async (dir) => {
      const manifest = JSON.parse(await readFile(join(REPO, "packages", dir, "manifest.json"), "utf8"));
      return { key: manifest.name as string, name: manifest.displayName as string };
    }),
  );
  // Material 3 first, because it is the one most people recognise; the rest keep pack order.
  packs.sort((a, b) => Number(b.key === "material3") - Number(a.key === "material3"));

  const card = `<div class="card"><div class="t">Send £250.00 to Alex Kim?</div><div class="d">The money leaves your account immediately and can't be recalled.</div><div><div class="row"><span>To</span><span>Alex Kim</span></div><div class="row"><span>Amount</span><span>£250.00</span></div></div><div class="acts"><span class="b b2">Cancel</span><span class="b b1">Send £250.00</span></div></div>`;
  const tabs = packs
    .map(
      (p, i) =>
        `<button type="button" role="tab" id="tab-${p.key}" aria-controls="render-${p.key}" aria-selected="${i === 0}"${i === 0 ? "" : ' tabindex="-1"'}>${esc(p.name)}</button>`,
    )
    .join("\n");
  const renders = packs
    .map(
      (p, i) =>
        `<figure class="render" id="render-${p.key}" role="tabpanel" aria-labelledby="tab-${p.key}"${i === 0 ? "" : " hidden"}>
<div class="stage" data-pxd-theme="${p.key}" data-pxd-mode="light" aria-hidden="true">${card}</div>
<figcaption><strong>${esc(p.name)}</strong><span>axe 0 · agent ✓</span></figcaption>
</figure>`,
    )
    .join("\n");

  const themeFiles = (await readdir(join(REPO, "packages/react/themes"))).filter((f) => f.endsWith(".css")).sort();
  const themes = (await Promise.all(themeFiles.map((f) => readFile(join(REPO, "packages/react/themes", f), "utf8")))).join("\n");

  return {
    count: packs.length,
    packs,
    themes,
    html: `<div class="demo-tabs" role="tablist" aria-label="Design system">\n${tabs}\n</div>\n\n<div class="renders">\n${renders}\n</div>`,
  };
}

// ---------- The landing page's scenarios ----------

/**
 * Real examples from the spec, rendered at build time by @polyxd/react in a pack each, so the
 * landing page shows what the renderer actually produces rather than a picture of it. Each one
 * is captioned with the request that would have produced it and links to the live gallery.
 */
const SCENARIOS: { file: string; ask: string; pack: string; width: number }[] = [
  { file: "travel-flight-results", ask: "flights to lisbon on friday", pack: "carbon", width: 640 },
  { file: "calendar-find-slot", ask: "find 30 minutes with priya this week", pack: "material3", width: 420 },
  { file: "shop-compare-plans", ask: "which plan should I pick", pack: "shadcn", width: 560 },
  { file: "tasks-list", ask: "what's on my plate today", pack: "polaris", width: 460 },
  { file: "settings-notifications", ask: "stop emailing me at night", pack: "govuk", width: 440 },
  { file: "money-balance-overview", ask: "how am I doing this month", pack: "fluent", width: 480 },
  { file: "shop-checkout", ask: "check out", pack: "spectrum", width: 460 },
  { file: "crm-account-record", ask: "show me acme", pack: "primer", width: 640 },
  { file: "personal-reading-log", ask: "log the book I finished", pack: "mantine", width: 440 },
  { file: "travel-booking-review", ask: "review my trip", pack: "radix", width: 480 },
];

async function scenariosHtml(packs: { key: string; name: string }[]): Promise<string> {
  const name = (key: string) => packs.find((p) => p.key === key)?.name ?? key;
  const items = await Promise.all(
    SCENARIOS.map(async (sc) => {
      const doc = JSON.parse(await readFile(join(REPO, "packages/spec/examples", `${sc.file}.json`), "utf8")) as UIDocument;
      const surface = renderToStaticMarkup(createElement(PolyxdSurface, { document: doc, theme: sc.pack }));
      return `<li class="specimen" style="--w:${sc.width}px">
<a class="specimen-link" href="/gallery/?example=${sc.file}&amp;theme=${sc.pack}"><span class="specimen-ask">${esc(sc.ask)}</span><span class="specimen-pack">${esc(name(sc.pack))}</span></a>
<div class="specimen-frame" data-pxd-theme="${sc.pack}" data-pxd-mode="light" inert aria-hidden="true">${surface}</div>
</li>`;
    }),
  );
  return items.join("\n");
}

// ---------- Build ----------

async function write(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

await rm(DIST, { recursive: true, force: true });
await cp(join(SITE, "src/assets"), join(DIST, "assets"), { recursive: true });

// GSAP and Lenis drive the landing page's motion. They ship as UMD builds, and we serve
// them from our own origin rather than a CDN, so the page depends on nothing third-party.
const VENDOR = ["gsap/dist/gsap.min.js", "gsap/dist/ScrollTrigger.min.js", "gsap/dist/SplitText.min.js", "gsap/dist/DrawSVGPlugin.min.js", "lenis/dist/lenis.min.js"];
await mkdir(join(DIST, "assets/vendor"), { recursive: true });
await Promise.all(VENDOR.map((f) => cp(join(REPO, "node_modules", f), join(DIST, "assets/vendor", f.split("/").pop()!))));
await write(join(DIST, "favicon.svg"), LOGO.replace('aria-hidden="true"', 'xmlns="http://www.w3.org/2000/svg"').replace(/currentColor/g, "#141414"));

const demo = await demoHtml();
await write(join(DIST, "assets/themes.css"), demo.themes);
await cp(join(REPO, "packages/react/src/styles.css"), join(DIST, "assets/renderer.css"));
const spelled = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
const landing = (await readFile(join(SITE, "src/index.html"), "utf8"))
  .replace("<!--HEAD-->", head({ title: "Polyxd — interfaces that show up when you need them", description: "Polyxd turns a request into a real, accessible interface, built from your design system, usable by people and agents, and gone when the task is done.", path: "/", css: ["/assets/themes.css", "/assets/renderer.css"] }))
  .replace("<!--HEADER-->", header("home"))
  .replace("<!--DEMO-->", demo.html)
  .replace("<!--PACKCOUNT-->", spelled[demo.count - 1] ?? String(demo.count))
  // The story's "any design system" act rolls through every pack by name; story.js reads the keys off these spans.
  .replace("<!--PACKNAMES-->", demo.packs.map((p) => `<span data-pack="${p.key}">${esc(p.name)}</span>`).join(""))
  .replace("<!--SCENARIOS-->", await scenariosHtml(demo.packs))
  .replace("<!--EXAMPLECOUNT-->", String((await readdir(join(REPO, "packages/spec/examples"))).filter((f) => f.endsWith(".json")).length))
  .replace("<!--FOOTER-->", footer);
await write(join(DIST, "index.html"), landing);

const pages = [...(await markdownPages()), await componentsPage(), await tokensPage(), await coveragePage()].sort(
  (a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.order - b.order,
);
for (const p of pages) await write(join(DIST, p.slug ? `docs/${p.slug}/index.html` : "docs/index.html"), docsPage(p, pages));

await write(
  join(DIST, "404.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not found · Polyxd</title>${head({ title: "Not found · Polyxd", description: "This page doesn't exist.", path: "/404" })}</head><body>${header("home")}<main class="section"><div class="wrap"><p class="eyebrow">404</p><h1 class="display" style="font-size:clamp(40px,6vw,80px);margin:16px 0 24px">This page stepped aside.</h1><p style="max-width:52ch;color:var(--ink-2)">Interfaces here are supposed to disappear when they're done, but this one never existed. Try the <a href="/docs/">docs</a> or go <a href="/">home</a>.</p></div></main>${footer}</body></html>`,
);

// The live gallery, served under /gallery/.
execFileSync("npx", ["vite", "build", "--base", "/gallery/", "--outDir", join(DIST, "gallery"), "--emptyOutDir", "--logLevel", "warn"], {
  cwd: join(REPO, "apps/gallery"),
  stdio: "inherit",
});

const urls = ["/", "/gallery/", ...pages.map((p) => href(p.slug))];
await write(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
await write(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);

console.log(`built ${pages.length} docs pages, landing, gallery → ${DIST}`);
