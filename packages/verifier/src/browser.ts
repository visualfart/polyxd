import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const HARNESS = new URL("../harness-dist/", import.meta.url);
const ORIGIN = "http://harness.polyxd.local";
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const axeSource = readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

export interface RenderTarget {
  theme: string;
  mode: "light" | "dark";
  /** Viewport width in CSS pixels, e.g. 390 (phone) or 1100 (desktop) */
  width: number;
}

export async function launch(): Promise<Browser> {
  return chromium.launch();
}

/**
 * Opens a page with one document rendered in one theme/mode/width. The harness is served from
 * disk through request interception, so nothing listens on a port.
 */
export async function renderPage(browser: Browser, document: unknown, target: RenderTarget): Promise<{ page: Page; errors: string[] }> {
  const page = await browser.newPage({ viewport: { width: target.width, height: 900 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname.slice(1) || "index.html";
    try {
      const body = await readFile(new URL(path, HARNESS));
      await route.fulfill({ body, contentType: TYPES[extname(path)] ?? "application/octet-stream" });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });
  await page.addInitScript((cfg) => ((window as any).__PXD__ = cfg), { document, theme: target.theme, mode: target.mode });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => (window as any).__pxdReady === true, undefined, { timeout: 10_000 });
  await page.addScriptTag({ content: await axeSource });
  return { page, errors };
}

/** Actions the rendered UI has sent to the host so far. */
export function sentActions(page: Page): Promise<{ name: string; context: Record<string, unknown>; source: string }[]> {
  return page.evaluate(() => (window as any).__pxdActions);
}
