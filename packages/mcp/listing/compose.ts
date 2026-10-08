/**
 * Lays out the raw renders (screenshots/raw/, drawn by render.ts with the real server and MCP App)
 * as the listing images:
 *
 *   screenshots/*.png   the Claude directory carousel: each screen on its own background colour,
 *                       every image 1600 x 1200. Only the app's own response is pictured, as
 *                       Claude's spec requires ("cropped to the app response only").
 *   marketing/*.png     store-style images, 2400 x 1500: a headline, one line, and the real screen
 *                       in a chat with the prompt that made it, on the brand's paper or night ground.
 *                       For Cursor, OpenAI where allowed, polyxd.com and social posts.
 *
 * Nothing in either set is drawn by hand: every screen is a render of a document that passed the
 * spec's validator, polyxd_validate and polyxd_verify, so the pictures can't promise what the
 * product doesn't do.
 */
import { mkdirSync, readFileSync } from "node:fs";
import type { Browser } from "playwright";

export interface RawShot {
  /** The output file name, e.g. "1-split-dinner-material3.png". */
  file: string;
  path: string;
  prompt: string;
  title: string;
  /** The colour behind the screen, as CSS. */
  background: string;
  pack: string;
  packName: string;
  mode: "light" | "dark";
}

const here = (p: string) => new URL(p, import.meta.url);
const FONTS = "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&family=Young+Serif&display=swap";
const PAPER = "#F3F1EC";
const NIGHT = "#121211";
const INK = "#141413";
const SIGNAL = "#FF6E40";
const SIGNAL_TEXT = "#B14C2C";
const MUTED = "#5E5A52";
const RULE = "#DAD5CA";

/** A PNG's pixel size, from its header. */
const sizeOf = (path: string) => {
  const b = readFileSync(path);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

const uri = (path: string) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MARK = readFileSync(here("../../../brand/chosen-mark.svg"), "utf8").trim();

async function render(browser: Browser, html: string, width: number, height: number, scale: number, out: URL) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = r))))));
  await page.screenshot({ path: out.pathname });
  await page.close();
}

// ---------- The directory carousel: the screen alone, a consistent frame ----------

/** 1600 x 1200: the screen centred on its own colour, scaled to fit inside 64 px of breathing room. */
const carousel = (s: RawShot) => `<!doctype html><html><body style="margin:0;width:1600px;height:1200px;background:${s.background};display:flex;align-items:center;justify-content:center">
<img src="${uri(s.path)}" alt="" style="max-width:1472px;max-height:1072px;width:auto;height:auto;display:block">
</body></html>`;

// ---------- The marketing set ----------

interface Slide {
  file: string;
  ground: "paper" | "night";
  eyebrow: string;
  headline: string;
  line: string;
  /** What sits on the right. */
  visual: string;
}

/**
 * The real screen in a plain chat: the person's ask above it, as it happened. The screen is sized
 * from its own pixels to fit `room` (CSS px of height) whole: never cropped, so nothing it shows is cut.
 */
function chat(shot: RawShot, dark: boolean, after = "", room = 700) {
  const { width, height } = sizeOf(shot.path);
  const inner = 802;
  const h = Math.min(room, Math.round((inner * height) / width));
  const w = Math.round((h * width) / height);
  const card = dark ? "#1C1C1A" : "#FFFFFF";
  const line = dark ? "#33322E" : RULE;
  const bubble = dark ? "#2A2926" : PAPER;
  const text = dark ? "#F3F1EC" : INK;
  return `<div style="background:${card};border:1px solid ${line};border-radius:30px;padding:28px;display:flex;flex-direction:column;gap:20px;box-sizing:border-box;width:860px">
  <div style="align-self:flex-end;max-width:640px;background:${bubble};color:${text};border-radius:22px 22px 6px 22px;padding:14px 20px;font:400 19px/1.45 'Hanken Grotesk';">${esc(shot.prompt)}</div>
  <div style="border:1px solid ${line};border-radius:18px;overflow:hidden;background:${shot.background};display:flex;justify-content:center;height:${h}px">
    <img src="${uri(shot.path)}" alt="" style="display:block;width:${w}px;height:${h}px">
  </div>${after}
</div>`;
}

const chip = (label: string, dark: boolean) =>
  `<span style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;font:500 17px/1 'Hanken Grotesk';background:${dark ? "#1C1C1A" : "#FFFFFF"};color:${dark ? PAPER : INK};border:1px solid ${dark ? "#33322E" : RULE}">${label}</span>`;

const tick = `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="${SIGNAL}"/><path d="M5 9.4l2.6 2.5L13 6.6" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function slideHtml(s: Slide) {
  const dark = s.ground === "night";
  const ground = dark ? NIGHT : PAPER;
  const text = dark ? PAPER : INK;
  const muted = dark ? "#B9B4A9" : MUTED;
  const eyebrow = dark ? SIGNAL : SIGNAL_TEXT;
  return `<!doctype html><html><head><link rel="stylesheet" href="${FONTS}"></head>
