/*
 * Morphs between design systems, for film B.
 *
 * Two mechanisms, both pure functions of progress p (0..1), so any frame can be seeked:
 *
 *   tokens   One live screen, drawn by the real renderer, whose design tokens (the --pxd-* custom
 *            properties every pack defines: colours, radii, spacing, type sizes and weights,
 *            border widths) are interpolated from one pack's values to another's. The renderer
 *            lays the screen out again every frame, so padding, radii and type grow and shrink for
 *            real. What cannot be interpolated (a font family, a pack's own component rules) switches
 *            at the midpoint.
 *
 *   shared   Two different screens (different apps, different documents, different packs). Parts
 *            that exist in both are paired: their boxes (surface, app bar, bubble, button, icon) are
 *            drawn by a morph layer that travels and reshapes from one box to the other while its
 *            colour, corner radius and border interpolate; their contents travel along the same path
 *            (FLIP: translate + scale from one rect to the other) and cross-fade. Parts that exist in
 *            only one screen fade out early or in late.
 */
(function () {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const smooth = (a, b, x) => {
    const u = clamp((x - a) / (b - a));
    return u * u * (3 - 2 * u);
  };

  // ——— Values: colours and lengths, parsed once ———

  const ctx = document.createElement("canvas").getContext("2d");
  /** Any CSS colour → [r, g, b, a], or null. */
  function color(str) {
    if (!str) return null;
    const s = String(str).trim();
    if (s === "transparent") return [0, 0, 0, 0];
    let m = s.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4]];
    ctx.fillStyle = "#000";
    ctx.fillStyle = s;
    const out = ctx.fillStyle;
    if (out === "#000000" && !/^#0{3,8}$|black|^rgb\(0[ ,]+0[ ,]+0/.test(s)) return null;
    if (out.startsWith("#")) return [parseInt(out.slice(1, 3), 16), parseInt(out.slice(3, 5), 16), parseInt(out.slice(5, 7), 16), 1];
    m = out.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  }
  const rgba = (c) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${Math.round(c[3] * 1000) / 1000})`;
  /** Premultiplied: a transparent end takes the other end's colour, so nothing passes through grey. */
  const mixColor = (a, b, p) => {
    const al = lerp(a[3], b[3], p);
    if (al <= 0.0001) return [b[0], b[1], b[2], 0];
    const ch = (i) => (a[i] * a[3] * (1 - p) + b[i] * b[3] * p) / al;
    return [ch(0), ch(1), ch(2), al];
  };

  // A token value, split into literal text and interpolable pieces (colours, numbers with units).
  const PIECE = /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|-?\d*\.?\d+(?:px|rem|em|ms|s|%|deg)?)/g;
  function pieces(value) {
    const parts = [];
    const lit = [];
    let last = 0;
    String(value).replace(PIECE, (m, _g, off) => {
      lit.push(value.slice(last, off));
      last = off + m.length;
      if (/^(#|rgb|hsl)/.test(m)) {
        const c = color(m);
        parts.push(c ? { c } : { raw: m });
      } else {
        const n = parseFloat(m);
        let unit = m.replace(/^-?\d*\.?\d+/, "");
        let v = n;
        if (unit === "rem") (v = n * 16), (unit = "px");
        parts.push({ n: v, unit });
      }
      return m;
    });
    lit.push(String(value).slice(last));
    return { lit, parts };
  }
  /** Returns p → value between two token values, or null when they cannot be interpolated. */
  function interpolator(a, b) {
    if (a === b) return () => a;
    const A = pieces(a), B = pieces(b);
    if (A.parts.length === 0 || A.parts.length !== B.parts.length || A.lit.join("\u0000") !== B.lit.join("\u0000")) return null;
    for (let i = 0; i < A.parts.length; i++) {
      const x = A.parts[i], y = B.parts[i];
      if (x.raw || y.raw) return null;
      if (!!x.c !== !!y.c) return null;
      if (!x.c && x.unit !== y.unit && x.n !== 0 && y.n !== 0) return null;
    }
    return (p) => {
      let s = A.lit[0];
      for (let i = 0; i < A.parts.length; i++) {
        const x = A.parts[i], y = B.parts[i];
        if (x.c) s += rgba(mixColor(x.c, y.c, p));
        else {
          const unit = x.n === 0 ? y.unit : x.unit;
          const v = lerp(x.n, y.n, p);
          s += (unit === "" ? Math.round(v * 1000) / 1000 : v.toFixed(3)) + unit;
        }
        s += A.lit[i + 1];
      }
      return s;
    };
  }

  // ——— The packs' tokens, read from the live stylesheet ———

  let NAMES = null;
  function tokenNames() {
    if (NAMES) return NAMES;
    const set = new Set();
    const walk = (rules) => {
      for (const r of Array.from(rules || [])) {
        if (r.cssRules && !r.selectorText) walk(r.cssRules);
        if (!r.style || !r.selectorText || !r.selectorText.includes("data-pxd-theme")) continue;
        for (let i = 0; i < r.style.length; i++) {
          const n = r.style[i];
          if (n.startsWith("--pxd-") || n.startsWith("--polyxd-")) set.add(n);
        }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch (e) {
        /* a sheet we cannot read has no tokens for us */
      }
    }
    NAMES = Array.from(set).sort();
    return NAMES;
  }
  const THEMES = {};
  function themeTokens(theme) {
    if (THEMES[theme]) return THEMES[theme];
    const probe = document.createElement("div");
    probe.setAttribute("data-pxd-theme", theme);
    probe.setAttribute("data-pxd-mode", "light");
    probe.style.cssText = "position:absolute;left:-9999px;top:0;width:10px;height:10px;";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const out = {};
    for (const n of tokenNames()) out[n] = cs.getPropertyValue(n).trim();
    probe.remove();
    THEMES[theme] = out;
    return out;
  }

  /**
   * A token morph on one app screen. Returns set(state) where state is
   *   { theme }                    rest in a pack (no inline tokens)
   *   { from, to, p }              between two packs
   * Every element of the screen that carries data-pxd-theme (the app and each mounted surface)
   * gets the same inline tokens, because each one re-declares its pack's tokens for its subtree.
   */
  function tokenMorph(appEl) {
    const scoped = [appEl, ...appEl.querySelectorAll("[data-pxd-theme]")];
    const cache = {};
    let applied = "";
    return function set(state) {
      const key = state.theme ? `rest:${state.theme}` : `${state.from}>${state.to}:${state.p.toFixed(4)}`;
      if (key === applied) return;
      applied = key;
      if (state.theme) {
        for (const el of scoped) {
          el.setAttribute("data-pxd-theme", state.theme);
          for (const n of tokenNames()) el.style.removeProperty(n);
        }
        return;
      }
      const pair = `${state.from}>${state.to}`;
      if (!cache[pair]) {
        const A = themeTokens(state.from), B = themeTokens(state.to);
        cache[pair] = tokenNames().map((n) => {
          const f = interpolator(A[n], B[n]);
          return [n, f, A[n], B[n]];
        });
      }
      const p = state.p;
      const theme = p < 0.5 ? state.from : state.to;
      for (const el of scoped) {
        el.setAttribute("data-pxd-theme", theme);
        for (const [n, f, a, b] of cache[pair]) {
          const v = f ? f(p) : p < 0.5 ? a : b;
          if (v) el.style.setProperty(n, v);
          else el.style.removeProperty(n);
        }
      }
    };
  }

  // ——— Shared-element morph ———

  /** A rect relative to the screen, in the screen's own (unscaled) pixels. */
  function rectIn(el, screen) {
    const s = screen.getBoundingClientRect();
    const k = s.width / screen.offsetWidth || 1;
    const r = el.getBoundingClientRect();
    return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
  }
  function boxStyle(el) {
    const cs = getComputedStyle(el);
    const side = (s) => parseFloat(cs[`border${s}Width`]) || 0;
    const widths = ["Top", "Right", "Bottom", "Left"].map(side);
    const bcSide = ["Top", "Right", "Bottom", "Left"].find((s, i) => widths[i] > 0);
    return {
      bg: color(cs.backgroundColor) || [0, 0, 0, 0],
      radius: parseFloat(cs.borderTopLeftRadius) || 0,
      widths,
      bc: bcSide ? color(cs[`border${bcSide}Color`]) || [0, 0, 0, 0] : [0, 0, 0, 0],
      shadow: cs.boxShadow,
    };
  }

  /**
   * Measures and prepares a shared-element morph from screen A to screen B (both .app elements
   * inside the same phone screen). `pairs` are [a, b, kind] with kind:
   *   "box"      the morph layer draws the box; the element itself does not move
   *   "flip"     the element travels to its partner and cross-fades (text is scaled by font size)
   *   "boxflip"  both: the layer draws the box, the element's contents travel
   * `onlyA` / `onlyB` are the leftovers. Measure while both screens are laid out at rest.
   */
  function shared(screen, layerEl, A, B, pairs, onlyA, onlyB) {
    const boxes = [];
    const flips = [];
    for (const [a, b, kind] of pairs) {
      if (!a || !b) continue;
      const ra = rectIn(a, screen), rb = rectIn(b, screen);
      if (kind === "box" || kind === "boxflip") {
        const d = document.createElement("div");
        d.className = "morph-box";
        layerEl.appendChild(d);
        boxes.push({ d, ra, rb, sa: boxStyle(a), sb: boxStyle(b), els: [a, b] });
        a.classList.add("m-box");
        b.classList.add("m-box");
      }
      if (kind === "flip" || kind === "boxflip" || kind === "text") {
        const fa = parseFloat(getComputedStyle(a).fontSize) || 16;
        const fb = parseFloat(getComputedStyle(b).fontSize) || 16;
        const k = kind === "text" ? fb / fa : 1;
        flips.push({ a, b, ra, rb, k, center: kind !== "text" });
      }
    }
    return {
      /** Writes the frame for progress p into the style map S (el → {o, tf}); draws the boxes. */
      apply(p, S) {
        layerEl.style.display = "block";
        A.classList.add("morphing");
        B.classList.add("morphing");
        for (const bx of boxes) {
          const x = lerp(bx.ra.x, bx.rb.x, p), y = lerp(bx.ra.y, bx.rb.y, p);
          const w = lerp(bx.ra.w, bx.rb.w, p), h = lerp(bx.ra.h, bx.rb.h, p);
          const r = Math.min(lerp(Math.min(bx.sa.radius, bx.ra.h / 2, bx.ra.w / 2), Math.min(bx.sb.radius, bx.rb.h / 2, bx.rb.w / 2), p), h / 2, w / 2);
          const st = bx.d.style;
          st.left = `${x}px`;
          st.top = `${y}px`;
          st.width = `${w}px`;
          st.height = `${h}px`;
          st.borderRadius = `${r}px`;
          st.background = rgba(mixColor(bx.sa.bg, bx.sb.bg, p));
          st.borderWidth = bx.sa.widths.map((v, i) => `${lerp(v, bx.sb.widths[i], p)}px`).join(" ");
          st.borderColor = rgba(mixColor(bx.sa.bc, bx.sb.bc, p));
          st.boxShadow = p < 0.5 ? bx.sa.shadow : bx.sb.shadow;
        }
        const oa = 1 - smooth(0.18, 0.5, p), ob = smooth(0.5, 0.82, p);
        for (const f of flips) {
          // Map A's rect onto B's (and B's back onto A's): centres for boxes, top-left for text.
          const ax = f.center ? f.ra.x + f.ra.w / 2 : f.ra.x, ay = f.center ? f.ra.y + f.ra.h / 2 : f.ra.y;
          const bx = f.center ? f.rb.x + f.rb.w / 2 : f.rb.x, by = f.center ? f.rb.y + f.rb.h / 2 : f.rb.y;
          const ka = lerp(1, f.k, p), kb = lerp(1 / f.k, 1, p);
          const origin = f.center ? "50% 50%" : "0 0";
          S.set(f.a, { o: oa, tf: `translate(${((bx - ax) * p).toFixed(2)}px, ${((by - ay) * p).toFixed(2)}px) scale(${ka.toFixed(4)})`, origin });
          S.set(f.b, { o: ob, tf: `translate(${((ax - bx) * (1 - p)).toFixed(2)}px, ${((ay - by) * (1 - p)).toFixed(2)}px) scale(${kb.toFixed(4)})`, origin });
        }
        for (const el of onlyA) if (el) S.set(el, { o: 1 - smooth(0, 0.42, p), tf: "" });
        for (const el of onlyB) if (el) S.set(el, { o: smooth(0.58, 1, p), tf: "" });
      },
      /** Outside the morph: no layer, no suppressed boxes. */
      rest() {
        layerEl.style.display = "none";
        A.classList.remove("morphing");
        B.classList.remove("morphing");
      },
      flips,
      boxes,
    };
  }

  window.PolyxdMorph = { tokenMorph, shared, themeTokens, tokenNames, interpolator, color, rectIn, smooth, clamp, lerp };
})();
