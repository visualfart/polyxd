/**
 * The preview panel's page. It renders whatever document the extension sends with the bundled
 * renderer (window.Polyxd from @polyxd/react/preview), keeps the surface mounted across edits so
 * what someone typed into an input survives a keystroke in the JSON, and talks to the editor:
 * a click on a component asks for the cursor to go there; the cursor in a component's JSON
 * outlines it here. The controls are `polyxd dev`'s, in the editor's own colours.
 */

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState(): PanelState | undefined;
  setState(s: PanelState): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

interface PanelState {
  theme?: string;
  mode?: "light" | "dark";
  width?: number;
  density?: "compact" | "comfortable" | "spacious";
  logOpen?: boolean;
}

interface Handle {
  update(props: Record<string, unknown>): void;
  unmount(): void;
}
interface PolyxdApi {
  mount(el: HTMLElement, props: Record<string, unknown>): Handle;
  themes: string[];
}

type Incoming =
  | { type: "init"; themes: string[]; theme: string; mode: "light" | "dark"; pack?: { name: string; css: string } }
  | { type: "document"; file: string; title: string; document: any; data?: unknown; dataFrom: string; kind: string; version: number }
  | { type: "none"; reason?: string }
  | { type: "outline"; id?: string }
  | { type: "pack"; pack?: { name: string; css: string } }
  | { type: "editorTheme"; mode: "light" | "dark" };

const vscode = acquireVsCodeApi();
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const P = (window as unknown as { Polyxd?: PolyxdApi }).Polyxd;
const time = () => new Date().toLocaleTimeString("en-GB");

// What this panel was left at, read once: the page saves its defaults as soon as it lays out, so a
// later getState() can no longer tell a choice from a default.
const saved = vscode.getState();
const state: Required<PanelState> = { theme: "material3", mode: "light", width: 390, density: "comfortable", logOpen: true, ...saved };
const save = () => vscode.setState(state);

let themes: string[] = P?.themes ?? [];
let pack: { name: string; css: string } | undefined;
let current: Extract<Incoming, { type: "document" }> | undefined;
let handle: Handle | undefined;
let mountedFile: string | undefined;
let actions: { at: string; name: string; source: string; context: unknown }[] = [];
let outlined: string | undefined;
let modeChosen = false;

// ---- controls ----
const themeSel = $<HTMLSelectElement>("theme");
function paintThemes() {
  const list = pack && !themes.includes(pack.name) ? [pack.name, ...themes] : themes;
  themeSel.innerHTML = "";
  for (const t of list) {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = pack && t === pack.name ? `${t} (polyxd.pack)` : t;
    themeSel.appendChild(o);
  }
  if (!list.includes(state.theme)) state.theme = list[0] ?? "material3";
  themeSel.value = state.theme;
}
themeSel.onchange = () => {
  state.theme = themeSel.value;
  save();
  render();
};
const dens = $<HTMLSelectElement>("density");
dens.value = state.density;
dens.onchange = () => {
  state.density = dens.value as PanelState["density"] & string;
  save();
  render();
};
const seg = (id: string, get: () => string, set: (v: string) => void) => {
  const el = $(id);
  const paint = () => el.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === get())));
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    set(b.dataset.v!);
    paint();
  };
  paint();
  return paint;
};
const paintMode = seg("mode", () => state.mode, (v) => {
  state.mode = v as "light" | "dark";
  modeChosen = true;
  save();
  render();
});
const paintWidth = seg("width", () => String(state.width), (v) => setWidth(Number(v)));
function setWidth(w: number) {
  const max = Math.max(320, $("stage").clientWidth - 48);
  state.width = Math.round(Math.min(max, Math.max(320, w)));
  $("frame").style.width = `${state.width}px`;
  $("widthpx").textContent = `${state.width}px`;
  paintWidth();
  save();
}
setWidth(state.width);
(() => {
  const grip = $("grip");
  let startX = 0;
  let startW = 0;
  const move = (e: PointerEvent) => setWidth(startW + (e.clientX - startX));
  const up = () => {
    grip.classList.remove("on");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  grip.addEventListener("pointerdown", (e) => {
    startX = e.clientX;
    startW = state.width;
    grip.classList.add("on");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    e.preventDefault();
  });
  grip.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") setWidth(state.width - 20);
    if (e.key === "ArrowRight") setWidth(state.width + 20);
  });
  grip.tabIndex = 0;
})();
window.addEventListener("resize", () => setWidth(state.width));

