/*
 * The Polyxd mark, animated through its pupil only (brand/BRAND-2026.md).
 *
 * The p (bowl, stem) and the white window use the paths of brand/chosen-mark.svg exactly. The pupil
 * is drawn as a rounded rect so every state is one shape: at rest it is the artwork's circle
 * (centre 16,16, r 2.4 = a 4.8 square with rx 2.4); a blink squashes it to the 5.2 × 1.6 bar.
 *
 * Nothing here reads a clock. `PolyxdMark.driver(svg, events)` returns a function of time that
 * places the pupil; a composition calls it from one timeline tween, so any frame can be seeked.
 *
 *   events: [{ t, state }]  state ∈ idle | reading | looking | attention | thinking | blink |
 *                                    checked | asleep
 *           thinking takes `turns` (default 2): one turn per 1.6 s around the centre at r 1.1.
 */
(function () {
  const BOWL = "M13 6H19C22.864 6 26 9.136 26 13V19C26 22.864 22.864 26 19 26H13C9.136 26 6 22.864 6 19V13C6 9.136 9.136 6 13 6Z";
  const STEM = "M8.5 14H8.5C9.88 14 11 15.12 11 16.5V25.5C11 26.88 9.88 28 8.5 28H8.5C7.12 28 6 26.88 6 25.5V16.5C6 15.12 7.12 14 8.5 14Z";
  const WINDOW = "M16 11.2H16C20.224 11.2 20.8 11.776 20.8 16V16C20.8 20.224 20.224 20.8 16 20.8H16C11.776 20.8 11.2 20.224 11.2 16V16C11.2 11.776 11.776 11.2 16 11.2Z";
  const TICK = "M13.9 16.3 l1.5 1.5 2.8 -3.1";
  const INK = "#141413";
  const SIGNAL = "#FF6E40";

  /** cubic-bezier(0.2, 0, 0, 1): the packs' easing. */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        const d = dx(t);
        if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      let lo = 0, hi = 1;
      for (let i = 0; i < 20 && Math.abs(sx(t) - x) > 1e-6; i++) {
        if (sx(t) < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  }
  const ease = bezier(0.2, 0, 0, 1);

  /** Pupil geometry for each resting state: centre, width, height, corner, opacity. */
  const REST = {
    idle: { x: 16, y: 16, w: 4.8, h: 4.8, r: 2.4, o: 1, k: 0 },
    reading: { x: 17.3, y: 14.9, w: 4.8, h: 4.8, r: 2.4, o: 1, k: 0 },
    looking: { x: 14.7, y: 17.1, w: 4.8, h: 4.8, r: 2.4, o: 1, k: 0 },
    attention: { x: 16, y: 16, w: 6, h: 6, r: 3, o: 1, k: 0 },
    asleep: { x: 16, y: 17.4, w: 5.2, h: 1.6, r: 0.8, o: 0.4, k: 0 },
    // Checked: the pupil has gone and the tick is drawn (k = how much of it).
    checked: { x: 16, y: 16, w: 0, h: 0, r: 0, o: 1, k: 1 },
  };
  const MOVE = 0.34; // seconds between states (brand: 200-400 ms)
  const BLINK = 0.28;
  const TURN = 1.6;
  const ORBIT = 1.1;

  const mix = (a, b, p) => ({
    x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p,
    r: a.r + (b.r - a.r) * p, o: a.o + (b.o - a.o) * p, k: a.k + (b.k - a.k) * p,
  });
  const orbitAt = (a) => ({ ...REST.idle, x: 16 + ORBIT * Math.sin(a), y: 16 - ORBIT * Math.cos(a) });

  /** Where the pupil is at time t, given the events (sorted by t). Pure: same t, same answer. */
  function geometryAt(events, t) {
    let cur = { ...REST.idle };
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (t < e.t) break;
      const dt = t - e.t;
      if (e.state === "blink") {
        const bar = { ...cur, w: 5.2, h: 1.6, r: 0.8 };
        if (dt < BLINK) {
          const p = dt < BLINK / 2 ? ease(dt / (BLINK / 2)) : 1 - ease((dt - BLINK / 2) / (BLINK / 2));
          return mix(cur, bar, p);
        }
        continue; // back where it was
      }
      if (e.state === "thinking") {
        const turns = e.turns ?? 2;
        const start = orbitAt(0);
        if (dt < MOVE) return mix(cur, start, ease(dt / MOVE));
        const spin = dt - MOVE;
        if (spin < turns * TURN) return orbitAt((2 * Math.PI * spin) / TURN);
        cur = start;
        continue;
      }
      const target = REST[e.state] || REST.idle;
      if (e.state === "checked") {
        // The pupil shrinks away, then the tick draws in its place.
        const shrink = 0.22, draw = 0.42;
        if (dt < shrink + draw) {
          const a = mix(cur, { ...cur, w: 0, h: 0, r: 0 }, ease(Math.min(1, dt / shrink)));
          a.k = dt < shrink * 0.6 ? 0 : ease(Math.min(1, (dt - shrink * 0.6) / draw));
          return a;
        }
        cur = { ...target };
        continue;
      }
      if (dt < MOVE) return mix(cur, target, ease(dt / MOVE));
      cur = { ...target };
    }
    return cur;
  }

  /** The mark as an SVG string; `id` prefixes the pupil and tick so several marks can share a page. */
  function svg(id, size) {
    return (
      `<svg id="${id}" class="pxd-mark" width="${size}" height="${size}" viewBox="0 0 32 32" aria-label="Polyxd" role="img" style="display:block;overflow:visible">` +
      `<path class="pxd-bowl" d="${BOWL}" fill="${SIGNAL}"/>` +
      `<path class="pxd-stem" d="${STEM}" fill="${SIGNAL}"/>` +
      `<path class="pxd-window" d="${WINDOW}" fill="#FFFFFF"/>` +
      `<g class="pxd-pupil-g"><rect class="pxd-pupil" x="13.6" y="13.6" width="4.8" height="4.8" rx="2.4" ry="2.4" fill="${INK}"/></g>` +
      `<path class="pxd-tick" d="${TICK}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>` +
      `</svg>`
    );
  }

  /** Mark and wordmark: gap 5/32 of the mark, wordmark at 0.8 × the mark, Young Serif, ink. */
  function lockup(id, size) {
    return (
      `<div class="pxd-lockup" style="display:flex;align-items:center;gap:${(size * 5) / 32}px">` +
      svg(id, size) +
      `<span class="pxd-wordmark" style="font-family:'Young Serif',serif;font-weight:400;font-size:${size * 0.8}px;line-height:1;letter-spacing:-0.015em;color:${INK};transform:translateY(${-size * 0.04}px)">polyxd</span>` +
      `</div>`
    );
  }

  /** Returns set(t): places the pupil of `svgEl` for time t. */
  function driver(svgEl, events) {
    const pupil = svgEl.querySelector(".pxd-pupil");
    const tick = svgEl.querySelector(".pxd-tick");
    const sorted = events.slice().sort((a, b) => a.t - b.t);
    return function set(t) {
      const g = geometryAt(sorted, t);
      pupil.setAttribute("x", (g.x - g.w / 2).toFixed(3));
      pupil.setAttribute("y", (g.y - g.h / 2).toFixed(3));
      pupil.setAttribute("width", Math.max(0, g.w).toFixed(3));
      pupil.setAttribute("height", Math.max(0, g.h).toFixed(3));
      pupil.setAttribute("rx", Math.max(0, g.r).toFixed(3));
      pupil.setAttribute("ry", Math.max(0, g.r).toFixed(3));
      pupil.setAttribute("opacity", g.w < 0.05 ? "0" : g.o.toFixed(3));
      tick.setAttribute("opacity", g.k > 0 ? "1" : "0");
      tick.setAttribute("stroke-dashoffset", (1 - g.k).toFixed(3));
    };
  }

  window.PolyxdMark = { svg, lockup, driver, ease, bezier, geometryAt, REST };
})();
