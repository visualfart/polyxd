/**
 * Copies what the three film projects share into each one's assets/ (a HyperFrames project must be
 * self-contained to render): the real renderer's browser build and themes, the mark and the kit,
 * the sting and end card, and the two sound effects. assets/ is ignored by git (apps/film/.gitignore);
 * this script and scripts/music-hf.ts recreate it.
 *
 *   node apps/film/hyperframes/sync.mjs
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const FILMS = ["film-a-the-ask", "film-b-show-dont-tell", "film-c-how-it-works"];
const FILES = [
  ["../../../packages/web/preview/polyxd-web.js", "polyxd/polyxd-web.js"],
  ["../../../packages/web/preview/polyxd-web.css", "polyxd/polyxd-web.css"],
  ["shared/mark.js", "shared/mark.js"],
  ["shared/kit.js", "shared/kit.js"],
  ["shared/kit.css", "shared/kit.css"],
  ["shared/sting.html", "shared/sting.html"],
  ["shared/end-card.html", "shared/end-card.html"],
  ["../assets/sfx/ui-click.wav", "sfx/ui-click.wav"],
  ["../assets/sfx/tick.wav", "sfx/tick.wav"],
  ["../assets/sfx/blink.wav", "sfx/blink.wav"],
  // Young Serif and DM Mono (OFL), and Hanken Grotesk's latin variable font from Google Fonts.
  ["../assets/fonts/YoungSerif-Regular.ttf", "fonts/YoungSerif-Regular.ttf"],
  ["../assets/fonts/DMMono-Regular.ttf", "fonts/DMMono-Regular.ttf"],
  ["../assets/fonts/HankenGrotesk-latin.woff2", "fonts/HankenGrotesk-latin.woff2"],
];

for (const film of FILMS) {
  for (const [from, to] of FILES) {
    const dest = here(`${film}/assets/${to}`);
    mkdirSync(dest.slice(0, dest.lastIndexOf("/")), { recursive: true });
    copyFileSync(here(from), dest);
  }
  console.log(`synced ${film}/assets`);
}
