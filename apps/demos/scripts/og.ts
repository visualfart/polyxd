/**
 * Renders each product's social image (1200×630) and touch icon (180×180) with the verifier's
 * browser into public/<name>/.
 *   node scripts/og.ts
 *
 * The social image is the site's card for the product (apps/site/og/cards/demos-<name>.html,
 * designed on the Claude Design canvas), so this and apps/site/scripts/og.ts write the same
 * file. The touch icon is a little HTML in the product's own colours. The cards load their fonts
 * from Google Fonts, so this needs the network.
 */
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { launch } from "@polyxd/verifier";

const products = [
  { name: "halden", bg: "#65558f", fg: "#ffffff", mark: "h", font: "Roboto, system-ui, sans-serif" },
  { name: "foundry", bg: "#18181b", fg: "#fafafa", mark: "f", font: "Geist, system-ui, sans-serif" },
  { name: "wexley", bg: "#1d70b8", fg: "#ffffff", mark: "w", font: "Arial, sans-serif" },
  { name: "quay", bg: "#303030", fg: "#ffffff", mark: "q", font: "Inter, system-ui, sans-serif" },
];

/** The site's card for the product: the one social image every page of the demo shares. */
const og = (p: (typeof products)[number]) => readFile(fileURLToPath(new URL(`../../site/og/cards/demos-${p.name}.html`, import.meta.url)), "utf8");
const icon = (p: (typeof products)[number]) => `<!doctype html><html><body style="margin:0;width:180px;height:180px;background:${p.bg};color:${p.fg};font-family:${p.font};display:flex;align-items:center;justify-content:center;font-size:110px;font-weight:500">${p.mark}</body></html>`;

const browser = await launch();
try {
  for (const p of products) {
    const dir = fileURLToPath(new URL(`../public/${p.name}/`, import.meta.url));
    await mkdir(dir, { recursive: true });
    for (const [file, html, w, h] of [["og.png", await og(p), 1200, 630], ["icon-180.png", icon(p), 180, 180]] as const) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${dir}${file}` });
      await page.close();
      console.log(`wrote public/${p.name}/${file}`);
    }
  }
} finally {
  await browser.close();
}
