/**
 * The YouTube channel's images, drawn from the brand tokens and the real listing screens:
 *
 *   banner.png      2560 x 1440. Everything that matters sits in the centre 1546 x 423, the part
 *                   YouTube shows on every device; the rest only shows on TVs and wide desktops.
 *   picture.png     800 x 800, cropped to a circle by YouTube, so the mark sits well inside it.
 *   watermark.png   150 x 150, the mark on transparent, for Settings > Channel > Branding.
 *
 *   node brand/youtube/render.ts
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const here = (p: string) => new URL(p, import.meta.url);
const MARK = readFileSync(here("../chosen-mark.svg"), "utf8").trim();
const FONTS = "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500&family=Young+Serif&family=DM+Mono&display=swap";
const png = (p: string) => `data:image/png;base64,${readFileSync(here(p)).toString("base64")}`;
const SCREENS = "../../packages/mcp/listing/screenshots/raw/";

const card = (file: string, style: string) =>
  `<div style="position:absolute;${style};border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45);background:#fff"><img src="${png(SCREENS + file)}" style="display:block;width:100%;height:100%;object-fit:contain"></div>`;

const banner = `<!doctype html><html><head><link rel="stylesheet" href="${FONTS}"></head>
<body style="margin:0;width:2560px;height:1440px;background:#121211;overflow:hidden;position:relative;font-family:'Hanken Grotesk'">
  ${card("3-change-address-govuk.png", "left:-60px;top:250px;width:440px;height:330px;transform:rotate(-6deg);opacity:.55")}
  ${card("4-support-dashboard-dark.png", "left:-40px;top:860px;width:480px;height:340px;transform:rotate(4deg);opacity:.45")}
  ${card("5-compare-broadband-editorial.png", "right:-50px;top:230px;width:460px;height:340px;transform:rotate(5deg);opacity:.55")}
  ${card("2-return-shoes-carbon.png", "right:-30px;top:880px;width:460px;height:330px;transform:rotate(-4deg);opacity:.45")}
  <div style="position:absolute;left:507px;top:508px;width:1546px;height:423px;display:flex;align-items:center;justify-content:space-between;gap:60px">
    <div style="display:flex;align-items:center;gap:30px">
      <span style="display:block;width:190px;height:190px">${MARK.replace("<svg", '<svg width="190" height="190"')}</span>
      <span style="font:400 152px/1 'Young Serif';letter-spacing:-0.015em;color:#F3F1EC">polyxd</span>
    </div>
    <div style="max-width:700px">
      <div style="font:400 22px/1 'DM Mono';letter-spacing:.14em;text-transform:uppercase;color:#FF6E40">Generative UI for AI chats</div>
      <div style="margin-top:22px;font:400 70px/1.04 'Young Serif';letter-spacing:-0.015em;color:#F3F1EC">Screens, not walls of text.</div>
      <div style="margin-top:20px;font:400 28px/1.3 'Hanken Grotesk';color:#B9B4A9">polyxd.com</div>
    </div>
  </div>
</body></html>`;

const picture = `<!doctype html><html><body style="margin:0;width:800px;height:800px;background:#F3F1EC;display:flex;align-items:center;justify-content:center">
  <span style="display:block;width:470px;height:470px">${MARK.replace("<svg", '<svg width="470" height="470"')}</span>
</body></html>`;

const watermark = `<!doctype html><html><body style="margin:0;width:150px;height:150px;background:transparent;display:flex;align-items:center;justify-content:center">
  <span style="display:block;width:150px;height:150px">${MARK.replace("<svg", '<svg width="150" height="150"')}</span>
</body></html>`;

const browser = await chromium.launch();
for (const [name, html, w, h, transparent] of [
  ["banner.png", banner, 2560, 1440, false],
  ["picture.png", picture, 800, 800, false],
  ["watermark.png", watermark, 150, 150, true],
] as const) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: here(name).pathname, omitBackground: transparent });
  await page.close();
  console.log(`wrote brand/youtube/${name}`);
}
await browser.close();