<body style="margin:0;width:1600px;height:1000px;background:${ground};color:${text};font-family:'Hanken Grotesk';overflow:hidden;position:relative">
<div style="position:absolute;left:96px;top:0;bottom:0;width:556px;display:flex;flex-direction:column;justify-content:center;gap:24px">
  <div style="font:600 16px/1 'Hanken Grotesk';letter-spacing:0.12em;text-transform:uppercase;color:${eyebrow}">${esc(s.eyebrow)}</div>
  <div style="font:400 58px/1.06 'Young Serif';letter-spacing:-0.015em">${esc(s.headline)}</div>
  <div style="font:400 22px/1.5 'Hanken Grotesk';color:${muted}">${esc(s.line)}</div>
</div>
<div style="position:absolute;left:96px;bottom:64px;display:flex;align-items:center;gap:12px">
  <span style="display:block;width:36px;height:36px">${MARK.replace("<svg", '<svg width="36" height="36"')}</span>
  <span style="font:400 26px/1 'Young Serif';letter-spacing:-0.015em">polyxd</span>
</div>
<div style="position:absolute;right:72px;top:0;bottom:0;width:860px;display:flex;align-items:center;justify-content:center">${s.visual}</div>
</body></html>`;
}

export async function compose(browser: Browser, shots: RawShot[], variants: RawShot[]) {
  mkdirSync(here("marketing/"), { recursive: true });

  for (const s of shots) {
    await render(browser, carousel(s), 1600, 1200, 1, here(`screenshots/${s.file}`));
    console.log(`wrote listing/screenshots/${s.file}`);
  }

  const by = (prefix: string) => shots.find((s) => s.file.startsWith(prefix))!;
  const [split, , govuk, dashboard, compare] = ["1-", "2-", "3-", "4-", "5-"].map(by);

  // The same screen in four packs, each labelled with its design system.
  const grid = [split, ...variants]
    .map(
      (v) => `<figure style="margin:0;display:flex;flex-direction:column;gap:10px">
  <div style="height:300px;border-radius:18px;overflow:hidden;border:1px solid #33322E;background:${v.background}"><img src="${uri(v.path)}" alt="" style="width:100%;height:100%;object-fit:contain;object-position:center;display:block"></div>
  <figcaption>${chip(`${esc(v.packName)} · ${v.mode}`, true)}</figcaption>
</figure>`,
    )
    .join("");

  const checks = ["Valid against the open spec", "Every value bound to your data", "One primary action at a time", "At most six inputs per view", "Labels that say what happens"]
    .map((c) => `<div style="display:flex;align-items:center;gap:12px;font:500 19px/1.3 'Hanken Grotesk';color:${INK}">${tick}${esc(c)}</div>`)
    .join("");

  const pressed = `<div style="align-self:flex-end;max-width:700px;background:${PAPER};color:${INK};border-radius:22px 22px 6px 22px;padding:14px 20px;font:400 17px/1.45 'Hanken Grotesk'"><span style="color:${SIGNAL_TEXT};font-weight:600">You pressed</span> “Choose this plan” on Full Fibre 500, and the chat carries on from there.</div>`;

  const slides: Slide[] = [
    { file: "1-ask-for-a-screen.png", ground: "paper", eyebrow: "Screens, not walls of text", headline: "Ask for it. Get a real screen.", line: "Forms, reviews and comparisons appear right in the chat, in a real design system, with buttons that do what they say.", visual: chat(split, false) },
    { file: "2-any-design-system.png", ground: "night", eyebrow: "25 design systems", headline: "One screen. Any design system.", line: "The same document looks native in Material 3, IBM Carbon, GOV.UK, shadcn/ui and 21 more, light or dark.", visual: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;width:860px">${grid}</div>` },
    { file: "3-checked-first.png", ground: "paper", eyebrow: "Checked before it's shown", headline: "Checked before anyone sees it.", line: "Every screen passes the open Polyxd spec and its checks first. A screen with errors is never shown; it's fixed first.", visual: `<div style="position:relative;width:860px">${chat(govuk, false)}<div style="position:absolute;right:-24px;bottom:56px;background:#FFFFFF;border:1px solid ${RULE};border-radius:24px;padding:24px 26px;display:flex;flex-direction:column;gap:14px">${checks}</div></div>` },
    { file: "4-your-numbers.png", ground: "night", eyebrow: "Dashboards from your data", headline: "Your numbers, as a dashboard.", line: "Metrics, a chart with a plain-words summary and a table, using only the numbers you gave. Nothing invented.", visual: chat(dashboard, true, "", 760) },
    { file: "5-chat-carries-on.png", ground: "paper", eyebrow: "It's a conversation", headline: "Press a button. The chat carries on.", line: "Your choice comes back as your next message, with what you entered. Nothing is paid, sent or saved behind your back.", visual: chat(compare, false, pressed, 640) },
  ];
  for (const s of slides) {
    await render(browser, slideHtml(s), 1600, 1000, 1.5, here(`marketing/${s.file}`));
    console.log(`wrote listing/marketing/${s.file}`);
  }
}
