import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { matchAsk, type IntentDef } from "../kit/ask.ts";
import { seed, zoneForPostcode } from "../wexley/seed.ts";
import { feeDifferenceFor, resolveSlots, surfaceData } from "../wexley/views.ts";

type File = IntentDef & { data: Record<string, unknown>; fill?: Record<string, string>; sample?: Record<string, unknown>; document: { surface: { origin?: string }; data: Record<string, unknown> } };
const read = (dir: URL) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")))
    .map((raw) => ({ ...raw, slots: raw.slots ? Object.fromEntries(Object.entries(raw.slots as Record<string, string>).map(([k, v]) => [k, new RegExp(v, "i")])) : undefined })) as File[];
const all = read(new URL("../wexley/intents/", import.meta.url));
const authored = read(new URL("../wexley/authored/", import.meta.url));
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
  for (const intent of [...all, ...authored]) {
    for (const key of Object.keys(intent.data)) assert.ok(key in intent.document.data, `${intent.id}: ${key}`);
  }
});

/** Every path to an undefined value, so a failing test names the leaf. */
function undefinedLeaves(value: unknown, at = ""): string[] {
  if (value === undefined) return [at || "/"];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => undefinedLeaves(v, `${at}/${k}`));
}

test("the authored screens are marked authored and build from the seed with no undefined leaves", () => {
  assert.deepEqual(authored.map((a) => a.id).sort(), ["screen.benefits", "screen.bins", "screen.council_tax"]);
  const w = seed();
  for (const screen of authored) {
    assert.equal(screen.document.surface.origin, "authored", screen.id);
    assert.equal(screen.ask.length, 0, `${screen.id} is a screen, not an ask`);
    const data = surfaceData(w, screen, screen.sample ?? {});
    assert.deepEqual(undefinedLeaves(data), [], `${screen.id}: undefined leaves`);
    assert.deepEqual(undefinedLeaves(screen.document.data), [], `${screen.id}: undefined leaves in the snapshot`);
    // The snapshot in the file has the same shape as what the route builds today.
    assert.deepEqual(Object.keys(screen.document.data), Object.keys(data), screen.id);
  }
});

test("the authored bins screen follows the data: a missed report shows and can be withdrawn, garden waste flips", () => {
  const w = seed();
  const screen = authored.find((a) => a.id === "screen.bins")!;
  const before = surfaceData(w, screen, {}) as { bins: { hasMissed: boolean; missed: unknown[]; gardenSubscribed: boolean; next: { bin: string }[] } };
  assert.equal(before.bins.hasMissed, false);
  assert.equal(before.bins.next.length, 4, "refuse, recycling, garden and food");
  w.bins.missed.push({ id: "miss_1", bin: "recycling", date: "2026-09-22", wasOut: true, reportedAt: new Date().toISOString(), collectBy: new Date().toISOString(), status: "open" });
  w.bins.garden.subscribed = false;
  const after = surfaceData(w, screen, {}) as { bins: { hasMissed: boolean; missed: { id: string; open: boolean; status: string }[]; gardenSubscribed: boolean; gardenNotSubscribed: boolean; next: unknown[] } };
  assert.equal(after.bins.hasMissed, true);
  assert.deepEqual(after.bins.missed.map((m) => [m.id, m.open, m.status]), [["miss_1", true, "Reported"]]);
  assert.equal(after.bins.gardenSubscribed, false);
  assert.equal(after.bins.gardenNotSubscribed, true);
  assert.equal(after.bins.next.length, 3, "no garden collection without a subscription");
});

test("the authored benefits screen's tasks follow the evidence, and the button changes once everything is in", () => {
  const w = seed();
  const screen = authored.find((a) => a.id === "screen.benefits")!;
  const before = surfaceData(w, screen, {}) as { claim: { anyMissing: boolean; allSent: boolean; sendLabel: string; evidence: Record<string, { taskStatus: string }> } };
  assert.equal(before.claim.anyMissing, true);
  assert.equal(before.claim.sendLabel, "Send documents");
  assert.deepEqual(Object.values(before.claim.evidence).map((e) => e.taskStatus), ["done", "done", "todo", "todo"]);
  for (const e of w.benefit.evidence) {
    e.status = "done";
    e.receivedAt = new Date().toISOString();
    e.files = e.files.length ? e.files : [{ name: `${e.id}.pdf`, size: 1000 }];
  }
  const after = surfaceData(w, screen, {}) as typeof before;
  assert.equal(after.claim.allSent, true);
  assert.equal(after.claim.sendLabel, "See what we have");
  assert.deepEqual(undefinedLeaves(after), []);
});
