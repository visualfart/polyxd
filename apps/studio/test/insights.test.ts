/**
 * Insights' pure parts (src/insights): the hand-written event check held to event.schema.json
 * itself, the counting, and the report the page reads.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { createSurfaceEvents, type SemanticEvent as CoreEvent, type UIDocument } from "@polyxd/core";
import { aggregate, checkEvent, code, rowOf, bucketOf, type Row } from "../src/insights/events.ts";
import { detail, measures, range, summarise, daysBetween, type StoredRow } from "../src/insights/report.ts";

const spec = new URL("../../../packages/spec/", import.meta.url);
const json = (path: URL) => JSON.parse(readFileSync(path, "utf8"));
const ajv = new Ajv2020.default({ allErrors: true, strict: false, validateFormats: false });
const schemaValid = ajv.compile(json(new URL("schema/event.schema.json", spec)));

/** A plausible event: send money, shown. */
const ev = (over: Record<string, unknown> = {}) => ({
  type: "surface.shown",
  timestamp: "2026-09-29T10:00:00Z",
  sessionId: "s_1",
  surface: { id: "send", intent: "money.send", pattern: "multi-step-form" },
  actor: { kind: "human" },
  ...over,
});

test("checkEvent agrees with event.schema.json (Ajv) on the spec's examples and on every kind of wrong event", () => {
  const examples = readdirSync(new URL("examples/events/", spec)).map((f) => json(new URL(`examples/events/${f}`, spec)));
  const good = [
    ...examples.map(({ $schema: _, ...e }) => e),
    ev(),
    ev({ type: "task.completed", durationMs: 4200, steps: 3, capability: "transfer.review", component: { id: "form", type: "Form" } }),
    ev({ type: "feedback", rating: -1, reason: "too-long" }),
    ev({ surface: { id: "a", intent: "b", experiment: { copy: "v2" }, generator: "m@1", direction: "d@1", journey: "j", specVersion: "0.3.0" }, actor: { kind: "agent", assistiveTech: true } }),
  ];
  const bad = [
    null, [], "event", 3,
    ev({ type: "surface.shownn" }),
    ev({ value: "4111 1111 1111 1111" }),
    ev({ surface: { id: "send", intent: "money.send", title: "Send £40 to Priya" } }),
    ev({ component: { id: "amount", value: "40" } }),
    ev({ actor: { kind: "robot" } }),
    ev({ actor: { kind: "human", name: "Priya" } }),
    ev({ durationMs: -1 }),
    ev({ durationMs: 1.5 }),
    ev({ steps: "3" }),
    ev({ rating: 2 }),
    ev({ reason: 5 }),
    ev({ surface: { id: "send" } }),
    ev({ surface: { id: "a", intent: "b", experiment: { copy: 2 } } }),
    { ...ev(), sessionId: undefined },
    Object.fromEntries(Object.entries(ev()).filter(([k]) => k !== "actor")),
  ];
  for (const e of good) {
    assert.equal(schemaValid(e), true, `the schema takes ${JSON.stringify(e)}: ${JSON.stringify(schemaValid.errors)}`);
    assert.equal(checkEvent(e), true, `checkEvent takes ${JSON.stringify(e)}`);
  }
  for (const e of bad) {
    const clean = e && typeof e === "object" ? JSON.parse(JSON.stringify(e)) : e;
    assert.equal(schemaValid(clean), false, `the schema refuses ${JSON.stringify(clean)}`);
    assert.equal(checkEvent(clean), false, `checkEvent refuses ${JSON.stringify(clean)}`);
  }
  // The format the schema names but Ajv leaves unchecked here: an ISO 8601 date-time.
  assert.equal(checkEvent(ev({ timestamp: "yesterday" })), false);
  assert.equal(checkEvent(ev({ timestamp: "2026-09-29T10:00:00.123+10:00" })), true);
});

