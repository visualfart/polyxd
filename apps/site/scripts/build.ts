/**
 * Builds polyxd.com into apps/site/dist:
 *   /                      landing page (src/index.html)
 *   /docs/…                Markdown in content/docs, plus reference pages generated from the spec's own JSON
 *   /gallery/              the live example gallery (apps/gallery, built with Vite)
 *   sitemap.xml, robots.txt, 404.html, assets
 */
import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
const GITHUB = "https://github.com/visualfart/polyxd";
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

// ---------- Pack logos ----------

/**
 * Each pack's logo, as its manifest records it: the owner's official file for a real design
 * system, a Polyxd-made mark for a template, or (GOV.UK, whose crown and logotype are protected)
 * no image at all. The files are copied to /assets/packs/ and sit beside the pack's name, which
 * stays the label: the logo is decorative (alt="").
 */
const PACK_LOGOS = new Map<string, { src?: string; text?: string }>();
async function copyPackLogos() {
  for (const dir of (await readdir(join(REPO, "packages"))).filter((d) => d.startsWith("ds-") && existsSync(join(REPO, "packages", d, "manifest.json")))) {
    const m = JSON.parse(await readFile(join(REPO, "packages", dir, "manifest.json"), "utf8"));
    if (!m.logo) continue;
    if (!m.logo.file) {
      PACK_LOGOS.set(m.name, { text: m.logo.text });
      continue;
    }
    const file = `${m.name}${m.logo.file.slice(m.logo.file.lastIndexOf("."))}`;
    await mkdir(join(DIST, "assets/packs"), { recursive: true });
    await copyFile(join(REPO, "packages", dir, m.logo.file), join(DIST, "assets/packs", file));
    PACK_LOGOS.set(m.name, { src: `/assets/packs/${file}` });
  }
}
/**
 * A pack's logo on its tile, `size` px square. A pack with words instead of a logo gets nothing, or
 * in a column of names (`spacer`) an empty space the same size, so the names still line up.
 */
function packLogo(key: string, size: number | string = 20, spacer = false): string {
  const logo = PACK_LOGOS.get(key);
  if (!logo) return "";
  const box = typeof size === "number" ? `${size}px` : size;
  // A system whose logo is protected (GOV.UK's crown and logotype) gets its name, set in Polyxd's
  // own mono type on a plain tile, so rows of logos keep their rhythm without borrowing the mark.
  if (!logo.src) return logo.text ? `<span class="ds-logo ds-logo-text" style="--ds-logo:${box}" aria-hidden="true"><span>${esc(logo.text.split(" ")[0])}</span></span>` : spacer ? `<span class="ds-logo ds-logo-none" style="--ds-logo:${box}" aria-hidden="true"></span>` : "";
  const px = typeof size === "number" ? size : 40;
  return `<span class="ds-logo" style="--ds-logo:${box}" aria-hidden="true"><img src="${logo.src}" alt="" width="${px}" height="${px}" decoding="async"></span>`;
}
/** The logo, then the name as real text. */
const packName = (key: string, name: string, size: number | string = 20) => `<span class="ds-name">${packLogo(key, size)}<span>${esc(name)}</span></span>`;
/** Coverage and prose name a system in full; these are the packs those names mean. */
const PACK_BY_NAME: Record<string, string> = {
  "Material 3": "material3", "IBM Carbon": "carbon", Carbon: "carbon", "Ant Design": "antd", "Ant Design v5": "antd", "Fluent 2": "fluent", "shadcn/ui": "shadcn",
  "Bootstrap 5": "bootstrap", "Bootstrap 5.3": "bootstrap", Mantine: "mantine", "Radix Themes": "radix", "Shopify Polaris": "polaris", Polaris: "polaris", "GitHub Primer": "primer",
  "Adobe Spectrum 2": "spectrum", "GOV.UK Frontend": "govuk", "GOV.UK": "govuk", "Chakra UI v3": "chakra",
};

// ---------- Shared chrome ----------

import { mark, svg as markSvg, markSvg as livingMark, FONTS_URL, PAPER, NIGHT, type MarkState } from "../../../brand/build.ts";
/** The lockup: the mark (brand/build.ts, its pupil moved by brand/mark.css) beside the wordmark. */
const LOGO = `${livingMark({ size: 32 })}<span class="brand-word">polyxd</span>`;

/**
 * Each page's social card (scripts/og.ts renders them into og/png/, keyed by the path without its
 * slashes: "/" is "home"); a page without one gets the home card.
 */
const OG_DIR = join(SITE, "og/png");
const ogImage = (path: string) => {
  const key = path === "/" ? "home" : path.replace(/^\/|\/$/g, "").split("/").join("-");
  return existsSync(join(OG_DIR, `${key}.png`)) ? `/og/${key}.png` : "/og.png";
};

function head({ title, description, path, css = [] }: { title: string; description: string; path: string; css?: string[] }) {
  return `<script>try{var t=localStorage.getItem("pxd-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>
<meta name="theme-color" content="${PAPER}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${NIGHT}" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="${ORIGIN}${path}">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:image" content="${ORIGIN}${ogImage(path)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Polyxd">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${ORIGIN}${path}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_URL}">
<!-- Faces the design-system packs on the page render in; not Polyxd's own. -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400&family=Roboto:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/tokens.css">
<link rel="stylesheet" href="/assets/mark.css">
<link rel="stylesheet" href="/assets/site.css">
${css.map((c) => `<link rel="stylesheet" href="${c}">`).join("\n")}`;
}

/**
 * The theme switch: collapsed to one icon for the current theme; opens into System, Light and Dark,
 * then folds away. The choice is kept in localStorage and applied in <head> before the page paints.
 */
const ICON = {
  system: `<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg>`,
  light: `<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  dark: `<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 12.2A6.5 6.5 0 0 1 7.8 4.5a6.5 6.5 0 1 0 7.7 7.7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
};
const THEME_SWITCH = `<div class="theme-switch" data-theme-switch>
<button type="button" class="theme-toggle" aria-expanded="false" aria-controls="theme-options" aria-label="Theme: system. Change theme">${ICON.system}</button>
<div class="theme-options" id="theme-options" role="radiogroup" aria-label="Theme">
<button type="button" role="radio" aria-checked="true" data-set-theme="system" aria-label="System" title="System">${ICON.system}</button>
<button type="button" role="radio" aria-checked="false" data-set-theme="light" aria-label="Light" title="Light">${ICON.light}</button>
<button type="button" role="radio" aria-checked="false" data-set-theme="dark" aria-label="Dark" title="Dark">${ICON.dark}</button>
</div>
</div>`;
const THEME_SCRIPT = `<script>(() => {
  const root = document.documentElement, sw = document.querySelector("[data-theme-switch]");
  if (!sw) return;
  const toggle = sw.querySelector(".theme-toggle"), opts = [...sw.querySelectorAll("[data-set-theme]")];
  const get = () => { try { return localStorage.getItem("pxd-theme") || "system"; } catch { return "system"; } };
  const apply = (t) => {
    if (t === "system") root.removeAttribute("data-theme"); else root.dataset.theme = t;
    try { t === "system" ? localStorage.removeItem("pxd-theme") : localStorage.setItem("pxd-theme", t); } catch {}
    opts.forEach((o) => { const on = o.dataset.setTheme === t; o.setAttribute("aria-checked", String(on)); o.tabIndex = on ? 0 : -1; });
    toggle.innerHTML = sw.querySelector('[data-set-theme="' + t + '"]').innerHTML;
    toggle.setAttribute("aria-label", "Theme: " + t + ". Change theme");
  };
  const open = (v) => {
    sw.toggleAttribute("data-open", v);
    toggle.setAttribute("aria-expanded", String(v));
    if (v) sw.querySelector('[aria-checked="true"]').focus();
  };
  toggle.addEventListener("click", () => open(true));
  opts.forEach((o, i) => {
    o.addEventListener("click", () => { apply(o.dataset.setTheme); open(false); toggle.focus(); });
    o.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { e.preventDefault(); opts[(i + d + opts.length) % opts.length].focus(); }
    });
  });
  document.addEventListener("click", (e) => { if (!sw.contains(e.target)) open(false); });
  sw.addEventListener("keydown", (e) => { if (e.key === "Escape") { open(false); toggle.focus(); } });
  apply(get());
})();</script>`;

function header(current: string) {
  const cur = (k: string) => (k === current ? ' aria-current="page"' : "");
  return `<header class="site-header"><div class="wrap">
<a class="brand" href="/" aria-label="Polyxd home">${LOGO}</a>
<nav class="site-nav" aria-label="Main">
<a class="nav-optional" href="/how-it-works/"${cur("how-it-works")}>Product</a>
<a class="nav-optional" href="/design-systems/"${cur("design-systems")}>Design systems</a>
<a class="nav-wide" href="/verify/"${cur("verify")}>Verify</a>
<a class="nav-wide" href="/studio/"${cur("studio")}>Studio</a>
<a class="nav-wide" href="/demos/">Demos</a>
<a href="/docs/"${cur("docs")}>Docs</a>
<a class="nav-wide" href="${GITHUB}">GitHub</a>
${THEME_SWITCH}
<a class="btn btn-signal btn-small" href="/docs/quickstart/">Get started</a>
</nav></div></header>
${THEME_SCRIPT}`;
}

/**
 * The footer: signal orange, ink text (6.6:1), a band of ink dots from the home page's field, and
 * the lockup at full width in its one-colour ink form (an orange p would vanish on orange). The
 * pupil follows the pointer; the script is inline so every page, docs included, gets it.
 */
