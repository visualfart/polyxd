/*
 * Builders and motion helpers shared by the three films.
 *
 * The screens are drawn by the real Polyxd renderer: `PolyxdWeb.mount` from @polyxd/web's
 * self-contained browser build (assets/polyxd/polyxd-web.js), with the same stylesheet and themes
 * the product ships. They are mounted once, synchronously, while the page loads; the timeline only
 * fades their parts in and out, so every frame is a function of time.
 */
(function () {
  const ease = window.PolyxdMark.ease;

  /** Halden's payees, as the product's demo has them. */
  const PAYEES = [
    { id: "p_priya", name: "Priya Raman", initials: "PR", recent: true, bank: "04-00-04 ··04" },
    { id: "p_amara", name: "Amara Osei", initials: "AO", recent: true, bank: "60-83-71 ··86" },
    { id: "p_landlord", name: "Redcliffe Lettings", initials: "RL", recent: true, bank: "30-96-26 ··63" },
  ];
  const SEND_DATA = { payees: PAYEES, draft: { recipient: "p_priya", amount: 40, reference: "Dinner" }, quote: { fee: 0, arrives: "2026-09-28T20:56:00Z" } };

  /**
   * The spec's money-send-form example (packages/spec/examples/money-send-form.json) with its
   * button saying what it does, and without the fee receipt so the whole screen fits a phone under
   * the question. Everything else is the example as published.
   */
  const SEND = {
    specVersion: "0.3.0",
    surface: { id: "send", title: "Send money", intent: "money.send", pattern: "multi-step-form" },
    root: "form",
    components: [
      { id: "form", component: "Form", children: ["recipient", "amount", "reference"], submit: { label: "Send £40.00", action: { event: { name: "transfer.review", context: { recipient: { path: "/draft/recipient" }, amount: { path: "/draft/amount" }, reference: { path: "/draft/reference" } } } } } },
      { id: "recipient", component: "Choice", key: "recipient", label: "Who are you sending to?", options: { path: "/payees", valuePath: "id", labelPath: "name", avatarPath: "initials", recentPath: "recent", descriptionPath: "bank" }, value: { path: "/draft/recipient" }, required: true },
      { id: "amount", component: "TextInput", key: "amount", label: "Amount", kind: "currency", currency: "GBP", value: { path: "/draft/amount" }, required: true, validation: { min: 0.01, max: 5000, message: "Enter an amount between £0.01 and £5,000" }, size: "hero" },
      { id: "reference", component: "TextInput", key: "reference", label: "Reference", help: "Shown on their statement", value: { path: "/draft/reference" }, validation: { maxLength: 18 } },
    ],
    data: SEND_DATA,
  };

  /** apps/film/src/cuts/return-shoes.json: the film's return form (Fernly). */
  const RETURN = {
    specVersion: "0.3.0",
    surface: { id: "return", title: "Return an item", intent: "commerce.order.return", pattern: "single-form" },
    root: "form",
    components: [
      { id: "form", component: "Form", children: ["item", "reason", "refund"], submit: { label: "Start return", action: { event: { name: "return.start", context: { reason: { path: "/draft/reason" }, refund: { path: "/draft/refund" } } } } } },
      { id: "item", component: "Card", title: "Trail runners, size 9", subtitle: "Delivered 12 September · £84.00", badge: { text: "Returnable until 12 Oct", tone: "success" } },
      { id: "reason", component: "Choice", key: "reason", label: "Why are you sending them back?", options: [{ value: "small", label: "Too small" }, { value: "big", label: "Too big" }, { value: "other", label: "Something else" }], value: { path: "/draft/reason" }, required: true },
      { id: "refund", component: "Choice", key: "refund", label: "What would you like?", options: [{ value: "exchange", label: "Swap for size 10", description: "In stock, sent when we receive these" }, { value: "refund", label: "Refund to my card", description: "£84.00 in 3–5 days" }], value: { path: "/draft/refund" }, required: true },
    ],
    data: { draft: { reason: "small", refund: "exchange" } },
  };

  /** apps/film/src/cuts/new-address.json: the council's change-of-address form (Wexley). */
  const ADDRESS = {
    specVersion: "0.3.0",
    surface: { id: "address", title: "Tell us your new address", intent: "resident.address_change", pattern: "single-form" },
    root: "form",
    components: [
      { id: "form", component: "Form", children: ["line1", "town", "postcode", "moved"], submit: { label: "Update my address", action: { event: { name: "address.update", context: { line1: { path: "/draft/line1" }, town: { path: "/draft/town" }, postcode: { path: "/draft/postcode" }, moved: { path: "/draft/moved" } } } } } },
      { id: "line1", component: "TextInput", key: "line1", label: "Address", value: { path: "/draft/line1" }, required: true, autocomplete: "address-line1" },
      { id: "town", component: "TextInput", key: "town", label: "Town or city", value: { path: "/draft/town" }, required: true, autocomplete: "address-level2" },
      { id: "postcode", component: "TextInput", key: "postcode", label: "Postcode", value: { path: "/draft/postcode" }, required: true, autocomplete: "postal-code" },
      { id: "moved", component: "DateInput", key: "moved", label: "When did you move?", value: { path: "/draft/moved" }, required: true },
    ],
    data: { draft: { line1: "14 Orchard Row", town: "Wexley", postcode: "WX4 2LP", moved: "2026-09-01" } },
  };

  /** The invented apps and the design system each one is built with. */
  const APPS = {
    halden: { name: "Halden", theme: "material3" },
    ledger: { name: "Ledger", theme: "carbon" },
    tidings: { name: "Tidings", theme: "polaris" },
    fernly: { name: "Fernly", theme: "shadcn" },
    wexley: { name: "Wexley Council", theme: "govuk" },
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const ARROW = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5M5.5 9.5 10 5l4.5 4.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const TICK = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9.5l3.2 3L14 5.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /**
   * One app's screen: status bar, app bar, a conversation, optionally the input at the bottom.
   * Returns the element and handles to the parts the timeline drives.
   *   o.app        APPS entry
   *   o.asked      the person's question, shown as sent (or "" for none)
   *   o.doc/o.data a document for the real renderer to draw under the question
   *   o.composer   show the input (while the person is typing)
   *   o.toBottom   keep the newest words in view (a long streaming reply)
   *   o.reply      the app's reply bubble: its "thinking" dots, then these words (the timeline
   *                switches between them and may fill the words in as they stream)
   *   o.toast      a message after the action
   *   o.where      the label at the right of the app bar (default "Assistant")
   *   o.crossfades this screen cross-fades with another one in the same phone
   */
  function appScreen(o) {
    const el = document.createElement("div");
    el.className = "app";
    el.setAttribute("data-pxd-theme", o.app.theme);
    el.setAttribute("data-pxd-mode", "light");
    el.innerHTML =
      `<div class="app-bar"><div class="status"><span>9:41</span><span class="battery"></span></div>` +
      `<div class="bar"><div class="app-icon">${esc(o.app.name[0])}</div><div class="app-name">${esc(o.app.name)}</div><div class="app-where">${esc(o.where ?? "Assistant")}</div></div></div>` +
      `<div class="chat${o.composer ? " with-composer" : ""}${o.toBottom ? " to-bottom" : ""}">` +
      (o.asked !== undefined ? `<div class="row me q"><div class="bubble">${esc(o.asked)}</div></div>` : "") +
      (o.reply !== undefined ? `<div class="row them reply"><div class="bubble"><span class="dots"><i></i><i></i><i></i></span><span class="words">${esc(o.reply)}</span></div></div>` : "") +
      (o.doc ? `<div class="answer"></div>` : "") +
      `</div>` +
      (o.composer ? `<div class="composer"><div class="field"><span class="typed"></span><span class="caret"></span><span class="ph">Ask anything</span></div><div class="send">${ARROW}</div></div>` : "") +
      (o.toast ? `<div class="toast${o.composer ? " above" : ""}">${TICK}<span>${esc(o.toast)}</span></div>` : "");
    const handles = { el };
    if (o.doc) {
      const host = el.querySelector(".answer");
      window.PolyxdWeb.mount(host, { document: o.doc, data: o.data ?? o.doc.data, theme: o.app.theme, mode: "light", density: "compact", locale: "en-GB" });
      handles.parts = revealParts(host);
      const bar = host.querySelector(".pxd-action-bar");
      if (bar) {
        handles.bar = bar;
        handles.button = bar.querySelector(".pxd-button-primary");
      }
    }
    // A screen that cross-fades with another in the same phone overlaps it on purpose, for a moment.
    if (o.crossfades) el.querySelectorAll("*").forEach((n) => n.setAttribute("data-layout-allow-overlap", ""));
    handles.question = el.querySelector(".q");
    handles.dots = el.querySelector(".dots");
    handles.dot = el.querySelectorAll(".dots i");
    handles.reply = el.querySelector(".reply");
    handles.words = el.querySelector(".reply .words");
    handles.typed = el.querySelector(".typed");
    handles.caret = el.querySelector(".caret");
    handles.placeholder = el.querySelector(".ph");
    handles.send = el.querySelector(".send");
    handles.toast = el.querySelector(".toast");
    return handles;
  }

  /** The parts a person reads, in order: the title (with its legend), each field, the buttons. */
  function revealParts(root) {
    const out = [];
    const title = root.querySelector(".pxd-surface-title");
    const legend = root.querySelector(".pxd-required-legend");
    if (title) out.push(legend ? [title, legend] : title);
    root.querySelectorAll(".pxd-form-fields > *").forEach((el) => {
      if (el !== legend) out.push(el);
    });
    const bar = root.querySelector(".pxd-action-bar");
    if (bar) out.push(bar);
    return out;
  }

  /** Characters of `text` typed by time t, one every `every` seconds from `from`. */
  const typed = (t, from, text, every = 0.06) => text.slice(0, Math.max(0, Math.min(text.length, Math.floor((t - from) / every) + (t >= from ? 1 : 0))));

  /**
   * The conversation at time t, as a pure function of t: what is in the input, the app's thinking
   * dots, and its reply (all at once, or streaming word by word).
   *   s.text, s.typeFrom, s.sendAt     the question: typed from typeFrom, sent at sendAt
   *   s.dotsFrom, s.replyAt            dots from dotsFrom; the words replace them at replyAt
   *   s.streamTo                       if set, the words stream in from replyAt until streamTo
   */
  function converse(h, t, s) {
    if (h.typed) {
      const sent = s.sendAt !== undefined && t >= s.sendAt;
      const typing = s.typeFrom !== undefined && t >= s.typeFrom && !sent;
      const txt = typing ? typed(t, s.typeFrom, s.text) : "";
      h.typed.textContent = txt;
      h.caret.style.display = typing ? "inline-block" : "none";
      h.placeholder.style.display = typing ? "none" : "inline";
      h.send.classList.toggle("ready", txt.length > 0);
    }
    if (h.reply && s.replyAt !== undefined) {
      const thinking = t < s.replyAt;
      h.dots.style.display = thinking ? "inline-flex" : "none";
      h.words.style.display = thinking ? "none" : "inline";
      if (thinking) h.dot.forEach((d, i) => (d.style.opacity = (0.3 + 0.55 * Math.max(0, Math.sin((t - (s.dotsFrom ?? 0)) * 5 - i * 0.8))).toFixed(3)));
      if (s.streamTo !== undefined) {
        if (!h.all) h.all = h.words.textContent.split(" ");
        const n = Math.max(1, Math.min(h.all.length, Math.round(((t - s.replyAt) / (s.streamTo - s.replyAt)) * h.all.length)));
        h.words.textContent = h.all.slice(0, n).join(" ");
      }
    }
  }

  // ——— Motion: every move uses the brand's easing; nothing overshoots ———

  /** Fade (and a small rise) in. */
  function inn(tl, el, at, dur = 0.6, rise = 12) {
    tl.fromTo(el, { opacity: 0, y: rise }, { opacity: 1, y: 0, duration: dur, ease, immediateRender: false }, at);
  }
  /** Fade out, in place. */
  function out(tl, el, at, dur = 0.5) {
    tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: dur, ease, immediateRender: false }, at);
  }
  /** Reveal a screen's parts one after another. Returns when the last one has landed. */
  function assemble(tl, parts, at, every = 0.55, dur = 0.5) {
    parts.forEach((p, i) => inn(tl, p, at + i * every, dur, 10));
    return at + (parts.length - 1) * every + dur;
  }
  /** Hide elements at build time and at t=0, so a seek back to the start is clean. */
  function hide(tl, els) {
    const list = [].concat(...els.map((e) => (Array.isArray(e) ? e : [e]))).filter(Boolean);
    window.gsap.set(list, { opacity: 0 });
    tl.set(list, { opacity: 0 }, 0);
  }
  /** A finger on the button: it lands, presses for a moment, lifts (0.7 s). */
  function tap(tl, h, at) {
    tl.fromTo(h.bar, { "--finger": 0 }, { "--finger": 1, duration: 0.2, ease, immediateRender: false }, at);
    tl.fromTo(h.button, { filter: "brightness(1)" }, { filter: "brightness(0.86)", duration: 0.15, ease, immediateRender: false }, at + 0.18);
    tl.fromTo(h.button, { filter: "brightness(0.86)" }, { filter: "brightness(1)", duration: 0.25, ease, immediateRender: false }, at + 0.42);
    tl.fromTo(h.bar, { "--finger": 1 }, { "--finger": 0, duration: 0.25, ease, immediateRender: false }, at + 0.45);
  }

  window.Film = { APPS, SEND, SEND_DATA, RETURN, ADDRESS, appScreen, revealParts, typed, converse, inn, out, assemble, hide, tap, ease, esc };
})();
