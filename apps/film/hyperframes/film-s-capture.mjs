/**
 * Film S's Studio shots: the real Studio, captured from a local seeded instance.
 *
 * It seeds a throwaway workspace the way apps/studio/scripts/landing-shots.ts does (a local test
 * account with a random password, the Harbourline workspace, the Sketch pack imported and mapped,
 * Harbourline's own design system from the Mono template turned to a harbour teal), adds the one
 * screen the film is about (Cancel your plan, key "cancel"), then walks Studio in Chromium at twice
 * the pixel density and saves each state the film needs, with the boxes of the parts the camera
 * and the doodles aim at (boxes.json, CSS pixels of the 1600×1000 viewport). It also saves the
 * published screen as a product fetches it and Harbourline's CSS export, which the film's phone
 * renders with.
 *
 * Run it against a local Studio with a database of its own, so nothing real is touched:
 *
 *   npx wrangler d1 migrations apply studio-dev --local --persist-to <dir>          (in apps/studio)
 *   npm run build -w @polyxd/studio && npx wrangler dev --persist-to <dir> --port 8789
 *   node apps/film/hyperframes/film-s-capture.mjs [--base http://localhost:8789] [--session <file>]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const require = createRequire(here("../../studio/package.json"));
const { chromium } = require("playwright");
const { seed } = await import(here("../../studio/scripts/landing-shots.ts"));

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const B = arg("base") ?? "http://localhost:8789";
const SESSION = arg("session");
const OUT = here("film-s-who-gives-ai-taste/assets/studio");
mkdirSync(OUT, { recursive: true });
const only = arg("only")?.split(",");

/** The screen a designer authors in the film: Harbourline's cancel flow, in its own voice. */
const CANCEL = {
  specVersion: "0.3.0",
  surface: { id: "cancel", title: "Cancel your plan", intent: "subscription.cancel", origin: "authored" },
  root: "page",
  components: [
    { id: "page", component: "Group", children: ["ends", "plan", "actions"] },
    { id: "ends", component: "Text", text: "Your plan ends on 30 October. You can come back any time." },
    { id: "plan", component: "DetailList", items: [{ key: "plan", label: "Plan", value: "Harbourline Plus" }, { key: "until", label: "Sailings booked until", value: "30 October" }] },
    { id: "actions", component: "ActionBar", children: ["cancel", "keep"] },
    { id: "cancel", component: "Action", label: "Cancel my plan", emphasis: "primary", action: { event: { name: "subscription.cancel" } } },
    { id: "keep", component: "Action", label: "Keep my plan", emphasis: "secondary", action: { event: { name: "ui.dismiss" } } },
  ],
};
/** The three rules, in plain words, each a check from the shared vocabulary. */
const RULES = [
  { name: "One primary action per screen", why: "One clear next step. Everything else is secondary.", severity: "error", check: { check: "contains", component: "Action", where: { emphasis: "primary" }, min: 0, max: 1 } },
  { name: "Sentence case", why: "Titles and buttons read like a sentence, not a shout.", severity: "warning", check: { check: "casing", style: "sentence" } },
  { name: "Never say “Oops”", why: "Say what happened and what happens next.", severity: "error", check: { check: "avoidTerms", terms: ["Oops"], suggest: "Say what happens next" } },
];
const GUIDANCE = "Up to six options; more goes in a list.";
const FROM_HUE = 262, TO_HUE = 202;

const browser = await chromium.launch();
let s, state;
if (SESSION && existsSync(SESSION)) ({ seeded: s, state } = JSON.parse(readFileSync(SESSION, "utf8")));
else {
  const c = await browser.newContext();
  s = await seed(c.request);
  state = await c.request.storageState();
  if (SESSION) writeFileSync(SESSION, JSON.stringify({ seeded: s, state }, null, 2));
  await c.close();
}
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce", storageState: state });
const api = async (method, path, body) => {
  const res = await ctx.request.fetch(`${B}${path}`, { method, headers: { origin: B, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { data: JSON.stringify(body) } : {}) });
  if (!res.ok()) throw new Error(`${method} ${path}: ${res.status()} ${await res.text()}`);
  return res.headers()["content-type"]?.includes("json") ? res.json() : res.text();
};
const w = `/api/w/${s.slug}`;
const ds = (d, tail) => `${B}/w/${s.slug}/design-systems/${d.id}/versions/${d.version}/${tail}`;

