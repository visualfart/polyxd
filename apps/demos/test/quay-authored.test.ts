import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { covers, daysAgo, discountState, discountUses, ordersBetween, seed, summarize } from "../quay/seed.ts";
import { live, reportCsv, surfaceData } from "../quay/views.ts";

/**
 * Quay's authored screens: Polyxd documents a person wrote as screens of the admin (Analytics,
 * Inventory, Discounts). They bind to the same views as the generated surfaces, so the same
 * guarantees hold: every pointer in the document reaches data, the data has no holes, and the
 * figures are the store's.
 */
const dir = new URL("../quay/authored/", import.meta.url);
const docs = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ file: f, ...JSON.parse(readFileSync(new URL(f, dir), "utf8")) })) as { file: string; id: string; ask: string[]; capabilities: string[]; data: Record<string, unknown>; sample?: Record<string, unknown>; document: { surface: { origin?: string; intent?: string; presentation?: string }; components: Record<string, unknown>[]; data: Record<string, unknown> } }[];
const registry = JSON.parse(readFileSync(new URL("../quay/registry.json", import.meta.url), "utf8")) as { capabilities: Record<string, unknown> };

/** Every leaf under a value, as JSON Pointers, with undefined leaves kept so a hole can be named. */
function leaves(v: unknown, at = ""): [string, unknown][] {
  if (Array.isArray(v)) return v.flatMap((x, i) => leaves(x, `${at}/${i}`));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => leaves(x, `${at}/${k}`));
  return [[at, v]];
}

/** Every absolute binding in a document. */
function bindings(components: Record<string, unknown>[]): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.path === "string" && o.path.startsWith("/") && Object.keys(o).length <= 2) out.push(o.path);
    for (const x of Object.values(o)) walk(x);
  };
  walk(components);
  return out;
}

/** Every capability an action in the document names. */
function events(components: Record<string, unknown>[]): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (o.event && typeof (o.event as { name?: unknown }).name === "string") out.push((o.event as { name: string }).name);
    for (const x of Object.values(o)) walk(x);
  };
  walk(components);
  return [...new Set(out)];
}

test("the three authored screens resolve by id, as authored pages, with no ask phrases", () => {
  assert.deepEqual(docs.map((d) => d.id).sort(), ["screen.analytics", "screen.discounts", "screen.inventory"]);
  for (const d of docs) {
    assert.equal(d.file, `${d.id}.json`, `${d.file} is named after its id, so its report is found`);
    assert.equal(d.document.surface.origin, "authored", d.id);
    assert.equal(d.document.surface.presentation, "page", d.id);
    assert.equal(d.document.surface.intent, d.id, d.id);
    assert.deepEqual(d.ask, [], `${d.id} is a screen, not an ask`);
  }
});

test("every button is a capability the registry knows and the document declares", () => {
  for (const d of docs) {
    for (const name of events(d.document.components)) {
      assert.ok(name in registry.capabilities, `${d.id}: ${name} is in registry.json`);
      assert.ok(d.capabilities.includes(name), `${d.id}: ${name} is declared`);
    }
  }
});

test("each authored document's snapshot has no undefined leaves and the same keys as the live data", () => {
  const h = seed();
  for (const d of docs) {
    const data = surfaceData(h, d, d.sample ?? {});
    for (const [at, v] of leaves(data)) assert.notEqual(v, undefined, `${d.id}: ${at} is undefined`);
    for (const key of Object.keys(d.data)) assert.ok(key in data, `${d.id}: data map names "${key}"`);
    // The snapshot in the file is the same shape (the figures move with the date; the keys don't).
    assert.deepEqual(Object.keys(d.document.data).sort(), Object.keys(data).sort(), `${d.id}: snapshot keys`);
    for (const [at, v] of leaves(d.document.data)) assert.notEqual(v, undefined, `${d.id} (snapshot): ${at} is undefined`);
  }
});