test("a code is kept, and anything that could be a value isn't", () => {
  for (const ok of ["money.send", "send-confirm", "amount", "transfer.confirm", "too-short", "acme:OrderTimeline", "file_type", "a"]) assert.equal(code(ok), ok);
  for (const no of ["priya@example.com", "4111111111111111", "0412 345 678", "Send £40", "", " amount", "x".repeat(81), "12.50", undefined, 7, null]) assert.equal(code(no), "", String(no));
});

test("events are counted by their row: the dimensions each type is counted by, and nothing else", () => {
  const events = [
    ev(),
    ev({ sessionId: "s_2" }),
    ev({ sessionId: "s_3", surface: { id: "send", intent: "money.send", pattern: "multi-step-form", generator: "polyxd-3b@0.1.0" } }),
    ev({ type: "action.taken", component: { id: "form", type: "Form" }, capability: "transfer.review", steps: 3, durationMs: 9000 }),
    ev({ type: "input.error", component: { id: "amount-field", key: "amount", type: "TextInput" }, reason: "required", durationMs: 800, steps: 1 }),
    ev({ type: "input.error", sessionId: "s_2", component: { id: "amount-field", key: "amount", type: "TextInput" }, reason: "required", durationMs: 700, steps: 1 }),
    ev({ type: "task.completed", component: { id: "form", type: "Form" }, capability: "transfer.review", durationMs: 12_000, steps: 3 }),
    ev({ type: "task.completed", sessionId: "s_2", capability: "transfer.review", durationMs: 3_000, steps: 3 }),
    ev({ type: "feedback", rating: 1, durationMs: 1, steps: 1 }),
    ev({ type: "feedback", sessionId: "s_2", rating: -1, reason: "confusing", durationMs: 1, steps: 1 }),
  ];
  const { rows, accepted, dropped } = aggregate(events);
  assert.equal(accepted, 10);
  assert.deepEqual(dropped, { invalid: 0, duplicate: 0, uncoded: 0 });
  const find = (p: Partial<Row>) => rows.filter(({ row }) => Object.entries(p).every(([k, v]) => row[k as keyof Row] === v));
  const shown = find({ type: "surface.shown" });
  assert.deepEqual(shown.map((r) => [r.row.source, r.m.count]).sort(), [["authored", 2], ["generated", 1]]);
  assert.equal(shown[0].row.component, "", "shown isn't counted by component");
  const [errors] = find({ type: "input.error" });
  assert.equal(errors.row.component, "amount", "the component's key, not its id");
  assert.equal(errors.row.reason, "required");
  assert.equal(errors.m.count, 2);
  const [done] = find({ type: "task.completed" });
  assert.equal(done.row.component, "", "a completion is counted by capability only");
  assert.equal(done.m.count, 2);
  assert.equal(done.m.durationSum, 15_000);
  assert.equal(done.m.durationCount, 2);
  assert.deepEqual(done.m.buckets, [0, 1, 0, 1, 0, 0, 0, 0]);
  const fb = find({ type: "feedback" });
  assert.equal(fb.reduce((n, r) => n + r.m.ratingSum, 0), 0);
  assert.equal(fb.reduce((n, r) => n + r.m.ratingCount, 0), 2);
  assert.equal(find({ type: "action.taken" })[0].m.durationSum, 0, "only completions keep a duration");
});

