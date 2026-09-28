/**
 * Semantic analytics events from the Web Components renderer: the same events core decides, heard
 * through the renderer's own paths (dispatch, inputs, 'invalid', Status draws, taking down), each
 * one valid against the spec's schema/event.schema.json. With events on, the DOM is unchanged.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { install } from "./shim.ts";

const container = install();
const { mount, PolyxdSurfaceElement } = await import("../src/index.ts");

const dir = new URL("../../spec/examples/", import.meta.url);
const load = (f: string) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
const schema = JSON.parse(readFileSync(new URL("../../spec/schema/event.schema.json", import.meta.url), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function mounted(doc: any, props: Record<string, unknown> = {}) {
  const el = document.createElement("div") as any;
  container.appendChild(el);
  const events: any[] = [];
  const onEvent = (e: any) => {
    assert.ok(validate(e), `${e.type}: ${JSON.stringify(validate.errors)}`);
    events.push(e);
  };
  const handle = mount(el, { document: doc, theme: "material3", onEvent, events: { sessionId: "s_web" }, ...props } as any);
  return { el, events, handle, types: () => events.map((e) => e.type) };
}

function html(doc: any, props: Record<string, unknown> = {}): string {
  const el = document.createElement("div");
  container.appendChild(el);
  const handle = mount(el as any, { document: doc, theme: "material3", ...props } as any);
  const out = (el as any).innerHTML as string;
  handle.unmount();
  el.remove();
  return out;
}

test("events on draw exactly the same DOM as events off, for every spec example", () => {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const doc = load(f);
    const extra = doc.surface.kind === "shell" ? { current: { key: "x", title: "Screen" }, outlet: document.createElement("div") } : {};
    assert.equal(html(doc, { ...extra, onEvent: () => undefined }), html(doc, extra), f);
  }
});

test("shown on the first draw; an edit and the Form's submit are action.taken and task.completed", () => {
  const { el, events, types, handle } = mounted(load("money-send-form.json"));
  assert.deepEqual(types(), ["surface.shown"]);
  assert.equal(events[0].sessionId, "s_web");
  assert.equal(events[0].surface.intent, "money.send");
  const amount = el.querySelector("input.pxd-input, input.pxd-hero-value");
  amount.value = "98765.43";
  amount.dispatch("input");
  el.querySelector("form").dispatch("submit", { currentTarget: { checkValidity: () => true, elements: [] } });
  assert.deepEqual(types(), ["surface.shown", "action.taken", "task.completed"]);
  assert.deepEqual(events[1].component, { id: "form", type: "Form" });
  assert.equal(events[1].capability, "transfer.review");
  assert.equal(events[1].steps, 2);
  assert.doesNotMatch(JSON.stringify(events.map(({ timestamp, sessionId, ...e }) => e)), /98765/, "the typed amount never appears");
  handle.unmount();
});

test("a control's 'invalid' is input.error with its key and a reason code; taken down after that is abandoned", async () => {
  const { el, events, types, handle } = mounted(load("money-send-form.json"));
  const amount = el.querySelector("input.pxd-input, input.pxd-hero-value");
  amount.value = "7";
  amount.dispatch("input");
  el.dispatch("invalid", { target: amount, currentTarget: el });
  const error = events.find((e) => e.type === "input.error");
  assert.equal(error.component.id, "amount");
  assert.equal(error.component.type, "TextInput");
  assert.equal(error.reason, "invalid", "the shim's control has no validity, so the reason is the fallback code");
  el.dispatch("invalid", { target: Object.assign(amount, { validity: { valueMissing: true } }), currentTarget: el });
  assert.equal(events.at(-1).reason, "required");
  handle.unmount();
  await tick();
  assert.deepEqual(types().slice(-2), ["surface.dismissed", "task.abandoned"]);
  assert.equal(events.at(-1).reason, "unmount");
});

test("a Status drawn is status.shown once; an undo Status's action is undo", () => {
  const doc = load("tasks-archive.json");
  const { el, events, types, handle } = mounted(doc, { data: { ...doc.data, lastArchived: { id: "t1", title: "Pay rent" } } });
  const shown = events.filter((e) => e.type === "status.shown");
  assert.ok(shown.length >= 1, types().join());
  for (const s of shown) assert.ok(["undo", "empty"].includes(s.reason));
  const undo = el.querySelectorAll("button").find((b: any) => b.getAttribute("data-pxd-id") === "undo-archive");
  assert.ok(undo, "the undo action renders");
  {
    undo.dispatch("click");
    assert.deepEqual(types().slice(-2), ["action.taken", "undo"]);
    assert.equal(events.at(-1).capability, "task.unarchive");
  }
  handle.update({});
  assert.equal(events.filter((e) => e.type === "status.shown").length, shown.length, "a redraw is not a new appearance");
  handle.unmount();
});

test("an error Status says its kind", () => {
  const { events, handle } = mounted(load("error-load-failed.json"));
  const status = events.find((e) => e.type === "status.shown");
  assert.deepEqual(status.component, { id: "root", type: "Status" });
  assert.equal(status.reason, "error");
  handle.unmount();
});

test("the host reports feedback and a regeneration through the handle", async () => {
  const { types, events, handle } = mounted(load("money-send-form.json"));
  handle.feedback(-1, "wrong-thing");
  handle.regenerated("asked-again");
  handle.unmount();
  await tick();
  assert.deepEqual(types(), ["surface.shown", "feedback", "surface.regenerated"]);
  assert.equal(events[1].rating, -1);
});

test("a journey passed in the events options drives checkpoints", () => {
  const journey = JSON.parse(readFileSync(new URL("journeys/money.send.json", dir), "utf8"));
  const { el, events, handle } = mounted(load("money-send-form.json"), { events: { sessionId: "s_web", journey } });
  el.querySelector("form").dispatch("submit", { currentTarget: { checkValidity: () => true, elements: [] } });
  assert.deepEqual(events.map((e) => e.type), ["surface.shown", "action.taken", "checkpoint.reached"]);
  assert.equal(events[2].checkpoint, "details");
  assert.equal(events[0].surface.journey, "money.send");
  handle.unmount();
});

test("a new document is a new surface: the old one ends, the new one is shown with a new session", async () => {
  const el = document.createElement("div") as any;
  container.appendChild(el);
  const events: any[] = [];
  const handle = mount(el, { document: load("money-send-form.json"), onEvent: (e: any) => events.push(e) } as any);
  handle.update({ document: load("error-load-failed.json") });
  await tick();
  assert.deepEqual(events.map((e) => `${e.type}:${e.surface.id}`), ["surface.shown:send", "surface.dismissed:send", "surface.shown:load-failed", "status.shown:load-failed"].map((s) => s.replace("load-failed", load("error-load-failed.json").surface.id)));
  assert.notEqual(events[0].sessionId, events[2].sessionId);
  handle.unmount();
});

test("<polyxd-surface>: off until the host listens; then onEvent and polyxd-event both hear them", () => {
  const el = new (PolyxdSurfaceElement as any)();
  container.appendChild(el);
  el.document = load("money-send-form.json");
  el.flush();
  const heard: string[] = [];
  el.addEventListener("polyxd-event", (e: CustomEvent) => heard.push(`dom:${e.detail.type}`));
  el.flush();
  el.onEvent = (e: any) => heard.push(`prop:${e.type}`);
  el.flush();
  assert.deepEqual(heard, ["dom:surface.shown"], "switched on by the listener; shown once");
  el.querySelector("form").dispatch("submit", { currentTarget: { checkValidity: () => true, elements: [] } });
  assert.deepEqual(heard.slice(1), ["prop:action.taken", "dom:action.taken", "prop:task.completed", "dom:task.completed"]);
  el.disconnectedCallback();
  el.remove();
});
