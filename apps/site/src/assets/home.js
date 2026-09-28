// polyxd.com home: the dot field, the hero's ask, and the scroll scenes.
// Every scene reads --p (0 to 1). With motion off (reduced motion, a small screen) the scenes
// keep the still frame their CSS sets, and nothing here moves.
(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  // ---------- The hero's ask ----------
  const form = $("[data-ask-form]");
  const input = $("#ask");
  const stage = $("[data-stage]");
  const status = $("[data-status]");
  const miss = $("[data-ask-miss]");
  const reset = $("[data-ask-reset]");
  const answers = $$("[data-answer]");
  const chips = $$("[data-ask]");
  const bigMark = $(".big-mark");
  const askMark = $(".ask-mark");
  let timer = 0;

  const setMark = (m, s) => m && (m.dataset.state = s);
  const match = (text) => {
    const t = text.toLowerCase();
    return answers.findIndex((a) => a.dataset.words.split("|").some((w) => w && t.includes(w)));
  };
  const show = (i, fill) => {
    clearTimeout(timer);
    miss.hidden = true;
    answers.forEach((a) => (a.hidden = true));
    chips.forEach((c, k) => c.setAttribute("aria-pressed", String(k === i)));
    if (fill) input.value = chips[i].textContent;
    const a = answers[i];
    stage.classList.add("asking");
    setMark(bigMark, "thinking");
    setMark(askMark, "thinking");
    status.textContent = `Drawing it in ${a.dataset.packName}`;
    field.formTarget = 1;
    timer = setTimeout(() => {
      a.hidden = false;
      reset.hidden = false;
      setMark(bigMark, "checked");
      setMark(askMark, "idle");
      status.textContent = "Checked";
    }, reduce ? 0 : 1400);
  };
  const clear = () => {
    clearTimeout(timer);
    answers.forEach((a) => (a.hidden = true));
    chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
    stage.classList.remove("asking");
    reset.hidden = true;
    status.textContent = "";
    setMark(bigMark, "idle");
    setMark(askMark, "idle");
    field.formTarget = 0;
  };
  if (form) {
    chips.forEach((c, i) => c.addEventListener("click", () => show(i, true)));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = input.value.trim();
      if (!t) return show(0, true);
      const i = match(t);
      if (i >= 0) return show(i, false);
      clear();
      miss.hidden = false;
      setMark(bigMark, "attention");
      setMark(askMark, "attention");
    });
    input.addEventListener("input", () => {
      miss.hidden = true;
      if (!stage.classList.contains("asking")) {
        setMark(askMark, input.value ? "reading" : "idle");
        setMark(bigMark, input.value ? "reading" : "idle");
      }
    });
    reset.addEventListener("click", () => {
      clear();
      input.value = "";
      input.focus();
    });
  }

  // ---------- The dot field (assets/field.js) ----------
  // The hero's field gathers into the answer's box when something is asked.
  const canvas = $("[data-field]");
  const hero = canvas?.closest("section");
  const boxEl = $("[data-answers]");
  const fieldCtl = canvas && window.PolyxdField?.get(canvas);
  if (fieldCtl && boxEl) fieldCtl.box = boxEl;
  const field = { set formTarget(v) { if (fieldCtl) fieldCtl.form = v; } };
  const pointer = { cx: null, cy: null };
  hero?.addEventListener("pointermove", (e) => { pointer.cx = e.clientX; pointer.cy = e.clientY; }, { passive: true });
  hero?.addEventListener("pointerleave", () => { pointer.cx = null; });

  // The big mark's pupil follows the pointer while nothing is asked.
  const pupil = bigMark?.querySelector(".pxb-pupil");
  const pp = { x: 0, y: 0 };
  const track = () => {
    requestAnimationFrame(track);
    if (!pupil || reduce) return;
    let dx = 0, dy = 0;
    if (pointer.cx !== null && bigMark.dataset.state === "idle") {
      const r = bigMark.getBoundingClientRect();
      const ax = pointer.cx - (r.left + r.width / 2), ay = pointer.cy - (r.top + r.height / 2), d = Math.hypot(ax, ay) || 1;
      const m = Math.min(1, d / 260) * 1.35;
      dx = (ax / d) * m; dy = (ay / d) * m;
    }
    pp.x += (dx - pp.x) * .14; pp.y += (dy - pp.y) * .14;
    pupil.setAttribute("cx", (16 + pp.x).toFixed(3));
    pupil.setAttribute("cy", (16 + pp.y).toFixed(3));
  };
  track();

  // ---------- Gone when it's done: the dust the screen turns into ----------
  const dust = $("[data-dust]");
  if (dust) {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const frag = document.createDocumentFragment();
    for (let y = 4; y < 456; y += 16) for (let x = 4; x < 296; x += 16) {
      const i = document.createElement("i");
      const r1 = rnd(), r2 = rnd(), r3 = rnd();
      i.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.round((x - 150) * 1.8 + (r1 - .5) * 420)};--dy:${Math.round((y - 230) * 1.1 - r2 * 320)}`;
      if (r3 > .72) i.className = "ink";
      frag.append(i);
    }
    dust.append(frag);
  }

  // ---------- Scroll scenes ----------
  const scenes = $$("[data-scene]");
  const wipe = $('[data-scene="wipe"]');
  const wipeTabs = $$("[data-wipe]");
  const wipeN = wipeTabs.length;
  const tools = $$("[data-tool]");
  const panels = $$("[data-panel]");
  const platform = $('[data-scene="platform"]');
  const roles = $('[data-scene="roles"]');
  const counters = $$("[data-count]");
  const motion = () => root.classList.contains("motion");

  const selectTool = (i) => {
    tools.forEach((t, k) => t.setAttribute("aria-pressed", String(k === i)));
    panels.forEach((p, k) => (p.hidden = k !== i));
  };
  const selectWipe = (i) => wipeTabs.forEach((t, k) => t.setAttribute("aria-pressed", String(k === i)));
  const wipeP = (i) => (i + .2) / (wipeN - .6);
  const jump = (scene, p) => {
    const r = scene.getBoundingClientRect();
    scrollTo({ top: scrollY + r.top + p * (r.height - innerHeight) + 2, behavior: reduce ? "auto" : "smooth" });
  };
  tools.forEach((t, i) => t.addEventListener("click", () => (motion() ? jump(platform, (i + .5) / tools.length) : selectTool(i))));
  wipeTabs.forEach((t, i) => t.addEventListener("click", () => {
    if (motion()) jump(wipe, wipeP(i));
    else { wipe.style.setProperty("--p", wipeP(i).toFixed(4)); selectWipe(i); }
  }));

  const setTravel = () => {
    const track = roles?.querySelector(".roles-track");
    if (track) roles.style.setProperty("--travel", `${Math.max(0, track.scrollWidth - innerWidth)}px`);
  };
  setTravel();
  addEventListener("resize", setTravel);

  // ---------- One screen, travelling ----------
  // The screen is fixed to the viewport. Its place is a [data-slot] in the scene that has the
  // screen (turn, the phone, the night check, gone); between two scenes it glides from one place
  // to the next as the next scene scrolls in. What it looks like follows the scenes' progress.
  const tv = $("[data-traveller]");
  const slots = $$("[data-slot]");
  const kinds = slots.map((s) => s.dataset.slot);
  const secs = slots.map((s) => s.closest("section"));
  const phones = $$("[data-phone]");
  const wipeCount = wipeN || 6;
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const mix = (a, b, t) => a + (b - a) * t;
  const radiusOf = (el) => (el.classList.contains("phone-view") ? "0 0 36px 36px" : getComputedStyle(el).borderRadius || "28px");
  const view = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => { view.x = e.clientX / innerWidth - .5; view.y = e.clientY / innerHeight - .5; }, { passive: true });
  if (tv && slots.length) tv.classList.add("on");
  const pOf = (k) => { const el = $(`[data-scene="${k}"]`); return el ? (last.get(el) ?? 0) : 0; };

  const travel = () => {
    if (!tv || !slots.length) return;
    root.classList.add("travelling");
    const ih = innerHeight;
    let a = -1;
    secs.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= 1) a = i; });
    let from = Math.max(a, 0), to = from, t = 0;
    if (a >= 0 && a < slots.length - 1) { t = clamp(1 - secs[a + 1].getBoundingClientRect().top / ih); to = a + 1; }
    const e = ease(t);
    const ra = slots[from].getBoundingClientRect(), rb = slots[to].getBoundingClientRect();
    const w = mix(ra.width, rb.width, e), h = mix(ra.height, rb.height, e);
    tv.style.transform = `translate(${mix(ra.left, rb.left, e).toFixed(1)}px, ${mix(ra.top, rb.top, e).toFixed(1)}px)`;
    tv.style.width = `${w.toFixed(1)}px`;
    tv.style.height = `${h.toFixed(1)}px`;
    tv.style.setProperty("--tv-r", radiusOf(e < .5 ? slots[from] : slots[to]));
    // Born in the turn: revealed top to bottom as the document becomes a screen.
    const hide = kinds[0] === "turn" && to === 0 ? 1 - clamp((pOf("turn") - .5) / .36) : 0;
    tv.style.setProperty("--tv-hide", hide.toFixed(4));
    // Restyled in the phone, pack by pack.
    tv.style.setProperty("--tv-u", (pOf("wipe") * (wipeCount - .6)).toFixed(4));
    // Night for the check, day again after it.
    const dark = mix(slots[from].dataset.mode === "dark" ? 1 : 0, slots[to].dataset.mode === "dark" ? 1 : 0, e);
    tv.style.setProperty("--tv-dark", dark.toFixed(4));
    const inCheck = kinds[from] === "check" && e < .5;
    const pc = pOf("check");
    tv.style.setProperty("--tv-scan", clamp(pc / .8).toFixed(4));
    tv.style.setProperty("--tv-scan-o", inCheck ? (1 - clamp((pc - .82) / .12)).toFixed(4) : "0");
    // Let go: it fades as the dust takes its place.
    const gi = kinds.indexOf("gone");
    tv.style.setProperty("--tv-o", gi >= 0 && a >= gi ? (1 - clamp((pOf("gone") - .12) / .18)).toFixed(4) : "1");
  };

  // The phones turn in perspective as their scene arrives and leaves; face-on in between, which
  // is when the travelling screen sits in them. The empty one in "the gap" follows the pointer too.
  const tilt = () => {
    const ih = innerHeight;
    for (const ph of phones) {
      const r = ph.closest("section").getBoundingClientRect();
      if (r.bottom < -ih || r.top > ih * 2) continue;
      const enter = clamp(r.top / ih), leave = clamp((ih - r.bottom) / ih);
      let ry = -28 * ease(enter) + 22 * ease(leave), rx = 8 * ease(enter) - 6 * ease(leave);
      if (ph.dataset.phone === "gap") { ry += -12 + view.x * 16; rx += 4 - view.y * 10; }
      const el = ph.querySelector(".phone");
      el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
      el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      ph.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    }
  };

  const last = new Map();
  let lastTool = 0, lastWipe = 0;
  const tick = () => {
    requestAnimationFrame(tick);
    if (!motion()) return;
    const ih = innerHeight;
    for (const el of scenes) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -ih || r.top > ih * 2) continue;
      const kind = el.dataset.kind;
      let p = kind === "pin" ? -r.top / Math.max(1, r.height - ih) : kind === "hero" ? -r.top / Math.max(1, r.height) : (ih - r.top) / (ih + r.height);
      p = clamp(p);
      if (Math.abs((last.get(el) ?? -1) - p) > .0005) { last.set(el, p); el.style.setProperty("--p", p.toFixed(4)); }
    }
    if (wipe) {
      const i = clamp(Math.floor((last.get(wipe) ?? 0) * (wipeN - .6) + .3), 0, wipeN - 1);
      if (i !== lastWipe) { lastWipe = i; selectWipe(i); }
    }
    if (platform) {
      const i = clamp(Math.floor((last.get(platform) ?? 0) * tools.length), 0, tools.length - 1);
      if (i !== lastTool) { lastTool = i; selectTool(i); }
    }
    travel();
    tilt();
    const check = $('[data-scene="check"]');
    const c = clamp(((last.get(check) ?? 0) - .3) / .5);
    const e = 1 - Math.pow(1 - c, 3);
    for (const el of counters) {
      const s = Math.round(Number(el.dataset.count) * e).toLocaleString("en-GB");
      if (el.textContent !== s) el.textContent = s;
    }
  };
  if (!reduce) requestAnimationFrame(tick);

  // Motion follows the window: pinned scenes need room, so a small window gets the stills.
  const mq = matchMedia("(min-width: 900px) and (min-height: 600px)");
  mq.addEventListener?.("change", () => {
    if (reduce) return;
    root.classList.toggle("motion", mq.matches);
    if (!mq.matches) {
      root.classList.remove("travelling");
      scenes.forEach((el) => el.style.removeProperty("--p"));
      counters.forEach((el) => (el.textContent = Number(el.dataset.count).toLocaleString("en-GB")));
    }
  });
})();