const footer = `<footer class="site-footer" aria-labelledby="footer-title">
<canvas class="footer-field" data-field data-rest="#141413" data-rest-alpha=".34" data-active="#F3F1EC" data-density=".8" data-quiet=".footer-line, .footer-actions, .footer-col, .footer-base" data-solid=".footer-giant .footer-mark, .footer-word" aria-hidden="true"></canvas>
<div class="wrap footer-top">
<p class="display footer-line" id="footer-title">Every ask gets a screen.</p>
<div class="footer-actions"><a class="btn footer-btn" href="/docs/quickstart/">Get started</a><a class="footer-quiet" href="https://studio.polyxd.com">Try Studio</a></div>
</div>
<div class="wrap footer-cols">
<nav aria-label="Footer">
<span class="footer-col"><b>Product</b><a href="/how-it-works/">How it works</a><a href="/design-systems/">Design systems</a><a href="/verify/">Verify</a><a href="/studio/">Studio</a></span>
<span class="footer-col"><b>For</b><a href="/designers/">Designers</a><a href="/design-system-teams/">Design-system teams</a><a href="/developers/">Engineers</a><a href="/product-teams/">Product teams</a></span>
<span class="footer-col"><b>Build</b><a href="/docs/">Docs</a><a href="/docs/quickstart/">Quickstart</a><a href="/gallery/">Gallery</a><a href="/demos/">Demos</a></span>
<span class="footer-col"><b>Open</b><a href="/open-source/">Open source</a><a href="${GITHUB}">GitHub</a><a href="/docs/roadmap/">Roadmap</a><a href="https://studio.polyxd.com">Try Studio</a></span>
</nav>
</div>
<div class="footer-giant" aria-hidden="true">${livingMark({ size: 320, mono: "ink", className: "footer-mark" })}<span class="footer-word">polyxd</span></div>
<div class="wrap footer-base"><span>© 2026 Polyxd</span><span>Apache-2.0 code · CC-BY-4.0 spec</span><a href="#">Back to top</a></div>
<script src="/assets/field.js" defer></script>
<script>(() => {
  const m = document.querySelector(".footer-mark"), p = m && m.querySelector(".pxb-pupil");
  if (!p || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  addEventListener("pointermove", (e) => {
    const r = m.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const ax = e.clientX - (r.left + r.width / 2), ay = e.clientY - (r.top + r.height / 2), d = Math.hypot(ax, ay) || 1, k = Math.min(1, d / 320) * 1.35;
    p.setAttribute("cx", (16 + (ax / d) * k).toFixed(2));
    p.setAttribute("cy", (16 + (ay / d) * k).toFixed(2));
  }, { passive: true });
})();</script>
</footer>`;

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
  const html = (marked.parse(md) as string)
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>")
    // A table row that names a pack by its package gets that pack's logo beside the name.
    .replace(/<td><code>@polyxd\/ds-([a-z0-9]+)<\/code>/g, (whole, key: string) => (PACK_LOGOS.has(key) ? `<td><span class="ds-name">${packLogo(key, 24, true)}<code>@polyxd/ds-${key}</code></span>` : whole));
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
  const order = ["shell", "structure", "content", "feedback", "input", "action", "flow"];
  comps.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
  const toc = comps.map((c) => ({ id: slugify(c.name), text: c.name }));
  const list = (xs: string[]) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const html = [
    `<p>Generated from <code>packages/spec/components/*.json</code>, the same source the schema, validator and renderer use. Every component also accepts <code>id</code>, <code>component</code>, <code>key</code>, <code>accessibility</code> and <code>visible</code>. For how these map onto the components of 13 design systems, see <a href="/docs/reference/coverage/">design-system coverage</a>.</p>`,
    `<p>The five <strong>shell</strong> components (<code>Frame</code>, <code>AppBar</code>, <code>Footer</code>, <code>Outlet</code>, <code>Custom</code>) are the product's frame around its screens. They belong only in a shell document (<code>surface.kind</code> <code>"shell"</code>, <code>surface.origin</code> <code>"authored"</code>), written once per product; the validator refuses them anywhere else, and a generator is never shown them. See <a href="/docs/authored-screens/#the-shell">Generated or authored</a>.</p>`,
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
  return { slug: "reference/components", title: "Components reference", description: `All ${comps.length} semantic components: props, when to use them, accessibility, rendering rules and platform mappings.`, section: "Reference", order: 30, html, toc };
}

/**
 * Design-system coverage: every component in 13 design systems, and what Polyxd calls it. The data
 * is research/components/build.py's output, committed as content/coverage.json.
 */
async function coveragePage(): Promise<Page> {
  const data = JSON.parse(await readFile(join(SITE, "content/coverage.json"), "utf8")) as {
    systems: string[];
    components: { name: string; group: string; isNew: boolean; since: string; authoredOnly: boolean; summary: string; systems: number; covers: string[]; more: number; newVariants: [string, number][] }[];
    rows: [number, string, string, string, number][];
    counts: Record<string, number>;
    total: number;
    foundations: { name: string; count: number; summary: string; covers: string[] }[];
    patterns: { id: string; name: string; summary: string; covers: string[]; more: number }[];
    renderer: { name: string; summary: string; covers: string[]; more: number; systems: number }[];
  };
  const N = data.systems.length;
  const added = (v: string) => data.components.filter((c) => c.since === v).length;
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
    `<p>All ${data.components.length} exist (the <a href="/docs/reference/components/">components reference</a> has their props). <strong>${added("0.2")} of them, and variants on the rest, were added in spec v0.2</strong> because this survey found them in the design systems and not in Polyxd. <strong>Spec v0.3 added ${added("0.3")} more</strong>: the product's shell (a frame, an app bar, a footer, an outlet and a slot for the host's own components) and side-by-side layout, which the survey had filed as app chrome and layout. Shell components are authored-only: a generator never writes them. The survey itself, with the inventories and the mapping, is <code>research/components/</code> in the repository.</p>`,
    `<h2 id="components">Components<a class="anchor" href="#components" aria-label="Link to this section">#</a></h2>`,
    `<p>The bar on each card is how many of the ${N} systems have their own version. Dashed tags are variants added in v0.2 and v0.3.</p>`,
    ...groups.map(
      (g) =>
        `<h3>${esc(g)}</h3>${
          g === "Shell"
            ? `<p>The frame around a product's screens, in the spec since v0.3 so it renders in the same design system as everything else. These are <strong>authored only</strong>: they live in a shell document (<code>surface.kind</code> <code>"shell"</code>, <code>surface.origin</code> <code>"authored"</code>), one per product, and the validator refuses them in a surface. A generator never sees them; its surfaces render in the shell's <code>Outlet</code>. Command palettes, skip links and phase banners are slots or regions of these rather than components of their own.</p>`
            : ""
        }<div class="cov-grid">${data.components
          .filter((c) => c.group === g)
          .map((c) =>
            card(
              c.name,
              `${c.isNew ? `<span class="tag tag-new">New in v${esc(c.since)}</span>` : ""}${c.authoredOnly ? '<span class="tag">Authored only</span>' : ""}<span class="cov-right">${dots(c.systems)}</span>`,
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
    `<p>${outOf} of the ${data.total.toLocaleString("en-GB")} entries are flows the product runs itself, or the code that builds it. The shell around a screen (header, navigation, footer) is no longer here: since v0.3 it is the shell components above, authored once per product.</p>`,
    `<div class="cov-grid cov-grid-3">${[
      [data.counts["out:layout"], "Layout primitives", "Box, Stack, Flex, Center, Divider, aspect ratio. The renderer lays out; a document says what belongs together, and Columns or Split when two things sit side by side."],
      [data.counts["out:utility"], "Utilities", "Portals, theme providers, visually hidden text. Plumbing for developers, not meaning."],
      [data.counts["out:app-chrome"], "The product's own flows", "Guided tours and coach marks, chat windows, cookie consent, sign-up, and password or card fields: a product collects secrets and consent in its own flows, never in a generated screen."],
    ]
      .map(([n, t, d]) => `<article class="cov-card"><div class="cov-head"><strong>${t}</strong><span class="cov-right">${n}</span></div><p>${d}</p></article>`)
      .join("")}</div>`,
    `<h2 id="every-component-by-system">Every component, by system<a class="anchor" href="#every-component-by-system" aria-label="Link to this section">#</a></h2>`,
    `<p>Search a name you know from your design system to see what Polyxd calls it.</p>`,
    `<div class="cov-tools"><input id="cov-q" type="search" placeholder="Search: segmented, snackbar, persona…" aria-label="Search components"><label>System <select id="cov-sys"><option value="">All ${N}</option>${data.systems.map((s, i) => `<option value="${i}">${esc(s)}</option>`).join("")}</select></label><label>Status <select id="cov-st"><option value="">All</option><option value="0">Covered</option><option value="3">Not a component</option></select></label><span id="cov-count"></span></div>`,
    `<div class="table-wrap cov-table"><table><thead><tr><th>System</th><th>Their component</th><th>Polyxd</th><th>Variant</th><th>Status</th></tr></thead><tbody id="cov-rows"></tbody></table></div>`,
    `<script id="cov-data" type="application/json">${JSON.stringify({ systems: data.systems, logos: data.systems.map((s) => packLogo(PACK_BY_NAME[s] ?? "", 20)), rows: data.rows }).replace(/</g, "\\u003c")}</script>`,
    `<script>(() => {
  const D = JSON.parse(document.getElementById("cov-data").textContent);
  const q = document.getElementById("cov-q"), sys = document.getElementById("cov-sys"), st = document.getElementById("cov-st"), out = document.getElementById("cov-rows"), count = document.getElementById("cov-count");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LABEL = ["Covered", "Covered", "Covered", "Not a component"];
  function render() {
    const needle = q.value.trim().toLowerCase();
    const rows = D.rows.filter((r) => (sys.value === "" || r[0] == sys.value) && (st.value === "" || r[4] == st.value) && (!needle || (r[1] + " " + r[2] + " " + r[3]).toLowerCase().includes(needle)));
    count.textContent = rows.length.toLocaleString("en-GB") + " of " + D.rows.length.toLocaleString("en-GB");
    out.innerHTML = rows.slice(0, 400).map((r) => {
      const t = r[2].startsWith("renderer:") ? "renderer" : r[2].startsWith("out:") ? "out of scope" : r[2];
      const v = r[2].startsWith("renderer:") ? r[2].slice(9) : r[2].startsWith("out:") ? r[2].slice(4) : r[3];
      return "<tr><td><span class='ds-name'>" + (D.logos[r[0]] || "") + "<span>" + esc(D.systems[r[0]]) + "</span></span></td><td>" + esc(r[1]) + "</td><td><code>" + esc(t) + "</code></td><td><code>" + esc(v) + "</code></td><td class='cov-st-" + r[4] + "'>" + LABEL[r[4]] + "</td></tr>";
    }).join("") + (rows.length > 400 ? "<tr><td colspan='5'>Showing the first 400. Narrow the search to see the rest.</td></tr>" : "");
  }
  [q, sys, st].forEach((el) => el.addEventListener("input", render));
  render();
})();</script>`,
  ].join("\n");
  return { slug: "reference/coverage", title: "All components", description: `The complete list: ${data.components.length} semantic components with what each of ${N} design systems calls them, plus the foundations, patterns and renderer behaviours that are not components.`, section: "Reference", order: 29, html, toc };
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
      ([g, names]) => `<h2 id="${g}">${g}</h2><div class="table-wrap"><table><thead><tr><th>Token</th>${packs.map((p, i) => `<th>${packName(p, ["Material 3", "Carbon", "Ant Design"][i], 20)}</th>`).join("")}</tr></thead><tbody>${names
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
  const manifests = await Promise.all(dirs.map(async (dir) => JSON.parse(await readFile(join(REPO, "packages", dir, "manifest.json"), "utf8"))));
  // The landing demo shows real design systems; the templates are counted separately (templateCount) and live in the gallery.
  const packs = manifests.filter((m) => !isTemplate(m)).map((manifest) => ({ key: manifest.name as string, name: manifest.displayName as string }));
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
<a class="specimen-link" href="/gallery/?example=${sc.file}&amp;theme=${sc.pack}"><span class="specimen-ask">${esc(sc.ask)}</span><span class="specimen-pack">${packName(sc.pack, name(sc.pack), 20)}</span></a>
<div class="specimen-frame" data-pxd-theme="${sc.pack}" data-pxd-mode="light" inert aria-hidden="true">${surface}</div>
</li>`;
    }),
  );
  return items.join("\n");
}

