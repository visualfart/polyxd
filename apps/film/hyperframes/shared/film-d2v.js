/*
 * Film D2, VERTICAL (1080×1920, Instagram Reels): film-d2.js forked and recomposed for portrait. Same
 * story, same timings (shared/film-d2-timings.json), same score cut; each beat reframed: captions as a
 * block in the upper third of the Reels safe zone (x 60–960, y 250–1500), the picture below; code zoomed
 * to the lines that matter (≥ 34 px on screen); the phone below the editor in the world; the board as
 * stacked columns with a vertical wall of finished screens.
 *
 * Film D2, "Ship the screen, not the backlog" (STORY-DEV-2.md): the developer film, second cut. Dark.
 *
 * One ask, four verbs. A generic issue tracker fills with asks nobody will build; one of them, #933
 * "Where's my order? Show tracking in the app", lifts out and becomes a screen: Describe it (the
 * order document streams into the editor and the real renderer draws it part by part), Style it (one
 * prop, retyped: material3, carbon, shadcn, then `npx polyxd pack` brings acme in), Wire it (the tap's
 * ActionEvent lands on the host's onAction), Trust it (`npx polyxd-verify` and the twelve-render
 * matrix). Then the tracker is a board and every card flips into its screen and moves to Done.
 *
 * Everything on screen is real: the order document is packages/spec/examples/shop-order-status.json
 * plus one Action and order.id (shared/film-d2-order/order-status.json, valid and verified at 100);
 * the payoff's screens are the spec's examples; all drawn live by @polyxd/web's browser build in each
 * pack's dark mode; the terminal output is what the commands printed in this repository, trimmed.
 *
 * The machinery is film D's (shared/film-d.js), copied: the camera's pose ladder with velocity blur,
 * the hw doodles, caption-clip-wipe, code typing with a caret, the highlight band with dimmed context,
 * the token morph (here in dark mode), the verifier's matrix, the flip payoff.
 *
 * One writer per property: GSAP tweens the doodles, captions, rows, cards, parts and presses; render(t),
 * a pure function of time registered through the hw family's single onUpdate, owns the camera, the
 * ground's parallax, the typing, the theme blends, the counters and the mark.
 */
