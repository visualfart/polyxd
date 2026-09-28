/**
 * The Polyxd mark and tokens, from BRAND-2026.md. A p made of three shapes and a pupil on a
 * 32-unit grid: an orange bowl and stem, a white firm-squircle window, a solid ink pupil drawn on
 * top (not cut). Every shape is a rounded rectangle whose corners are one cubic each, handles at a
 * fraction `f` of the radius (0.552 draws circular arcs, 0.88 a firm squircle).
 *
 * This writes every asset from that one definition, so nothing is drawn twice:
 *   brand/mark.svg              the mark in colour; identical to chosen-mark.svg (checked here)
 *   brand/mark-dark.svg         the same mark: on night it does not change (kept for old links)
 *   brand/mark-mono.svg         one colour for light grounds: ink p and pupil, paper window
 *   brand/mark-paper.svg        one colour for dark grounds: paper p and pupil, ink window
 *   brand/mark-small.svg        no pupil, for 12px and below
 *   brand/mark-states.svg       the eight pupil states, as <symbol>s and laid out in a row
 *   brand/mark.css              the Mark's state CSS (data-state), from the design system
 *   brand/tokens.css            CSS custom properties for both themes, from tokens.json
 *   brand/icon-*.png            app icons (128, 180, 192, 256, 512, 1024) on ink; icon-accent-1024.png on signal
 *   brand/og.png                1200×630 social image
 *   brand/favicon.ico           the mark alone at 16, 32 and 48px, for browsers and crawlers that ask for /favicon.ico
 * tokens.json is the design system's own file (Claude Design, "Polyxd Design System"), copied here.
 * Run with `node brand/build.ts`; the site, Studio, the demos and the editor extension copy from here.
 * `node brand/icons.ts` writes only the app icons, and `--check` says whether they are current.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const INK = "#141413";
export const PAPER = "#F3F1EC";
export const NIGHT = "#121211";
export const SIGNAL = "#FF6E40";
export const WHITE = "#FFFFFF";
export const MUTED = "#5E5A52";
/** The old name for the brand's one colour; it is `SIGNAL` now. */
export const ACCENT = SIGNAL;

/** Numbers as the artwork writes them: at most three decimals, no trailing zeros. */
const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** A rounded rectangle, each corner one cubic with handles at `f` of the radius. */
export function roundRect(x: number, y: number, w: number, h: number, r: number, f: number): string {
  const k = r * f;
  const [l, t, rt, b] = [x, y, x + w, y + h];
  return (
    `M${n(l + r)} ${n(t)}H${n(rt - r)}C${n(rt - r + k)} ${n(t)} ${n(rt)} ${n(t + r - k)} ${n(rt)} ${n(t + r)}` +
    `V${n(b - r)}C${n(rt)} ${n(b - r + k)} ${n(rt - r + k)} ${n(b)} ${n(rt - r)} ${n(b)}` +
    `H${n(l + r)}C${n(l + r - k)} ${n(b)} ${n(l)} ${n(b - r + k)} ${n(l)} ${n(b - r)}` +
    `V${n(t + r)}C${n(l)} ${n(t + r - k)} ${n(l + r - k)} ${n(t)} ${n(l + r)} ${n(t)}Z`
  );
}

const CIRCULAR = 0.552;
const FIRM = 0.88;
export const BOWL = roundRect(6, 6, 20, 20, 7, CIRCULAR);
export const STEM = roundRect(6, 14, 5, 14, 2.5, CIRCULAR);
export const WINDOW = roundRect(11.2, 11.2, 9.6, 9.6, 4.8, FIRM);
/** The checked state's tick, in the window. */
export const TICK = "M13.9 16.3l1.5 1.5 2.8-3.1";
/** The pupil as a circle drawn with the same cubic corners as everything else. */
const pupilPath = (cx: number, cy: number, r: number) => roundRect(cx - r, cy - r, 2 * r, 2 * r, r, CIRCULAR);

export type MarkState = "idle" | "reading" | "looking" | "attention" | "thinking" | "blink" | "checked" | "asleep";
export const MARK_STATES: MarkState[] = ["idle", "reading", "looking", "attention", "thinking", "blink", "checked", "asleep"];

/** Colours of the three parts. `colour` is the mark; `ink` and `paper` are the one-colour versions. */
export type MarkColours = "colour" | "ink" | "paper";
const PARTS: Record<MarkColours, { p: string; window: string; pupil: string }> = {
  colour: { p: SIGNAL, window: WHITE, pupil: INK },
  ink: { p: INK, window: PAPER, pupil: INK },
  paper: { p: PAPER, window: INK, pupil: PAPER },
};