test("every absolute binding in an authored document reaches a value", () => {
  const h = seed();
  for (const d of docs) {
    const data = surfaceData(h, d, d.sample ?? {});
    const at = (pointer: string) => pointer.split("/").slice(1).reduce<any>((o, k) => (o == null ? undefined : o[k]), data);
    for (const p of bindings(d.document.components)) assert.notEqual(at(p), undefined, `${d.id}: ${p}`);
  }
});

test("analytics shows the store's figures for the range, against the period before", () => {
  const h = seed();
  const doc = docs.find((d) => d.id === "screen.analytics")!;
  type A = { analytics: { range: string; sales: number; orders: number; sessions: number; salesChange: number; series: { revenue: number; previous: number }[]; top: { sales: number; share: number }[]; breakdown: { gross: number; net: number; discounts: number }; byType: { sales: number }[]; bySource: { sales: number }[] } };
  const thirty = surfaceData(h, doc, {}) as A;
  const cur = summarize(h, daysAgo(29), daysAgo(0));
  const prev = summarize(h, daysAgo(59), daysAgo(30));
  assert.equal(thirty.analytics.range, "30");
  assert.equal(thirty.analytics.sales, cur.sales);
  assert.equal(thirty.analytics.orders, cur.orders);
  assert.equal(thirty.analytics.sessions, cur.sessions);
  assert.equal(thirty.analytics.salesChange, (cur.sales - prev.sales) / prev.sales);
  assert.equal(thirty.analytics.breakdown.net, cur.net);
  // The chart's periods add up to the range's sales, and the comparison series to the period before.
  assert.equal(thirty.analytics.series.length, 10);
  assert.equal(Math.round(thirty.analytics.series.reduce((s, p) => s + p.revenue, 0) * 100), Math.round(cur.sales * 100));
  assert.equal(Math.round(thirty.analytics.series.reduce((s, p) => s + p.previous, 0) * 100), Math.round(prev.sales * 100));
  // Top products by sales, most first, with their share of gross sales.
  const orders = ordersBetween(h, daysAgo(29), daysAgo(0));
  const gross = orders.reduce((s, o) => s + o.subtotal, 0);
  assert.ok(thirty.analytics.top.length <= 8 && thirty.analytics.top.length > 0);
  for (let i = 1; i < thirty.analytics.top.length; i++) assert.ok(thirty.analytics.top[i - 1].sales >= thirty.analytics.top[i].sales);
  assert.ok(Math.abs(thirty.analytics.top[0].share - thirty.analytics.top[0].sales / gross) < 1e-6);
  assert.equal(Math.round(thirty.analytics.bySource.reduce((s, r) => s + r.sales, 0) * 100), Math.round(cur.sales * 100));
  assert.equal(Math.round(thirty.analytics.byType.reduce((s, r) => s + r.sales, 0) * 100), Math.round(gross * 100));

  // Choosing another range in the surface re-derives everything from the store.
  const seven = live(h, doc.id, { ...thirty, analytics: { ...thirty.analytics, range: "7" } }) as A;
  const week = summarize(h, daysAgo(6), daysAgo(0));
  assert.equal(seven.analytics.range, "7");
  assert.equal(seven.analytics.sales, week.sales);
  assert.equal(seven.analytics.series.length, 7);
  const ninety = surfaceData(h, doc, { range: "90" }) as A;
  assert.equal(ninety.analytics.series.length, 15);
  assert.equal(ninety.analytics.orders, h.orders.filter((o) => o.status !== "canceled").length);
  // An unknown range falls back to the last 30 days rather than showing nothing.
  assert.equal((surfaceData(h, doc, { range: "365" }) as A).analytics.range, "30");
});

