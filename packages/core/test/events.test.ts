import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  EVENT_ACTOR_PROPERTIES, EVENT_COMPONENT_PROPERTIES, EVENT_PROPERTIES, EVENT_SURFACE_PROPERTIES, SEMANTIC_EVENT_TYPES,
  createSurface, createSurfaceEvents, fileRefusalReason, validityReason, ROOT_SCOPE,
  type SemanticEvent, type SurfaceEventOptions, type UIDocument,
} from "../src/index.ts";

const schema = JSON.parse(readFileSync(new URL("../../spec/schema/event.schema.json", import.meta.url), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Every event must be valid against the spec's schema, whatever the test is about. */
function record(doc: UIDocument, options: SurfaceEventOptions = {}) {
  const events: SemanticEvent[] = [];
  let t = 1_000;
  const emitter = createSurfaceEvents(
    doc,
    (e) => {
      assert.ok(validate(e), `${e.type}: ${JSON.stringify(validate.errors)}`);
      assert.match(e.timestamp, ISO);
      events.push(e);
    },
    { sessionId: "s_test", now: () => (t += 100), ...options },
  );
  return { events, emitter, types: () => events.map((e) => e.type) };
}
const tick = () => new Promise<void>((r) => queueMicrotask(r));

const form: UIDocument = {
  specVersion: "0.3.0",
  surface: { id: "send", title: "Send money", intent: "money.send", pattern: "review-and-submit" },
  root: "form",
  data: { draft: { amount: 10, name: "Ann Example" } },
  components: [
    { id: "form", component: "Form", children: ["name", "amount"], submit: { label: "Review", action: { event: { name: "transfer.review", context: { amount: { path: "/draft/amount" } } } } }, cancel: { label: "Cancel", action: { event: { name: "ui.dismiss" } } } },
    { id: "name", component: "TextInput", key: "recipient.name", label: "Name", value: { path: "/draft/name" }, required: true },
    { id: "amount", component: "TextInput", kind: "currency", label: "Amount", value: { path: "/draft/amount" } },
  ],
};

test("the types and property lists match schema/event.schema.json", () => {
  assert.deepEqual([...SEMANTIC_EVENT_TYPES], schema.properties.type.enum);
  assert.deepEqual([...EVENT_PROPERTIES].sort(), Object.keys(schema.properties).sort());
  assert.deepEqual([...EVENT_SURFACE_PROPERTIES].sort(), Object.keys(schema.properties.surface.properties).sort());
  assert.deepEqual([...EVENT_ACTOR_PROPERTIES].sort(), Object.keys(schema.properties.actor.properties).sort());
  assert.deepEqual([...EVENT_COMPONENT_PROPERTIES].sort(), Object.keys(schema.properties.component.properties).sort());
  assert.deepEqual(schema.properties.rating.enum, [-1, 0, 1]);
});

test("the spec's example event is valid, so the test's validator is the real one", () => {
  const example = JSON.parse(readFileSync(new URL("../../spec/examples/events/action-taken.json", import.meta.url), "utf8"));
  assert.ok(validate(example));
  assert.ok(!validate({ ...example, value: "Ann" }), "an unknown property is refused");
});

test("shown once, then an action, then completion from the Form's submit", () => {
  const { events, emitter, types } = record(form);
  emitter.shown();
  emitter.shown();
  const s = createSurface(form, { events: emitter });
  s.setValue("/draft/name", "A");
  s.setValue("/draft/name", "An");
  s.setValue("/draft/amount", 20);
  s.dispatch(form.components[0].submit.action, ROOT_SCOPE, "form");
  assert.deepEqual(types(), ["surface.shown", "action.taken", "task.completed"]);
  const [shown, action, done] = events;
  assert.equal(shown.durationMs, undefined);
  assert.deepEqual(shown.surface, { id: "send", intent: "money.send", pattern: "review-and-submit", specVersion: "0.3.0" });
  assert.equal(shown.sessionId, "s_test");
  assert.deepEqual(action.component, { id: "form", type: "Form" });
  assert.equal(action.capability, "transfer.review");
  assert.equal(action.steps, 3, "two fields edited, one action");
  assert.equal(action.durationMs, 100);
  assert.equal(done.capability, "transfer.review");
  // Nothing typed reaches an event.
  assert.doesNotMatch(JSON.stringify(events), /Ann|"An"|:20[,}]/);
});

test("taken down after completing says nothing more", async () => {
  const { emitter, types } = record(form);
  emitter.shown();
  emitter.action(form.components[0].submit.action, "form");
  emitter.unmounted();
  await tick();
  assert.deepEqual(types(), ["surface.shown", "action.taken", "task.completed"]);
});

test("ui.dismiss after an interaction is dismissed and abandoned; before one, only dismissed", () => {
  const a = record(form);
  a.emitter.shown();
  a.emitter.edited("/draft/name");
  a.emitter.action({ event: { name: "ui.dismiss" } }, "form");
  a.emitter.unmounted();
  assert.deepEqual(a.types(), ["surface.shown", "surface.dismissed", "task.abandoned"]);
  assert.equal(a.events[1].reason, "dismiss");
  assert.equal(a.events[2].steps, 1);

  const b = record(form);
  b.emitter.shown();
  b.emitter.action({ event: { name: "ui.dismiss" } }, "form");
  assert.deepEqual(b.types(), ["surface.shown", "surface.dismissed"]);
});

test("unmounting before completion is dismissed with reason unmount; a remount in the same tick cancels it", async () => {
  const { events, emitter, types } = record(form);
  emitter.shown();
  emitter.unmounted();
  emitter.shown(); // React StrictMode: effects run, clean up and run again
  await tick();
  assert.deepEqual(types(), ["surface.shown"]);
  emitter.edited("/draft/amount");
  emitter.unmounted();
  await tick();
  assert.deepEqual(types(), ["surface.shown", "surface.dismissed", "task.abandoned"]);
  assert.equal(events[1].reason, "unmount");
  emitter.unmounted();
  await tick();
  assert.equal(events.length, 3, "ends once");
});

test("a journey: checkpoints by event, completion only on its done event", async () => {
  const journey = { id: "money.send", checkpoints: [{ key: "details", event: "transfer.review" }, { key: "fee-visible" }], done: { event: "transfer.confirm" } };
  const { events, emitter, types } = record(form, { journey });
  emitter.shown();
  emitter.action(form.components[0].submit.action, "form");
  emitter.action(form.components[0].submit.action, "form");
  assert.deepEqual(types(), ["surface.shown", "action.taken", "checkpoint.reached", "action.taken"]);
  assert.equal(events[2].checkpoint, "details");
  assert.equal(events[0].surface.journey, "money.send");
  // Handed on to the next surface of the journey: not abandoned, not dismissed.
  emitter.unmounted();
  await tick();
  assert.equal(events.length, 4);

  const confirm = record({ ...form, surface: { ...form.surface, id: "confirm" } }, { journey });
  confirm.emitter.action({ event: { name: "transfer.confirm" } }, "anything");
  assert.deepEqual(confirm.types(), ["surface.shown", "action.taken", "task.completed"]);
});

test("a nested Panel or Confirm closing is not the surface being dismissed", () => {
  const doc: UIDocument = {
    specVersion: "0.3.0",
    surface: { id: "list", title: "Tasks" },
    root: "main",
    components: [
      { id: "main", component: "Section", children: ["panel", "ask"] },
      { id: "panel", component: "Panel", title: "Filters", children: [] },
      { id: "ask", component: "Confirm", title: "Delete?", confirm: { label: "Delete", action: { event: { name: "task.delete" } } } },
    ],
  };
  const { emitter, types } = record(doc);
  emitter.action({ event: { name: "ui.dismiss" } }, "panel");
  emitter.action({ event: { name: "ui.dismiss" } }, "ask");
  assert.deepEqual(types(), ["surface.shown"]);
  emitter.action({ event: { name: "task.delete" } }, "ask");
  assert.deepEqual(types(), ["surface.shown", "action.taken", "task.completed"], "a Confirm's confirm completes");
});

test("an undo Status's action is action.taken and undo; a Status drawn is status.shown with its kind", () => {
  const doc: UIDocument = {
    specVersion: "0.3.0",
    surface: { id: "archived", title: "Archived", intent: "tasks.archive" },
    root: "main",
    components: [
      { id: "main", component: "Section", children: ["done"] },
      { id: "done", component: "Status", kind: "undo", title: "Archived", action: "restore" },
      { id: "restore", component: "Action", label: "Undo", action: { event: { name: "tasks.restore" } } },
    ],
  };
  const { events, emitter, types } = record(doc);
  emitter.statusShown(doc.components[1]);
  emitter.action(doc.components[2].action, "restore");
  assert.deepEqual(types(), ["surface.shown", "status.shown", "action.taken", "undo"]);
  assert.equal(events[1].reason, "undo");
  assert.deepEqual(events[3].component, { id: "restore", type: "Action" });
  assert.equal(events[3].capability, "tasks.restore");
});

test("input.error carries the component, its semantic key and a reason code, never a value", () => {
  const { events, emitter } = record(form);
  emitter.inputError(form.components[1], "required");
  emitter.inputError("amount", "Please enter £20 or more");
  emitter.inputError("nowhere", "pattern");
  assert.deepEqual(events[1].component, { id: "name", key: "recipient.name", type: "TextInput" });
  assert.equal(events[1].reason, "required");
  assert.equal(events[2].reason, "invalid", "free text is not a code");
  assert.deepEqual(events[3].component, { id: "nowhere" });
});

test("feedback is a rating only; regenerated ends the surface", async () => {
  const { events, emitter, types } = record(form);
  emitter.feedback(1);
  emitter.feedback(5 as any);
  emitter.feedback(-1, "not what I asked for");
  emitter.feedback(0, "too-long");
  emitter.edited("/draft/name");
  emitter.regenerated("wrong-intent");
  emitter.unmounted();
  await tick();
  assert.deepEqual(types(), ["surface.shown", "feedback", "feedback", "feedback", "surface.regenerated"]);
  assert.deepEqual(events.map((e) => e.rating).filter((r) => r !== undefined), [1, -1, 0]);
  assert.equal(events[2].reason, undefined);
  assert.equal(events[3].reason, "too-long");
  assert.equal(events[4].reason, "wrong-intent");
});

test("the actor and the host's context: an agent, a generator, a direction and variants", () => {
  const { events, emitter } = record(form, { actor: { kind: "agent", assistiveTech: false }, generator: "polyxd-3b@0.1.0", direction: "calm-finance@0.1.0", experiment: { layout: "b" } });
  emitter.shown();
  assert.deepEqual(events[0].actor, { kind: "agent", assistiveTech: false });
  assert.equal(events[0].surface.generator, "polyxd-3b@0.1.0");
  assert.deepEqual(events[0].surface.experiment, { layout: "b" });
});

test("a document without an intent uses its id; the session id is random per emitter unless given", () => {
  const doc = { ...form, surface: { id: "bare", title: "Bare" } };
  const ids = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const got: SemanticEvent[] = [];
    const e = createSurfaceEvents(doc, (x) => got.push(x));
    e.shown();
    assert.equal(got[0].surface.intent, "bare");
    assert.equal(got[0].actor.kind, "human");
    ids.add(e.sessionId);
  }
  assert.equal(ids.size, 3);
});

