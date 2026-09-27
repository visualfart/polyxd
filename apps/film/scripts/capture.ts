/**
 * Captures the film's raw material from the running dev servers into assets/:
 *   clips (MP4, 30fps, 2× pixels) of the four products and Studio being used,
 *   stills (PNG, 2×) of the four home screens and the gallery's one document in seven packs.
 *
 *   node scripts/capture.ts [clip…]        default: everything. Names: halden-send halden-spend
 *                                          foundry quay wexley studio gallery homes
 *
 * Needs: demos on http://localhost:5174, gallery on :5183, Studio on :8789 (see .claude/launch.json;
 * the gallery port is what this repo's session used, set GALLERY to change it), and ffmpeg.
 *
 * Why not Playwright's recordVideo: a headless screencast is captured at CSS pixels whatever the
 * deviceScaleFactor, so a 2× recording is a 1× picture padded with grey. Instead a take screenshots
 * the page at 2× as fast as it can (about 20 a second) while the script works the product, stamps
 * each frame, and ffmpeg assembles them at 30fps. Every pointer movement is deliberate (move, pause,
 * click) and drawn by a cursor the script injects, because a headless page shows no pointer.
 */
import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { launch } from "@polyxd/verifier";
import type { Browser, BrowserContext, Page } from "playwright";

const DEMOS = process.env.DEMOS ?? "http://localhost:5174/demos";
const GALLERY = process.env.GALLERY ?? "http://localhost:5183";
const STUDIO = process.env.STUDIO ?? "http://localhost:8789";
const FFMPEG = process.env.FFMPEG ?? "/opt/homebrew/bin/ffmpeg";
/** A throwaway local Studio account: the Worker sends no email in development, so it works at once. */
const STUDIO_ACCOUNT = { email: "film@polyxd.test", name: "Film Crew", password: "interfaces-show-up-when-needed" };

const dir = fileURLToPath(new URL("../assets/", import.meta.url));
const only = new Set(process.argv.slice(2));
const wanted = (name: string) => only.size === 0 || only.has(name);
const DSF = 2;