test("inventory lists every tracked variant with the store's stock and follows the filters", () => {
  const h = seed();
  const doc = docs.find((d) => d.id === "screen.inventory")!;
  type I = { inventory: { rows: { id: string; inventory: number; days: number | null; status: string; committed: number }[]; count: number; tracked: number; outOfStock: number; low: number; filters: { q: string; threshold: string; types: string[] } } };
  const all = surfaceData(h, doc, {}) as I;
  const tracked = covers(h);
  assert.equal(all.inventory.tracked, tracked.length);
  assert.equal(all.inventory.rows.length, tracked.length);
  assert.equal(all.inventory.count, tracked.length);
  assert.equal(all.inventory.outOfStock, tracked.filter((c) => c.variant.inventory === 0).length);
  assert.equal(all.inventory.low, tracked.filter((c) => c.variant.inventory === 0 || (c.days !== null && c.days <= 14)).length);
  for (const r of all.inventory.rows) {
    const c = tracked.find((x) => x.variant.id === r.id)!;
    assert.equal(r.inventory, c.variant.inventory);
    assert.equal(r.days, c.days);
    assert.equal(r.committed, h.orders.filter((o) => o.status === "open").reduce((s, o) => s + o.items.filter((it) => it.variantId === r.id).reduce((t, it) => t + it.qty - it.fulfilled, 0), 0));
  }
  assert.ok(all.inventory.rows.some((r) => r.status === "Under a week" || r.status === "Under two weeks" || r.status === "Out of stock"), "the seed has something running low");

  const low = live(h, doc.id, { ...all, inventory: { ...all.inventory, filters: { q: "", threshold: "14", types: [] } } }) as I;
  assert.equal(low.inventory.count, all.inventory.low);
  assert.ok(low.inventory.rows.every((r) => r.inventory === 0 || (r.days !== null && r.days <= 14)));
  const candles = live(h, doc.id, { ...all, inventory: { ...all.inventory, filters: { q: "amber", threshold: "all", types: ["candle"] } } }) as I;
  assert.ok(candles.inventory.count > 0 && candles.inventory.count < all.inventory.count);
  assert.ok(candles.inventory.rows.every((r) => /amber/i.test(r.id) || tracked.find((c) => c.variant.id === r.id)!.product.title.toLowerCase().includes("amber")));
});

test("discounts lists every discount by state and follows the saved view", () => {
  const h = seed();
  const doc = docs.find((d) => d.id === "screen.discounts")!;
  type D = { discounts: { view: string; rows: { id: string; status: string; uses: number | null }[]; counts: Record<string, number> } };
  const all = surfaceData(h, doc, {}) as D;
  assert.equal(all.discounts.view, "all");
  assert.equal(all.discounts.rows.length, h.discounts.length);
  assert.equal(all.discounts.counts.all, h.discounts.length);
  for (const state of ["active", "scheduled", "expired", "disabled"]) assert.equal(all.discounts.counts[state], h.discounts.filter((d) => discountState(d) === state).length, state);
  for (const r of all.discounts.rows) {
    const d = h.discounts.find((x) => x.id === r.id)!;
    assert.equal(r.uses, d.method === "code" ? discountUses(h, d).length : null);
  }
  const active = live(h, doc.id, { ...all, discounts: { ...all.discounts, view: "active" } }) as D;
  assert.equal(active.discounts.rows.length, all.discounts.counts.active);
  assert.ok(active.discounts.rows.every((r) => r.status === "Active"));
});

test("export builds a CSV of what each report shows", () => {
  const h = seed();
  const analytics = reportCsv(h, "analytics", { range: "7" })!;
  assert.match(analytics.name, /^analytics-7-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.equal(analytics.text.split("\n").length, 8);
  assert.equal(analytics.count, "7 days");
  const inventory = reportCsv(h, "inventory", { filters: { threshold: "0" } })!;
  assert.equal(inventory.text.split("\n").length - 1, covers(h).filter((c) => c.variant.inventory === 0).length);
  const discounts = reportCsv(h, "discounts", { view: "all" })!;
  assert.equal(discounts.text.split("\n").length - 1, h.discounts.length);
  assert.equal(reportCsv(h, "orders", {}), null);
});
