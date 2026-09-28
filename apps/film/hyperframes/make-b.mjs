/**
 * Writes film B's three version projects from shared/film-b-timings.json:
 *
 *   film-b1-token-morph/    the same screen's design tokens morph through five design systems
 *   film-b2-shared-morph/   shared-element morphs between different apps' screens
 *   film-b3-combined/       both
 *
 * Each gets an index.html (the timings inlined, so nothing is fetched at render time), its assets
 * (the renderer's browser build, the shared kit, fonts, the montage's documents), and its sound
 * effects, resolved through media-use (`npx hyperframes media-use resolve --type sfx`) so every
 * file has a manifest record with its source.
 *
 * Music: if a version's project has assets/music.wav or assets/music.mp3 (a score resolved through
 * media-use, see README.md), it is placed under everything, with its level dipped under the sting
 * and the outro hits. Without one, the film renders with its sound design only.
 *
 *   node apps/film/hyperframes/make-b.mjs [b1 b2 b3]
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { montage } from "./montage.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const TIMINGS = JSON.parse(readFileSync(here("shared/film-b-timings.json"), "utf8"));
const only = new Set(process.argv.slice(2));

const COPY = [
  ["../../../packages/web/preview/polyxd-web.js", "polyxd/polyxd-web.js"],
  ["../../../packages/web/preview/polyxd-web.css", "polyxd/polyxd-web.css"],
  ["shared/mark.js", "shared/mark.js"],
  ["shared/kit.js", "shared/kit.js"],
  ["shared/kit.css", "shared/kit.css"],
  ["shared/film-b.css", "shared/film-b.css"],
  ["shared/film-b.js", "shared/film-b.js"],
  ["shared/morph.js", "shared/morph.js"],
  ["shared/sting-b.html", "shared/sting-b.html"],
  ["shared/outro-b.html", "shared/outro-b.html"],
  ["../assets/fonts/YoungSerif-Regular.ttf", "fonts/YoungSerif-Regular.ttf"],
  ["../assets/fonts/DMMono-Regular.ttf", "fonts/DMMono-Regular.ttf"],
  ["../assets/fonts/HankenGrotesk-latin.woff2", "fonts/HankenGrotesk-latin.woff2"],
];

/** The effects, by media-use's bundled-library key (Pixabay Content License). */
const SFX_KEYS = ["whoosh-short", "whoosh-cinematic", "impact-bass-1", "impact-bass-2", "riser", "sparkle", "chime", "ping", "click", "click-soft", "typing", "pop"];
/** Where each file's loud moment is, in seconds from its start (measured), so cues land on the beat. */
const PEAK = { "whoosh-short": 0.15, "whoosh-cinematic": 2.9, "impact-bass-1": 0.1, "impact-bass-2": 1.85, riser: 3.0, sparkle: 0.1, chime: 0.4, ping: 0.35, click: 0.02, "click-soft": 0.02, typing: 0.45, pop: 0.02 };

