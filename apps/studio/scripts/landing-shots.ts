/**
 * The landing's product images (public/landing/*.png), captured from Studio itself.
 *
 * It seeds a workspace the way a team would fill one: an account, the Harbourline workspace, the
 * Sketch pack (packages/ds-sketch) imported as one Tokens Studio file and mapped, a
 * Harbourline design system started from the Mono template with its brand ramp turned to a
 * harbour teal and published as the default, the spec's Send money and two more screens
 * published, and the Harbourline shell. Then it opens each page in Chromium, light theme, at twice
 * the pixel density, at the sizes the landing lays them out at.
 *
 * Run it against a local Studio with a database of its own, so nothing real is touched:
 *
 *   npx wrangler d1 migrations apply studio-dev --local --persist-to /tmp/studio-shots   (in apps/studio)
 *   npm run build -w @polyxd/studio && npx wrangler dev --persist-to /tmp/studio-shots    (in apps/studio)
 *   node apps/studio/scripts/landing-shots.ts [--base http://localhost:8789] [--session <file> [--reuse]]
 *
 * The account is a local test one with a random password, made fresh each run; `--session` keeps
 * its cookies (and the ids it made) in a file for other captures, and `--reuse` captures again from
 * it without seeding. Locally no email goes out.
 */
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// Playwright comes with the workspace (@polyxd/verifier depends on it).
import { chromium, type APIRequestContext, type Browser, type Page } from "playwright";
import { rebrandChanges } from "../src/tokens/ramp.ts";
import type { Graph } from "../src/import/read.ts";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const BASE = arg("base") ?? "http://localhost:8789";
const SESSION = arg("session");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = fileURLToPath(new URL("../public/landing/", import.meta.url));
/** The harbour teal the Harbourline brand ramp is turned to. */
const HUE = 200;

