/**
 * The Polyxd mark: three shapes. A solid lowercase p, a squircle inside its bowl in the accent,
 * a circle inside the squircle in ink. Drawn on a 32-unit grid: bowl 20, squircle 9.6, pupil 4.8.
 * This writes every asset from that one definition, so nothing is drawn twice:
 *   brand/mark.svg              ink on transparent, with the pupil
 *   brand/mark-dark.svg         paper on transparent (for dark backgrounds)
 *   brand/mark-mono.svg         one colour (print, embroidery)
 *   brand/mark-small.svg        no pupil, for 16–20px (favicons)
 *   brand/mark-states.svg       the seven states, as symbols, for the site's loading and Checked marks
 *   brand/icon-*.png            app icons (180, 192, 512, 1024) on ink; brand/icon-accent-1024.png
 *   brand/og.png                1200×630 social image
 * Run with `node brand/build.ts`; the site, Studio and the editor extension copy from here.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { launch } from "@polyxd/verifier";

export const INK = "#141413";
export const PAPER = "#f4f1ea";
export const ACCENT = "#ff5a1f";

const c = 16;
const half = 4.8;
const k = 0.73 * half;
/** The squircle: four cubic curves through the axis points, handles at 0.73 of the half-size. */
const SQUIRCLE = `M${c} ${c - half}C${c + k} ${c - half} ${c + half} ${c - k} ${c + half} ${c}S${c + k} ${c + half} ${c} ${c + half} ${c - half} ${c + k} ${c - half} ${c} ${c - k} ${c - half} ${c} ${c - half}z`;
const P = "M13 6h6a7 7 0 0 1 7 7v6a7 7 0 0 1-7 7h-6a7 7 0 0 1-7-7v-6a7 7 0 0 1 7-7z";
const STEM = { x: 6, y: 14, w: 5, h: 14, r: 2.5 };

export interface MarkOptions {
  ink?: string;
  accent?: string;
  pupil?: boolean | { cx?: number; cy?: number; r?: number };
  /** Replaces the pupil with another ink shape (a blink line, a tick). */
  extra?: string;
}

/** The mark's inner SVG, 32×32 viewBox. */
export function mark({ ink = INK, accent = ACCENT, pupil = true, extra = "" }: MarkOptions = {}): string {
  const p = typeof pupil === "object" ? pupil : {};
  const dot = pupil ? `<circle cx="${p.cx ?? c}" cy="${p.cy ?? c}" r="${p.r ?? 2.4}" fill="${ink}"/>` : "";
  return `<path d="${P}" fill="${ink}"/><rect x="${STEM.x}" y="${STEM.y}" width="${STEM.w}" height="${STEM.h}" rx="${STEM.r}" fill="${ink}"/><path d="${SQUIRCLE}" fill="${accent}"/>${dot}${extra}`;
}

export const svg = (inner: string, attrs = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${attrs}>${inner}</svg>\n`;

/** Only the pupil moves; the letter never does. */
export const STATES: Record<string, MarkOptions> = {
  idle: {},
  reading: { pupil: { cx: 17.3, cy: 14.9 } },
  looking: { pupil: { cx: 14.7, cy: 17.1 } },
  blink: { pupil: false, extra: `<rect x="13.4" y="15.2" width="5.2" height="1.6" rx="0.8" fill="${INK}"/>` },
  attention: { pupil: { r: 3 } },
  checked: { pupil: false, extra: `<path d="M13.9 16.3l1.5 1.5 2.8-3.1" stroke="${INK}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` },
  asleep: { pupil: false, accent: `${INK}40` },
};

const dir = fileURLToPath(new URL("./", import.meta.url));

if (import.meta.url === `file://${process.argv[1]}`) {
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}mark.svg`, svg(mark()));
  await writeFile(`${dir}mark-dark.svg`, svg(mark({ ink: PAPER })));
  await writeFile(`${dir}mark-mono.svg`, svg(mark({ accent: INK }).replace(`r="2.4" fill="${INK}"`, `r="2.4" fill="${PAPER}"`)));
  await writeFile(`${dir}mark-small.svg`, svg(mark({ pupil: false })));
  await writeFile(
    `${dir}mark-states.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n${Object.entries(STATES)
      .map(([name, o]) => `  <symbol id="polyxd-${name}" viewBox="0 0 32 32">${mark(o)}</symbol>`)
      .join("\n")}\n</svg>\n`,
  );

  const browser = await launch();
  try {
    const shot = async (html: string, w: number, h: number, file: string) => {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.evaluate(() => (document as any).fonts?.ready);
      await page.screenshot({ path: `${dir}${file}`, omitBackground: true });
      await page.close();
      console.log(`wrote brand/${file}`);
    };
    const tile = (bg: string, inner: string, size: number, radius: number) =>
      `<!doctype html><body style="margin:0;width:${size}px;height:${size}px;background:transparent"><div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${bg};display:flex;align-items:center;justify-content:center"><svg width="${size * 0.74}" height="${size * 0.74}" viewBox="0 0 32 32">${inner}</svg></div></body>`;
    for (const size of [128, 180, 192, 512, 1024]) await shot(tile(INK, mark({ ink: PAPER }), size, size * 0.225), size, size, `icon-${size}.png`);
    await shot(tile(ACCENT, mark({ accent: PAPER }), 1024, 230), 1024, 1024, "icon-accent-1024.png");
    await shot(
      `<!doctype html><head><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&display=swap" rel="stylesheet"></head><body style="margin:0;width:1200px;height:630px;background:${PAPER};font-family:'Bricolage Grotesque',system-ui,sans-serif;color:${INK}"><div style="height:630px;box-sizing:border-box;padding:72px;display:flex;flex-direction:column;justify-content:space-between"><div style="display:flex;align-items:center;gap:14px"><svg width="96" height="96" viewBox="0 0 32 32">${mark()}</svg><span style="font-size:76px;font-weight:800;letter-spacing:-0.04em">polyxd</span></div><div><div style="font-size:60px;font-weight:800;line-height:1.05;letter-spacing:-0.03em;max-width:980px">Interfaces that show up when you need them.</div><div style="margin-top:24px;font-size:26px;font-family:system-ui,sans-serif;color:#5a574f">Open spec, renderer and verifier · generated or authored · your design system</div></div></div></body>`,
      1200,
      630,
      "og.png",
    );
  } finally {
    await browser.close();
  }
  console.log("wrote brand/mark*.svg");
}