function resolveSfx(dir) {
  const manifest = () => (existsSync(`${dir}/.media/manifest.jsonl`) ? readFileSync(`${dir}/.media/manifest.jsonl`, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  const have = () => Object.fromEntries(manifest().filter((r) => r.type === "sfx").map((r) => [r.provenance?.library_key ?? r.provenance?.prompt, r]));
  for (const key of SFX_KEYS) {
    if (have()[key]) continue;
    execFileSync("npx", ["hyperframes", "media-use", "resolve", "--type", "sfx", "--intent", key, "--project", "."], { cwd: dir, stdio: ["ignore", "ignore", "ignore"] });
  }
  return have();
}

function cues(T, v) {
  const at = (key, t, vol) => ({ key, start: Math.max(0, +(t - PEAK[key]).toFixed(3)), vol });
  const list = [
    // The sting: a short whoosh into the first hit, a low tonal hit, a chime as the wordmark settles.
    at("whoosh-short", 0.6, 0.5),
    at("impact-bass-1", 0.6, 0.26),
    at("chime", 3.9, 0.22),
    // Typing, sending, the answer arriving as a screen.
    at("typing", T.type + 0.45, 0.35),
    at("click-soft", T.send, 0.4),
    at("riser", T.reveal, 0.4),
    at("impact-bass-2", T.reveal, 0.45),
    at("sparkle", T.reveal + 0.05, 0.3),
    at("click", T.tap + 0.18, 0.45),
    at("pop", T.toast, 0.25),
    // The check, the montage, the outro.
    at("ping", T.checked + 0.35, 0.35),
    at("whoosh-cinematic", T.montage, 0.4),
    at("impact-bass-1", T.montage, 0.4),
    at("whoosh-short", T.montageEnd, 0.35),
    at("ping", T.outro + 1.25, 0.3),
    at("impact-bass-2", T.final, 0.5),
    at("chime", T.final + 0.05, 0.28),
  ];
  for (const s of v.steps) list.push(s.kind === "token" ? at("sparkle", s.at + 0.1, 0.22) : at("whoosh-short", s.at + 0.3, 0.35));
  for (let i = 1; i < T.shots; i++) list.push(at("click-soft", T.montage + i * T.shot, 0.28));
  return list.sort((a, b) => a.start - b.start);
}

const FONTS = `      @font-face { font-family: "Young Serif"; src: url("assets/fonts/YoungSerif-Regular.ttf") format("truetype"); font-weight: 400; font-style: normal; }
      @font-face { font-family: "Hanken Grotesk"; src: url("assets/fonts/HankenGrotesk-latin.woff2") format("woff2"); font-weight: 100 900; font-style: normal; }
      @font-face { font-family: "DM Mono"; src: url("assets/fonts/DMMono-Regular.ttf") format("truetype"); font-weight: 400; font-style: normal; }
      @font-face { font-family: "SFMono-Regular"; src: local("SFMono-Regular"), local("SF Mono"); }`;

function html(key, v, T, sfx, music) {
  const id = v.id;
  const film = { id, version: key, T, steps: v.steps };
  const audio = cues(T, v)
    .map((c, i) => `      <audio id="b-sfx-${i}" src="${sfx[c.key].path}" data-start="${c.start}" data-duration="${sfx[c.key].duration}" data-track-index="${12 + i}" data-volume="${c.vol}" data-audio-group="sfx"></audio>`)
    .join("\n");
  // The score, if there is one: a dip under the sting's hit and under the outro's final chord.
  const duck = (t0) => [
    { t: Math.max(0, t0 - 0.25), v: 1 },
    { t: t0, v: 0.7 },
    { t: t0 + 1.2, v: 1 },
  ];
  const musicEl = music
    ? `      <audio id="b-music" src="assets/${music}" data-start="0" data-duration="${T.end}" data-track-index="10" data-volume="1" data-audio-group="music" data-automation="${JSON.stringify({ version: 1, lanes: [{ target: "volume", points: [...duck(T.hit0), ...duck(T.reveal), ...duck(T.final)].sort((a, b) => a.t - b.t) }] }).replace(/"/g, "&quot;")}"></audio>\n`
    : "";
  const bus = (gid, label, vol) =>
    `      <hf-audio-group id="${gid}" data-label="${label}" data-volume="${vol}" data-fx-chain="${JSON.stringify({ version: 1, nodes: [{ type: "highpass", id: "n1", label: "Remove Rumble", params: { frequency: 30, q: 0.707, poles: "2" } }, { type: "limiter", id: "n2", label: "Ceiling", params: { limit: -2, attack: 5, release: 80, level_out: 0 } }] }).replace(/"/g, "&quot;")}"></hf-audio-group>`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Polyxd · ${v.label}</title>
    <!--
      Generated by apps/film/hyperframes/make-b.mjs from shared/film-b-timings.json. Edit those, not this.
      Film B, "Show, don't tell": a shop's assistant answers with a wall of words; asked again, the
      answer is a screen; then a bank and a council, each in its own design; then everything else.
    -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <link rel="stylesheet" href="assets/polyxd/polyxd-web.css" />
    <link rel="stylesheet" href="assets/shared/kit.css" />
    <link rel="stylesheet" href="assets/shared/film-b.css" />
    <style>
${FONTS}
    </style>
    <script src="assets/polyxd/polyxd-web.js"></script>
    <script src="assets/shared/mark.js"></script>
    <script src="assets/shared/kit.js"></script>
    <script src="assets/shared/morph.js"></script>
    <script src="assets/montage.js"></script>
    <script>
      window.FILM_B = ${JSON.stringify(film)};
    </script>
    <script src="assets/shared/film-b.js"></script>
  </head>
  <body>
    <div id="root" data-composition-id="${id}" data-start="0" data-width="1920" data-height="1080" data-duration="${T.end}">
      <div id="b-sting" data-composition-id="sting-b" data-composition-src="assets/shared/sting-b.html" data-start="0" data-duration="${T.stingDur}" data-track-index="1"></div>

      <div id="b-g1" class="group">
        <div class="phone"><div class="phone-glass"><div class="phone-screen" id="b-screen1"></div></div></div>
        <div class="seat" id="b-seat1"></div>
      </div>
      <div id="b-line1" class="paperline"><p><span class="l">AI can answer anything.</span> <span class="l">But it answers in paragraphs.</span></p></div>
      <div id="b-g2" class="group">
        <div class="phone"><div class="phone-glass"><div class="phone-screen" id="b-screen2"></div></div></div>
        <div class="seat" id="b-seat2"></div>
      </div>
      <div id="b-cap1" class="caption"><p>Polyxd turns the answer into a screen.</p></div>
      <div id="b-cap2" class="caption"><p>Any app. In its own design.</p></div>
      <div id="b-cap3" class="caption"><p>Checked before anyone sees it.</p></div>

      <div id="b-mont" class="group">
        <div class="phone" id="b-mphone"><div class="phone-glass"><div class="phone-screen"></div></div></div>
        <div class="desk" id="b-mdesk"><div class="desk-bar"><i></i><i></i><i></i></div><div class="desk-view"></div></div>
      </div>
      <div id="b-capM" class="caption"><p>Any screen. Any design system.</p></div>

      <div id="b-outro" data-composition-id="outro-b" data-composition-src="assets/shared/outro-b.html" data-start="${T.outro}" data-duration="${+(T.end - T.outro).toFixed(3)}" data-track-index="1" data-variable-values='{"url":"polyxd.com"}'></div>

${bus("music", "Music", 1)}
${bus("sfx", "Sound design", music ? 0.7 : 0.8)}
${musicEl}${audio}
    </div>
    <script>
      document.fonts.ready.then(() => {
        const tl = window.buildFilmB();
        window.__timelines["${id}"] = tl;
        if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
      });
    </script>
  </body>
</html>
`;
}

for (const [key, v] of Object.entries(TIMINGS.versions)) {
  if (only.size && !only.has(key)) continue;
  const T = { ...TIMINGS.common, ...v };
  delete T.steps;
  delete T.id;
  delete T.label;
  const dir = here(v.id);
  mkdirSync(`${dir}/assets`, { recursive: true });
  for (const [from, to] of COPY) {
    const dest = `${dir}/assets/${to}`;
    mkdirSync(dest.slice(0, dest.lastIndexOf("/")), { recursive: true });
    copyFileSync(here(from), dest);
  }
  writeFileSync(`${dir}/assets/montage.js`, montage(T.shots));
  for (const f of ["hyperframes.json", "BRIEF.md"]) if (!existsSync(`${dir}/${f}`)) copyFileSync(here(`film-b-show-dont-tell/${f}`), `${dir}/${f}`);
  writeFileSync(`${dir}/package.json`, readFileSync(here("film-b-show-dont-tell/package.json"), "utf8").replace(/"name": "[^"]*"/, `"name": "${v.id}"`));
  writeFileSync(`${dir}/meta.json`, JSON.stringify({ id: v.id, name: v.id, createdAt: "2026-09-28T12:00:00.000Z" }, null, 2) + "\n");
  const sfx = resolveSfx(dir);
  const music = ["music.wav", "music.mp3"].find((m) => existsSync(`${dir}/assets/${m}`));
  writeFileSync(`${dir}/index.html`, html(key, v, T, sfx, music));
  console.log(`wrote ${v.id}/index.html (${T.end} s${music ? `, music: ${music}` : ", no score yet"})`);
}
