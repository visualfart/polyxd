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
  // The preview answers four asks, each with a real product's verified screen, so it doesn't
  // pretend to take any text: the bar types the asks out itself, and the chips choose one.
  const form = $("[data-ask-form]");
  const askText = $("[data-ask-text]");
  const stage = $("[data-stage]");
  const status = $("[data-status]");
  const reset = $("[data-ask-reset]");
  const answers = $$("[data-answer]");
  const chips = $$("[data-ask]");
  const bigMark = $(".big-mark");
  const askMark = $(".ask-mark");
  let timer = 0, typing = 0, cycle = 0, current = 0, touched = false;

  const setMark = (m, s) => m && (m.dataset.state = s);
  const typeOut = (str, done) => {
    clearInterval(typing);
    chips.forEach((c, k) => c.classList.toggle("is-current", k === current));
    if (reduce) { askText.textContent = str; done?.(); return; }
    askText.textContent = "";
    setMark(askMark, "reading");
    let n = 0;
    typing = setInterval(() => {
      askText.textContent = str.slice(0, ++n);
      if (n >= str.length) { clearInterval(typing); if (!stage.classList.contains("asking")) setMark(askMark, "idle"); done?.(); }
    }, 34);
  };
  const idle = () => {
    if (touched) return;
    typeOut(chips[current].textContent, () => { cycle = setTimeout(() => { current = (current + 1) % chips.length; idle(); }, 2600); });
  };
  const show = (i) => {
    clearTimeout(timer);
    answers.forEach((a) => (a.hidden = true));
    chips.forEach((c, k) => c.setAttribute("aria-pressed", String(k === i)));
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
  const take = () => { touched = true; clearTimeout(cycle); };
  if (form) {
    chips.forEach((c, i) => c.addEventListener("click", () => { take(); current = i; typeOut(c.textContent, () => show(i)); }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      take();
      clearInterval(typing);
      askText.textContent = chips[current].textContent;
      show(current);
    });
    reset.addEventListener("click", () => { clear(); touched = false; idle(); chips[current].focus(); });
    setTimeout(idle, 900);
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
    for (let y = 4; y < 556; y += 16) for (let x = 4; x < 288; x += 16) {
      const i = document.createElement("i");
      const r1 = rnd(), r2 = rnd(), r3 = rnd();
      i.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.round((x - 146) * 1.8 + (r1 - .5) * 420)};--dy:${Math.round((y - 280) * 1.1 - r2 * 320)}`;
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

  // ---------- One phone, travelling ----------
  // A single phone carries the story. Its places are the scenes' phones ([data-slot]); between
  // two scenes it swings through the air in 3D to the next one as that scene scrolls in, and it
  // leans with the pointer. What its screen shows follows the scenes' progress.
  const tv = $("[data-traveller]");
  const slots = $$("[data-slot]");
  const kinds = slots.map((s) => s.dataset.slot);
  const secs = slots.map((s) => s.closest("section"));
  const wipeCount = wipeN || 6;
  const BASE_H = 660;
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const mix = (a, b, t) => a + (b - a) * t;
  const view = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => { view.x = e.clientX / innerWidth - .5; view.y = e.clientY / innerHeight - .5; }, { passive: true });
  if (tv && slots.length) tv.classList.add("on");
  const pOf = (k) => { const el = $(`[data-scene="${k}"]`); return el ? (last.get(el) ?? 0) : 0; };
  const set = (k, v) => tv.style.setProperty(k, typeof v === "number" ? v.toFixed(4) : v);

  const travel = () => {
    if (!tv || !slots.length) return;
    root.classList.add("travelling");
    const ih = innerHeight;
    let a = -1;
    secs.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= 1) a = i; });
    let from = Math.max(a, 0), to = from, t = 0;
    if (a >= 0 && a < slots.length - 1) { t = clamp(1 - secs[a + 1].getBoundingClientRect().top / ih); to = a + 1; }
    const e = ease(t), lift = Math.sin(Math.PI * e);
    const ra = slots[from].getBoundingClientRect(), rb = slots[to].getBoundingClientRect();
    const scale = mix(ra.height, rb.height, e) / BASE_H;
    tv.style.transform = `translate(${mix(ra.left, rb.left, e).toFixed(1)}px, ${mix(ra.top, rb.top, e).toFixed(1)}px) scale(${scale.toFixed(4)})`;
    // The turn: a swing in flight, a lean toward the pointer, and a turn on the way in and out.
    const enter = a < 0 ? ease(clamp(secs[0].getBoundingClientRect().top / ih)) : 0;
    const lastSec = secs[secs.length - 1].getBoundingClientRect();
    const leave = ease(clamp((ih - lastSec.bottom) / ih));
    set("--ry", `${(-26 * lift - 28 * enter + 22 * leave + view.x * 10).toFixed(2)}deg`);
    set("--rx", `${(7 * lift + 8 * enter - 6 * leave - view.y * 6).toFixed(2)}deg`);

    // The gap: the ask arrives, and the app has no screen for it.
    const pg = pOf("gap");
    set("--tv-ga", clamp((pg - .04) / .18));
    set("--tv-gb", clamp((pg - .28) / .18));
    // The turn: the answer is drawn inside the phone, over the app.
    const c = kinds.includes("turn") ? clamp((pOf("turn") - .5) / .36) : kinds.includes("gap") ? 0 : 1;
    set("--tv-c", c);
    // The wipe: restyled pack by pack.
    set("--tv-u", pOf("wipe") * (wipeCount - .6));
    // The check: night, and a scan.
    const dark = mix(slots[from].dataset.mode === "dark" ? 1 : 0, slots[to].dataset.mode === "dark" ? 1 : 0, e);
    set("--tv-dark", dark);
    tv.classList.toggle("is-dark", dark > .5);
    const pc = pOf("check");
    set("--tv-scan", clamp(pc / .8));
    set("--tv-scan-o", kinds[from] === "check" && e < .5 ? 1 - clamp((pc - .82) / .12) : 0);
    // Gone: the screen turns to dust, and the phone is left with nothing on it.
    const gi = kinds.indexOf("gone");
    const pgone = gi >= 0 && a >= gi ? pOf("gone") : 0;
    const f = clamp((pgone - .12) / .18);
    set("--tv-o", 1 - f);
    set("--tv-app", (1 - clamp((c - .85) / .15)) * (1 - f));
    set("--tv-do", clamp((pgone - .08) / .12) * (1 - clamp((pgone - .5) / .45)));
    set("--tv-q", clamp((pgone - .22) / .7));
  };

  const last = new Map();
  let lastTool = 0, lastWipe = 0;
  const tick = () => {
    requestAnimationFrame(tick);
    if (!motion()) return;
    const ih = innerHeight;
    for (const el of scenes) {
      // Every scene, on screen or not: one far above has finished (1), one far below hasn't begun (0),
      // so jumping straight to a section (a nav link) finds the phone in the right state.
      const r = el.getBoundingClientRect();
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