(function () {
  const M = window.PolyxdMark;
  const X = window.PolyxdMorph;
  const E = M.ease;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const seg = (t, a, d) => clamp((t - a) / d);
  const lerp = (a, b, p) => a + (b - a) * p;
  const $ = (id) => document.getElementById(id);
  const sine = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
  const out3 = (p) => 1 - Math.pow(1 - p, 3);
  const in3 = (p) => p * p * p;
  const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const K = 416 / 390; // a phone's screen: 390 CSS px drawn 416 px wide
  const SIGNAL = "#ff6e40";
  const OK = "#4cc38a";
  const MODE = "dark";
  // The portrait frame and the centre line of the Reels safe zone (x 60–960).
  const FW = 1080, FH = 1920, SX = 510;

  // The sets' places in the world. The tracker (list, then board) is home.
  const SET = { list: [0, 0], doc: [3000, 0], check: [3000, 2900] }; // portrait: the checks sit below the phone

  const el = (tag, cls, parent, style, html) => {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (style) d.style.cssText = style;
    if (html !== undefined) d.innerHTML = html;
    if (parent) parent.appendChild(d);
    return d;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const allowAll = (root) => {
    root.setAttribute("data-layout-allow-overlap", "");
    root.setAttribute("data-layout-allow-overflow", "");
    root.querySelectorAll("*").forEach((n) => {
      n.setAttribute("data-layout-allow-overlap", "");
      n.setAttribute("data-layout-allow-overflow", "");
    });
  };

  /** Layout rect of n inside anchor, in anchor's own pixels (offsets: transforms don't move them). */
  function layoutRect(n, anchor) {
    let x = 0, y = 0, c = n;
    while (c && c !== anchor) {
      x += c.offsetLeft;
      y += c.offsetTop;
      c = c.offsetParent;
    }
    return { x, y, w: n.offsetWidth, h: n.offsetHeight };
  }

  // ——— Syntax: a small tokenizer per language, in the brand's dark colours ———
  const RX = {
    json: /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b|([{}[\],:])|(…)|(\s+)|(.)/g,
    js: /(\/\/.*$)|("(?:[^"\\]|\\.)*")|\b(import|from|const|if|export|function|return|type)\b|(<\/?[A-Za-z][\w.-]*|\/?>)|([A-Za-z_][\w-]*)(?==)|(\d+)|([{}()[\];,.=>:!|&]+)|(\s+)|(.)/g,
  };
  function tokens(text, lang) {
    const out = [];
    if (lang === "plain") return [[text, ""]];
    const rx = new RegExp(RX[lang === "json" ? "json" : "js"].source, "g");
    let m;
    while ((m = rx.exec(text))) {
      if (lang === "json") {
        if (m[1]) {
          out.push([m[1], m[2] ? "k" : "s"]);
          if (m[2]) out.push([m[2], "p"]);
        } else if (m[3]) out.push([m[3], "n"]);
        else if (m[4]) out.push([m[4], "n"]);
        else if (m[5] || m[6]) out.push([m[5] || m[6], "p"]);
        else out.push([m[7] || m[8], ""]);
      } else {
        if (m[1]) out.push([m[1], "c"]);
        else if (m[2]) out.push([m[2], "s"]);
        else if (m[3]) out.push([m[3], "kw"]);
        else if (m[4]) out.push([m[4], "tg"]);
        else if (m[5]) out.push([m[5], "at"]);
        else if (m[6]) out.push([m[6], "n"]);
        else if (m[7]) out.push([m[7], "p"]);
        else out.push([m[8] || m[9], ""]);
      }
    }
    return out;
  }
  function highlight(text, lang, n) {
    const toks = tokens(text, lang);
    let left = n === undefined ? text.length : n, html = "";
    for (const [s, c] of toks) {
      if (left <= 0) break;
      const part = s.slice(0, left);
      html += c ? `<span class="${c}" data-layout-allow-overlap>${esc(part)}</span>` : esc(part);
      left -= part.length;
    }
    return html;
  }

  // ——— Typing: per-character reveal times (streamed or typed by hand), and in-place retypes ———
  function stream(rows, t0, every) {
    rows.forEach((r, i) => {
      const n = r.text.length;
      r.times = Array.from({ length: n }, (_, k) => t0 + i * every + (n ? (k / n) * every * 0.7 : 0));
      r.from = t0 + i * every;
    });
  }
  function typeLine(r, t0, per, seed) {
    let t = t0;
    r.times = [];
    for (let k = 0; k < r.text.length; k++) {
      r.times.push(t);
      t += per * (0.75 + 0.5 * Math.abs(window.hwHash(k * 3 + 1, seed || 7)));
    }
    r.from = t0;
    r.to = t;
  }
  function textAt(r, t) {
    let cur = r.text;
    for (const e of r.edits || []) {
      if (t < e.at) break;
      let p = 0;
      while (p < cur.length && p < e.to.length && cur[p] === e.to[p]) p++;
      const del = cur.length - p, add = e.to.length - p;
      const dt = t - e.at, DEL = 0.03, ADD = 0.045;
      if (dt < del * DEL) return { s: cur.slice(0, cur.length - Math.floor(dt / DEL) - 1), editing: true };
      if (dt < del * DEL + add * ADD) return { s: e.to.slice(0, p + Math.floor((dt - del * DEL) / ADD) + 1), editing: true };
      cur = e.to;
    }
    return { s: cur, editing: false };
  }
  const shownAt = (r, t) => {
    if (!r.times) return Infinity;
    let n = 0;
    while (n < r.times.length && r.times[n] <= t) n++;
    return n;
  };

  function codeFile(host, lines, lang) {
    const wrap = el("div", "d-file", host);
    const rows = lines.map((text, i) => {
      const r = el("div", "d-line", wrap, "", `<span class="ln">${i + 1}</span><span class="tx"></span>`);
      return { el: r, tx: r.querySelector(".tx"), text, i, key: "" };
    });
    const caret = el("div", "d-caret", wrap);
    return { wrap, rows, lang, caret, pad: 96, lh: 48 };
  }
  function renderFile(f, t, CW) {
    let active = null;
    for (const r of f.rows) {
      const { s, editing } = textAt(r, t);
      const n = Math.min(s.length, shownAt(r, t));
      const key = `${s}|${n}`;
      if (r.key !== key) {
        r.tx.innerHTML = highlight(s, f.lang, n);
        r.key = key;
      }
      const lnOn = !r.times || t >= r.from;
      if (r.lnOn !== lnOn) {
        r.el.querySelector(".ln").style.opacity = lnOn ? "" : "0";
        r.lnOn = lnOn;
      }
      if (editing) active = { r, col: s.length };
      else if (r.times && r.times.length && t >= r.from && t < r.times[r.times.length - 1] + 0.25) active = { r, col: n };
    }
    if (active) {
      f.caret.style.opacity = "1";
      f.caret.style.left = `${f.pad + active.col * CW}px`;
      f.caret.style.top = `${active.r.i * f.lh + (f.lh - 34) / 2}px`;
    } else f.caret.style.opacity = "0";
  }

  /** Terminal rows: commands typed after a prompt, output printed whole. */
  function termRows(body, rows, seed) {
    const R = rows.map((r) => Object.assign({ el: el("div", `d-tl ${r.cmd ? "cmd" : r.cls || ""}`, body), key: "" }, r));
    for (const r of R) if (r.cmd) typeLine(r, r.at, r.per || 0.028, seed || r.at * 10);
    return { rows: R };
  }
  function terminal(host, rows, x, y, w, h, title) {
    const t = el("div", "d-term", host, `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`);
    el("div", "bar", t, "", `<i></i><i></i><i></i><span>${esc(title || "zsh")}</span>`);
    const body = el("div", "", t, "position:absolute;left:32px;right:24px;top:76px;");
    return Object.assign(termRows(body, rows), { el: t, body });
  }
  function renderTerm(term, t) {
    for (const r of term.rows) {
      let key, html;
      if (r.cmd) {
        const vis = t >= r.at - (r.lead === undefined ? 0.3 : r.lead);
        const n = shownAt(r, t);
        key = vis ? `c${n}` : "";
        html = vis ? `<span class="pr">${esc(r.cmd)}</span> ${esc(r.text.slice(0, n))}${n < r.text.length ? '<span class="d-tcaret"></span>' : ""}` : "";
      } else {
        const vis = t >= r.at;
        key = vis ? "o" : "";
        html = vis ? r.html || esc(r.text) : "";
      }
      if (r.key !== key) {
        r.el.innerHTML = html;
        r.key = key;
      }
    }
  }

  // The order's item images (the owner's photos) resolve for every render of the order document.
  const resolveMedia = (ref) => (window.D_MEDIA || {})[ref];
  const mount = (host, doc, theme, density) =>
    window.PolyxdWeb.mount(host, { document: doc, data: doc.data, theme, mode: MODE, density: density || "compact", locale: "en-GB", resolveMedia });

  /** A phone with the real renderer drawing `doc` in `theme`, dark. */
  function phone(host, x, y, doc, theme) {
    const p = el("div", "d-phone", host, `left:${x}px;top:${y}px;`);
    const glass = el("div", "phone-glass", p);
    const screen = el("div", "phone-screen", glass);
    const app = el("div", "d-app", screen);
    app.setAttribute("data-pxd-theme", theme);
    app.setAttribute("data-pxd-mode", MODE);
    el("div", "status", app, "", '<span>9:41</span><span class="battery"></span>');
    const pad = el("div", "pad", app);
    mount(el("div", "", pad), doc, theme);
    el("div", "home-bar", app);
    allowAll(app);
    return { el: p, app, screen, q: (s) => app.querySelector(s) };
  }
  function inPhone(ph, n) {
    const r = layoutRect(n, ph.screen);
    const x = parseFloat(ph.el.style.left) + 13 + r.x * K, y = parseFloat(ph.el.style.top) + 13 + r.y * K;
    return { x, y, w: r.w * K, h: r.h * K, cx: x + (r.w * K) / 2, cy: y + (r.h * K) / 2 };
  }

  /** A small render at cssW CSS px, scaled into a w×h tile (the verifier's matrix; the board's Done). */
  function tile(host, x, y, w, h, cssW, doc, theme, mode, cls, pad) {
    const d = el("div", "d-tile" + (cssW > 600 ? " wide" : "") + (cls ? " " + cls : ""), host, `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`);
    const k = w / cssW;
    const inner = el("div", "in", d, `width:${cssW}px;height:${h / k}px;transform:scale(${k});padding:${pad || (cssW > 600 ? "40px 60px" : "22px 14px")};`);
    inner.setAttribute("data-pxd-theme", theme);
    inner.setAttribute("data-pxd-mode", mode);
    window.PolyxdWeb.mount(el("div", "", inner), { document: doc, data: doc.data, theme, mode, density: "compact", locale: "en-GB", resolveMedia });
    allowAll(d);
    return d;
  }

  /** Film D's token morph (morph.js), reading each pack's dark tokens. */
  const DARK = {};
  function darkTokens(theme) {
    if (DARK[theme]) return DARK[theme];
    const probe = document.createElement("div");
    probe.setAttribute("data-pxd-theme", theme);
    probe.setAttribute("data-pxd-mode", MODE);
    probe.style.cssText = "position:absolute;left:-9999px;top:0;width:10px;height:10px;";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const out = {};
    for (const n of X.tokenNames()) out[n] = cs.getPropertyValue(n).trim();
    probe.remove();
    return (DARK[theme] = out);
  }
  function tokenMorphDark(appEl) {
    const scoped = [appEl, ...appEl.querySelectorAll("[data-pxd-theme]")];
    const cache = {};
    let applied = "";
    return function set(state) {
      const key = state.theme ? `rest:${state.theme}` : `${state.from}>${state.to}:${state.p.toFixed(4)}`;
      if (key === applied) return;
      applied = key;
      if (state.theme) {
        for (const e of scoped) {
          e.setAttribute("data-pxd-theme", state.theme);
          for (const n of X.tokenNames()) e.style.removeProperty(n);
        }
        return;
      }
      const pair = `${state.from}>${state.to}`;
      if (!cache[pair]) {
        const A = darkTokens(state.from), B = darkTokens(state.to);
        cache[pair] = X.tokenNames().map((n) => [n, X.interpolator(A[n], B[n]), A[n], B[n]]);
      }
      const p = state.p;
      const theme = p < 0.5 ? state.from : state.to;
      for (const e of scoped) {
        e.setAttribute("data-pxd-theme", theme);
        for (const [n, f, a, b] of cache[pair]) {
          const v = f ? f(p) : p < 0.5 ? a : b;
          if (v) e.style.setProperty(n, v);
          else e.style.removeProperty(n);
        }
      }
    };
  }

  // ——— The backlog: one ask per spec example ———
  const ISSUES = [
    // [number, title, example, pack for its screen, 👍, avatars, opened, kind of screen]
    [933, "Where’s my order? Show tracking in the app", "ORDER", "acme", 214, ["MK", "JO"], "3 days ago", "phone"],
    [1287, "Let me cancel a customer’s subscription", "crm-cancel-subscription", "antd", 187, ["AR"], "2 weeks ago", "desk"],
    [2041, "Let admins rotate API keys", "settings-api-keys", "primer", 156, ["DS", "LT"], "5 days ago", "desk"],
    [1764, "Review my booking before I pay", "travel-booking-review", "editorial", 141, ["PN"], "last week", "phone"],
    [2310, "Bulk-reassign accounts to a new owner", "crm-accounts-list", "carbon", 98, ["CE", "BW"], "yesterday", "desk"],
    [2290, "Send money to a friend in the app", "money-send-form", "health", 91, ["CE"], "yesterday", "phone"],
    [1918, "Show where my money went this month", "money-balance-overview", "sketch", 76, ["BW", "RI"], "4 days ago", "phone"],
    [2268, "One page for everything about an account", "crm-account-record", "polaris", 70, ["GM"], "today", "desk"],
    [2077, "Warn me before I go over budget", "money-budget-settings", "terminal", 64, ["GM"], "today", "phone"],
    [1655, "Compare plans before I upgrade", "shop-compare-plans", "chakra", 59, ["HV"], "2 days ago", "phone"],
    [2235, "Show who has access to this workspace", "team-members", "fluent", 55, ["OT", "AB"], "today", "desk"],
    [2134, "Filter by price and size", "shop-browse-filter", "sketch", 51, ["OT", "AB"], "today", "phone"],
    [1402, "Pay in one step at checkout", "shop-checkout", "brutalist", 47, ["YZ"], "3 weeks ago", "phone"],
    [2045, "See what’s using our storage", "storage-usage", "primer", 41, ["UK"], "today", "desk"],
    [2311, "Find a time that works for all of us", "calendar-find-slot", "shadcn", 44, ["FN"], "today", "phone"],
    [1876, "Let me choose which emails I get", "settings-notifications", "editorial", 41, ["QS", "EM"], "6 days ago", "phone"],
    [1523, "Delete my account myself", "settings-delete-account", "terminal", 33, ["WJ"], "a month ago", "phone"],
    [2188, "Show me what’s due today", "tasks-list", "shadcn", 29, ["IC", "NR"], "today", "phone"],
    [1990, "Add a task from anywhere", "tasks-add", "health", 26, ["LD"], "yesterday", "phone"],
    [2402, "Compare flights side by side", "travel-flight-results", "chakra", 17, ["ZE"], "today", "phone"],
  ];
  const AV = ["#c9734f", "#8e7a5a", "#d9a441", "#a8563b", "#6f8f5e", "#b88a6a"];
  const avatars = (inits, k) => inits.map((s, i) => `<span style="background:${AV[(k + i * 3) % AV.length]}">${s}</span>`).join("");

  function build() {
    const T = window.D_T;
    const D = window.D_DOCS;
    const ORDER = window.D_ORDER;
    const tl = gsap.timeline({ paused: true });
    const rig = $("rig");
    const ink = $("ink");
    const sets = {};
    for (const [k, [x, y]] of Object.entries(SET)) sets[k] = el("div", "set", rig, `left:${x}px;top:${y}px;`);
    rig.appendChild(ink); // doodles above the sets
    const cvs = document.createElement("canvas").getContext("2d");
    cvs.font = "30px 'DM Mono'";
    const CW = cvs.measureText("MMMMMMMMMM").width / 10; // DM Mono's advance at 30 px
    cvs.font = "28px 'DM Mono'";
    const CW28 = cvs.measureText("MMMMMMMMMM").width / 10;

    // ————————————————————— The issues list —————————————————————
    const L = sets.list;
    const LX = 860, LY = 60, LW = 1000, ROW0 = 214, RH = 104;
    const list = el("div", "d2-list", L, `left:${LX}px;top:${LY}px;width:${LW}px;height:${ROW0 + ISSUES.length * RH + 20}px;`);
    el("div", "d2-list-head", list, "", '<span>Issues</span><b class="d2-pill"><b class="roll"><span class="a"></span><span class="b"></span></b></b>');
    const tabs = el("div", "d2-tabs", list, "", '<span class="on"><i class="od"></i><b class="roll"><span class="a"></span><span class="b"></span></b> Open</span><span><i class="cl">✓</i>1,208 Closed</span>');
    const rolls = [list.querySelector(".d2-list-head .roll"), tabs.querySelector(".roll")].map((r) => ({ a: r.querySelector(".a"), b: r.querySelector(".b"), key: "" }));
    const ROWS = ISSUES.map(([n, title, , , up, av, ago], i) => {
      const at = i < 4 ? [T.r1, T.r2, T.r3, T.r4][i] : T.flurry + (i - 4) * T.flurryEvery;
      const r = el(
        "div",
        "d2-row",
        list,
        `top:${ROW0 + i * RH}px;`,
        `<i class="od"></i><div class="tt">${esc(title)}</div><div class="meta">#${n} opened ${ago} <span class="lbl">feature request</span></div><div class="av">${avatars(av, i)}</div><div class="up">👍 <b>${up}</b></div>`,
      );
      gsap.set(r, { opacity: 0 });
      tl.set(r, { opacity: 0 }, 0);
      tl.fromTo(r, { opacity: 0, y: -26 }, { opacity: 1, y: 0, duration: i < 4 ? 0.34 : 0.2, ease: "power3.out", immediateRender: false }, at);
      return { el: r, at, up, b: r.querySelector(".up b"), n, title, i };
    });
    allowAll(list);
    // The Open count: one more with every issue that lands, rolling like an odometer, ending at 412.
    const OPEN0 = 412 - ISSUES.length;
    function rollOpen(t) {
      let n = 0, last = -1;
      ROWS.forEach((r) => {
        if (t >= r.at) {
          n++;
          last = Math.max(last, r.at);
        }
      });
      const p = last < 0 ? 1 : E(seg(t, last, n > 4 ? 0.1 : 0.18));
      const cur = OPEN0 + n, prev = cur - (n > 0 ? 1 : 0);
      for (const r of rolls) {
        const key = `${cur}|${p.toFixed(3)}`;
        if (r.key === key) continue;
        r.key = key;
        r.a.textContent = String(prev);
        r.b.textContent = String(cur);
        r.a.style.transform = `translateY(${(-100 * p).toFixed(1)}%)`;
        r.b.style.transform = `translateY(${(100 * (1 - p)).toFixed(1)}%)`;
        r.a.style.opacity = p >= 1 ? "0" : "1";
      }
    }

    // ————————————————————— The board (the same tracker, at the payoff), stacked for portrait ——————————
    // To Do on top (three cards, then "+N more"), In progress below it (one card builds into its real
    // screen), Done below that: a wall of finished screen-cards, filled row by row down the column.
    const BX = 100, BW = 920;
    const COLS = [
      ["To Do", 90, 450],
      ["In progress", 560, 590],
      ["Done", 1170, 0],
    ];
    const colEls = [];
    const colCount = COLS.map(([name, y, h]) => {
      colEls.push(el("div", "d2-col", L, `left:${BX + 10}px;top:${y}px;width:${BW - 20}px;height:${h}px;`));
      const hd = el("div", "d2-col-head", L, `left:${BX + 34}px;top:${y + 16}px;`, `${name}<b>0</b>`);
      return hd.querySelector("b");
    });
    const SLOT0 = 160, STEP = 102, SLOTS = 3;
    const CARD_X = BX + 30, CARD_W = BW - 60;
    const more = el("div", "d2-more", L, `left:${BX + 10}px;top:${SLOT0 + SLOTS * STEP - 70}px;width:${BW - 20}px;height:${90 + 450 - (SLOT0 + SLOTS * STEP - 70)}px;`, "<span>+0 more</span>");
    const moreN = more.querySelector("span");
    const CARDS = ISSUES.slice(1).map(([n, title, , , , av], i) => {
      const c = el("div", "d2-card", L, `left:${CARD_X}px;top:${SLOT0}px;width:${CARD_W}px;`, `<div class="tt">${esc(title)}</div><div class="meta">#${n} · ${[3, 5, 2, 8, 3, 5][i % 6]} pts</div><div class="av">${avatars(av, i)}</div>`);
      return { el: c, j: i };
    });
    // The screen-cards: a header like the issue card, the real screen below it.
    const SC = { phone: { w: 300, body: 400, css: 390 }, desk: { w: 480, body: 300, css: 1100 } };
    const HEAD = 52;
    const scards = ISSUES.map(([n, title, name, theme, , , , kind], k) => {
      const g = SC[kind];
      const doc = name === "ORDER" ? ORDER : D[name];
      const card = el("div", `d2-sc ${kind}`, L, `left:0;top:0;width:${g.w}px;height:${HEAD + g.body}px;`);
      el("div", "hd", card, "", `${kind === "desk" ? "<i></i><i></i><i></i>" : ""}<span class="tt">${esc(title)}</span><span class="n">#${n}</span>`);
      const body = el("div", "bd", card, `top:${HEAD}px;width:${g.w}px;height:${g.body}px;`);
      const shot = tile(body, 0, 0, g.w, g.body, g.css, doc, theme, MODE, "flat", kind === "desk" ? "26px 34px" : "18px 14px");
      const scan = el("div", "scan", card);
      allowAll(card);
      return { card, body, shot, scan, kind, w: g.w, h: HEAD + g.body, k };
    });
    // Done is a wall, like film D's, but tall: rows filled left to right, each card a little turned.
    const WS = 0.64, WALL0 = 1250, GAPX = 26, GAPY = 54;
    const wall = [];
    {
      let x = BX + 40, y = WALL0, rowH = 0;
      scards.forEach((q, k) => {
        const w = q.w * WS, h = q.h * WS;
        if (x + w > BX + BW - 30) {
          x = BX + 40 + (wall.length % 2 ? 0 : 18);
          y += rowH + GAPY;
          rowH = 0;
        }
        wall.push({ x, y: y + window.hwHash(k, 4) * 8, w, h, rot: window.hwHash(k, 5) * 3 });
        x += w + GAPX + window.hwHash(k, 3) * 10;
        rowH = Math.max(rowH, h);
      });
    }
    const wallBottom = Math.max(...wall.map((c) => c.y + c.h)) + 60;
    colEls[2].style.height = `${wallBottom - 1170}px`;
    const board = el("div", "d2-board", L, `left:${BX}px;top:70px;width:${BW}px;height:${wallBottom - 40}px;`);
    L.insertBefore(board, L.firstChild);
    // Where things sit.
    const ipRect = (q) => ({ x: BX + (BW - q.w) / 2, y: 630, w: q.w, h: q.h });
    const todoRect = { x: CARD_X, y: SLOT0, w: CARD_W, h: 90 };
    // The schedule: faster and faster.
    const MOVES = CARDS.map((c, i) => {
      const f = i / (CARDS.length - 1);
      const s0 = T.flip1 + T.flipSpan * Math.pow(f, 0.62);
      const dA = 0.55 * (1 - 0.55 * f), dwell = 0.5 * (1 - 0.7 * f), dB = 0.5 * (1 - 0.45 * f);
      return { i, s0, s1: s0 + dA, l0: s0 + dA + dwell, l1: s0 + dA + dwell + dB, q: scards[i + 1] };
    });
    const boardEls = [board, ...L.querySelectorAll(".d2-col, .d2-col-head"), more, ...CARDS.map((c) => c.el), ...scards.map((q) => q.card)];
    allowAll(board);
    CARDS.forEach((c) => allowAll(c.el));

    // ————————————————————— The editor and the phone —————————————————————
    const Dk = sets.doc;
    // Portrait: the phone sits below the editor in the world; the camera cuts or travels between them.
    const PHX = 389, PHY = 1520;
    const editor = el("div", "d-win focus", Dk, "left:90px;top:70px;width:1040px;height:940px;");
    const ebar = el("div", "bar", editor, "", "<i></i><i></i><i></i>");
    const tab = el("div", "tab", ebar, "", "<b>{}</b>order-status.json");
    const code = el("div", "d-code", editor);
    const JSON_LINES = [
      "{",
      '  "surface": { "title": "Order #4821", … },',
      '  "components": [',
      '    { "component": "Status",',
      '      "title": "Out for delivery", … },',
      '    { "component": "DetailList",',
      '      "title": "Delivery", "items": [ … ] },',
      '    { "component": "Collection",',
      '      "label": "Items in this order", … },',
      '    { "component": "Action",',
      '      "label": "Change delivery time", … }',
      "  ],",
      '  "data": { "order": { "id": "4821", … } }',
      "}",
    ];
    const fJson = codeFile(code, JSON_LINES, "json");
    // Who writes it: you type the opening lines by hand, then your agent streams the rest.
    {
      let t0 = T.json;
      fJson.rows.slice(0, 3).forEach((r, i) => {
        typeLine(r, t0, 0.042, 11 + i);
        t0 = r.to + 0.12;
      });
      stream(fJson.rows.slice(3), T.agent, (T.jsonTo - T.agent) / (JSON_LINES.length - 3));
    }
    const author = el("div", "d2-author", code);
    const TSX_LINES = [
      'import { PolyxdSurface } from "@polyxd/react";',
      'import "@polyxd/react/styles.css";',
      'import "@polyxd/react/themes/material3.css";',
      "// one file per pack: carbon.css, shadcn.css…",
      "",
      "<PolyxdSurface",
      "  document={doc}",
      "  data={{ order }}",
      '  theme="material3"',
      '  mode="dark"',
      "  onAction={({ name, context }) => {",
      '    if (name === "order.reschedule")',
      "      rescheduleDelivery(context.orderId);",
      "  }}",
      "/>",
    ];
    const fTsx = codeFile(code, TSX_LINES, "js");
    stream(fTsx.rows, T.tsx, (T.tsxTo - T.tsx) / TSX_LINES.length);
    // One prop, retyped: a kind of design system per beat, then yours.
    const THEMES = [
      ["carbon", T.carbon],
      ["shadcn", T.shadcn],
      ["govuk", T.govuk],
      ["terminal", T.terminal],
      ["brutalist", T.brutalist],
      ["acme", T.acme],
    ];
    const KINDS = {
      material3: ["consumer app", "Material 3"],
      carbon: ["enterprise", "Carbon"],
      shadcn: ["developer, minimal", "shadcn/ui"],
      govuk: ["public service", "GOV.UK"],
      terminal: ["template", "terminal"],
      brutalist: ["template", "brutalist"],
      acme: ["yours", "acme"],
    };
    fTsx.rows[8].edits = THEMES.map(([th, at]) => ({ at, to: `  theme="${th}"` }));
    // The terminal: `npx polyxd pack`, as it printed (shared/film-d2-acme/pack-output.txt), wrapped at 38
    // columns the way a narrow terminal wraps it; the command uses a line continuation.
    const pane = terminal(Dk, [
      { cmd: "$", text: "npx polyxd pack ./acme.css \\", at: T.pack, per: 0.019 },
      { cmd: " ", text: " --dark ./acme-dark.css", at: T.pack + 0.55, per: 0.012, lead: 0 },
      { text: "read 40 variables from acme.css and 40", at: T.packOut, cls: "dim" },
      { text: "from acme-dark.css", at: T.packOut, cls: "dim" },
      { text: "mapped 54 of 87 contract tokens", at: T.packOut + 0.12, html: 'mapped <span class="hl">54 of 87</span> contract tokens' },
      { text: "wrote ./ds-acme", at: T.packOut + 0.24, cls: "ok" },
    ], 610 - 408, PHY + 50, 816, 430, "~/shop · zsh");
    pane.el.classList.add("t33");
    const paneTerm = pane;
    allowAll(pane.el);
    fTsx.rows.forEach((r) => allowAll(r.el));
    // The phone: the real renderer drawing the order document.
    const P = phone(Dk, PHX, PHY, ORDER, "material3");
    // The enterprise kind, as a desktop window: the spec's crm-accounts-list in Carbon, 1100 px wide.
    // Portrait: the window is cropped to its table (the sidebar off its left edge), over the phone.
    const desk = el("div", "d2-desk", Dk, `left:${PHX + 221 - 420}px;top:${PHY + 260}px;width:840px;height:520px;`);
    el("div", "bar", desk, "", '<i></i><i></i><i></i><span>Accounts · carbon</span>');
    const deskCrop = el("div", "", desk, "position:absolute;left:0;top:44px;right:0;bottom:0;overflow:hidden;");
    tile(deskCrop, -232, -96, 1100, 640, 1100, D["crm-accounts-list"], "carbon", MODE, "flat", "24px 30px");
    allowAll(desk);
    gsap.set(desk, { opacity: 0 });
    tl.set(desk, { opacity: 0 }, 0);
    tl.fromTo(desk, { opacity: 0, y: 90 }, { opacity: 1, y: 0, duration: 0.4, ease: E, immediateRender: false }, T.deskIn);
    tl.to(desk, { opacity: 0, y: 60, duration: 0.3, ease: "power2.in" }, T.deskOut);
    Dk.appendChild(pane.el); // the terminal rises over the phone
    const pMorph = tokenMorphDark(P.app);
    // Above the phone, the one line that matters, as a card: in Describe it the document's line for the
    // part being drawn; in Style it the prop, retyped live with the same edits as the file's row.
    const CARD_CX = PHX + 221;
    const CARD_Y = PHY - 160;
    const lineCard = el("div", "d2-linecard", Dk, `left:${CARD_CX - 330}px;top:${CARD_Y}px;width:660px;height:72px;`);
    const lineTx = el("div", "tx", lineCard);
    const propCard = el("div", "d2-linecard prop", Dk, `left:${CARD_CX - 230}px;top:${CARD_Y}px;width:460px;height:72px;`);
    const fProp = codeFile(propCard, ['theme="material3"'], "js");
    fProp.pad = 26;
    fProp.wrap.style.top = "12px";
    fProp.rows[0].edits = THEMES.map(([th, at]) => ({ at, to: `theme="${th}"` }));
    allowAll(lineCard);
    allowAll(propCard);
    const LINES_AT = [[T.a1 - 0.2, 3], [T.a2 - 0.2, 5], [T.a3 - 0.2, 7], [T.btnIn - 0.2, 9]];
    let lineKey = -1;
    gsap.set([lineCard, propCard], { opacity: 0 });
    tl.set([lineCard, propCard], { opacity: 0 }, 0);
    tl.fromTo(lineCard, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3, ease: E, immediateRender: false }, T.a1 - 0.25);
    tl.to(lineCard, { opacity: 0, duration: 0.3 }, T.arrowsOff + 0.4);
    tl.fromTo(propCard, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3, ease: E, immediateRender: false }, T.pushP + 0.3);
    tl.to(propCard, { opacity: 0, duration: 0.3 }, T.cap4 - 0.3); // the caption says it from here
    const part = {
      status: P.q(".pxd-status"),
      list: P.q(".pxd-detail-list"),
      items: P.q(".pxd-collection") || P.q(".pxd-collection-list"),
      button: Array.from(P.app.querySelectorAll(".pxd-button")).find((b) => /Change delivery time/.test(b.textContent)),
    };
    if (part.button) part.button.classList.add("d2-tap");
    const allParts = [part.status, part.list, part.items, part.button].filter(Boolean);
    gsap.set(allParts, { opacity: 0 });
    tl.set(allParts, { opacity: 0 }, 0);
    gsap.set(P.el, { opacity: 0 });
    tl.set(P.el, { opacity: 0 }, 0);
    tl.fromTo(P.el, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: E, immediateRender: false }, T.phoneIn);
    const reveal = (n, at) => n && tl.fromTo(n, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: E, immediateRender: false }, at);
    reveal(part.status, T.a1 + 0.55);
    reveal(part.list, T.a2 + 0.55);
    reveal(part.items, T.a3 + 0.55);
    reveal(part.button, T.btnIn + 0.2);

    // ————————————————————— The checks —————————————————————
    const C = sets.check;
    const checkTerm = terminal(
      C,
      [
        { cmd: "$", text: "npx polyxd-verify order-status.json \\", at: T.verify, per: 0.015 },
        { cmd: " ", text: "   --tasks tasks.json", at: T.verify + 0.62, per: 0.012, lead: 0 },
        { text: "100  order-status  (0 errors, 0 warnings", at: T.verifyOut, html: '<span class="hl">100</span>  order-status  (0 errors, 0 warnings' },
        { text: "agent 12/12)", at: T.verifyOut },
        { text: "1 documents · 12 renders · mean score", at: T.verifyOut + 0.18, cls: "dim" },
        { text: "100.0 · agent tasks 12/12", at: T.verifyOut + 0.18, cls: "dim" },
      ],
      882, 40, 760, 400, "~/shop · zsh",
    );
    checkTerm.el.classList.add("t29");
    // The default matrix: Material 3, Carbon and Ant Design × light and dark × 390 and 1100.
    const GX = 760, GY = 560, TW = 104, DW = 293, TH = 180, GAP = 20, LBL = 150;
    const cols = [
      ["light", 390, TW],
      ["light", 1100, DW],
      ["dark", 390, TW],
      ["dark", 1100, DW],
    ];
    const colX = [];
    const gridLabels = [];
    let cx = GX + LBL;
    cols.forEach(([mode, w, tw], i) => {
      colX.push(cx);
      if (i % 2 === 0) gridLabels.push(el("div", "d-label", C, `left:${cx}px;top:${GY - 78}px;font-size:24px;`, mode));
      gridLabels.push(el("div", "d-label muted", C, `left:${cx}px;top:${GY - 40}px;`, `${w}px`));
      cx += tw + GAP;
    });
    const tiles = [];
    ["material3", "carbon", "antd"].forEach((th, r) => {
      const y = GY + r * (TH + GAP);
      gridLabels.push(el("div", "d-label", C, `left:${GX}px;top:${y + TH / 2 - 16}px;`, th));
      cols.forEach(([mode, w, tw], c) => {
        const d = tile(C, colX[c], y, tw, TH, w, ORDER, th, mode);
        tiles.push({ el: d, r, c, x: colX[c], y, w: tw });
      });
    });
    tiles.forEach((tt) => {
      gsap.set(tt.el, { opacity: 0 });
      tl.set(tt.el, { opacity: 0 }, 0);
      tl.fromTo(tt.el, { opacity: 0, y: 30, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: E, immediateRender: false }, T.grid + 0.1 + (tt.r * 4 + tt.c) * 0.05);
    });
    gsap.set(gridLabels, { opacity: 0 });
    tl.set(gridLabels, { opacity: 0 }, 0);
    tl.to(gridLabels, { opacity: 1, duration: 0.4, ease: "power1.out" }, T.grid + 0.05);

    // A mounted surface may take focus; nothing on screen should show a focus ring.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    // ————————————————————— Doodles (registry hw family) —————————————————————
    const hand = (id, text, x, y, size, color) => {
      const d = el("div", "hand", ink, `left:${x}px;top:${y}px;font-size:${size}px;clip-path:inset(-20% 100% -30% -5%);${color ? `color:${color};` : ""}`);
      d.id = id;
      d.textContent = text;
      return d;
    };
    const writeOn = (n, t0, dur = 0.45) => tl.fromTo(n, { clipPath: "inset(-20% 100% -30% -5%)" }, { clipPath: "inset(-20% -5% -30% -5%)", duration: dur, ease: "power1.inOut", immediateRender: false }, t0);
    const fadeOff = (n, t0, dur = 0.3) => tl.to(n, { opacity: 0, duration: dur, ease: "power2.in" }, t0);
    const drawBox = (id, x, y, w, h, parent) => {
      const d = el("div", "hw-draw", parent || ink, `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`, `<svg viewBox="0 0 ${w} ${h}"></svg>`);
      d.id = id;
      return d;
    };
    const drawPath = (box, d, on, dur, color, width) => {
      const svg = box.querySelector("svg");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
      if (color) box.style.setProperty("--hw-draw-color", color);
      if (width) box.style.setProperty("--hw-draw-w", width);
      const applied = window.hwStrokeApply(p, "plain", { seed: box.id.length });
      window.hwDrawOn(tl, applied, on, dur, { ease: "power2.inOut" });
      return p;
    };
    const tickD = (w, h, seed) => {
      const j = (n) => window.hwHash(n, seed) * 3;
      return `M ${w * 0.08 + j(1)} ${h * 0.55 + j(2)} Q ${w * 0.25} ${h * 0.7 + j(3)} ${w * 0.38 + j(4)} ${h * 0.9 + j(5)} Q ${w * 0.6} ${h * 0.45} ${w * 0.94 + j(6)} ${h * 0.08 + j(7)}`;
    };
    const tick = (id, x, y, s, on, dur, parent, color) => {
      const b = drawBox(id, x, y, s, s * 0.86, parent);
      b.classList.add("glow");
      drawPath(b, tickD(s, s * 0.86, id.length + s), on, dur || 0.3, color || SIGNAL, Math.max(5, s / 10));
      return b;
    };
    const arrow = (id, a, b, on, bend, seed) => {
      const pad = 60;
      const x0 = Math.min(a.x, b.x) - pad, y0 = Math.min(a.y, b.y) - pad;
      const w = Math.abs(b.x - a.x) + pad * 2, h = Math.abs(b.y - a.y) + pad * 2;
      const box = drawBox(id, x0, y0, w, h);
      const ax = a.x - x0, ay = a.y - y0, bx = b.x - x0, by = b.y - y0;
      const j = (n) => window.hwHash(n, seed || 3) * 8;
      const dx = bx - ax, dy = by - ay;
      const c1x = ax + dx * 0.35 + j(1), c1y = ay + dy * 0.1 - (bend || 70) + j(2);
      const c2x = ax + dx * 0.72 + j(3), c2y = by - (bend || 70) * 0.35 + j(4);
      const ang = Math.atan2(by - c2y, bx - c2x);
      const hd = (da) => `M ${bx.toFixed(1)} ${by.toFixed(1)} l ${(Math.cos(ang + Math.PI + da) * 30).toFixed(1)} ${(Math.sin(ang + Math.PI + da) * 30).toFixed(1)}`;
      drawPath(box, `M ${ax.toFixed(1)} ${ay.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${bx.toFixed(1)} ${by.toFixed(1)}`, on, 0.45, SIGNAL, 6);
      drawPath(box, `${hd(0.5)} ${hd(-0.5)}`, on + 0.42, 0.14, SIGNAL, 6);
      window.hwBoil(tl, "#" + id, { frameDrop: 3, seed: seed || 3, amp: 1.1, rot: 0.25 });
      return box;
    };
    const callout = (id, r, on, off) => {
      const Wc = Math.max(90, (r.w / 0.84) * 1.14), Hc = Math.max(70, (r.h / 0.72) * 1.2);
      const d = el("div", "hw-callout", ink, `left:${r.cx - Wc / 2}px;top:${r.cy - Hc / 2}px;width:${Wc}px;height:${Hc}px;`);
      d.id = id;
      d.innerHTML = `<div class="hw-co-boil"><div class="hw-co-deform"><svg viewBox="0 0 ${Wc} ${Hc}"><path class="hw-co-outline"/><path class="hw-co-scribble"/></svg></div><div class="hw-co-conn-layer"><svg viewBox="0 0 ${Wc} ${Hc}"><path class="hw-co-connector"/></svg></div><div class="hw-co-pop"><div class="hw-co-label"></div></div></div>`;
      window.hwCalloutBuild("#" + id, { scribble: false, seed: id.length * 7, label: "", labelAt: "left", strokeType: "plain", boil: "calm", connector: false });
      window.hwCalloutOn(tl, "#" + id, on);
      window.hwCalloutOff(tl, "#" + id, off);
      return d;
    };

    // Code positions in world px (rows are laid out once; the camera never moves them).
    const rowAt = (setK, f, i, c0, c1) => {
      const r = layoutRect(f.rows[i].el, sets[setK]);
      const text = f.rows[i].text;
      const a = c0 === undefined ? text.search(/\S/) : c0, b = c1 === undefined ? text.length : c1;
      const x = SET[setK][0] + r.x + 96 + a * CW, w = (b - a) * CW;
      const y = SET[setK][1] + r.y;
      return { x, y, w, h: 48, cx: x + w / 2, cy: y + 24, end: x + w };
    };
    const inWorld = (setK, rr) => ({ ...rr, x: rr.x + SET[setK][0], y: rr.y + SET[setK][1], cx: rr.cx + SET[setK][0], cy: rr.cy + SET[setK][1] });

    // The backlog: "+37 this week" with an arrow at the Open count.
    const plus = hand("d-plus", "+37 this week", LX + 470, LY + 34, 96, SIGNAL);
    writeOn(plus, T.plus, 0.55);
    fadeOff(plus, T.veil);
    const plusAim = el("div", "", ink, `position:absolute;left:${LX + 400}px;top:${LY + 92}px;width:120px;height:80px;transform:rotate(170deg);transform-origin:0 70%;`);
    const plusArrow = el("div", "hw-arrow", plusAim, "left:0;top:0;width:120px;height:80px;--hw-arrow-color:#ff6e40;", '<svg viewBox="0 0 120 80"></svg>');
    plusArrow.id = "d-plus-arrow";
    window.hwArrowBuild("#d-plus-arrow", { arrowStyle: "gentle", strokeType: "plain", boil: "calm" });
    window.hwArrowOn(tl, "#d-plus-arrow", T.plus + 0.5);
    window.hwArrowOff(tl, "#d-plus-arrow", T.veil);

    // 1 · Describe it: from each part of the document to the part it becomes.
    const tS = inWorld("doc", inPhone(P, part.status)), tL = inWorld("doc", inPhone(P, part.list)), tI = inWorld("doc", inPhone(P, part.items));
    const lc = { x: SET.doc[0] + CARD_CX - 300, y: SET.doc[1] + CARD_Y + 76 };
    const arrows = [
      arrow("d-ar1", lc, { x: tS.x - 18, y: tS.y + Math.min(50, tS.h / 2) }, T.a1 + 0.15, -40, 3),
      arrow("d-ar2", { x: lc.x - 20, y: lc.y }, { x: tL.x - 18, y: tL.y + Math.min(60, tL.h / 2) }, T.a2 + 0.15, -60, 5),
      arrow("d-ar3", { x: lc.x - 40, y: lc.y }, { x: tI.x - 18, y: tI.y + Math.min(70, tI.h / 2) }, T.a3 + 0.15, -80, 7),
    ];
    tl.to(arrows[0], { opacity: 0.22, duration: 0.3 }, T.a2);
    tl.to(arrows[1], { opacity: 0.22, duration: 0.3 }, T.a3);
    tl.to(arrows, { opacity: 0, duration: 0.3, ease: "power2.in" }, T.arrowsOff);

    // 2 · Style it: a circle round the theme, "one prop".
    const prR = layoutRect(fProp.rows[0].el, Dk);
    const THR = { x: SET.doc[0] + prR.x + 26 - 6, y: SET.doc[1] + prR.y, w: 17 * CW + 12, h: 48 };
    THR.cx = THR.x + THR.w / 2;
    THR.cy = THR.y + 24;
    callout("d-circ-theme", THR, T.circleP, T.circlePOff);
    const oneProp = hand("d-oneprop", "one prop", SET.doc[0] + CARD_CX - 250, SET.doc[1] + CARD_Y - 80, 56, SIGNAL);
    writeOn(oneProp, T.noteP, 0.4);
    fadeOff(oneProp, T.circlePOff);
    // What kind of system the prop names, pinned beside it; it changes as each retype lands.
    const kind = el("div", "d2-kind v", ink, `left:${SET.doc[0] + CARD_CX}px;top:${SET.doc[1] + CARD_Y + 88}px;`);
    gsap.set(kind, { opacity: 0 });
    tl.set(kind, { opacity: 0 }, 0);
    tl.fromTo(kind, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.3, ease: E, immediateRender: false }, T.noteP + 0.15);
    tl.to(kind, { opacity: 0, duration: 0.3 }, T.cap4 - 0.3);
    THEMES.forEach(([, at]) => tl.fromTo(kind, { scale: 0.9 }, { scale: 1, duration: 0.3, ease: "back.out(2.4)", immediateRender: false }, at + 0.6));
    let kindKey = "";

    // 3 · Wire it: a circle round the host's handler.
    const SM = rowAt("doc", fTsx, 12);
    callout("d-circ-send", SM, T.circleS, T.cap5Out);

    // 4 · Trust it: a wave of ticks over the matrix, a circle round the score.
    const checkInk = [];
    tiles.forEach((tt, i) => {
      const x = SET.check[0] + tt.x + tt.w - 26, y = SET.check[1] + tt.y - 18;
      checkInk.push(tick(`d-gt${i}`, x, y, 44, T.wave + (tt.r + tt.c) * 0.12, 0.22, null, OK));
    });
    const sRow = layoutRect(checkTerm.rows[2].el, C);
    callout("d-circ-100", { x: 0, y: 0, w: 70, h: 44, cx: SET.check[0] + sRow.x + 26, cy: SET.check[1] + sRow.y + 23 }, T.circle100, T.journey);

    // ——— Payoff: the board (render(t) places the cards) ———
    gsap.set(boardEls, { opacity: 0 });
    tl.set(boardEls, { opacity: 0 }, 0);
    tl.set(boardEls, { opacity: 1 }, T.journey + 0.2);
    tl.set(list, { opacity: 0 }, T.journey + 0.2);
    const lastLand = Math.max(...MOVES.map((m) => m.l1));
    tick("d-cleartick", BX + 300, 96, 64, Math.max(T.cleared, lastLand) + 0.05, 0.3, L, OK);
    // Each finished screen gets its orange tick as it lands on the wall.
    wall.forEach((c, k) => tick(`d-wt${k}`, c.x + c.w - 30, c.y - 26, 50, k === 0 ? T.journey + 0.8 : MOVES[k - 1].l1 - 0.05, 0.22, L));
    // The other sets leave while the camera flies home, so the pulled-back wall stands alone.
    tl.set([sets.doc, sets.check], { opacity: 0 }, T.journey + 0.35);
    const lerpR = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });
    const departed = (t) => MOVES.reduce((n, m) => n + E(seg(t, m.s0, 0.3)), 0);
    function placeBoard(t) {
      if (t < T.journey + 0.2) return;
      const dep = departed(t);
      // To Do: the rest move up a slot as each leaves; six show, the column never spills.
      CARDS.forEach((c, j) => {
        const m = MOVES[j];
        const slot = j - dep;
        const gone = t >= m.s0;
        const op = gone ? 0 : clamp(SLOTS - 0.35 - slot) * clamp(slot + 1);
        c.el.style.transform = `translateY(${(Math.max(0, slot) * STEP).toFixed(1)}px)`;
        c.el.style.opacity = op.toFixed(3);
      });
      // The screen-cards: To Do → In progress (the screen assembles on the card) → the wall in Done.
      scards.forEach((q, k) => {
        let r, sc = 1, rot = 0, build = 1;
        const cell = wall[k];
        const at = { x: cell.x, y: cell.y, w: q.w, h: q.h };
        if (k === 0) {
          r = at;
          sc = WS;
          rot = cell.rot;
        } else {
          const m = MOVES[k - 1];
          if (t < m.s0) {
            q.card.style.opacity = "0";
            return;
          }
          if (t < m.s1) r = lerpR(todoRect, ipRect(q), E(seg(t, m.s0, m.s1 - m.s0)));
          else if (t < m.l0) r = ipRect(q);
          else {
            const p = E(seg(t, m.l0, m.l1 - m.l0));
            r = lerpR(ipRect(q), at, p);
            sc = lerp(1, WS, p);
            rot = lerp(0, cell.rot, p);
          }
          build = seg(t, m.s0 + (m.s1 - m.s0) * 0.35, (m.l0 - m.s0) * 0.75);
        }
        q.card.style.opacity = "1";
        q.card.style.transformOrigin = "0 0";
        q.card.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
        q.card.style.width = `${r.w.toFixed(1)}px`;
        q.card.style.height = `${r.h.toFixed(1)}px`;
        q.body.style.clipPath = `inset(0 0 ${((1 - build) * 100).toFixed(2)}% 0)`;
        q.scan.style.top = `${HEAD + (q.h - HEAD) * build - 2}px`;
        q.scan.style.opacity = build > 0 && build < 1 ? "1" : "0";
      });
      const toDo = Math.round(449 * (1 - dep / MOVES.length));
      const ip = MOVES.filter((m) => t >= m.s0 && t < (m.l0 + m.l1) / 2).length;
      const done = MOVES.filter((m) => t >= (m.l0 + m.l1) / 2).length;
      const vals = [toDo, ip, done === MOVES.length ? 450 : 1 + Math.round((449 * done) / MOVES.length)];
      colCount.forEach((b, i) => {
        const v = String(vals[i]);
        if (b.textContent !== v) b.textContent = v;
      });
      const left = Math.max(0, toDo - Math.min(SLOTS, MOVES.length - Math.floor(dep)));
      const mt = `+${left} more`;
      if (moreN.textContent !== mt) moreN.textContent = mt;
      more.style.opacity = String(clamp(left / 20));
    }

    // ——— The mark ———
    $("d-turn-mark").innerHTML = M.svg("d-turn-svg", 170);
    const turnMark = M.driver($("d-turn-svg"), [
      { t: T.markIn + 0.35, state: "looking" },
      { t: T.blink, state: "blink" },
      { t: T.hit - 0.7, state: "attention" },
    ]);

    // ——— Captions ———
    const capWords = (id) => Array.from($(id).querySelectorAll(".w"));
    const wordsIn = (id, t0, stagger = 0.09) => capWords(id).forEach((w, i) => tl.fromTo(w, { clipPath: "inset(-10% 100% -20% 0)" }, { clipPath: "inset(-10% -2% -20% 0)", duration: 0.32, ease: "power2.out", immediateRender: false }, t0 + i * stagger));
    const lineOut = (id, t0) => tl.fromTo(`#${id} .line`, { yPercent: 0 }, { yPercent: -115, duration: 0.35, ease: "power2.in", immediateRender: false }, t0);
    const CAPS = [
      ["cap-1", T.cap1, T.cap1Out],
      ["cap-2", T.cap2, T.cap2Out],
      ["cap-3", T.cap3, T.cap3Out],
      ["cap-4", T.cap4, T.cap4Out],
      ["cap-5", T.cap5, T.cap5Out],
      ["cap-6", T.cap6, T.cap6Out],
      ["cap-7", T.cap7, T.cap7Out],
    ];
    tl.set("#d-scrim", { opacity: 0 }, 0);
    for (const [a, b] of []) {
      tl.fromTo("#d-scrim", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out", immediateRender: false }, a - 0.15);
      tl.to("#d-scrim", { opacity: 0, duration: 0.3, ease: "power1.in" }, b + 0.1);
    }
    tl.set("#d-lscrim", { opacity: 0 }, 0);
    for (const [a, b] of [[T.cap1, T.cap1Out], [T.cap3, T.cap3Out], [T.cap6, T.cap6Out], [T.cap4, T.cap4Out], [T.cap5, T.cap5Out], [T.cap7, T.cap7Out]]) {
      tl.fromTo("#d-lscrim", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out", immediateRender: false }, a - 0.15);
      tl.to("#d-lscrim", { opacity: 0, duration: 0.3, ease: "power1.in" }, b + 0.1);
    }
    // With the handover to the agent, one supporting line under the caption: how an agent gets Polyxd.
    tl.set("#d-mcp", { opacity: 0 }, 0);
    tl.fromTo("#d-mcp", { opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.45, ease: "power2.out", immediateRender: false }, T.agent);
    tl.to("#d-mcp", { opacity: 0, duration: 0.3, ease: "power2.in" }, T.cap3Out);
    for (const [id, a, b] of CAPS) {
      gsap.set(`#${id} .line`, { yPercent: 115 });
      tl.set(`#${id} .line`, { yPercent: 115 }, 0);
      tl.set(`#${id} .line`, { yPercent: 0 }, a);
      wordsIn(id, a);
      lineOut(id, b);
    }

    // ——— Groups, windows, presses (GSAP) ———
    tl.set(["#world", "#d-ground"], { opacity: 0 }, 0);
    tl.to(["#world", "#d-ground"], { opacity: 1, duration: 0.35, ease: "power1.out" }, T.boardIn);
    // The outro's glyph field fades in over the board; the board goes under it.
    tl.to(["#world", "#d-ground"], { opacity: 0, duration: 0.6, ease: "power2.in" }, T.outro + 0.35);
    tl.set("#d-veil", { opacity: 0 }, 0);
    tl.to("#d-veil", { opacity: 0.84, duration: 0.45, ease: "power1.out" }, T.veil);
    tl.set("#d-veil", { opacity: 0 }, T.hit);
    tl.set("#d-turn-mark", { opacity: 0 }, 0);
    tl.fromTo("#d-turn-mark", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.45, ease: E, immediateRender: false }, T.markIn);
    tl.to("#d-turn-mark", { opacity: 0, duration: 0.3, ease: "power2.in" }, T.hit - 0.15);
    // The editor: the issue becomes it on the hit (render owns the flying card).
    gsap.set(editor, { opacity: 0 });
    tl.set(editor, { opacity: 0 }, 0);
    tl.set(editor, { opacity: 1 }, T.hit + 0.25);
    tl.set(ROWS[0].el, { opacity: 0 }, T.peel);
    tl.to(list, { opacity: 0, duration: 0.4 }, T.markIn - 0.4); // the card is alone with the mark
    // The files: JSON leaves up as the TSX file takes its place; the tab follows.
    gsap.set([fTsx.wrap], { opacity: 0 });
    tl.set(fTsx.wrap, { opacity: 0 }, 0);
    tl.fromTo(fJson.wrap, { y: 0, opacity: 1 }, { y: -160, opacity: 0, duration: 0.4, ease: "power2.in", immediateRender: false }, T.swap);
    tl.set(fTsx.wrap, { opacity: 1 }, T.swap + 0.3);
    gsap.set(pane.el, { opacity: 0 });
    tl.set(pane.el, { opacity: 0 }, 0);
    tl.fromTo(pane.el, { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: 0.4, ease: E, immediateRender: false }, T.pane);
    tl.to(pane.el, { opacity: 0, y: 80, duration: 0.4, ease: "power2.in" }, T.up);
    // Context dims while one line is lit (code-highlight).
    const bandAt = (f, i, c0, c1, on, off) => {
      const r = f.rows[i];
      const text = r.text;
      const a = c0 === undefined ? text.search(/\S/) : c0, b = c1 === undefined ? text.length : c1;
      const band = el("div", "d-band", r.el.parentNode, `top:${r.el.offsetTop}px;left:${96 + a * CW - 12}px;width:${(b - a) * CW + 24}px;`);
      tl.set(band, { opacity: 0, scaleX: 0 }, 0);
      tl.fromTo(band, { opacity: 1, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.28, ease: "power2.inOut", immediateRender: false }, on);
      tl.to(band, { opacity: 0, duration: 0.25 }, off);
      return band;
    };
    const dim = (f, keep, on, off) => {
      const rows = f.rows.filter((r) => !keep.includes(r.i)).map((r) => r.el);
      tl.to(rows, { opacity: 0.38, duration: 0.3, ease: "power2.inOut" }, on);
      tl.to(rows, { opacity: 1, duration: 0.3, ease: "power2.inOut" }, off);
    };
    bandAt(fJson, 3, undefined, undefined, T.a1, T.a2);
    bandAt(fJson, 5, undefined, undefined, T.a2, T.a3);
    bandAt(fJson, 7, undefined, undefined, T.a3, T.btnIn);
    bandAt(fJson, 9, undefined, undefined, T.btnIn, T.arrowsOff + 0.2);
    dim(fJson, [3, 5, 7, 9], T.a1, T.arrowsOff + 0.2);
    dim(fTsx, [8], T.pushP, T.poseR);
    bandAt(fTsx, 10, undefined, undefined, T.cardLand, T.down);
    bandAt(fTsx, 11, undefined, undefined, T.cardLand + 0.06, T.down);
    bandAt(fTsx, 12, undefined, undefined, T.cardLand + 0.12, T.down);
    dim(fTsx, [10, 11, 12], T.poseR + 0.2, T.down + 0.6);
    // The tap on "Change delivery time".
    if (part.button) {
      const b = part.button;
      tl.fromTo(b, { "--finger": 0 }, { "--finger": 1, duration: 0.18, ease: E, immediateRender: false }, T.press);
      tl.fromTo(b, { "--press": 0 }, { "--press": 1, duration: 0.14, ease: E, immediateRender: false }, T.press + 0.14);
      tl.fromTo(b, { "--press": 1 }, { "--press": 0, duration: 0.3, ease: E, immediateRender: false }, T.press + 0.42);
      tl.fromTo(b, { "--finger": 1 }, { "--finger": 0, duration: 0.25, ease: E, immediateRender: false }, T.press + 0.46);
    }
    // The event the tap sends: out of the button, onto the handler.
    const evt = el("div", "d-event", ink, "left:0;top:0;", '{ name: <span class="s">"order.reschedule"</span>,\n  context: { orderId: <span class="s">"4821"</span> } }');
    allowAll(evt);
    gsap.set(evt, { opacity: 0 });
    tl.set(evt, { opacity: 0 }, 0);
    tl.set(evt, { opacity: 1 }, T.card);
    tl.to(evt, { opacity: 0, duration: 0.3, ease: "power2.in" }, T.down + 0.1);
    const evtFrom = part.button ? inWorld("doc", inPhone(P, part.button)) : { cx: 3000 + 1500, cy: 700 };
    const hRow = rowAt("doc", fTsx, 10);
    const evtTo = { x: hRow.x + 8, y: hRow.y - 176 };
    tl.to({ t: 0 }, { t: T.end, duration: T.end, ease: "none" }, 0);

    // ——— The camera: poses on a keyframe ladder; render() interpolates ———
    const pose = (o) => Object.assign({ fx: 960, fy: 540, vx: 960, vy: 540, s: 1, rx: 0, ry: 0 }, o);
    const with_ = (p, o) => Object.assign({}, p, o);
    const LCX = LX + LW / 2;
    // Portrait poses: the picture's centre line is the safe zone's (x 510); captions sit at y 262–600.
    const ROW_Y = (i) => 156 + 48 * i; // a code row's top, editor-local world y
    const LIST_TOP = pose({ fx: LCX, fy: 300, vx: SX, vy: 510, s: 0.88 }); // the list fills the width
    const LIST_LOW = pose({ fx: LCX, fy: 300, vx: SX, vy: 900, s: 0.88 }); // under the caption
    const LIST_W = pose({ fx: LCX, fy: LY, vx: SX, vy: 690, s: 0.46 }); // the whole list, overflowing
    // Code zooms: text column 0 at x 64, 30 px × 1.17 = 35 px on screen.
    const CODE_J = pose({ fx: 3186, fy: ROW_Y(0), vx: 60, vy: 730, s: 1.14 });
    const CODE_T = pose({ fx: 3186, fy: ROW_Y(0), vx: 64, vy: 430, s: 1.17 });
    const CODE_H = pose({ fx: 3186, fy: ROW_Y(10), vx: 60, vy: 1000, s: 1.14 });
    // The phone, below the editor: whole, centred in the safe zone, the line card above it.
    const PH = pose({ fx: 3000 + PHX + 221, fy: PHY + 463, vx: SX, vy: 1010, s: 1.05 });
    const PH_C = pose({ fx: 3000 + PHX + 221, fy: PHY + 463, vx: SX, vy: 1062, s: 0.92 }); // under a caption
    const VT = pose({ fx: 3000 + 882 + 380, fy: SET.check[1] + 40 + 200, vx: SX, vy: 760, s: 1.18 });
    const VG = pose({ fx: 3000 + 760 + 502, fy: SET.check[1] + 40, vx: SX, vy: 470, s: 0.86 });
    // The board, stacked: To Do and In progress and the wall's top; then the whole wall.
    const BOARDV1 = pose({ fx: BX + BW / 2, fy: 90, vx: SX, vy: 300, s: 0.84 });
    // The wall is taller than the frame: the camera settles on its top, then glides down it, legible.
    const WALL_TOP = pose({ fx: BX + BW / 2, fy: 1170, vx: SX, vy: 640, s: 0.66 });
    const WALL_BOT = pose({ fx: BX + BW / 2, fy: wallBottom, vx: SX, vy: 1480, s: 0.66 });
    const CAM = [
      [0, LIST_TOP],
      [T.r4 + 0.3, LIST_TOP, "hold"],
      [T.cap1 + 0.1, LIST_LOW, "brand"],
      [T.flurry + 0.2, with_(LIST_LOW, { s: 0.86 }), "sine"],
      [T.pullTo, LIST_W, "decel"], // the list, overflowing
      [T.hit - 0.01, with_(LIST_W, { s: 0.48 }), "sine"],
      [T.hit, with_(CODE_J, { rx: 8, ry: -10, s: 1.02 }), "cut"], // the hit: the editor, tilted, settling flat
      [T.hit + 1.1, CODE_J, "decel"],
      [T.wide, with_(CODE_J, { s: 1.18 }), "sine"],
      [T.wide + 0.8, PH, "inout"], // down to the phone
      [T.swap - 0.1, with_(PH, { s: 1.06 }), "sine"],
      [T.swap + 0.6, CODE_T, "inout"], // up to Order.tsx
      [T.pushP, with_(CODE_T, { s: 1.18 }), "sine"],
      [T.pushP + 0.7, PH, "inout"], // down to the phone and its prop
      [T.cap4 - 0.4, with_(PH, { s: 1.05 }), "sine"],
      [T.cap4 + 0.3, PH_C, "brand"],
      [T.poseR, with_(PH_C, { s: 0.93 }), "sine"],
      [T.poseR + 0.45, PH, "brand"],
      [T.card, with_(PH, { s: 1.05 }), "sine"],
      [T.cardLand + 0.3, CODE_H, "inout"], // follow the event up to the handler
      [T.down, with_(CODE_H, { s: 1.15 }), "sine"],
      [T.down + 0.7, VT, "inout"], // travel to the checks
      [T.verifyEnter, with_(VT, { s: 1.19 }), "sine"],
      [T.grid + 0.9, VG, "brand"],
      [T.journey, with_(VG, { s: 0.87 }), "sine"],
      [T.journey + 0.5, pose({ fx: 2400, fy: 1300, vx: SX, vy: 960, s: 0.3 }), "inout"], // the long flight home
      [T.journey + T.journeyDur, with_(BOARDV1, { s: 0.8 }), "decel"],
      [Math.max(T.cleared, lastLand) + 0.35, BOARDV1, "sine"],
      [Math.max(T.cleared, lastLand) + 1.3, WALL_TOP, "brand"], // down to the wall of finished screens
      [T.outro + 0.6, WALL_BOT, "sine"], // and along it, every screen ticked
      [T.end, WALL_BOT, "hold"],
    ];
    const EASES = { hold: () => 0, decel: out3, sine, inout: inOut, brand: E, in3, cut: () => 1 };
    const camAt = (t) => {
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
    };
    const cuts = CAM.filter((c) => c[2] === "cut").map((c) => c[0]);
    const persp = $("persp");
    const blurNode = $("d-blur");
    const ground = $("d-ground");
    const screenOf = (c, wx, wy) => ({ x: c.vx + c.s * (wx - c.fx), y: c.vy + c.s * (wy - c.fy) });
    function applyCam(t) {
      const c = camAt(t);
      rig.style.transform = `translate(${c.vx.toFixed(2)}px, ${c.vy.toFixed(2)}px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg) scale(${c.s.toFixed(4)}) translate(${(-c.fx).toFixed(2)}px, ${(-c.fy).toFixed(2)}px)`;
      // The ground drifts a little with the camera (parallax), so camera moves read on the dark.
      const gx = ((c.vx - c.s * c.fx) * 0.12) % 24, gy = ((c.vy - c.s * c.fy) * 0.12) % 24;
      ground.style.backgroundPosition = `${gx.toFixed(2)}px ${gy.toFixed(2)}px`;
      let bx = 0, by = 0;
      if (!cuts.some((k) => t >= k && t < k + 0.07)) {
        const pc = camAt(t - 1 / 30);
        const wx = c.fx + (FW / 2 - c.vx) / c.s, wy = c.fy + (FH / 2 - c.vy) / c.s;
        const sp = screenOf(pc, wx, wy);
        const dx = sp.x - FW / 2, dy = sp.y - FH / 2;
        const v = Math.hypot(dx, dy);
        const b = Math.min(18, Math.max(0, (v - 24) * 0.06));
        if (b > 0.3) {
          bx = (Math.abs(dx) / v) * b;
          by = (Math.abs(dy) / v) * b;
        }
      }
      blurNode.setAttribute("stdDeviation", `${bx.toFixed(2)} ${by.toFixed(2)}`);
      persp.style.filter = bx + by > 0.3 ? "url(#d-whip)" : "";
      return c;
    }

    // ——— render(t) ———
    const fly = $("d-fly");
    const flyText = fly.querySelector(".t");
    const row0 = ROWS[0];
    function render(t) {
      applyCam(t);
      // The counters: Open climbs; 👍 ticks up on the hero rows; the board's columns run down.
      rollOpen(t);
      ROWS.slice(0, 4).forEach((r) => {
        const v = String(Math.round(r.up - 24 * (1 - out3(seg(t, r.at, T.veil - r.at)))));
        if (r.b.textContent !== v) r.b.textContent = v;
      });
      placeBoard(t);
      // #933 lifts out of the list, flies to the centre and becomes the editor on the hit.
      if (t >= T.peel && t < T.hit + T.morphDur) {
        const camP = camAt(T.peel);
        const s0 = screenOf(camP, LX, LY + ROW0);
        const from = { x: s0.x, y: s0.y, w: LW * camP.s, h: RH * camP.s, r: 0 };
        const MW = 800, MH = 140, MY = 880;
        const mid = { w: MW, h: MH, x: SX - MW / 2, y: MY, r: -1.5 };
        const edA = with_(CODE_J, { rx: 0, ry: 0, s: 1.02 });
        const e0 = screenOf(edA, SET.doc[0] + 90, SET.doc[1] + 70);
        const to = { x: e0.x, y: e0.y, w: 1040 * edA.s, h: 940 * edA.s, r: 0 };
        let g, bg = 0, txt = 1;
        if (t < T.land) {
          const p = E(seg(t, T.peel, T.land - T.peel));
          g = {};
          for (const k of ["x", "y", "w", "h", "r"]) g[k] = lerp(from[k], mid[k], p);
          g.y -= Math.sin(p * Math.PI) * 50;
        } else if (t < T.hit) {
          // Alone in the centre, read; a slow push-in while the mark looks and the question arrives.
          const k = 1 + 0.06 * sine(seg(t, T.land, T.hit - T.land));
          g = { w: mid.w * k, h: mid.h * k, x: SX - (mid.w * k) / 2, y: MY + MH / 2 - (MH / 2) * k + 30 * sine(seg(t, T.markIn - 0.3, 0.8)), r: mid.r * (1 - seg(t, T.land, 1.5)) };
        } else {
          const p = E(seg(t, T.hit, T.morphDur));
          const k0 = 1.06, held = { w: mid.w * k0, h: mid.h * k0, x: SX - (mid.w * k0) / 2, y: MY + MH / 2 - (MH / 2) * k0 + 30, r: 0 };
          g = {};
          for (const k of ["x", "y", "w", "h", "r"]) g[k] = lerp(held[k], to[k], p);
          bg = p;
          txt = 1 - clamp(p * 1.8);
        }
        fly.style.opacity = t < T.hit ? "1" : (1 - clamp((bg - 0.6) / 0.4)).toFixed(3);
        fly.style.left = `${g.x.toFixed(1)}px`;
        fly.style.top = `${g.y.toFixed(1)}px`;
        fly.style.width = `${g.w.toFixed(1)}px`;
        fly.style.height = `${g.h.toFixed(1)}px`;
        fly.style.transform = `rotate(${g.r.toFixed(2)}deg)`;
        fly.style.borderRadius = `${lerp(14, 22, bg).toFixed(1)}px`;
        flyText.style.opacity = txt.toFixed(3);
        flyText.style.transform = `scale(${(g.w / 860).toFixed(3)})`;
      } else fly.style.opacity = "0";
      // The editor: the tab and the files.
      const tabName = t >= T.swap + 0.2 ? "<b>tsx</b>Order.tsx" : "<b>{}</b>order-status.json";
      if (tab.innerHTML !== tabName) tab.innerHTML = tabName;
      renderFile(fJson, t, CW);
      {
        const on = t >= T.json - 0.2 && t < T.jsonTo + 0.5;
        const agent = t >= T.agent - 0.15;
        const html = agent ? "<b>✦</b> agent · via MCP" : "<i></i> you";
        if (author.__html !== html) {
          author.innerHTML = html;
          author.className = `d2-author ${agent ? "ag" : "you"}`;
          author.__html = html;
        }
        author.style.opacity = on ? String(clamp((T.jsonTo + 0.5 - t) / 0.3)) : "0";
        const cl = parseFloat(fJson.caret.style.left) || 96, ct = parseFloat(fJson.caret.style.top) || 0;
        author.style.transform = `translate(${(cl + 14).toFixed(1)}px, ${(ct + 26 - 4).toFixed(1)}px)`;
      }
      renderFile(fTsx, t, CW);
      renderFile(fProp, t, CW);
      {
        let li = 3;
        for (const [at, i] of LINES_AT) if (t >= at) li = i;
        if (li !== lineKey) {
          lineKey = li;
          lineTx.innerHTML = highlight(JSON_LINES[li].trim(), "json");
        }
      }
      renderTerm(paneTerm, t);
      renderTerm(checkTerm, t);
      // One prop: the phone re-themes once each retype lands.
      let th = { theme: "material3" };
      let prev = "material3";
      for (const [name, at] of THEMES) {
        const a = at + 0.6;
        if (t < a) break;
        if (t < a + T.morph) {
          th = { from: prev, to: name, p: E(seg(t, a, T.morph)) };
          break;
        }
        th = { theme: name };
        prev = name;
      }
      pMorph(th);
      if (t >= T.deskIn - 0.1 && !desk.__allowed) {
        allowAll(desk); // the renderer may re-render after mount
        desk.__allowed = true;
      }
      const kn = th.theme || (th.p < 0.5 ? th.from : th.to);
      if (kn !== kindKey) {
        kindKey = kn;
        kind.innerHTML = `<b>${KINDS[kn][0]}</b><span>${KINDS[kn][1]}</span>`;
      }
      // The event card: out of the button on an arc, onto the handler, where it stays to be read.
      if (t >= T.card) {
        const p = E(seg(t, T.card, T.cardLand - T.card));
        const x = lerp(evtFrom.cx - 280, evtTo.x, p), y = lerp(evtFrom.cy - 60, evtTo.y, p) - Math.sin(p * Math.PI) * 160;
        const s = lerp(0.5, 1, clamp(p * 1.6)) * (1 + 0.06 * Math.sin(clamp((t - T.cardLand) / 0.25) * Math.PI));
        evt.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)}) rotate(${lerp(-8, 0, p).toFixed(2)}deg)`;
      }
      turnMark(t);
    }
    void row0;
    void CW28;
    // The world is one wide canvas the camera travels over: its sets sit far outside the frame on purpose.
    [rig, ...rig.querySelectorAll(".set, .set > *, #ink > *, .d-phone")].forEach((n) => n.setAttribute("data-layout-allow-overflow", ""));
    if (tl.__hwRenders) tl.__hwRenders.unshift(() => render(tl.time()));
    else window.hwOnUpdate(tl, () => render(tl.time()));
    render(0);
    window.__renderD2V = render;
    return tl;
  }

  window.buildFilmD2V = build;
})();
