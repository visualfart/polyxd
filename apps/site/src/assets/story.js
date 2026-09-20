/**
 * Landing page motion. One interface plays every part. On load it is asked for, sketched in
 * pencil, and takes form as its design system's tokens arrive. Then, pinned, each chapter plays
 * as you scroll: it lifts into its layers, is torn down and rebuilt by other design systems, is
 * read and pressed by an agent, goes and comes back, and is stamped.
 *
 * Motion is decoration only. The page is complete without this file, and the `motion` class
 * (set in index.html) is absent when the visitor asks for reduced motion, so nothing here runs.
 * That matches the rule the spec puts on generated surfaces: a reduced-motion preference
 * outranks the company's taste.
 */
(() => {
  const root = document.documentElement;
  const { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, Lenis } = window;
  if (!root.classList.contains("motion") || !gsap || !ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);
  root.dataset.motionReady = "true"; // Tells index.html's fallback timer that motion took over.

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- Smooth scroll ----------

  let lenis = null;
  if (Lenis) {
    lenis = new Lenis({ autoRaf: false, duration: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollTo = (target, offset = 0) => (lenis ? lenis.scrollTo(target, { offset }) : window.scrollTo({ top: typeof target === "number" ? target : target.offsetTop + offset }));

  // ---------- The cast ----------

  const acts = $$(".act");
  const rail = $$(".rail a");
  const scene = $(".scene");
  const slot = $(".slot");
  const stack = $(".stack");
  const stage = $(".scene .stage");
  const card = $(".scene .card");
  const parts = $$(":scope > *", card);
  const send = $(".b1", card);
  const plates = $$(".plate", stack);
  const packs = $$(".packname span");
  const hud = Object.fromEntries($$(".hud i").map((el) => [el.dataset.hud, el]));
  const askChars = new SplitText($(".ask-text"), { type: "chars" }).chars;
  const chips = $$(".chip");
  const leaders = $(".leaders");

  // ---------- Pencil: the card drawn by hand, from its real geometry ----------

  const NS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs, text) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text != null) el.textContent = text;
    return el;
  };
  const sketch = $(".sketch");
  const rel = (el, base) => {
    const r = el.getBoundingClientRect();
    const b = base.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
  };
  /** A rectangle as a pencil would draw it: slightly overshot corners, two passes. */
  const hand = (r, rx) => {
    const { x, y, w, h } = r;
    const j = () => (Math.random() - 0.5) * 2.2;
    const d = `M${x + rx + j()} ${y + j()} L${x + w - rx + j()} ${y + j()} Q${x + w} ${y} ${x + w + j()} ${y + rx + j()} L${x + w + j()} ${y + h - rx + j()} Q${x + w} ${y + h} ${x + w - rx + j()} ${y + h + j()} L${x + rx + j()} ${y + h + j()} Q${x} ${y + h} ${x + j()} ${y + h - rx + j()} L${x + j()} ${y + rx + j()} Q${x} ${y} ${x + rx + 3 + j()} ${y + j()}`;
    return [svg("path", { class: "stroke", d }), svg("path", { class: "stroke faint", d, transform: "translate(1.2 0.9)" })];
  };
  const line = (x1, y1, x2, y2, cls = "stroke") => svg("path", { class: cls, d: `M${x1} ${y1} L${x2 + (Math.random() - 0.5) * 3} ${y2 + (Math.random() - 0.5) * 2}` });
  /** Redraws the sketch over the card as it is right now, in whatever pack it wears. */
  function drawSketch() {
    sketch.replaceChildren(svg("defs", {}));
    $(".sketch defs").innerHTML = '<filter id="pencil" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter>';
    const g = svg("g", { filter: "url(#pencil)" });
    const c = rel(card, slot);
    hand(c, 20).forEach((p) => g.append(p));
    const t = rel($(".t", card), slot);
    g.append(line(t.x, t.y + t.h * 0.7, t.x + t.w * 0.72, t.y + t.h * 0.7));
    const d = rel($(".d", card), slot);
    g.append(line(d.x, d.y + d.h * 0.35, d.x + d.w, d.y + d.h * 0.35), line(d.x, d.y + d.h * 0.8, d.x + d.w * 0.76, d.y + d.h * 0.8));
    $$(".row", card).forEach((row) => {
      const r = rel(row, slot);
      g.append(line(r.x, r.y + r.h, r.x + r.w, r.y + r.h), line(r.x, r.y + r.h / 2, r.x + 26, r.y + r.h / 2, "stroke faint"), line(r.x + r.w - 40, r.y + r.h / 2, r.x + r.w, r.y + r.h / 2, "stroke faint"));
    });
    $$(".b", card).forEach((b, i) => {
      const r = rel(b, slot);
      hand(r, Math.min(r.h / 2, parseFloat(getComputedStyle(b).borderRadius) || 0)).forEach((p) => g.append(p));
      if (i === 1) for (let k = 6; k < r.w - 4; k += 11) g.append(line(r.x + k, r.y + r.h - 3, r.x + k + 9, r.y + 3, "stroke faint"));
    });
    sketch.append(g);
    // Handwritten notes, the way a designer would annotate a sketch.
    const note = (x, y, text, rot = -2) => svg("text", { class: "note", x, y, transform: `rotate(${rot} ${x} ${y})` }, text);
    sketch.append(note(c.x + 4, c.y - 10, "confirm · consequential"), note(t.x + t.w * 0.78, t.y + t.h * 0.75, "title", 0), note(c.x + c.w * 0.3, c.y + c.h + 18, "2 actions, 1 primary →", 1));
  }

  // ---------- Tokens arriving: where each chip starts and where it lands ----------

  const chipTarget = (chip) => {
    const c = rel(card, scene);
    const b = rel(send, scene);
    const t = rel($(".t", card), scene);
    switch (chip.dataset.target) {
      case "b1": return chip.dataset.from === "left" ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : { x: b.x + b.w, y: b.y };
      case "t": return { x: t.x + t.w * 0.5, y: t.y + t.h * 0.5 };
      case "corner": return { x: c.x + 6, y: c.y + c.h - 6 };
      case "edge": return { x: c.x + c.w, y: c.y + c.h / 2 };
      default: return { x: c.x + c.w * 0.3, y: c.y + c.h * 0.55 };
    }
  };
  const chipStart = (chip) => {
    const s = scene.getBoundingClientRect();
    const i = chips.indexOf(chip);
    return { left: { x: -60, y: 80 + i * 60 }, right: { x: s.width + 60, y: 60 + i * 60 }, top: { x: 120 + i * 90, y: -50 }, bottom: { x: 100 + i * 80, y: s.height + 50 } }[chip.dataset.from];
  };
  /** The on-load arrival: each chip flies in along a dotted leader that draws itself. */
  function arrivals() {
    leaders.replaceChildren();
    const tl = gsap.timeline();
    chips.forEach((chip, i) => {
      const from = chipStart(chip);
      const to = chipTarget(chip);
      const cx = (from.x + to.x) / 2 + (to.y - from.y) * 0.2;
      const cy = (from.y + to.y) / 2 - (to.x - from.x) * 0.2;
      const path = svg("path", { d: `M${from.x} ${from.y} Q${cx} ${cy} ${to.x} ${to.y}` });
      const dot = svg("circle", { cx: to.x, cy: to.y, r: 3 });
      leaders.append(path, dot);
      gsap.set(chip, { x: from.x, y: from.y, xPercent: -50, yPercent: -50, opacity: 0 });
      gsap.set(dot, { opacity: 0 });
      const at = i * 0.16;
      tl.to(chip, { opacity: 1, duration: 0.15 }, at)
        .fromTo(path, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power2.inOut" }, at)
        .to(chip, { x: to.x, y: to.y, duration: 0.7, ease: "power2.inOut" }, at)
        .to(dot, { opacity: 1, duration: 0.1 }, at + 0.65)
        .to(chip, { scale: 0.9, duration: 0.15 }, at + 0.7);
    });
    return tl;
  }

  // ---------- On load: asked for, sketched, tokens arrive, it takes form, it comes forward ----------

  gsap.set(".ask", { opacity: 0, y: -8 });
  gsap.set(card, { opacity: 0 });
  gsap.set(parts, { opacity: 0, y: 8 });
  gsap.set(stage, { opacity: 0, scale: 0.98 });
  const first = acts[0];
  // The words and the request first; the drawing is measured and built only once the page
  // has settled, so the pencil follows the card's real geometry at this viewport.
  const intro = gsap.timeline();
  intro
    .to($(".badge", first), { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" })
    .from(new SplitText($("h1", first), { type: "words" }).words, { opacity: 0, y: 18, duration: 0.6, stagger: 0.025, ease: "power3.out" }, 0.05)
    .to([$(".lede", first), $(".cta-row", first)], { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }, 0.3)
    .to(".ask", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 0.4)
    .from(askChars, { opacity: 0, duration: 0.01, stagger: 0.035 }, 0.55)
    // Fonts first if they are quick; the drawing is redrawn from real geometry anyway.
    .call(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 700))]).then(drawing), [], 1.3);
  function drawing() {
    drawSketch();
    const strokes = $$(".sketch .stroke");
    const notes = $$(".sketch .note");
    gsap.set(strokes, { drawSVG: "0%" });
    gsap.set(notes, { opacity: 0 });
    gsap
      .timeline()
      // 2 · a hand sketches it
      .to(".sketch", { opacity: 1, duration: 0.2 }, 0)
      .to(strokes, { drawSVG: "100%", duration: 0.5, stagger: 0.045, ease: "power1.inOut" }, 0)
      .to(notes, { opacity: 0.85, duration: 0.3, stagger: 0.15 }, 1.1)
      // 3 · tokens arrive from everywhere
      .add(arrivals(), 1.5)
      // 4 · it takes form
      .to(stage, { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, 2.6)
      .to(card, { opacity: 1, duration: 0.5 }, 2.65)
      .to(parts, { opacity: 1, y: 0, duration: 0.45, stagger: 0.09, ease: "power2.out" }, 2.75)
      .to(strokes, { opacity: 0.16, duration: 0.6 }, 2.8)
      .to(notes, { opacity: 0, duration: 0.3 }, 2.8)
      .to([".chips", ".leaders"], { opacity: 0, duration: 0.4 }, 3.05)
      .call(() => setHud({ pack: "material3", axe: "0 violations" }), [], 3.3)
      // 5 · it comes to you
      .to(slot, { scale: 1.05, duration: 0.5, ease: "power2.out" }, 3.4)
      .to(stage, { boxShadow: "0 40px 100px rgba(20,20,20,.28), 0 0 60px rgba(255,90,31,.16)", duration: 0.5 }, 3.4)
      .to(slot, { scale: 1, duration: 0.6, ease: "power2.inOut" }, 4.3)
      .to(stage, { boxShadow: "0 24px 60px rgba(20,20,20,.16), 0 0 0 1px rgba(20,20,20,.04)", duration: 0.6 }, 4.3)
      .to(".sketch", { opacity: 0, duration: 0.4 }, 4.3)
      .to($(".scroll-hint", first), { opacity: 1, y: 0, duration: 0.5 }, 3.9);
  }

  // ---------- The readout ----------

  const setHud = (vals) => {
    for (const [k, v] of Object.entries(vals)) if (hud[k] && hud[k].textContent !== v) hud[k].textContent = v;
    for (const [, el] of Object.entries(hud)) el.toggleAttribute("data-live", /✓|0 /.test(el.textContent));
  };

  // ---------- Scrolling: one chapter per viewport, Build gets two ----------

  const START = [0, 1, 2, 4, 5, 6];
  const TOTAL = 7;
  const SEQUENCE = ["material3", "carbon", "govuk", "shadcn", "polaris", "material3"].filter((k) => packs.some((p) => p.dataset.pack === k));
  const setPack = (key) => {
    stage.dataset.pxdTheme = key;
    const i = packs.findIndex((p) => p.dataset.pack === key);
    packs.forEach((el) => (el.style.transform = `translateY(${-i * 100}%)`));
    setHud({ pack: key });
    // The tokens plate reads the pack's real values off the card.
    const cs = getComputedStyle(card);
    const bs = getComputedStyle(send);
    const val = (n) => cs.getPropertyValue(n).trim();
    $('[data-token="primary"]').style.background = bs.backgroundColor;
    $('[data-token="secondary"]').style.background = getComputedStyle($(".b2", card)).backgroundColor;
    $('[data-token="surface"]').style.background = cs.backgroundColor;
    $('[data-token="border"]').style.background = cs.borderColor;
    $('[data-token="type"]').textContent = `${val("--pxd-type-title-section-family").split(",")[0].replace(/"/g, "")} ${val("--pxd-type-title-section-size")} / ${val("--pxd-type-title-section-line-height")}`;
    $('[data-token="metrics"]').textContent = `radius ${val("--pxd-radius-large")} · inset ${val("--pxd-space-inset-comfortable")} · target ${val("--pxd-size-target-min")}`;
  };
  setPack("material3");
  setHud({ pack: "—" });
  const toSend = (axis) => () => {
    const s = send.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    return axis === "x" ? s.left + s.width / 2 - b.left : s.top + s.height / 2 - b.top - b.height;
  };

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".story",
      start: "top top",
      end: `+=${TOTAL * 100}%`,
      pin: ".story-pin",
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const t = self.progress * TOTAL;
        const i = Math.max(0, START.findLastIndex((s) => t >= s));
        rail.forEach((a, k) => (k === i ? a.setAttribute("aria-current", "step") : a.removeAttribute("aria-current")));
      },
    },
  });

  // Words cross-fade at each boundary; the scene changes just after.
  acts.forEach((act, i) => {
    if (i === 0) return;
    const at = START[i];
    tl.to(acts[i - 1], { opacity: 0, y: -14, duration: 0.2, ease: "power1.in" }, at - 0.2);
    tl.fromTo(act, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, at);
    tl.set($$(":scope > *", act), { opacity: 1, y: 0 }, at - 0.2);
  });

  // The readout follows the playhead, so it is right in both directions.
  const READ = [[0, { agent: "—" }], [3.9, { agent: "pressing…" }], [3.92, { agent: "✓ done" }], [6.15, { axe: "0 violations" }], [6.45, { agent: "✓ 1/1 tasks" }]];
  const state = { t: 0 };
  tl.to(state, { t: TOTAL, duration: TOTAL, ease: "none", onUpdate: () => { const now = {}; for (const [at, v] of READ) if (state.t >= at) Object.assign(now, v); setHud(now); } }, 0);

  // Chapter 1, Mean: the card lifts into its layers, an exploded view. Smaller stages lift a
  // smaller stack, so the projection stays inside the scene.
  const SPREAD = 78;
  const lift = () => Math.min(1, (scene.getBoundingClientRect().width - 40) / 640);
  // The angles and scale live on a plain object; the stylesheet applies them in the right order.
  const view = { rx: 0, rz: 0, s: 1 };
  const applyView = () => {
    stack.style.setProperty("--rx", `${view.rx}deg`);
    stack.style.setProperty("--rz", `${view.rz}deg`);
    stack.style.setProperty("--s", String(view.s));
  };
  applyView();
  gsap.set(slot, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
  tl.to(".ask", { opacity: 0, y: -10, duration: 0.2 }, 1)
    .set(stack, { className: "stack is-lifted" }, 1.05)
    .to(view, { rx: 58, rz: -42, s: lift, duration: 0.6, ease: "power2.inOut", onUpdate: applyView }, 1.1)
    .to(slot, { y: () => 90 * lift(), duration: 0.6, ease: "power2.inOut" }, 1.1) // the lift rises; keep it centred
    .to(plates, { opacity: 1, duration: 0.3, stagger: 0.05 }, 1.2)
    .to(plates[0], { z: 0, duration: 0.6, ease: "power2.inOut" }, 1.1)
    .to(plates[1], { z: SPREAD, duration: 0.6, ease: "power2.inOut" }, 1.1)
    .to(plates[2], { z: SPREAD * 2, duration: 0.6, ease: "power2.inOut" }, 1.1)
    .to(stage, { z: SPREAD * 3, duration: 0.6, ease: "power2.inOut" }, 1.1)
    .to(plates[3], { z: SPREAD * 4, duration: 0.6, ease: "power2.inOut" }, 1.1)
    .to(".layers li", { opacity: 1, x: 0, duration: 0.25, stagger: 0.06 }, 1.45)
    .to(".layers li", { opacity: 0, duration: 0.15 }, 1.75)
    .to([...plates, stage], { z: 0, duration: 0.45, ease: "power2.inOut" }, 1.8)
    .to(plates, { opacity: 0, duration: 0.25 }, 1.85)
    .to(view, { rx: 0, rz: 0, s: 1, duration: 0.45, ease: "power2.inOut", onUpdate: applyView }, 1.8)
    .to(slot, { y: 0, duration: 0.45, ease: "power2.inOut" }, 1.8)
    .set(stack, { className: "stack" }, 2.3);

  // Chapter 2, Build: torn back to pencil, rebuilt from the next design system's tokens.
  tl.to(".packname", { opacity: 1, duration: 0.2 }, 2.35);
  const STEP = 1.55 / (SEQUENCE.length - 1);
  SEQUENCE.forEach((key, i) => {
    if (i === 0) return;
    const at = 2.4 + (i - 1) * STEP;
    tl.call(() => { drawSketch(); gsap.set(".sketch .stroke", { drawSVG: "100%", opacity: 1 }); gsap.set(".sketch .note", { opacity: 0 }); }, [], at)
      .to(".sketch", { opacity: 1, duration: STEP * 0.2 }, at)
      .to(parts, { opacity: 0, y: -6, duration: STEP * 0.25, stagger: STEP * 0.03, ease: "power1.in" }, at + STEP * 0.1)
      .to(stage, { opacity: 0, duration: STEP * 0.2 }, at + STEP * 0.25)
      .call(setPack, [key], at + STEP * 0.5)
      .call(setPack, [SEQUENCE[i - 1]], at + STEP * 0.5 - 0.001) // scrolling back up rebuilds the previous one
      .to(stage, { opacity: 1, duration: STEP * 0.2 }, at + STEP * 0.55)
      .to(parts, { opacity: 1, y: 0, duration: STEP * 0.25, stagger: STEP * 0.04, ease: "power2.out" }, at + STEP * 0.6)
      .to(".sketch", { opacity: 0, duration: STEP * 0.2 }, at + STEP * 0.75);
  });
  tl.to(".packname", { opacity: 0, duration: 0.15 }, 3.95);

  // Chapter 3, Use: the tree a screen reader hears, and an agent pressing by name.
  tl.to(slot, { y: () => -Math.min(96, $(".tree").offsetHeight * 0.5), duration: 0.35, ease: "power2.inOut" }, 4.05)
    .to(".tree", { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 4.15)
    .to(".cursor", { opacity: 1, duration: 0.1 }, 4.45)
    .to(".cursor", { x: toSend("x"), y: toSend("y"), duration: 0.35, ease: "power2.inOut" }, 4.5)
    .to(send, { scale: 0.94, duration: 0.06 }, 4.86)
    .to(send, { scale: 1, duration: 0.08 }, 4.92)
    .to(".agent-line", { opacity: 1, duration: 0.12 }, 4.9)
    .to([".tree", ".cursor"], { opacity: 0, duration: 0.15 }, 5.0)
    .to(slot, { y: 0, duration: 0.3, ease: "power2.inOut" }, 5.02);

  // Chapter 4, Return: gone on Monday, back on Friday, in exactly the same place.
  tl.to('[data-when="monday"]', { opacity: 1, duration: 0.1 }, 5.1)
    .to(".ghost", { opacity: 1, duration: 0.25 }, 5.2)
    .to(stage, { opacity: 0, scale: 0.98, duration: 0.25 }, 5.3)
    .to('[data-when="monday"]', { opacity: 0, duration: 0.08 }, 5.55)
    .to('[data-when="friday"]', { opacity: 1, duration: 0.1 }, 5.6)
    .to(stage, { opacity: 1, scale: 1, duration: 0.25 }, 5.62)
    .to(".same li", { opacity: 1, y: 0, duration: 0.15, stagger: 0.05 }, 5.7)
    .to([".ghost", '[data-when="friday"]', ".same li"], { opacity: 0, duration: 0.15 }, 6.0);

  // Chapter 5, Verify: the checks land on it.
  tl.fromTo(".stamp", { opacity: 0, scale: 1.7 }, { opacity: 1, scale: 1, duration: 0.2, stagger: 0.14, ease: "back.out(2.2)" }, 6.15).to({}, { duration: 0.25 }, TOTAL - 0.25);

  // Chapters are places you can go to.
  rail.forEach((a, i) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const st = tl.scrollTrigger;
      scrollTo(st.start + (START[i] / TOTAL) * (st.end - st.start) + 2);
    });
  });
  document.addEventListener("click", (e) => {
    const link = e.target.closest?.('a[href^="#"]:not(.skip):not(.rail a)');
    const target = link && document.querySelector(link.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    scrollTo(target, -24);
    history.pushState(null, "", link.getAttribute("href"));
  });

  // ---------- After the story ----------

  const reveal = (targets, trigger, vars = {}) =>
    gsap.to(targets, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out", scrollTrigger: { trigger, start: "top 85%", once: true }, ...vars });
  reveal(".studio-words > *", ".studio", { stagger: 0.08 });
  reveal(".studio-shell", ".studio", { delay: 0.15 });
  // Studio: the flag and the rule suggestion arrive a beat after the screen does.
  gsap.timeline({ scrollTrigger: { trigger: ".studio-shell", start: "top 60%", once: true } })
    .fromTo(".st-flagline mark", { backgroundColor: "rgba(255,90,31,0)" }, { backgroundColor: "rgba(255,90,31,.28)", duration: 0.4 }, 0.6)
    .fromTo([".st-flagline .st-pin", ".st-flag"], { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, 0.8)
    .fromTo(".st-suggest", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35 }, 1.4);

  // The row of built scenarios drifts by, then repeats: its contents are cloned once so the
  // loop has no seam, and it travels one row's width per cycle at a fixed speed.
  const row = $(".specimens");
  if (row) {
    const width = row.scrollWidth;
    row.append(...$$(":scope > *", row).map((li) => li.cloneNode(true)));
    row.style.setProperty("--drift", `${width}px`);
    row.style.setProperty("--drift-time", `${width / 38}s`);
  }
  reveal(".built-head > *", ".built-head", { stagger: 0.08 });
  reveal(".stat", ".proof", { stagger: 0.07 });
  reveal(".cta > div", ".cta");
  reveal(".waitlist", ".cta");
  // Counts tick up, because the numbers are the argument.
  $$(".stat dd").forEach((dd) => {
    const [, n, rest] = /^(\d+)(.*)$/.exec(dd.textContent.trim()) ?? [];
    if (!n) return;
    const count = { v: 0 };
    gsap.to(count, { v: Number(n), duration: 1.1, ease: "power2.out", scrollTrigger: { trigger: dd, start: "top 90%", once: true }, onUpdate: () => (dd.textContent = Math.round(count.v) + rest) });
  });
})();