// ---------- The home page and landing pages: real screens, real logos ----------

/** The pack each demo product ships in. */
const DEMO_PACK: Record<string, string> = { halden: "material3", foundry: "shadcn", wexley: "govuk", quay: "polaris" };
const DEMO_NAME: Record<string, string> = { halden: "Halden", foundry: "Foundry", wexley: "Wexley Borough Council", quay: "Quay" };
const PACK_DISPLAY: Record<string, string> = {};
async function loadPackNames() {
  for (const dir of (await readdir(join(REPO, "packages"))).filter((d) => d.startsWith("ds-") && existsSync(join(REPO, "packages", d, "manifest.json")))) {
    const m = JSON.parse(await readFile(join(REPO, "packages", dir, "manifest.json"), "utf8"));
    PACK_DISPLAY[m.name] = m.displayName;
  }
}

/**
 * The hero's four asks. Each answer is a demo product's own verified document, with the data
 * snapshot it was verified against, rendered at build time by @polyxd/react in that product's pack.
 * Typed words reach an answer through the intent's keywords, the same way the demo's ask box does.
 */
const HERO_ASKS = [
  { product: "halden", intent: "money.send", chip: "Send £40 to Priya for dinner", extra: ["money", "priya", "owe", "split", "£"] },
  { product: "foundry", intent: "accounts.renewing-with-tickets", chip: "Renewals with open tickets", extra: ["renew", "renewal", "renewals", "tickets", "risk", "accounts"] },
  { product: "wexley", intent: "bin.missed", chip: "My bin wasn’t collected", extra: ["recycling", "rubbish", "council", "waste"] },
  { product: "quay", intent: "order.refund", chip: "Refund order #1042", extra: ["order", "return", "1042"] },
];

async function demoIntent(product: string, id: string) {
  const intent = JSON.parse(await readFile(join(REPO, "apps/demos", product, "intents", `${id}.json`), "utf8"));
  const report = JSON.parse(await readFile(join(REPO, "apps/demos", product, "reports", `${id}.json`), "utf8").catch(() => "null"));
  return { intent, report } as { intent: { title: string; ask: string[]; keywords?: string[]; document: UIDocument }; report: { score: number; targets: unknown[] } | null };
}

/** A document drawn by the real renderer in one pack; decorative copies are inert. */
function surfaceHtml(doc: UIDocument, pack: string, { mode = "light", inert = true, cls = "" } = {}) {
  const html = renderToStaticMarkup(createElement(PolyxdSurface, { document: doc, theme: pack, mode: mode as "light" | "dark" }));
  return `<div class="pxd-frame${cls ? ` ${cls}` : ""}" data-pxd-theme="${pack}" data-pxd-mode="${mode}"${inert ? ' inert aria-hidden="true"' : ""}>${html}</div>`;
}

async function heroAsksHtml(): Promise<{ chips: string; answers: string }> {
  const chips: string[] = [];
  const answers: string[] = [];
  for (const [i, a] of HERO_ASKS.entries()) {
    const { intent, report } = await demoIntent(a.product, a.intent);
    const pack = DEMO_PACK[a.product];
    const words = [...new Set([...(intent.keywords ?? []), ...a.extra].map((w) => w.toLowerCase()))];
    chips.push(`<button type="button" class="chip" data-ask="${i}">${esc(a.chip)}</button>`);
    answers.push(`<figure class="answer" data-answer="${i}" data-words="${esc(words.join("|"))}" data-pack-name="${esc(PACK_DISPLAY[pack])}" data-product="${esc(DEMO_NAME[a.product])}" hidden>
<p class="sr-only">${esc(intent.title)}, drawn by ${esc(DEMO_NAME[a.product])} in ${esc(PACK_DISPLAY[pack])}.</p>
<div class="answer-screen answer-${DEMO_DEVICE[a.product]}">${device(a.product, surfaceHtml(intent.document, pack), "answer")}</div>
<figcaption>${packName(pack, PACK_DISPLAY[pack], 20)}<span class="answer-score">${report ? `Checked in ${report.targets.length} renders · score ${report.score}` : "Checked"}</span><a href="/demos/${a.product}/">Open ${esc(DEMO_NAME[a.product].split(" ")[0])}</a></figcaption>
</figure>`);
  }
  return { chips: chips.join("\n"), answers: answers.join("\n") };
}

/** Short names for big type, as the gallery shows them. */
const SHORT: Record<string, string> = { material3: "Material 3", shadcn: "shadcn/ui", govuk: "GOV.UK", polaris: "Polaris", carbon: "Carbon", fluent: "Fluent 2" };
/** One document, the real renderer, a run of design systems: the home page's wipe. */
// Carbon last: the screen carries on from here into the dark "Checked" scene in Carbon's dark mode.
const WIPE_PACKS = ["material3", "shadcn", "govuk", "polaris", "fluent", "carbon"];
const DARK_PACK = "carbon";
async function packWipeHtml(): Promise<{ layers: string; names: string; tabs: string; count: number }> {
  const { intent } = await demoIntent("halden", "money.send");
  const n = WIPE_PACKS.length;
  const layers = WIPE_PACKS.map((p, i) => `<div class="wipe-layer" style="--i:${i === 0 ? -9 : i}">${surfaceHtml(intent.document, p)}</div>`).join("\n");
  const edges = WIPE_PACKS.slice(1).map((_, i) => `<i class="wipe-edge" style="--i:${i + 1}" aria-hidden="true"></i>`).join("");
  const names = WIPE_PACKS.map((p, i) => `<span class="wipe-name" style="--i:${i};--j:${i === n - 1 ? 99 : i + 1}">${packLogo(p, "0.7em")}<span>${esc(SHORT[p] ?? PACK_DISPLAY[p])}</span></span>`).join("\n");
  const tabs = WIPE_PACKS.map((p, i) => `<button type="button" class="wipe-tab" data-wipe="${i}" aria-pressed="${i === 0}">${packLogo(p, 18)}<span>${esc(SHORT[p] ?? PACK_DISPLAY[p])}</span></button>`).join("\n");
  return { layers: layers + edges, names, tabs, count: n };
}

/** The phone: a metal slab with edge thickness, buttons, the island, a status bar and a home indicator. */
const PHONE_STATUS = `<div class="phone-status" aria-hidden="true"><span class="phone-time">9:41</span><i class="phone-island"></i><svg class="phone-icons" width="54" height="12" viewBox="0 0 54 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="6" width="3" height="6" rx="1"/><rect x="10" y="3.5" width="3" height="8.5" rx="1"/><rect x="15" y="1" width="3" height="11" rx="1"/><rect x="26" y=".5" width="23" height="11" rx="3.5" fill="none" stroke="currentColor" stroke-opacity=".45"/><rect x="28" y="2.5" width="17" height="7" rx="2"/><rect x="50.5" y="4" width="1.8" height="4" rx=".9" fill-opacity=".45"/></svg></div>`;
const PHONE_BODY = `<i class="phone-depth" aria-hidden="true">${"<b></b>".repeat(8)}</i><i class="phone-btn phone-btn-power" aria-hidden="true"></i><i class="phone-btn phone-btn-vol1" aria-hidden="true"></i><i class="phone-btn phone-btn-vol2" aria-hidden="true"></i>`;
/**
 * A phone around `inner`. What's inside is laid out at a real phone's width (390px) and scaled to
 * the display (.fit, --k set by home.js), the way a phone shows an app, so a screen never reflows
 * into a cramped column. In a scene the phone is also a place the travelling phone stops at
 * (data-slot); the scene's own copy is what shows when nothing moves.
 */
function phoneHtml(inner: string, name: string, mode = "light", slot = true): string {
  return `<div class="phone-wrap${slot ? " slot-wrap" : ""}" data-phone="${name}"><div class="phone"${slot ? ` data-slot="${name}" data-mode="${mode}"` : ""}><div class="phone-screen phone-${mode}">${PHONE_STATUS}<div class="phone-view"><div class="fit" data-w="390">${inner}</div></div><i class="phone-home" aria-hidden="true"></i><i class="phone-glare" aria-hidden="true"></i></div>${PHONE_BODY}</div></div>`;
}