/** The cursor: a plain arrow that follows the mouse and dips on a press. Injected into every document. */
const CURSOR = `
(() => {
  if (window.top !== window) return;
  const add = () => {
    if (document.getElementById("__film_cursor")) return;
    const el = document.createElement("div");
    el.id = "__film_cursor";
    el.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))"><path d="M6 3l15 12-6.5 1 3.8 7.2-2.9 1.5-3.8-7.2L6 22z" fill="#fff" stroke="#141413" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(el.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", transform: "translate(-9999px,-9999px)", transition: "transform 0s", willChange: "transform" });
    (document.body || document.documentElement).appendChild(el);
    let x = -9999, y = -9999, s = 1;
    const draw = () => { el.style.transform = "translate(" + (x - 6) + "px," + (y - 3) + "px) scale(" + s + ")"; };
    window.addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; draw(); }, true);
    window.addEventListener("mousedown", () => { s = 0.82; draw(); }, true);
    window.addEventListener("mouseup", () => { s = 1; draw(); }, true);
  };
  if (document.body) add(); else document.addEventListener("DOMContentLoaded", add);
})();`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Take {
  private steps: string[] = [];
  private t0 = Date.now();
  private frames: number[] = [];
  private recording = true;
  private loop: Promise<void>;
  readonly name: string;
  readonly page: Page;
  private readonly context: BrowserContext;
  private readonly ctxDir: string;
  constructor(name: string, page: Page, context: BrowserContext, ctxDir: string) {
    this.name = name;
    this.page = page;
    this.context = context;
    this.ctxDir = ctxDir;
    this.loop = this.record();
  }
  /** Screenshots the page as fast as it can until the take ends; each frame is stamped with the moment it was taken. */
  private async record() {
    let i = 0;
    while (this.recording) {
      const at = Date.now();
      try {
        const buf = await this.page.screenshot({ type: "jpeg", quality: 92, caret: "initial", timeout: 1500 });
        await writeFile(`${this.ctxDir}${String(i++).padStart(5, "0")}.jpg`, buf);
        this.frames.push((at + Date.now()) / 2 - this.t0);
      } catch {
        // Mid-navigation; the next one lands.
        await sleep(30);
      }
    }
  }
  /** A note in the take's log with its time, so the film can find the beat. */
  mark(what: string) {
    this.steps.push(`${((Date.now() - this.t0) / 1000).toFixed(2)}s ${what}`);
  }
  async glide(x: number, y: number, ms = 520) {
    const steps = Math.max(12, Math.round(ms / 16));
    await this.page.mouse.move(x, y, { steps });
  }
  async click(selector: string, { hold = 260, after = 700, ms = 520 }: { hold?: number; after?: number; ms?: number } = {}) {
    const loc = this.page.locator(selector).first();
    await loc.waitFor({ state: "visible" });
    await loc.scrollIntoViewIfNeeded();
    const box = (await loc.boundingBox())!;
    await this.glide(box.x + box.width / 2, box.y + box.height / 2, ms);
    await sleep(hold);
    await this.page.mouse.down();
    await sleep(90);
    await this.page.mouse.up();
    this.mark(`click ${selector}`);
    await sleep(after);
  }
  async type(text: string, delay = 56) {
    await this.page.keyboard.type(text, { delay });
    this.mark(`typed "${text}"`);
  }
  async press(key: string, after = 400) {
    await this.page.keyboard.press(key);
    this.mark(`press ${key}`);
    await sleep(after);
  }
  async hold(ms: number) {
    await sleep(ms);
  }
  async shot(name: string) {
    await this.page.screenshot({ path: `${dir}${name}.png` });
  }
  /** Ends the take: the frames become <name>.mp4 at 30fps, the beats <name>.log. */
  async end() {
    this.mark("end");
    this.recording = false;
    await this.loop;
    await this.context.close();
    // Sample the stamped frames onto a fixed 30fps grid (the latest frame at each tick), so the clip
    // runs true to the clock even where a screenshot stalled, and the log's times are the clip's.
    const fps = 30;
    const end = this.frames.at(-1) ?? 0;
    const lines: string[] = [];
    let j = 0;
    for (let k = 0; k * (1000 / fps) <= end; k++) {
      const t = k * (1000 / fps);
      while (j + 1 < this.frames.length && this.frames[j + 1] <= t) j++;
      lines.push(`file '${String(j).padStart(5, "0")}.jpg'`, `duration ${1 / fps}`);
    }
    await writeFile(`${this.ctxDir}frames.txt`, lines.join("\n") + "\n");
    execFileSync(FFMPEG, ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-r", String(fps), "-i", `${this.ctxDir}frames.txt`, "-fps_mode", "cfr", "-r", String(fps), "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${dir}${this.name}.mp4`], { stdio: "inherit" });
    await writeFile(`${dir}${this.name}.log`, this.steps.join("\n") + "\n");
    await rm(this.ctxDir, { recursive: true, force: true });
    const seconds = (this.frames.at(-1) ?? 0) / 1000;
    console.log(`wrote assets/${this.name}.mp4  ${this.frames.length} frames over ${seconds.toFixed(1)}s (${(this.frames.length / seconds).toFixed(0)} fps captured), ${this.steps.length - 1} beats`);
  }
}

async function take(browser: Browser, name: string, viewport: { width: number; height: number }, colorScheme: "light" | "dark" = "light") {
  const ctxDir = `${dir}.rec-${name}/`;
  await rm(ctxDir, { recursive: true, force: true });
  await mkdir(ctxDir, { recursive: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: DSF, colorScheme });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  return new Take(name, page, context, ctxDir);
}

async function still(browser: Browser, viewport: { width: number; height: number }, colorScheme: "light" | "dark" = "light") {
  const context = await browser.newContext({ viewport, deviceScaleFactor: DSF, colorScheme });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

/** Halden's first visit shows three welcome screens; skip them. */
async function haldenHome(page: Page) {
  await page.goto(`${DEMOS}/halden/`);
  const skip = page.locator("text=Skip");
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  await page.waitForSelector(".hal-balance-value");
  await page.evaluate(() => document.fonts?.ready);
}

async function foundrySignIn(page: Page) {
  await page.goto(`${DEMOS}/foundry/`);
  if (await page.locator("#email").isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.fill("#email", "noor@basalt.dev");
    await page.fill("#password", "anything");
    await page.keyboard.press("Enter");
  }
  await page.waitForSelector("text=Needs attention");
  await page.evaluate(() => document.fonts?.ready);
}

async function wexleySignIn(page: Page) {
  await page.goto(`${DEMOS}/wexley/`);
  if (await page.locator("#email").isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.fill("#email", "amira.haddad@example.com");
    await page.keyboard.press("Enter");
    await page.waitForSelector("text=Enter the 6-digit code");
    await page.click("#code");
    await page.keyboard.type("482913");
  }
  await page.waitForSelector("text=Things to do");
  await page.evaluate(() => document.fonts?.ready);
}

async function quayHome(page: Page) {
  await page.goto(`${DEMOS}/quay/`);
  await page.waitForSelector(".q-askbox");
  await page.evaluate(() => document.fonts?.ready);
}

/** Signs in to Studio, creating the throwaway account and a workspace on first run. Ends on the workspace's Screens page. */
async function studioScreens(page: Page) {
  await page.goto(`${STUDIO}/signin`);
  await page.waitForSelector("#email");
  await page.fill("#email", STUDIO_ACCOUNT.email);
  await page.fill("#password", STUDIO_ACCOUNT.password);
  await page.keyboard.press("Enter");
  const outcome = await Promise.race([
    page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 6000 }).then(() => "in" as const),
    page.waitForSelector(".error, [role=alert]", { timeout: 6000 }).then(() => "no" as const),
  ]).catch(() => "no" as const);
  if (outcome === "no") {
    await page.click("text=Create an account");
    await page.fill("#email", STUDIO_ACCOUNT.email);
    await page.fill("#name", STUDIO_ACCOUNT.name);
    await page.fill("#password", STUDIO_ACCOUNT.password);
    await page.click("button:has-text('Create account')");
    await page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 15000 });
  }
  // A workspace: the first run makes one called Harbourline.
  await page.waitForLoadState("networkidle");
  if (await page.locator("#pname").isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.fill("#pname", "Harbourline");
    await page.click("button:has-text('Create workspace')");
  } else if (await page.locator("a:has-text('Harbourline')").isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.click("a:has-text('Harbourline')");
  }
  await page.waitForURL(/\/w\/[^/]+/, { timeout: 15000 });
  const slug = new URL(page.url()).pathname.split("/")[2];
  await page.goto(`${STUDIO}/w/${slug}/screens`);
  await page.waitForSelector("tr.row-link, p:has-text('A screen is a Polyxd document')");
  await page.evaluate(() => document.fonts?.ready);
  return slug;
}

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1280, height: 800 };
const TABLET = { width: 1024, height: 800 };
const PACKS = ["material3", "carbon", "polaris", "govuk", "shadcn", "sketch", "wireframe"];

await mkdir(dir, { recursive: true });
const browser = await launch();
try {
  if (wanted("halden-send")) {
    const t = await take(browser, "halden-send", PHONE);
    await haldenHome(t.page);
    await t.glide(200, 700, 10);
    await t.hold(900);
    t.mark("home");
    await t.click(".hal-ask", { after: 600 });
    await t.type("send £40 to Priya for dinner");
    await t.hold(500);
    await t.press("Enter", 200);
    await t.page.waitForSelector(".pxd-surface");
    t.mark("surface: form");
    await t.hold(1500);
    await t.click("button:has-text('Continue')", { after: 300 });
    await t.page.waitForSelector("button:has-text('Send £40.00')");
    t.mark("surface: confirm");
    await t.hold(1500);
    await t.click("button:has-text('Send £40.00')", { after: 300 });
    t.mark("sent");
    await t.hold(2200);
    await t.shot("halden-send-end");
    await t.end();
  }

  if (wanted("halden-spend")) {
    const t = await take(browser, "halden-spend", PHONE);
    await haldenHome(t.page);
    await t.glide(200, 700, 10);
    await t.hold(700);
    await t.click(".hal-ask", { after: 600 });
    await t.type("what did I spend on eating out this month");
    await t.hold(400);
    await t.press("Enter", 200);
    await t.page.waitForSelector(".pxd-surface");
    t.mark("surface: spend");
    await t.hold(2400);
    await t.shot("halden-spend-end");
    await t.end();
  }

  if (wanted("foundry")) {
    const t = await take(browser, "foundry-filter", DESK, "dark");
    await foundrySignIn(t.page);
    await t.glide(640, 500, 10);
    await t.hold(900);
    t.mark("overview");
    await t.press("Meta+k", 500);
    await t.page.waitForSelector("input[aria-label='Ask Foundry']");
    await t.type("accounts renewing in 30 days with open tickets");
    await t.hold(500);
    await t.press("Enter", 200);
    await t.page.waitForSelector(".pxd-surface");
    t.mark("surface: filter");
    await t.hold(1400);
    await t.shot("foundry-filter-surface");
    // Narrow it: health "At risk", then plan "Growth", through the surface's own filter chips.
    for (const label of ["At risk", "Growth"]) {
      const chip = t.page.locator(`.pxd-surface label:has-text("${label}"), .pxd-surface button:has-text("${label}"), .pxd-surface [role=checkbox][aria-label="${label}"]`).first();
      await chip.waitFor({ state: "visible" });
      const box = (await chip.boundingBox())!;
      await t.glide(box.x + box.width / 2, box.y + box.height / 2);
      await t.hold(260);
      await t.page.mouse.down();
      await t.hold(90);
      await t.page.mouse.up();
      t.mark(`filter ${label}`);
      await t.hold(1400);
    }
    await t.shot("foundry-filter-narrowed");
    await t.hold(800);
    // The Checked mark, then its report.
    await t.click(".jit-mark", { after: 900 });
    await t.page.waitForSelector(".jit-hood");
    t.mark("hood");
    {
      const tab = t.page.locator(".jit-tab", { hasText: "Report" });
      const box = (await tab.boundingBox())!;
      await t.glide(box.x + box.width / 2, box.y + box.height / 2);
      await t.hold(260);
      await tab.click();
      t.mark("report");
      await t.hold(1200);
    }
    await t.hold(2200);
    await t.shot("foundry-report");
    await t.end();
  }

  if (wanted("quay")) {
    const t = await take(browser, "quay-dip", DESK);
    await quayHome(t.page);
    await t.glide(640, 520, 10);
    await t.hold(900);
    t.mark("home");
    await t.press("Meta+k", 500);
    await t.page.waitForSelector("input[aria-label='Search or ask Quay']");
    await t.type("why did sales drop last week");
    await t.hold(500);
    await t.press("Enter", 200);
    await t.page.waitForSelector(".pxd-surface");
    t.mark("surface: dip");
    await t.hold(1600);
    await t.page.mouse.wheel(0, 140);
    t.mark("scroll");
    await t.hold(4800);
    await t.shot("quay-dip-end");
    await t.end();
  }

  if (wanted("wexley")) {
    const t = await take(browser, "wexley-move", TABLET);
    await wexleySignIn(t.page);
    await t.glide(500, 600, 10);
    await t.hold(900);
    t.mark("account");
    await t.click("#ask-home", { after: 300 });
    await t.type("I've moved, update the address on my permit");
    await t.hold(500);
    await t.press("Enter", 200);
    await t.page.waitForSelector(".pxd-surface");
    t.mark("surface: wizard");
    await t.hold(1600);
    await t.shot("wexley-wizard");
    // Step 1: the new address, then Continue to step 2.
    await t.click(".pxd-surface input >> nth=0", { after: 300 });
    await t.type("22 Ashfield Road");
    await t.hold(400);
    await t.click(".pxd-surface input >> nth=3", { after: 300 });
    await t.type("WX2 4RQ");
    await t.hold(500);
    await t.click(".pxd-surface button:has-text('Continue')", { after: 1600 });
    t.mark("step 2");
    await t.shot("wexley-step2");
    await t.hold(1200);
    await t.end();
  }

  if (wanted("studio")) {
    // A previous run's "Send money" screen would make the create step a duplicate: clear it first, off camera.
    {
      const prep = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
      const p = await prep.newPage();
      const slug = await studioScreens(p);
      p.on("dialog", (d) => d.accept());
      for (let i = 0; i < 5; i++) {
        const row = p.locator("tr.row-link", { hasText: "Send money" }).first();
        if (!(await row.isVisible({ timeout: 800 }).catch(() => false))) break;
        await row.locator("button:has-text('Delete')").click();
        await p.waitForTimeout(600);
      }
      await prep.close();
      void slug;
    }
    const t = await take(browser, "studio-editor", DESK);
    const slug = await studioScreens(t.page);
    await t.glide(640, 400, 10);
    await t.hold(600);
    t.mark("screens");
    await t.click("button:has-text('New screen')", { after: 700 });
    await t.click("input[aria-label='Search examples']", { after: 200 });
    await t.type("Send money");
    await t.hold(500);
    await t.click("[role=option]:has-text('Send money')", { after: 500 });
    await t.click("button:has-text('Create screen')", { after: 800 });
    await t.page.waitForURL(new RegExp(`/w/${slug}/screens/`));
    await t.page.waitForSelector(".pxd-surface");
    await t.page.evaluate(() => document.fonts?.ready);
    t.mark("editor");
    await t.hold(1200);
    await t.shot("studio-editor");
    const nodes = t.page.locator("[role=treeitem][aria-label]");
    const count = await nodes.count();
    if (count > 2) {
      await t.click("[role=treeitem][aria-label] >> nth=2", { after: 1400 });
      t.mark("selected node 2");
      await t.shot("studio-editor-selected");
      if (count > 4) {
        await t.click("[role=treeitem][aria-label] >> nth=4", { after: 1600 });
        t.mark("selected node 4");
      }
    }
    await t.hold(800);
    await t.end();
  }

  if (wanted("gallery")) {
    // One document, seven packs, the same frame: a tall viewport so the whole surface fits, the gallery's own chrome hidden.
    const s = await still(browser, { width: 900, height: 1500 });
    for (const pack of PACKS) {
      await s.page.goto(`${GALLERY}/?example=money-send-form&theme=${pack}&width=phone`);
      await s.page.waitForSelector(".pxd-surface");
      await s.page.addStyleTag({ content: "header, nav, .g-side, .g-tools, .g-panel { visibility: hidden !important } body { background: transparent !important }" });
      await s.page.evaluate(() => document.fonts?.ready);
      await sleep(900);
      const frame = s.page.locator(".pxd-surface");
      await frame.screenshot({ path: `${dir}gallery-${pack}.png`, omitBackground: true });
      console.log(`wrote assets/gallery-${pack}.png`);
    }
    await s.close();
  }

  if (wanted("homes")) {
    const s = await still(browser, DESK);
    await haldenHome(s.page);
    await sleep(600);
    await s.page.screenshot({ path: `${dir}home-halden-desk.png` });
    await foundrySignIn(s.page);
    await sleep(600);
    await s.page.screenshot({ path: `${dir}home-foundry.png` });
    await wexleySignIn(s.page);
    await sleep(600);
    await s.page.screenshot({ path: `${dir}home-wexley.png` });
    await quayHome(s.page);
    await sleep(600);
    await s.page.screenshot({ path: `${dir}home-quay.png` });
    await s.close();
    const p = await still(browser, PHONE);
    await haldenHome(p.page);
    await sleep(600);
    await p.page.screenshot({ path: `${dir}home-halden.png` });
    await p.close();
    console.log("wrote assets/home-*.png");
  }
} finally {
  await browser.close();
}