// ---- the surface ----
function empty(message: string) {
  if (handle) {
    handle.unmount();
    handle = undefined;
    mountedFile = undefined;
  }
  $("surface").innerHTML = `<p class="empty">${message}</p>`;
}
function render() {
  if (!current) return;
  if (!P) return empty("The renderer bundle didn't load. Rebuild the extension: <code>npm run build -w polyxd-vscode</code>.");
  const c = current;
  const props = {
    // A new file remounts; a new version of the same file updates in place, keeping input state.
    key: c.file,
    document: c.document,
    data: c.data,
    theme: state.theme,
    mode: state.mode,
    density: state.density,
    onAction: (e: { name: string; source: string; context: unknown }) => log(e.name, e.source, e.context),
    onDismiss: () => log("ui.dismiss", "(surface)", {}),
  };
  if (handle && mountedFile === c.file) handle.update(props);
  else {
    handle?.unmount();
    $("surface").innerHTML = "";
    handle = P.mount($("surface"), props);
    mountedFile = c.file;
  }
  $("file").textContent = `${c.title || c.file} · ${c.file}${c.kind === "intent" ? " · intent file" : ""}${c.dataFrom === "none" ? " · no data" : c.dataFrom === "sibling" ? " · data: sibling" : ""}`;
  if (outlined) requestAnimationFrame(() => outline(outlined));
  reportRendered();
}

// ---- what the page tells the extension about itself ----
// How many components are on screen once React has committed, and anything the content-security
// policy blocked or that threw. The extension warns about a blocked script; the editor smoke test
// reads both.
let reportTimer: ReturnType<typeof setTimeout> | undefined;
function reportRendered() {
  clearTimeout(reportTimer);
  reportTimer = setTimeout(() => {
    if (current) vscode.postMessage({ type: "rendered", file: current.file, components: $("surface").querySelectorAll("[data-pxd-id]").length });
  }, 100);
}
document.addEventListener("securitypolicyviolation", (e) => vscode.postMessage({ type: "problem", kind: "csp", message: `the content-security policy blocked ${e.blockedURI || "a resource"} (${e.effectiveDirective})` }));
window.addEventListener("error", (e) => vscode.postMessage({ type: "problem", kind: "error", message: e.message }));

// ---- outline and selection, both ways ----
function outline(id?: string) {
  outlined = id;
  document.querySelectorAll(".pxd-outline").forEach((el) => el.classList.remove("pxd-outline"));
  if (!id) return;
  const el = $("surface").querySelector<HTMLElement>(`[data-pxd-id="${CSS.escape(id)}"]`);
  if (!el) return;
  el.classList.add("pxd-outline");
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
}
$("stage").addEventListener(
  "click",
  (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-pxd-id]");
    if (!el || !$("surface").contains(el)) return;
    vscode.postMessage({ type: "select", id: el.dataset.pxdId });
  },
  // Capture, so a button's own click still fires and the surface stays usable.
  true,
);

// ---- the action log ----
function log(name: string, source: string, context: unknown) {
  actions.unshift({ at: time(), name, source, context });
  if (actions.length > 100) actions.length = 100;
  paintLog();
}
function paintLog() {
  $("log-count").textContent = actions.length ? String(actions.length) : "";
  const body = $("log-body");
  if (!actions.length) {
    body.innerHTML = '<p class="note">Actions the surface dispatches show here with their context resolved against the data: press a button, choose a row, submit a form.</p>';
    return;
  }
  body.innerHTML = actions
    .map((a) => `<div class="action"><span class="n">${esc(a.name)}</span> <span class="s">from ${esc(a.source)} · ${a.at}</span><pre>${esc(JSON.stringify(a.context, null, 2))}</pre></div>`)
    .join("");
}
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
$("log-toggle").onclick = () => {
  state.logOpen = !state.logOpen;
  save();
  paintLogOpen();
};
$("log-clear").onclick = () => {
  actions = [];
  paintLog();
};
function paintLogOpen() {
  document.body.classList.toggle("log-closed", !state.logOpen);
  $("log-toggle").setAttribute("aria-expanded", String(state.logOpen));
}
paintLogOpen();
paintLog();

// ---- the pack from polyxd.pack ----
function applyPack(next?: { name: string; css: string }) {
  pack = next;
  $("packcss").textContent = next?.css ?? "";
  paintThemes();
  render();
}

// ---- messages from the extension ----
window.addEventListener("message", (e: MessageEvent<Incoming>) => {
  const m = e.data;
  switch (m.type) {
    case "init":
      themes = m.themes.length ? m.themes : themes;
      if (!saved?.theme) state.theme = m.theme;
      if (!saved?.mode) state.mode = m.mode;
      pack = m.pack;
      $("packcss").textContent = pack?.css ?? "";
      paintThemes();
      paintMode();
      save();
      render();
      break;
    case "document":
      if (current && current.file !== m.file) actions = [];
      current = m;
      render();
      paintLog();
      break;
    case "none":
      current = undefined;
      $("file").textContent = "";
      empty(m.reason ?? "Open a Polyxd document to preview it.");
      break;
    case "outline":
      outline(m.id);
      break;
    case "pack":
      applyPack(m.pack);
      break;
    case "editorTheme":
      // The editor's theme sets the default; a mode someone picked here stays.
      if (!modeChosen) {
        state.mode = m.mode;
        paintMode();
        save();
        render();
      }
      break;
  }
});
vscode.postMessage({ type: "ready" });
