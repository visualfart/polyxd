/*
 * Film S, "Who gives AI taste?" (STORY-STUDIO.md): a film about Polyxd Studio, made the way B5 was.
 *
 * An assistant draws a cancel screen the way nobody on the team would: three shouting buttons,
 * "Oops!", the wrong blue. Who gives it taste? The designers, in Studio: they bring the design
 * system, tune it, decide what screens may use, write the rules, author the screens that shouldn't be
 * generated, and publish. Then the same ask comes back, and the screen is theirs.
 *
 * Two worlds, each with its own camera (poses on a keyframe ladder, as in B4/B5): stage A holds the
 * Studio window (the real Studio, captured from a local seeded instance by film-s-capture.mjs, with
 * a hand-drawn layer in the page's own pixels); stage B holds the phone the product runs on (the real
 * renderer; the generated screen's variants and the team's published screen) and its hand-drawn
 * layer. A paper panel slides in under the captions when stage A's camera needs the whole frame.
 *
 * One writer per property: GSAP tweens the doodles, captions and groups; render(t), a pure function
 * of time registered through the hw family's single onUpdate, owns both cameras, the Studio pages
 * and their sequences, the phone's screens and theme, the flights and the marks.
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
  const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const sine = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
  const out3 = (p) => 1 - Math.pow(1 - p, 3);

  // Stage B: the phone's screen origin and scale (kit.css).
  const SX = 941, SY = 90, K = 416 / 390;
  const stage = (x, y) => ({ x: SX + K * x, y: SY + K * y });
  const PC = { x: 1149, y: 540 };
  // Stage A: the Studio window's page origin and scale (film-s.css).
  const WX = 702, WY = 186, WK = 0.75;
  const sp = (x, y) => ({ x: WX + WK * x, y: WY + WK * y });
  // Where the phone sits when it is small, on the left (the tune pull-back, the rules).
  const SMALL = { x: 400, y: 405, s: 0.7 };

  const ASK = "Cancel my subscription";
  const HARBOURLINE = { name: "Harbourline", theme: "harbourline" };
  const LOUD = { name: "Harbourline", theme: "loud" };

  /** The assistant's screen as generated, and as each rule fixes it (v = rules applied). */
  function generated(v) {
    const caps = v < 2;
    const act = (id, label, emphasis) => ({ id, component: "Action", label, emphasis, action: { event: { name: `subscription.${id}` } } });
    return {
      specVersion: "0.3.0",
      surface: { id: "cancel-generated", title: caps ? "CANCEL SUBSCRIPTION NOW" : "Cancel subscription now", intent: "subscription.cancel" },
      root: "screen",
      components: [
        { id: "screen", component: "Group", children: ["chip", "oops", "actions"] },
        { id: "chip", component: "Tag", kind: "status", tone: "info", label: caps ? "PREMIUM MEMBER" : "Premium member" },
        { id: "oops", component: "Text", text: v < 3 ? "Oops! Sad to see you go 😢" : "Sorry to see you go." },
        { id: "actions", component: "ActionBar", children: ["cancel", "pause", "offer"] },
        act("cancel", caps ? "CANCEL NOW" : "Cancel now", "primary"),
        act("pause", caps ? "PAUSE INSTEAD" : "Pause instead", v >= 1 ? "secondary" : "primary"),
        act("offer", caps ? "GET 50% OFF" : "Get 50% off", v >= 1 ? "secondary" : "primary"),
      ],
    };
  }

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
    const T = window.S_T;
    const BX = window.S_BOXES;
    const tl = gsap.timeline({ paused: true });
    const scr = $("screen");
    const pink = $("pink");
    const sink = $("sink");
    const view = $("studio-view");

    // ——— The phone's screens ———
    const layerOf = (h) => {
      const d = document.createElement("div");
      d.className = "layer";
      d.appendChild(h.el);
      scr.appendChild(d);
      h.layer = d;
      return h;
    };
    const genOpts = (v) => ({ app: LOUD, asked: ASK, doc: generated(v), composer: true, home: true, crossfades: true });
    const gens = [0, 1, 2, 3].map((v) => {
      const h = layerOf(F.appScreen(genOpts(v)));
      h.tokens = X.tokenMorph(h.el);
      const a = h.el.querySelector(".answer");
      h.title = a.querySelector(".pxd-surface-title");
      h.chip = a.querySelector(".pxd-tag");
      h.text = a.querySelector(".pxd-text");
      h.buttons = Array.from(a.querySelectorAll(".pxd-button"));
      return h;
    });
    const G = gens[0];
    const team = layerOf(F.appScreen({ app: HARBOURLINE, asked: ASK, doc: window.S_CANCEL, composer: true, home: true, crossfades: true }));
    {
      const a = team.el.querySelector(".answer");
      team.partsList = [a.querySelector(".pxd-surface-title"), a.querySelector(".pxd-text"), a.querySelector("[class*=pxd-detail], dl, table"), a.querySelector(".pxd-action-bar")].filter(Boolean);
    }
    for (const h of [...gens, team]) h.el.querySelectorAll("*").forEach((n) => n.setAttribute("data-layout-allow-overlap", ""));
    const at = (el) => {
      const r = layoutRect(el, scr);
      const a = stage(r.x, r.y);
      return { x: a.x, y: a.y, w: r.w * K, h: r.h * K, cx: a.x + (r.w * K) / 2, cy: a.y + (r.h * K) / 2 };
    };

    // ——— The Studio pages: stills of the real Studio, cross-fading as it navigates ———
    const img = (src, cls, box) => {
      const i = document.createElement("img");
      i.className = cls;
      i.src = src;
      i.decoding = "sync";
      i.alt = "";
      if (box) i.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;`;
      view.insertBefore(i, sink);
      return i;
    };
    const PAGES = [
      [T.winIn - 0.01, "import-file", 0],
      [T.scan, "scan"],
      [T.map, "map"],
      [T.roles, "roles"],
      [T.tune, "edit-from"],
      [T.dlgOpen, "rb-262", 0.18],
      [T.sweepTo, "edit-to-quiet", 0.18],
      [T.comps, "comps-0"],
      [T.tog1, "comps-1", 0],
      [T.tog2, "comps-2", 0],
      [T.tog3, "comps-3", 0],
      [T.drawer, "choice-00", 0.18],
      [T.rules, "rules-0"],
      [T.rule0, "rule0-00", 0.18],
      [T.rule0Full, "rule0", 0],
      [T.saved0, "rules-1", 0.18],
      [T.drawer1, "rule1", 0.18],
      [T.saved1, "rules-2", 0.18],
      [T.drawer2, "rule2", 0.18],
      [T.saved2, "rules-3", 0.18],
      [T.author, "cancel-sel2"],
      [T.select, "cancel-sel", 0],
      [T.shell, "shell-0"],
      [T.publish, "cancel-0"],
      [T.published, "cancel-pub", 0],
    ].map(([t, name, fade]) => ({ t, name, fade: fade === undefined ? 0.22 : fade, el: img(`assets/studio/${name}.png`, "sshot") }));
    // Sequences: a crop of the part that changed, over its page.
    const pad = (b, p) => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p });
    const SEQS = [
      { page: "rb-262", from: T.sweep, to: T.sweepTo, box: BX.rb.dialog, frames: BX.rb.frames.map((h) => `rb-${h}`) },
      { page: "choice-00", from: T.guideType, to: T.guideTypeTo, box: pad(BX["choice-00"].use, 6), frames: BX.choiceSteps.map((n) => `choice-${String(n).padStart(2, "0")}`) },
      { page: "rule0-00", from: T.ruleType, to: T.ruleTypeTo, box: pad(BX["rule0-00"].name, 6), frames: BX.rule0Steps.map((n) => `rule0-${String(n).padStart(2, "0")}`) },
    ].map((q) => ({ ...q, els: q.frames.map((f) => img(`assets/studio/crop/${f}.png`, "crop", q.box)) }));

    // ——— Patches over the stills: the scan counting up, the mapping filling in ———
    const patch = (b, cls = "patch", parent = sink) => {
      const d = document.createElement("div");
      d.className = cls;
      d.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;`;
      parent.appendChild(d);
      return d;
    };
    const nums = BX.scan.nums;
    const counters = [];
    for (const n of nums) {
      const isH1 = /^We found/.test(n.text);
      const big = isH1 || parseFloat(n.size) >= 28;
      if (!big) continue;
      const d = patch({ x: n.x - 2, y: n.y - 2, w: isH1 ? n.w + 40 : 130, h: n.h + 4 }, "count");
      d.style.fontSize = n.size;
      d.style.lineHeight = `${n.h + 4}px`;
      d.style.paddingLeft = "2px";
      const total = isH1 ? parseInt(n.text.match(/\d+/)[0], 10) : parseInt(n.text, 10);
      counters.push({ el: d, total, fmt: isH1 ? (v) => `We found ${v} tokens` : (v) => String(v) });
    }
    const scanRows = patch({ x: BX.scan.table.x - 4, y: 432, w: BX.scan.table.w + 8, h: BX.scan.table.y + BX.scan.table.h - 432 });
    const mapRows = [];
    for (let i = 0; i < 14; i++) {
      const r = BX.map[`row${i}`];
      if (!r) continue;
      mapRows.push(patch({ x: 780, y: r.y + 1, w: 1216 - 780 + 4, h: r.h - 2 }));
    }
    const shellCover = patch({ x: 557, y: 196, w: 1228 - 557, h: 752 - 196 });
    shellCover.style.background = "#fbfaf7";
    // The shell drawing itself in hairlines: its regions, clipped to what the preview shows.
    const hair = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    hair.setAttribute("class", "hair");
    hair.setAttribute("viewBox", "0 0 1600 1000");
    hair.style.cssText = "position:absolute;left:0;top:0;width:1600px;height:1000px;";
    sink.appendChild(hair);
    const clipRect = (b) => {
      const x0 = Math.max(557, b.x), y0 = Math.max(196, b.y), x1 = Math.min(1228, b.x + b.w), y1 = Math.min(752, b.y + b.h);
      return { x: x0 + 3, y: y0 + 3, w: Math.max(0, x1 - x0 - 6), h: Math.max(0, y1 - y0 - 6) };
    };
    const SH = BX["shell-0"];
    const hairRects = ["appbar", "nav", "main", "outlet", "footer"].map((k, i) => {
      const b = clipRect(SH[k]);
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      for (const [a, v] of Object.entries({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 4 })) r.setAttribute(a, v);
      hair.appendChild(r);
      const len = 2 * (b.w + b.h);
      r.style.strokeDasharray = `${len}`;
      return { r, len, at: T.hair + i * ((T.hairTo - T.hair) / 5) };
    });

    // ——— Doodles (registry hw family): in the phone's pixels (pink) or the page's (sink) ———
    const add = (parent, cls, id, x, y, w, h, extra) => {
      const d = document.createElement("div");
      d.className = cls;
      d.id = id;
      d.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;` + (extra || "");
      d.innerHTML = `<svg viewBox="0 0 ${w} ${h}"></svg>`;
      parent.appendChild(d);
      return d;
    };
    const hand = (parent, id, text, x, y, size) => {
      const d = document.createElement("div");
      d.className = "hand";
      d.id = id;
      d.style.cssText = `left:${x}px;top:${y}px;font-size:${size}px;clip-path:inset(-20% 100% -30% -5%);`;
      d.textContent = text;
      parent.appendChild(d);
      return d;
    };
    const writeOn = (el, t0, dur = 0.45) => tl.fromTo(el, { clipPath: "inset(-20% 100% -30% -5%)" }, { clipPath: "inset(-20% -5% -30% -5%)", duration: dur, ease: "power1.inOut", immediateRender: false }, t0);
    const writeDur = (text) => Math.max(0.45, text.length * 0.035);
    const reveal = (el, t0) => {
      gsap.set(el, { opacity: 0 });
      tl.set(el, { opacity: 0 }, 0);
      tl.set(el, { opacity: 1 }, t0);
    };
    const fadeOff = (el, t0, dur = 0.3) => tl.to(el, { opacity: 0, duration: dur, ease: "power2.in" }, t0);
    const cvs = document.createElement("canvas").getContext("2d");
    const handW = (text, size) => {
      cvs.font = `700 ${size}px Caveat`;
      return cvs.measureText(text).width;
    };
    const callout = (parent, id, r, on, off, opts = {}) => {
      const W = opts.tight ? r.w * 1.07 : Math.max(90, (r.w / 0.84) * 1.12), H = opts.tight ? r.h * 1.4 : Math.max(70, (r.h / 0.72) * 1.2);
      const d = document.createElement("div");
      d.className = "hw-callout";
      d.id = id;
      d.style.cssText = `left:${r.x + r.w / 2 - W / 2}px;top:${r.y + r.h / 2 - H / 2}px;width:${W}px;height:${H}px;` + (opts.width ? `--co-w:${opts.width};` : "");
      d.innerHTML = `<div class="hw-co-boil"><div class="hw-co-deform"><svg viewBox="0 0 ${W} ${H}"><path class="hw-co-outline"/><path class="hw-co-scribble"/></svg></div><div class="hw-co-conn-layer"><svg viewBox="0 0 ${W} ${H}"><path class="hw-co-connector"/></svg></div><div class="hw-co-pop"><div class="hw-co-label"></div></div></div>`;
      parent.appendChild(d);
      if (opts.stroke) d.querySelectorAll(".hw-co-outline").forEach((p) => (p.style.strokeWidth = opts.stroke));
      window.hwCalloutBuild("#" + id, { scribble: false, seed: id.length * 7 + 3, label: "", labelAt: "left", strokeType: "plain", boil: "calm", connector: false });
      window.hwCalloutOn(tl, "#" + id, on);
      window.hwCalloutOff(tl, "#" + id, off);
      return d;
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
    const scribbleD = (w, h, seed) => {
      let d = `M ${4} ${h * 0.7}`;
      const n = Math.max(5, Math.round(w / 26));
      for (let i = 1; i <= n; i++) {
        const x = (w / n) * i;
        const up = i % 2 === 1;
        d += ` L ${(x + window.hwHash(i, seed) * 6).toFixed(1)} ${(up ? h * 0.12 : h * 0.88) + window.hwHash(i + 9, seed) * 5}`;
      }
      return d;
    };
    const strike = (parent, id, r, on, width = 8) => {
      const d = add(parent, "hw-mark", id, r.x - 6, r.cy - 16, r.w + 12, 32, `--hw-mark-w:${width};`);
      const svg = d.querySelector("svg");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", window.hwMarkPath(r.w + 12, 32, "strike", id.length * 3));
      svg.appendChild(p);
      window.hwMarkOn(tl, "#" + id, on, 0.3);
      reveal(d, on);
      return d;
    };
    /** A sticky note, stuck on the page, with a line written on it. */
    const sticky = (parent, id, text, x, y, size, on, off, rot = -3) => {
      const w = handW(text, size) + size * 0.9;
      const d = document.createElement("div");
      d.id = id;
      d.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${size * 1.55}px;background:#ffe58a;box-shadow:0 10px 22px rgba(20,20,19,.16);transform:rotate(${rot}deg);transform-origin:20% 50%;`;
      parent.appendChild(d);
      const n = hand(d, id + "-t", text, size * 0.45, size * 0.26, size);
      tl.fromTo(d, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out", immediateRender: false }, on);
      gsap.set(d, { opacity: 0 });
      tl.set(d, { opacity: 0 }, 0);
      writeOn(n, on + 0.18, writeDur(text));
      fadeOff(d, off, 0.3);
      return { d, doneAt: on + 0.18 + writeDur(text) };
    };

    // 1 · The tasteless screen: a circle round the three primaries, an arrow at "Oops!", a scribble
    // on the colour chip; each note written in the margin at the right of the phone.
    const bR = (() => {
      const rs = G.buttons.map(at);
      const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
      const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    })();
    const textR = at(G.text);
    const chipR = at(G.chip);
    const NOTE_X = 1392, NS = 40;
    callout(pink, "d-btns", bR, T.c1On, T.marksOff, { tight: true });
    const n1 = hand(pink, "d-btns-n", "3 primary buttons?", NOTE_X, bR.cy - 8, NS);
    writeOn(n1, T.c1Note, writeDur("3 primary buttons?"));
    fadeOff(n1, T.marksOff);
    const arrOops = add(pink, "hw-arrow", "d-oops", 1212, textR.cy - 30, NOTE_X - 1212 - 8, 52, "--hw-arrow-color:#ff6e40;--hw-arrow-w:5;");
    arrOops.querySelector("svg").style.transform = "scaleX(-1)";
    window.hwArrowBuild("#d-oops", { arrowStyle: "gentle", strokeType: "plain", boil: "calm" });
    window.hwArrowOn(tl, "#d-oops", T.a2On);
    window.hwArrowOff(tl, "#d-oops", T.marksOff);
    const n2 = hand(pink, "d-oops-n", "we'd never say that", NOTE_X, textR.cy - 30, NS);
    writeOn(n2, T.a2Note, writeDur("we'd never say that"));
    fadeOff(n2, T.marksOff);
    const scrib = add(pink, "hw-draw", "d-chip", chipR.x - 8, chipR.y - 6, chipR.w * 0.75 + 16, chipR.h + 12, "--hw-draw-w:6;");
    drawPath(scrib, scribbleD(chipR.w * 0.75 + 16, chipR.h + 12, 5), T.s3On, 0.45, "#ff6e40", 6);
    fadeOff(scrib, T.marksOff);
    const n3 = hand(pink, "d-chip-n", "not our blue", NOTE_X, chipR.cy - 88, NS);
    writeOn(n3, T.s3Note, writeDur("not our blue"));
    fadeOff(n3, T.marksOff);

    // 2 · Import: the kinds of file a design system arrives as, landing on the page.
    const drop = BX["import-file"].drop;
    const CHIPS = [
      ["npm", "@harbourline/tokens", ""],
      ["{ }", "Tokens Studio", ".json"],
      ["{ }", "DTCG", ".tokens.json"],
      ["--", "CSS variables", ".css"],
    ];
    const chipEls = CHIPS.map(([ico, label, mono], i) => {
      const d = document.createElement("div");
      d.className = "fchip";
      d.innerHTML = `<span class="ico">${ico}</span><span>${label}</span>${mono ? `<span class="mono">${mono}</span>` : ""}`;
      const col = i % 2, row = Math.floor(i / 2);
      const x = drop.x + 14 + col * (drop.w / 2);
      const y = drop.y + 6 + row * 70;
      d.style.left = `${x}px`;
      d.style.top = `${y}px`;
      sink.appendChild(d);
      return { d, at: T.chip0 + i * T.chipEvery, from: { x: 1750 + i * 40, y: y - 260 + i * 40 } , x, y };
    });

    // 3 · Mapping: contrast pairs ticked green one by one, a note on a sticky.
    const tickRows = [6, 7, 8, 9, 11, 12];
    tickRows.forEach((ri, i) => {
      const r = BX.roles[`row${ri}`];
      const tk = add(sink, "hw-draw", `d-ct${i}`, 1318, r.y + r.h / 2 - 34, 40, 36, "--hw-draw-w:7;");
      drawPath(tk, tickD(44, 40, i + 2), T.tick0 + i * T.tickEvery, 0.2, "#1f8a4c", 7);
      fadeOff(tk, T.rolesOff, 0.25);
    });
    sticky(sink, "d-pairs", "every pair measured", 960, 690, 46, T.rolesNote, T.rolesOff);

    // 4 · Tune: the contrast readout circled, "still passes".
    const tagB = BX["edit-to-quiet"].tag;
    callout(sink, "d-tag", { ...tagB, cx: tagB.x + tagB.w / 2, cy: tagB.y + tagB.h / 2 }, T.tagOn, T.tagOff);
    sticky(sink, "d-still", "still passes", tagB.x + 40, tagB.y + 58, 46, T.tagNote - 0.15, T.tagOff, 2);

    // 5 · Components: a press on each switch; Choice's guidance circled, "the generator reads this".
    const press = (id, b, t0) => {
      const d = add(sink, "hw-draw", id, b.x + b.w / 2 - 34, b.y + b.h / 2 - 34, 68, 68, "--hw-draw-w:5;");
      drawPath(d, window.hwWobbleEllipse(34, 34, 28, 28, id.length + 2, 3), t0 - 0.12, 0.2, "#ff6e40", 5);
      fadeOff(d, t0 + 0.22, 0.16);
    };
    press("d-t1", BX["comps-0"].swRating, T.tog1);
    press("d-t2", BX["comps-0"].swColorInput, T.tog2);
    press("d-t3", BX["comps-0"].swCodeInput, T.tog3);
    const useB = BX["choice-00"].use, helpB = BX["choice-00"].help;
    const guideR = { x: useB.x, y: useB.y, w: useB.w, h: helpB.y + helpB.h - useB.y };
    callout(sink, "d-guide", { ...guideR, cx: guideR.x + guideR.w / 2, cy: guideR.y + guideR.h / 2 }, T.guideOn, T.guideOff);
    sticky(sink, "d-reads", "the generator reads this", 1090, 402, 44, T.guideNote - 0.15, T.guideOff, -2);

    // 6 · Rules: each saved rule flies to the screen it fixes; a strike, the fix, a tick.
    const RULES = [
      { name: "One primary action per screen", sev: "error", targets: [G.buttons[1], G.buttons[2]], saved: T.saved0 },
      { name: "Sentence case", sev: "warning", targets: [G.title], saved: T.saved1 },
      { name: "Never say “Oops”", sev: "error", targets: [G.text], saved: T.saved2 },
    ];
    const fly = $("fly");
    RULES.forEach((r, k) => {
      r.fix = r.saved + T.fly + T.fixLag;
      r.card = document.createElement("div");
      r.card.className = "rulecard";
      r.card.innerHTML = `${F.esc(r.name)}<em class="${r.sev === "warning" ? "warn" : ""}">${r.sev}</em>`;
      fly.appendChild(r.card);
      r.targets.forEach((el, j) => {
        const s = strike(pink, `d-fix${k}${j}`, at(el), r.fix + j * 0.12, 10);
        fadeOff(s, r.fix + 0.75, 0.25);
      });
      const tr = at(r.targets[0]);
      const tk = add(pink, "hw-draw", `d-ok${k}`, 16, tr.cy - 34, 64, 58, "--hw-draw-w:11;");
      tk.style.left = `${SX - 84}px`;
      drawPath(tk, tickD(64, 58, k + 4), r.fix + 0.55, 0.25, "#ff6e40", 11);
      fadeOff(tk, T.phoneOut, 0.2);
    });
    // The row each rule is saved as, in the list, newest first (where its card lifts off).
    const rowOf = (k) => {
      const page = ["rules-1", "rules-2", "rules-3"][k];
      return BX[page].name0;
    };

    // 7 · Author: the shell's regions drawn in hairlines; an arrow at the frame, "the part that's always yours".
    const navB = clipRect(SH.nav);
    const arrShell = add(sink, "hw-arrow", "d-shell", navB.x + navB.w - 10, 560, 250, 90, "--hw-arrow-color:#ff6e40;--hw-arrow-w:6;");
    arrShell.querySelector("svg").style.transform = "scaleX(-1)";
    window.hwArrowBuild("#d-shell", { arrowStyle: "swoop", strokeType: "plain", boil: "calm" });
    window.hwArrowOn(tl, "#d-shell", T.arrowShell);
    window.hwArrowOff(tl, "#d-shell", T.shellOff);
    sticky(sink, "d-yours", "the part that's always yours", 830, 640, 42, T.shellNote - 0.15, T.shellOff, -2);

    // 8 · Publish: a press on Publish, the new status circled like a stamp.
    press("d-pub", BX["cancel-0"].publish, T.press + 0.12);
    const stB = BX["cancel-pub"].status;
    callout(sink, "d-stamp", { ...stB, cx: stB.x + stB.w / 2, cy: stB.y + stB.h / 2 }, T.stamp, T.devices + 0.2);

    // ——— Devices: the published screen, fetched by key, on a laptop and a phone ———
    const dmount = (host, density) => {
      const v = document.createElement("div");
      v.className = "dview app";
      v.setAttribute("data-pxd-theme", "harbourline");
      v.setAttribute("data-pxd-mode", "light");
      v.style.cssText = "position:absolute;inset:0;";
      v.innerHTML = `<div class="dbar"><b>H</b>Harbourline</div><div class="pad"><div></div></div>`;
      host.appendChild(v);
      window.PolyxdWeb.mount(v.querySelector(".pad > div"), { document: window.S_CANCEL, theme: "harbourline", mode: "light", density, locale: "en-GB" });
      v.querySelectorAll("*").forEach((n) => n.setAttribute("data-layout-allow-overlap", ""));
      return v;
    };
    const lview = dmount($("d-laptop").querySelector(".lview"), "comfortable");
    const pview = dmount($("d-phone").querySelector(".pview"), "compact");
    const code = $("d-code");
    const CODE = "/api/w/harbourline/screens/cancel";
    const xchips = ["CSS variables", "Tailwind theme", "Swift", "Kotlin"].map((label, i) => {
      const d = document.createElement("div");
      d.className = "xchip";
      d.textContent = label;
      $("devices").appendChild(d);
      return { d, i };
    });
    const XCHIP_X = [930, 1142, 1374, 1510];
    const flycards = [0, 1].map(() => {
      const d = document.createElement("div");
      d.className = "flycard-s";
      d.style.cssText = "position:absolute;left:0;top:0;transform-origin:0 0;opacity:0;overflow:hidden;border-radius:10px;box-shadow:0 24px 50px rgba(20,20,19,.2);";
      d.innerHTML = `<img src="assets/studio/crop/pub-preview.png" style="display:block;width:${BX.pubPreview.w}px;height:${BX.pubPreview.h}px" alt="">`;
      fly.appendChild(d);
      return d;
    });

    // ——— The turn: the screen becomes a sticky note on paper; the mark looks at it, then at us ———
    const stickyEl = $("sticky");
    $("turn-mark2").innerHTML = M.svg("s-turn-mark", 170);
    const turnMark = M.driver($("s-turn-mark"), [
      { t: T.markLook, state: "looking" },
      { t: T.markCam, state: "attention" },
    ]);
    const turnArrow = add($("turn-ink"), "hw-arrow", "d-turn", 1560, 330, 330, 120, "--hw-arrow-color:#ff6e40;--hw-arrow-w:8;");
    window.hwArrowBuild("#d-turn", { arrowStyle: "gentle", strokeType: "plain", boil: "calm" });
    window.hwArrowOn(tl, "#d-turn", T.arrowTurn);
    window.hwArrowOff(tl, "#d-turn", T.winTo - 0.2);
    // The payoff: the mark beside the phone, its pupil turning into a tick.
    $("seat").innerHTML = M.svg("s-seat-mark", 132);
    const seatMark = M.driver($("s-seat-mark"), [
      { t: T.markIn2 + 0.2, state: "looking" },
      { t: T.markChecked, state: "checked" },
    ]);

    // ——— Cameras ———
    const pose = (o) => Object.assign({ fx: PC.x, fy: PC.y, vx: PC.x, vy: PC.y, s: 1, rx: 0, ry: 0 }, o);
    const REST = pose({});
    const P = (x, y, s, vx, vy) => {
      const w = sp(x, y);
      return pose({ fx: w.x, fy: w.y, vx, vy, s });
    };
    const CAM_B = [
      [0, REST],
      [T.typeFrom, REST, "hold"],
      [T.marksOff, pose({ fy: 410, vx: 1100, vy: 500, s: 1.4 }), "sine"], // the slow push-in on the tasteless screen
      [T.tilt, pose({ fy: 410, vx: 1100, vy: 500, s: 1.4 }), "hold"],
      [T.tiltTo, pose({ fx: PC.x, fy: PC.y, vx: 1095, vy: 465, s: 0.36, rx: 16, ry: -22 }), "inout"], // tilts away, shrinks to the note
      [T.tiltTo + 0.01, REST, "cut"],
      [T.payoff, REST, "cut"],
      [T.send2 + 0.1, REST, "hold"],
      [T.parts2 + 0.4, pose({ s: 1.26, fy: 420, vy: 520 }), "brand"], // in on the team's screen as it arrives
      [T.stageOut, pose({ s: 1.34, fy: 420, vy: 520 }), "sine"],
      [T.end, pose({ s: 1.34, fy: 420, vy: 520 }), "hold"],
    ];
    const CAM_A = [
      [0, REST],
      [T.winTo, REST, "hold"],
      [T.chip0 - 0.2, P(1150, 330, 1.3, 1340, 520), "sine"], // toward the files landing
      [T.scan, P(1150, 330, 1.33, 1340, 520), "sine"],
      [T.scan + 0.5, P(760, 243, 1.36, 1370, 470), "brand"], // the scan's counts
      [T.map, P(760, 243, 1.4, 1370, 470), "sine"],
      [T.map + 0.5, P(860, 560, 1.6, 1060, 540), "brand"], // the mapping's rows
      [T.roles, P(860, 600, 1.64, 1060, 540), "sine"],
      [T.roles + 0.45, P(1250, 480, 1.5, 1150, 560), "brand"], // the contrast column
      [T.tune, P(1250, 480, 1.56, 1150, 560), "sine"],
      [T.tune + 0.5, P(846, 350, 1.25, 1330, 520), "brand"], // the ramps
      [T.dlgOpen, P(846, 350, 1.27, 1330, 520), "sine"],
      [T.dlgOpen + 0.6, P(800, 500, 1.55, 1330, 540), "brand"], // the rebrand dialog
      [T.sweepTo, P(800, 500, 1.62, 1330, 540), "sine"],
      [T.sweepTo + 0.5, P(420, 240, 1.7, 1000, 470), "brand"], // the contrast readout
      [T.pullTune, P(420, 240, 1.74, 1000, 470), "sine"],
      [T.pullTuneTo, REST, "decel"], // pull back: the screen, re-coloured
      [T.comps, REST, "hold"],
      [T.comps + 0.55, P(832, 450, 1.25, 1380, 540), "brand"], // the components
      [T.drawer, P(832, 450, 1.28, 1380, 540), "sine"],
      [T.drawer + 0.55, P(1340, 280, 1.75, 1330, 470), "brand"], // Choice's guidance
      [T.rules, P(1340, 280, 1.8, 1330, 470), "sine"],
      [T.rules + 0.5, P(900, 320, 1.1, 1330, 500), "brand"], // the rules page
      [T.rule0, P(900, 320, 1.12, 1330, 500), "sine"],
      [T.rule0 + 0.5, P(1340, 330, 1.6, 1330, 470), "brand"], // the new rule, written
      [T.saved0, P(1340, 330, 1.62, 1330, 470), "sine"],
      [T.saved0 + 0.4, P(620, 330, 1.6, 1330, 430), "brand"], // the list; the rules fly from here
      [T.pullRules, P(620, 330, 1.64, 1330, 430), "sine"],
      [T.author - 0.2, P(700, 380, 1.1, 1330, 520), "decel"],
      [T.author + 0.4, P(700, 330, 1.35, 1330, 480), "brand"], // tree and preview
      [T.shell, P(700, 330, 1.37, 1330, 480), "sine"],
      [T.shell + 0.5, P(900, 470, 1.15, 1330, 540), "brand"], // the shell
      [T.publish, P(900, 470, 1.17, 1330, 540), "sine"],
      [T.publish + 0.5, P(1096, 40, 1.7, 960, 300), "brand"], // the header: Publish
      [T.capL - 0.1, P(1096, 40, 1.72, 960, 300), "sine"],
      [T.capL + 0.5, P(1096, 60, 1.35, 1350, 320), "brand"],
      [T.end, P(1096, 60, 1.35, 1350, 320), "hold"],
    ];
    const EASES = { hold: () => 0, decel: out3, sine, inout: inOut, brand: E, cut: () => 1 };
    function camAt(CAM, t) {
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
    const camTf = (c) => `translate(${c.vx.toFixed(2)}px, ${c.vy.toFixed(2)}px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg) scale(${c.s.toFixed(4)}) translate(${(-c.fx).toFixed(2)}px, ${(-c.fy).toFixed(2)}px)`;
    const onScreen = (c, x, y) => ({ x: c.vx + c.s * (x - c.fx), y: c.vy + c.s * (y - c.fy) });
    const rigA = $("rigA"), rigB = $("rigB");

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
    const caps = ["cap-a", "cap-b", "cap-d", "cap-e", "cap-f", "cap-g", "cap-h", "cap-i", "cap-j", "cap-k", "cap-l", "cap-m"];
    for (const c of caps) {
      tl.set(`#${c} .line`, { yPercent: 115 }, 0);
      gsap.set(`#${c} .line`, { yPercent: 115 });
    }
    const showWords = (id, t0) => {
      tl.set(`#${id} .line`, { yPercent: 0 }, t0);
      wordsIn(id, t0);
    };
    showWords("cap-a", T.capA); // caption-clip-wipe
    lineOut("cap-a", T.capB - 0.05); // line-swap
    lineIn("cap-b", T.capB);
    lineOut("cap-b", T.capBOut);
    showWords("cap-d", T.capD);
    lineOut("cap-d", T.capE - 0.05);
    lineIn("cap-e", T.capE);
    lineOut("cap-e", T.capF - 0.38); // different heights: out, then in
    lineIn("cap-f", T.capF);
    lineOut("cap-f", T.capFOut);
    showWords("cap-g", T.capG);
    lineOut("cap-g", T.capGOut);
    showWords("cap-h", T.capH);
    lineOut("cap-h", T.capHOut);
    showWords("cap-i", T.capI);
    lineOut("cap-i", T.capJ - 0.38);
    lineIn("cap-j", T.capJ);
    lineOut("cap-j", T.capJOut);
    showWords("cap-k", T.capK);
    lineOut("cap-k", T.capKOut);
    showWords("cap-l", T.capL);
    lineOut("cap-l", T.capLOut);
    showWords("cap-m", T.capM);
    lineOut("cap-m", T.capMOut);

    // ——— Groups and presses (GSAP) ———
    F.hide(tl, [G.question, team.question]);
    F.inn(tl, G.question, T.send, 0.35, 10);
    F.inn(tl, team.question, T.send2, 0.35, 10);
    tl.set("#turn", { opacity: 0 }, 0);
    tl.to("#turn", { opacity: 1, duration: 0.3, ease: "power1.out" }, T.turnIn);
    tl.set("#turn", { opacity: 0 }, T.winTo + 0.05);
    tl.fromTo(["#sticky", "#turn-mark2"], { opacity: 1 }, { opacity: 0, duration: 0.4, ease: "power2.in", immediateRender: false }, T.turnOut);
    tl.fromTo("#turn-mark2", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.4, ease: E, immediateRender: false }, T.markIn);
    tl.set("#turn-mark2", { opacity: 0 }, 0);
    tl.to({ t: 0 }, { t: T.end, duration: T.end, ease: "none" }, 0);

    // ——— render(t) ———
    const managed = new Set();
    const panel = $("panel");
    const PANEL = [[T.capF - 0.15, T.capFOut + 0.15], [T.tune, T.capGOut + 0.15], [T.comps, T.capHOut + 0.15], [T.rules, T.capJOut + 0.15], [T.capK - 0.1, T.capKOut + 0.15], [T.capL - 0.1, T.devices + 0.2]];
    const devices = $("devices");
    const win = $("studio-win");
    function render(t) {
      const S = new Map();
      const set = (el, v) => {
        if (!el) return;
        managed.add(el);
        S.set(el, v);
      };

      // Cameras.
      const cA = camAt(CAM_A, t), cB = camAt(CAM_B, t);
      rigA.style.transform = camTf(cA);
      rigB.style.transform = camTf(cB);

      // Stage A: the Studio window slides in on the turn, leaves when the screen flies to the devices.
      const wIn = out3(seg(t, T.winIn, T.winTo - T.winIn));
      const wOut = E(seg(t, T.devices, 0.5));
      const winVis = t >= T.winIn && t < T.devices + 0.55;
      set(win, { o: winVis ? 1 - wOut : 0, tf: `translateX(${((1 - wIn) * 1300).toFixed(1)}px) scale(${(1 - 0.08 * wOut).toFixed(4)})`, origin: "30% 50%" });
      // The pages.
      let pi = -1;
      for (let i = 0; i < PAGES.length; i++) if (t >= PAGES[i].t) pi = i;
      PAGES.forEach((p, i) => {
        const cur = i === pi;
        const prev = i === pi - 1 && pi >= 0 && PAGES[pi].fade > 0 && t < PAGES[pi].t + PAGES[pi].fade;
        p.el.style.display = cur || prev ? "block" : "none";
        p.el.style.opacity = cur ? String(PAGES[pi].fade > 0 ? Math.round(E(seg(t, p.t, p.fade)) * 1000) / 1000 : 1) : "1";
        p.el.style.zIndex = cur ? "2" : "1";
      });
      const pageName = pi >= 0 ? PAGES[pi].name : "";
      for (const q of SEQS) {
        const k = t < q.from ? -1 : Math.min(q.els.length - 1, Math.floor(seg(t, q.from, q.to - q.from) * (q.els.length - 1) + 1e-6));
        q.els.forEach((el, i) => {
          el.style.display = pageName === q.page && i === k ? "block" : "none";
          el.style.zIndex = "3";
        });
      }
      sink.style.zIndex = "4";
      // The scan counting up; its table filling in.
      const cp = out3(seg(t, T.count, T.countTo - T.count));
      const scanning = pageName === "scan";
      for (const c of counters) {
        const v = Math.round(c.total * cp);
        const txt = c.fmt(v);
        if (c.el.textContent !== txt) c.el.textContent = txt;
        c.el.style.display = scanning && cp < 1 ? "block" : "none";
      }
      scanRows.style.display = scanning ? "block" : "none";
      scanRows.style.clipPath = `inset(${(cp * 100).toFixed(1)}% 0 0 0)`;
      // The mapping's rows filling in, one after another.
      mapRows.forEach((d, i) => {
        const n = mapRows.length;
        const k = E(seg(t, T.fill + (i * (T.fillTo - T.fill - 0.25)) / n, 0.25));
        d.style.display = pageName === "map" && k < 1 ? "block" : "none";
        d.style.clipPath = `inset(0 0 0 ${(k * 100).toFixed(1)}%)`;
      });
      // The shell: covered, drawn in hairlines, then filled in.
      const isShell = pageName === "shell-0";
      shellCover.style.display = isShell ? "block" : "none";
      shellCover.style.opacity = String(1 - E(seg(t, T.fillShell, T.fillShellTo - T.fillShell)));
      hair.style.display = isShell && t < T.fillShellTo + 0.3 ? "block" : "none";
      hair.style.opacity = String(1 - seg(t, T.fillShellTo - 0.1, 0.35));
      for (const h of hairRects) h.r.style.strokeDashoffset = String(h.len * (1 - E(seg(t, h.at, 0.35))));
      // The file chips: in from the right, landing one per beat.
      for (const c of chipEls) {
        const k = seg(t, c.at, 0.4);
        const e = E(k);
        const x = lerp(c.from.x, c.x, e), y = lerp(c.from.y, c.y, e) - Math.sin(k * Math.PI) * 40;
        const vis = pageName === "import-file" && t >= c.at;
        set(c.d, { o: vis ? Math.min(1, k * 4) : 0, tf: `translate(${(x - c.x).toFixed(1)}px, ${(y - c.y).toFixed(1)}px) rotate(${((1 - e) * 8).toFixed(2)}deg) scale(${(1.08 - 0.08 * e).toFixed(3)})` });
      }

      // The paper panel under the captions.
      let pv = 0;
      for (const [a, b] of PANEL) pv = Math.max(pv, Math.min(E(seg(t, a, 0.3)), 1 - E(seg(t, b, 0.3))));
      set(panel, { o: pv, tf: "" });

      // Stage B: the phone. Where it is, and which screen it shows.
      const smallIn = (a, d) => E(seg(t, a, d));
      let pb = { o: 0, x: 0, y: 0, s: 1 };
      const smallTf = (k, fromX) => ({ x: lerp(fromX, SMALL.x, k) - SMALL.s * PC.x, y: SMALL.y - SMALL.s * PC.y, s: SMALL.s });
      if (t >= T.stageIn && t < T.tiltTo) pb = { o: Math.min(E(seg(t, T.stageIn, 0.35)), 1 - seg(t, T.tiltTo - 0.25, 0.25)), x: 0, y: 0, s: 1 };
      else if (t >= T.pullTune && t < T.comps + 0.1) {
        const k = smallIn(T.pullTune, T.pullTuneTo - T.pullTune);
        pb = { o: Math.min(k * 1.5, 1 - seg(t, T.comps - 0.2, 0.3)), ...smallTf(k, -300) };
      } else if (t >= T.phoneIn && t < T.phoneOut + 0.3) {
        const k = smallIn(T.phoneIn, 0.45);
        pb = { o: Math.min(k * 1.5, 1 - seg(t, T.phoneOut, 0.3)), ...smallTf(k, -300) };
      } else if (t >= T.payoff - 0.3) pb = { o: Math.min(E(seg(t, T.payoff - 0.3, 0.35)), 1 - seg(t, T.stageOut, 0.3)), x: 0, y: 0, s: 1 };
      set($("phonebox"), { o: pb.o, tf: `translate(${pb.x.toFixed(2)}px, ${pb.y.toFixed(2)}px) scale(${pb.s.toFixed(4)})`, origin: "0 0" });

      // The generated screen: typed, sent, assembled fast; its variants as each rule lands.
      F.converse(G, t, { text: ASK, typeFrom: T.typeFrom, sendAt: T.send });
      F.converse(team, t, { text: ASK, typeFrom: T.typeFrom2, sendAt: T.send2 });
      const gParts = [G.title, G.chip, G.text, ...G.buttons];
      gParts.forEach((el, i) => {
        const k = E(seg(t, T.parts + i * T.partsEvery, 0.22));
        set(el, k >= 1 ? { o: "", tf: "" } : { o: k, tf: `translateY(${((1 - k) * 14).toFixed(2)}px) scale(${(0.96 + 0.04 * k).toFixed(3)})` });
      });
      // Theme: loud until the tune pull-back re-colours it (every alias following the brand ramp).
      const rp = seg(t, T.recolour, T.recolourTo - T.recolour);
      const state = rp <= 0 ? { theme: "loud" } : rp >= 1 ? { theme: "harbourline" } : { from: "loud", to: "harbourline", p: inOut(rp) };
      for (const h of gens) h.tokens(state);
      let gv = 0, gk = 1;
      RULES.forEach((r, k) => {
        if (t >= r.fix + 0.4) {
          gv = k + 1;
          gk = E(seg(t, r.fix + 0.4, 0.3));
        }
      });
      const onTeam = t >= T.payoff - 0.3;
      gens.forEach((h, v) => {
        let o = 0;
        if (!onTeam) {
          if (v === gv) o = 1;
          else if (v === gv - 1 && gk < 1) o = 1;
        }
        set(h.layer, { o, tf: "" });
        h.layer.style.zIndex = v === gv ? "2" : "1";
      });
      if (gv > 0 && gk < 1 && !onTeam) set(gens[gv].layer, { o: gk, tf: "" });
      set(team.layer, { o: onTeam ? 1 : 0, tf: "" });
      team.partsList.forEach((el, i) => {
        const k = E(seg(t, T.parts2 + i * T.parts2Every, 0.45));
        set(el, k >= 1 ? { o: "", tf: "" } : { o: k, tf: `translateY(${((1 - k) * 12).toFixed(2)}px)` });
      });
      set($("seat"), { o: E(seg(t, T.markIn2, 0.45)) * (1 - seg(t, T.stageOut, 0.3)), tf: `translateX(${((1 - E(seg(t, T.markIn2, 0.45))) * 60).toFixed(1)}px)` });

      // The saved rules, flying from the list to the screen they fix.
      RULES.forEach((r, k) => {
        const k0 = r.saved + 0.05, k1 = r.saved + T.fly;
        const p = seg(t, k0, k1 - k0);
        const vis = t >= k0 && t < k1 + 0.25;
        if (!vis) {
          set(r.card, { o: 0, tf: "" });
          return;
        }
        const rb = rowOf(k);
        const from = onScreen(cA, sp(rb.x, rb.y).x, sp(rb.x, rb.y).y + rb.h * WK * 0.5);
        const tgt = at(r.targets[0]);
        const phoneX = (x) => SMALL.x + SMALL.s * (x - PC.x), phoneY = (y) => SMALL.y + SMALL.s * (y - PC.y);
        const to = { x: phoneX(tgt.x), y: phoneY(tgt.cy) };
        const e = inOut(p);
        const x = lerp(from.x, to.x, e), y = lerp(from.y, to.y, e) - Math.sin(p * Math.PI) * 120;
        const sc = lerp(1, 0.55, e);
        const o = t < k1 ? Math.min(1, p * 5) : 1 - seg(t, k1, 0.25);
        set(r.card, { o, tf: `translate(${x.toFixed(1)}px, ${(y - 24).toFixed(1)}px) scale(${sc.toFixed(3)}) rotate(${(Math.sin(p * Math.PI) * -4).toFixed(2)}deg)`, origin: "0 50%" });
      });

      // The turn: the sticky note, the mark.
      turnMark(t);
      seatMark(t);

      // Devices: the preview lifts off the page and lands on a laptop and a phone.
      const dv = Math.min(E(seg(t, T.devices, 0.4)), 1 - E(seg(t, T.pubOut, 0.3)));
      set(devices, { o: t >= T.devices && t < T.pubOut + 0.35 ? dv : 0, tf: "" });
      const pv0 = BX.pubPreview;
      const fromPt = onScreen(cA, sp(pv0.x, pv0.y).x, sp(pv0.x, pv0.y).y);
      const fromS = cA.s * WK;
      const DEST = [
        { x: 942, y: 262 + 54 * 0.65, w: 676 },
        { x: 1667, y: 307 + 54 * 0.5026, w: 196 },
      ];
      flycards.forEach((d, i) => {
        const a = T.devices + i * 0.1;
        const p = seg(t, a, T.flyTo - T.devices);
        const e = inOut(p);
        const dest = DEST[i];
        const s1 = dest.w / pv0.w;
        const x = lerp(fromPt.x, dest.x, e), y = lerp(fromPt.y, dest.y, e) - Math.sin(p * Math.PI) * 60;
        const s = lerp(fromS, s1, e);
        const o = t < a ? 0 : p < 1 ? 1 : 1 - seg(t, a + (T.flyTo - T.devices), 0.3);
        set(d, { o, tf: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)})`, origin: "0 0" });
      });
      const land = E(seg(t, T.flyTo - 0.05, 0.35));
      set(lview, { o: land, tf: "" });
      set(pview, { o: land, tf: "" });
      const n = Math.round(seg(t, T.code, T.codeTo - T.code) * CODE.length);
      const ctext = `<span class="verb">GET</span> ${F.esc(CODE.slice(0, n))}`;
      if (code.dataset.n !== String(n)) {
        code.innerHTML = ctext;
        code.dataset.n = String(n);
      }
      set(code, { o: t >= T.code ? 1 : 0, tf: "" });
      for (const c of xchips) {
        const a = T.chips + c.i * T.chipsEvery;
        const k = E(seg(t, a, 0.4));
        const x0 = 1180, y0 = 860;
        const x = lerp(x0, XCHIP_X[c.i], k), y = lerp(y0, 866 + (c.i % 2) * 6, k);
        set(c.d, { o: t >= a ? Math.min(1, seg(t, a, 0.12)) : 0, tf: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${((c.i - 1.5) * 3 * k).toFixed(2)}deg)`, origin: "50% 50%" });
      }

      for (const el of managed) {
        const v = S.get(el) || { o: "", tf: "" };
        el.style.opacity = v.o === "" ? "" : String(Math.round(v.o * 1000) / 1000);
        el.style.transform = v.tf || "";
        el.style.transformOrigin = v.origin || "";
      }
    }
    if (tl.__hwRenders) tl.__hwRenders.unshift(() => render(tl.time()));
    else window.hwOnUpdate(tl, () => render(tl.time()));
    render(0);
    window.__renderS = render;
    return tl;
  }

  window.buildFilmS = build;
})();
