/*
 * Film D, "Ship the screen, not the backlog" (STORY-DEV.md): the developer film.
 *
 * A developer's backlog fills with asks nobody will build. One ask, "Pay Alex my rent share", becomes
 * a screen as data: the spec's money-send-confirm.json is written, and the real renderer draws it part
 * by part; one component draws it in any design system (the prop is retyped, the screen re-themes);
 * the host's onAction receives the tap; validateDocument and polyxd-verify check it (a grid of the
 * default matrix, then the agent's task through the accessibility tree); `npx polyxd pack` brings a
 * design system in and `npx polyxd dev` previews in it; <polyxd-surface> draws the same screen
 * without React. Then the backlog empties: each note flips into its screen and ships.
 *
 * Everything on screen is real: the documents are the spec's examples (packages/spec/examples) and
 * the film's two (kit.js), drawn live by @polyxd/web's browser build; the code is the docs' code
 * (quickstart, ui-documents, renderers, your-design-system), trimmed; the terminal output is what the
 * commands printed when they were run in this repository (see the README), trimmed; the acme pack is
 * the one `npx polyxd pack` wrote, compiled by `npx polyxd dev`.
 *
 * One world, five sets (the board, the editor and phone, the checks, your design system, the web
 * component), one virtual camera over them (a pose ladder: push-ins, pull-backs, whip pans with
 * velocity blur, a vertical travel, a 3D tilt settling flat, a long flight home). Doodles from the
 * registry's hw family (hw-arrow, hw-callout-circle, hw-underline, hw-boil) in ink and signal orange;
 * captions per word (caption-clip-wipe) or through a line mask (line-swap); typing and streaming
 * code with a caret (code-typing's mechanism), a highlight band with dimmed context
 * (code-highlight's), a terminal that types and prints (code-terminal-run's).
 *
 * One writer per property: GSAP tweens the doodles, captions, notes, parts and presses; render(t),
 * a pure function of time registered through the hw family's single onUpdate, owns the camera, the
 * typing, the theme blends, the bands, the counters and the marks.
 */
