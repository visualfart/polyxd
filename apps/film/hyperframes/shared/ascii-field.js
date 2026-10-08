/*
 * The ASCII field behind film D2's sting and outro (shared/sting-ascii.html, shared/outro-ascii.html).
 *
 * A grid of DM Mono glyphs over the dark ground. A slow value-noise flow drives a sparse field of
 * muted glyphs (a few in signal orange); the glyphs converge on the Polyxd lockup, whose mark and
 * wordmark are drawn as glyph density (" .:-=+*#%@"): the p in orange, the window in off-white, the
 * pupil an empty hole that blinks; then the field dissolves back to the dot grid.
 *
 * Seek-safe in the ascii-render-pass manner (registry): the lockup's coverage grid is rasterised once
 * at create; every frame is a pure function of (that grid, t, the params passed in). Noise and jitter
 * come from a stateless integer hash of (column, row, seed); no Math.random, no clock, no state.
 *
 *   const field = AsciiField.create(canvas, { y: 500 });
 *   field.draw(t, { bg, field, mark, word, quiet, dissolve, pupil })
 *     bg        0..1  the ground's opacity (0 lets what is underneath show through)
 *     field     0..1  the noise field's strength
 *     mark/word 0..1  global progress of the mark's / wordmark's convergence (cells stagger inside it)
 *     quiet     0..1  how far the field has settled away once the lockup holds
 *     dissolve  0..1  glyphs thin to dots and fade (the end of the sting)
 *     pupil     { x, y, w, h } in the mark's 32-unit box (PolyxdMark.geometryAt), for the blink
 */
