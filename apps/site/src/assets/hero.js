/**
 * Landing page motion: the hero demo assembles itself the way a generated interface does,
 * and sections arrive as you scroll. GSAP drives it; Lenis smooths the scroll.
 *
 * Motion is decoration only. The page is complete and readable without this file, and the
 * `motion` class (set in index.html) is removed when the visitor asks for reduced motion,
 * so nothing below runs. That matches the rule the spec puts on generated surfaces: a
 * reduced-motion preference outranks the company's taste.
 */
(() => {
  const root = document.documentElement;
  const { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, Lenis } = window;
  if (!root.classList.contains("motion") || !gsap || !ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);
  root.dataset.motionReady = "true"; // Tells index.html's fallback timer that motion took over.

  // ---------- Smooth scroll ----------

  if (Lenis) {
    const lenis = new Lenis({ autoRaf: false, duration: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    // In-page links still need to land on their target: Lenis owns the scroll now.
    document.addEventListener("click", (e) => {
      const link = e.target.closest?.('a[href^="#"]:not(.skip)');
      const target = link && document.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -24 });
      history.pushState(null, "", link.getAttribute("href"));
    });
  }

  // ---------- The hero demo assembling itself ----------

  const demo = document.querySelector(".demo");
  const ask = document.querySelector(".demo-ask span:not(.demo-label)");
  const askChars = ask ? new SplitText(ask, { type: "chars" }).chars : [];
  const parts = (stage) => stage.querySelectorAll(".t, .d, .row, .acts .b");

  /** One design system's card arriving: the surface first, then its parts in reading order. */
  function build(stage, at) {
    const card = stage.querySelector(".card");
    return gsap
      .timeline()
      .from(card, { opacity: 0, scale: 0.96, duration: 0.5, ease: "power2.out" }, at)
      .from(parts(stage), { opacity: 0, y: 10, duration: 0.4, stagger: 0.055, ease: "power2.out" }, at + 0.2);
  }

  function assemble() {
    const visible = [...document.querySelectorAll(".render")].filter((r) => !r.hidden);
    const tl = gsap.timeline();
    tl.to(".demo-ask", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" })
      .from(askChars, { opacity: 0, duration: 0.01, stagger: 0.035 }, 0.2)
      .from(".demo-arrow path", { drawSVG: "0%", duration: 0.35, ease: "power1.inOut" }, ">-0.1")
      .to(".demo-json", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, "<")
      .add("surfaces");
    visible.forEach((render, i) => {
      tl.add(build(render.querySelector(".stage"), 0), `surfaces+=${i * 0.14}`);
      tl.from(render.querySelector("figcaption"), { opacity: 0, duration: 0.3 }, `surfaces+=${i * 0.14 + 0.7}`);
    });
    return tl;
  }

  if (demo) {
    gsap.set([".demo-ask", ".demo-json"], { opacity: 0, y: 8 });
    const replay = document.querySelector("[data-replay]");
    let run = assemble();
    if (replay) {
      replay.hidden = false;
      replay.addEventListener("click", () => {
        run.kill();
        gsap.set([".demo-ask", ".demo-json"], { opacity: 0, y: 8 });
        run = assemble();
      });
    }
    // Switching design system on narrow screens rebuilds the surface you just revealed.
    document.querySelectorAll('.demo-tabs [role="tab"]').forEach((tab) => {
      tab.addEventListener("click", () => {
        const stage = document.getElementById(tab.getAttribute("aria-controls"))?.querySelector(".stage");
        if (stage && window.matchMedia("(max-width: 1000px)").matches) build(stage, 0);
      });
    });
  }

  // ---------- The rest of the hero ----------

  const headline = document.querySelector(".hero h1");
  gsap
    .timeline()
    .to(".badge", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" })
    .from(headline ? new SplitText(headline, { type: "words" }).words : [], { opacity: 0, y: 18, duration: 0.6, stagger: 0.025, ease: "power3.out" }, 0.05)
    .to(".hero-lede", { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.25)
    .to(".demo", { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0.35);

  // ---------- Scroll ----------

  const reveal = (targets, trigger, vars = {}) =>
    gsap.to(targets, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out", scrollTrigger: { trigger, start: "top 82%", once: true }, ...vars });

  reveal(".step", ".steps", { stagger: 0.09 });
  reveal(".section-head", ".section-head");
  document.querySelectorAll(".band .split-text, .band .tree, .split .stack, .split .direction, .taste .split-text, .cta > div, .waitlist").forEach((el) => reveal(el, el));

  // Counts tick up, because the numbers are the argument.
  document.querySelectorAll(".stat dd").forEach((dd) => {
    const [, n, rest] = /^(\d+)(.*)$/.exec(dd.textContent.trim()) ?? [];
    if (!n) return;
    const count = { v: 0 };
    gsap.to(count, {
      v: Number(n),
      duration: 1.1,
      ease: "power2.out",
      scrollTrigger: { trigger: dd, start: "top 88%", once: true },
      onUpdate: () => (dd.textContent = Math.round(count.v) + rest),
    });
  });
  reveal(".stat", ".proof", { stagger: 0.07 });
})();