test("a shell reports actions but has no task to complete or abandon", async () => {
  const shell: UIDocument = { specVersion: "0.3.0", surface: { id: "app", title: "App", kind: "shell" }, root: "frame", components: [{ id: "frame", component: "Frame" }, { id: "go", component: "Form", submit: { label: "Go", action: { event: { name: "nav.go" } } } }] };
  const { emitter, types } = record(shell);
  emitter.action({ event: { name: "nav.go" } }, "go");
  emitter.unmounted();
  await tick();
  assert.deepEqual(types(), ["surface.shown", "action.taken", "surface.dismissed"]);
});

test("a throwing handler never breaks the surface", () => {
  const emitter = createSurfaceEvents(form, () => {
    throw new Error("analytics down");
  });
  const s = createSurface(form, { events: emitter, onAction: () => undefined });
  assert.doesNotThrow(() => s.dispatch(form.components[0].submit.action, ROOT_SCOPE, "form"));
});

test("without events, the surface behaves exactly as before", () => {
  const heard: string[] = [];
  const s = createSurface(form, { onAction: (e) => heard.push(e.name), onDismiss: () => heard.push("dismiss") });
  s.dispatch(form.components[0].submit.action, ROOT_SCOPE, "form");
  s.dispatch(form.components[0].cancel.action, ROOT_SCOPE, "form");
  assert.deepEqual(heard, ["transfer.review", "dismiss"]);
});

test("reason codes from a control's validity and a refused file", () => {
  assert.equal(validityReason({ valueMissing: true, customError: true }), "required");
  assert.equal(validityReason({ patternMismatch: true }), "pattern");
  assert.equal(validityReason({ tooShort: true }), "too-short");
  assert.equal(validityReason({ rangeOverflow: true }), "too-high");
  assert.equal(validityReason({}), "invalid");
  assert.equal(fileRefusalReason({ size: 10 }, 5), "file-too-large");
  assert.equal(fileRefusalReason({ size: 1 }, 5), "file-type");
});