/** A desktop browser window, for products that live on a desk (Foundry): laid out at 1024px and scaled. */
function browserHtml(inner: string, host: string): string {
  return `<div class="browser"><div class="browser-bar" aria-hidden="true"><i></i><i></i><i></i><span class="browser-url">${esc(host)}</span></div><div class="browser-view"><div class="fit fit-wide" data-w="1024">${inner}</div></div></div>`;
}
/** A tablet in landscape: a dark bezel around a 1024px-wide layout. */
function tabletHtml(inner: string): string {
  return `<div class="tablet"><div class="tablet-view"><div class="fit fit-tab" data-w="1024">${inner}</div></div></div>`;
}

/** Each demo product's own device: Foundry is keyboard-first on a desk, the others are in a hand. */
const DEMO_DEVICE: Record<string, "phone" | "browser"> = { halden: "phone", foundry: "browser", wexley: "phone", quay: "phone" };
const device = (product: string, inner: string, name: string) =>
  DEMO_DEVICE[product] === "browser" ? browserHtml(inner, `${product}.polyxd.com`) : phoneHtml(inner, name, "light", false);

/** The app with no screen for the ask, as "the gap" shows it. */
const GAP_APP = `<div class="gap-app"><div class="gap-tiles"><span>Payments</span><span>Cards</span><span>Statements</span><span>Payees</span><span>Savings</span><span>Settings</span></div><div class="gap-stamp"><span class="mono">No screen</span></div><div class="gap-ask">Split Friday’s dinner with Priya</div></div>`;

/**
 * The phone that travels down the page, one device from start to finish: it arrives with an app
 * that has no screen for the ask, the answer is drawn inside it, it is restyled pack by pack,
 * checked at night, and its screen turns to dust. Fixed to the viewport and moved by home.js
 * between the scenes' phones (data-slot).
 */
function travellerHtml(doc: UIDocument): string {
  const layers = WIPE_PACKS.map((p, i) => `<div class="tv-layer" style="--i:${i === 0 ? -9 : i}">${surfaceHtml(doc, p)}</div>`).join("");
  const edges = WIPE_PACKS.slice(1).map((_, i) => `<i class="tv-edge" style="--i:${i + 1}"></i>`).join("");
  const view = `<div class="tv-app">${GAP_APP}</div><div class="tv-screen">${layers}<div class="tv-dark">${surfaceHtml(doc, DARK_PACK, { mode: "dark" })}</div>${edges}<i class="tv-scan"></i></div><div class="tv-rest">${livingMark({ state: "asleep", size: 72 })}</div>`;
  return `<div class="traveller" data-traveller aria-hidden="true" inert><div class="tv-tilt">${phoneHtml(view, "traveller", "light", false)}<div class="tv-dust" data-dust></div></div></div>`;
}

/**
 * Every kind of screen, at every size: real spec examples, rendered at build time in a spread of
 * packs and devices, in two rows the scroll slides past each other.
 */
const SHOWCASE: { file: string; ask: string; pack: string; device: "phone" | "tablet" | "browser" }[][] = [
  [
    { file: "calendar-find-slot", ask: "find 30 minutes with Priya", pack: "material3", device: "phone" },
    { file: "travel-flight-results", ask: "flights to Lisbon on Friday", pack: "carbon", device: "browser" },
    { file: "shop-checkout", ask: "check out", pack: "spectrum", device: "phone" },
    { file: "shop-compare-plans", ask: "which plan should I pick", pack: "shadcn", device: "tablet" },
    { file: "settings-notifications", ask: "stop emailing me at night", pack: "govuk", device: "phone" },
    { file: "crm-accounts-list", ask: "accounts over £50k", pack: "antd", device: "browser" },
    { file: "personal-habits", ask: "how are my habits", pack: "pastel", device: "phone" },
    { file: "travel-trip-overview", ask: "what’s the plan in Lisbon", pack: "editorial", device: "tablet" },
    { file: "tasks-add", ask: "remind me to call the bank", pack: "terminal", device: "phone" },
  ],
  [
    { file: "money-balance-overview", ask: "how am I doing this month", pack: "fluent", device: "tablet" },
    { file: "tasks-list", ask: "what’s on my plate today", pack: "polaris", device: "phone" },
    { file: "crm-account-record", ask: "show me Acme", pack: "primer", device: "browser" },
    { file: "storage-usage", ask: "why is my storage full", pack: "bootstrap", device: "phone" },
    { file: "team-members", ask: "who’s on the billing team", pack: "chakra", device: "browser" },
    { file: "shop-order-status", ask: "where’s my order", pack: "brutalist", device: "phone" },
    { file: "travel-booking-review", ask: "review my trip", pack: "radix", device: "tablet" },
    { file: "personal-reading-log", ask: "log the book I finished", pack: "mantine", device: "phone" },
    { file: "shop-browse-filter", ask: "desk lamps under £80", pack: "glass", device: "browser" },
  ],
];
async function showcaseHtml(): Promise<string> {
  const rows: string[] = [];
  for (const [r, row] of SHOWCASE.entries()) {
    const items = await Promise.all(row.map(async (it) => {
      const doc = JSON.parse(await readFile(join(REPO, "packages/spec/examples", `${it.file}.json`), "utf8")) as UIDocument;
      const inner = surfaceHtml(doc, it.pack);
      const dev = it.device === "phone" ? phoneHtml(inner, "show", "light", false) : it.device === "tablet" ? tabletHtml(inner) : browserHtml(inner, "app.example.com");
      return `<li class="show-item show-${it.device}"><div class="show-device">${dev}</div><p class="show-cap"><span class="show-ask">${esc(it.ask)}</span>${packName(it.pack, PACK_DISPLAY[it.pack] ?? it.pack, 18)}</p></li>`;
    }));
    rows.push(`<ul class="show-row show-row-${r}" aria-label="Examples">${items.join("")}</ul>`);
  }
  return rows.join("\n");
}

/** Who makes each pack and what it's like, as the gallery says it. */
const PACK_BY: Record<string, string> = {
  material3: "Google · Roboto", carbon: "IBM · IBM Plex Sans", antd: "Ant Group", fluent: "Microsoft · Segoe UI", shadcn: "Tailwind CSS v4",
  bootstrap: "Bootstrap team", mantine: "Mantine", radix: "WorkOS · indigo", polaris: "Shopify · Inter", primer: "GitHub · Mona Sans",
  spectrum: "Adobe · Source Sans", govuk: "GDS · one theme, no dark", chakra: "Chakra · Inter",
  sketch: "Hand-drawn · Caveat, Patrick Hand", wireframe: "Low-fidelity · greys, dashed, mono", editorial: "Serif display · Fraunces",
  brutalist: "Black, yellow, hard shadows", glass: "Translucent · cool, 20px", terminal: "Dark · JetBrains Mono, green",
  pastel: "Mint, lavender, peach · Nunito", civic: "Plain, high-contrast, large", finance: "Navy and gold · dense tables",
  health: "Calm teal, cream · roomy", neon: "Dark · magenta, cyan · Space Grotesk", mono: "One hue in every role · indigo",
};

/**
 * A band of every pack's logo, drifting slowly: the systems people already know in one row, the
 * templates in another. Point at one (or focus it, or tap it) and a card shows what's inside:
 * its colours and type as the pack defines them, and a real screen drawn in it.
 */
async function logoBandHtml(): Promise<string> {
  const dirs = (await readdir(join(REPO, "packages"))).filter((d) => d.startsWith("ds-") && existsSync(join(REPO, "packages", d, "manifest.json"))).sort();
  const ms = await Promise.all(dirs.map(async (d) => JSON.parse(await readFile(join(REPO, "packages", d, "manifest.json"), "utf8"))));
  const real = ms.filter((m) => !isTemplate(m));
  real.sort((a, b) => Number(b.name === "material3") - Number(a.name === "material3"));
  const templates = ms.filter(isTemplate);
  const confirm = JSON.parse(await readFile(join(REPO, "packages/spec/examples/money-send-confirm.json"), "utf8")) as UIDocument;
  const row = (list: any[], dup = false) =>
    list.map((m) => `<li><a class="lb-pill" href="/gallery/?theme=${m.name}" data-pack="${m.name}"${dup ? ' tabindex="-1"' : ""}>${packLogo(m.name, 32, true)}<span>${esc(m.displayName)}</span></a></li>`).join("");
  const lane = (label: string, list: any[], cls: string) =>
    `<div class="logo-lane ${cls}"><p class="eyebrow logo-lane-label">${label}</p><div class="logo-track"><div class="logo-marquee"><ul>${row(list)}</ul><ul aria-hidden="true">${row(list, true)}</ul></div></div></div>`;
  const sw = ["action-primary-background", "surface-subtle", "text-default", "text-link", "border-default", "status-success-emphasis"];
  const previews = ms
    .map(
      (m) => `<template data-pack-preview="${m.name}"><div class="pk-card">
<div class="pk-head">${packLogo(m.name, 36, true)}<div><b>${esc(m.displayName)}</b><span>${esc(PACK_BY[m.name] ?? "")}</span></div><span class="pk-kind">${isTemplate(m) ? "Template" : "Design system"}</span></div>
<div class="pk-body" data-pxd-theme="${m.name}" data-pxd-mode="light">
<div class="pk-swatches">${sw.map((t) => `<i style="background:var(--pxd-color-${t})"></i>`).join("")}</div>
<div class="pk-type"><span class="pk-aa" style="font-family:var(--pxd-type-title-page-family)">Aa</span><span style="font-family:var(--pxd-type-body-default-family)">Confirm payment to Alex Kim</span></div>
<div class="pk-example"><div class="fit" data-w="390">${surfaceHtml(confirm, m.name)}</div></div>
</div>
<p class="pk-foot">Open it in the gallery</p>
</div></template>`,
    )
    .join("\n");
  return `<section class="logo-band" aria-label="Design systems and templates Polyxd draws in">
${lane(`${real.length} design systems you already know`, real, "lane-systems")}
${lane(`${templates.length} templates to start from`, templates, "lane-templates")}
${previews}
<div class="pk-pop" hidden></div>
</section>`;
}

