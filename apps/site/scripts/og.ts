/**
 * The social images: one 1200 × 630 card per page, rendered to og/png/<key>.png.
 *
 *   node scripts/build.ts && node scripts/og.ts && node scripts/build.ts
 *
 * The cards are designed on the Claude Design canvas (page "OG images") and kept here as plain
 * pages in og/cards/: one per landing page, the gallery, the demos and Studio, and docs.html, a
 * template filled for every docs page from the built site (so build first, then build again to
 * pick up new images). A key is the page's path without its slashes ("/" is "home",
 * "/docs/reference/tokens/" is "docs-reference-tokens"); build.ts points og:image at
 * /og/<key>.png when that file exists. The demo products' own pages already point at
 * /demos/<name>/og.png, so their cards are written into apps/demos/public/ instead.
 *
 * Nothing on a card is smaller than 24px: a feed shows it at about half size.
 * Fonts come from Google Fonts, so this needs the network, like brand/build.ts.
 */
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
// Playwright comes with the workspace (@polyxd/verifier depends on it).
import { chromium } from "playwright";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(SITE, "../..");
const CARDS = join(SITE, "og/cards");
const OUT = join(SITE, "og/png");
const DOCS = join(SITE, "dist/docs");
const DEMOS = ["halden", "foundry", "wexley", "quay"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Every built docs page: its key, title, first sentence (when it's short enough to read) and URL. */
async function docsPages() {
  if (!existsSync(DOCS)) throw new Error("dist/docs is missing: run node scripts/build.ts first");
  const found: { key: string; title: string; sub: string; url: string }[] = [];
  const walk = async (dir: string) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) await walk(join(dir, e.name));
      else if (e.name === "index.html") {
        const html = await readFile(join(dir, e.name), "utf8");
        const title = unesc(html.match(/<h1[^>]*>([^<]+)/)?.[1] ?? html.match(/<title>([^<·]+)/)?.[1] ?? "Docs").trim();
        const description = unesc(html.match(/name="description" content="([^"]*)"/)?.[1] ?? "");
        const first = description.split(/(?<=\.)\s/)[0];
        const rel = relative(DOCS, dir);
        found.push({ key: rel ? `docs-${rel.split("/").join("-")}` : "docs", title, sub: first.length <= 90 ? first : "", url: `polyxd.com/docs/${rel ? `${rel}/` : ""}`.replace(/\/$/, "") });
      }
    }
  };
  await walk(DOCS);
  return found;
}

/** Big for a word, smaller as the title grows, so it stays on three lines or fewer. */
const titleSize = (t: string) => (t.length <= 12 ? 88 : t.length <= 20 ? 72 : t.length <= 32 ? 60 : 52);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const render = async (html: string, path: string) => {
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, type: "png" });
  console.log(`wrote ${relative(REPO, path)}`);
};
try {
  for (const f of (await readdir(CARDS)).filter((f) => f.endsWith(".html") && f !== "docs.html")) {
    const key = f.replace(/\.html$/, "");
    const demo = key.startsWith("demos-") ? key.slice(6) : "";
    const path = DEMOS.includes(demo) ? join(REPO, "apps/demos/public", demo, "og.png") : join(OUT, `${key}.png`);
    await render(await readFile(join(CARDS, f), "utf8"), path);
  }
  const template = await readFile(join(CARDS, "docs.html"), "utf8");
  for (const d of await docsPages()) {
    let html = template.replaceAll("{{TITLE}}", esc(d.title)).replaceAll("{{URL}}", esc(d.url)).replaceAll("{{SIZE}}", String(titleSize(d.title)));
    html = d.sub ? html.replaceAll("{{SUB}}", esc(d.sub)) : html.replace(/<p [^>]*>\{\{SUB\}\}<\/p>/, "");
    await render(html, join(OUT, `${d.key}.png`));
  }
} finally {
  await browser.close();
}
