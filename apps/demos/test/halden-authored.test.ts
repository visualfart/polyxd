import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { lastMonth, seed, spent, thisMonth } from "../halden/seed.ts";
import { surfaceData } from "../halden/views.ts";

/**
 * Halden's authored screens: Polyxd documents a person wrote as screens of the product. They bind
 * to the same views as the generated surfaces, so the same guarantees hold: every pointer in the
 * document reaches data, and the data has no holes.
 */
const dir = new URL("../halden/authored/", import.meta.url);
const docs = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ file: f, ...JSON.parse(readFileSync(new URL(f, dir), "utf8")) })) as { file: string; id: string; ask: string[]; data: Record<string, unknown>; sample?: Record<string, unknown>; document: { surface: { origin?: string; intent?: string }; components: Record<string, unknown>[]; data: Record<string, unknown> } }[];

/** Every leaf under a value, as JSON Pointers, with undefined leaves kept so a hole can be named. */
function leaves(v: unknown, at = ""): [string, unknown][] {
  if (Array.isArray(v)) return v.flatMap((x, i) => leaves(x, `${at}/${i}`));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => leaves(x, `${at}/${k}`));
  return [[at, v]];
}

/** Every absolute binding in a document, and the relative ones with the list they read from. */
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

test("the three authored screens resolve by id, as authored, with no ask phrases", () => {
  assert.deepEqual(docs.map((d) => d.id).sort(), ["screen.budgets", "screen.card", "screen.insights"]);
  for (const d of docs) {
    assert.equal(d.file, `${d.id}.json`, `${d.file} is named after its id, so its report is found`);
    assert.equal(d.document.surface.origin, "authored", d.id);
    assert.equal(d.document.surface.intent, d.id, d.id);
    assert.deepEqual(d.ask, [], `${d.id} is a screen, not an ask`);
  }
});

test("each authored document's snapshot has no undefined leaves", () => {
  const h = seed();
  for (const d of docs) {
    const data = surfaceData(h, d, d.sample ?? {});
    for (const [at, v] of leaves(data)) assert.notEqual(v, undefined, `${d.id}: ${at} is undefined`);
    for (const key of Object.keys(d.data)) assert.ok(key in data, `${d.id}: data map names "${key}"`);
    // The snapshot in the file is the same shape (the figures move with the date; the keys don't).
    assert.deepEqual(Object.keys(d.document.data).sort(), Object.keys(data).sort(), `${d.id}: snapshot keys`);
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

test("the budgets screen figures are the React screen's", () => {
  const h = seed();
  const { budgets } = surfaceData(h, docs.find((d) => d.id === "screen.budgets")!, {}) as { budgets: { used: number; limit: number; rows: { category: string; used: number; limit: number }[]; without: { category: string }[] } };
  const month = thisMonth();
  assert.equal(budgets.limit, h.budgets.reduce((s, b) => s + b.limit, 0));
  assert.equal(budgets.used, Math.round(h.budgets.reduce((s, b) => s + spent(h, month, b.category), 0) * 100) / 100);
  for (const r of budgets.rows) assert.equal(r.used, spent(h, month, r.category));
  for (const w of budgets.without) assert.ok(!h.budgets.some((b) => b.category === w.category) && spent(h, lastMonth(), w.category) > 0, w.category);
});

test("insights follows the month the person picks", () => {
  const h = seed();
  const doc = docs.find((d) => d.id === "screen.insights")!;
  const now = surfaceData(h, doc, {}) as { insights: { month: string; total: number; rows: unknown[] } };
  assert.equal(now.insights.month, thisMonth());
  assert.equal(now.insights.total, spent(h, thisMonth()));
  const then = surfaceData(h, doc, { month: lastMonth() }) as { insights: { month: string; total: number; fixed: { total: number } } };
  assert.equal(then.insights.month, lastMonth());
  assert.equal(then.insights.total, spent(h, lastMonth()));
  // Rent on the 1st and the three bills: what the React screen hard-coded, now read from the month's payments.
  assert.equal(then.insights.fixed.total, Math.round((1150 + 78.4 + 31.2 + 164) * 100) / 100);
  // A month with no payments falls back to this month rather than showing nothing.
  assert.equal((surfaceData(h, doc, { month: "1999-01" }) as { insights: { month: string } }).insights.month, thisMonth());
});

test("the card screen shows frozen state and follows the switch", () => {
  const h = seed();
  const doc = docs.find((d) => d.id === "screen.card")!;
  const active = surfaceData(h, doc, {}) as { card: { active: boolean; frozen: boolean; statusDetail: string; frozenSince: string; onlinePayments: boolean } };
  assert.equal(active.card.active, true);
  assert.equal(active.card.statusDetail, "Active");
  h.card.frozen = true;
  h.card.frozenAt = new Date().toISOString();
  h.card.onlinePayments = false;
  const frozen = surfaceData(h, doc, {}) as typeof active;
  assert.equal(frozen.card.frozen, true);
  assert.match(frozen.card.statusDetail, /^Frozen today at \d\d:\d\d$/);
  assert.match(frozen.card.frozenSince, /^Since today at /);
  assert.equal(frozen.card.onlinePayments, false);
});
