/**
 * Landing page motion. One interface plays every part: on load it is asked for and assembles;
 * then, pinned, each act plays as you scroll. It is taken apart into its meaning, torn down to
 * a blueprint and rebuilt by one design system after another, read and pressed by an agent,
 * forgotten and recognised, and stamped.
 *
 * Motion is decoration only. The page is complete without this file, and the `motion` class
 * (set in index.html) is absent when the visitor asks for reduced motion, so nothing here runs.
 * That matches the rule the spec puts on generated surfaces: a reduced-motion preference
 * outranks the company's taste.
 */
(() => {
  const root = document.documentElement;
  const { gsap, ScrollTrigger, SplitText, Lenis } = window;
  if (!root.classList.contains("motion") || !gsap || !ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger, SplitText);
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
  const slot = $(".slot");
  const stage = $(".stage");
  const card = $(".card");
  const parts = $$(".card > .t, .card > .d, .card > .sum, .card > .acts-row");
  const tags = $$(".scene .tag");
  const send = $(".card .b1");
  const packs = $$(".packname span");
  const hud = Object.fromEntries($$(".hud i").map((el) => [el.dataset.hud, el]));
  const askChars = new SplitText($(".ask-text"), { type: "chars" }).chars;

  // ---------- The blueprint: the card measured, part by part ----------

  const wire = $(".wire");
  const NS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  /** Redraws the outlines from the card's current geometry, so they fit whatever pack it wears. */
  function drawWire() {
    const base = slot.getBoundingClientRect();
    wire.replaceChildren();
    const box = (el, cls) => {
      const r = el.getBoundingClientRect();
      wire.append(svg("rect", { class: cls, x: r.left - base.left, y: r.top - base.top, width: r.width, height: r.height, rx: 2 }));
      return r;
    };
    const c = box(card, "outer");
    $$(".t, .d, .row, .b", card).forEach((el) => box(el, "box"));
    // Dimensions, the way a drawing would carry them.
    const x0 = c.left - base.left;
    const y0 = c.top - base.top;
    wire.append(svg("line", { x1: x0, y1: y0 - 10, x2: x0 + c.width, y2: y0 - 10 }));
    wire.append(svg("line", { x1: x0 + c.width + 10, y1: y0, x2: x0 + c.width + 10, y2: y0 + c.height }));
    const w = svg("text", { x: x0 + c.width / 2, y: y0 - 15, "text-anchor": "middle" });
    w.textContent = `${Math.round(c.width)} × ${Math.round(c.height)}`;
    const t = svg("text", { x: x0 + c.width + 16, y: y0 + c.height / 2, "text-anchor": "start", transform: `rotate(90 ${x0 + c.width + 16} ${y0 + c.height / 2})` });
    t.textContent = `target ≥ ${Math.round(send.getBoundingClientRect().height)}`;
    wire.append(w, t);
  }

  // ---------- On load: asked for, then built ----------

  gsap.set(".ask", { opacity: 0, y: -8 });
  gsap.set(card, { opacity: 0, scale: 0.96 });
  gsap.set(parts, { opacity: 0, y: 10 });
  const first = acts[0];
  gsap
    .timeline({ onComplete: drawWire })
    .to($(".badge", first), { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" })
    .from(new SplitText($("h1", first), { type: "words" }).words, { opacity: 0, y: 18, duration: 0.6, stagger: 0.025, ease: "power3.out" }, 0.05)
    .to([$(".lede", first), $(".cta-row", first)], { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }, 0.3)
    .to(".ask", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 0.45)
    .from(askChars, { opacity: 0, duration: 0.01, stagger: 0.035 }, 0.6)
    .to(card, { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" }, ">")
    .to(parts, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: "power2.out" }, "<0.2")
    .to($(".scroll-hint", first), { opacity: 1, y: 0, duration: 0.5 }, ">");

  // ---------- Scrolling ----------

  // Where each act starts, in viewports of scroll. Rebuilding gets two: it has the most to show.
  const START = [0, 1, 2, 4, 5, 6];
  const TOTAL = 7;
  // The packs the card is rebuilt in, in order. It starts and ends in the first one.
  const SEQUENCE = ["material3", "carbon", "govuk", "shadcn", "spectrum", "polaris", "fluent", "material3"].filter((k) => packs.some((p) => p.dataset.pack === k));
  const setPack = (key) => {
    stage.dataset.pxdTheme = key;
    const i = packs.findIndex((p) => p.dataset.pack === key);
    packs.forEach((el) => (el.style.transform = `translateY(${-i * 100}%)`));
    hud.pack.textContent = key;
  };
  // Where the agent's cursor has to travel: from its resting corner to the middle of "Send".
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
      onRefresh: drawWire,
      onUpdate: (self) => {
        const t = self.progress * TOTAL;
        const i = Math.max(0, START.findLastIndex((s) => t >= s));
        rail.forEach((a, k) => (k === i ? a.setAttribute("aria-current", "step") : a.removeAttribute("aria-current")));
      },
    },
  });

  // The words of each act cross-fade at the boundary; the scene changes just after.
  acts.forEach((act, i) => {
    if (i === 0) return;
    const at = START[i];
    tl.to(acts[i - 1], { opacity: 0, y: -14, duration: 0.2, ease: "power1.in" }, at - 0.2);
    tl.fromTo(act, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, at);
    tl.set($$(":scope > *", act), { opacity: 1, y: 0 }, at - 0.2);
  });

  // The readout follows the playhead, so it is right in both directions.
  const READ = [
    [0, { axe: "–", agent: "–" }],
    [1.3, { pattern: "confirm", intent: "transfer.confirm" }],
    [3.9, { agent: "pressing…" }],
    [3.92, { agent: "✓ done" }],
    [5.0, { agent: "✓ done" }],
    [6.15, { axe: "0 violations" }],
    [6.45, { agent: "✓ 1/1 tasks" }],
  ];
  const state = { t: 0 };
  tl.to(state, {
    t: TOTAL,
    duration: TOTAL,
    ease: "none",
    onUpdate: () => {
      const now = {};
      for (const [at, vals] of READ) if (state.t >= at) Object.assign(now, vals);
      for (const [k, v] of Object.entries(now)) if (hud[k] && hud[k].textContent !== v) hud[k].textContent = v;
      for (const [k, el] of Object.entries(hud)) el.toggleAttribute("data-live", /✓|0 /.test(el.textContent));
    },
  }, 0);

  // Act 1, Mean: the surface comes apart into the parts the model chose, each named.
  tl.to(".ask", { opacity: 0, y: -10, duration: 0.2 }, 1)
    .set(card, { className: "card is-exploded" }, 1.2)
    .to(parts[0], { y: -44, duration: 0.5, ease: "power2.inOut" }, 1.2)
    .to(parts[1], { y: -18, duration: 0.5, ease: "power2.inOut" }, 1.2)
    .to(parts[2], { y: 16, duration: 0.5, ease: "power2.inOut" }, 1.2)
    .to(parts[3], { y: 54, duration: 0.5, ease: "power2.inOut" }, 1.2)
    .to(tags, { opacity: 1, y: 0, duration: 0.25, stagger: 0.05, ease: "power2.out" }, 1.4)
    .to(tags, { opacity: 0, duration: 0.15 }, 1.8)
    .to(parts, { y: 0, duration: 0.35, ease: "power2.inOut" }, 1.85)
    .set(card, { className: "card" }, 1.9);

  // Act 2, Build: torn down to the blueprint, rebuilt in the next design system, again and again.
  tl.to(".packname", { opacity: 1, duration: 0.2 }, 2.05);
  const STEP = 1.8 / (SEQUENCE.length - 1);
  SEQUENCE.forEach((key, i) => {
    if (i === 0) return;
    const at = 2.1 + (i - 1) * STEP;
    tl.call(drawWire, [], at)
      .to(".wire", { opacity: 1, duration: STEP * 0.25 }, at)
      .set(stage, { className: "stage is-blueprint" }, at + STEP * 0.15)
      .to(parts, { opacity: 0, y: -6, duration: STEP * 0.25, stagger: STEP * 0.03, ease: "power1.in" }, at + STEP * 0.15)
      .to(card, { opacity: 0.35, duration: STEP * 0.2 }, at + STEP * 0.25)
      .call(setPack, [key], at + STEP * 0.5)
      .call(setPack, [SEQUENCE[i - 1]], at + STEP * 0.5 - 0.001) // so scrolling back up rebuilds the previous one
      .to(card, { opacity: 1, duration: STEP * 0.2 }, at + STEP * 0.55)
      .set(stage, { className: "stage" }, at + STEP * 0.6)
      .to(parts, { opacity: 1, y: 0, duration: STEP * 0.25, stagger: STEP * 0.04, ease: "power2.out" }, at + STEP * 0.6)
      .to(".wire", { opacity: 0, duration: STEP * 0.2 }, at + STEP * 0.75);
  });
  tl.to(".packname", { opacity: 0, duration: 0.15 }, 3.95);

  // Act 3, Use: the tree a screen reader hears, and an agent pressing by name.
  tl.to(slot, { y: -56, duration: 0.35, ease: "power2.inOut" }, 4.05)
    .to(".tree", { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 4.15)
    .to(".cursor", { opacity: 1, duration: 0.1 }, 4.45)
    .to(".cursor", { x: toSend("x"), y: toSend("y"), duration: 0.35, ease: "power2.inOut" }, 4.5)
    .to(send, { scale: 0.94, duration: 0.06 }, 4.86)
    .to(send, { scale: 1, duration: 0.08 }, 4.92)
    .to(".agent-line", { opacity: 1, duration: 0.12 }, 4.9)
    .to([".tree", ".cursor"], { opacity: 0, duration: 0.15 }, 5.0)
    .to(slot, { y: 0, duration: 0.3, ease: "power2.inOut" }, 5.02);

  // Act 4, Return: gone on Monday, back on Friday, in exactly the same place.
  tl.to('[data-when="monday"]', { opacity: 1, duration: 0.1 }, 5.1)
    .to(".ghost", { opacity: 1, duration: 0.25 }, 5.2)
    .to(stage, { opacity: 0, scale: 0.98, duration: 0.25 }, 5.3)
    .to('[data-when="monday"]', { opacity: 0, duration: 0.08 }, 5.55)
    .to('[data-when="friday"]', { opacity: 1, duration: 0.1 }, 5.6)
    .to(stage, { opacity: 1, scale: 1, duration: 0.25 }, 5.62)
    .to(".same li", { opacity: 1, y: 0, duration: 0.15, stagger: 0.05 }, 5.7)
    .to([".ghost", '[data-when="friday"]', ".same li"], { opacity: 0, duration: 0.15 }, 6.0);

  // Act 5, Verify: the checks land on it.
  tl.fromTo(".stamp", { opacity: 0, scale: 1.7 }, { opacity: 1, scale: 1, duration: 0.2, stagger: 0.14, ease: "back.out(2.2)" }, 6.15).to({}, { duration: 0.25 }, TOTAL - 0.25);

  // Chapters are places you can go to.
  rail.forEach((a, i) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const st = tl.scrollTrigger;
      scrollTo(st.start + (START[i] / TOTAL) * (st.end - st.start) + 2);
    });
  });
  // Other in-page links still need to land on their target: Lenis owns the scroll now.
  document.addEventListener("click", (e) => {
    const link = e.target.closest?.('a[href^="#"]:not(.skip):not(.rail a)');
    const target = link && document.querySelector(link.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    scrollTo(target, -24);
    history.pushState(null, "", link.getAttribute("href"));
  });

  // ---------- After the story ----------

  // The row of built scenarios drifts by, then repeats: its contents are cloned once so the loop
  // has no seam, and it travels one row's width per cycle at a fixed speed.
  const row = $(".specimens");
  if (row) {
    const width = row.scrollWidth;
    row.append(...$$(":scope > *", row).map((li) => li.cloneNode(true)));
    row.style.setProperty("--drift", `${width}px`);
    row.style.setProperty("--drift-time", `${width / 38}s`);
  }

  const reveal = (targets, trigger, vars = {}) =>
    gsap.to(targets, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out", scrollTrigger: { trigger, start: "top 85%", once: true }, ...vars });
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