(function () {
  const M = window.PolyxdMark;
  const X = window.PolyxdMorph;
  const F = window.Film;
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
  const INK = "#141413";

  // The sets' places in the world.
  const SET = { board: [0, 0], doc: [3000, 0], check: [3000, 1500], byo: [6000, 1500], web: [6000, 0] };

  const el = (tag, cls, parent, style, html) => {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (style) d.style.cssText = style;
    if (html !== undefined) d.innerHTML = html;
    if (parent) parent.appendChild(d);
    return d;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

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

  // ——— Syntax: a small tokenizer per language, in the brand's colours ———
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
  /** The first n characters of a line, highlighted; `mark` wraps [a, b) in a class (the squiggle). */
  function highlight(text, lang, n, mark) {
    const toks = tokens(text, lang);
    let left = n === undefined ? text.length : n, pos = 0, html = "";
    for (const [s, c] of toks) {
      if (left <= 0) break;
      const part = s.slice(0, left);
      let inner = esc(part);
      if (mark && pos < mark[1] && pos + part.length > mark[0]) {
        const a = Math.max(0, mark[0] - pos), b = Math.min(part.length, mark[1] - pos);
        inner = esc(part.slice(0, a)) + `<span class="${mark[2]}">` + esc(part.slice(a, b)) + "</span>" + esc(part.slice(b));
      }
      html += c ? `<span class="${c}">${inner}</span>` : inner;
      left -= part.length;
      pos += s.length;
    }
    return html;
  }

  // ——— Typing: per-character reveal times (streamed or typed by hand), and in-place retypes ———
  /** Streams rows in: row i from t0 + i·every, its characters across 70% of `every`. */
  function stream(rows, t0, every) {
    rows.forEach((r, i) => {
      const n = r.text.length;
      r.times = Array.from({ length: n }, (_, k) => t0 + i * every + (n ? (k / n) * every * 0.7 : 0));
      r.from = t0 + i * every;
    });
  }
  /** A human typing one line: a steady hand with a little seeded jitter. */
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
  /** The text of a row at time t, through its retypes: delete back to the shared prefix, type on. */
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

  /** A code file inside an editor: numbered rows, a caret, bands for the highlight. */
  function codeFile(host, lines, lang, opts) {
    opts = opts || {};
    const wrap = el("div", "d-file", host);
    const rows = lines.map((text, i) => {
      const r = el("div", "d-line", wrap, "", `<span class="ln">${i + 1}</span><span class="tx"></span>`);
      return { el: r, tx: r.querySelector(".tx"), text, i, key: "" };
    });
    const caret = el("div", "d-caret", wrap);
    return { wrap, rows, lang, caret, mark: opts.mark, pad: opts.pad === undefined ? 96 : opts.pad, lh: opts.lh || 48 };
  }
  function renderFile(f, t, CW) {
    let active = null;
    for (const r of f.rows) {
      const { s, editing } = textAt(r, t);
      const n = Math.min(s.length, shownAt(r, t));
      const mk = f.mark && f.mark.row === r.i && t >= f.mark.from && t < f.mark.to ? [f.mark.a, f.mark.b, "squig"] : null;
      const key = `${s}|${n}|${mk ? 1 : 0}`;
      if (r.key !== key) {
        r.tx.innerHTML = highlight(s, f.lang, n, mk);
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

  /** A terminal: command rows typed after a prompt, output rows printed whole. */
  function terminal(host, rows, x, y, w, h, title) {
    const t = el("div", "d-term", host, `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`);
    el("div", "bar", t, "", `<i></i><i></i><i></i><span>${esc(title || "zsh")}</span>`);
    const body = el("div", "", t, "position:absolute;left:32px;right:24px;top:72px;");
    const R = rows.map((r) => {
      const d = el("div", `d-tl ${r.cmd ? "cmd" : r.cls || ""}`, body);
      return Object.assign({ el: d, key: "" }, r);
    });
    for (const r of R) if (r.cmd) typeLine(r, r.at, r.per || 0.028, r.at * 10);
    return { el: t, rows: R, body };
  }
  function renderTerm(term, t) {
    for (const r of term.rows) {
      let key, html;
      if (r.cmd) {
        const vis = t >= r.at - 0.3;
        const n = shownAt(r, t);
        key = vis ? `c${n}` : "";
        html = vis ? `<span class="pr">${esc(r.cmd)}</span> ${esc(r.text.slice(0, n))}${n < r.text.length && t >= r.at - 0.3 ? '<span style="display:inline-block;width:14px;height:28px;background:#ff6e40;vertical-align:-5px;margin-left:2px"></span>' : ""}` : "";
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

  /** A phone with the real renderer drawing `doc` in `theme`. */
  function phone(host, x, y, doc, theme, mode) {
    const p = el("div", "d-phone", host, `left:${x}px;top:${y}px;`);
    const glass = el("div", "phone-glass", p);
    const screen = el("div", "phone-screen", glass);
    const app = el("div", "d-app", screen);
    app.setAttribute("data-pxd-theme", theme);
    app.setAttribute("data-pxd-mode", mode || "light");
    el("div", "status", app, "", '<span>9:41</span><span class="battery"></span>');
    const pad = el("div", "pad", app);
    const hostEl = el("div", "", pad);
    window.PolyxdWeb.mount(hostEl, { document: doc, data: doc.data, theme, mode: mode || "light", density: "compact", locale: "en-GB" });
    el("div", "home-bar", app);
    app.querySelectorAll("*").forEach((n) => { n.setAttribute("data-layout-allow-overlap", ""); n.setAttribute("data-layout-allow-overflow", ""); });
    return { el: p, app, screen, q: (s) => app.querySelector(s) };
  }
  /** Where an element inside a phone sits, in its set's pixels. */
  function inPhone(ph, n) {
    const r = layoutRect(n, ph.screen);
    const x = parseFloat(ph.el.style.left) + 13 + r.x * K, y = parseFloat(ph.el.style.top) + 13 + r.y * K;
    return { x, y, w: r.w * K, h: r.h * K, cx: x + (r.w * K) / 2, cy: y + (r.h * K) / 2 };
  }

  /** A small render at 390 or 1100 CSS px, scaled into a tile (the verifier's matrix). */
  function tile(host, x, y, w, h, cssW, doc, theme, mode) {
    const d = el("div", "d-tile" + (cssW > 600 ? " wide" : ""), host, `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`);
    const k = w / cssW;
    const inner = el("div", "in", d, `width:${cssW}px;height:${h / k}px;transform:scale(${k});padding:${cssW > 600 ? "40px 60px" : "22px 14px"};`);
    inner.setAttribute("data-pxd-theme", theme);
    inner.setAttribute("data-pxd-mode", mode);
    const m = el("div", "", inner);
    window.PolyxdWeb.mount(m, { document: doc, data: doc.data, theme, mode, density: "compact", locale: "en-GB" });
    d.querySelectorAll("*").forEach((n) => { n.setAttribute("data-layout-allow-overlap", ""); n.setAttribute("data-layout-allow-overflow", ""); });
    return d;
  }

  function build() {
    const T = window.D_T;
    const D = window.D_DOCS;
    const tl = gsap.timeline({ paused: true });
    const rig = $("rig");
    const ink = $("ink");
    const sets = {};
    for (const [k, [x, y]] of Object.entries(SET)) sets[k] = el("div", "set", rig, `left:${x}px;top:${y}px;`);
    rig.appendChild(ink); // doodles above the sets
    const W = (k, x, y) => ({ x: SET[k][0] + x, y: SET[k][1] + y }); // set → world
    const cvs = document.createElement("canvas").getContext("2d");
    cvs.font = "30px 'DM Mono'";
    const CW = cvs.measureText("MMMMMMMMMM").width / 10; // DM Mono's advance at 30 px

    // ————————————————————— The backlog board —————————————————————
    const B = sets.board;
    el("div", "d-board", B);
    el("div", "d-board-head", B, "", "Backlog");
    const chip = el("div", "d-chip", B, "", "0");
    const HERO = [
      { text: "Pay Alex my rent share", doc: D["money-send-confirm"], theme: "material3", x: 700, y: 250, r: -3, c: "#ffe8a3", at: T.n1 },
      { text: "Change my address", doc: F.ADDRESS, theme: "govuk", x: 1000, y: 262, r: 2.2, c: "#ffd5c4", at: T.n2 },
      { text: "Return these shoes", doc: F.RETURN, theme: "shadcn", x: 1290, y: 244, r: -1.6, c: "#ffe8a3", at: T.n3 },
      { text: "Find 30 min with Tom and Priya", doc: D["calendar-find-slot"], theme: "fluent", x: 1552, y: 270, r: 2.6, c: "#e9e5db", at: T.n4 },
    ];
    const FLURRY = [
      ["Stop emailing me", "settings-notifications", "primer"],
      ["Send Priya £40", "money-send-form", "carbon"],
      ["What's my balance?", "money-balance-overview", "material3"],
      ["Set a groceries budget", "money-budget-settings", "polaris"],
      ["Where's order #4821?", "shop-order-status", "fluent"],
      ["Compare the plans", "shop-compare-plans", "carbon"],
      ["Find a desk lamp", "shop-browse-filter", "shadcn"],
      ["Check out", "shop-checkout", "polaris"],
      ["Add a task", "tasks-add", "mantine"],
      ["What's on today?", "tasks-list", "radix"],
      ["Delete a project", "tasks-delete-project", "antd"],
      ["Flights to Lisbon", "travel-flight-results", "spectrum"],
      ["Check my booking", "travel-booking-review", "bootstrap"],
      ["My Lisbon trip", "travel-trip-overview", "chakra"],
      ["Who's on billing?", "team-members", "primer"],
      ["New API key", "settings-api-keys", "carbon"],
      ["Delete my account", "settings-delete-account", "govuk"],
      ["How full is storage?", "storage-usage", "mantine"],
      ["My reading list", "personal-reading-log", "radix"],
      ["Today's habits", "personal-habits", "chakra"],
    ].map(([text, name, theme], i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const j = (n) => window.hwHash(i * 11 + n, 4);
      return {
        text, doc: D[name], theme,
        x: 660 + col * 262 + j(1) * 34 + (row % 2) * 60,
        y: 520 + row * 150 + j(2) * 30,
        r: j(3) * 7, c: ["#ffe8a3", "#ffd5c4", "#e9e5db", "#ffe8a3"][(i + row) % 4],
        at: T.flurry + i * T.flurryEvery, small: true,
      };
    });
    const NOTES = [...HERO, ...FLURRY];
    NOTES.forEach((n, i) => {
      const w = n.small ? 200 : 260, h = n.small ? 190 : 250;
      n.w = w;
      n.h = h;
      n.el = el("div", "d-note", B, `left:${n.x}px;top:${n.y}px;width:${w}px;height:${h}px;z-index:${10 + i};`);
      n.flip = el("div", "flip", n.el);
      const front = el("div", "face front", n.flip, `background:${n.c};font-size:${n.small ? 40 : 50}px;`, esc(n.text));
      const back = el("div", "face back", n.flip);
      const shot = el("div", "shot", back, `transform:scale(${w / 390});`);
      shot.setAttribute("data-pxd-theme", n.theme);
      shot.setAttribute("data-pxd-mode", "light");
      const m = el("div", "", shot);
      window.PolyxdWeb.mount(m, { document: n.doc, data: n.doc.data, theme: n.theme, mode: "light", density: "compact", locale: "en-GB" });
      n.el.querySelectorAll("*").forEach((q) => { q.setAttribute("data-layout-allow-overlap", ""); q.setAttribute("data-layout-allow-overflow", ""); });
      n.el.setAttribute("data-layout-allow-overlap", "");
      n.front = front;
      // Land: dropped from above, a quarter turn of wobble, settling flat on the board.
      gsap.set(n.el, { opacity: 0, rotation: n.r });
      tl.set(n.el, { opacity: 0 }, 0);
      tl.fromTo(n.el, { opacity: 0, y: -80, scale: 1.22, rotation: n.r + 8 }, { opacity: 1, y: 0, scale: 1, rotation: n.r, duration: n.small ? 0.22 : 0.3, ease: "power3.out", immediateRender: false }, n.at);
    });
    // The count in the chip: how many asks are waiting.
    const countAt = (t) => {
      let c = 0;
      HERO.forEach((n) => (t >= n.at + 0.1 ? c++ : 0));
      FLURRY.forEach((n, i) => (t >= n.at + 0.1 ? (c = 4 + Math.round(((i + 1) * 37) / FLURRY.length)) : 0));
      if (t >= T.journey) {
        const p = seg(t, T.flip1 - 0.2, T.ship - T.flip1 + 0.3);
        c = Math.round(41 * (1 - p));
      }
      return c;
    };

    // ————————————————————— The editor and the phone —————————————————————
    const Dk = sets.doc;
    const editor = el("div", "d-win", Dk, "left:90px;top:70px;width:1040px;height:940px;");
    const ebar = el("div", "bar", editor, "", "<i></i><i></i><i></i>");
    const tab = el("div", "tab", ebar, "", "<b>{}</b>money-send-confirm.json");
    const code = el("div", "d-code", editor);
    const JSON_LINES = [
      "{",
      '  "surface": { "title": "Confirm payment", … },',
      '  "root": "confirm",',
      '  "components": [',
      '    { "id": "confirm",',
      '      "component": "Confirm",',
      '      "title": "Send this payment?",',
      '      "summary": "summary",',
      '      "confirm": { "label": "Send £250.00",',
      '        "action": { "event": {',
      '          "name": "transfer.confirm", … } } } },',
      '    { "id": "summary",',
      '      "component": "DetailList",',
      '      "items": [ { "label": "Amount", … }, … ] }',
      "  ],",
      '  "data": { "quote": { "amount": 250, … } }',
      "}",
    ];
    const fJson = codeFile(code, JSON_LINES, "json");
    stream(fJson.rows, T.json, (T.jsonTo - T.json) / JSON_LINES.length);
    const TSX_LINES = [
      'import { PolyxdSurface } from "@polyxd/react";',
      'import "@polyxd/react/styles.css";',
      'import "@polyxd/react/themes/material3.css";',
      "// one file per pack: carbon.css, govuk.css…",
      "",
      "<PolyxdSurface",
      "  document={doc}",
      "  data={{ quote }}",
      '  theme="material3"',
      '  mode="light"',
      "  onAction={({ name, context, source }) => {",
      '    if (name === "transfer.confirm")',
      "      sendMoney(context.quoteId);",
      "  }}",
      "/>",
    ];
    const fTsx = codeFile(code, TSX_LINES, "js");
    stream(fTsx.rows, T.tsx, (T.tsxTo - T.tsx) / TSX_LINES.length);
    const THEMES = [
      ["carbon", T.carbon],
      ["govuk", T.govuk],
      ["shadcn", T.shadcn],
    ];
    fTsx.rows[8].edits = THEMES.map(([th, at]) => ({ at, to: `  theme="${th}"` }));
    // The integrated terminal pane: npm install, as it printed.
    const pane = el("div", "d-pane", editor);
    const paneRows = [
      { cmd: "$", text: "npm install @polyxd/react @polyxd/spec", at: T.npm, per: 0.021 },
      { text: "added 83 packages, and audited 87 packages in 904ms", at: T.npmOut, cls: "dim", html: 'added <span class="hl">83 packages</span>, and audited 87 packages in 904ms' },
      { text: "found 0 vulnerabilities", at: T.npmOut + 0.15, cls: "ok" },
    ];
    const paneBody = el("div", "", pane);
    const PR = paneRows.map((r) => Object.assign({ el: el("div", `d-tl ${r.cmd ? "cmd" : r.cls || ""}`, paneBody), key: "" }, r));
    for (const r of PR) if (r.cmd) typeLine(r, r.at, r.per, 3);
    const paneTerm = { rows: PR };
    // The phone: the real renderer drawing the spec's money-send-confirm.json.
    const P = phone(Dk, 1300, 77, D["money-send-confirm"], "material3");
    const pMorph = X.tokenMorph(P.app);
    const part = {
      card: P.q(".pxd-dialog"),
      head: [P.q(".pxd-dialog-title"), P.q(".pxd-dialog-amount"), P.q(".pxd-dialog-subject")],
      list: P.q(".pxd-detail-list"),
      act: [P.q(".pxd-dialog-consequence"), P.q(".pxd-action-bar")],
      button: P.q(".pxd-action-bar .pxd-button-primary"),
    };
    const allParts = [part.card, ...part.head, part.list, ...part.act].filter(Boolean);
    gsap.set(allParts, { opacity: 0 });
    tl.set(allParts, { opacity: 0 }, 0);
    gsap.set(P.el, { opacity: 0 });
    tl.set(P.el, { opacity: 0 }, 0);
    tl.fromTo(P.el, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: E, immediateRender: false }, T.phoneIn);
    const reveal = (els, at) => [].concat(els).filter(Boolean).forEach((n, i) => tl.fromTo(n, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: E, immediateRender: false }, at + i * 0.08));
    reveal([part.card, ...part.head], T.a1 + 0.55);
    reveal(part.list, T.a2 + 0.55);
    reveal(part.act, T.a3 + 0.55);

    // ————————————————————— The checks —————————————————————
    const C = sets.check;
    const checkTerm = terminal(
      C,
      [
        { cmd: ">", text: "validateDocument(doc)", at: T.val, per: 0.03 },
        { text: "{ valid: true, issues: [] }", at: T.valOut, cls: "ok" },
        { text: "", at: 0 },
        { cmd: "$", text: "npx polyxd-verify money-send-confirm.json --tasks tasks.json", at: T.verify, per: 0.0155 },
        { text: "100  money-send-confirm  (0 errors, 0 warnings agent 12/12)", at: T.verifyOut, html: '<span class="hl">100</span>  money-send-confirm  (0 errors, 0 warnings agent 12/12)' },
        { text: "1 documents · 12 renders · mean score 100.0 · agent tasks 12/12", at: T.verifyOut + 0.18, cls: "dim" },
      ],
      760, 40, 1130, 360, "node · zsh",
    );
    // The default matrix: Material 3, Carbon and Ant Design × light and dark × 390 and 1100.
    const GX = 760, GY = 490, TW = 104, DW = 293, TH = 180, GAP = 20, LBL = 150;
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
      gridLabels.push(el("div", "d-label muted", C, `left:${cx}px;top:${GY - 38}px;`, `${w}px`));
      cx += tw + GAP;
    });
    const tiles = [];
    ["material3", "carbon", "antd"].forEach((th, r) => {
      const y = GY + r * (TH + GAP);
      gridLabels.push(el("div", "d-label", C, `left:${GX}px;top:${y + TH / 2 - 16}px;`, th));
      cols.forEach(([mode, w, tw], c) => {
        const d = tile(C, colX[c], y, tw, TH, w, D["money-send-confirm"], th, mode);
        tiles.push({ el: d, r, c, x: colX[c], y, w: tw });
      });
    });
    tiles.forEach((tt, i) => {
      gsap.set(tt.el, { opacity: 0 });
      tl.set(tt.el, { opacity: 0 }, 0);
      tl.fromTo(tt.el, { opacity: 0, y: 30, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: E, immediateRender: false }, T.grid + 0.1 + (tt.r * 4 + tt.c) * 0.05);
    });
    gsap.set(gridLabels, { opacity: 0 });
    tl.set(gridLabels, { opacity: 0 }, 0);
    tl.to(gridLabels, { opacity: 1, duration: 0.4, ease: "power1.out" }, T.grid + 0.05);
    tl.to([checkTerm.el, ...gridLabels, ...tiles.map((q) => q.el)], { opacity: 0, duration: 0.01 }, T.agent + 0.5);
    // The agent: the task, the tree it reads, the button it presses.
    const AG = phone(C, 300, 1427, D["money-send-confirm"], "material3");
    const agBtn = AG.q(".pxd-action-bar .pxd-button-primary");
    const task = el("div", "d-task", C, "left:900px;top:1500px;", 'task  <span class="q">"Yes, send the £250 to Alex."</span>\nstep  press <span class="q">"Send £250.00"</span>');
    const TREE = [
      '- alertdialog <q>"Send this payment?"</q>:',
      '  - heading <q>"Send this payment?"</q> <r>[level=1]</r>',
      "  - text: £250.00 Alex Kim Monzo ••42",
      "  - term: Amount",
      "  - definition: £250.00",
      "  - term: Fee",
      "  - definition: Free",
      "  - <r>…</r>",
      "  - paragraph: The money leaves your account…",
      '  - button <q>"Send £250.00"</q>',
      '  - button <q>"Cancel"</q>',
    ];
    const tree = el("div", "d-tree", C, "left:920px;top:1650px;width:900px;");
    const tband = el("div", "band", tree);
    const trows = TREE.map((h) => el("div", "row", tree, "", h.replace(/<q>/g, '<span class="q">').replace(/<\/q>/g, "</span>").replace(/<r>/g, '<span class="r">').replace(/<\/r>/g, "</span>")));
    const result = el("div", "d-tree", C, "left:920px;top:2200px;", '<div class="row" style="color:#b14c2c">✓ transfer.confirm  { quoteId: "q_91" }</div>');
    gsap.set([task, result, ...trows], { opacity: 0 });
    tl.set([task, result, ...trows], { opacity: 0 }, 0);
    tl.fromTo(task, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: E, immediateRender: false }, T.tree - 0.1);
    trows.forEach((r, i) => tl.fromTo(r, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.25, ease: E, immediateRender: false }, T.tree + 0.1 + i * 0.045));
    tl.fromTo(result, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.3, ease: E, immediateRender: false }, T.agentEvent);
    const SCAN_ROWS = [0, 1, 2, 3, 4, 5, 6, 8, 9];
    const scanStep = (T.agentPress - T.scan) / (SCAN_ROWS.length - 1);

    // ————————————————————— Your design system —————————————————————
    const Y = sets.byo;
    const byoTerm = terminal(
      Y,
      [
        { cmd: "$", text: "npx polyxd pack ./acme.css", at: T.pack, per: 0.024 },
        { text: "read 40 variables from acme.css", at: T.packOut },
        { text: "mapped 54 of 87 contract tokens", at: T.packOut + 0.1, html: 'mapped <span class="hl">54 of 87</span> contract tokens' },
        { text: "  41 from their names", at: T.packOut + 0.2, cls: "dim" },
        { text: "16 tokens took a Polyxd default", at: T.packOut + 0.3, cls: "dim" },
        { text: "still needed — nothing in your tokens matched:", at: T.packOut + 0.4 },
        { text: "  color.scrim  color.text.link  … 7 more", at: T.packOut + 0.5, cls: "dim" },
        { text: "4 of your own pairs don't meet the contrast…", at: T.packOut + 0.6, cls: "warn" },
        { text: "  color.border.focus: 1.80:1, needs 3:1", at: T.packOut + 0.7, cls: "warn" },
        { text: "wrote ./ds-acme", at: T.packOut + 0.8, cls: "ok" },
        { text: "", at: 0 },
        { cmd: "$", text: "npx polyxd dev ./screens --pack ./ds-acme/manifest.json", at: T.dev, per: 0.0165 },
        { text: "polyxd dev  http://localhost:4310/", at: T.devOut, cls: "ok" },
        { text: "  ok  money-send-confirm.json  Confirm payment", at: T.devOut + 0.15, cls: "dim" },
      ],
      100, 140, 1050, 720, "~/acme · zsh",
    );
    const browser = el("div", "d-win", Y, "left:1180px;top:110px;width:690px;height:860px;");
    const bbar = el("div", "bar", browser, "", "<i></i><i></i><i></i>");
    el("div", "url", bbar, "", "localhost:4310");
    el("div", "d-dev-tools", browser, "", '<b>polyxd dev</b><span>Pack</span><span class="sel">acme (--pack)</span><span class="seg"><span class="on">Light</span><span>Dark</span></span><span class="seg"><span class="on">Phone</span><span>Desktop</span></span>');
    const stage = el("div", "d-dev-stage", browser);
    const frame = el("div", "frame", stage, "left:150px;");
    const fin = el("div", "", frame, "position:absolute;inset:0;padding:26px 18px;background:var(--pxd-color-surface-default);");
    fin.setAttribute("data-pxd-theme", "acme");
    fin.setAttribute("data-pxd-mode", "light");
    const fm = el("div", "", fin);
    window.PolyxdWeb.mount(fm, { document: D["money-send-confirm"], data: D["money-send-confirm"].data, theme: "acme", mode: "light", density: "comfortable", locale: "en-GB" });
    const flash = el("div", "d-flash", frame);
    browser.querySelectorAll("*").forEach((n) => { n.setAttribute("data-layout-allow-overlap", ""); n.setAttribute("data-layout-allow-overflow", ""); });
    gsap.set(browser, { opacity: 0 });
    tl.set(browser, { opacity: 0 }, 0);
    tl.fromTo(browser, { opacity: 0, x: 120 }, { opacity: 1, x: 0, duration: 0.55, ease: E, immediateRender: false }, T.browser);
    tl.fromTo(flash, { opacity: 0 }, { opacity: 0.22, duration: 0.08, immediateRender: false }, T.squigFix + 0.5);
    tl.to(flash, { opacity: 0, duration: 0.3 }, T.squigFix + 0.58);
    // The $schema line brings the editor's help: a squiggle under a typo, a completion, fixed.
    const sq = el("div", "d-squig-card", Y, "left:100px;top:880px;width:1060px;height:150px;");
    const sqCode = el("div", "d-code", sq, "top:18px;left:26px;");
    const fSq = codeFile(sqCode, ['"$schema": "https://polyxd.com/schema/0.3/ui.schema.json",', '"component": "Confrim",'], "json", { pad: 0, lh: 50 });
    sqCode.style.fontSize = "28px";
    fSq.rows.forEach((r) => {
      r.el.style.cssText = "height:50px;line-height:50px;font-size:28px;padding-left:0;";
      r.el.querySelector(".ln").style.display = "none";
    });
    fSq.wrap.style.top = "0px";
    fSq.rows[1].edits = [{ at: T.squigFix, to: '"component": "Confirm",' }];
    fSq.mark = { row: 1, a: 14, b: 21, from: 0, to: T.squigFix };
    const pop = el("div", "pop", sq, "left:300px;top:124px;", '<span class="on">Confirm</span>');
    gsap.set([sq, pop], { opacity: 0 });
    tl.set([sq, pop], { opacity: 0 }, 0);
    tl.fromTo(sq, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: E, immediateRender: false }, T.squig);
    tl.fromTo(pop, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.2, ease: E, immediateRender: false }, T.squigFix - 0.3);
    tl.to(pop, { opacity: 0, duration: 0.15 }, T.squigFix + 0.35);
    tl.to(sq, { opacity: 0, duration: 0.3, ease: "power2.in" }, T.whip2 - 0.1);

    // ————————————————————— The web component —————————————————————
    const Wb = sets.web;
    const hEd = el("div", "d-win", Wb, "left:90px;top:70px;width:1040px;height:940px;");
    const hbar = el("div", "bar", hEd, "", "<i></i><i></i><i></i>");
    el("div", "tab", hbar, "", "<b>&lt;&gt;</b>index.html");
    const hcode = el("div", "d-code", hEd);
    const HTML_LINES = [
      '<polyxd-surface id="send" theme="carbon"',
      '  mode="light"></polyxd-surface>',
      "",
      '<script type="module">',
      '  import { defineElements } from "@polyxd/web";',
      "  defineElements();",
      '  const el = document.getElementById("send");',
      "  el.document = doc;",
      '  el.addEventListener("polyxd-action", …);',
      "<\/script>",
    ];
    const fHtml = codeFile(hcode, HTML_LINES, "js");
    stream(fHtml.rows, T.html, (T.htmlTo - T.html) / HTML_LINES.length);
    tl.to(hEd, { opacity: 0.2, duration: 0.5, ease: "power2.inOut" }, T.twin + 0.2);
    const webPh = phone(Wb, 1230, 77, D["money-send-confirm"], "carbon");
    const reactPh = phone(Wb, 1830, 77, D["money-send-confirm"], "carbon");
    el("div", "d-label", Wb, "left:1230px;top:18px;", "&lt;polyxd-surface&gt;");
    el("div", "d-label", Wb, "left:1830px;top:18px;", "&lt;PolyxdSurface&gt;");

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
    const handW = (text, size) => {
      cvs.font = `700 ${size}px Caveat`;
      return cvs.measureText(text).width;
    };
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
    const tick = (id, x, y, s, on, dur, parent) => {
      const b = drawBox(id, x, y, s, s * 0.86, parent);
      drawPath(b, tickD(s, s * 0.86, id.length + s), on, dur || 0.3, SIGNAL, Math.max(5, s / 10));
      return b;
    };
    /** A hand-drawn arrow from a to b (world px): a wobbled curve and a two-stroke head. */
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
    /** An orange wobble ellipse round a rect (registry hw-callout-circle, no connector). */
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
    const markPath = (box, style, seed) => {
      const svg = box.querySelector("svg");
      const vb = svg.viewBox.baseVal;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", window.hwMarkPath(vb.width, vb.height, style, seed));
      svg.appendChild(p);
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

    // 1 · The backlog: "+37 this week" with an arrow at the count.
    const plus = hand("d-plus", "+37 this week", 1325, 40, 58);
    writeOn(plus, T.plus, 0.55);
    fadeOff(plus, T.veil);
    // The boil owns the arrow's own transform, so the aim lives on a wrapper.
    const plusAim = el("div", "", ink, "position:absolute;left:1640px;top:60px;width:120px;height:80px;transform:rotate(48deg);transform-origin:0 70%;");
    const plusArrow = el("div", "hw-arrow", plusAim, "left:0;top:0;width:120px;height:80px;--hw-arrow-color:#ff6e40;", '<svg viewBox="0 0 120 80"></svg>');
    plusArrow.id = "d-plus-arrow";
    window.hwArrowBuild("#d-plus-arrow", { arrowStyle: "gentle", strokeType: "plain", boil: "calm" });
    window.hwArrowOn(tl, "#d-plus-arrow", T.plus + 0.5);
    window.hwArrowOff(tl, "#d-plus-arrow", T.veil);

    // 3 · A screen is a document: from each part of the JSON to the part it becomes.
    const A1 = rowAt("doc", fJson, 5), A2 = rowAt("doc", fJson, 12), A3 = rowAt("doc", fJson, 8, 19, 41);
    const tHead = inWorld("doc", inPhone(P, part.head[0])), tList = inWorld("doc", inPhone(P, part.list)), tBtn = inWorld("doc", inPhone(P, part.button));
    const arrows = [
      arrow("d-ar1", { x: A1.end + 26, y: A1.cy }, { x: tHead.x - 22, y: tHead.cy }, T.a1 + 0.15, 90, 3),
      arrow("d-ar2", { x: A2.end + 26, y: A2.cy }, { x: tList.x - 22, y: tList.cy }, T.a2 + 0.15, 70, 5),
      arrow("d-ar3", { x: A3.end + 26, y: A3.cy }, { x: tBtn.x - 22, y: tBtn.cy }, T.a3 + 0.15, 110, 7),
    ];
    tl.to(arrows[0], { opacity: 0.18, duration: 0.3 }, T.a2);
    tl.to(arrows[1], { opacity: 0.18, duration: 0.3 }, T.a3);
    tl.to(arrows, { opacity: 0, duration: 0.3, ease: "power2.in" }, T.arrowsOff);
    // "Meaning, not pixels.": a squiggle under what the document says the screen is.
    const U1 = rowAt("doc", fJson, 5, 6);
    const under = el("div", "hw-mark", ink, `left:${U1.x}px;top:${U1.y + 40}px;width:${U1.w}px;height:24px;`, `<svg viewBox="0 0 ${U1.w} 24"></svg>`);
    under.id = "d-under";
    markPath(under, "underline", 4);
    gsap.set(under, { opacity: 0 });
    tl.set(under, { opacity: 0 }, 0);
    tl.set(under, { opacity: 1 }, T.under);
    window.hwMarkOn(tl, "#d-under", T.under, 0.5);
    window.hwBoil(tl, "#d-under", { frameDrop: 3, seed: 4, amp: 1.1, rot: 0.3 });
    fadeOff(under, T.cap4Out - 0.2);

    // 4 · One prop: a circle round the theme, "one prop".
    const THR = rowAt("doc", fTsx, 8, 8, 19);
    callout("d-circ-theme", THR, T.circleP, T.circlePOff);
    const oneProp = hand("d-oneprop", "one prop", THR.x + THR.w + 70, THR.y - 4, 56);
    writeOn(oneProp, T.noteP, 0.4);
    fadeOff(oneProp, T.circlePOff);

    // 5 · Your code decides: a circle round the host's handler.
    const SM = rowAt("doc", fTsx, 12);
    callout("d-circ-send", SM, T.circleS, T.cap6Out);

    // 6 · Checked: a tick at valid: true, a wave of ticks over the matrix, a circle round the score.
    const vRow = layoutRect(checkTerm.rows[1].el, C);
    const checkInk = [tick("d-valtick", SET.check[0] + vRow.x + 27 * 16.8 + 24, SET.check[1] + vRow.y - 8, 54, T.valTick, 0.3)];
    tiles.forEach((tt, i) => {
      const x = SET.check[0] + tt.x + tt.w - 26, y = SET.check[1] + tt.y - 18;
      checkInk.push(tick(`d-gt${i}`, x, y, 44, T.wave + (tt.r + tt.c) * 0.12, 0.22));
    });
    tl.to(checkInk, { opacity: 0, duration: 0.01 }, T.agent + 0.5);
    const sRow = layoutRect(checkTerm.rows[4].el, C);
    callout("d-circ-100", { x: 0, y: 0, w: 70, h: 44, cx: SET.check[0] + sRow.x + 24, cy: SET.check[1] + sRow.y + 22 }, T.circle100, T.agent);

    // 7 · Your design system: a circle round what it worked out, a note.
    const pRow = layoutRect(byoTerm.rows[2].el, Y);
    const pR = { x: SET.byo[0] + pRow.x, y: SET.byo[1] + pRow.y, w: 31 * 16.8, h: 44 };
    pR.cx = pR.x + pR.w / 2;
    pR.cy = pR.y + 22;
    callout("d-circ-pack", pR, T.circlePack, T.dev + 1.0);
    const packNote = hand("d-packnote", "worked out for you", pR.x + pR.w + 60, pR.y - 10, 52, SIGNAL);
    writeOn(packNote, T.notePack, 0.55);
    fadeOff(packNote, T.dev + 1.2);

    // 8 · The same screen: "=" between the two phones, "same fingerprint", a tick.
    const eq = hand("d-eq", "=", SET.web[0] + 1712, SET.web[1] + 440, 110);
    writeOn(eq, T.same, 0.3);
    const same = hand("d-same", "same fingerprint", SET.web[0] + 1550, SET.web[1] + 1016, 56);
    writeOn(same, T.same + 0.3, 0.55);
    tick("d-sametick", SET.web[0] + 1550 + handW("same fingerprint", 56) + 20, SET.web[1] + 1010, 56, T.same + 0.85, 0.3);
    fadeOff([eq, same, $("d-sametick")], T.sameOff);

    // 9 · Payoff: each note flips into its screen and is ticked; then they ship and the board clears.
    const flips = [];
    HERO.slice(1).forEach((n, i) => flips.push({ n, at: T.flip1 + i * 0.38 - i * i * 0.03 }));
    FLURRY.forEach((n, i) => flips.push({ n, at: T.wave2 + Math.pow(i / FLURRY.length, 0.8) * 0.9 }));
    // The first ask was built on screen: it is already a screen when the camera comes home.
    tl.set(HERO[0].flip, { rotationY: 180 }, T.journey);
    tl.set(HERO[0].el, { opacity: 0 }, T.peel);
    tl.set(HERO[0].el, { opacity: 1 }, T.journey);
    tick("d-pt0", HERO[0].w - 50, -22, 58, T.journey + 0.5, 0.25, HERO[0].el);
    flips.forEach(({ n, at }, i) => {
      tl.fromTo(n.flip, { rotationY: 0 }, { rotationY: 180, duration: n.small ? 0.3 : 0.4, ease: "power2.inOut", immediateRender: false }, at);
      tick(`d-pt${i + 1}`, n.w - (n.small ? 40 : 50), -20, n.small ? 46 : 58, at + (n.small ? 0.22 : 0.3), 0.2, n.el);
    });
    NOTES.forEach((n, i) => {
      const k = (n.x - 600) / 1400;
      tl.to(n.el, { x: 1500 + k * 300, y: -120 - window.hwHash(i, 9) * 120, rotation: n.r + 14, opacity: 0, duration: 0.55, ease: "power3.in" }, T.ship + (1 - k) * 0.35 + window.hwHash(i, 2) * 0.05);
    });
    tick("d-cleartick", 1810, 118, 70, T.ship + 0.75, 0.3, B);

    // ——— The marks ———
    $("d-turn-mark").innerHTML = M.svg("d-turn-svg", 170);
    const turnMark = M.driver($("d-turn-svg"), [
      { t: T.markIn + 0.3, state: "looking" },
      { t: T.blink, state: "blink" },
      { t: T.peel, state: "attention" },
    ]);

    // ——— Captions ———
    const capWords = (id) => Array.from($(id).querySelectorAll(".w"));
    const wordsIn = (id, t0, stagger = 0.09) => capWords(id).forEach((w, i) => tl.fromTo(w, { clipPath: "inset(-10% 100% -20% 0)" }, { clipPath: "inset(-10% -2% -20% 0)", duration: 0.32, ease: "power2.out", immediateRender: false }, t0 + i * stagger));
    const lineOut = (id, t0) => tl.fromTo(`#${id} .line`, { yPercent: 0 }, { yPercent: -115, duration: 0.35, ease: "power2.in", immediateRender: false }, t0);
    const CAPS = [
      ["cap-1", T.cap1, T.cap1Out],
      ["cap-2", T.cap2, T.cap2Out],
      ["cap-3", T.cap3, T.cap3Out],
      ["cap-4", T.cap4, T.cap4Out - 0.07],
      ["cap-5", T.cap5, T.cap5Out],
      ["cap-6", T.cap6, T.cap6Out],
      ["cap-7", T.cap7, T.cap7Out],
      ["cap-8", T.cap8, T.cap8Out],
      ["cap-9", T.cap9, T.cap9Out],
      ["cap-10", T.cap10, T.cap10Out],
      ["cap-11", T.cap11, T.cap11Out],
    ];
    for (const [a, b] of [[T.cap5, T.cap5Out], [T.cap6, T.cap6Out], [T.cap8, T.cap8Out]]) {
      tl.fromTo("#d-scrim", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out", immediateRender: false }, a - 0.15);
      tl.to("#d-scrim", { opacity: 0, duration: 0.3, ease: "power1.in" }, b + 0.1);
    }
    tl.set("#d-scrim", { opacity: 0 }, 0);
    for (const [id, a, b] of CAPS) {
      gsap.set(`#${id} .line`, { yPercent: 115 });
      tl.set(`#${id} .line`, { yPercent: 115 }, 0);
      tl.set(`#${id} .line`, { yPercent: 0 }, a);
      wordsIn(id, a);
      lineOut(id, b);
    }

    // ——— Groups, windows, presses (GSAP) ———
    tl.set("#world", { opacity: 0 }, 0);
    tl.to("#world", { opacity: 1, duration: 0.35, ease: "power1.out" }, T.boardIn);
    tl.to("#world", { opacity: 0, duration: 0.35, ease: "power2.in" }, T.outro - 0.3);
    tl.set("#d-veil", { opacity: 0 }, 0);
    tl.to("#d-veil", { opacity: 0.9, duration: 0.4, ease: "power1.out" }, T.veil);
    tl.set("#d-veil", { opacity: 0 }, T.hit);
    tl.set("#d-turn-mark", { opacity: 0 }, 0);
    tl.fromTo("#d-turn-mark", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.45, ease: E, immediateRender: false }, T.markIn);
    tl.to("#d-turn-mark", { opacity: 0, duration: 0.3, ease: "power2.in" }, T.peel + 0.4);
    // The editor: the note becomes it on the hit (render owns the flying note).
    gsap.set(editor, { opacity: 0 });
    tl.set(editor, { opacity: 0 }, 0);
    tl.set(editor, { opacity: 1 }, T.hit + 0.25);
    // The files: JSON leaves up through the mask as the TSX file takes its place; the tab follows.
    gsap.set([fTsx.wrap], { opacity: 0 });
    tl.set(fTsx.wrap, { opacity: 0 }, 0);
    tl.fromTo(fJson.wrap, { y: 0, opacity: 1 }, { y: -160, opacity: 0, duration: 0.4, ease: "power2.in", immediateRender: false }, T.swap);
    tl.set(fTsx.wrap, { opacity: 1 }, T.swap + 0.3);
    gsap.set(pane, { y: 190 });
    tl.set(pane, { y: 190 }, 0);
    tl.fromTo(pane, { y: 190 }, { y: 0, duration: 0.4, ease: E, immediateRender: false }, T.pane);
    tl.to(pane, { y: 190, duration: 0.4, ease: "power2.in" }, T.up);
    // Context dims while one line is lit (code-highlight): the JSON under the arrows, the prop, the handler.
    const bandAt = (f, i, c0, c1, on, off, host) => {
      const r = f.rows[i];
      const text = r.text;
      const a = c0 === undefined ? text.search(/\S/) : c0, b = c1 === undefined ? text.length : c1;
      const band = el("div", "d-band", host || r.el.parentNode, `top:${r.el.offsetTop}px;left:${96 + a * CW - 12}px;width:${(b - a) * CW + 24}px;`);
      tl.fromTo(band, { opacity: 1, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.28, ease: "power2.inOut", immediateRender: false }, on);
      tl.set(band, { opacity: 0, scaleX: 0 }, 0);
      tl.to(band, { opacity: 0, duration: 0.25 }, off);
      return band;
    };
    const dim = (f, keep, on, off) => {
      const rows = f.rows.filter((r) => !keep.includes(r.i)).map((r) => r.el);
      tl.to(rows, { opacity: 0.4, duration: 0.3, ease: "power2.inOut" }, on);
      tl.to(rows, { opacity: 1, duration: 0.3, ease: "power2.inOut" }, off);
    };
    bandAt(fJson, 5, undefined, undefined, T.a1, T.a2);
    bandAt(fJson, 12, undefined, undefined, T.a2, T.a3);
    bandAt(fJson, 8, 19, 41, T.a3, T.arrowsOff);
    dim(fJson, [5, 12, 8], T.a1, T.arrowsOff);
    dim(fJson, [5, 6], T.pushC + 0.2, T.swap);
    dim(fTsx, [8], T.pushP, T.poseR);
    bandAt(fTsx, 10, undefined, undefined, T.cardLand, T.down);
    bandAt(fTsx, 11, undefined, undefined, T.cardLand + 0.06, T.down);
    bandAt(fTsx, 12, undefined, undefined, T.cardLand + 0.12, T.down);
    dim(fTsx, [10, 11, 12], T.poseR + 0.2, T.down + 0.6);
    // The tap on the phone's primary button; the agent's press on its own phone.
    const press = (btn, at) => {
      tl.fromTo(btn, { "--finger": 0 }, { "--finger": 1, duration: 0.18, ease: E, immediateRender: false }, at);
      tl.fromTo(btn, { "--press": 0 }, { "--press": 1, duration: 0.14, ease: E, immediateRender: false }, at + 0.14);
      tl.fromTo(btn, { "--press": 1 }, { "--press": 0, duration: 0.3, ease: E, immediateRender: false }, at + 0.42);
      tl.fromTo(btn, { "--finger": 1 }, { "--finger": 0, duration: 0.25, ease: E, immediateRender: false }, at + 0.46);
    };
    press(part.button, T.press);
    const agPress = (btn, at) => {
      tl.fromTo(btn, { "--press": 0 }, { "--press": 1, duration: 0.12, ease: E, immediateRender: false }, at);
      tl.fromTo(btn, { "--press": 1 }, { "--press": 0, duration: 0.3, ease: E, immediateRender: false }, at + 0.3);
    };
    agPress(agBtn, T.agentPress);
    // The event the tap sends: out of the button, into the handler.
    const evt = el("div", "d-event", ink, "left:0;top:0;", '{ name: <span class="s">"transfer.confirm"</span>,\n  context: { quoteId: <span class="s">"q_91"</span> },\n  source: <span class="s">"confirm"</span> }');
    gsap.set(evt, { opacity: 0 });
    tl.set(evt, { opacity: 0 }, 0);
    tl.set(evt, { opacity: 1 }, T.card);
    tl.to(evt, { opacity: 0, duration: 0.3, ease: "power2.in" }, T.down + 0.1);
    const evtFrom = inWorld("doc", inPhone(P, part.button));
    const hRow = rowAt("doc", fTsx, 10);
    const evtTo = { x: hRow.x + 330, y: hRow.y - 190 };
    tl.to({ t: 0 }, { t: T.end, duration: T.end, ease: "none" }, 0);

    // ——— The camera: poses on a keyframe ladder; render() interpolates ———
    const pose = (o) => Object.assign({ fx: 960, fy: 540, vx: 960, vy: 540, s: 1, rx: 0, ry: 0 }, o);
    const REST_B = pose({ fx: 1230, fy: 560, vx: 1300, vy: 560, s: 0.82 });
    const A = pose({ fx: 3610, fy: 560, vx: 1290, vy: 560, s: 0.94 });
    const Bw = pose({ fx: 3916, fy: 540, vx: 960, vy: 545, s: 1.0 });
    const Cp = pose({ fx: 3540, fy: 470, vx: 1270, vy: 560, s: 1.45 });
    const Tp = pose({ fx: 3610, fy: 925, vx: 960, vy: 640, s: 1.45 });
    const U = pose({ fx: 3916, fy: 540, vx: 960, vy: 560, s: 1.0 });
    const Pp = pose({ fx: 3955, fy: 525, vx: 960, vy: 660, s: 1.1 });
    const R = pose({ fx: 3955, fy: 610, vx: 960, vy: 680, s: 1.1 });
    const V = pose({ fx: 4325, fy: 1720, vx: 960, vy: 560, s: 1.4 });
    const G = pose({ fx: 4325, fy: 2060, vx: 1330, vy: 540, s: 1.0 });
    const tileW = { x: SET.check[0] + colX[0] + TW / 2, y: SET.check[1] + GY + TH / 2 };
    const PT = pose({ fx: tileW.x, fy: tileW.y, vx: 960, vy: 540, s: 4.2 });
    const AGp = pose({ fx: 4070, fy: 3420, vx: 960, vy: 640, s: 1.0 });
    const B1 = pose({ fx: 6625, fy: 2000, vx: 1330, vy: 540, s: 1.02 });
    const PK = pose({ fx: 6580, fy: 1960, vx: 960, vy: 560, s: 1.45 });
    const BD = pose({ fx: 6985, fy: 2070, vx: 960, vy: 540, s: 1.0 });
    const W1 = pose({ fx: 6610, fy: 560, vx: 1290, vy: 560, s: 0.94 });
    const W2 = pose({ fx: 7751, fy: 540, vx: 960, vy: 520, s: 0.9 });
    const with_ = (p, o) => Object.assign({}, p, o);
    const CAM = [
      [0, pose({ fx: 770, fy: 380, vx: 960, vy: 540, s: 1.9 })],
      [T.n1, pose({ fx: 800, fy: 385, vx: 960, vy: 540, s: 1.72 }), "sine"],
      [T.n2 + 0.1, pose({ fx: 975, fy: 395, vx: 960, vy: 540, s: 1.5 }), "brand"],
      [T.n3 + 0.1, pose({ fx: 1140, fy: 405, vx: 960, vy: 540, s: 1.32 }), "brand"],
      [T.n4 + 0.1, pose({ fx: 1290, fy: 420, vx: 960, vy: 540, s: 1.15 }), "brand"],
      [T.flurry, pose({ fx: 1290, fy: 425, vx: 960, vy: 540, s: 1.12 }), "sine"],
      [T.pullTo, REST_B, "decel"], // zoom-out-workspace-reveal: the pile, overflowing
      [T.hit - 0.01, with_(REST_B, { s: 0.86 }), "sine"],
      [T.hit, with_(A, { rx: 6, ry: -14, s: 0.86 }), "cut"], // the hit: the editor, tilted, settling flat
      [T.hit + 1.1, A, "decel"],
      [T.wide, with_(A, { s: 0.93 }), "sine"],
      [T.wide + 0.75, Bw, "brand"],
      [T.pushC, with_(Bw, { s: 1.04 }), "sine"],
      [T.pushC + 0.7, Cp, "brand"],
      [T.swap, with_(Cp, { s: 1.48 }), "sine"],
      [T.swap + 0.6, Tp, "brand"],
      [T.up, with_(Tp, { s: 1.47 }), "sine"],
      [T.up + 0.6, U, "brand"],
      [T.pushP, U, "hold"],
      [T.pushP + 0.6, Pp, "brand"],
      [T.poseR, with_(Pp, { s: 1.12 }), "sine"],
      [T.poseR + 0.5, R, "brand"],
      [T.down, with_(R, { s: 1.12 }), "sine"],
      [T.down + 0.7, V, "inout"], // a vertical travel down to the checks
      [T.verifyEnter, with_(V, { s: 1.43 }), "sine"],
      [T.grid + 0.9, G, "brand"],
      [T.agent, with_(G, { s: 0.98 }), "sine"],
      [T.agent + 0.5, PT, "in3"], // push through one render of the matrix…
      [T.agent + 0.51, with_(AGp, { s: 1.12 }), "cut"], // …into the agent's view of it
      [T.tree + 0.6, AGp, "decel"],
      [T.whip1, with_(AGp, { s: 1.02 }), "sine"],
      [T.whip1 + 0.62, B1, "inout"], // whip pan to your design system
      [T.pushPack, with_(B1, { s: 0.98 }), "sine"],
      [T.pushPack + 0.6, PK, "brand"],
      [T.devEnter, with_(PK, { s: 1.52 }), "sine"],
      [T.devEnter + 0.6, BD, "brand"],
      [T.whip2, with_(BD, { s: 1.02 }), "sine"],
      [T.whip2 + 0.62, W1, "inout"], // whip up to the web component
      [T.twin, with_(W1, { s: 0.95 }), "sine"],
      [T.twin + 0.7, with_(W2, { ry: -12, rx: 4 }), "brand"],
      [T.twin + 1.6, W2, "decel"],
      [T.journey, with_(W2, { s: 0.92 }), "sine"],
      [T.journey + 0.45, pose({ fx: 4300, fy: 900, vx: 960, vy: 540, s: 0.27 }), "inout"], // the flight home
      [T.journey + T.journeyDur, pose({ fx: 1240, fy: 600, vx: 960, vy: 560, s: 0.84 }), "decel"],
      [T.ship, pose({ fx: 1240, fy: 590, vx: 960, vy: 555, s: 0.86 }), "sine"],
      [T.cap11, pose({ fx: 1230, fy: 540, vx: 960, vy: 540, s: 0.86 }), "brand"],
      [T.end, pose({ fx: 1230, fy: 540, vx: 960, vy: 540, s: 0.9 }), "sine"],
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
    const screenOf = (c, wx, wy) => ({ x: c.vx + c.s * (wx - c.fx), y: c.vy + c.s * (wy - c.fy) });
    function applyCam(t) {
      const c = camAt(t);
      rig.style.transform = `translate(${c.vx.toFixed(2)}px, ${c.vy.toFixed(2)}px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg) scale(${c.s.toFixed(4)}) translate(${(-c.fx).toFixed(2)}px, ${(-c.fy).toFixed(2)}px)`;
      // Velocity blur: how far the centre of the frame's world moved on screen in the last frame.
      let bx = 0, by = 0;
      if (!cuts.some((k) => t >= k && t < k + 0.07)) {
        const pc = camAt(t - 1 / 30);
        const wx = c.fx + (960 - c.vx) / c.s, wy = c.fy + (540 - c.vy) / c.s;
        const sp = screenOf(pc, wx, wy);
        const dx = sp.x - 960, dy = sp.y - 540;
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
    const n1 = HERO[0];
    function render(t) {
      const c = applyCam(t);
      // The count.
      const cnt = String(countAt(t));
      if (chip.textContent !== cnt) chip.textContent = cnt;
      // The note that peels off the pile, flies to the centre and becomes the editor on the hit.
      if (t >= T.peel && t < T.hit + T.morphDur) {
        const camP = camAt(T.peel);
        const s0 = screenOf(camP, n1.x, n1.y);
        const from = { x: s0.x, y: s0.y, w: n1.w * camP.s, h: n1.h * camP.s, r: n1.r };
        const mid = { w: 390, h: 375, x: 960 - 195, y: 540 - 187, r: 0 };
        const edA = with_(A, { rx: 0, ry: 0, s: 0.86 });
        const e0 = screenOf(edA, SET.doc[0] + 90, SET.doc[1] + 70);
        const to = { x: e0.x, y: e0.y, w: 1040 * edA.s, h: 940 * edA.s, r: 0 };
        let g, bg = 0, txt = 1;
        if (t < T.hit) {
          const p = E(seg(t, T.peel, T.hit - 0.12 - T.peel));
          g = {};
          for (const k of ["x", "y", "w", "h", "r"]) g[k] = lerp(from[k], mid[k], p);
          g.y -= Math.sin(p * Math.PI) * 60;
        } else {
          const p = E(seg(t, T.hit, T.morphDur));
          g = {};
          for (const k of ["x", "y", "w", "h", "r"]) g[k] = lerp(mid[k], to[k], p);
          bg = p;
          txt = 1 - clamp(p * 1.8);
        }
        fly.style.opacity = t < T.hit ? "1" : (1 - clamp((bg - 0.6) / 0.4)).toFixed(3);
        fly.style.left = `${g.x.toFixed(1)}px`;
        fly.style.top = `${g.y.toFixed(1)}px`;
        fly.style.width = `${g.w.toFixed(1)}px`;
        fly.style.height = `${g.h.toFixed(1)}px`;
        fly.style.transform = `rotate(${g.r.toFixed(2)}deg)`;
        const mixc = (a, b) => Math.round(lerp(a, b, bg));
        fly.style.background = `rgb(${mixc(255, 255)}, ${mixc(232, 255)}, ${mixc(163, 255)})`;
        fly.style.borderRadius = `${lerp(6, 22, bg).toFixed(1)}px`;
        flyText.style.opacity = txt.toFixed(3);
        flyText.style.transform = `scale(${(g.w / 260).toFixed(3)})`;
      } else fly.style.opacity = "0";
      // The editor: the tab, the files, the pane.
      const tabName = t >= T.swap + 0.2 ? "<b>tsx</b>SendConfirm.tsx" : "<b>{}</b>money-send-confirm.json";
      if (tab.innerHTML !== tabName) tab.innerHTML = tabName;
      renderFile(fJson, t, CW);
      renderFile(fTsx, t, CW);
      renderFile(fHtml, t, CW);
      renderFile(fSq, t, 28 * (CW / 30));
      renderTerm(paneTerm, t);
      renderTerm(checkTerm, t);
      renderTerm(byoTerm, t);
      // One component, any design system: the phone re-themes once each retype lands.
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
      // The event card: out of the button on an arc, into the handler, where it stays to be read.
      if (t >= T.card) {
        const p = E(seg(t, T.card, T.cardLand - T.card));
        const x = lerp(evtFrom.cx - 300, evtTo.x, p), y = lerp(evtFrom.cy - 60, evtTo.y, p) - Math.sin(p * Math.PI) * 180;
        const s = lerp(0.5, 1, clamp(p * 1.6)) * (1 + 0.06 * Math.sin(clamp((t - T.cardLand) / 0.25) * Math.PI));
        evt.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)}) rotate(${(lerp(-8, 0, p)).toFixed(2)}deg)`;
      }
      // The agent's highlight walks the tree, one role at a time, and stops on the button.
      if (t >= T.scan - 0.1 && t < T.whip1 + 0.8) {
        const k = Math.min(SCAN_ROWS.length - 1, Math.max(0, Math.floor((t - T.scan) / scanStep)));
        const kp = SCAN_ROWS[Math.max(0, k - 1)], kn = SCAN_ROWS[k];
        const p = E(clamp(((t - T.scan) - k * scanStep) / 0.09));
        tband.style.top = `${lerp(kp, kn, k === 0 ? 1 : p) * 50}px`;
        tband.style.opacity = String(Math.min(1, (t - T.scan + 0.1) * 6));
      } else tband.style.opacity = "0";
      turnMark(t);
    }
    // The world is one wide canvas the camera travels over: its sets sit far outside the frame on purpose.
    [rig, ...rig.querySelectorAll(".set, .set > *, #ink > *, .d-phone, .d-tree")].forEach((n) => n.setAttribute("data-layout-allow-overflow", ""));
    if (tl.__hwRenders) tl.__hwRenders.unshift(() => render(tl.time()));
    else window.hwOnUpdate(tl, () => render(tl.time()));
    render(0);
    window.__renderD = render;
    return tl;
  }

  window.buildFilmD = build;
})();
