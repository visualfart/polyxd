import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { matchAsk, type IntentDef } from "../kit/ask.ts";
import { seed, daysAgo, isLate, orderByNumber, summarize } from "../quay/seed.ts";
import { live, resolveSlots, surfaceData } from "../quay/views.ts";

const dir = new URL("../quay/intents/", import.meta.url);
const all = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")))
  .map((raw) => ({ ...raw, slots: raw.slots ? Object.fromEntries(Object.entries(raw.slots as Record<string, string>).map(([k, v]) => [k, new RegExp(v, "i")])) : undefined })) as (IntentDef & { data: Record<string, unknown>; fill?: Record<string, string>; sample?: Record<string, unknown> })[];
const intents = all.filter((i) => i.ask.length);

test("every example ask reaches its own intent", () => {
  for (const intent of intents) for (const ask of intent.ask) assert.equal(matchAsk(ask, intents)?.intent.id, intent.id, `"${ask}"`);
});

test("asks in a merchant's own words still land", () => {
  const cases: [string, string][] = [
    ["why were sales down last week?", "revenue.dip"],
    ["what's running low", "inventory.low"],
    ["restock the cedar smoke candle", "inventory.restock"],
    ["which orders haven't shipped", "orders.late"],
    ["make a 20% discount code for returning customers", "discount.create"],
    ["refund order #1042", "order.refund"],
    ["raise candle prices by 5%", "products.reprice"],
    ["send reminders for abandoned checkouts", "checkouts.recover"],
  ];
  for (const [ask, id] of cases) assert.equal(matchAsk(ask, intents)?.intent.id, id, `"${ask}"`);
});

test("nonsense is refused rather than guessed", () => {
  for (const ask of ["book me a flight to Lisbon", "what's the weather", "asdf qwer", "write a poem about candles"]) assert.equal(matchAsk(ask, intents), null, `"${ask}"`);
});

test("slots become ids and numbers, and steer the views", () => {
  const h = seed();

  const r = matchAsk("refund order #1042", intents)!;
  const rs = resolveSlots(h, r.slots);
  assert.equal(rs.order, 1042);
  const rd = surfaceData(h, r.intent, rs) as { refund: { orderId: string; number: string; draft: { itemIds: string[] }; receipt: { total: number } } };
  assert.equal(rd.refund.orderId, orderByNumber(h, 1042)!.id);
  assert.equal(rd.refund.number, "#1042");
  assert.ok(rd.refund.draft.itemIds.length > 0);
  assert.equal(rd.refund.receipt.total, orderByNumber(h, 1042)!.total);

  const p = matchAsk("raise prices 5% on candles", intents)!;
  const ps = resolveSlots(h, p.slots);
  assert.equal(ps.percent, 5);
  assert.equal(ps.type, "candle");
  assert.equal(resolveSlots(h, matchAsk("lower diffuser prices by 10%", intents)!.slots).percent, -10);
  const pd = surfaceData(h, p.intent, ps) as { preview: { rows: { before: number; after: number }[]; count: number } };
  assert.equal(pd.preview.count, h.products.filter((x) => x.type === "candle" && x.status !== "archived").reduce((s, x) => s + x.variants.length, 0));
  assert.ok(pd.preview.rows.every((x) => x.after >= x.before));

  const v = matchAsk("restock the lavender candle", intents)!;
  const vs = resolveSlots(h, v.slots);
  const lavender = h.products.find((x) => x.title === "Lavender Field Candle")!;
  assert.ok(lavender.variants.some((x) => x.id === vs.variant), "the lavender candle's lowest-stock variant");
  const vd = surfaceData(h, v.intent, vs) as { draft: { variantId: string; quantity: number }; note: { text: string } };
  assert.equal(vd.draft.variantId, vs.variant);
  assert.ok(vd.draft.quantity >= 12);
  assert.match(vd.note.text, /Lavender Field/);

  const d = matchAsk("make a 15% discount for repeat customers", intents)!;
  const ds = resolveSlots(h, d.slots);
  assert.equal(ds.percent, 15);
  assert.equal(ds.audience, "returning");
  const dd = surfaceData(h, d.intent, ds) as { draft: { value: number; audience: string; code: string }; review: { reachText: string } };
  assert.equal(dd.draft.value, 15);
  assert.equal(dd.draft.audience, "returning");
  assert.match(dd.draft.code, /^RETURN15/);
  assert.match(dd.review.reachText, /customers can use it/);

  const l = matchAsk("what's about to sell out in 30 days", intents)!;
  assert.equal(resolveSlots(h, l.slots).days, 30);
});

