/**
 * Screenshots of the three running products, for the docs and for checking a deploy by eye:
 * Halden at phone size, Foundry at desktop size, Wexley at tablet size.
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

  // Foundry: dense desktop, dark.
  const desk = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: "dark" });
  const f = await desk.newPage();
  await f.goto(`${origin}/demos/foundry/`);
  await f.fill("#email", "noor@basalt.dev");
  await f.fill("#password", "anything");
  await f.keyboard.press("Enter");
  await f.waitForSelector("text=Needs attention");
  await f.waitForTimeout(600);
  await f.screenshot({ path: out("foundry-overview") });
  await f.click("text=Renewing with tickets");
  await f.waitForSelector(".pxd-surface");
  await f.waitForTimeout(600);
  await f.screenshot({ path: out("foundry-ask") });
  await f.keyboard.press("Escape");
  await f.goto(`${origin}/demos/foundry/accounts`);
  await f.waitForSelector("table");
  await f.waitForTimeout(400);
  await f.screenshot({ path: out("foundry-accounts") });

  // Wexley: a tablet, light (GOV.UK has no dark mode).
  const tab = await browser.newContext({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 2, colorScheme: "light" });
  const w = await tab.newPage();
  await w.goto(`${origin}/demos/wexley/`);
  await w.fill("#email", "amira.haddad@example.com");
  await w.keyboard.press("Enter");
  await w.waitForSelector("text=Enter the 6-digit code");
  await w.click("#code");
  await w.keyboard.type("482913");
  await w.waitForSelector("text=Things to do");
  await w.waitForTimeout(600);
  await w.screenshot({ path: out("wexley-account") });
  await w.click("text=Appeal it");
  await w.waitForSelector(".pxd-surface");
  await w.waitForTimeout(600);
  await w.screenshot({ path: out("wexley-appeal"), fullPage: true });
  await w.goto(`${origin}/demos/wexley/repairs`);
  await w.waitForSelector("h1");
  await w.waitForTimeout(400);
  await w.screenshot({ path: out("wexley-repairs") });
  console.log(`wrote 9 screenshots to ${outDir}`);
} finally {
  await browser.close();
}
