/**
 * Phone-size screenshots of a running Halden, for the docs and for checking a deploy by eye.
 *   node scripts/shots.ts [origin] [outDir]     default: https://polyxd.com and ./shots
 */
import { mkdir } from "node:fs/promises";
import { launch } from "@polyxd/verifier";

const [origin = "https://polyxd.com", outDir = "shots"] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });
const out = (name: string) => `${outDir.replace(/\/$/, "")}/${name}.png`;

const browser = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto(`${origin}/demos/halden/`);
  await page.click("text=Skip");
  await page.waitForSelector(".hal-balance-value");
  await page.waitForTimeout(600);
  await page.screenshot({ path: out("halden-home") });

  await page.click("text=Ask Halden anything");
  await page.fill("input[aria-label='Ask Halden']", "what did I spend on eating out this month");
  await page.press("input[aria-label='Ask Halden']", "Enter");
  await page.waitForSelector(".pxd-surface");
  await page.waitForTimeout(600);
  await page.screenshot({ path: out("halden-ask") });
  await page.keyboard.press("Escape");

  await page.goto(`${origin}/demos/halden/payments`);
  await page.waitForSelector(".hal-li");
  await page.click(".hal-li:has-text('Ryde'):has-text('23:45')");
  await page.waitForSelector("text=Charged twice?");
  await page.waitForTimeout(400);
  await page.screenshot({ path: out("halden-payment") });
  console.log(`wrote 3 screenshots to ${outDir}`);
} finally {
  await browser.close();
}