/** Every pack the repo ships, by its own logo: the real systems, then Polyxd's templates. */
async function packWallHtml(realOnly = false): Promise<string> {
  const dirs = (await readdir(join(REPO, "packages"))).filter((d) => d.startsWith("ds-") && existsSync(join(REPO, "packages", d, "manifest.json"))).sort();
  const ms = await Promise.all(dirs.map(async (d) => JSON.parse(await readFile(join(REPO, "packages", d, "manifest.json"), "utf8"))));
  const tile = (m: any) => `<li class="wall-tile">${packLogo(m.name, 36, true)}<span>${esc(m.displayName)}</span></li>`;
  const real = ms.filter((m) => !isTemplate(m));
  real.sort((a, b) => Number(b.name === "material3") - Number(a.name === "material3"));
  const systems = `<ul class="wall" aria-label="Design systems">${real.map(tile).join("")}</ul>`;
  if (realOnly) return `${systems}\n<p class="wall-more">And ${esc(ms.filter(isTemplate).map((m) => m.displayName).join(", "))}: templates to start from.</p>`;
  return `${systems}\n<ul class="wall wall-templates" aria-label="Templates">${ms.filter(isTemplate).map(tile).join("")}</ul>`;
}

/** The four demo products, each shown by the screen its ask box drew above. */
async function demoCardsHtml(): Promise<string> {
  const cards: string[] = [];
  for (const a of HERO_ASKS) {
    const { intent } = await demoIntent(a.product, a.intent);
    const pack = DEMO_PACK[a.product];
    cards.push(`<a class="demo-tile" href="/demos/${a.product}/">
<div class="demo-shot demo-${DEMO_DEVICE[a.product]}">${device(a.product, surfaceHtml(intent.document, pack), "demo")}</div>
<span class="demo-meta"><b>${esc(DEMO_NAME[a.product])}</b>${packName(pack, PACK_DISPLAY[pack], 18)}</span>
</a>`);
  }
  return cards.join("\n");
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
// Favicons: down to 12px the pupil stays (BRAND-2026.md), so the SVG favicon is the whole mark.
await write(join(DIST, "favicon.svg"), markSvg(mark()));
for (const f of ["icon-180.png", "icon-192.png", "icon-512.png", "favicon.ico"]) await copyFile(join(REPO, "brand", f), join(DIST, f));
// Social cards: one per page (scripts/og.ts), and the home card as the default /og.png.
if (existsSync(OG_DIR)) await cp(OG_DIR, join(DIST, "og"), { recursive: true });
await copyFile(existsSync(join(OG_DIR, "home.png")) ? join(OG_DIR, "home.png") : join(REPO, "brand/og.png"), join(DIST, "og.png"));
await write(join(DIST, "site.webmanifest"), JSON.stringify({
  name: "Polyxd", short_name: "Polyxd", start_url: "/", display: "browser", background_color: PAPER, theme_color: PAPER,
  icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
}, null, 2) + "\n");
// The brand's tokens and the mark's states, as brand/build.ts writes them.
for (const f of ["tokens.css", "mark.css"]) await copyFile(join(REPO, "brand", f), join(DIST, "assets", f));

await copyPackLogos();
const demo = await demoHtml();
await write(join(DIST, "assets/themes.css"), demo.themes);
await cp(join(REPO, "packages/react/src/styles.css"), join(DIST, "assets/renderer.css"));
const spelled = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
await loadPackNames();
const hero = await heroAsksHtml();
const send = await demoIntent("halden", "money.send");
const sent = await demoIntent("halden", "money.send.confirm");
const SCREENS: Record<string, string> = {
  TURN_SCREEN: surfaceHtml(send.intent.document, "material3"),
  CHECK_SCREEN: surfaceHtml(send.intent.document, DARK_PACK, { mode: "dark" }),
  GONE_SCREEN: surfaceHtml(send.intent.document, DARK_PACK),
  TRAVELLER: travellerHtml(send.intent.document),
};
const wipe = await packWipeHtml();
const counts = {
  PACKCOUNT: spelled[demo.count - 1] ?? String(demo.count),
  PACKCOUNTNUM: String(demo.count),
  TEMPLATECOUNT: await templateCount(),
  RENDERCOUNT: (await renderCount()).toLocaleString("en-GB"),
  RENDERCOUNTNUM: String(await renderCount()),
  EXAMPLECOUNT: String((await readdir(join(REPO, "packages/spec/examples"))).filter((f) => f.endsWith(".json")).length),
  COMPONENTCOUNT: String((await readdir(join(REPO, "packages/spec/components"))).filter((f) => f.endsWith(".json")).length),
};
// ---------- Studio: one button, followed from four places to one product ----------
/** Line icons for the Studio pages: one stroke, drawn on a 20px grid, in currentColor. */
const ICON_STROKE = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const ICONS: Record<string, string> = {
  import: `<path d="M10 3v9M6 8.5l4 4 4-4M3.5 13.5v3h13v-3" ${ICON_STROKE}/>`,
  check: `<path d="M10 2.8l6 2.4v4.3c0 3.7-2.6 6.3-6 7.7-3.4-1.4-6-4-6-7.7V5.2z" ${ICON_STROKE}/><path d="M7.3 10l1.9 1.9 3.6-3.8" ${ICON_STROKE}/>`,
  design: `<rect x="3" y="3.5" width="14" height="13" rx="3" ${ICON_STROKE}/><path d="M3 7.5h14M8 7.5v9" ${ICON_STROKE}/>`,
  export: `<path d="M7 6l-4 4 4 4M13 6l4 4-4 4M11 4.5l-2 11" ${ICON_STROKE}/>`,
  colour: `<path d="M10 3c3 3.8 5 6.4 5 8.9a5 5 0 0 1-10 0C5 9.4 7 6.8 10 3z" ${ICON_STROKE}/>`,
  space: `<rect x="2.5" y="7" width="15" height="6" rx="1.5" ${ICON_STROKE}/><path d="M6 7v2.5M9 7v3.5M12 7v2.5M15 7v3.5" ${ICON_STROKE}/>`,
  type: `<text x="10" y="14.5" text-anchor="middle" font-family="Young Serif, Georgia, serif" font-size="12" fill="currentColor">Aa</text>`,
  number: `<path d="M7.5 3.5l-1.5 13M13.5 3.5l-1.5 13M4 7.5h13M3 12.5h13" ${ICON_STROKE}/>`,
  shadow: `<rect x="3" y="3" width="10" height="10" rx="2.5" ${ICON_STROKE}/><path d="M16 7v6.5a3 3 0 0 1-3 3H7" ${ICON_STROKE}/>`,
  motion: `<path d="M3 15.5C8 15.5 11 4.5 17 4.5" ${ICON_STROKE}/><circle cx="17" cy="4.5" r="1.4" fill="currentColor"/>`,
  radius: `<path d="M4 16V9a5 5 0 0 1 5-5h7" ${ICON_STROKE}/>`,
  border: `<rect x="3.5" y="3.5" width="13" height="13" rx="3" ${ICON_STROKE}/><rect x="6.5" y="6.5" width="7" height="7" rx="1.5" ${ICON_STROKE} stroke-dasharray="2 2"/>`,
  package: `<path d="M10 2.5l7 3.5v8l-7 3.5-7-3.5V6z" ${ICON_STROKE}/><path d="M3 6l7 3.5L17 6M10 9.5v8" ${ICON_STROKE}/>`,
  file: `<path d="M5 2.5h6.5L15 6v11.5H5z" ${ICON_STROKE}/><path d="M11.5 2.5V6H15" ${ICON_STROKE}/>`,
  braces: `<path d="M7.5 3.5C5.5 3.5 5.5 5 5.5 7s-1.5 3-2 3c.5 0 2 1 2 3s0 3.5 2 3.5M12.5 3.5c2 0 2 1.5 2 3.5s1.5 3 2 3c-.5 0-2 1-2 3s0 3.5-2 3.5" ${ICON_STROKE}/>`,
  template: `<rect x="3" y="3" width="6" height="6" rx="1.5" ${ICON_STROKE}/><rect x="11" y="3" width="6" height="6" rx="1.5" ${ICON_STROKE}/><rect x="3" y="11" width="6" height="6" rx="1.5" ${ICON_STROKE}/><rect x="11" y="11" width="6" height="6" rx="1.5" ${ICON_STROKE}/>`,
  key: `<circle cx="7" cy="10" r="3.5" ${ICON_STROKE}/><path d="M10.5 10H17M14.5 10v3M17 10v2" ${ICON_STROKE}/>`,
  team: `<circle cx="7.5" cy="7" r="2.5" ${ICON_STROKE}/><circle cx="13.5" cy="8" r="2" ${ICON_STROKE}/><path d="M3 16c.5-2.8 2.3-4.2 4.5-4.2S11.5 13.2 12 16M12.5 12.3c2.2-.4 4 .8 4.5 3.2" ${ICON_STROKE}/>`,
  layers: `<path d="M10 3l7 3.5-7 3.5-7-3.5z" ${ICON_STROKE}/><path d="M3 10l7 3.5 7-3.5M3 13.5L10 17l7-3.5" ${ICON_STROKE}/>`,
  free: `<path d="M4 10.5l4 4 8-9" ${ICON_STROKE}/>`,
  open: `<rect x="4" y="9" width="12" height="8.5" rx="2" ${ICON_STROKE}/><path d="M7 9V6.5a3 3 0 0 1 5.8-1.1" ${ICON_STROKE}/><path d="M10 12.3v2" ${ICON_STROKE}/>`,
  editor: `<rect x="2.5" y="3.5" width="15" height="13" rx="2.5" ${ICON_STROKE}/><path d="M2.5 7h15M6.5 10.2l-1.6 1.6 1.6 1.6M10 13.4h3" ${ICON_STROKE}/>`,
  phone: `<rect x="5.5" y="2.5" width="9" height="15" rx="2.5" ${ICON_STROKE}/><path d="M9 15h2" ${ICON_STROKE}/>`,
  cube: `<path d="M10 2.5l6.5 3.7v7.6L10 17.5l-6.5-3.7V6.2z" ${ICON_STROKE}/><path d="M3.5 6.2L10 10l6.5-3.8M10 10v7.5" ${ICON_STROKE}/>`,
  // Framework marks, drawn simply in each project's own colours.
  react: `<g fill="none" stroke="#149ECA" stroke-width="1.1"><ellipse cx="10" cy="10" rx="8.6" ry="3.3"/><ellipse cx="10" cy="10" rx="8.6" ry="3.3" transform="rotate(60 10 10)"/><ellipse cx="10" cy="10" rx="8.6" ry="3.3" transform="rotate(120 10 10)"/></g><circle cx="10" cy="10" r="1.7" fill="#149ECA"/>`,
  vue: `<path d="M1.2 3h3.9L10 11.4 14.9 3h3.9L10 18z" fill="#41B883"/><path d="M5.1 3h3.1L10 6.1 11.8 3h3.1L10 11.4z" fill="#35495E"/>`,
  svelte: `<path d="M13.6 4.2c-1.9-1.4-4.5-.9-5.9 1L5.6 8.1c-1.3 1.8-.8 4.2 1.1 5.1M6.4 15.8c1.9 1.4 4.5.9 5.9-1l2.1-2.9c1.3-1.8.8-4.2-1.1-5.1" fill="none" stroke="#FF3E00" stroke-width="2.4" stroke-linecap="round"/>`,
  webc: `<path d="M6.5 5L2.5 10l4 5M13.5 5l4 5-4 5" fill="none" stroke="#2A8CD6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="8" y="7.2" width="4" height="5.6" rx="1.2" fill="#2A8CD6"/>`,
  server: `<rect x="3" y="3.5" width="14" height="5.5" rx="1.5" ${ICON_STROKE}/><rect x="3" y="11" width="14" height="5.5" rx="1.5" ${ICON_STROKE}/><path d="M6 6.25h.01M6 13.75h.01" ${ICON_STROKE} stroke-width="2.2"/>`,
};
const icon = (name: string, size = 22) => `<svg class="ico-svg" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;

/**
 * The Continue button as a redline: the button drawn at 1.5x, and every token it uses measured
 * or pointed at, in one SVG so it scales as a whole. Mono text is 0.6em a character, so the
 * chips are sized from their text.
 */
function redlineSvg(): string {
  const CH = 6.6;
  const chip = (x: number, y: number, text: string, value: string, glyph = "", mark = false) => {
    const pre = glyph ? 20 : 0;
    const chars = value.length + (text ? text.length + 1 : 0);
    const w = Math.round(18 + pre + chars * CH);
    const t = value && text ? (mark ? `<tspan class="rl-v">${esc(value)}</tspan> ${esc(text)}` : `${esc(text)} <tspan class="rl-v">${esc(value)}</tspan>`) : esc(text || value);
    return `<g class="rl-chip${mark ? " rl-m" : ""}" transform="translate(${x} ${y})"><rect width="${w}" height="24" rx="7"/>${glyph ? `<g transform="translate(9 5)">${glyph}</g>` : ""}<text x="${9 + pre}" y="16">${t}</text></g>`;
  };
  const g = {
    radius: `<path d="M1 13V7a6 6 0 0 1 6-6h6" fill="none" stroke="#FF6E40" stroke-width="2"/>`,
    type: `<text x="7" y="11.5" text-anchor="middle" class="rl-serif">Aa</text>`,
    bg: `<rect width="14" height="14" rx="4" fill="#2F5BEA"/>`,
    border: `<rect x="1" y="1" width="12" height="12" rx="3.5" fill="none" stroke="#2448C0" stroke-width="2"/>`,
    shadow: `<rect x="0" y="1" width="14" height="10" rx="3" class="rl-fill" filter="url(#rl-sh)"/>`,
  };
  return `<svg class="redline" viewBox="0 0 620 330" role="img" aria-labelledby="rl-t">
<title id="rl-t">The Continue button, measured: its padding, corner radius, label type, background, border and shadow, each pointing to the token it uses.</title>
<defs><pattern id="rl-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" class="rl-gridline"/></pattern>
<filter id="rl-sh" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity=".35"/></filter>
<filter id="rl-btn" x="-30%" y="-40%" width="160%" height="200%"><feDropShadow dx="0" dy="9" stdDeviation="7" flood-color="#2F5BEA" flood-opacity=".55"/></filter></defs>
<rect class="rl-panel" x=".5" y=".5" width="619" height="329" rx="24"/>
<rect x=".5" y=".5" width="619" height="329" rx="24" fill="url(#rl-grid)"/>
<text x="20" y="28" class="rl-title">BUTTON · PRIMARY · 1.5×</text>
<g class="rl-button"><rect x="220.75" y="128.75" width="188.5" height="64.5" rx="14.25" fill="#2F5BEA" stroke="#2448C0" stroke-width="1.5" filter="url(#rl-btn)"/>
<text x="315" y="169" text-anchor="middle" class="rl-label">Continue</text></g>
<g class="rl-dim"><path d="M220 100v26M262 100v26M190 128h28M190 143h28" stroke-dasharray="2 2" stroke-width="1"/><path d="M220 108h42M220 103v10M262 103v10M196 128v15M191 128h10M191 143h10" stroke-width="1.5"/></g>
<path class="rl-arc" d="M394 128.8 A15 15 0 0 1 409.2 144"/>
<g class="rl-lead"><path d="M405 133 L446 102M318 150V56M244 180v82M410 172h60M392 208l78 40"/>
<ellipse cx="315" cy="206" rx="86" ry="7" stroke-dasharray="3 3"/>
<circle cx="405" cy="133" r="3" class="rl-dot"/><circle cx="318" cy="150" r="3" class="rl-ring"/><circle cx="244" cy="180" r="3" class="rl-ring"/><circle cx="410" cy="172" r="3" class="rl-dot"/><circle cx="392" cy="208" r="3" class="rl-dot"/></g>
${chip(118, 72, "button.padding.x", "28", "", true)}
${chip(40, 123, "button.padding.y", "10", "", true)}
${chip(446, 78, "radius.control", "10", g.radius)}
${chip(236, 32, "type.label", "16/24 · 600", g.type)}
${chip(152, 262, "action.primary", "#2F5BEA", g.bg)}
${chip(470, 160, "border.strong", "1", g.border)}
${chip(470, 236, "shadow.raised", "", g.shadow)}
</svg>`;
}

/** The tokens editor, small: the three tiers, every type, a colour ramp and a card per type. */
const TOKENS_WINDOW = `<div class="tw" aria-hidden="true">
<div class="browser-bar"><i></i><i></i><i></i><span class="browser-url">studio.polyxd.com/w/acme/tokens</span></div>
<div class="tw-body">
<div class="tw-head"><span class="tw-tiers"><span class="on">Primitive</span><span>Semantic</span><span>Component</span></span><span class="tw-types">${["colour", "type", "space", "radius", "border", "shadow", "motion"].map((k) => icon(k, 18)).join("")}</span></div>
<div class="tw-ramp">${["#EEF2FE", "#DCE4FD", "#B9C9FB", "#8FA8F6", "#5F80F0", "#2F5BEA", "#2448C0", "#1C3896", "#15296E", "#0E1B48"].map((c, i) => `<i style="background:${c}"${i === 5 ? ' class="on"' : ""}></i>`).join("")}</div>
<div class="tw-cards">
<span class="tw-space"><i></i><i></i><i></i><i class="on"></i><i></i></span>
<span class="tw-radius"><i></i><i class="on"></i><i></i></span>
<span class="tw-type"><b>Aa</b><span>Aa</span><small>Aa</small></span>
<span class="tw-shadow"><i></i><i></i></span>
</div>
</div>
</div>`;

const sendForm = JSON.parse(await readFile(join(REPO, "packages/spec/examples/money-send-form.json"), "utf8")) as UIDocument;
const acme = (inner: string, cls = "") => `<div class="acme${cls ? ` ${cls}` : ""}">${inner}</div>`;
const STUDIO: Record<string, string> = {
  ST_REDLINE: redlineSvg(),
  ST_WINDOW: TOKENS_WINDOW,
  ST_TUNE_PHONE: acme(phoneHtml(surfaceHtml(sendForm, "mono"), "tune", "light", false)),
  ST_TUNE_DESK: acme(browserHtml(surfaceHtml(sendForm, "mono"), "acme.app")),
  ST_DESIGN_SCREEN: acme(surfaceHtml(sendForm, "mono"), "tuned"),
  ST_DELIVER_PHONE: acme(phoneHtml(surfaceHtml(sendForm, "mono"), "deliver", "light", false), "tuned"),
  ROLE_DOTS: Array.from({ length: 87 }, (_, i) => `<i style="--n:${i}"></i>`).join(""),
};

async function replaceAsync(s: string, re: RegExp, fn: (...m: string[]) => Promise<string>): Promise<string> {
  const parts = await Promise.all([...s.matchAll(re)].map((m) => fn(...(m as unknown as string[]))));
  let i = 0;
  return s.replace(re, () => parts[i++]);
}
/** Fills a page's placeholders: the shared chrome, the real renders, the counts and the living mark. */
async function fill(html: string, { title, description, path, current = "home" }: { title: string; description: string; path: string; current?: string }): Promise<string> {
  // Scenes first: they carry placeholders of their own.
  html = await replaceAsync(html, /<!--SCENE:([a-z]+)-->/g, async (_, name: string) => readFile(join(SITE, "src/scenes", `${name}.html`), "utf8"));
  html = html.replace(/<!--PHONE:(\w+):(\w+)-->([\s\S]*?)<!--\/PHONE-->/g, (_, name: string, mode: string, inner: string) => phoneHtml(inner, name, mode));
  let out = html
    .replace("<!--HEAD-->", head({ title, description, path, css: ["/assets/themes.css", "/assets/renderer.css", "/assets/home.css", "/assets/studio.css"] }))
    .replace("<!--HEADER-->", header(current))
    .replace("<!--FOOTER-->", footer)
    .replace("<!--HERO_CHIPS-->", hero.chips)
    .replace("<!--HERO_ANSWERS-->", hero.answers)
    .replace("<!--WIPE_LAYERS-->", wipe.layers)
    .replace("<!--WIPE_NAMES-->", wipe.names)
    .replace("<!--WIPE_TABS-->", wipe.tabs)
    .replace(/<!--WIPE_COUNT-->/g, String(wipe.count));
  if (out.includes("<!--PACK_WALL-->")) out = out.replace("<!--PACK_WALL-->", await packWallHtml());
  if (out.includes("<!--PACK_WALL_SYSTEMS-->")) out = out.replace("<!--PACK_WALL_SYSTEMS-->", await packWallHtml(true));
  if (out.includes("<!--DEMO_TILES-->")) out = out.replace("<!--DEMO_TILES-->", await demoCardsHtml());
  if (out.includes("<!--SHOWCASE-->")) out = out.replace("<!--SHOWCASE-->", await showcaseHtml());
  if (out.includes("<!--LOGO_BAND-->")) out = out.replace("<!--LOGO_BAND-->", await logoBandHtml());
  if (out.includes("<!--SCENARIOS-->")) out = out.replace("<!--SCENARIOS-->", await scenariosHtml(demo.packs));
  for (const [k, v] of Object.entries({ ...counts, ...SCREENS, ...STUDIO, GAP_APP })) out = out.replaceAll(`<!--${k}-->`, v);
  return out
    .replace(/<!--ICON:([a-z]+)(?::(\d+))?-->/g, (_, name: string, size?: string) => icon(name, size ? Number(size) : 22))
    .replace(/<!--PACKLOGO:([a-z0-9]+)(?::(\d+))?-->/g, (_, key: string, size?: string) => packLogo(key, size ? Number(size) : 24))
    // <!--MARK:state:size:class--> places the living mark (only its pupil moves).
    .replace(/<!--MARK:(\w+):(\d+)(?::([\w-]+))?-->/g, (_, state: MarkState, size: string, className?: string) => livingMark({ state, size: Number(size), className }));
}
const landing = await fill(await readFile(join(SITE, "src/index.html"), "utf8"), {
  title: "Polyxd: every ask gets a screen",
  description: "Apps only have the screens someone built in advance. Polyxd draws the rest on demand, in your own design system, and checks each one before anyone sees it.",
  path: "/",
});
await write(join(DIST, "index.html"), landing);

// ---------- The landing pages ----------
// Each is the home page's cut for one reader: a hero on the same dot field, then scenes from
// src/scenes and a few short blocks. Nothing here claims what the roadmap only plans.

type Block =
  | { scene: string }
  | { points: { title: string; items: [string, string][] } }
  | { term: { title: string; lead: string; code: string; link?: [string, string] } }
  | { wall: string }
  | { specimens: string }
  | { note: string };
interface LandingPage {
  slug: string;
  nav?: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  ctas: [string, string][];
  art: string;
  blocks: Block[];
}

const art = {
  screen: (doc: UIDocument, pack: string, mode = "light") => `<div class="art-phone"><i class="art-halo"></i>${phoneHtml(surfaceHtml(doc, pack, { mode }), "art", mode, false)}</div>`,
  wall: () => {
    const keys = ["material3", "carbon", "shadcn", "polaris", "fluent", "antd", "primer", "spectrum", "chakra", "mantine", "radix", "bootstrap"];
    return `<div class="art-wall">${keys.map((k, i) => `<span style="--i:${i}">${packLogo(k, 44)}</span>`).join("")}</div>`;
  },
  term: (code: string) => `<pre class="term mono art-term">${code}</pre>`,
  mark: () => `<div class="art-mark">${livingMark({ state: "looking", size: 280 })}</div>`,
};

function blockHtml(b: Block): string {
  if ("scene" in b) return `<!--SCENE:${b.scene}-->`;
  if ("points" in b)
    return `<section class="section block-points"><div class="wrap"><h2 class="display block-title">${esc(b.points.title)}</h2><ol class="points">${b.points.items
      .map(([t, d], i) => `<li><span class="mono point-n">${String(i + 1).padStart(2, "0")}</span><h3>${esc(t)}</h3><p>${d}</p></li>`)
      .join("")}</ol></div></section>`;
  if ("term" in b)
    return `<section class="section block-term"><div class="wrap block-split"><div><h2 class="display block-title">${esc(b.term.title)}</h2><p class="block-lead">${b.term.lead}</p>${b.term.link ? `<a class="panel-link" href="${b.term.link[1]}">${esc(b.term.link[0])}</a>` : ""}</div><pre class="term mono">${b.term.code}</pre></div></section>`;
  if ("wall" in b) return `<section class="section block-wall"><div class="wrap"><h2 class="display block-title">${esc(b.wall)}</h2><!--PACK_WALL--></div></section>`;
  if ("specimens" in b) return `<section class="section block-specimens"><div class="wrap"><h2 class="display block-title">${esc(b.specimens)}</h2><ul class="specimens"><!--SCENARIOS--></ul></div></section>`;
  return `<section class="section block-note"><div class="wrap"><p>${b.note}</p></div></section>`;
}

const cta = (label: string, href: string, primary = false) => `<a class="btn ${primary ? "btn-signal" : "btn-line"}" href="${href}">${esc(label)}</a>`;
const refund = await demoIntent("quay", "order.refund");
const renewals = await demoIntent("foundry", "accounts.renewing-with-tickets");

const LANDING_PAGES: LandingPage[] = [
  {
    slug: "how-it-works", nav: "how-it-works",
    title: "How Polyxd works", description: "A model, a template or a designer writes a small document. Your product draws it with your design system. A verifier checks it first.",
    eyebrow: "How it works", h1: "Polyxd turns the answer into a screen.",
    lead: "A small document says what the screen means. Your design system draws it. A verifier checks it before anyone sees it.",
    ctas: [["Get started", "/docs/quickstart/"], ["Try Studio", "https://studio.polyxd.com"]],
    art: art.screen(send.intent.document, "material3"),
    blocks: [
      { scene: "gap" }, { scene: "turn" },
      { points: { title: "Four layers. Your generator touches one.", items: [
        ["The ask", "Typed, spoken, or sent by someone else’s agent."],
        ["A document", `${counts.COMPONENTCOUNT} components, bound to data your app supplies. UI is data, never code.`],
        ["Your design system", "The real renderer draws it with your tokens, in React, Web Components, Vue or Svelte."],
        ["The check", "Schema, patterns, allowed actions, accessibility and an agent task, before it is shown."],
      ] } },
      { scene: "check" }, { scene: "gone" },
    ],
  },
  {
    slug: "design-systems", nav: "design-systems",
    title: "Design systems · Polyxd", description: `${counts.PACKCOUNTNUM} established design systems and ${counts.TEMPLATECOUNT} templates, drawn by the real renderer. Or bring yours with one command.`,
    eyebrow: "Design systems", h1: "Drawn in your design system. Not ours.",
    lead: `${counts.PACKCOUNTNUM} established systems and ${counts.TEMPLATECOUNT} templates, drawn by the real renderer. Or bring yours with one command.`,
    ctas: [["Bring your design system", "/docs/your-design-system/"], ["Browse the gallery", "/gallery/"]],
    art: art.wall(),
    blocks: [
      { scene: "wipe" },
      { wall: "Every pack, by its own logo." },
      { term: { title: "Bring yours in one command.", lead: "Point it at your CSS variables. It maps them onto 87 roles, writes down every guess, and names every colour pair that fails.", code: `<span class="dim">$</span> npx polyxd pack ./tokens.css\n--brand-600   → <em>action.primary</em>\n--gray-50     → <em>surface.base</em>\n--gray-900    → <em>text.primary</em>\n<span class="dim">…every guess written to pack.notes.md</span>\n\n<span class="dim">$</span> npx polyxd check`, link: ["Your design system", "/docs/your-design-system/"] } },
      { scene: "showcase" },
    ],
  },
  {
    slug: "verify", nav: "verify",
    title: "Verify · Polyxd", description: "Every screen is rendered in every pack, light and dark, phone and desktop, audited, and operated by an agent before anyone sees it.",
    eyebrow: "Verify", h1: "Checked before anyone sees it.",
    lead: "Every screen, every pack, light and dark, phone and desktop. Then an agent tries to finish the task by name alone.",
    ctas: [["How the verifier works", "/docs/verifier/"], ["Run it in CI", "/docs/quickstart/#3-verify-it"]],
    art: art.screen(send.intent.document, DARK_PACK, "dark"),
    blocks: [
      { scene: "check" },
      { points: { title: "Four layers of checks.", items: [
        ["Document", "Schema, references, one primary action per view, data bindings, the pattern’s rules, allowed actions, labels that say what happens."],
        ["Rendered", "Headless Chromium in each pack, mode and width: axe-core WCAG 2.2 AA, contrast, overflow, target size, runtime errors."],
        ["Agent", "Scripted tasks through the accessibility tree only. The product must receive the expected action."],
        ["Consistency", "Two generations of the same ask, compared."],
      ] } },
      { term: { title: "Twenty broken screens. Twenty caught.", lead: "Two primary actions, a destructive action outside a confirmation, a hard-coded balance, an image without alt text, a required field removed so the task can’t be done, and fifteen more.", code: `polyxd-verify ./screens\nschema ........... <em>pass</em>\npatterns ......... <em>pass</em>\nactions .......... <em>pass</em>\naxe, contrast .... <em>pass</em>\nagent tasks ...... <em>pass</em>`, link: ["The verifier", "/docs/verifier/"] } },
    ],
  },
  {
    slug: "designers",
    title: "For designers · Polyxd", description: "Decide what every screen must be like, and prove it. Your taste becomes a file the generator follows.",
    eyebrow: "For designers", h1: "Draw the rules, not every screen.",
    lead: "Decide what every screen must be like, and prove it. Author the ones that matter in the same format.",
    ctas: [["Try Studio", "https://studio.polyxd.com"], ["The designer’s job", "/docs/designers/"]],
    art: art.screen(refund.intent.document, "polaris"),
    blocks: [
      { points: { title: "The same judgement, applied once.", items: [
        ["Direction", "Your taste as a file the generator reads: which components, what guidance, what never to do."],
        ["Rules", "Written when something goes wrong, then held by the verifier for good."],
        ["Authored screens", "The screens that matter, written in the same format, checked the same way."],
        ["The shell", "Header, navigation and footer as a document a generator can never touch."],
      ] } },
      { scene: "wipe" },
    ],
  },
  {
    slug: "design-system-teams",
    title: "For design-system teams · Polyxd", description: "One contract of 87 roles, checked before publishing, used by every generated screen.",
    eyebrow: "For design-system teams", h1: "Adoption you can prove.",
    lead: "One contract of 87 roles, contrast checked before anything publishes, and every generated screen built from your components.",
    ctas: [["Bring your design system", "/docs/your-design-system/"], ["Try Studio", "https://studio.polyxd.com"]],
    art: art.wall(),
    blocks: [
      { term: { title: "Your tokens, read in one command.", lead: "Every guess written down. Every failing colour pair named.", code: `<span class="dim">$</span> npx polyxd pack ./tokens.css\n--brand-600   → <em>action.primary</em>\n--gray-50     → <em>surface.base</em>\n<span class="dim">…</span>\n<em>2 pairs fail 4.5:1</em>`, link: ["Your design system", "/docs/your-design-system/"] } },
      { scene: "wipe" },
      { wall: "Beside the systems you already know." },
    ],
  },
  {
    slug: "developers",
    title: "For engineers · Polyxd", description: "Render a UI document with a real renderer in React, Web Components, Vue or Svelte. UI is data, never code.",
    eyebrow: "For engineers", h1: "Render a document. Ship a screen.",
    lead: "Real renderers for React, Web Components, Vue and Svelte. UI is data, never code. The verifier runs in CI.",
    ctas: [["Quickstart", "/docs/quickstart/"], ["GitHub", GITHUB]],
    art: art.term(`<span class="dim">$</span> npm i @polyxd/react\n\n<span class="dim">&lt;</span>PolyxdSurface\n  document={doc}\n  data={hostData}\n  theme=<em>"material3"</em>\n  onAction={handle}\n<span class="dim">/&gt;</span>`),
    blocks: [
      { scene: "turn" },
      { points: { title: "What you get.", items: [
        ["Renderers", "<code>@polyxd/react</code>, and <code>@polyxd/web</code> for Web Components, Vue and Svelte, held to one conformance suite."],
        ["Data from you", "Documents bind to data your app supplies. A model can’t invent a balance."],
        ["Actions you allow", "A registry of what a document may trigger, and how risky each is."],
        ["Checks in CI", "<code>polyxd-verify</code> on every change. Export to A2UI when you need it."],
      ] } },
      { scene: "showcase" },
    ],
  },
  {
    slug: "product-teams",
    title: "For product teams · Polyxd", description: "Screens for the long tail, in your brand, gone when they are done. And agents can operate your product.",
    eyebrow: "For product teams", h1: "Your assistant can finally show, not tell.",
    lead: "Screens for the long tail, in your brand, gone when they’re done. And someone else’s agent can operate your product by name.",
    ctas: [["See the demos", "/demos/"], ["Get started", "/docs/quickstart/"]],
    art: art.screen(renewals.intent.document, "shadcn"),
    blocks: [{ scene: "gap" }, { scene: "demos" }, { scene: "gone" }],
  },
  {
    slug: "open-source",
    title: "Open source · Polyxd", description: "Apache-2.0 code and CC-BY-4.0 spec. Any model, or none. Everything that runs inside your product is free.",
    eyebrow: "Open source", h1: "Open spec. Any model. Your design system.",
    lead: "Apache-2.0 code and a CC-BY-4.0 spec. Everything that runs inside your product is free, with no usage metering.",
    ctas: [["Star on GitHub", GITHUB], ["Roadmap", "/docs/roadmap/"]],
    art: art.mark(),
    blocks: [
      { points: { title: "What’s in the box.", items: [
        ["The spec", `<code>@polyxd/spec</code>: ${counts.COMPONENTCOUNT} components, patterns, the action registry and the JSON Schema.`],
        ["Renderers", "<code>@polyxd/react</code> and <code>@polyxd/web</code>, on the shared <code>@polyxd/core</code>."],
        ["Packs", `${counts.PACKCOUNTNUM} design systems and ${counts.TEMPLATECOUNT} templates, one package each.`],
        ["Tools", "The <code>polyxd</code> CLI, <code>@polyxd/verifier</code>, <code>@polyxd/a2ui</code> and the editor extension."],
      ] } },
      { note: "Built in the repository, not on npm yet: the runtime SDK, the MCP server and the generation server. Planned: native renderers and a Figma importer. Follow them on the <a href=\"/docs/roadmap/\">roadmap</a>." },
    ],
  },
];

// Studio follows one button, from four places to one product (src/studio.html).
await write(join(DIST, "studio", "index.html"), await fill(await readFile(join(SITE, "src/studio.html"), "utf8"), { title: "Studio · Polyxd", description: "Set up your design system once and use it everywhere: import your tokens at every tier, check them against 87 roles, design screens with them, and export to six formats.", path: "/studio/", current: "studio" }));

const template = await readFile(join(SITE, "src/page.html"), "utf8");
for (const pg of LANDING_PAGES) {
  const html = template
    .replace("<!--TITLE-->", esc(pg.title))
    .replace("<!--DESCRIPTION-->", esc(pg.description))
    .replace("<!--EYEBROW-->", esc(pg.eyebrow))
    .replace("<!--H1-->", esc(pg.h1))
    .replace("<!--LEAD-->", pg.lead)
    .replace("<!--CTAS-->", pg.ctas.map(([l, h], i) => cta(l, h, i === 0)).join(""))
    .replace("<!--ART-->", pg.art)
    .replace("<!--BLOCKS-->", pg.blocks.map(blockHtml).join("\n"));
  await write(join(DIST, pg.slug, "index.html"), await fill(html, { title: pg.title, description: pg.description, path: `/${pg.slug}/`, current: pg.nav ?? "" }));
}

const pages = [...(await markdownPages()), await componentsPage(), await tokensPage(), await coveragePage()].sort(
  (a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.order - b.order,
);
for (const p of pages) await write(join(DIST, p.slug ? `docs/${p.slug}/index.html` : "docs/index.html"), docsPage(p, pages));

await write(
  join(DIST, "404.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not found · Polyxd</title>${head({ title: "Not found · Polyxd", description: "This page doesn't exist.", path: "/404" })}</head><body>${header("home")}<main class="section"><div class="wrap"><p class="eyebrow">404</p><h1 class="display" style="font-size:clamp(40px,6vw,80px);margin:16px 0 24px">This page stepped aside.</h1><p style="max-width:52ch;color:var(--ink-2)">Interfaces here are supposed to disappear when they're done, but this one never existed. Try the <a href="/docs/">docs</a> or go <a href="/">home</a>.</p></div></main>${footer}</body></html>`,
);

