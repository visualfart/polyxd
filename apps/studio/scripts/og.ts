/**
 * Studio's social image, public/og.png: 1200 × 630 on the brand. Paper ground, Studio's lockup
 * (the mark, "polyxd" in Young Serif beside it, "Studio" in the UI face, as the app's chrome sets
 * it), the landing's headline, and a crop of the Screens editor from public/landing/screens.png
 * (made by landing-shots.ts), in a card that runs off the edge.
 *
 *   node apps/studio/scripts/og.ts
 *
 * The mark and the colours come from brand/build.ts; the fonts from Google Fonts, so it needs the
 * network, like the brand's own images.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
// Playwright comes with the workspace (@polyxd/verifier depends on it).
import { chromium } from "playwright";
import { FONTS_URL, INK, MUTED, PAPER, mark } from "../../../brand/build.ts";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
/** From the brand's tokens: hairlines and the card. */
const RULE = "#DAD5CA";
const WHITE = "#FFFFFF";
/** The landing's headline, word for word (pages/Landing.tsx). */
const LINE = "Where your design system decides what generated screens may look like.";

const shot = (await readFile(here("../public/landing/screens.png"))).toString("base64");
// The crop: the preview column, the shell drawn in Harbourline's design system with its toolbar. The
// source is 3840 × 2000 (1920 × 1000 at 2x); shown at `scale` of its CSS size.
const crop = { x: 555, y: 67, scale: 0.8 };
const m = 64;

const html = `<!doctype html><html><head><meta charset="utf-8"><link href="${FONTS_URL}" rel="stylesheet"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: ${PAPER}; color: ${INK}; font-family: "Hanken Grotesk", sans-serif; -webkit-font-smoothing: antialiased; }
  /* The brand's dot ground, faint. */
  .ground { position: absolute; inset: 0; background-image: radial-gradient(${RULE} 1.2px, transparent 1.4px); background-size: 24px 24px; opacity: 0.7; }
  .words { position: absolute; left: 72px; top: 72px; bottom: 72px; width: 520px; display: flex; flex-direction: column; justify-content: space-between; }
  .lockup { display: flex; align-items: center; gap: ${Math.round((m * 5) / 32)}px; }
  .word { font-family: "Young Serif", serif; font-size: ${Math.round(m * 0.8)}px; line-height: 1; letter-spacing: -0.015em; margin-top: -${Math.round(m * 0.04)}px; }
  .product { font-weight: 500; font-size: ${Math.round(m * 0.6)}px; line-height: 1; color: ${MUTED}; margin-left: ${Math.round(m * 0.6 * 0.5 - (m * 5) / 32)}px; }
  h1 { font-family: "Young Serif", serif; font-weight: 400; font-size: 50px; line-height: 1.06; letter-spacing: -0.015em; text-wrap: balance; }
  .url { font-family: "DM Mono", monospace; font-size: 20px; letter-spacing: 0.04em; color: ${MUTED}; }
  .card { position: absolute; left: 648px; top: 96px; width: 640px; height: 620px; border-radius: 28px; corner-shape: squircle; border: 1.5px solid ${RULE}; background: ${WHITE} url(data:image/png;base64,${shot}) no-repeat; background-size: ${1920 * crop.scale}px ${1000 * crop.scale}px; background-position: -${crop.x * crop.scale}px -${crop.y * crop.scale}px; overflow: hidden; }
</style></head><body>
  <div class="ground"></div>
  <div class="card"></div>
  <div class="words">
    <div class="lockup"><svg width="${m}" height="${m}" viewBox="0 0 32 32">${mark()}</svg><span class="word">polyxd</span><span class="product">Studio</span></div>
    <h1>${LINE}</h1>
    <div class="url">studio.polyxd.com</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await writeFile(here("../public/og.png"), await page.screenshot());
  console.log("wrote apps/studio/public/og.png");
} finally {
  await browser.close();
}
