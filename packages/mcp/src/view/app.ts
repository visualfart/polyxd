/**
 * The MCP App view: runs in the host's sandboxed iframe, speaks the MCP Apps protocol
 * (SEP-1865, 2026-01-26) to the host over postMessage, and renders the document from
 * polyxd_show's tool result with @polyxd/web. Actions in the screen go back to the host as
 * `ui/message` requests, so the model receives them as the user's next message. A press made while
 * the chat is still replying (Claude refuses `ui/message` then) is held and sent when it accepts.
 *
 * Bundled with every pack's CSS into dist/view.html by scripts/build-view.ts. It is written
 * against the protocol directly, as the spec allows, so the page carries no SDK.
 */
import { mount, type ActionEvent, type Mounted, type UIDocument } from "@polyxd/web";

const PROTOCOL_VERSION = "2026-01-26";
const APP_INFO = { name: "Polyxd", version: "0.4.6" };

type Json = Record<string, any>;
interface HostContext {
  theme?: "light" | "dark";
  containerDimensions?: { height?: number; maxHeight?: number; width?: number; maxWidth?: number };
  locale?: string;
  [key: string]: unknown;
}
interface Shown {
  shown: boolean;
  document?: UIDocument & { data?: Json };
  pack?: string;
  mode?: "light" | "dark";
  issues?: { severity: string; pointer: string; message: string }[];
}

// ---------- JSON-RPC over postMessage ----------

let nextId = 1;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
const post = (message: Json) => window.parent.postMessage({ jsonrpc: "2.0", ...message }, "*");

