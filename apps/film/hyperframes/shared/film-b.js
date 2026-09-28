/*
 * Film B, "Show, don't tell", in three versions that differ in how one design system becomes
 * another (window.FILM_B.version: b1 | b2 | b3; the steps come from film-b-timings.json).
 *
 * One writer per property: GSAP tweens the groups, captions, toast and the button's press; the
 * `render(t)` function below owns everything else (typing, the reply streaming in, the screen's
 * parts arriving, which layer shows, the morphs, the montage, the marks' pupils) and is a pure
 * function of time. It runs after GSAP on every frame, through the timeline's onUpdate.
 */
(function () {
  const F = window.Film;
  const M = window.PolyxdMark;
  const X = window.PolyxdMorph;
  const E = M.ease;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const seg = (t, a, d) => clamp((t - a) / d);
  const $ = (id) => document.getElementById(id);

  const ASK = "Can I return these shoes?";
  const PARAGRAPH =
    "Yes, you can return them within 30 days of delivery. To start a return, open the menu and go to Your orders. Find the order with the trail runners and tap View order. Scroll down to Items and tap the pair you want to send back, then choose Return or exchange. Pick a reason from the list. If you’d like a different size, choose Exchange and select your new size, then check it’s in stock. Next, choose how you’d like to send them back: drop-off point, locker or courier collection. If you choose drop-off, you’ll need to print the label we email you, or show the QR code at the counter. Once we receive them, your refund or exchange is processed within 3 to 5 working days, and you’ll get an email when";

  function build() {
    const V = window.FILM_B;
    const T = V.T;
    // ——— The first phone: a question, answered in a paragraph ———
    const s1 = F.appScreen({ app: F.APPS.fernly, asked: ASK, reply: PARAGRAPH, composer: true, toBottom: true, home: true });
    $("b-screen1").appendChild(s1.el);

    // ——— The second phone: three apps' screens, stacked; the morphs move between them ———
    const scr = $("b-screen2");
    const morphLayers = document.createElement("div");
    morphLayers.style.cssText = "position:absolute;inset:0;";
    scr.appendChild(morphLayers);
    const mk = (name, o) => {
      const h = F.appScreen(Object.assign({ dock: true, home: true, crossfades: true }, o));
      const d = document.createElement("div");
      d.className = "layer";
      d.appendChild(h.el);
      scr.appendChild(d);
      h.layer = d;
      h.name = name;
      h.base = o.app;
      h.nameEl = h.el.querySelector(".app-name");
      h.iconEl = h.el.querySelector(".app-icon");
      h.tokens = X.tokenMorph(h.el);
      return h;
    };
    const L = {
      return: mk("return", { app: F.APPS.fernly, asked: ASK, doc: F.RETURN, toast: "Return started. Your label is in your email." }),
      send: mk("send", { app: F.APPS.halden, asked: "Send Priya £40 for dinner", doc: F.SEND, data: F.SEND_DATA }),
      address: mk("address", { app: F.APPS.wexley, asked: "I’ve moved", doc: F.ADDRESS }),
    };
    const steps = V.steps.map((s) => Object.assign({}, s));

    /** A layer's pack at time t: at rest, or between two packs. */
    function themeState(h, t) {
      let theme = h.base.theme;
      for (const s of steps) {
        if (s.kind !== "token" || s.layer !== h.name) continue;
        if (t < s.at) break;
        if (t < s.at + s.dur) return { from: theme, to: s.to, p: E(seg(t, s.at, s.dur)) };
        theme = s.to;
      }
      return { theme };
    }
    /** The app a layer is dressed as at time t (token steps rename it at their midpoint). */
    function appAt(h, t) {
      let app = h.base;
      for (const s of steps) if (s.kind === "token" && s.layer === h.name && t >= s.at + s.dur / 2) app = F.APPS[s.app];
      return app;
    }

    // Shared-element morphs are measured now, with the outgoing screen dressed as it will be then.
    const partsOf = (h) => h.parts || [];
    const fieldsOf = (h) => partsOf(h).slice(1, -1);
    for (const s of steps) {
      if (s.kind !== "shared") continue;
      const A = L[s.from], B = L[s.to];
      const st = themeState(A, s.at);
      A.tokens(st.theme ? st : { theme: st.to });
      const q = (h, sel) => h.el.querySelector(sel);
      const title = (h) => q(h, ".pxd-surface-title");
      const fa = fieldsOf(A), fb = fieldsOf(B);
      const n = Math.min(fa.length, fb.length);
      const pairs = [
        [A.el, B.el, "box"],
        [q(A, ".app-bar"), q(B, ".app-bar"), "box"],
        [q(A, ".status span"), q(B, ".status span"), "flip"],
        [q(A, ".battery"), q(B, ".battery"), "flip"],
        [q(A, ".app-icon"), q(B, ".app-icon"), "boxflip"],
        [q(A, ".app-name"), q(B, ".app-name"), "text"],
        [q(A, ".app-where"), q(B, ".app-where"), "text"],
        [q(A, ".q .bubble"), q(B, ".q .bubble"), "boxflip"],
        [q(A, ".pxd-surface"), q(B, ".pxd-surface"), "box"],
        [title(A), title(B), "text"],
        [q(A, ".pxd-required-legend"), q(B, ".pxd-required-legend"), "text"],
        ...fa.slice(0, n).map((el, i) => [el, fb[i], "flip"]),
        [q(A, ".pxd-action-bar"), q(B, ".pxd-action-bar"), "box"],
        [A.button, B.button, "boxflip"],
        [q(A, ".home-bar"), q(B, ".home-bar"), "flip"],
      ];
      const layerEl = document.createElement("div");
      layerEl.className = "morph-layer";
      morphLayers.appendChild(layerEl);
      s.morph = X.shared(scr, layerEl, A.el, B.el, pairs, fa.slice(n), fb.slice(n));
      A.tokens({ theme: A.base.theme });
    }

    // ——— The marks beside the phones ———
    $("b-seat1").innerHTML = M.svg("b-mark1", 132);
    $("b-seat2").innerHTML = M.svg("b-mark2", 132);
    const mark1 = M.driver($("b-mark1"), [{ t: T.read1, state: "reading" }]);
    const mark2 = M.driver($("b-mark2"), [
      { t: T.think, state: "thinking", turns: 1 },
      { t: T.look, state: "looking" },
      { t: T.blink, state: "blink" },
      { t: T.checked, state: "checked" },
    ]);

    // ——— The montage: other products' screens, each in its own design system ———
    const shots = (window.MONTAGE || []).slice(0, T.shots).map((s) => {
      const frame = s.frame === "phone" ? $("b-mphone") : $("b-mdesk");
      const host = frame.querySelector(s.frame === "phone" ? ".phone-screen" : ".desk-view");
      const shot = document.createElement("div");
      shot.className = "shot app";
      shot.setAttribute("data-pxd-theme", s.theme);
      shot.setAttribute("data-pxd-mode", "light");
      shot.setAttribute("data-layout-allow-overlap", "");
      const pad = document.createElement("div");
      pad.className = "pad";
      if (s.frame === "phone") {
        pad.style.top = "44px";
        const bar = document.createElement("div");
        bar.className = "status";
        bar.innerHTML = '<span>9:41</span><span class="battery"></span>';
        shot.appendChild(bar);
      }
      const inner = document.createElement("div");
      pad.appendChild(inner);
      shot.appendChild(pad);
      host.appendChild(shot);
      window.PolyxdWeb.mount(inner, { document: s.doc, theme: s.theme, mode: "light", density: s.frame === "phone" ? "compact" : "comfortable", locale: "en-GB" });
      shot.querySelectorAll("*").forEach((el) => el.setAttribute("data-layout-allow-overlap", ""));
      return { frame, shot };
    });

    // ——— GSAP: groups, words, the toast, the press ———
    const tl = gsap.timeline({ paused: true });
    F.inn(tl, $("b-g1"), T.g1In, 0.6, 0);
    F.out(tl, $("b-g1"), T.g1Out, 0.6);
    F.inn(tl, $("b-line1"), T.lineIn, 0.6, 14);
    F.out(tl, $("b-line1"), T.lineOut, 0.5);
    F.inn(tl, $("b-g2"), T.g2In, 0.6, 0);
    F.inn(tl, $("b-cap1"), T.cap1In);
    F.press(tl, L.return, T.tap);
    F.hide(tl, [L.return.toast]);
    F.inn(tl, L.return.toast, T.toast, 0.4, 10);
    F.out(tl, L.return.toast, T.toastOut, 0.4);
    F.out(tl, $("b-cap1"), T.cap1Out);
    F.inn(tl, $("b-cap2"), T.cap2In);
    F.out(tl, $("b-cap2"), T.cap2Out);
    F.inn(tl, $("b-cap3"), T.cap3In);
    F.out(tl, $("b-cap3"), T.cap3Out);
    F.out(tl, $("b-g2"), T.g2Out, 0.6);
    tl.set($("b-mont"), { opacity: 0 }, 0);
    tl.set($("b-mont"), { opacity: 1 }, T.montage);
    F.inn(tl, $("b-capM"), T.capMIn, 0.5, 10);
    F.out(tl, $("b-capM"), T.capMOut, 0.5);
    F.out(tl, $("b-mont"), T.montageEnd, 0.5);
    // A tween that spans the film, so the timeline's length (and its onUpdate) covers every frame.
    const clock = { t: 0 };
    tl.to(clock, { t: T.end, duration: T.end, ease: "none" }, 0);

    // ——— render(t): everything that is a function of time ———
    const managed = new Set();
    const layers = Object.values(L);
    function render(t) {
      const S = new Map();
      const set = (el, v) => {
        if (!el) return;
        managed.add(el);
        S.set(el, v);
      };

      // The conversation and the pupils.
      F.converse(s1, t, { text: ASK, typeFrom: T.type, sendAt: T.send, dotsFrom: T.dots, replyAt: T.stream, streamTo: T.streamTo });
      mark1(t);
      mark2(t);

      // The return screen's parts arrive, one per beat.
      partsOf(L.return).forEach((p, i) => {
        const k = E(seg(t, T.reveal + i * T.partsEvery, 0.5));
        for (const el of [].concat(p)) set(el, k >= 1 ? { o: "", tf: "" } : { o: k, tf: `translateY(${((1 - k) * 10).toFixed(2)}px)` });
      });

      // Tokens and names.
      for (const h of layers) {
        h.tokens(themeState(h, t));
        const app = appAt(h, t);
        if (h.nameEl.textContent !== app.name) h.nameEl.textContent = app.name;
        if (h.iconEl.textContent !== app.name[0]) h.iconEl.textContent = app.name[0];
        let dip = 0;
        for (const s of steps) if (s.kind === "token" && s.layer === h.name) dip = Math.max(dip, clamp(1 - Math.abs(seg(t, s.at, s.dur) - 0.5) / 0.14) * (t >= s.at && t <= s.at + s.dur ? 1 : 0));
        if (dip > 0) {
          set(h.nameEl, { o: 1 - dip, tf: "" });
          set(h.iconEl, { o: 1 - dip * 0.6, tf: "" });
        }
      }

      // Which screen shows, and the morph under way.
      let current = "return";
      let active = null;
      for (const s of steps) {
        if (s.kind === "token") continue;
        if (t >= s.at + s.dur) current = s.to;
        else if (t >= s.at) active = s;
      }
      for (const s of steps) if (s.morph) s.morph.rest();
      for (const h of layers) set(h.layer, { o: 0, tf: "" });
      if (active && active.kind === "swap") {
        // Same pack, same app bar on both sides: only the conversation's content changes. The old
        // question and screen leave, then the new ones arrive; the chrome never blinks.
        const p = seg(t, active.at, active.dur);
        const A = L[active.from], B = L[active.to];
        const content = (h) => [h.el.querySelector(".q"), h.el.querySelector(".answer")];
        if (p < 0.5) {
          set(A.layer, { o: 1, tf: "" });
          const k = E(p / 0.5);
          for (const el of content(A)) set(el, { o: 1 - k, tf: `translateY(${(-6 * k).toFixed(2)}px)` });
        } else {
          set(B.layer, { o: 1, tf: "" });
          const k = E((p - 0.5) / 0.5);
          for (const el of content(B)) set(el, { o: k, tf: `translateY(${(8 * (1 - k)).toFixed(2)}px)` });
        }
      } else if (active && active.kind === "shared") {
        set(L[active.from].layer, { o: 1, tf: "" });
        set(L[active.to].layer, { o: 1, tf: "" });
        active.morph.apply(E(seg(t, active.at, active.dur)), { set: (el, v) => set(el, v) });
      } else {
        set(L[current].layer, { o: 1, tf: "" });
      }

      // The montage: a hard cut to each screen on the beat.
      const i = Math.floor((t - T.montage) / T.shot + 1e-6);
      const on = t >= T.montage && i < shots.length ? shots[i] : null;
      for (const s of shots) set(s.shot, { o: s === on ? 1 : 0, tf: "" });
      set($("b-mphone"), { o: on && on.frame === $("b-mphone") ? 1 : 0, tf: "" });
      set($("b-mdesk"), { o: on && on.frame === $("b-mdesk") ? 1 : 0, tf: "" });

      // Write: every element this function has ever touched gets a value this frame.
      for (const el of managed) {
        const v = S.get(el) || { o: "", tf: "" };
        el.style.opacity = v.o === "" ? "" : String(Math.round(v.o * 1000) / 1000);
        el.style.transform = v.tf || "";
        el.style.transformOrigin = v.origin || "";
      }
    }
    tl.eventCallback("onUpdate", () => render(tl.time()));
    render(0);
    window.__renderFilmB = render;
    return tl;
  }

  // The page registers the timeline itself, once the fonts are in (the parts are measured).
  window.buildFilmB = build;
})();
