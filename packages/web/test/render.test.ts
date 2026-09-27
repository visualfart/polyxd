import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { install } from "./shim.ts";

const container = install();
const { mount, registry } = await import("../src/index.ts");
const { COMPONENTS } = await import("@polyxd/core");

const dir = new URL("../../spec/examples/", import.meta.url);
const examples = readdirSync(dir).filter((f) => f.endsWith(".json"));
const load = (f: string) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));

/** Draws a document into a fresh element and returns its HTML (the same tree a browser gets). */
function html(doc: any, props: Record<string, unknown> = {}): string {
  const el = document.createElement("div");
  container.appendChild(el);
  const handle = mount(el as any, { document: doc, theme: "material3", ...props } as any);
  const out = (el as any).innerHTML as string;
  handle.unmount();
  el.remove();
  return out;
}

test("the registry covers every component the spec defines", () => {
  assert.deepEqual(Object.keys(registry).sort(), [...COMPONENTS].sort());
  assert.equal(Object.keys(registry).length, 44);
});

const seen = new Set<string>();
for (const f of examples) {
  test(`renders ${f}`, () => {
    const doc = load(f);
    const out = doc.surface.kind === "shell" ? html(doc, { current: { key: "x", title: "Screen" }, outlet: document.createElement("div") }) : html(doc);
    assert.match(out, /class="pxd-surface[^"]*"/);
    assert.doesNotMatch(out, /Unsupported component/);
    for (const m of out.matchAll(/data-pxd-component="([A-Za-z]+)"/g)) seen.add(m[1]);
  });
}

test("the spec examples exercise most of the registry; every renderer reaches the rest through the demos", () => {
  assert.ok(seen.size >= 30, `${seen.size} components seen: ${[...seen].sort().join(", ")}`);
});

test("formats bound values with the locale", () => {
  const out = html(load("money-balance-overview.json"));
  assert.match(out, /£2,450\.12/);
  assert.match(out, /down 8%/);
});

test("choice picks a control by option count, the same rule as the React renderer", () => {
  const out = html(load("tasks-add.json"), { disclosure: "show-everything" });
  assert.match(out, /pxd-chips/);
  assert.match(html(load("shop-checkout.json")), /Step 1 of 3/);
});

test("tables have captions, header cells and data labels for stacked mobile layout", () => {
  const out = html(load("travel-flight-results.json"));
  assert.match(out, /<caption>Flights from London to Lisbon/);
  assert.match(out, /<th scope="col"/);
  assert.match(out, /data-label="Price"/);
});

test("charts carry the summary and a data table", () => {
  const out = html(load("personal-habits.json"));
  assert.match(out, /You did the most on Tuesday/);
  assert.match(out, /Show data/);
});

test("empty collections show their empty state", () => {
  const doc = load("personal-reading-log.json");
  assert.match(html({ ...doc, data: { books: [] } }), /Nothing on your list yet/);
});

test("section headings nest below the surface title", () => {
  const out = html(load("settings-notifications.json"));
  assert.match(out, /<h1 class="pxd-surface-title">Notifications<\/h1>/);
  assert.match(out, /<h2[^>]*class="pxd-section-title">How we contact you<\/h2>/);
});

test("component renderers can be replaced, and host components fill a Custom", () => {
  const out = html(load("error-load-failed.json"), { components: { Status: () => ({ tag: "marquee", props: {}, children: ["custom status"] }) } });
  assert.match(out, /custom status/);
  const shell = load("shell-product.json");
  const withHost = html(shell, { current: { key: "x" }, components: { "acme.logo": ({ node }: any) => ({ tag: "b", props: { class: "host-logo" }, children: [`host ${node.id}`] }) } });
  assert.doesNotMatch(withHost, /Unsupported/);
});

test("disclosure: 'show-everything' opens detail that would otherwise start closed", () => {
  const doc = load("tasks-add.json");
  const openCount = (s: string) => (s.match(/data-state="open"/g) ?? []).length;
  assert.equal(openCount(html(doc)), 0);
  assert.ok(openCount(html(doc, { disclosure: "show-everything" })) > 0);
});

test("an action's shortcut is announced and shown as keys; without one, neither", () => {
  const doc = (action: Record<string, unknown>) => ({
    specVersion: "0.2.0",
    surface: { id: "t", title: "Test" },
    root: "bar",
    components: [
      { id: "bar", component: "ActionBar", children: ["go"] },
      { id: "go", component: "Action", label: "Send", emphasis: "primary", action: { event: { name: "message.send" } }, ...action },
    ],
  });
  const out = html(doc({ shortcut: "mod+enter" }));
  assert.match(out, /<button[^>]*aria-keyshortcuts="Control\+Enter"/);
  assert.match(out, /<span class="pxd-kbd-hint" aria-hidden="true"><kbd class="pxd-kbd">Ctrl<\/kbd><kbd class="pxd-kbd">Enter<\/kbd><\/span>/);
  const plain = html(doc({}));
  assert.doesNotMatch(plain, /aria-keyshortcuts/);
});

test("inputs write to the surface's data and the host hears every change; actions carry the resolved context", () => {
  const doc = load("money-send-form.json");
  const el = document.createElement("div");
  container.appendChild(el);
  const changes: unknown[] = [];
  const actions: unknown[] = [];
  const handle = mount(el as any, { document: doc, theme: "material3", onDataChange: (d) => changes.push(d), onAction: (e) => actions.push(e) } as any);
  const amount = (el as any).querySelector("input.pxd-input, input.pxd-hero-value");
  assert.ok(amount, "an amount field renders");
  amount.value = "42";
  amount.dispatch("input");
  assert.equal(changes.length, 1);
  assert.equal(handle.data.draft && (handle.data.draft as any).amount, 42);
  const form = (el as any).querySelector("form");
  form.dispatch("submit", { currentTarget: { checkValidity: () => true, elements: [] } });
  assert.equal(actions.length, 1);
  assert.equal((actions[0] as any).name, "transfer.review");
  assert.equal((actions[0] as any).context.amount, 42);
  handle.unmount();
});

test("a shell renders its landmarks in reading order with the host's screen in the outlet", () => {
  const shell = load("shell-product.json");
  const screen = document.createElement("h1");
  screen.textContent = "Orders";
  const out = html(shell, { current: { key: "orders", title: "Orders" }, outlet: screen });
  const order = ["pxd-skip-link", "<header", "<nav", "<main", "<footer"].map((m) => out.indexOf(m));
  assert.ok(order.every((i) => i >= 0), `all landmarks present: ${order}`);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal((out.match(/<main\b/g) ?? []).length, 1);
  assert.match(out, /<main[^>]*class="pxd-outlet"[^>]*><h1>Orders<\/h1>/);
  assert.doesNotMatch(out, /pxd-surface-title/);
});
