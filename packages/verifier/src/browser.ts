import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname } from "node:path";
import type { Browser, Page } from "playwright";

const ORIGIN = "http://harness.polyxd.local";

/**
 * A page that renders `window.__PXD__` (see harness/README.md): the built-in React harness, the
 * Web Components harness, or any renderer's own page, by URL or as a directory of static files.
 */
export type RendererHarness =
  | { name?: string; url: string }
  | { name?: string; html: string | URL };

/** The harnesses this package ships, built by `npm run build:harness`. */
export const HARNESSES: Record<"react" | "web", RendererHarness> = {
  react: { name: "react", html: new URL("../harness-dist/index.html", import.meta.url) },
  web: { name: "web", html: new URL("../harness-web-dist/index.html", import.meta.url) },
};
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
let axeSource: Promise<string> | undefined;
const axe = () => (axeSource ??= readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8"));

export interface RenderTarget {
  theme: string;
  mode: "light" | "dark";
  /** Viewport width in CSS pixels, e.g. 390 (phone) or 1100 (desktop) */
  width: number;
}

/**
 * Starts headless Chromium for the rendered checks. Playwright is an optional peer dependency, so
 * nothing loads it until now: the document checks (`@polyxd/verifier/static`) never need it.
 */
export async function launch(): Promise<Browser> {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch (err) {
    if ((err as { code?: string }).code !== "ERR_MODULE_NOT_FOUND") throw err;
    throw new Error("The rendered checks need Playwright, which @polyxd/verifier doesn't install for you: run `npm install -D playwright && npx playwright install chromium`. The document checks alone are in @polyxd/verifier/static.");
  }
  return playwright.chromium.launch();
}

/**
 * Opens a page with one document rendered in one theme/mode/width. The harness is served from
 * disk through request interception, so nothing listens on a port.
 */
export async function renderPage(browser: Browser, document: unknown, target: RenderTarget, harness: RendererHarness = HARNESSES.react): Promise<{ page: Page; errors: string[] }> {
  const page = await browser.newPage({ viewport: { width: target.width, height: 900 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  let url: string;
  if ("url" in harness) url = harness.url;
  else {
    // A directory of static files is served from disk through request interception, so nothing listens on a port.
    const index = harness.html instanceof URL ? harness.html : new URL(harness.html, `file://${process.cwd()}/`);
    const dir = new URL("./", index);
    await page.route(`${ORIGIN}/**`, async (route) => {
      const path = new URL(route.request().url()).pathname.slice(1) || "index.html";
      try {
        const body = await readFile(new URL(path, dir));
        await route.fulfill({ body, contentType: TYPES[extname(path)] ?? "application/octet-stream" });
      } catch {
        await route.fulfill({ status: 404 });
      }
    });
    url = `${ORIGIN}/${index.pathname.split("/").pop() ?? "index.html"}`;
  }
  await page.addInitScript((cfg) => ((window as any).__PXD__ = cfg), { document, theme: target.theme, mode: target.mode });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__pxdReady === true, undefined, { timeout: 10_000 });
  // Entrances (a panel fading in) finish before anything is measured, so a contrast or layout
  // reading never depends on how far into an animation a renderer's first paint was. Endless
  // animations (a spinner) are left running.
  await page.evaluate(() => {
    const doc = (globalThis as any).document as { getAnimations(): { effect?: { getTiming(): { iterations: number } }; finished: Promise<unknown> }[] };
    return Promise.all(doc.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)));
  });
  await page.addScriptTag({ content: await axe() });
  return { page, errors };
}

/** Actions the rendered UI has sent to the host so far. */
export function sentActions(page: Page): Promise<{ name: string; context: Record<string, unknown>; source: string }[]> {
  // A step that follows a link navigates away from the harness, taking the record with it: the
  // host received nothing, which is a failed task, not a crash.
  return page.evaluate(() => (window as any).__pxdActions ?? []);
}