export interface MarkOptions {
  colours?: MarkColours;
  /**
   * The pupil: `true` (idle), `false` for the small mark (12px and below), or where it sits.
   * Only the pupil ever moves; the p and the window never change.
   */
  pupil?: boolean | { cx?: number; cy?: number; r?: number };
  /** A still state instead of a pupil position; for moving states use `markSvg` and mark.css. */
  state?: MarkState;
  /** Override a part's fill, e.g. `var(--signal)` when the mark sits in a themed page. */
  fills?: Partial<{ p: string; window: string; pupil: string }>;
  /** An extra shape in the window. */
  extra?: string;
}

/** The pupil for each still state, as BRAND-2026.md describes it. */
function stillPupil(state: MarkState, fill: string): string {
  const bar = (y: number, opacity = "") => `<path d="${roundRect(13.4, y - 0.8, 5.2, 1.6, 0.8, CIRCULAR)}" fill="${fill}"${opacity}/>`;
  switch (state) {
    case "reading": return `<path d="${pupilPath(17.3, 14.9, 2.4)}" fill="${fill}"/>`;
    case "looking": return `<path d="${pupilPath(14.7, 17.1, 2.4)}" fill="${fill}"/>`;
    case "attention": return `<path d="${pupilPath(16, 16, 3)}" fill="${fill}"/>`;
    // Thinking orbits the centre at 1.1; still, it is shown at the start of its turn.
    case "thinking": return `<path d="${pupilPath(17.1, 16, 2.4)}" fill="${fill}"/>`;
    case "blink": return bar(16);
    case "checked": return `<path d="${TICK}" fill="none" stroke="${fill}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "asleep": return bar(17.4, ` fill-opacity="0.4"`);
    default: return `<path d="${pupilPath(16, 16, 2.4)}" fill="${fill}"/>`;
  }
}

/** The mark's inner SVG, for a 32×32 viewBox. */
export function mark({ colours = "colour", pupil = true, state, fills = {}, extra = "" }: MarkOptions = {}): string {
  const c = { ...PARTS[colours], ...fills };
  let eye = "";
  if (state) eye = stillPupil(state, c.pupil);
  else if (pupil) {
    const o = typeof pupil === "object" ? pupil : {};
    eye = `<path d="${pupilPath(o.cx ?? 16, o.cy ?? 16, o.r ?? 2.4)}" fill="${c.pupil}"/>`;
  }
  return `<path d="${BOWL}" fill="${c.p}"/><path d="${STEM}" fill="${c.p}"/><path d="${WINDOW}" fill="${c.window}"/>${eye}${extra}`;
}

export const svg = (inner: string, attrs = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${attrs}>${inner}</svg>\n`;

/**
 * The living mark for a web page, the design system's `Mark` as static HTML: its pupil and tick
 * move by `data-state` and brand/mark.css. Colours come from the page's tokens (tokens.css).
 */
export function markSvg({ size = 32, state = "idle", title, className = "", mono }: { size?: number; state?: MarkState; title?: string; className?: string; mono?: "ink" | "paper" } = {}): string {
  const p = mono === "ink" ? "var(--ink)" : mono === "paper" ? "var(--ground)" : "var(--signal)";
  const win = mono === "ink" ? "var(--ground)" : mono === "paper" ? "var(--ink)" : "var(--mark-window)";
  const pupil = mono === "ink" ? "var(--ink)" : mono === "paper" ? "var(--ground)" : "var(--mark-pupil)";
  const small = size < 12;
  const a11y = title ? ` role="img"` : ` aria-hidden="true"`;
  return (
    `<svg class="pxb-mark${className ? ` ${className}` : ""}" data-state="${state}" width="${size}" height="${size}" viewBox="0 0 32 32"${a11y} focusable="false">` +
    (title ? `<title>${title}</title>` : "") +
    `<path d="${BOWL}" fill="${p}"/><path d="${STEM}" fill="${p}"/><path d="${WINDOW}" fill="${win}"/>` +
    (small ? "" : `<circle class="pxb-pupil" cx="16" cy="16" r="2.4" fill="${pupil}"/><path class="pxb-tick" d="${TICK}" pathLength="1" fill="none" stroke="${pupil}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`) +
    `</svg>`
  );
}

/** The Mark's state CSS, exactly as the design system's components/bundle.css draws it. */
export const MARK_CSS = `/* The Polyxd mark's pupil states. Written by brand/build.ts from the design system's Mark; do not edit. */
.pxb-mark{display:inline-block;flex-shrink:0;vertical-align:middle}
.pxb-mark .pxb-pupil{transform-box:view-box;transform-origin:16px 16px;transition:transform var(--duration-base,320ms) var(--ease-standard,cubic-bezier(0.2,0,0,1)),opacity var(--duration-base,320ms) var(--ease-standard,cubic-bezier(0.2,0,0,1))}
.pxb-mark .pxb-tick{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset var(--duration-base,320ms) var(--ease-standard,cubic-bezier(0.2,0,0,1))}
.pxb-mark[data-state="idle"] .pxb-pupil{transform:none}
.pxb-mark[data-state="reading"] .pxb-pupil{transform:translate(1.3px,-1.1px)}
.pxb-mark[data-state="looking"] .pxb-pupil{transform:translate(-1.3px,1.1px)}
.pxb-mark[data-state="attention"] .pxb-pupil{transform:scale(1.25)}
.pxb-mark[data-state="asleep"] .pxb-pupil{transform:translate(0,1.4px) scale(1.08,0.33);opacity:.4}
.pxb-mark[data-state="checked"] .pxb-pupil{transform:scale(0);opacity:0}
.pxb-mark[data-state="checked"] .pxb-tick{stroke-dashoffset:0}
.pxb-mark[data-state="thinking"] .pxb-pupil{animation:pxb-orbit var(--duration-orbit,1600ms) linear infinite}
.pxb-mark[data-state="blink"] .pxb-pupil{animation:pxb-blink var(--duration-blink,280ms) var(--ease-standard,cubic-bezier(0.2,0,0,1)) 1}
@keyframes pxb-orbit{0%{transform:rotate(0deg) translate(1.1px,0) rotate(0deg)}100%{transform:rotate(360deg) translate(1.1px,0) rotate(-360deg)}}
@keyframes pxb-blink{0%,100%{transform:none}50%{transform:scale(1.08,0.33)}}
@media (prefers-reduced-motion:reduce){.pxb-mark .pxb-pupil,.pxb-mark .pxb-tick{transition:none}.pxb-mark[data-state="thinking"] .pxb-pupil,.pxb-mark[data-state="blink"] .pxb-pupil{animation:none}}
`;

// ---------- Tokens ----------

interface Tokens {
  color: { tokens: { name: string; value: string | { light: string; dark: string } }[] };
  type: { families: Record<string, string>; groups: { family: string; styles: { name: string; fontSize: string; lineHeight: string; fontWeight: number; letterSpacing?: string }[] }[] };
  spacing: { tokens: { name: string; value: string }[] };
  radius: { tokens: { name: string; value: string }[] };
  shadow: { tokens: { name: string; value: string | { light: string; dark: string } }[] };
  timing: { tokens: { name: string; value: string }[] };
}

/** tokens.json as CSS custom properties, with the same names the design system uses. */
export function tokensCss(t: Tokens): string {
  const colour = (theme: "light" | "dark") => t.color.tokens.map((c) => `  --${c.name}: ${typeof c.value === "string" ? c.value : c.value[theme]};`).join("\n");
  const shared = [
    ...Object.entries(t.type.families).map(([k, v]) => `  --font-${k}: ${v};`),
    ...t.type.groups.flatMap((g) =>
      g.styles.map((s) => `  --text-${s.name}: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${g.family});${s.letterSpacing ? ` --tracking-${s.name}: ${s.letterSpacing};` : ""}`),
    ),
    ...t.spacing.tokens.map((s) => `  --${s.name}: ${s.value};`),
    ...t.radius.tokens.map((s) => `  --${s.name}: ${s.value};`),
    // A gap of ground, then the ring in focus: written with the tokens so it follows a themed island.
    `  --focus-ring: 0 0 0 2px var(--ground), 0 0 0 4px var(--focus);`,
    ...t.timing.tokens.map((s) => `  --${s.name}: ${s.value};`),
  ].join("\n");
  return `/* Polyxd's tokens: the design system's tokens.json as CSS custom properties.
   Written by brand/build.ts; do not edit. Paper by default, night when the visitor prefers dark,
   and data-theme="light" or "dark" on any element pins a theme for it and everything inside. */
:root {
${shared}
}
:root,
[data-theme="light"] {
  color-scheme: light;
${colour("light")}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${colour("dark").replace(/^/gm, "  ")}
  }
}
[data-theme="dark"] {
  color-scheme: dark;
${colour("dark")}
}
`;
}

/** The Google Fonts stylesheet for the brand's three families. */
export const FONTS_URL = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Hanken+Grotesk:wght@400;500;600&family=Young+Serif&display=swap";

/** The app icons written as brand/icon-<size>.png. 256 is the editor extension's: 128 at 2x. */
export const ICON_SIZES = [128, 180, 192, 256, 512, 1024];

/** An app icon as a page to screenshot: the mark on the squircle tile (f 0.73) at radius-icon, 22.5% of its side. */
export const iconTile = (bg: string, inner: string, size: number) =>
  `<!doctype html><body style="margin:0;background:transparent"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="${roundRect(0, 0, size, size, size * 0.225, 0.73)}" fill="${bg}"/><svg x="${size * 0.13}" y="${size * 0.13}" width="${size * 0.74}" height="${size * 0.74}" viewBox="0 0 32 32">${inner}</svg></svg></body>`;

const dir = fileURLToPath(new URL("./", import.meta.url));

if (import.meta.url === `file://${process.argv[1]}`) {
  await mkdir(dir, { recursive: true });
  const colour = svg(mark());
  // The generated mark must be the chosen artwork, byte for byte.
  const chosen = await readFile(`${dir}chosen-mark.svg`, "utf8").catch(() => null);
  if (chosen !== null && chosen.trim() !== colour.trim()) throw new Error("brand/mark.svg no longer matches brand/chosen-mark.svg");
  await writeFile(`${dir}mark.svg`, colour);
  await writeFile(`${dir}mark-dark.svg`, colour);
  await writeFile(`${dir}mark-mono.svg`, svg(mark({ colours: "ink" })));
  await writeFile(`${dir}mark-paper.svg`, svg(mark({ colours: "paper" })));
  await writeFile(`${dir}mark-small.svg`, svg(mark({ pupil: false })));
  await writeFile(
    `${dir}mark-states.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${32 * MARK_STATES.length} 32">\n` +
      MARK_STATES.map((s) => `  <symbol id="polyxd-${s}" viewBox="0 0 32 32">${mark({ state: s })}</symbol>`).join("\n") +
      "\n" +
      MARK_STATES.map((s, i) => `  <use href="#polyxd-${s}" xlink:href="#polyxd-${s}" x="${i * 32}" width="32" height="32"/>`).join("\n") +
      "\n</svg>\n",
  );
  await writeFile(`${dir}mark.css`, MARK_CSS);
  const tokens = JSON.parse(await readFile(`${dir}tokens.json`, "utf8")) as Tokens;
  await writeFile(`${dir}tokens.css`, tokensCss(tokens));
  console.log("wrote brand/mark*.svg, brand/mark.css, brand/tokens.css");

  const { launch } = await import("@polyxd/verifier");
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
    for (const size of ICON_SIZES) await shot(iconTile(INK, mark(), size), size, size, `icon-${size}.png`);
    await shot(iconTile(SIGNAL, mark({ colours: "ink" }), 1024), 1024, 1024, "icon-accent-1024.png");
    // favicon.ico: the mark alone, as the SVG favicon is, at three sizes, each a PNG inside the ICO.
    const sizes = [16, 32, 48];
    const pngs: Buffer[] = [];
    for (const size of sizes) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(`<!doctype html><body style="margin:0;background:transparent"><svg width="${size}" height="${size}" viewBox="0 0 32 32">${mark()}</svg></body>`);
      pngs.push(await page.screenshot({ omitBackground: true }));
      await page.close();
    }
    const head = Buffer.alloc(6 + 16 * sizes.length);
    head.writeUInt16LE(1, 2);
    head.writeUInt16LE(sizes.length, 4);
    let offset = head.length;
    sizes.forEach((size, i) => {
      const at = 6 + 16 * i;
      head.writeUInt8(size, at);
      head.writeUInt8(size, at + 1);
      head.writeUInt16LE(1, at + 4);
      head.writeUInt16LE(32, at + 6);
      head.writeUInt32LE(pngs[i].length, at + 8);
      head.writeUInt32LE(offset, at + 12);
      offset += pngs[i].length;
    });
    await writeFile(`${dir}favicon.ico`, Buffer.concat([head, ...pngs]));
    console.log("wrote brand/favicon.ico");
    // The lockup: the word at 0.8 of the mark, a gap of 5/32 of it.
    const m = 96;
    await shot(
      `<!doctype html><head><link href="${FONTS_URL}" rel="stylesheet"></head><body style="margin:0;width:1200px;height:630px;background:${PAPER};font-family:'Hanken Grotesk',sans-serif;color:${INK}"><div style="height:630px;box-sizing:border-box;padding:72px;display:flex;flex-direction:column;justify-content:space-between"><div style="display:flex;align-items:center;gap:${Math.round((m * 5) / 32)}px"><svg width="${m}" height="${m}" viewBox="0 0 32 32">${mark()}</svg><span style="font-family:'Young Serif',serif;font-size:${Math.round(m * 0.8)}px;letter-spacing:-0.015em;line-height:1;margin-top:-${Math.round(m * 0.04)}px">polyxd</span></div><div><div style="font-family:'Young Serif',serif;font-size:64px;line-height:1.02;letter-spacing:-0.015em;max-width:1000px">Interfaces that show up when you need them.</div><div style="margin-top:24px;font-size:26px;line-height:1.4;color:${MUTED}">Open spec, renderer and verifier · generated or authored · your design system</div></div></div></body>`,
      1200,
      630,
      "og.png",
    );
  } finally {
    await browser.close();
  }
}