const boxesFile = `${OUT}/boxes.json`;
const boxes = existsSync(boxesFile) ? JSON.parse(readFileSync(boxesFile, "utf8")) : {};
const page = await ctx.newPage();
await page.addStyleTag({ content: "" }).catch(() => {});
const settle = async () => {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
};
/** Toasts are real, but in a sequence of frames they would flicker: shown only where asked. */
const toasts = async (on) => page.evaluate((on) => {
  let st = document.getElementById("film-no-toast");
  if (!st) {
    st = document.createElement("style");
    st.id = "film-no-toast";
    document.head.appendChild(st);
  }
  st.textContent = on ? "" : ".toast{display:none !important}";
}, on);
const box = async (loc) => {
  const b = await loc.first().boundingBox().catch(() => null);
  return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
};
async function shot(name, parts = {}, { toast = false } = {}) {
  await toasts(toast);
  await page.mouse.move(0, 0);
  await settle();
  const b = {};
  for (const [k, loc] of Object.entries(parts)) b[k] = await box(loc);
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: "disabled", caret: "initial" });
  boxes[name] = b;
  console.log("shot", name);
}
const go = async (url) => {
  await page.goto(url);
  await settle();
};
const want = (k) => !only || only.includes(k);
const setRange = (sel, v) => page.evaluate(([sel, v]) => {
  const el = document.querySelector(sel);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}, [sel, v]);