test("invalid events are dropped whole, repeats count once, and a value in a code's place is left out", () => {
  const secret = "priya.shah@example.com";
  const { rows, accepted, dropped } = aggregate([
    ev(),
    ev(), // the same event twice: a retried beacon
    ev({ value: secret }),
    ev({ type: "no.such.type" }),
    "junk",
    ev({ surface: { id: "send", intent: "Send £40 to Priya" } }),
    ev({ type: "action.taken", capability: secret, component: { id: "x", key: "4111111111111111" } }),
    ev({ type: "input.error", reason: "Card 4111 1111 1111 1111 declined", component: { key: "card" } }),
  ]);
  assert.equal(accepted, 3);
  assert.deepEqual(dropped, { invalid: 3, duplicate: 1, uncoded: 1 });
  const stored = JSON.stringify(rows);
  for (const s of [secret, "4111", "Priya", "£40", "declined"]) assert.ok(!stored.includes(s), `${s} isn't kept`);
  const act = rows.find((r) => r.row.type === "action.taken")!;
  assert.equal(act.row.capability, "");
  assert.equal(act.row.component, "x", "the key isn't a code, so the id stands in");
  assert.equal(rows.find((r) => r.row.type === "input.error")!.row.reason, "", "redact drops a reason that isn't a short code");
});

test("the renderers' own events, from @polyxd/core's emitter over the spec's send-money form, are all taken", async () => {
  const doc = json(new URL("examples/money-send-form.json", spec)) as UIDocument;
  const out: CoreEvent[] = [];
  let t = 0;
  const s = createSurfaceEvents(doc, (e) => out.push(e), { sessionId: "s_core", actor: { kind: "human" }, generator: "polyxd-3b@0.1.0", now: () => (t += 1500) });
  s.shown();
  s.edited("/draft/amount");
  s.inputError("amount", "required");
  s.action({ event: { name: "transfer.review", context: {} } }, "form");
  s.feedback(1);
  s.unmounted(false);
  assert.deepEqual(out.map((e) => e.type), ["surface.shown", "input.error", "action.taken", "task.completed", "feedback"]);
  assert.ok(out.every((e) => checkEvent(JSON.parse(JSON.stringify(e)))));
  const { rows, accepted } = aggregate(JSON.parse(JSON.stringify(out)));
  assert.equal(accepted, 5);
  assert.ok(rows.every((r) => r.row.intent === "money.send" && r.row.surface === "send" && r.row.pattern === "multi-step-form" && r.row.source === "generated"));
  assert.equal(rows.find((r) => r.row.type === "input.error")!.row.component, "amount");
});

test("where the renderers send reasons from a fixed list, only that list is kept", () => {
  const reason = (type: string, r: string) => rowOf({ ...ev({ type, reason: r }) } as never)?.reason;
  assert.equal(reason("task.abandoned", "dismiss"), "dismiss");
  assert.equal(reason("task.abandoned", "Priya"), "");
  assert.equal(reason("surface.dismissed", "unmount"), "unmount");
  assert.equal(reason("input.error", "too-short"), "too-short");
  assert.equal(reason("input.error", "Priya"), "");
  assert.equal(reason("status.shown", "undo"), "undo");
  assert.equal(reason("status.shown", "Priya"), "");
  assert.equal(reason("feedback", "too-long"), "too-long", "a host's own code is kept");
  assert.equal(reason("surface.regenerated", "wrong-account"), "wrong-account");
});

test("rowOf files an event with no usable intent nowhere", () => {
  assert.equal(rowOf({ ...ev(), surface: { id: "send", intent: "who@where.com" } } as never), undefined);
  assert.equal(bucketOf(0), 0);
  assert.equal(bucketOf(1_999), 0);
  assert.equal(bucketOf(2_000), 1);
  assert.equal(bucketOf(10 * 60_000), 7);
});

const stored = (p: Partial<StoredRow>): StoredRow => ({ day: "2026-09-29", intent: "money.send", surface: "send", pattern: "", type: "surface.shown", component: "", capability: "", reason: "", source: "authored", actor: "human", count: 1, duration_sum: 0, duration_count: 0, d0: 0, d1: 0, d2: 0, d3: 0, d4: 0, d5: 0, d6: 0, d7: 0, rating_sum: 0, rating_count: 0, ...p });

