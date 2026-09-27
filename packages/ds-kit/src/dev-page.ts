/**
 * The `polyxd dev` page: plain HTML, CSS and JS shipped with the package, so a preview needs no
 * build step on the author's side. Its chrome is in the system font; only the surface is in the
 * pack's. Everything it knows about the folder comes from /api/documents and the event stream.
 */
export interface PageOptions {
  dir: string;
  /** The pack selected on first open. */
  theme: string;
  /** A pack added with --pack, by name. */
  pack?: string;
  verify: boolean;
  /** Whether the renderer bundle is installed. */
  bundle: boolean;
  themes: string[];
}

export function devPage(options: PageOptions): string {
  return PAGE.replace("__OPTIONS__", JSON.stringify(options).replace(/</g, "\\u003c"));
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>polyxd dev</title>
<link rel="stylesheet" href="/preview/polyxd.css">
<link rel="stylesheet" href="/pack.css" id="packcss">
<style>
  :root { color-scheme: light; --bg: #f4f4f6; --panel: #ffffff; --line: #dcdce2; --ink: #1c1c22; --muted: #6a6a75; --accent: #3554d1; --ok: #2e9e5b; --warn: #d99a1b; --err: #d0392b; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); display: flex; flex-direction: column; }
  button, select { font: inherit; color: inherit; }
  code, pre { font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .bar { display: flex; align-items: center; gap: 16px; padding: 8px 14px; background: var(--panel); border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .bar h1 { font-size: 14px; margin: 0; font-weight: 600; }
  .bar .dir { color: var(--muted); font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .controls { display: flex; align-items: center; gap: 12px; margin-left: auto; flex-wrap: wrap; }
  .controls label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); }
  select { padding: 4px 6px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .seg button { border: 0; background: #fff; padding: 4px 10px; cursor: pointer; border-right: 1px solid var(--line); }
  .seg button:last-child { border-right: 0; }
  .seg button[aria-pressed="true"] { background: var(--ink); color: #fff; }
  .status { color: var(--muted); min-width: 120px; }
  .status.live::before { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--ok); margin-right: 6px; }
  .status.off::before { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--err); margin-right: 6px; }
  .layout { flex: 1; display: grid; grid-template-columns: 260px 1fr 400px; min-height: 0; }
  .list { border-right: 1px solid var(--line); background: var(--panel); overflow: auto; padding: 8px 0; }
  .list h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 8px 14px 4px; font-weight: 600; }
  .doc { display: grid; grid-template-columns: 12px 1fr; gap: 0 8px; width: 100%; text-align: left; border: 0; background: none; padding: 7px 14px; cursor: pointer; }
  .doc:hover { background: #f0f0f4; }
  .doc[aria-current="true"] { background: #e8ecfb; }
  .doc .dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 5px; background: var(--ok); }
  .doc .dot.warn { background: var(--warn); }
  .doc .dot.err { background: var(--err); }
  .doc .t { font-weight: 500; }
  .doc .m { color: var(--muted); font-size: 12px; font-family: ui-monospace, Menlo, monospace; }
  .doc .k { color: var(--muted); font-size: 11px; }
  .stage { overflow: auto; padding: 20px; display: flex; justify-content: center; align-items: flex-start; }
  .frame { position: relative; flex: none; min-height: 60%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 0 0 1px var(--line); border-radius: 6px; overflow: visible; }
  .frame .grip { position: absolute; top: 0; right: -14px; width: 10px; height: 100%; cursor: ew-resize; border-radius: 4px; background: transparent; }
  .frame .grip::after { content: ""; position: absolute; top: 50%; left: 3px; width: 4px; height: 36px; margin-top: -18px; border-radius: 2px; background: #c2c2cc; }
  .frame .grip:hover::after, .frame .grip.on::after { background: var(--accent); }
  #surface { min-height: 200px; }
  .empty { padding: 40px; color: var(--muted); text-align: center; }
  .panel { border-left: 1px solid var(--line); background: var(--panel); display: flex; flex-direction: column; min-height: 0; }
  .tabs { display: flex; border-bottom: 1px solid var(--line); }
  .tabs button { flex: 1; border: 0; background: none; padding: 9px 4px; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; font-size: 12px; }
  .tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); }
  .tabs button b { font-weight: 600; }
  .pane { display: none; overflow: auto; flex: 1; padding: 12px 14px; }
  .pane.on { display: block; }
  .pane pre { margin: 0; white-space: pre-wrap; word-break: break-word; background: #f6f6f8; border: 1px solid var(--line); border-radius: 6px; padding: 10px; }
  .pane h3 { font-size: 12px; margin: 14px 0 6px; color: var(--muted); font-weight: 600; }
  .pane h3:first-child { margin-top: 0; }
  .note { color: var(--muted); margin: 0 0 10px; }
  .toolrow { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
  .btn { border: 1px solid var(--line); background: #fff; border-radius: 6px; padding: 4px 10px; cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .btn[disabled] { opacity: .5; cursor: default; }
  .issue { display: grid; grid-template-columns: 52px 1fr; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .issue .sev { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; padding-top: 2px; }
  .issue .sev.error { color: var(--err); }
  .issue .sev.warning { color: var(--warn); }
  .issue .at { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: var(--muted); }
  .action { padding: 8px 0; border-bottom: 1px solid var(--line); }
  .action .n { font-weight: 600; }
  .action .s { color: var(--muted); font-size: 12px; }
  .action pre { margin-top: 4px; }
  .verify-out { font-size: 11px; max-height: none; }
  .verify-out .err { color: var(--err); }
  .warning-box { background: #fff7e6; border: 1px solid #f0d9a0; padding: 10px; border-radius: 6px; margin-bottom: 10px; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 220px 1fr; } .panel { grid-column: 1 / -1; border-left: 0; border-top: 1px solid var(--line); max-height: 40vh; } }
</style>
</head>
<body>
<header class="bar">
  <h1>polyxd dev</h1>
  <span class="dir" id="dir"></span>
  <div class="controls">
    <label>Pack <select id="theme" aria-label="Design-system pack"></select></label>
    <div class="seg" id="mode" role="group" aria-label="Mode"><button data-v="light">Light</button><button data-v="dark">Dark</button></div>
    <div class="seg" id="width" role="group" aria-label="Width"><button data-v="390">Phone</button><button data-v="820">Tablet</button><button data-v="1100">Desktop</button></div>
    <span id="widthpx" class="dir">390px</span>
    <label>Density <select id="density" aria-label="Density"><option value="comfortable">comfortable</option><option value="compact">compact</option><option value="spacious">spacious</option></select></label>
    <span class="status" id="status" aria-live="polite"></span>
  </div>
</header>
<main class="layout">
  <nav class="list" id="list" aria-label="Documents"></nav>
  <section class="stage" id="stage">
    <div class="frame" id="frame" style="width:390px">
      <div id="surface"></div>
      <div class="grip" id="grip" title="Drag to resize" role="separator" aria-orientation="vertical" aria-label="Resize the surface"></div>
    </div>
  </section>
  <aside class="panel">
    <div class="tabs" role="tablist" aria-label="Panel">
      <button role="tab" data-tab="issues" id="tab-issues">Issues</button>
      <button role="tab" data-tab="document">Document</button>
      <button role="tab" data-tab="data">Data</button>
      <button role="tab" data-tab="actions" id="tab-actions">Actions</button>
      <button role="tab" data-tab="verify">Verify</button>
    </div>
    <div class="pane" id="pane-issues" role="tabpanel"></div>
    <div class="pane" id="pane-document" role="tabpanel">
      <div class="toolrow"><button class="btn" id="copy-doc">Copy JSON</button><span class="note" id="doc-note"></span></div>
      <pre id="doc-json"></pre>
    </div>
    <div class="pane" id="pane-data" role="tabpanel"></div>
    <div class="pane" id="pane-actions" role="tabpanel"></div>
    <div class="pane" id="pane-verify" role="tabpanel"></div>
  </aside>
</main>
<script src="/preview/polyxd.js"></script>
<script>
(function () {
  var O = __OPTIONS__;
  var P = window.Polyxd;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var pretty = function (v) { return JSON.stringify(v, null, 2); };
  var time = function () { return new Date().toLocaleTimeString("en-GB"); };

  // ---- state, kept across reloads of this page; the event stream never reloads it ----
  var KEY = "polyxd-dev:" + O.dir;
  var state = { selected: null, theme: O.theme, mode: "light", width: 390, density: "comfortable", tab: "issues" };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

  var docs = [], broken = [], current = null, handle = null, versions = {}, actions = [], liveData = null, verifyStream = null;
  var themes = (P && P.themes) || O.themes;
  if (O.pack && themes.indexOf(O.pack) < 0) themes = [O.pack].concat(themes);
  if (themes.indexOf(state.theme) < 0) state.theme = O.theme;
  if (!O.pack) $("packcss").remove();

  // ---- controls ----
  $("dir").textContent = O.dir;
  var themeSel = $("theme");
  themes.forEach(function (t) { var o = document.createElement("option"); o.value = t; o.textContent = t === O.pack ? t + " (--pack)" : t; themeSel.appendChild(o); });
  themeSel.value = state.theme;
  themeSel.onchange = function () { state.theme = themeSel.value; save(); render(); };
  var dens = $("density");
  dens.value = state.density;
  dens.onchange = function () { state.density = dens.value; save(); render(); };
  var seg = function (id, get, set) {
    var el = $(id);
    var paint = function () { Array.prototype.forEach.call(el.querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === String(get()))); }); };
    el.onclick = function (e) { var b = e.target.closest("button"); if (!b) return; set(b.dataset.v); paint(); };
    paint();
    return paint;
  };
  var paintMode = seg("mode", function () { return state.mode; }, function (v) { state.mode = v; save(); render(); });
  var paintWidth = seg("width", function () { return state.width; }, function (v) { setWidth(Number(v)); });
  function setWidth(w) {
    var max = Math.max(320, $("stage").clientWidth - 60);
    state.width = Math.round(Math.min(max, Math.max(320, w)));
    $("frame").style.width = state.width + "px";
    $("widthpx").textContent = state.width + "px";
    paintWidth();
    save();
  }
  setWidth(state.width);
  // The grip: drag the surface's edge to any width between phone and the stage.
  (function () {
    var grip = $("grip"), startX = 0, startW = 0;
    var move = function (e) { setWidth(startW + (e.clientX - startX)); };
    var up = function () { grip.classList.remove("on"); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    grip.addEventListener("pointerdown", function (e) { startX = e.clientX; startW = state.width; grip.classList.add("on"); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); e.preventDefault(); });
    grip.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") setWidth(state.width - 20); if (e.key === "ArrowRight") setWidth(state.width + 20); });
    grip.tabIndex = 0;
  })();

  // ---- tabs ----
  var tabs = document.querySelectorAll(".tabs button");
  var showTab = function (name) {
    state.tab = name; save();
    Array.prototype.forEach.call(tabs, function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === name)); });
    Array.prototype.forEach.call(document.querySelectorAll(".pane"), function (p) { p.classList.toggle("on", p.id === "pane-" + name); });
  };
  Array.prototype.forEach.call(tabs, function (b) { b.onclick = function () { showTab(b.dataset.tab); }; });
  showTab(state.tab);

  // ---- the document list ----
  var dot = function (check) { return check.errors ? "err" : check.warnings ? "warn" : "ok"; };
  function paintList() {
    var list = $("list");
    var html = "<h2>" + docs.length + " document" + (docs.length === 1 ? "" : "s") + "</h2>";
    if (!docs.length) html += '<p class="note" style="padding:0 14px">No documents here yet. A document is a JSON file with <code>specVersion</code> and <code>components</code>, or an intent file with a <code>document</code> inside.</p>';
    docs.forEach(function (d) {
      var kind = [d.kind, d.origin, d.dataFrom === "none" ? "no data" : d.dataFrom === "embedded" ? null : "data: " + d.dataFrom].filter(Boolean).join(" · ");
      var title = d.check.errors + " error(s), " + d.check.warnings + " warning(s)";
      html += '<button class="doc" data-file="' + esc(d.file) + '" aria-current="' + (d.file === state.selected) + '" title="' + esc(title) + '">' +
        '<span class="dot ' + dot(d.check) + '" aria-label="' + esc(title) + '"></span>' +
        '<span><span class="t">' + esc(d.title) + '</span><br><span class="m">' + esc(d.id || d.file) + '</span><br><span class="k">' + esc(kind) + '</span></span></button>';
    });
    if (broken.length) {
      html += "<h2>Did not parse</h2>";
      broken.forEach(function (b) { html += '<div class="doc" title="' + esc(b.message) + '"><span class="dot err"></span><span><span class="m">' + esc(b.file) + '</span><br><span class="k">' + esc(b.message) + '</span></span></div>'; });
    }
    list.innerHTML = html;
    Array.prototype.forEach.call(list.querySelectorAll("button.doc"), function (b) { b.onclick = function () { select(b.dataset.file); }; });
  }

  // ---- the selected document ----
  function select(file) {
    if (!docs.some(function (d) { return d.file === file; })) file = docs.length ? docs[0].file : null;
    var changed = file !== state.selected;
    state.selected = file; save();
    paintList();
    if (!file) { current = null; unmount(); $("surface").innerHTML = '<p class="empty">Nothing to render.</p>'; paintPanels(); return; }
    if (changed) { actions = []; liveData = null; stopVerify(); }
    fetch("/api/documents/" + encodeURIComponent(file).replace(/%2F/g, "/")).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) return;
      current = d;
      versions[file] = (versions[file] || 0) + 1;
      render();
      paintPanels();
    });
  }
  function unmount() { if (handle) { handle.unmount(); handle = null; } }
  function render() {
    if (!current) return;
    if (!P) { $("surface").innerHTML = '<p class="empty">The renderer bundle isn\\u2019t installed, so nothing renders here: <code>npm install @polyxd/react</code>, then start again.</p>'; return; }
    var file = current.file;
    var props = {
      key: file + ":" + versions[file],
      document: current.document,
      data: current.data,
      theme: state.theme,
      mode: state.mode,
      density: state.density,
      onAction: function (e) { actions.unshift({ at: time(), name: e.name, source: e.source, context: e.context }); paintActions(); },
      onDismiss: function () { actions.unshift({ at: time(), name: "ui.dismiss", source: "(surface)", context: {} }); paintActions(); },
      onDataChange: function (d) { liveData = d; if (state.tab === "data") paintData(); }
    };
    if (handle) handle.update(props);
    else { $("surface").innerHTML = ""; handle = P.mount($("surface"), props); }
  }

  // ---- panels ----
  function paintPanels() { paintIssues(); paintDocument(); paintData(); paintActions(); paintVerify(); }
  function issuesOf(d) {
    if (P && P.validateDocument) {
      try {
        var doc = d.data !== undefined ? Object.assign({}, d.document, { data: d.data }) : d.document;
        return P.validateDocument(doc, { missingData: "warning" }).issues;
      } catch (e) { return [{ severity: "error", at: "/", message: "validator failed: " + e.message }]; }
    }
    return d.issues || [];
  }
  function paintIssues() {
    var pane = $("pane-issues"), tab = $("tab-issues");
    if (!current) { pane.innerHTML = '<p class="note">Select a document.</p>'; tab.innerHTML = "Issues"; return; }
    var issues = issuesOf(current);
    var errors = issues.filter(function (i) { return i.severity === "error"; }).length;
    var warnings = issues.length - errors;
    tab.innerHTML = "Issues" + (issues.length ? " <b>" + issues.length + "</b>" : "");
    var html = '<p class="note">Static check' + (P ? " (run in this page with @polyxd/spec/browser)" : "") + ": schema, structure and every binding against the data the surface shows. " +
      (issues.length ? errors + " error" + (errors === 1 ? "" : "s") + ", " + warnings + " warning" + (warnings === 1 ? "" : "s") + "." : "Nothing to report.") + "</p>";
    issues.forEach(function (i) {
      html += '<div class="issue"><span class="sev ' + i.severity + '">' + i.severity + "</span><span>" + esc(i.message) + '<br><span class="at">' + esc(i.at) + (i.code ? " · " + esc(i.code) : "") + "</span></span></div>";
    });
    pane.innerHTML = html;
  }
  function paintDocument() {
    if (!current) { $("doc-json").textContent = ""; $("doc-note").textContent = ""; return; }
    $("doc-json").textContent = pretty(current.document);
    $("doc-note").textContent = current.file + " · " + current.document.components.length + " components" + (current.kind === "intent" ? " · from the intent file's document" : "");
  }
  $("copy-doc").onclick = function () {
    if (!current) return;
    var b = $("copy-doc");
    navigator.clipboard.writeText(pretty(current.document)).then(function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy JSON"; }, 1200); }, function () { b.textContent = "Couldn\\u2019t copy"; });
  };
  function paintData() {
    var pane = $("pane-data");
    if (!current) { pane.innerHTML = '<p class="note">Select a document.</p>'; return; }
    var from = { embedded: "the document\\u2019s own data", sibling: "the sibling .data.json file", "default": "--data", none: "nowhere: this document has no data" }[current.dataFrom];
    var html = "<h3>Data from " + esc(from) + "</h3>";
    html += current.data === undefined ? '<p class="note">Bindings will render blank. Put a <code>data</code> snapshot in the document, a <code>' + esc(current.file.replace(/\\.json$/, ".data.json")) + "</code> beside it, or pass <code>--data</code>.</p>" : "<pre>" + esc(pretty(current.data)) + "</pre>";
    if (liveData) html += "<h3>As edited in the surface</h3><pre>" + esc(pretty(liveData)) + "</pre>";
    pane.innerHTML = html;
  }
  function paintActions() {
    var pane = $("pane-actions"), tab = $("tab-actions");
    tab.innerHTML = "Actions" + (actions.length ? " <b>" + actions.length + "</b>" : "");
    if (!actions.length) { pane.innerHTML = '<p class="note">Actions the surface dispatches show here with their context resolved against the data: press a button, choose a row, submit a form.</p>'; return; }
    pane.innerHTML = '<div class="toolrow"><button class="btn" id="clear-actions">Clear</button></div>' + actions.map(function (a) {
      return '<div class="action"><span class="n">' + esc(a.name) + '</span> <span class="s">from ' + esc(a.source) + " · " + a.at + "</span><pre>" + esc(pretty(a.context)) + "</pre></div>";
    }).join("");
    $("clear-actions").onclick = function () { actions = []; paintActions(); };
  }

  // ---- verify: the full verifier, streamed ----
  function stopVerify() { if (verifyStream) { verifyStream.close(); verifyStream = null; } }
  function paintVerify() {
    var pane = $("pane-verify");
    if (!O.verify) { pane.innerHTML = '<p class="note">Start with <code>--verify</code> to run the full verifier from here: every built-in pack, light and dark, phone and desktop, with axe and the layout check. It needs <code>@polyxd/verifier</code> installed.</p>'; return; }
    pane.innerHTML = '<div class="toolrow"><button class="btn primary" id="run-verify"' + (current ? "" : " disabled") + ">Verify in " + O.themes.length + ' packs</button><span class="note" id="verify-note"></span></div><pre class="verify-out" id="verify-out"></pre>';
    $("run-verify").onclick = runVerify;
  }
  function runVerify() {
    if (!current) return;
    stopVerify();
    var out = $("verify-out"), btn = $("run-verify"), note = $("verify-note");
    out.textContent = ""; btn.disabled = true; note.textContent = "Running\\u2026 (26 renders; a minute or so)";
    verifyStream = new EventSource("/api/verify/" + encodeURIComponent(current.file).replace(/%2F/g, "/"));
    verifyStream.addEventListener("line", function (e) {
      var d = JSON.parse(e.data);
      var span = document.createElement("span");
      span.className = d.stream === "err" ? "err" : "";
      span.textContent = d.text + "\\n";
      out.appendChild(span);
      out.scrollTop = out.scrollHeight;
    });
    verifyStream.addEventListener("done", function (e) {
      var d = JSON.parse(e.data);
      note.textContent = d.code === 0 ? "Done: no errors." : d.code === 1 ? "Done: errors found." : "Did not run.";
      btn.disabled = false;
      stopVerify();
    });
    verifyStream.onerror = function () { note.textContent = "Stream ended."; btn.disabled = false; stopVerify(); };
  }

  // ---- the folder, live ----
  function apply(listing) {
    docs = listing.documents; broken = listing.broken || [];
    paintList();
  }
  function setStatus(text, cls) { var s = $("status"); s.textContent = text; s.className = "status " + (cls || ""); }
  var events = new EventSource("/api/events");
  events.addEventListener("hello", function (e) {
    apply(JSON.parse(e.data));
    setStatus("watching", "live");
    if (!current || !docs.some(function (d) { return d.file === state.selected; })) select(state.selected);
  });
  events.addEventListener("change", function (e) {
    var d = JSON.parse(e.data);
    apply(d);
    if (state.selected && d.removed.indexOf(state.selected) >= 0) { select(null); setStatus("removed " + time(), "live"); return; }
    if (state.selected && d.changed.indexOf(state.selected) >= 0) { select(state.selected); setStatus("reloaded " + time(), "live"); }
    else if (!state.selected && docs.length) select(docs[0].file);
    else setStatus("watching", "live");
  });
  events.addEventListener("bye", function () { setStatus("server stopped", "off"); });
  events.onerror = function () { setStatus("reconnecting\\u2026", "off"); };
  window.addEventListener("resize", function () { setWidth(state.width); });
})();
</script>
</body>
</html>
`;