(function () {
  const RAMP = " .:-=+*#%@";
  const CW = 11, CH = 18; // DM Mono 18 px: advance 10.8, line 18
  const SIGNAL = "#ff6e40", FG = "#f3f1ec", MUT = "#a8a298";

  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  const smooth = (p) => p * p * (3 - 2 * p);
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const sstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));

  function create(canvas, opts) {
    opts = opts || {};
    // The frame (1920×1080 unless given) and the lockup's centre line (the frame's centre unless given).
    const W = opts.w || 1920, H = opts.h || 1080;
    const COLS = Math.ceil(W / CW), ROWS = Math.ceil(H / CH);
    const CX = opts.cx || W / 2;
    const ctx = canvas.getContext("2d");
    const E = (window.PolyxdMark && window.PolyxdMark.ease) || smooth;
    // The lockup, as sting-b lays it out: mark S, gap 5/32 S, wordmark 0.8 S in Young Serif.
    const S = opts.size || 324;
    const cy = opts.y || 520;
    const m = document.createElement("canvas").getContext("2d");
    m.font = `400 ${S * 0.8}px "Young Serif"`;
    const wordW = m.measureText("polyxd").width * 0.985;
    const total = S + (S * 5) / 32 + wordW;
    const mx = CX - total / 2, my = cy - S / 2;
    const wx = mx + S + (S * 5) / 32;
    // Coverage layers: R the orange p, G the window, B the wordmark.
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const o = off.getContext("2d");
    o.fillStyle = "#000";
    o.fillRect(0, 0, W, H);
    const svg = new DOMParser().parseFromString(window.PolyxdMark.svg("x", 32), "image/svg+xml");
    const d = (c) => svg.querySelector(c).getAttribute("d");
    o.save();
    o.translate(mx, my);
    o.scale(S / 32, S / 32);
    o.globalCompositeOperation = "lighter";
    o.fillStyle = "#ff0000";
    o.fill(new Path2D(d(".pxd-bowl")));
    o.fill(new Path2D(d(".pxd-stem")));
    o.globalCompositeOperation = "source-over";
    o.fillStyle = "#00ff00";
    o.fill(new Path2D(d(".pxd-window")));
    o.restore();
    o.fillStyle = "#0000ff";
    o.font = `400 ${S * 0.8}px "Young Serif"`;
    o.textBaseline = "alphabetic";
    // The wordmark sits on the mark's visual baseline (sting-b: marginTop −0.46 S from centre).
    o.fillText("polyxd", wx, my + S * 0.5 - S * 0.46 + S * 0.8 * 0.78);
    const img = o.getImageData(0, 0, W, H).data;
    const cells = []; // lockup cells only
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let R = 0, G = 0, B = 0, n = 0;
        for (let y = r * CH; y < Math.min(H, (r + 1) * CH); y += 2) {
          for (let x = c * CW; x < Math.min(W, (c + 1) * CW); x += 2) {
            const i = (y * W + x) * 4;
            R += img[i];
            G += img[i + 1];
            B += img[i + 2];
            n++;
          }
        }
        R /= n * 255;
        G /= n * 255;
        B /= n * 255;
        if (R + G + B < 0.06) continue;
        const x = c * CW, y = r * CH;
        const inMark = x < wx - 10;
        // Stagger: inward from the edges of the frame, with a little hash jitter.
        const dist = Math.hypot(x + CW / 2 - (inMark ? mx + S / 2 : wx + wordW / 2), y + CH / 2 - cy);
        const ang = hash(c, r, 5) * Math.PI * 2;
        const fly = 260 + hash(c, r, 6) * 520;
        cells.push({ c, r, x, y, R, G, B, inMark, delay: clamp(dist / 900) * 0.45 + hash(c, r, 7) * 0.25, ox: Math.cos(ang) * fly, oy: Math.sin(ang) * fly * 0.6 });
      }
    }
    const lock = new Set(cells.map((k) => k.r * COLS + k.c));
    /** How much of cell k the pupil rect covers (32-unit box → pixels). */
    const pupilCover = (k, p) => {
      if (!p || p.w <= 0.05) return 0;
      const u = S / 32;
      const px0 = mx + (p.x - p.w / 2) * u, px1 = mx + (p.x + p.w / 2) * u;
      const py0 = my + (p.y - p.h / 2) * u, py1 = my + (p.y + p.h / 2) * u;
      const ix = Math.max(0, Math.min(k.x + CW, px1) - Math.max(k.x, px0));
      const iy = Math.max(0, Math.min(k.y + CH, py1) - Math.max(k.y, py0));
      return (ix * iy) / (CW * CH);
    };
    const glyph = (v) => RAMP[Math.max(0, Math.min(9, Math.floor(v * 10)))];

    function draw(t, P) {
      ctx.clearRect(0, 0, W, H);
      if (P.bg > 0) {
        ctx.globalAlpha = P.bg;
        ctx.fillStyle = "#0b0b0a";
        ctx.fillRect(0, 0, W, H);
      }
      ctx.font = `18px "DM Mono"`;
      ctx.textBaseline = "top";
      const dz = P.dissolve || 0;
      // The field: sparse muted glyphs where the noise crests; a few in orange.
      const fs = (P.field || 0) * (1 - (P.quiet || 0) * 0.85) * (1 - dz);
      if (fs > 0.01) {
        const muted = [], hot = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const f = 0.62 * vnoise(c * 0.07 + t * 0.55, r * 0.11 + t * 0.16, 1) + 0.38 * vnoise(c * 0.16 - t * 0.4, r * 0.21 + t * 0.1, 2);
            let v = sstep(0.56, 0.97, f) * 0.6;
            if (v < 0.1) continue;
            if (lock.has(r * COLS + c)) v *= 1 - clamp(Math.max(P.mark || 0, P.word || 0) * 1.5);
            if (v < 0.1) continue;
            (hash(c, r, 9) < 0.045 ? hot : muted).push([c * CW, r * CH, glyph(v), v]);
          }
        }
        ctx.fillStyle = MUT;
        for (const [x, y, g, v] of muted) {
          ctx.globalAlpha = fs * (0.2 + 0.45 * v);
          ctx.fillText(g, x, y);
        }
        ctx.fillStyle = SIGNAL;
        for (const [x, y, g] of hot) {
          ctx.globalAlpha = fs * 0.75;
          ctx.fillText(g, x, y);
        }
      }
      // The lockup: each cell flies in from its scatter and settles into its density glyph.
      const groups = { [SIGNAL]: [], [FG]: [] };
      for (const k of cells) {
        const g0 = k.inMark ? P.mark || 0 : P.word || 0;
        if (g0 <= 0) continue;
        const p = E(clamp((g0 * 1.7 - k.delay) / 1.0));
        if (p <= 0) continue;
        let v, col;
        if (k.inMark) {
          const win = Math.max(0, k.G - pupilCover(k, P.pupil));
          if (k.R >= win) {
            v = 0.3 + 0.7 * k.R;
            col = SIGNAL;
          } else {
            v = win;
            col = FG;
          }
        } else {
          v = k.B;
          col = FG;
        }
        if (dz > 0) v = Math.min(v, lerpN(v, 0.12, dz));
        if (v < 0.1) continue;
        const x = k.x + k.ox * (1 - p), y = k.y + k.oy * (1 - p);
        groups[col].push([x, y, glyph(v), Math.min(1, p * 1.4) * (1 - dz)]);
      }
      for (const col of [SIGNAL, FG]) {
        ctx.fillStyle = col;
        for (const [x, y, g, a] of groups[col]) {
          ctx.globalAlpha = a;
          ctx.fillText(g, x, y);
        }
      }
      ctx.globalAlpha = 1;
    }
    const lerpN = (a, b, p) => a + (b - a) * p;
    return { draw, geometry: { mx, my, S, wx, wordW, cy, CW, CH } };
  }

  window.AsciiField = { create, RAMP };
})();