test("the report: completion rate, a mean and a median bucket, feedback, errors, most shown first", () => {
  const rows = [
    stored({ count: 10 }),
    stored({ count: 4, source: "generated" }),
    stored({ type: "task.completed", count: 5, duration_sum: 50_000, duration_count: 5, d2: 2, d3: 3 }),
    stored({ type: "task.completed", count: 2, source: "generated", duration_sum: 4_000, duration_count: 2, d1: 2 }),
    stored({ type: "task.abandoned", count: 3, reason: "dismiss" }),
    stored({ type: "input.error", count: 6, component: "amount", reason: "required" }),
    stored({ type: "input.error", count: 2, component: "amount", reason: "too-high" }),
    stored({ type: "input.error", count: 1, component: "recipient", reason: "required" }),
    stored({ type: "feedback", count: 4, rating_sum: 2, rating_count: 4 }),
    stored({ type: "status.shown", count: 2, reason: "success" }),
    stored({ type: "undo", count: 1 }),
    stored({ intent: "orders.track", count: 30 }),
    stored({ intent: "orders.track", day: "2026-09-27", type: "task.completed", count: 1 }),
  ];
  const { totals, intents } = summarise(rows);
  assert.deepEqual(intents.map((i) => i.intent), ["orders.track", "money.send"]);
  const send = intents[1];
  assert.equal(send.shown, 14);
  assert.equal(send.completed, 7);
  assert.equal(send.completionRate, 0.5);
  assert.equal(send.abandoned, 3);
  assert.equal(send.inputErrors, 9);
  assert.deepEqual(send.topInputErrors[0], { component: "amount", reason: "required", count: 6 });
  assert.equal(send.time?.meanMs, Math.round(54_000 / 7));
  assert.equal(send.time?.median, "5–10 s", "7 completions: 2 under 5 s, 2 at 5–10 s, so the 4th is in 5–10 s");
  assert.deepEqual(send.feedback, { count: 4, average: 0.5 });
  assert.deepEqual(send.sources, ["authored", "generated"]);
  assert.equal(totals.shown, 44);
  assert.equal(totals.completionRate, 8 / 44);
  // An overview has no task: no rate, rather than 0%, and it doesn't pull the workspace's down.
  const withOverview = summarise([...rows, stored({ intent: "money.overview", count: 100 })]);
  assert.equal(withOverview.intents.find((i) => i.intent === "money.overview")!.completionRate, null);
  assert.equal(withOverview.totals.completionRate, 8 / 44);
  assert.equal(measures([]).completionRate, null);
  assert.equal(measures([]).time, null);

  const d = detail("money.send", rows, "2026-09-27", "2026-09-29");
  assert.deepEqual(d.series.map((s) => s.day), ["2026-09-27", "2026-09-28", "2026-09-29"]);
  assert.deepEqual(d.series[2], { day: "2026-09-29", shown: 14, completed: 7, abandoned: 3, inputErrors: 9 });
  assert.deepEqual(d.funnel, { shown: 14, started: 10, completed: 7 });
  assert.deepEqual(d.inputErrorsByComponent.map((c) => [c.component, c.count, c.reasons.map((r) => r.key)]), [["amount", 8, ["required", "too-high"]], ["recipient", 1, ["required"]]]);
  const gen = d.bySource.find((s) => s.source === "generated")!;
  const auth = d.bySource.find((s) => s.source === "authored")!;
  assert.equal(gen.completionRate, 0.5);
  assert.equal(auth.completionRate, 0.5);
  assert.equal(gen.time?.median, "2–5 s");
  assert.deepEqual(d.statuses, [{ key: "success", count: 2 }]);
  assert.deepEqual(d.abandonReasons, [{ key: "dismiss", count: 3 }]);
});

test("ranges end today and hold the number of days asked for", () => {
  assert.deepEqual(range(7, new Date("2026-09-29T23:00:00Z")), { from: "2026-09-23", to: "2026-09-29" });
  assert.equal(daysBetween(range(90).from, range(90).to).length, 90);
});
