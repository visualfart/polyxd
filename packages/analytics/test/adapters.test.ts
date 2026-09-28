import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { createSurfaceEvents, EVENT_PROPERTIES, SEMANTIC_EVENT_TYPES, type UIDocument } from "@polyxd/core";
import { ALLOWED_PROPERTIES, EVENT_TYPES, flatten, ga4EventName, redact, toFetch, toGA4, toPostHog, toSegment, type SemanticEvent } from "../src/index.ts";

const schema = JSON.parse(readFileSync(new URL("../../spec/schema/event.schema.json", import.meta.url), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);

const doc: UIDocument = {
  specVersion: "0.3.0",
  surface: { id: "send", title: "Send money", intent: "money.send", pattern: "review-and-submit" },
  root: "form",
  components: [
    { id: "form", component: "Form", children: ["amount"], submit: { label: "Send", action: { event: { name: "transfer.review" } } } },
    { id: "amount", component: "TextInput", key: "amount", label: "Amount", value: { path: "/amount" } },
  ],
};

/** Real events from @polyxd/core: shown, an input error, an action, completion, feedback. */
function realEvents(): SemanticEvent[] {
  const out: SemanticEvent[] = [];
  let t = 0;
  const e = createSurfaceEvents(doc, (x) => out.push(x as SemanticEvent), { sessionId: "s_1", now: () => (t += 250), experiment: { layout: "b" }, direction: "calm@1", actor: { kind: "human", assistiveTech: true } });
  e.shown();
  e.inputError("amount", "required");
  e.edited("/amount");
  e.action(doc.components[0].submit.action, "form");
  e.feedback(1);
  return out;
}

test("the allow-list and types match the schema and @polyxd/core", () => {
  assert.deepEqual([...EVENT_TYPES], schema.properties.type.enum);
  assert.deepEqual([...EVENT_TYPES], [...SEMANTIC_EVENT_TYPES]);
  assert.deepEqual([...ALLOWED_PROPERTIES.event].sort(), Object.keys(schema.properties).sort());
  assert.deepEqual([...ALLOWED_PROPERTIES.event].sort(), [...EVENT_PROPERTIES].sort());
  assert.deepEqual([...ALLOWED_PROPERTIES.surface].sort(), Object.keys(schema.properties.surface.properties).sort());
  assert.deepEqual([...ALLOWED_PROPERTIES.actor].sort(), Object.keys(schema.properties.actor.properties).sort());
  assert.deepEqual([...ALLOWED_PROPERTIES.component].sort(), Object.keys(schema.properties.component.properties).sort());
});

test("redact keeps a real event as it is", () => {
  for (const e of realEvents()) {
    assert.ok(validate(e));
    assert.deepEqual(redact(e), e);
  }
});

test("redact drops anything the schema doesn't allow, at every level, and free-text reasons", () => {
  const [shown, error] = realEvents();
  const dirty = {
    ...error,
    value: "4111 1111 1111 1111",
    label: "Ann's card",
    surface: { ...error.surface, title: "Pay Ann", experiment: { layout: "b", n: 3 } },
    actor: { ...error.actor, email: "ann@example.com" },
    component: { ...error.component, label: "Card number", value: "4111" },
    reason: "I typed 4111 and it said no",
    steps: -2,
    durationMs: 1.5,
    rating: 5,
  };
  const clean = redact(dirty)!;
  assert.ok(validate(clean), JSON.stringify(validate.errors));
  assert.doesNotMatch(JSON.stringify(clean), /4111|Ann|example\.com|Card/);
  assert.deepEqual(clean.surface.experiment, { layout: "b" });
  assert.equal(clean.reason, undefined);
  assert.equal(clean.steps, undefined);
  assert.equal(clean.durationMs, undefined);
  assert.equal(clean.rating, undefined);
  assert.deepEqual(clean.component, { id: "amount", key: "amount", type: "TextInput" });
  assert.ok(redact(shown));
  for (const junk of [null, 1, "surface.shown", {}, { ...shown, type: "page.viewed" }, { ...shown, sessionId: 3 }, { ...shown, surface: { id: "x" } }, { ...shown, actor: { kind: "robot" } }]) assert.equal(redact(junk), undefined);
});

test("flatten: one level of snake_case properties", () => {
  const [, error, action] = realEvents();
  assert.deepEqual(flatten(action), {
    surface_id: "send",
    intent: "money.send",
    pattern: "review-and-submit",
    spec_version: "0.3.0",
    direction: "calm@1",
    experiment_layout: "b",
    actor: "human",
    assistive_tech: true,
    component: "form",
    component_type: "Form",
    capability: "transfer.review",
    duration_ms: 500,
    steps: 2,
    polyxd_session_id: "s_1",
  });
  assert.equal(flatten(error).reason, "required");
  assert.equal(flatten(error).component_key, "amount");
});

test("toPostHog: capture('polyxd ' + type, flat properties), with $groups when given", () => {
  const calls: [string, Record<string, unknown> | undefined][] = [];
  const posthog = { capture: (name: string, props?: Record<string, unknown>) => calls.push([name, props]) };
  const send = toPostHog(posthog);
  for (const e of realEvents()) send(e);
  assert.deepEqual(calls.map(([n]) => n), ["polyxd surface.shown", "polyxd input.error", "polyxd action.taken", "polyxd task.completed", "polyxd feedback"]);
  assert.equal(calls[2][1]!.capability, "transfer.review");
  assert.equal(calls[4][1]!.rating, 1);
  assert.equal(calls[0][1]!.$groups, undefined);

  const grouped: Record<string, unknown>[] = [];
  const g = toPostHog({ capture: (_n, p) => grouped.push(p!) }, { groups: (e) => ({ surface: e.surface.intent }) });
  g(realEvents()[0]);
  assert.deepEqual(grouped[0].$groups, { surface: "money.send" });
  const fixed: Record<string, unknown>[] = [];
  toPostHog({ capture: (_n, p) => fixed.push(p!) }, { groups: { company: "acme" }, eventName: (t) => t })(realEvents()[0]);
  assert.deepEqual(fixed[0].$groups, { company: "acme" });
});

test("toSegment: track('polyxd ' + type, flat properties)", () => {
  const calls: [string, Record<string, unknown> | undefined][] = [];
  const send = toSegment({ track: (n, p) => calls.push([n, p]) });
  for (const e of realEvents()) send(e);
  assert.equal(calls.length, 5);
  assert.equal(calls[1][0], "polyxd input.error");
  assert.equal(calls[1][1]!.component, "amount");
});

test("toGA4: gtag('event', polyxd_<type>, params) with GA4-safe names", () => {
  const calls: unknown[][] = [];
  const send = toGA4((...args) => calls.push(args));
  for (const e of realEvents()) send(e);
  assert.deepEqual(calls.map((c) => c[1]), ["polyxd_surface_shown", "polyxd_input_error", "polyxd_action_taken", "polyxd_task_completed", "polyxd_feedback"]);
  assert.equal(calls[0][0], "event");
  for (const type of EVENT_TYPES) assert.match(ga4EventName(type), /^[A-Za-z][A-Za-z0-9_]{0,39}$/);
  assert.equal((calls[2][2] as any).capability, "transfer.review");
});

test("an adapter never sends what redact refuses, and a throwing client never throws into the surface", () => {
  const calls: unknown[] = [];
  const send = toSegment({ track: (...a) => calls.push(a) });
  send({ type: "page.viewed" } as any);
  assert.equal(calls.length, 0);
  const broken = toPostHog({ capture: () => { throw new Error("posthog down"); } });
  assert.doesNotThrow(() => broken(realEvents()[0]));
});

test("toFetch: batches by size, by time and on flush, as JSON with keepalive", async () => {
  const requests: { url: string; init: any }[] = [];
  const fetch = async (url: string, init: any) => void requests.push({ url, init });
  const send = toFetch("https://example.test/events", { batchSize: 2, flushInterval: 20, fetch, headers: { authorization: "Bearer t" } });
  const events = realEvents();
  send(events[0]);
  assert.equal(requests.length, 0, "waits for the batch");
  send(events[1]);
  await Promise.resolve();
  assert.equal(requests.length, 1, "a full batch goes at once");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.keepalive, true);
  assert.equal(requests[0].init.headers["content-type"], "application/json");
  assert.equal(requests[0].init.headers.authorization, "Bearer t");
  const body = JSON.parse(requests[0].init.body);
  assert.equal(body.events.length, 2);
  for (const e of body.events) assert.ok(validate(e));
  send(events[2]);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(requests.length, 2, "the interval sends a part batch");
  send(events[3]);
  send(events[4]);
  send(events[0]);
  await send.flush();
  assert.equal(requests.length, 4, "flush sends everything, a batch at a time");
  await send.close();
});

test("toFetch: a failed batch is reported, not retried, and not thrown", async () => {
  const failed: number[] = [];
  const send = toFetch("/e", { batchSize: 1, fetch: async () => { throw new Error("offline"); }, onError: (_e, batch) => failed.push(batch.length) });
  send(realEvents()[0]);
  await send.flush();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(failed, [1]);
  await send.close();
});

test("toFetch: the page being hidden sends what is queued", async () => {
  const listeners: Record<string, () => void> = {};
  const fake = { visibilityState: "visible", addEventListener: (t: string, f: () => void) => (listeners[t] = f), removeEventListener: (t: string) => delete listeners[t] };
  const previous = (globalThis as any).document;
  (globalThis as any).document = fake;
  try {
    const requests: unknown[] = [];
    const send = toFetch("/e", { flushInterval: 60_000, fetch: async (_u, i) => void requests.push(i) });
    send(realEvents()[0]);
    fake.visibilityState = "hidden";
    listeners.visibilitychange();
    await Promise.resolve();
    assert.equal(requests.length, 1);
    await send.close();
    assert.equal(listeners.visibilitychange, undefined, "close stops listening");
  } finally {
    (globalThis as any).document = previous;
  }
});