async function call<T>(req: APIRequestContext, method: string, path: string, body?: unknown): Promise<T> {
  const res = await req.fetch(`${BASE}${path}`, {
    method,
    headers: { origin: BASE, ...(body !== undefined && !(body as { multipart?: unknown }).multipart ? { "content-type": "application/json" } : {}) },
    ...(body === undefined ? {} : (body as { multipart?: unknown }).multipart ? body as object : { data: JSON.stringify(body) }),
  });
  if (!res.ok()) throw new Error(`${method} ${path}: ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

const example = async (name: string) => {
  const { $schema: _, ...doc } = JSON.parse(await readFile(join(root, "packages/spec/examples", `${name}.json`), "utf8"));
  doc.surface = { ...doc.surface, origin: "authored" };
  return doc;
};

export interface Seeded {
  slug: string;
  sketch: { id: string; version: string };
  harbourline: { id: string; version: string };
  shell: string;
}

/** Everything the images show, made through the same API the app uses. */
export async function seed(req: APIRequestContext): Promise<Seeded> {
  const email = `mira.okafor+${Date.now()}@harbourline.test`;
  await call(req, "POST", "/api/auth/sign-up/email", { name: "Mira Okafor", email, password: randomBytes(18).toString("base64url"), callbackURL: "/" });
  let slug = "harbourline";
  for (let n = 2; ; n++) {
    try {
      await call(req, "POST", "/api/workspaces", { name: "Harbourline", slug });
      break;
    } catch (e) {
      if (!String(e).includes(": 409 ")) throw e;
      slug = `harbourline-${n}`;
    }
  }
  const w = `/api/w/${slug}`;

  // Harbourline's own design system: the Mono template, its brand ramp turned to teal, published as the default.
  const mono = await call<{ designSystemId: string; versionId: string }>(req, "POST", `${w}/design-systems/from-template`, { template: "mono", name: "Harbourline" });
  const { graph } = await call<{ graph: Graph }>(req, "GET", `${w}/design-systems/${mono.designSystemId}/versions/${mono.versionId}/graph`);
  const turned = await call<{ versionId: string }>(req, "POST", `${w}/design-systems/${mono.designSystemId}/versions/${mono.versionId}/edit`, { changes: rebrandChanges(graph, HUE), notes: "Harbour teal" });
  await call(req, "POST", `${w}/design-systems/${mono.designSystemId}/versions/${turned.versionId}/publish`);

  // The Sketch pack, imported the way most teams bring tokens: one Tokens Studio file, its sets the
  // pack's token files and its themes the pack's modes. Exact matches accepted, as the mapping offers.
  const pack = join(root, "packages/ds-sketch");
  const manifest = JSON.parse(await readFile(join(pack, "manifest.json"), "utf8")) as { modes: Record<string, string[]> };
  const setOf = (file: string) => file.replace(/^tokens\//, "").replace(/\.json$/, "");
  const files = [...new Set(Object.values(manifest.modes).flat())];
  const studio: Record<string, unknown> = {};
  for (const f of files) studio[setOf(f)] = JSON.parse(await readFile(join(pack, f), "utf8"));
  // A mode's own file is enabled; the files every mode shares are its source.
  const shared = files.filter((f) => Object.values(manifest.modes).every((m) => m.includes(f)));
  studio.$themes = Object.entries(manifest.modes).map(([mode, list]) => ({ id: mode, name: mode, selectedTokenSets: Object.fromEntries(list.map((f) => [setOf(f), shared.includes(f) && f !== "tokens/semantic.json" ? "source" : "enabled"])) }));
  studio.$metadata = { tokenSetOrder: files.map(setOf) };
  const imported = await call<{ designSystemId: string; versionId: string }>(req, "POST", `${w}/design-systems/import`, {
    multipart: { name: "Sketch", file: { name: "sketch.tokens.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(studio, null, 2)) } },
  });
  await call(req, "POST", `${w}/design-systems/${imported.designSystemId}/versions/${imported.versionId}/accept-exact`);

  // Screens: the spec's examples as Harbourline's, published, and the shell they sit in.
  for (const [name, key, file] of [["Send money", "send-money", "money-send-form"], ["Balance", "balance", "money-balance-overview"], ["Order status", "order-status", "shop-order-status"]] as const) {
    const doc = await example(file);
    await call(req, "POST", `${w}/screens`, { name, key, intent: doc.surface.intent, document: doc, notes: "From the spec's example" });
    await call(req, "POST", `${w}/screens/${key}/versions/1/publish`);
  }
  // The shell as New screen → Shell makes it: the example without its maintenance banner and sailing times.
  const shell = await example("shell-product");
  const frame = shell.components.find((c: { id: string }) => c.id === shell.root);
  delete frame.banner;
  const aside = shell.components.find((c: { id: string }) => c.id === frame.aside);
  aside.children = aside.children.filter((id: string) => id !== "sailing");
  shell.components = shell.components.filter((c: { id: string }) => c.id !== "banner" && c.id !== "sailing");
  delete shell.data.notice;
  delete shell.data.nextSailing;
  shell.data.legal = `© ${new Date().getFullYear()} Harbourline`;
  shell.data.release = "";
  await call(req, "POST", `${w}/screens`, { name: "Harbourline", key: "shell", intent: "product.shell", document: shell });

  return { slug, sketch: { id: imported.designSystemId, version: imported.versionId }, harbourline: { id: mono.designSystemId, version: turned.versionId }, shell: "shell" };
}

/** Waits for the page's fonts, its lazy chunks and the mark to settle. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

/** The Screens editor on the shell, the AppBar selected, a published screen in the Outlet. */
export async function openShell(page: Page, s: Seeded, mode: "light" | "dark") {
  await page.goto(`${BASE}/w/${s.slug}/screens/${s.shell}`);
  await page.getByRole("treeitem", { name: "AppBar bar" }).click();
  await page.getByLabel("Screen in the Outlet").selectOption("send-money");
  if (mode === "dark") await page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Dark" }).click();
  await settle(page);
  await page.mouse.move(0, 0);
}

async function capture(browser: Browser, s: Seeded, state: Awaited<ReturnType<APIRequestContext["storageState"]>>) {
  const shot = async (viewport: { width: number; height: number }, file: string, go: (page: Page) => Promise<void | (() => Promise<Buffer>)>) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce", storageState: state });
    const page = await context.newPage();
    const custom = await go(page);
    await settle(page);
    const png = custom ? await custom() : await page.screenshot({ animations: "disabled" });
    await writeFile(join(out, file), png);
    console.log(`wrote public/landing/${file}`);
    await context.close();
  };
  const ds = (d: { id: string; version: string }, tail: string) => `${BASE}/w/${s.slug}/design-systems/${d.id}/versions/${d.version}/${tail}`;

  await shot({ width: 1600, height: 1000 }, "scan.png", async (page) => {
    await page.goto(ds(s.sketch, "scan"));
  });
  await shot({ width: 1600, height: 1000 }, "mapping.png", async (page) => {
    await page.goto(ds(s.sketch, "map"));
    // Every role, not only the ones that need a look (none do once the exact matches are in).
    const look = page.getByRole("button", { name: /^Needs a look/ });
    if ((await look.getAttribute("aria-pressed")) === "true") await look.click();
    await page.getByRole("row", { name: /color\.text\.default/ }).first().click();
  });
  await shot({ width: 1600, height: 1000 }, "tokens.png", async (page) => {
    await page.goto(ds(s.harbourline, "edit"));
    await page.getByRole("button", { name: /^400/ }).first().click();
  });
  // The drawers are captured on their own, at the width they open at, from the top.
  const top = (page: Page, name: string, height: number) => async () => {
    const box = (await page.getByRole("dialog", { name }).boundingBox())!;
    return page.screenshot({ clip: { x: box.x, y: 0, width: box.width, height }, animations: "disabled" });
  };
  await shot({ width: 1600, height: 1000 }, "export.png", async (page) => {
    await page.goto(ds(s.harbourline, "edit"));
    await page.getByRole("button", { name: "Export" }).click();
    return top(page, "Export", 739);
  });
  await shot({ width: 1600, height: 1000 }, "templates.png", async (page) => {
    await page.goto(`${BASE}/w/${s.slug}/design-systems`);
    await page.getByRole("button", { name: "Start from a template" }).first().click();
    await page.getByRole("option", { name: /^Mono/ }).click();
    return top(page, "Start from a template", 690);
  });
  await shot({ width: 1920, height: 1000 }, "screens.png", (page) => openShell(page, s, "light"));
  await shot({ width: 1920, height: 1000 }, "screens-dark.png", (page) => openShell(page, s, "dark"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch();
  try {
    // --reuse with --session captures again from a workspace seeded before, rather than a new one.
    const kept = SESSION && process.argv.includes("--reuse") ? JSON.parse(await readFile(SESSION, "utf8").catch(() => "null")) : null;
    let s: Seeded, state;
    if (kept) ({ seeded: s, state } = kept);
    else {
      const context = await browser.newContext();
      s = await seed(context.request);
      state = await context.request.storageState();
      if (SESSION) await writeFile(SESSION, JSON.stringify({ base: BASE, seeded: s, state }, null, 2));
    }
    await capture(browser, s, state);
  } finally {
    await browser.close();
  }
}