function request(method: string, params: Json): Promise<any> {
  const id = nextId++;
  post({ id, method, params });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const notify = (method: string, params: Json = {}) => post({ method, params });

window.addEventListener("message", (event) => {
  // Only the host (or its sandbox proxy, which forwards transparently) speaks to this page.
  if (event.source !== window.parent) return;
  const m = event.data;
  if (!m || m.jsonrpc !== "2.0") return;
  if (m.method === undefined && m.id !== undefined) {
    const waiting = pending.get(m.id);
    if (!waiting) return;
    pending.delete(m.id);
    if (m.error) waiting.reject(new Error(m.error.message ?? String(m.error)));
    else waiting.resolve(m.result);
    return;
  }
  if (typeof m.method !== "string") return;
  if (m.id !== undefined) return void answer(m.id, m.method);
  onNotification(m.method, m.params ?? {});
});

/** Requests from the host: the ones a view must answer, and a JSON-RPC error for the rest. */
function answer(id: number | string, method: string) {
  if (method === "ping") return post({ id, result: {} });
  if (method === "ui/resource-teardown") {
    mounted?.unmount();
    mounted = undefined;
    return post({ id, result: {} });
  }
  post({ id, error: { code: -32601, message: `Method not found: ${method}` } });
}

// ---------- State and rendering ----------

let host: HostContext = {};
let shown: Shown | undefined;
let mounted: Mounted | undefined;
const root = document.getElementById("root")!;
const note = document.getElementById("note")!;

const modeFor = (s?: Shown): "light" | "dark" => s?.mode ?? host.theme ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/** A grey square carrying the reference as its title: generated UIs never contain URLs. */
const placeholderMedia = (ref: string) =>
  "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#999"/><title>${String(ref).replace(/[<&]/g, "")}</title></svg>`);

function applyTheme() {
  const html = document.documentElement;
  html.dataset.pxdTheme = shown?.pack ?? "material3";
  html.dataset.pxdMode = modeFor(shown);
  html.style.colorScheme = modeFor(shown);
  const dims = host.containerDimensions;
  if (dims) {
    if (dims.height !== undefined) html.style.height = "100vh";
    else if (dims.maxHeight) html.style.maxHeight = `${dims.maxHeight}px`;
    if (dims.width !== undefined) html.style.width = "100vw";
    else if (dims.maxWidth) html.style.maxWidth = `${dims.maxWidth}px`;
  }
}

function say(text: string) {
  note.textContent = text;
  note.hidden = !text;
}

function status(title: string, detail?: string, list?: string[]) {
  mounted?.unmount();
  mounted = undefined;
  root.replaceChildren();
  const box = document.createElement("div");
  box.className = "pxd-mcp-status";
  const h = document.createElement("p");
  h.className = "pxd-mcp-status-title";
  h.textContent = title;
  box.append(h);
  if (detail) {
    const p = document.createElement("p");
    p.textContent = detail;
    box.append(p);
  }
  if (list?.length) {
    const ul = document.createElement("ul");
    for (const item of list) {
      const li = document.createElement("li");
      li.textContent = item;
      ul.append(li);
    }
    box.append(ul);
  }
  root.append(box);
}

function render() {
  applyTheme();
  if (!shown) return status("Preparing the screen…");
  if (!shown.shown || !shown.document) {
    const errors = (shown.issues ?? []).filter((i) => i.severity === "error");
    return status("The document has errors, so there is nothing to show yet.", undefined, errors.map((i) => `${i.pointer}: ${i.message}`));
  }
  const props = {
    document: shown.document,
    data: shown.document.data ?? {},
    theme: shown.pack,
    mode: modeFor(shown),
    locale: host.locale,
    resolveMedia: placeholderMedia,
    onAction: (e: ActionEvent) => void send(describeAction(e)),
    onDismiss: () => void send(`[Polyxd] I closed the "${title()}" screen.`),
  };
  if (mounted) mounted.update(props);
  else {
    root.replaceChildren();
    mounted = mount(root, props);
  }
}

const title = () => String(shown?.document?.surface?.title ?? shown?.document?.surface?.id ?? "Polyxd");

/** The label of the control that raised an action, for a message a person could have written. */
function labelFor(e: ActionEvent): string | undefined {
  const c: any = (shown?.document?.components ?? []).find((x: any) => x.id === e.source);
  if (!c) return undefined;
  if (typeof c.label === "string" && c.action?.event?.name === e.name) return c.label;
  for (const key of ["submit", "confirm", "cancel", "finish", "action", "primary", "secondary"]) {
    const spec = c[key];
    if (spec?.action?.event?.name === e.name && typeof spec.label === "string") return spec.label;
  }
  return typeof c.label === "string" ? c.label : undefined;
}

function describeAction(e: ActionEvent): string {
  const label = labelFor(e);
  const context = e.context && Object.keys(e.context).length ? `\nContext: ${JSON.stringify(e.context)}` : "";
  return `[Polyxd] In the "${title()}" screen I pressed ${label ? `"${label}" ` : ""}(action ${e.name}).${context}`;
}

/** How long to keep offering a press the chat refused, and how often to try again. */
const RETRY_FOR_MS = 3 * 60_000;
const RETRY_EVERY_MS = 2_000;

/** A request the host may never answer (an older host without the method): resolves undefined after `ms`. */
const requestWithin = (method: string, params: Json, ms: number) =>
  Promise.race([request(method, params).catch(() => undefined), new Promise((r) => setTimeout(() => r(undefined), ms))]);

/** Presses waiting for the chat, oldest first. Claude refuses `ui/message` while it is still replying. */
const queue: string[] = [];
let draining = false;

async function trySend(text: string): Promise<boolean> {
  try {
    const result = await request("ui/message", { role: "user", content: [{ type: "text", text }] });
    return !result?.isError;
  } catch {
    return false;
  }
}

/**
 * Sends each press as the user's next message. When the chat refuses (it is busy replying), the
 * press stays queued and is offered again every few seconds; meanwhile the model is told about it
 * through `ui/update-model-context`, so it isn't lost if the person types instead.
 */
async function send(text: string) {
  queue.push(text);
  if (draining) return say(`Waiting for the chat to finish its reply. ${queue.length} presses will send then, in order.`);
  draining = true;
  let told = false;
  const giveUpAt = Date.now() + RETRY_FOR_MS;
  while (queue.length) {
    say(told ? "Waiting for the chat to finish its reply. This will send then." : "Sending to the chat…");
    if (await trySend(queue[0])) {
      queue.shift();
      continue;
    }
    if (Date.now() > giveUpAt) {
      say("The chat is still busy, so this wasn't sent. Press the button again when Claude has finished.");
      queue.length = 0;
      draining = false;
      return;
    }
    if (!told) {
      told = true;
      void requestWithin("ui/update-model-context", { content: [{ type: "text", text: `${queue.join("\n")}\n(Not sent yet: the chat was busy.)` }] }, 5_000);
    }
    await new Promise((r) => setTimeout(r, RETRY_EVERY_MS));
  }
  // Everything was delivered as messages, so the pending note is no longer true.
  if (told) void requestWithin("ui/update-model-context", { content: [] }, 5_000);
  draining = false;
  say("Sent to the chat.");
}

// ---------- Notifications from the host ----------

function onNotification(method: string, params: Json) {
  switch (method) {
    case "ui/notifications/tool-input":
      if (!shown) render();
      return;
    case "ui/notifications/tool-result": {
      const result = params.structuredContent as Shown | undefined;
      if (result && typeof result.shown === "boolean") shown = result;
      else shown = { shown: false, issues: [{ severity: "error", pointer: "/", message: firstText(params) ?? "The tool returned no screen." }] };
      say("");
      return render();
    }
    case "ui/notifications/tool-cancelled":
      return status("The screen was cancelled.", typeof params.reason === "string" ? params.reason : undefined);
    case "ui/notifications/host-context-changed":
      host = { ...host, ...params };
      return shown?.shown ? render() : applyTheme();
  }
}

const firstText = (r: Json): string | undefined => (Array.isArray(r.content) ? r.content.find((c: any) => c?.type === "text")?.text : undefined);

// ---------- Size ----------

function watchSize() {
  let queued = false;
  let last = { width: 0, height: 0 };
  const measure = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const html = document.documentElement;
      const before = html.style.height;
      html.style.height = "max-content";
      const height = Math.ceil(html.getBoundingClientRect().height);
      html.style.height = before;
      const width = Math.ceil(window.innerWidth);
      if (width === last.width && height === last.height) return;
      last = { width, height };
      notify("ui/notifications/size-changed", last);
    });
  };
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(document.documentElement);
  observer.observe(document.body);
}

// ---------- Start ----------

async function start() {
  applyTheme();
  const result = await request("ui/initialize", {
    appInfo: APP_INFO,
    appCapabilities: { availableDisplayModes: ["inline"] },
    protocolVersion: PROTOCOL_VERSION,
  });
  host = result?.hostContext ?? {};
  notify("ui/notifications/initialized");
  render();
  watchSize();
}

start().catch((err) => status("This screen could not connect to the chat.", (err as Error).message));
