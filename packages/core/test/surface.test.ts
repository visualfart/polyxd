import { test } from "node:test";
import assert from "node:assert/strict";
import { a11yAttributes, contextWithValue, copyText, createSurface, dispatchAction, isRendererAction, rowChangeAction, ROOT_SCOPE, type ActionEvent, type UIDocument } from "../src/index.ts";

const doc: UIDocument = {
  specVersion: "0.3.0",
  surface: { id: "send", title: "Send money" },
  root: "form",
  data: { draft: { amount: 10, payeeId: "p1" }, payees: [{ id: "p1", name: "Ann" }] },
  components: [
    { id: "form", component: "Form", children: ["amount"], submit: { label: "Send", action: { event: { name: "transfer.review", context: { amount: { path: "/draft/amount" } } } } } },
    { id: "amount", component: "TextInput", kind: "currency", label: "Amount", value: { path: "/draft/amount" }, visible: { path: "/show" } },
  ],
};

test("the headless surface resolves, formats, writes, derives and notifies", () => {
  const changes: unknown[] = [];
  const seen: unknown[] = [];
  const s = createSurface(doc, { derive: (d) => ({ ...d, total: Number((d.draft as any).amount) * 2 }), onDataChange: (d) => changes.push(d) });
  s.subscribe((d) => seen.push(d));
  assert.equal(s.byId.get("amount")?.label, "Amount");
  assert.equal(s.resolve({ path: "/draft/amount" }), 10);
  assert.equal(s.text({ path: "/draft/amount" }, { type: "currency", currency: "GBP" }), "£10.00");
  assert.equal(s.text({ path: "/nothing" }), "");
  assert.equal(s.text({ path: "name" }, undefined, { pointer: "/payees/0" }), "Ann");
  assert.equal(s.pointer({ path: "name" }, { pointer: "/payees/0" }), "/payees/0/name");
  s.write({ path: "/draft/amount" }, 25);
  assert.equal(s.data.total, 50, "derived after the write");
  assert.equal(changes.length, 1);
  assert.equal(seen.length, 1);
  assert.equal(s.resolve({ path: "/draft/amount" }), 25);
  assert.ok(s.visible(s.byId.get("amount")!), "an unbound visible is true");
  s.setValue("/show", false);
  assert.ok(!s.visible(s.byId.get("amount")!));
  s.replaceData({ draft: { amount: 1 } });
  assert.equal(s.data.total, undefined);
  assert.equal(seen.length, 3);
  assert.deepEqual(s.context({ id: { path: "id" } }, { pointer: "/payees/0" }), { id: undefined });
});

test("dispatch: ui.dismiss closes, everything else reaches the host with its context resolved", () => {
  const sent: ActionEvent[] = [];
  let dismissed = 0;
  const s = createSurface(doc, { onAction: (e) => sent.push(e), onDismiss: () => dismissed++ });
  s.dispatch(s.byId.get("form")!.submit.action, ROOT_SCOPE, "form");
  assert.deepEqual(sent, [{ name: "transfer.review", context: { amount: 10 }, source: "form" }]);
  s.dispatch({ event: { name: "ui.dismiss" } }, ROOT_SCOPE, "x");
  assert.equal(dismissed, 1);
  assert.equal(sent.length, 1);
  s.dispatch(undefined, ROOT_SCOPE, "x");
  dispatchAction({ event: { name: "a.b", context: { who: { path: "name" } } } }, { pointer: "/payees/0" }, "row", doc.data, { onAction: (e) => sent.push(e) });
  assert.deepEqual(sent[1], { name: "a.b", context: { who: "Ann" }, source: "row" });
  assert.ok(isRendererAction("ui.copy"));
  assert.ok(!isRendererAction("transfer.confirm"));
});

test("an input's action carries the value it just wrote; copy takes the copy text or the context's text", () => {
  const toggle = { id: "t", component: "Toggle", value: { path: "/prefs/email" }, action: { event: { name: "prefs.set", context: { email: { path: "/prefs/email" }, who: { path: "/me" } } } } };
  assert.deepEqual(contextWithValue(toggle, { prefs: { email: false }, me: "ann" }, ROOT_SCOPE, true), { email: true, who: "ann" });
  assert.equal(copyText({ id: "c", component: "Action", copy: { path: "/key" }, action: { event: { name: "ui.copy" } } }, { key: "K" }, ROOT_SCOPE, (v) => String((v as any).path ? "K" : v)), "K");
  assert.equal(copyText({ id: "c", component: "Action", action: { event: { name: "ui.copy", context: { text: "T" } } } }, {}, ROOT_SCOPE, String), "T");
  assert.deepEqual(rowChangeAction({ event: { name: "edit", context: { step: 2 } } }, "name"), { event: { name: "edit", context: { key: "name", step: 2 } } });
});

test("accessibility attributes carry the node's identity and its accessibility block", () => {
  assert.deepEqual(a11yAttributes({ id: "x", component: "Text" }, String), { "data-pxd-id": "x", "data-pxd-component": "Text" });
  const attrs = a11yAttributes({ id: "x", component: "Status", accessibility: { label: "Alerts", live: "polite", hidden: false } }, (v) => String(v));
  assert.equal(attrs["aria-label"], "Alerts");
  assert.equal(attrs["aria-live"], "polite");
  assert.equal(attrs["aria-hidden"], undefined);
});
