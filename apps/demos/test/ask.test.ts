import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { matchAsk, type IntentDef } from "../kit/ask.ts";
import { seed } from "../halden/seed.ts";
import { resolveSlots, surfaceData } from "../halden/views.ts";

const dir = new URL("../halden/intents/", import.meta.url);
const intents = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")))
  .map((raw) => ({ ...raw, slots: raw.slots ? Object.fromEntries(Object.entries(raw.slots as Record<string, string>).map(([k, v]) => [k, new RegExp(v, "i")])) : undefined }))
  .filter((i) => i.ask.length) as (IntentDef & { data: Record<string, unknown>; fill?: Record<string, string> })[];

test("every example ask reaches its own intent", () => {
  for (const intent of intents) for (const ask of intent.ask) assert.equal(matchAsk(ask, intents)?.intent.id, intent.id, `"${ask}"`);
});

test("asks in other words still land", () => {
  const cases: [string, string][] = [
    ["how much did I spend on coffee this month?", "spend.category"],
    ["send priya £20 for lunch", "money.send"],
    ["can you freeze my card, I think I lost it", "card.freeze"],
    ["I've been charged twice by Ryde", "payment.dispute"],
    ["what subscriptions am I paying for", "subscriptions.list"],
    ["set a budget of £120 for eating out", "budget.set"],
  ];
  for (const [ask, id] of cases) assert.equal(matchAsk(ask, intents)?.intent.id, id, `"${ask}"`);
});

test("nonsense is refused rather than guessed", () => {
  for (const ask of ["book me a flight to Lisbon", "what's the weather", "asdf qwer"]) assert.equal(matchAsk(ask, intents), null, `"${ask}"`);
});

test("slots become ids and numbers, and pre-fill the draft", () => {
  const h = seed();
  const m = matchAsk("send £40 to Priya for dinner", intents)!;
  const slots = resolveSlots(h, m.slots);
  assert.equal(slots.amount, 40);
  assert.equal(slots.payee, "p_priya");
  assert.equal(slots.reference, "dinner");
  const data = surfaceData(h, m.intent, slots) as { draft: { payeeId: string; amount: number } };
  assert.equal(data.draft.payeeId, "p_priya");
  assert.equal(data.draft.amount, 40);

  const c = matchAsk("what did I spend on eating out this month", intents)!;
  assert.equal(resolveSlots(h, c.slots).category, "eating-out");
  const d = matchAsk("I was charged twice by Ryde", intents)!;
  assert.equal(resolveSlots(h, d.slots).merchant, "m_ryde");
});