try {
  // ——— Bring your design system: import, scan, mapping, contrast ———
  if (want("import")) {
    await go(`${B}/w/${s.slug}/design-systems/import`);
    const cards = page.locator("label.choice-card");
    await page.locator("#pkg").blur();
    await shot("import", { h1: page.locator("h1"), npm: cards.nth(0), tgz: cards.nth(1), file: cards.nth(2), scanBtn: page.getByRole("button", { name: "Scan tokens" }), pkg: page.locator("#pkg") });
    await cards.nth(2).click();
    await shot("import-file", { h1: page.locator("h1"), npm: cards.nth(0), tgz: cards.nth(1), file: cards.nth(2), drop: page.locator(".dropzone"), scanBtn: page.getByRole("button", { name: "Scan tokens" }) });
  }
  if (want("scan")) {
    await go(ds(s.sketch, "scan"));
    const stat = page.locator(".card", { hasText: /^Primitives|^Semantic|^Component/ });
    const n = (label) => page.locator(".card").filter({ hasText: label }).first();
    await shot("scan", { h1: page.locator("h1"), prim: n("Primitives"), sem: n("Semantic"), comp: n("Per component"), table: page.locator("table").first(), modes: page.locator(".card").filter({ hasText: "Modes" }).first(), stat });
    // The numbers themselves, so the film can count up over them.
    const nums = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("h1, .card *")) {
        if (el.children.length) continue;
        const t = el.textContent.trim();
        if (!/^\d+$/.test(t) && !/^We found/.test(t)) continue;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        out.push({ text: t, x: r.x, y: r.y, w: r.width, h: r.height, font: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, color: cs.color, bg: getComputedStyle(el.closest(".card") || document.body).backgroundColor });
      }
      return out;
    });
    boxes.scan.nums = nums;
  }
  if (want("map")) {
    await go(ds(s.sketch, "map"));
    const look = page.getByRole("button", { name: /^Needs a look/ });
    if ((await look.getAttribute("aria-pressed")) === "true") await look.click();
    await settle();
    const rows = page.locator(".map-table tbody tr");
    const parts = { h1: page.locator("h1"), table: page.locator(".map-table"), aside: page.locator("aside.aside"), meta: page.locator("text=/mapped ·/").first() };
    for (let i = 0; i < 14; i++) {
      parts[`row${i}`] = rows.nth(i);
      parts[`tag${i}`] = rows.nth(i).locator(".tag");
    }
    const ratios = page.locator("aside.aside span.small", { hasText: /:1 on/ });
    for (let i = 0; i < 6; i++) parts[`ratio${i}`] = ratios.nth(i);
    await shot("map", parts);
  }
  if (want("roles")) {
    await go(`${B}/w/${s.slug}/design-systems/${s.harbourline.id}`);
    // Bring the text roles, the first with contrast pairs, to the top of the view.
    await page.getByRole("row", { name: /color\.text\.default/ }).first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 150));
    await page.waitForTimeout(200);
    const rows = page.locator("table tbody tr");
    const parts = { h1: page.locator("h1"), table: page.locator("table").first() };
    for (let i = 6; i < 22; i++) {
      parts[`row${i}`] = rows.nth(i);
      parts[`contrast${i}`] = rows.nth(i).locator("td").last();
    }
    await shot("roles", parts);
  }

  // ——— Tune it: the tokens editor, the rebrand dialog sweeping the brand hue ———
  if (want("tune")) {
    await go(ds(s.harbourline, "edit"));
    const rebrand = page.getByRole("button", { name: "Rebrand" });
    const tag = page.locator(".tag", { hasText: /contrast/ }).first();
    const ramp = page.locator(".tok-ramp").first();
    await shot("edit-teal", { h1: page.locator("h1"), rebrand, tag, ramp, ramps: page.locator(".tok-ramps") });
    // Start where the generated screen was: a loud blue. Turn the ramp there first (unsaved).
    await rebrand.click();
    await setRange("#hue", FROM_HUE);
    await page.getByRole("button", { name: "Turn the ramp" }).click();
    await shot("edit-from", { h1: page.locator("h1"), rebrand, tag, ramp, ramps: page.locator(".tok-ramps") });
    // The sweep, one frame per two degrees, with the dialog open.
    await rebrand.click();
    const dlg = page.getByRole("dialog", { name: "Rebrand" });
    const frames = [];
    for (let h = FROM_HUE; h >= TO_HUE; h -= 2) {
      await setRange("#hue", h);
      await page.waitForTimeout(60);
      const name = `rb-${h}`;
      await toasts(false);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${OUT}/${name}.png`, animations: "disabled" });
      frames.push(h);
    }
    boxes.rb = { dialog: await box(dlg), hue: await box(page.locator("#hue")), preview: await box(page.locator(".tok-preview")), hueLabel: await box(page.locator("label[for=hue]")), frames };
    console.log("shot rb-*", frames.length);
    await page.getByRole("button", { name: "Turn the ramp" }).click();
    await page.waitForTimeout(300);
    await shot("edit-to", { h1: page.locator("h1"), rebrand, tag, ramp, ramps: page.locator(".tok-ramps"), toast: page.locator(".toast") }, { toast: true });
    await shot("edit-to-quiet", { h1: page.locator("h1"), rebrand, tag, ramp, ramps: page.locator(".tok-ramps") });
    // Export, from the published version.
    await go(ds(s.harbourline, "edit"));
    await page.getByRole("button", { name: "Export" }).click();
    const cards = page.getByRole("dialog", { name: "Export" }).locator("a.choice-card");
    const parts = { drawer: page.getByRole("dialog", { name: "Export" }) };
    for (let i = 0; i < 6; i++) parts[`fmt${i}`] = cards.nth(i);
    await shot("export", parts);
  }

  // ——— Decide what screens may use: components, and Choice's guidance ———
  if (want("comps")) {
    await go(`${B}/w/${s.slug}/components`);
    // Put the input group at the top of the view.
    await page.getByRole("row", { name: /^Choice/ }).first().evaluate((el) => {
      const y = el.getBoundingClientRect().top + window.scrollY - 170;
      window.scrollTo(0, y);
    });
    await page.waitForTimeout(200);
    const sw = (n) => page.getByRole("switch", { name: `Allow generators to use ${n}` });
    const row = (n) => page.getByRole("row", { name: new RegExp(`^${n}\\b`) }).first();
    const names = ["Choice", "CodeInput", "ColorInput", "DateInput", "FileInput", "Form", "RangeInput", "Rating", "TextInput", "Toggle"];
    const parts = () => Object.fromEntries(names.flatMap((n) => [[`sw${n}`, sw(n)], [`row${n}`, row(n)]]).concat([["editChoice", row("Choice").getByRole("button", { name: "Edit" })]]));
    await shot("comps-0", parts());
    await sw("Rating").click();
    await page.waitForTimeout(300);
    await shot("comps-1", parts());
    await sw("ColorInput").click();
    await page.waitForTimeout(300);
    await shot("comps-2", parts());
    await sw("CodeInput").click();
    await page.waitForTimeout(300);
    await shot("comps-3", parts());
    await row("Choice").getByRole("button", { name: "Edit" }).click();
    const drawer = page.getByRole("dialog", { name: "Choice" });
    const use = page.locator("#use");
    const help = drawer.locator(".help").first();
    await use.fill("");
    const dparts = { drawer, use, help, sum: page.locator("#sum"), not: page.locator("#not") };
    const steps = [];
    for (let i = 0; i <= GUIDANCE.length; i += 3) steps.push(i);
    if (steps[steps.length - 1] !== GUIDANCE.length) steps.push(GUIDANCE.length);
    for (const i of steps) {
      await use.fill(GUIDANCE.slice(0, i));
      await shot(`choice-${String(i).padStart(2, "0")}`, i === 0 || i === GUIDANCE.length ? dparts : {});
    }
    boxes.choiceSteps = steps;
    await drawer.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(300);
  }

  // ——— Write the rules ———
  if (want("rules")) {
    for (const r of (await api("GET", `${w}/rules`)).rules) await api("DELETE", `${w}/rules/${r.id}`);
    await go(`${B}/w/${s.slug}/rules`);
    await shot("rules-0", { h1: page.locator("h1"), newBtn: page.getByRole("button", { name: "New rule" }) });
    for (const [k, r] of RULES.entries()) {
      await page.getByRole("button", { name: "New rule" }).first().click();
      const drawer = page.getByRole("dialog", { name: "New rule" });
      const dparts = { drawer, name: page.locator("#rn"), why: page.locator("#rw"), sev: page.locator("#rs"), check: page.locator("#rc"), save: drawer.getByRole("button", { name: "Save rule" }) };
      if (k === 0) {
        // The first one written as a designer writes it.
        const steps = [];
        for (let i = 0; i <= r.name.length; i += 3) steps.push(i);
        if (steps[steps.length - 1] !== r.name.length) steps.push(r.name.length);
        for (const i of steps) {
          await page.locator("#rn").fill(r.name.slice(0, i));
          await shot(`rule0-${String(i).padStart(2, "0")}`, i === 0 ? dparts : {});
        }
        boxes.rule0Steps = steps;
      } else await page.locator("#rn").fill(r.name);
      await page.locator("#rw").fill(r.why);
      await page.locator("#rs").selectOption(r.severity);
      await page.locator("#rc").fill(JSON.stringify(r.check, null, 2));
      await page.locator("#rc").blur();
      await shot(`rule${k}`, dparts);
      await drawer.getByRole("button", { name: "Save rule" }).click();
      await page.waitForTimeout(400);
      const rows = page.locator("table tbody tr");
      const parts = { h1: page.locator("h1"), table: page.locator("table") };
      for (let i = 0; i <= k; i++) {
        parts[`row${i}`] = rows.nth(i);
        parts[`sev${i}`] = rows.nth(i).locator(".tag");
        parts[`name${i}`] = rows.nth(i).locator("td b");
      }
      await shot(`rules-${k + 1}`, parts);
    }
  }

  // ——— Author, then publish: the cancel screen and the shell ———
  if (want("screens")) {
    const list = (await api("GET", `${w}/screens`)).screens;
    if (list.some((x) => x.key === "cancel")) await api("DELETE", `${w}/screens/cancel`);
    await api("POST", `${w}/screens`, { name: "Cancel your plan", key: "cancel", intent: "subscription.cancel", document: CANCEL, notes: "Written by the design team" });
    await go(`${B}/w/${s.slug}/screens/cancel`);
    const head = () => ({
      publish: page.getByRole("button", { name: /^Publish v/ }),
      status: page.locator("header .tag, .tag").filter({ hasText: /published|Not published/ }).first(),
      checked: page.locator(".tag", { hasText: /Checked/ }).first(),
      versions: page.getByRole("button", { name: /^Versions/ }),
      tree: page.getByRole("tree").first(),
      preview: page.locator(".pxd-surface").first(),
      primary: page.locator(".pxd-surface .pxd-button-primary").first(),
      props: page.locator("aside").last(),
      title: page.locator(".pxd-surface-title, .pxd-section-title, .pxd-surface h2").first(),
      toast: page.locator(".toast"),
    });
    await shot("cancel-0", head());
    await page.getByRole("treeitem", { name: "Action cancel" }).first().click();
    await shot("cancel-sel", head());
    await page.getByRole("treeitem", { name: "Text ends" }).first().click();
    await shot("cancel-sel2", head());
    await page.getByRole("treeitem", { name: "Action cancel" }).first().click();
    await page.getByRole("button", { name: /^Publish v/ }).click();
    await page.waitForTimeout(500);
    await shot("cancel-pub", head(), { toast: true });
    // What a product gets: the published document, fetched by key.
    const doc = await api("GET", `${w}/screens/cancel`);
    writeFileSync(`${OUT}/cancel.json`, JSON.stringify(doc, null, 2));
    // The shell, with the cancel screen in its Outlet.
    await go(`${B}/w/${s.slug}/screens/${s.shell}`);
    await page.getByLabel("Screen in the Outlet").selectOption("cancel");
    await settle();
    const shellParts = () => ({
      preview: page.locator(".pxd-surface-shell").first(),
      appbar: page.locator(".pxd-appbar").first(),
      nav: page.locator(".pxd-frame-nav").first(),
      main: page.locator(".pxd-frame-main").first(),
      outlet: page.locator(".pxd-outlet").first(),
      aside: page.locator(".pxd-frame-aside").first(),
      footer: page.locator(".pxd-footer").first(),
      tree: page.getByRole("tree").first(),
      treeFrame: page.getByRole("treeitem", { name: /^Frame/ }).first(),
      treeBar: page.getByRole("treeitem", { name: "AppBar bar" }).first(),
      treeNav: page.getByRole("treeitem", { name: /^Navigation / }).first(),
      props: page.locator("aside").last(),
      stage: page.locator(".pxd-surface-shell").first().locator(".."),
    });
    await shot("shell-0", shellParts());
    await page.getByRole("treeitem", { name: "AppBar bar" }).click();
    await shot("shell-bar", shellParts());
    await page.getByRole("treeitem", { name: /^Navigation / }).first().click();
    await shot("shell-nav", shellParts());
  }

  // ——— What the product renders with ———
  if (want("css")) {
    const css = await api("GET", `${w}/design-systems/${s.harbourline.id}/versions/${s.harbourline.version}/export?format=css`);
    writeFileSync(`${OUT}/harbourline.css`, css);
  }
} finally {
  writeFileSync(boxesFile, JSON.stringify(boxes, null, 1));
  await browser.close();
}
console.log("done");