/** Verified renders: every spec example and every demo report is 13 packs × 2 modes × 2 widths. */
async function renderCount(): Promise<number> {
  const examples = (await readdir(join(REPO, "packages/spec/examples"))).filter((f) => f.endsWith(".json")).length;
  let reports = 0;
  for (const d of await readdir(join(REPO, "apps/demos"), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    reports += (await readdir(join(REPO, "apps/demos", d.name, "reports")).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).length;
  }
  return (examples + reports) * 52;
}

/** A template pack says so in its manifest (`"template": true`); older drafts said it in a provenance note. */
function isTemplate(m: any): boolean {
  return m?.template === true || (Array.isArray(m?.provenance) ? m.provenance : [m?.provenance]).some((e: any) => e?.template === true || /^Original template/.test(String(e?.notes ?? "")));
}

/** Template packs: ds-* packages whose manifest says so, spelled out for prose. */
async function templateCount(): Promise<string> {
  let n = 0;
  for (const p of (await readdir(join(REPO, "packages"))).filter((p) => p.startsWith("ds-") && p !== "ds-kit")) {
    const m = JSON.parse(await readFile(join(REPO, "packages", p, "manifest.json"), "utf8").catch(() => "{}"));
    if (isTemplate(m)) n++;
  }
  return spelled[n - 1] ?? String(n);
}

// The live gallery, served under /gallery/.
execFileSync("npx", ["vite", "build", "--base", "/gallery/", "--outDir", join(DIST, "gallery"), "--emptyOutDir", "--logLevel", "warn"], {
  cwd: join(REPO, "apps/gallery"),
  stdio: "inherit",
});

// The demo products, served under /demos/<name>/ (one Vite build, several entry pages).
execFileSync("npx", ["vite", "build", "--outDir", join(DIST, "demos"), "--emptyOutDir", "--logLevel", "warn"], {
  cwd: join(REPO, "apps/demos"),
  stdio: "inherit",
});
const demos = ["halden", "foundry", "wexley", "quay"];

const urls = ["/", "/studio/", ...LANDING_PAGES.map((p) => `/${p.slug}/`), "/gallery/", "/demos/", ...demos.map((d) => `/demos/${d}/`), ...pages.map((p) => href(p.slug))];
await write(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
await write(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);

// The JSON Schemas, at the URLs documents name in "$schema", so editors validate and complete them.
// Every minor the schema pattern accepts is served, so a 0.2 document keeps resolving.
{
  const schemaDir = join(REPO, "packages/spec/schema");
  const files = (await readdir(schemaDir)).filter((f) => f.endsWith(".json"));
  for (const v of ["0.2", "0.3"]) {
    await mkdir(join(DIST, "schema", v), { recursive: true });
    for (const f of files) await copyFile(join(schemaDir, f), join(DIST, "schema", v, f));
  }
}

console.log(`built ${pages.length} docs pages, landing, gallery → ${DIST}`);
