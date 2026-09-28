/*
 * Film B4, "Can I return these shoes?" (apps/film/hyperframes/STORY-B4.md).
 *
 * Maya asks a shop's assistant a simple question and gets homework; asked again, the answer is the
 * screen she needs; she taps once and she's done. Then the same thing in her bank and her council,
 * each in its own design, each checked; then everything else Polyxd can draw.
 *
 * Direction, not decoration: a virtual camera (the #rig world, keyframed poses: macro, pull-back
 * reveal, push-ins, punch-ins, 3D tilt, whip pans), hand-drawn doodles from the registry's hw family
 * (hw-callout-circle, hw-arrow, hw-underline, hw-boil) in ink and signal orange, and captions that
 * are revealed per word (caption-clip-wipe) or through a line mask (line-swap). The real renderer
 * draws every screen; B3's morphs (shared-element, design tokens) carry the apps into each other.
 *
 * One writer per property: GSAP tweens the doodles, captions, groups and presses; render(t), a pure
 * function of time registered through the hw family's single onUpdate, owns the camera, the
 * conversation, the screens' parts, the morphs, the montage and the marks.
 */
(function () {
  const F = window.Film;
  const M = window.PolyxdMark;
  const X = window.PolyxdMorph;
  const E = M.ease;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const seg = (t, a, d) => clamp((t - a) / d);
  const lerp = (a, b, p) => a + (b - a) * p;
  const $ = (id) => document.getElementById(id);
  const smoothstep = (p) => p * p * (3 - 2 * p);
  const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2); // power3.inOut
  const sine = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
  const out3 = (p) => 1 - Math.pow(1 - p, 3);

  // Stage geometry: the phone's screen origin and scale (kit.css).
  const SX = 941, SY = 90, K = 416 / 390;
  const stage = (x, y) => ({ x: SX + K * x, y: SY + K * y });
  const PC = { x: 1149, y: 540 };

  const ASK = "Can I return these shoes?";
  const PARAGRAPH =
    "Yes, you can return them within 30 days of delivery. To start a return, open the menu and go to Your orders. Find the order with the trail runners and tap View order. Scroll down to Items and tap the pair you want to send back, then choose Return or exchange. Pick a reason from the list. If you’d like a different size, choose Exchange and select your new size, then check it’s in stock. Next, choose how you’d like to send them back: drop-off point, locker or courier collection. If you choose drop-off, you’ll need to print the label we email you, or show the QR code at the counter. Once we receive them, your refund or exchange is processed within 3 to 5 working days, and you’ll get an email when";
  const PHRASES = [
    ["print", "print the label we email you"],
    ["days", "3 to 5 working days"],
  ];
  const SHOE =
    '<svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><path d="M4 24c0-3 1-7 3-9 2 2 5 3 8 2 2 3 6 5 11 6 4 1 8 3 8 6H4v-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 29h30M12 19l2 3M16 20l2 3M20 21l1.5 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  /** Layout rect of el inside anchor, in anchor's own pixels (offsets: transforms don't move them). */
  function layoutRect(el, anchor) {
    let x = 0, y = 0, n = el;
    while (n && n !== anchor) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function build() {
    const T = window.B4_T;
    const tl = gsap.timeline({ paused: true });
    const scr = $("screen");
    const ink = $("ink");

    // ——— Screens ———
    const layerOf = (h) => {
      const d = document.createElement("div");
      d.className = "layer";
      d.appendChild(h.el);
      scr.appendChild(d);
      h.layer = d;
      return h;
    };
    const morphLayers = document.createElement("div");
    morphLayers.style.cssText = "position:absolute;inset:0;";
    scr.appendChild(morphLayers);
    // The ask: Fernly's assistant, her order at the top, the question, the paragraph.
    const ask = layerOf(F.appScreen({ app: F.APPS.fernly, asked: ASK, reply: PARAGRAPH, composer: true, toBottom: true, home: true, crossfades: true }));
    const order = document.createElement("div");
    order.className = "row them order-row";
    order.innerHTML = `<div class="bubble"><div class="thumb">${SHOE}</div><div><div class="t1">Trail runners · size 9</div><div class="t2">Delivered 12 September</div></div></div>`;
    ask.el.querySelector(".chat").insertBefore(order, ask.question);
    ask.el.querySelectorAll("*").forEach((n) => n.setAttribute("data-layout-allow-overlap", ""));
    const words = PARAGRAPH.split(" ");
    const phraseAt = PHRASES.map(([key, text]) => {
      const w = text.split(" ");
      const bare = (x) => x.replace(/[.,:;!?]+$/, "");
      for (let i = 0; i < words.length; i++) if (words.slice(i, i + w.length).map(bare).join(" ") === text) return { key, i, n: w.length };
      return { key, i: -1, n: 0 };
    });
    const html = (n) => {
      let out = [];
      for (let i = 0; i < n; i++) {
        const open = phraseAt.find((p) => p.i === i);
        const close = phraseAt.find((p) => p.i >= 0 && i === Math.min(n, p.i + p.n) - 1 && i >= p.i);
        out.push((open ? `<span class="ph ph-${open.key}">` : "") + F.esc(words[i]) + (close ? "</span>" : ""));
      }
      return out.join(" ");
    };
    ask.words.innerHTML = html(words.length);

    // The answers: three apps' screens, the docked call to action.
    const mk = (name, o) => {
      const h = layerOf(F.appScreen(Object.assign({ dock: true, home: true, crossfades: true }, o)));
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
    const steps = [
      { kind: "shared", from: "return", to: "send", at: T.morph1, dur: T.morphDur },
      { kind: "token", layer: "send", at: T.tok1, dur: T.tokDur, to: "carbon", app: "ledger" },
      { kind: "token", layer: "send", at: T.tok2, dur: T.tokDur, to: "polaris", app: "tidings" },
      { kind: "shared", from: "send", to: "address", at: T.morph2, dur: T.morphDur },
    ];
    const themeState = (h, t) => {
      let theme = h.base.theme;
      for (const s of steps) {
        if (s.kind !== "token" || s.layer !== h.name) continue;
        if (t < s.at) break;
        if (t < s.at + s.dur) return { from: theme, to: s.to, p: E(seg(t, s.at, s.dur)) };
        theme = s.to;
      }
      return { theme };
    };
    const appAt = (h, t) => {
      let app = h.base;
      for (const s of steps) if (s.kind === "token" && s.layer === h.name && t >= s.at + s.dur / 2) app = F.APPS[s.app];
      return app;
    };
    // Shared-element morphs (B2/B3's), measured with the outgoing screen dressed as it will be then.
    const fieldsOf = (h) => (h.parts || []).slice(1, -1);
    for (const s of steps) {
      if (s.kind !== "shared") continue;
      const A = L[s.from], B = L[s.to];
      const st = themeState(A, s.at);
      A.tokens(st.theme ? st : { theme: st.to });
      const q = (h, sel) => h.el.querySelector(sel);
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
        [q(A, ".pxd-surface-title"), q(B, ".pxd-surface-title"), "text"],
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

    // The scan line lives inside the screen (clipped by the glass).
    const scan = document.createElement("div");
    scan.id = "scan";
    scr.appendChild(scan);

    // ——— Where things are (stage coordinates, for the camera and the doodles) ———
    const at = (el) => {
      const r = layoutRect(el, scr);
      const a = stage(r.x, r.y);
      return { x: a.x, y: a.y, w: r.w * K, h: r.h * K, cx: a.x + (r.w * K) / 2, cy: a.y + (r.h * K) / 2 };
    };
    const thumb = at(order.querySelector(".thumb"));
    const R = L.return;
    const chips = R.el.querySelectorAll(".pxd-choice button, .pxd-choice [role=radio], .pxd-chip, .pxd-choice label");
    const tooSmall = Array.from(R.el.querySelectorAll("*")).find((n) => n.children.length <= 2 && /Too small/.test(n.textContent) && n.offsetWidth < 200) || chips[0];
    const swapEl = Array.from(R.el.querySelectorAll("*")).find((n) => /^Swap for size 10/.test(n.textContent.trim()) && n.offsetWidth < 330 && n.offsetHeight < 80);
    const tsR = at(tooSmall);
    const swR = at(swapEl);
    const toastR = at(R.toast);
    const btnSend = at(L.send.button);
    const composer = at(ask.el.querySelector(".field"));
    const replyEl = ask.reply;

    // ——— The camera: poses on a keyframe ladder; render() interpolates ———
    // fx, fy: the stage point in focus; vx, vy: where it lands on screen; s: zoom; rx, ry: tilt.
    const pose = (o) => Object.assign({ fx: PC.x, fy: PC.y, vx: PC.x, vy: PC.y, s: 1, rx: 0, ry: 0 }, o);
    const REST = pose({});
    const RIGHT = pose({ vx: 1262 });
    const CAM = [
      [0, REST],
      [T.askIn - 0.3, pose({ fx: composer.cx, fy: composer.cy, vx: 960, vy: 560, s: 3.0 })],
      [T.pullFrom, pose({ fx: composer.cx, fy: composer.cy, vx: 960, vy: 560, s: 3.0 }), "hold"],
      [T.pullTo, REST, "decel"], // zoom-out-workspace-reveal: one decelerating pull-back
      [T.pushFrom, pose({ s: 1.03 }), "sine"], // a slow drift while she reads
      [T.pushTo, pose({ fx: 1140, fy: 610, vx: 1215, vy: 575, s: 1.42 }), "sine"], // the push-in as the text piles up
      [T.rigOut + 0.4, pose({ fx: 1140, fy: 610, vx: 1215, vy: 575, s: 1.42 }), "hold"],
      [T.hit - 0.01, pose({ vx: 960, s: 0.9, rx: 12, ry: -26 }), "cut"], // reveal: tilted, settling flat
      [T.flat, pose({ vx: 960, s: 1.14 }), "decel"],
      [T.shiftRight, pose({ vx: 960, s: 1.17 }), "sine"],
      [T.shiftRight + 0.5, RIGHT, "brand"],
      [T.punch, pose({ vx: 1262, s: 1.04 }), "sine"],
      [T.punchTo, pose({ fx: tsR.cx, fy: tsR.cy, vx: 1010, vy: 520, s: 2.35 }), "brand"], // punch-in: "Too small"
      [T.travel, pose({ fx: tsR.cx, fy: tsR.cy, vx: 1010, vy: 520, s: 2.35 }), "hold"],
      [T.travelTo, pose({ fx: swR.cx, fy: swR.cy, vx: 1010, vy: 520, s: 2.1 }), "inout"], // travel to the swap
      [T.pullback, pose({ fx: swR.cx, fy: swR.cy, vx: 1010, vy: 520, s: 2.1 }), "hold"],
      [T.pullbackTo, pose({ vx: 1180 }), "decel"],
      [T.whip1, pose({ vx: 1180, s: 1.03 }), "sine"],
      [T.whip1 + 0.7, RIGHT, "decel"],
      [T.capDesign, RIGHT, "hold"],
      [T.whip2 - 0.1, pose({ vx: 1262, s: 1.07, fy: 520 }), "sine"], // a slow push through the blends
      [T.whip2 + 0.7, RIGHT, "decel"],
      [T.pushForm, pose({ vx: 1262, s: 1.03 }), "sine"],
      [T.pushFormTo, pose({ fy: 470, vx: 1120, vy: 470, s: 1.5 }), "brand"], // push in on the council form
      [T.pullChk, pose({ fy: 470, vx: 1120, vy: 470, s: 1.5 }), "hold"],
      [T.pullChkTo, pose({ vx: 1250, s: 1.06 }), "decel"],
      [T.end, pose({ vx: 1250, s: 1.1 }), "sine"],
    ];
    const EASES = { hold: () => 0, decel: out3, sine, inout: inOut, brand: E, cut: () => 1 };
    function camAt(t) {
      let i = 0;
      while (i < CAM.length - 1 && CAM[i + 1][0] <= t) i++;
      const [t0, a] = CAM[i];
      const nxt = CAM[i + 1];
      if (!nxt) return a;
      const [t1, b, kind] = nxt;
      if (kind === "hold") return a;
      if (kind === "cut") return t >= t1 ? b : a;
      const p = (EASES[kind] || E)(seg(t, t0, t1 - t0));
      const o = {};
      for (const k of Object.keys(a)) o[k] = lerp(a[k], b[k], p);
      return o;
    }
    // Whip pans (registry whip-pan-cut's mechanism on the camera): one power3.inOut travel, the
    // frame leaves one way and the next arrives from the other side; directional blur capped at 16px
    // and peaking at mid-whip.
    const WHIPS = [T.whip1, T.whip2];
    const WHIP = 0.62;
    function whipAt(t) {
      for (const w of WHIPS) {
        if (t < w || t > w + WHIP) continue;
        const p = (t - w) / WHIP;
        // out: accelerating off to the left; in: from the right, decelerating into place
        const x = p < 0.5 ? -2400 * Math.pow(p * 2, 3) : 2400 * Math.pow(1 - (p - 0.5) * 2, 3);
        return { x, blur: 16 * Math.pow(1 - Math.abs(p - 0.5) * 2, 1.5) };
      }
      return { x: 0, blur: 0 };
    }
    const rig = $("rig");
    const blurNode = $("b4-whip-blur");
    const persp = $("persp");
    function applyCam(t) {
      const c = camAt(t);
      const w = whipAt(t);
      rig.style.transform = `translate(${(c.vx + w.x).toFixed(2)}px, ${c.vy.toFixed(2)}px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg) scale(${c.s.toFixed(4)}) translate(${(-c.fx).toFixed(2)}px, ${(-c.fy).toFixed(2)}px)`;
      blurNode.setAttribute("stdDeviation", `${w.blur.toFixed(2)} 0`);
      persp.style.filter = w.blur > 0.05 ? "url(#b4-whip)" : "";
    }

    // ——— Doodles (registry hw family) ———
    const add = (cls, id, x, y, w, h, extra) => {
      const d = document.createElement("div");
      d.className = cls;
      d.id = id;
      d.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;` + (extra || "");
      d.innerHTML = `<svg viewBox="0 0 ${w} ${h}"></svg>`;
      ink.appendChild(d);
      return d;
    };
    const hand = (id, text, x, y, size, parent) => {
      const d = document.createElement("div");
      d.className = "hand";
      d.id = id;
      d.style.cssText = `left:${x}px;top:${y}px;font-size:${size}px;clip-path:inset(-20% 100% -30% -5%);`;
      d.textContent = text;
      (parent || ink).appendChild(d);
      return d;
    };
    const writeOn = (el, t0, dur = 0.45) => tl.fromTo(el, { clipPath: "inset(-20% 100% -30% -5%)" }, { clipPath: "inset(-20% -5% -30% -5%)", duration: dur, ease: "power1.inOut", immediateRender: false }, t0);
    // A registry mark's path is a zero-length dash until it draws; its round cap would show as a
    // dot, so the wrapper stays hidden until then.
    const reveal = (el, t0) => {
      gsap.set(el, { opacity: 0 });
      tl.set(el, { opacity: 0 }, 0);
      tl.set(el, { opacity: 1 }, t0);
    };
    const fadeOff = (el, t0, dur = 0.3) => tl.to(el, { opacity: 0, duration: dur, ease: "power2.in" }, t0);
    const callout = (id, r, label, labelAt, on, off) => {
      const W = Math.max(90, (r.w / 0.84) * 1.18), H = Math.max(70, (r.h / 0.72) * 1.25);
      const d = document.createElement("div");
      d.className = "hw-callout";
      d.id = id;
      d.style.cssText = `left:${r.cx - W / 2}px;top:${r.cy - H / 2}px;width:${W}px;height:${H}px;`;
      d.innerHTML = `<div class="hw-co-boil"><div class="hw-co-deform"><svg viewBox="0 0 ${W} ${H}"><path class="hw-co-outline"/><path class="hw-co-scribble"/></svg></div><div class="hw-co-conn-layer"><svg viewBox="0 0 ${W} ${H}"><path class="hw-co-connector"/></svg></div><div class="hw-co-pop"><div class="hw-co-label"></div></div></div>`;
      ink.appendChild(d);
      window.hwCalloutBuild("#" + id, { scribble: false, seed: id.length * 7, label, labelAt, strokeType: "plain", boil: "calm" });
      window.hwCalloutOn(tl, "#" + id, on);
      window.hwCalloutOff(tl, "#" + id, off);
      return d;
    };
    const markPath = (el, style, seed) => {
      const svg = el.querySelector("svg");
      const vb = svg.viewBox.baseVal;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", window.hwMarkPath(vb.width, vb.height, style, seed));
      svg.appendChild(p);
    };
    const drawPath = (el, d, on, dur, color, width) => {
      const svg = el.querySelector("svg");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
      if (color) el.style.setProperty("--hw-draw-color", color);
      if (width) el.style.setProperty("--hw-draw-w", width);
      const applied = window.hwStrokeApply(p, "plain", { seed: el.id.length });
      window.hwDrawOn(tl, applied, on, dur, { ease: "power2.inOut" });
      return p;
    };
    const tickD = (w, h, seed) => {
      const j = (n) => window.hwHash(n, seed) * 3;
      return `M ${w * 0.08 + j(1)} ${h * 0.55 + j(2)} Q ${w * 0.25} ${h * 0.7 + j(3)} ${w * 0.38 + j(4)} ${h * 0.9 + j(5)} Q ${w * 0.6} ${h * 0.45} ${w * 0.94 + j(6)} ${h * 0.08 + j(7)}`;
    };
    const sparkleD = (s) => `M ${s / 2} 0 L ${s / 2} ${s} M 0 ${s / 2} L ${s} ${s / 2} M ${s * 0.2} ${s * 0.2} L ${s * 0.34} ${s * 0.34} M ${s * 0.8} ${s * 0.2} L ${s * 0.66} ${s * 0.34}`;

    // 1 · The ask: an orange circle round the trainers, "too small :(".
    const thumbCo = callout("d-thumb", thumb, "too small :(", "left", T.circleOn, T.circleOff);
    const thumbW = parseFloat(thumbCo.style.width), thumbH = parseFloat(thumbCo.style.height);

    // 2 · The problem: a step counter in the margin, an arrow at the label she has to print, an
    // underline under the wait, then a big strike-through.
    const counter = hand("d-count", "", 1402, 250, 54);
    const phrase = (key) => ask.words.querySelector(".ph-" + key);
    const arrow = add("hw-arrow", "d-arrow", 0, 0, 190, 92, "--hw-arrow-color:#ff6e40;");
    window.hwArrowBuild("#d-arrow", { arrowStyle: "gentle", strokeType: "plain", boil: "calm" });
    window.hwArrowOn(tl, "#d-arrow", T.arrowOn);
    window.hwArrowOff(tl, "#d-arrow", T.marksOff);
    const under = add("hw-mark", "d-under", 0, 0, 200, 26);
    markPath(under, "underline", 4);
    window.hwMarkOn(tl, "#d-under", T.underOn, 0.45);
    reveal(under, T.underOn);
    window.hwBoil(tl, "#d-under", { frameDrop: 3, seed: 4, amp: 1.2, rot: 0.3 });
    window.hwMarkOff(tl, "#d-under", T.marksOff);
    fadeOff(counter, T.marksOff);
    // The crumple: a copy of the paragraph (identical to the live one once it has finished
    // streaming) and the strike-through ride one wrapper that balls up and flies off.
    const crumple = document.createElement("div");
    crumple.id = "crumple";
    ink.appendChild(crumple);
    const replyR = at(ask.reply.querySelector(".bubble"));
    const chatR = at(ask.el.querySelector(".chat"));
    const clone = ask.reply.querySelector(".bubble").cloneNode(true);
    const cloneWrap = document.createElement("div");
    cloneWrap.className = "clone";
    cloneWrap.setAttribute("data-pxd-theme", F.APPS.fernly.theme);
    cloneWrap.setAttribute("data-pxd-mode", "light");
    cloneWrap.style.cssText = `width:${replyR.w / K}px;transform:scale(${K});transform-origin:0 0;font-family:var(--pxd-type-body-default-family);color:var(--pxd-color-text-default);`;
    cloneWrap.appendChild(clone);
    crumple.appendChild(cloneWrap);
    crumple.style.left = replyR.x + "px";
    crumple.style.top = replyR.y + "px";
    crumple.style.width = replyR.w + "px";
    crumple.style.height = replyR.h + "px";
    // The live bubble is clipped by the chat; the copy starts clipped the same way.
    const clipTop = Math.max(0, chatR.y - replyR.y);
    const strike = document.createElement("div");
    strike.className = "hw-mark";
    strike.id = "d-strike";
    const visH = replyR.h - clipTop;
    const sw = replyR.w * 1.08, sh = 70;
    strike.style.cssText = `left:${-replyR.w * 0.04}px;top:${clipTop + visH / 2 - sh / 2}px;width:${sw}px;height:${sh}px;transform:rotate(-14deg);--hw-mark-w:12;`;
    strike.innerHTML = `<svg viewBox="0 0 ${sw} ${sh}"></svg>`;
    crumple.appendChild(strike);
    markPath(strike, "strike", 9);
    window.hwMarkOn(tl, "#d-strike", T.strike, 0.4);
    reveal(strike, T.strike);

    // 3 · Reveal: "it knew" round the chosen reason; an underline and a sparkle on the swap; a tick.
    callout("d-knew", tsR, "it knew", "left", T.knewOn, T.knewOff);
    const swUnder = add("hw-mark", "d-swap", swR.x, swR.y + swR.h + 2, Math.max(120, swR.w), 22);
    markPath(swUnder, "underline", 11);
    window.hwMarkOn(tl, "#d-swap", T.swapOn, 0.4);
    reveal(swUnder, T.swapOn);
    window.hwMarkOff(tl, "#d-swap", T.swapOff);
    const spark = add("hw-draw", "d-spark", swR.x + swR.w + 6, swR.y - 26, 30, 30, "--hw-draw-w:4;");
    drawPath(spark, sparkleD(30), T.sparkle, 0.28, "#ff6e40", 4);
    fadeOff(spark, T.swapOff);
    const bigTick = add("hw-draw", "d-tick", toastR.cx - 70, toastR.cy - 110, 140, 120, "--hw-draw-w:13;");
    drawPath(bigTick, tickD(140, 120, 3), T.bigTick, 0.35, "#ff6e40", 13);
    fadeOff(bigTick, T.bigTickOff, 0.2);

    // 4 · Any app: an arrow at the bank's own button, "their colours, not ours"; each design system
    // named by hand, then scribbled out as the next one arrives.
    const arrApp = add("hw-arrow", "d-arrapp", btnSend.x - 230, btnSend.cy - 78, 220, 100, "--hw-arrow-color:#ff6e40;");
    window.hwArrowBuild("#d-arrapp", { arrowStyle: "swoop", strokeType: "plain", boil: "calm" });
    window.hwArrowOn(tl, "#d-arrapp", T.arrowApp);
    window.hwArrowOff(tl, "#d-arrapp", T.arrowAppOff);
    const note = hand("d-note", "their colours, not ours", btnSend.x - 470, btnSend.cy - 170, 50);
    writeOn(note, T.arrowApp + 0.55, 0.55);
    fadeOff(note, T.arrowAppOff);
    const lbl = (id, text, on, strikeAt) => {
      const h = hand(id, text, 610, 140, 66);
      writeOn(h, on, 0.4);
      const m = document.createElement("div");
      m.className = "hw-mark";
      m.id = id + "-x";
      m.style.cssText = `left:-6px;top:14px;width:${text.length * 30 + 16}px;height:34px;--hw-mark-w:7;`;
      m.innerHTML = `<svg viewBox="0 0 ${text.length * 30 + 16} 34"></svg>`;
      h.appendChild(m);
      markPath(m, "strike", id.length);
      window.hwMarkOn(tl, "#" + m.id, strikeAt, 0.3);
      reveal(m, strikeAt);
      fadeOff(h, strikeAt + 0.38, 0.25);
    };
    lbl("d-carbon", "Carbon", T.label1, T.label1Strike);
    lbl("d-polaris", "Polaris", T.label2, T.label2Strike);

    // 5 · Checked: a scan line passes each control; a tick lands beside it, three with a note.
    const A = L.address;
    const controls = [...fieldsOf(A), A.el.querySelector(".pxd-action-bar .pxd-button-primary")].filter(Boolean);
    const notes = ["labelled", null, "readable", null, "big enough to tap"];
    const scanTop = 190, scanBot = 800;
    const scanY = (t) => lerp(scanTop, scanBot, seg(t, T.scanFrom, T.scanTo - T.scanFrom));
    controls.forEach((el, i) => {
      const r = layoutRect(el, scr);
      const mid = r.y + r.h / 2;
      const when = T.scanFrom + ((mid - scanTop) / (scanBot - scanTop)) * (T.scanTo - T.scanFrom);
      const s = stage(390, mid);
      const tk = add("hw-draw", `d-ck${i}`, s.x + 20, s.y - 22, 44, 40, "--hw-draw-w:7;");
      drawPath(tk, tickD(44, 40, i + 2), when, 0.22, "#ff6e40", 7);
      tk.dataset.when = when;
      if (notes[i]) {
        const n = hand(`d-ckn${i}`, notes[i], s.x + 72, s.y - 22, 38);
        writeOn(n, when + 0.18, 0.35);
      }
    });
    const ckAll = Array.from(ink.querySelectorAll("[id^=d-ck]"));
    tl.to(ckAll, { opacity: 0, duration: 0.35, ease: "power2.in" }, T.rigOut2 - 0.3);

    // The marks: one beside the phone (checked), one alone on paper (the turn).
    $("seat").innerHTML = M.svg("b4-seat-mark", 132);
    const seatMark = M.driver($("b4-seat-mark"), [
      { t: T.markIn + 0.2, state: "looking" },
      { t: T.markChecked, state: "checked" },
    ]);
    $("turn-mark").innerHTML = M.svg("b4-turn-mark", 170);
    const turnMark = M.driver($("b4-turn-mark"), [
      { t: T.turnRead, state: "reading" },
      { t: T.turnBlink, state: "blink" },
    ]);

    // ——— Captions ———
    const capWords = (id) => Array.from($(id).querySelectorAll(".w"));
    const wordsIn = (id, t0, stagger = 0.09) => {
      capWords(id).forEach((w, i) => tl.fromTo(w, { clipPath: "inset(-10% 100% -20% 0)" }, { clipPath: "inset(-10% -2% -20% 0)", duration: 0.32, ease: "power2.out", immediateRender: false }, t0 + i * stagger));
    };
    const lineIn = (id, t0) => {
      tl.set(capWords(id), { clipPath: "inset(-10% -2% -20% 0)" }, t0);
      tl.fromTo(`#${id} .line`, { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: "power4.out", immediateRender: false }, t0);
    };
    const lineOut = (id, t0) => tl.fromTo(`#${id} .line`, { yPercent: 0 }, { yPercent: -115, duration: 0.35, ease: "power2.in", immediateRender: false }, t0);
    const caps = ["cap-a", "cap-b", "cap-q", "cap-r", "cap-app", "cap-design", "cap-chk", "cap-m"];
    for (const c of caps) {
      tl.set(`#${c} .line`, { yPercent: 115 }, 0);
      gsap.set(`#${c} .line`, { yPercent: 115 });
    }
    const showWords = (id, t0) => {
      tl.set(`#${id} .line`, { yPercent: 0 }, t0);
      wordsIn(id, t0);
    };
    showWords("cap-a", T.capA); // caption-clip-wipe: per-word wipe
    lineOut("cap-a", T.capB); // line-swap: A exits up through the mask as B rises
    lineIn("cap-b", T.capB + 0.05);
    lineOut("cap-b", T.pushTo - 0.4);
    showWords("cap-q", T.capQ);
    lineOut("cap-q", T.turnOut - 0.35);
    lineIn("cap-r", T.capR); // mask-reveal-up
    lineOut("cap-r", T.capROut);
    showWords("cap-app", T.capApp);
    lineOut("cap-app", T.capAppOut);
    lineIn("cap-design", T.capDesign);
    lineOut("cap-design", T.capDesignOut);
    showWords("cap-chk", T.capChk);
    lineOut("cap-chk", T.capChkOut);
    showWords("cap-m", T.capM);
    lineOut("cap-m", T.capMOut);

    // ——— Groups and presses (GSAP) ———
    tl.set("#stagebox", { opacity: 0 }, 0);
    tl.to("#stagebox", { opacity: 1, duration: 0.35, ease: "power1.out" }, T.askIn - 0.3);
    tl.to("#stagebox", { opacity: 0, duration: 0.4, ease: "power2.in" }, T.rigOut);
    tl.set("#stagebox", { opacity: 1 }, T.hit);
    tl.to("#stagebox", { opacity: 0, duration: 0.3, ease: "power2.in" }, T.rigOut2);
    tl.set("#turn", { opacity: 0 }, 0);
    tl.to("#turn", { opacity: 1, duration: 0.4, ease: "power1.out" }, T.turnIn);
    tl.to("#turn", { opacity: 0, duration: 0.3, ease: "power2.in" }, T.turnOut);
    F.hide(tl, [ask.question, R.toast]);
    F.inn(tl, ask.question, T.send, 0.35, 10);
    F.press(tl, R, T.tap);
    tl.fromTo(R.toast, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: E, immediateRender: false }, T.toast);
    tl.to(R.toast, { opacity: 0, duration: 0.25 }, T.whip1 + 0.1);
    tl.fromTo("#seat", { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.45, ease: E, immediateRender: false }, T.markIn);
    tl.set("#seat", { opacity: 0 }, 0);
    tl.set("#mont", { opacity: 0 }, 0);
    tl.set("#mont", { opacity: 1 }, T.montage);
    tl.to("#mont", { opacity: 0, duration: 0.3, ease: "power2.in" }, T.montEnd);
    tl.to({ t: 0 }, { t: T.end, duration: T.end, ease: "none" }, 0);

    // ——— Montage: ten screens, each arriving with its own move; a quick doodle every few ———
    const shots = (window.MONTAGE || []).slice(0, T.shots).map((s, i) => {
      const frame = s.frame === "phone" ? $("m-phone") : $("m-desk");
      const host = frame.querySelector(s.frame === "phone" ? ".phone-screen" : ".desk-view");
      const shot = document.createElement("div");
      shot.className = "shot app";
      shot.setAttribute("data-pxd-theme", s.theme);
      shot.setAttribute("data-pxd-mode", "light");
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
      return { frame, shot, s, i };
    });
    // Doodles on three shots, drawn fast (they have under a second).
    const mStart = (i) => T.montage + i * T.shot;
    const mDoodle = (i, sel, kind) => {
      const sh = shots[i];
      if (!sh) return;
      const target = sh.shot.querySelector(sel);
      if (!target) return;
      const isPhone = sh.s.frame === "phone";
      const host = isPhone ? sh.frame.querySelector(".phone-glass") : sh.frame;
      const anchor = isPhone ? sh.frame.querySelector(".phone-screen") : sh.frame.querySelector(".desk-view");
      const r = layoutRect(target, anchor);
      const k = isPhone ? K : 0.85273, ox = 0, oy = isPhone ? 0 : 34;
      const box = { x: ox + r.x * k, y: oy + r.y * k, w: r.w * k, h: r.h * k };
      const d = document.createElement("div");
      d.className = "hw-draw";
      d.id = `d-m${i}`;
      const pad = kind === "circle" ? 18 : 0;
      const W = kind === "circle" ? box.w + pad * 2 : 34, H = kind === "circle" ? box.h + pad * 2 : 34;
      const x = kind === "circle" ? box.x - pad : box.x + box.w - 10, y = kind === "circle" ? box.y - pad : box.y - 30;
      d.style.cssText = `left:${x}px;top:${y}px;width:${W}px;height:${H}px;z-index:8;`;
      d.innerHTML = `<svg viewBox="0 0 ${W} ${H}"></svg>`;
      host.appendChild(d);
      const path = kind === "circle" ? window.hwWobbleEllipse(W / 2, H / 2, W * 0.47, H * 0.44, i + 3, 4) : sparkleD(34);
      drawPath(d, path, mStart(i) + 0.22, 0.28, "#ff6e40", kind === "circle" ? 6 : 4);
      tl.set(d, { opacity: 0 }, mStart(i + 1) - 0.001);
      tl.set(d, { opacity: 1 }, 0);
      return d;
    };
    mDoodle(0, ".pxd-meter, .pxd-progress, .pxd-stat, h1", "sparkle");
    mDoodle(1, ".pxd-chart, svg", "circle");
    mDoodle(5, ".pxd-button-primary", "circle");
    mDoodle(8, ".pxd-tabs, [role=tablist]", "circle");
    const MOVES = [
      (p) => ({ s: lerp(1.14, 1, p) }), // push
      (p) => ({ ry: lerp(16, 0, p), s: lerp(0.94, 1, p) }), // tilt
      (p) => ({ x: lerp(110, 0, p) }), // slide
      (p) => ({ s: lerp(1.42, 1, p) }), // zoom-out reveal
    ];

    // ——— render(t) ———
    const managed = new Set();
    const layersAll = [ask, ...Object.values(L)];
    function render(t) {
      const S = new Map();
      const set = (el, v) => {
        if (!el) return;
        managed.add(el);
        S.set(el, v);
      };
      applyCam(t);

      // The ask: typing in the composer; the answer streams in, phrases marked for the doodles.
      F.converse(ask, t, { text: ASK, typeFrom: T.typeFrom, sendAt: T.send, dotsFrom: T.dots, replyAt: T.stream });
      const n = Math.max(1, Math.min(words.length, Math.round(seg(t, T.stream, T.streamTo - T.stream) * words.length)));
      const key = t < T.stream ? "dots" : String(n);
      if (ask.words.dataset.n !== key) {
        ask.words.innerHTML = html(n);
        ask.words.dataset.n = key;
      }
      // The counter in the margin.
      const count = t >= T.count3 ? "7 steps?!" : t >= T.count2 ? "5…" : t >= T.count1 ? "3 steps…" : "";
      if (counter.textContent !== count) counter.textContent = count;
      const cStart = t >= T.count3 ? T.count3 : t >= T.count2 ? T.count2 : T.count1;
      counter.style.clipPath = `inset(-20% ${((1 - out3(seg(t, cStart, 0.35))) * 100).toFixed(1)}% -30% -5%)`;
      // Doodles that follow the conversation as it grows.
      {
        const r = at(order.querySelector(".thumb"));
        thumbCo.style.left = `${r.cx - thumbW / 2}px`;
        thumbCo.style.top = `${r.cy - thumbH / 2}px`;
      }
      const pr = phrase("print");
      if (pr) {
        const r = at(pr);
        arrow.style.left = `${r.x - 196}px`;
        arrow.style.top = `${r.cy - 27}px`;
      }
      const pd = phrase("days");
      if (pd) {
        const r = at(pd);
        under.style.left = `${r.x}px`;
        under.style.top = `${r.y + r.h - 4}px`;
        under.style.width = `${Math.max(60, r.w)}px`;
      }
      // The crumple: the copy takes over from the live paragraph, balls up and flies off.
      const cp = seg(t, T.crumple, T.crumpleDur);
      const crumpling = t >= T.crumple;
      // The reply bubble: in with the dots, gone the moment its copy takes over.
      const rk = E(seg(t, T.dots, 0.3));
      set(ask.reply, { o: crumpling ? 0 : rk, tf: rk >= 1 ? "" : `translateY(${((1 - rk) * 10).toFixed(2)}px)` });
      set(cloneWrap, { o: crumpling ? 1 : 0, tf: `scale(${K})`, origin: "0 0" });
      crumple.style.opacity = t >= T.strike && cp < 1 ? "1" : "0";
      const e = cp * cp;
      crumple.style.transform = `translate(${(e * 520).toFixed(1)}px, ${(-e * 620 - Math.sin(cp * Math.PI) * 60).toFixed(1)}px) rotate(${(e * 240).toFixed(1)}deg) scale(${lerp(1, 0.08, E(cp)).toFixed(3)})`;
      crumple.style.filter = cp > 0 ? `blur(${(cp * 6).toFixed(2)}px)` : "";
      crumple.style.clipPath = `inset(${(clipTop * (1 - cp)).toFixed(1)}px -60px -60px -60px round ${(cp * 200).toFixed(0)}px)`;

      // Which layer shows: the ask until the turn, then the answers.
      const revealed = t >= T.hit - 0.01;
      set(ask.layer, { o: revealed ? 0 : 1, tf: "" });
      // The return screen's parts arrive one per beat; its docked button rises on the pull-back.
      const partsR = R.parts || [];
      partsR.forEach((p, i) => {
        const last = i === partsR.length - 1;
        const t0 = last ? T.dockRise : T.parts + i * T.partsEvery;
        const k = E(seg(t, t0, last ? 0.5 : 0.45));
        for (const el of [].concat(p)) set(el, k >= 1 ? { o: "", tf: "" } : { o: last ? Math.min(1, k * 1.6) : k, tf: `translateY(${((1 - k) * (last ? 110 : 12)).toFixed(2)}px)` });
      });
      for (const h of Object.values(L)) {
        h.tokens(themeState(h, t));
        const app = appAt(h, t);
        if (h.nameEl.textContent !== app.name) h.nameEl.textContent = app.name;
        if (h.iconEl.textContent !== app.name[0]) h.iconEl.textContent = app.name[0];
        let dip = 0;
        for (const s of steps) if (s.kind === "token" && s.layer === h.name && t >= s.at && t <= s.at + s.dur) dip = Math.max(dip, clamp(1 - Math.abs(seg(t, s.at, s.dur) - 0.5) / 0.14));
        if (dip > 0) {
          set(h.nameEl, { o: 1 - dip, tf: "" });
          set(h.iconEl, { o: 1 - dip * 0.6, tf: "" });
        }
      }
      let current = "return";
      let active = null;
      for (const s of steps) {
        if (s.kind !== "shared") continue;
        if (t >= s.at + s.dur) current = s.to;
        else if (t >= s.at) active = s;
      }
      for (const s of steps) if (s.morph) s.morph.rest();
      for (const h of Object.values(L)) set(h.layer, { o: 0, tf: "" });
      if (revealed) {
        if (active) {
          set(L[active.from].layer, { o: 1, tf: "" });
          set(L[active.to].layer, { o: 1, tf: "" });
          active.morph.apply(E(seg(t, active.at, active.dur)), { set: (el, v) => set(el, v) });
        } else set(L[current].layer, { o: 1, tf: "" });
      }
      // The scan.
      const sp = seg(t, T.scanFrom, T.scanTo - T.scanFrom);
      scan.style.top = `${scanY(t).toFixed(1)}px`;
      scan.style.opacity = t >= T.scanFrom && t < T.scanTo + 0.2 ? String(Math.min(1, sp * 8, (T.scanTo + 0.2 - t) * 5)) : "0";

      // The marks.
      seatMark(t);
      turnMark(t);

      // The montage: a hard cut to each screen on the beat, each arriving with its own move.
      const i = Math.floor((t - T.montage) / T.shot + 1e-6);
      const on = t >= T.montage && i < shots.length ? shots[i] : null;
      for (const s of shots) set(s.shot, { o: s === on ? 1 : 0, tf: "" });
      const mp = $("m-phone"), md = $("m-desk");
      set(mp, { o: on && on.frame === mp ? 1 : 0, tf: "" });
      set(md, { o: on && on.frame === md ? 1 : 0, tf: "" });
      if (on) {
        const local = t - mStart(on.i);
        const m = MOVES[on.i % MOVES.length](E(clamp(local / 0.38)));
        const drift = 1 + 0.03 * clamp(local / T.shot);
        const tf = `translateX(${(m.x || 0).toFixed(1)}px) perspective(1600px) rotateY(${(m.ry || 0).toFixed(2)}deg) scale(${((m.s || 1) * drift).toFixed(4)})`;
        set(on.frame, { o: 1, tf, origin: "50% 50%" });
      }

      for (const el of managed) {
        const v = S.get(el) || { o: "", tf: "" };
        el.style.opacity = v.o === "" ? "" : String(Math.round(v.o * 1000) / 1000);
        el.style.transform = v.tf || "";
        el.style.transformOrigin = v.origin || "";
      }
    }
    // One onUpdate for the whole film: the hw family's (hwOnUpdate), render first.
    if (tl.__hwRenders) tl.__hwRenders.unshift(() => render(tl.time()));
    else window.hwOnUpdate(tl, () => render(tl.time()));
    render(0);
    window.__renderB4 = render;
    return tl;
  }

  window.buildFilmB4 = build;
})();