test("the dip explanation names the real causes from the data", () => {
  const h = seed();
  const intent = all.find((i) => i.id === "revenue.dip")!;
  const data = surfaceData(h, intent, {}) as { dip: { lastWeek: number; weekBefore: number; change: number; reasons: string[]; restockVariantIds: string[]; series: unknown[] } };
  const last = summarize(h, daysAgo(7), daysAgo(1));
  const before = summarize(h, daysAgo(14), daysAgo(8));
  assert.equal(data.dip.lastWeek, last.sales);
  assert.equal(data.dip.weekBefore, before.sales);
  assert.ok(data.dip.change < -0.15, `sales fell: ${data.dip.change}`);
  assert.equal(data.dip.series.length, 14);
  assert.ok(data.dip.reasons.some((r) => /Amber & Oak Candle \(8 oz\) was out of stock/.test(r)), "names the first stock-out");
  assert.ok(data.dip.reasons.some((r) => /Sea Salt & Sage Candle \(8 oz\) was out of stock/.test(r)), "names the second stock-out");
  assert.ok(data.dip.reasons.some((r) => /Fall scents launch \(Meta ads\) was paused/.test(r)), "names the paused campaign");
  assert.equal(data.dip.restockVariantIds.length, 2);
});

test("late orders are the unfulfilled ones past their promise", () => {
  const h = seed();
  const intent = all.find((i) => i.id === "orders.late")!;
  const data = surfaceData(h, intent, {}) as { late: { rows: { id: string }[]; selection: { ids: string[] } } };
  assert.deepEqual(
    data.late.rows.map((r) => r.id).sort(),
    h.orders.filter(isLate).map((o) => o.id).sort(),
  );
  assert.ok(data.late.rows.length >= 3);
  assert.deepEqual(data.late.selection.ids, data.late.rows.map((r) => r.id));
});

test("the live bridge re-derives from the store as inputs change", () => {
  const h = seed();
  const low = all.find((i) => i.id === "inventory.low")!;
  const data = surfaceData(h, low, { days: 60 }) as { filters: { days: number; types: string[] }; results: { count: number } };
  const narrowed = live(h, low.id, { ...data, filters: { days: 7, types: [] } }) as { results: { count: number; caption: string } };
  assert.ok(narrowed.results.count <= data.results.count);
  assert.match(narrowed.results.caption, /7 days/);
  const candlesOnly = live(h, low.id, { ...data, filters: { days: 60, types: ["candle"] } }) as { results: { rows: { type: string }[] } };
  assert.ok(candlesOnly.results.rows.every((r) => r.type === "Candle"));

  const refund = all.find((i) => i.id === "order.refund")!;
  const rd = surfaceData(h, refund, { order: 1042 }) as { refund: { draft: { itemIds: string[] }; receipt: { total: number } } };
  const fewer = live(h, refund.id, { ...rd, refund: { ...rd.refund, draft: { ...rd.refund.draft, itemIds: [] } } }) as { refund: { receipt: { total: number } } };
  assert.equal(fewer.refund.receipt.total, 0);

  const reprice = all.find((i) => i.id === "products.reprice")!;
  const pd = surfaceData(h, reprice, { percent: 5, type: "candle" }) as { reprice: { percent: number; type: string }; preview: { avgAfter: number } };
  const more = live(h, reprice.id, { ...pd, reprice: { percent: 10, type: "candle" } }) as { preview: { avgAfter: number } };
  assert.ok(more.preview.avgAfter > pd.preview.avgAfter);
});

test("every intent's sample builds data with no undefined leaves", () => {
  const h = seed();
  const walk = (v: unknown, at: string) => {
    if (v === undefined) assert.fail(`${at} is undefined`);
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}/${i}`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${at}/${k}`);
  };
  for (const intent of all) walk(surfaceData(h, intent, intent.sample ?? {}), intent.id);
});

test("the analytics agree with the orders", () => {
  const h = seed();
  const s = summarize(h, daysAgo(89), daysAgo(0));
  assert.equal(s.orders, h.orders.filter((o) => o.status !== "canceled").length);
  assert.equal(Math.round(s.sales * 100), Math.round(h.orders.filter((o) => o.status !== "canceled").reduce((t, o) => t + o.total, 0) * 100));
  assert.equal(h.orders.length, 180);
  assert.equal(h.products.length, 60);
  assert.equal(h.customers.length, 90);
});
