import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { matchAsk, type IntentDef } from "../kit/ask.ts";
import { seed } from "../foundry/seed.ts";
import { live, resolveSlots, surfaceData } from "../foundry/views.ts";

const dir = new URL("../foundry/intents/", import.meta.url);
const all = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")))
  .map((raw) => ({ ...raw, slots: raw.slots ? Object.fromEntries(Object.entries(raw.slots as Record<string, string>).map(([k, v]) => [k, new RegExp(v, "i")])) : undefined })) as (IntentDef & { data: Record<string, unknown>; fill?: Record<string, string>; sample?: Record<string, unknown> })[];
const intents = all.filter((i) => i.ask.length);

test("every example ask reaches its own intent", () => {
  for (const intent of intents) for (const ask of intent.ask) assert.equal(matchAsk(ask, intents)?.intent.id, intent.id, `"${ask}"`);
});

test("asks in other words still land", () => {
  const cases: [string, string][] = [
    ["which accounts are renewing in the next 90 days with open tickets?", "accounts.renewing-with-tickets"],
    ["cancel Vitalis Labs' plan and refund them", "subscription.cancel"],
    ["compare starter and growth for Brightloom", "plans.compare"],
    ["please hand Sam's tickets to Marcus", "tickets.reassign"],
    ["invite two people as agents", "team.invite"],
    ["why is Riverwatch Trust at risk?", "account.health"],
    ["quote Cobaltix's renewal on scale with 5% off", "renewal.quote"],
  ];
  for (const [ask, id] of cases) assert.equal(matchAsk(ask, intents)?.intent.id, id, `"${ask}"`);
});

test("nonsense is refused rather than guessed", () => {
  for (const ask of ["book me a flight to Lisbon", "what's the weather", "asdf qwer", "order more paper for the printer"]) assert.equal(matchAsk(ask, intents), null, `"${ask}"`);
});

test("slots become ids and numbers, and pre-fill the draft", () => {
  const h = seed();
  const byName = (name: string) => h.accounts.find((a) => a.name === name)!.id;

  const q = matchAsk("quote Ledgerline's renewal at 120 seats", intents)!;
  const qs = resolveSlots(h, q.slots);
  assert.equal(qs.account, byName("Ledgerline"));
  assert.equal(qs.seats, 120);
  const qd = surfaceData(h, q.intent, qs) as { quote: { accountId: string; seats: number }; receipt: { seats: number; total: number } };
  assert.equal(qd.quote.accountId, byName("Ledgerline"));
  assert.equal(qd.quote.seats, 120);
  assert.equal(qd.receipt.seats, 120);

  const c = matchAsk("cancel Marrowbank's plan with a prorated refund", intents)!;
  const cs = resolveSlots(h, c.slots);
  assert.equal(cs.account, byName("Marrowbank"));
  assert.equal(cs.refund, "original");
  assert.equal(resolveSlots(h, matchAsk("cancel Quillpay's plan as credit", intents)!.slots).refund, "credit");

  const p = matchAsk("compare Growth and Scale for Harborlane Freight", intents)!;
  const ps = resolveSlots(h, p.slots);
  assert.equal(ps.account, byName("Harborlane Freight"));
  assert.deepEqual(ps.plans, ["growth", "scale"]);
  const pd = surfaceData(h, p.intent, ps) as { compare: { plans: { id: string }[]; recommendation: { plan: string } } };
  assert.deepEqual(pd.compare.plans.map((x) => x.id), ["growth", "scale"]);
  assert.ok(pd.compare.plans.some((x) => x.id === pd.compare.recommendation.plan.toLowerCase()));

  const r = matchAsk("hand Sam's open tickets to Lena", intents)!;
  const rs = resolveSlots(h, r.slots);
  assert.equal(rs.from, "m_sam");
  assert.equal(rs.to, "m_lena");
  const rd = surfaceData(h, r.intent, rs) as { handover: { tickets: { id: string }[]; selection: { ids: string[]; assigneeId: string } } };
  assert.ok(rd.handover.tickets.length > 0, "Sam has open tickets to hand over");
  assert.deepEqual(rd.handover.selection.ids, rd.handover.tickets.map((t) => t.id));
  assert.equal(rd.handover.selection.assigneeId, "m_lena");

  const i = matchAsk("invite dana@basalt.io and eli@basalt.io as managers", intents)!;
  const is = resolveSlots(h, i.slots);
  assert.equal(is.role, "manager");
  assert.deepEqual(is.emails, ["dana@basalt.io", "eli@basalt.io"]);
  const id = surfaceData(h, i.intent, is) as { invite: { role: string; emails: string[] } };
  assert.equal(id.invite.role, "manager");
  assert.equal(id.invite.emails.length, 2);

  const w = matchAsk("at risk accounts renewing this quarter", intents)!;
  const ws = resolveSlots(h, w.slots);
  assert.equal(ws.days, 90);
  assert.deepEqual(ws.health, ["At risk"]);

  const a = matchAsk("why is Ledgerline at risk", intents)!;
  assert.equal(resolveSlots(h, a.slots).account, byName("Ledgerline"));
});

test("the live bridge re-derives results from the store as inputs change", () => {
  const h = seed();
  const intent = all.find((i) => i.id === "accounts.renewing-with-tickets")!;
  const data = surfaceData(h, intent, { days: 90 }) as { filters: { days: number; health: string[]; plans: string[] }; results: { rows: unknown[]; count: number } };
  const wide = data.results.count;
  const narrowed = live(h, intent.id, { ...data, filters: { ...data.filters, days: 30 } }) as { results: { count: number; caption: string } };
  assert.ok(narrowed.results.count <= wide);
  assert.match(narrowed.results.caption, /30 days/);
  const quote = all.find((i) => i.id === "renewal.quote")!;
  const qd = surfaceData(h, quote, { account: h.accounts[0].id }) as { quote: Record<string, unknown>; receipt: { total: number } };
  const more = live(h, quote.id, { ...qd, quote: { ...qd.quote, seats: 500 } }) as { receipt: { seats: number; total: number } };
  assert.equal(more.receipt.seats, 500);
  assert.ok(more.receipt.total > qd.receipt.total);
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
