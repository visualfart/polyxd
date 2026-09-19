import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { PolyxdSurface } from "../dist/index.js";

const dir = new URL("../../spec/examples/", import.meta.url);
const examples = readdirSync(dir).filter((f) => f.endsWith(".json"));
const load = (f: string) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
const html = (doc: any, props: Record<string, unknown> = {}) => renderToString(createElement(PolyxdSurface, { document: doc, theme: "material3", ...props }));

for (const f of examples) {
  test(`renders ${f}`, () => {
    const out = html(load(f));
    assert.match(out, /class="pxd-surface[^"]*"/);
    assert.doesNotMatch(out, /Unsupported component/);
  });
}

test("formats bound values with the locale", () => {
  const out = html(load("money-balance-overview.json"));
  assert.match(out, /£2,450\.12/);
  assert.match(out, /down 8%/); // spoken change for screen readers
});

test("choice picks a control by option count", () => {
  const out = html(load("tasks-add.json"));
  assert.match(out, /pxd-chips/); // 3 short options → chips
  const checkout = html(load("shop-checkout.json"));
  assert.match(checkout, /Step 1 of 3/);
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

test("adapters can replace a component renderer", () => {
  const out = html(load("error-load-failed.json"), { components: { Status: () => createElement("marquee", null, "custom status") } });
  assert.match(out, /custom status/);
});
