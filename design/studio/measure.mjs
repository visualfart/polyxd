// Renders every artboard and records the height its content needs (at least 900) in heights.json,
// keyed by <title>, so build.py can size each artboard to fit. Run from packages/verifier's
// node_modules: node --import ... or copy next to playwright.
import { chromium } from "playwright";
import { readdirSync, writeFileSync } from "node:fs";
const dir = new URL("./out/project/", import.meta.url).pathname;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const heights = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".dc.html"))) {
  await p.goto(`file://${dir}${f}`);
  await p.waitForTimeout(250);
  const [title, need] = await p.evaluate(() => {
    const main = document.querySelector("main > div:last-child") || document.querySelector("main");
    const header = document.querySelector("main > header");
    const inner = main ? main.scrollHeight + (header ? header.offsetHeight : 0) : 900;
    const side = document.querySelector("aside")?.scrollHeight ?? 0;
    return [document.title, Math.max(900, Math.ceil(Math.max(inner, side) / 20) * 20)];
  });
  if (need > 900) heights[title] = need;
}
await b.close();
writeFileSync(new URL("./heights.json", import.meta.url), JSON.stringify(heights, null, 2) + "\n");
console.log(Object.keys(heights).length, "artboards need more than 900px:", JSON.stringify(heights));
