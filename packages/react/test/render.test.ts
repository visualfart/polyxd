import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { PolyxdSurface, PolyxdSkeleton } from "../dist/index.js";

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
  // Priority sits behind "Priority and notes", so open the detail to see its control.
  const out = html(load("tasks-add.json"), { disclosure: "show-everything" });
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

test("disclosure: 'show-everything' opens detail that would otherwise start closed", () => {
  const doc = load("tasks-add.json");
  const openCount = (s: string) => (s.match(/data-state="open"/g) ?? []).length;
  assert.equal(openCount(html(doc)), 0);
  assert.ok(openCount(html(doc, { disclosure: "show-everything" })) > 0, "a Disclosure should start open");
});

test("skeleton is a busy status named for the surface it stands in for", () => {
  const skeleton = (props: Record<string, unknown>) => renderToString(createElement(PolyxdSkeleton, { theme: "material3", ...props }));
  const list = skeleton({ shape: "list", title: "Flights" });
  assert.match(list, /class="pxd-surface pxd-skeleton pxd-skeleton-list"[^>]*role="status"[^>]*aria-busy="true"/);
  assert.match(list, /<span class="pxd-sr-only">Preparing Flights<\/span>/);
  assert.equal((list.match(/pxd-skeleton-square/g) ?? []).length, 5);
  const form = skeleton({ shape: "form" });
  assert.match(form, /pxd-skeleton-form/);
  assert.match(form, /<span class="pxd-sr-only">Preparing<\/span>/);
  assert.equal((form.match(/pxd-skeleton-field/g) ?? []).length, 4);
  // A pattern picks the shape; an explicit shape wins over it.
  assert.match(skeleton({ pattern: "compare-and-choose" }), /pxd-skeleton-compare/);
  assert.match(skeleton({ pattern: "compare-and-choose", shape: "dialog" }), /pxd-skeleton-dialog/);
  assert.match(skeleton({}), /pxd-skeleton-detail/);
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
  // Server render assumes a non-Apple platform, so the markup is the same on every host.
  assert.match(out, /<button[^>]*aria-keyshortcuts="Control\+Enter"/);
  assert.match(out, /<span class="pxd-kbd-hint" aria-hidden="true"><kbd class="pxd-kbd">Ctrl<\/kbd><kbd class="pxd-kbd">Enter<\/kbd><\/span>/);
  const plain = html(doc({}));
  assert.doesNotMatch(plain, /aria-keyshortcuts/);
  assert.doesNotMatch(plain, /pxd-kbd/);
});

/** A one-surface document around the given components; the first is the root. */
const doc = (components: any[], data: Record<string, unknown> = {}) => ({ specVersion: "0.2.0", surface: { id: "t", title: "Test" }, root: components[0].id, components, data });
const action = (id: string, label: string, extra: Record<string, unknown> = {}) => ({ id, component: "Action", label, action: { event: { name: `t.${id}` } }, ...extra });

test("forms validate on submit, not with the browser's bubbles, and start without a summary", () => {
  const out = html(load("tasks-add.json"));
  assert.match(out, /<form[^>]* novalidate=""/i);
  assert.doesNotMatch(out, /pxd-error-summary/);
});

test("action bars render every action as a button on the server; folding is measured in the browser", () => {
  const out = html(doc([{ id: "bar", component: "ActionBar", children: ["save", "share", "rename", "archive", "delete"] }, action("save", "Save", { emphasis: "primary" }), action("share", "Share"), action("rename", "Rename"), action("archive", "Archive"), action("delete", "Delete", { tone: "danger" })]));
  for (const label of ["Save", "Share", "Rename", "Archive", "Delete"]) assert.match(out, new RegExp(`<button[^>]*>(?:(?!</button>).)*${label}`));
  assert.doesNotMatch(out, /More actions/);
  assert.doesNotMatch(out, /pxd-menu-item/);
});

test("gallery pictures that resolve open a viewer; ones that do not stay placeholders", () => {
  const gallery = doc([{ id: "g", component: "Media", kind: "gallery", alt: "Room photos", items: { path: "/photos" }, imagePath: "image", altPath: "alt" }], {
    photos: [
      { image: "p1", alt: "Kitchen" },
      { image: "p2", alt: "Garden" },
      { image: "gone", alt: "Attic" },
    ],
  });
  const out = html(gallery, { resolveMedia: (ref: string) => (ref === "gone" ? undefined : `https://img.example/${ref}.jpg`) });
  assert.match(out, /<button[^>]*class="pxd-gallery-item"[^>]*aria-label="Open Kitchen"/);
  assert.match(out, /aria-label="Open Garden"/);
  assert.doesNotMatch(out, /Open Attic/);
  assert.match(out, /pxd-media-placeholder[^"]*"[^>]*aria-label="Attic"/);
  assert.doesNotMatch(out, /pxd-viewer/); // closed until a picture is chosen
});
