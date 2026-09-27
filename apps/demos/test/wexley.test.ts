import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { matchAsk, type IntentDef } from "../kit/ask.ts";
import { seed, zoneForPostcode } from "../wexley/seed.ts";
import { feeDifferenceFor, resolveSlots, surfaceData } from "../wexley/views.ts";

const dir = new URL("../wexley/intents/", import.meta.url);
const all = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")))
  .map((raw) => ({ ...raw, slots: raw.slots ? Object.fromEntries(Object.entries(raw.slots as Record<string, string>).map(([k, v]) => [k, new RegExp(v, "i")])) : undefined })) as (IntentDef & { data: Record<string, unknown>; fill?: Record<string, string>; sample?: Record<string, unknown>; document: { data: Record<string, unknown> } })[];
const intents = all.filter((i) => i.ask.length);

test("every example ask reaches its own intent", () => {
  for (const intent of intents) for (const ask of intent.ask) assert.equal(matchAsk(ask, intents)?.intent.id, intent.id, `"${ask}"`);
});

test("asks in other words still land", () => {
  const cases: [string, string][] = [
    ["we've moved house, can you change the address on the permit", "permit.address-change"],
    ["I got a parking ticket and want to challenge it", "fine.appeal"],
    ["when is the plumber coming to fix the tap", "repair.status"],
    ["can I pay my council tax over 12 instalments", "counciltax.instalments"],
    ["the recycling wasn't collected on Tuesday", "bin.missed"],
    ["my parking permit expires soon, renew it", "permit.renew"],
    ["what documents do you still need for housing benefit", "benefit.evidence"],
    ["I need to rebook the repair appointment", "appointment.rebook"],
  ];
  for (const [ask, id] of cases) assert.equal(matchAsk(ask, intents)?.intent.id, id, `"${ask}"`);
});

test("nonsense is refused rather than guessed", () => {
  for (const ask of ["book me a flight to Lisbon", "what's the weather", "asdf qwer"]) assert.equal(matchAsk(ask, intents), null, `"${ask}"`);
});

test("slots become ids and values, and pre-fill the draft", () => {
  const w = seed();
  const bin = matchAsk("my recycling was missed", intents)!;
  assert.equal(resolveSlots(w, bin.slots).bin, "recycling");
  const data = surfaceData(w, bin.intent, resolveSlots(w, bin.slots)) as { report: { bin: string } };
  assert.equal(data.report.bin, "recycling");

  const count = matchAsk("spread my council tax over 12 months", intents)!;
  assert.equal(resolveSlots(w, count.slots).count, 12);
  const plan = surfaceData(w, count.intent, resolveSlots(w, count.slots)) as { plan: { count: number } };
  assert.equal(plan.plan.count, 12);

  const pcn = matchAsk(`appeal parking fine ${w.fines[0].number}`, intents)!;
  assert.equal(resolveSlots(w, pcn.slots).fine, "pcn_1");
});

test("a postcode finds its zone and the fee difference follows the zone", () => {
  const w = seed();
  assert.equal(zoneForPostcode(w, "WX1 2HD")?.id, "B");
  assert.equal(zoneForPostcode(w, "wx12hd")?.id, "B");
  assert.equal(zoneForPostcode(w, "WX2 4QR")?.id, "C");
  assert.equal(zoneForPostcode(w, "SW1A 1AA"), null);
  assert.ok(feeDifferenceFor(w, "B") > 0, "moving to a dearer zone costs");
  assert.ok(feeDifferenceFor(w, "D") < 0, "moving to a cheaper zone refunds");
  assert.equal(feeDifferenceFor(w, "C"), 0);
});

test("every document's snapshot data has every top-level key its data map names", () => {
  for (const intent of all) {
    for (const key of Object.keys(intent.data)) assert.ok(key in intent.document.data, `${intent.id}: ${key}`);
  }
});
