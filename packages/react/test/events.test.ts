/**
 * Semantic events from the React renderer. What they say is core's (packages/core/test/events.test.ts);
 * the verifier's browser test clicks through both renderers and compares what each emits. Here:
 * listening changes nothing in the markup, and a server render emits nothing (events start when
 * the surface mounts in a browser).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { PolyxdSurface, PolyxdFrame } from "../dist/index.js";

const dir = new URL("../../spec/examples/", import.meta.url);
const load = (f: string) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));

test("events on render exactly the same markup as events off, for every spec example", () => {
  const heard: unknown[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const doc = load(f);
    const render = (extra: Record<string, unknown>) =>
      doc.surface.kind === "shell"
        ? renderToString(createElement(PolyxdFrame, { document: doc, theme: "material3", current: { key: "x", title: "Screen" }, ...extra }))
        : renderToString(createElement(PolyxdSurface, { document: doc, theme: "material3", ...extra }));
    assert.equal(render({ onEvent: (e: unknown) => heard.push(e), events: { sessionId: "s_ssr" } }), render({}), f);
  }
  assert.deepEqual(heard, [], "nothing is emitted on the server");
});
