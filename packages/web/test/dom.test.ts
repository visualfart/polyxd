import { test } from "node:test";
import assert from "node:assert/strict";
import { install } from "./shim.ts";

const container = install();
const { h, render, adopt } = await import("../src/dom.ts");

const fresh = () => {
  const el = document.createElement("div");
  container.appendChild(el);
  return el as any;
};

test("renders elements, text, attributes, classes and styles", () => {
  const el = fresh();
  render(el, [h("p", { class: "a", "aria-hidden": true, style: { width: 10, "--x": "1" } }, "hi ", h("b", null, "there"), 3)]);
  assert.equal(el.innerHTML, `<p class="a" aria-hidden="true" style="width: 10px; --x: 1">hi <b>there</b>3</p>`);
});

test("patches in place: the same element is kept, attributes follow, false ARIA states stay stated", () => {
  const el = fresh();
  render(el, [h("button", { "aria-expanded": false, disabled: true, hidden: false }, "x")]);
  const button = el.firstChild;
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(button.disabled, true);
  render(el, [h("button", { "aria-expanded": true, disabled: false, title: "t" }, "y")]);
  assert.equal(el.firstChild, button, "the element is reused");
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute("title"), "t");
  assert.equal(button.textContent, "y");
  render(el, [h("button", {}, "y")]);
  assert.equal(button.getAttribute("aria-expanded"), null);
  assert.equal(button.getAttribute("title"), null);
});

test("keyed children are matched by key and moved, not recreated", () => {
  const el = fresh();
  render(el, [h("ul", null, h("li", { key: "a" }, "a"), h("li", { key: "b" }, "b"), h("li", { key: "c" }, "c"))]);
  const [a, b, c] = el.firstChild.childNodes;
  render(el, [h("ul", null, h("li", { key: "c" }, "c"), h("li", { key: "a" }, "a"))]);
  const now = el.firstChild.childNodes;
  assert.equal(now.length, 2);
  assert.equal(now[0], c);
  assert.equal(now[1], a);
  assert.equal(b.parentNode, null, "the removed one is gone");
});

test("a controlled value is only written when it differs, and events are bound once", () => {
  const el = fresh();
  let clicks = 0;
  render(el, [h("input", { value: "a", onInput: () => clicks++ })]);
  const input = el.firstChild;
  input.value = "typed";
  render(el, [h("input", { value: "typed", onInput: () => clicks++ })]);
  assert.equal(input.value, "typed");
  input.dispatch("input");
  assert.equal(clicks, 1, "the latest handler runs once");
});

test("refs see the element when it is in the document, and null when it leaves; adopted elements are left alone", () => {
  const el = fresh();
  const seen: unknown[] = [];
  const own = document.createElement("section");
  own.textContent = "host";
  render(el, [h("div", { ref: (e: unknown) => seen.push(e) }, adopt(own as any))]);
  assert.equal(seen.length, 1);
  assert.equal((seen[0] as any).isConnected, true);
  assert.equal(el.firstChild.firstChild, own);
  render(el, [h("div", { ref: (e: unknown) => seen.push(e) }, adopt(own as any))]);
  assert.equal(el.firstChild.firstChild, own, "adopted once, kept");
  assert.equal(seen.length, 1, "a ref is not called again on a patch");
  render(el, []);
  assert.equal(seen[1], null);
});

test("svg elements get the namespace and attribute casing they need", () => {
  const el = fresh();
  render(el, [h("svg", { viewBox: "0 0 24 24", "stroke-width": 2 }, h("path", { d: "M1 1" }))]);
  assert.equal(el.firstChild.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(el.innerHTML, `<svg viewBox="0 0 24 24" stroke-width="2"><path d="M1 1"></path></svg>`);
});
