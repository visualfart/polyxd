/**
 * The MCP App in a real browser, with this test playing the host: the view's HTML in a sandboxed
 * iframe, the MCP Apps handshake, the tool result, and an action coming back as `ui/message`.
 * Skipped when Playwright has no Chromium installed (`npx playwright install chromium`).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";
import { viewHTML, validate } from "../src/index.ts";
import { VERSION } from "../src/server.ts";

let browser: Browser | undefined;
before(async () => {
  browser = await chromium.launch().catch(() => undefined);
});
after(async () => browser?.close());

const archive = {
  specVersion: "0.3.0",
  surface: { id: "task", title: "Task", intent: "tasks.archive" },
  root: "card",
  components: [
    { id: "card", component: "Card", title: { path: "/task/title" }, children: ["archive"] },
    { id: "archive", component: "Action", label: "Archive task", emphasis: "primary", action: { event: { name: "task.archive", context: { id: { path: "/task/id" } } } } },
  ],
  data: { task: { id: "t1", title: "Buy milk" } },
};

/** A host page: the view in an iframe, answering `ui/initialize` and sending the tool's result once the view is initialized. */
async function host(page: Page, toolResult: unknown, hostContext: Record<string, unknown> = { theme: "light" }) {
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.evaluate(
    ({ html, toolResult, hostContext }) => {
      const w = window as any;
      w.received = [];
      const iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-scripts");
      iframe.style.cssText = "width:800px;height:600px;border:0";
      const reply = (msg: object) => iframe.contentWindow!.postMessage({ jsonrpc: "2.0", ...msg }, "*");
      window.addEventListener("message", (e) => {
        if (e.source !== iframe.contentWindow) return;
        const m = e.data;
        w.received.push(m);
        if (m.method === "ui/initialize") {
          reply({ id: m.id, result: { protocolVersion: "2026-01-26", hostInfo: { name: "test-host", version: "0.0.0" }, hostCapabilities: {}, hostContext } });
        } else if (m.method === "ui/notifications/initialized") {
          reply({ method: "ui/notifications/tool-input", params: { arguments: {} } });
          reply({ method: "ui/notifications/tool-result", params: toolResult });
        } else if (m.method === "ui/message") {
          reply({ id: m.id, result: {} });
        }
      });
      iframe.srcdoc = html;
      document.body.append(iframe);
    },
    { html: viewHTML(), toolResult, hostContext },
  );
  const frame = await (await page.waitForSelector("iframe")).contentFrame();
  return frame!;
}

const received = (page: Page) => page.evaluate(() => (window as any).received as any[]);

test("the view initializes per the MCP Apps spec, renders the shown document in its pack, and sends an action to the chat", async (t) => {
  if (!browser) return t.skip("Chromium is not installed for Playwright");
  assert.equal(validate(archive).valid, true, JSON.stringify(validate(archive).issues));
  const page = await browser.newPage();
  const frame = await host(page, {
    content: [{ type: "text", text: "Showing" }],
    structuredContent: { shown: true, document: archive, pack: "carbon", packName: "IBM Carbon" },
  });

  const button = await frame.waitForSelector("button:has-text('Archive task')");
  assert.equal(await frame.$eval(".pxd-surface", (el) => el.getAttribute("data-pxd-theme")), "carbon");
  assert.equal(await frame.$eval("html", (el) => el.getAttribute("data-pxd-mode")), "light");
  assert.ok(await frame.$("text=Buy milk"), "bound data is shown");

  const init = (await received(page)).find((m) => m.method === "ui/initialize");
  assert.equal(init.params.protocolVersion, "2026-01-26");
  assert.deepEqual(init.params.appInfo, { name: "Polyxd", version: VERSION });
  assert.deepEqual(init.params.appCapabilities, { availableDisplayModes: ["inline"] });
  assert.ok((await received(page)).some((m) => m.method === "ui/notifications/initialized"));

  await button.click();
  await page.waitForFunction(() => (window as any).received.some((m: any) => m.method === "ui/message"));
  const message = (await received(page)).find((m) => m.method === "ui/message");
  assert.equal(message.params.role, "user");
  assert.equal(message.params.content[0].type, "text");
  const text: string = message.params.content[0].text;
  assert.match(text, /"Archive task"/);
  assert.match(text, /action task\.archive/);
  assert.match(text, /"id":"t1"/);
  await frame.waitForSelector("#note:has-text('Sent to the chat')");

  const sizes = (await received(page)).filter((m) => m.method === "ui/notifications/size-changed");
  assert.ok(sizes.length > 0 && sizes.every((s) => s.params.width > 0 && s.params.height > 0), "reports its size");
  await page.close();
});

test("the view follows the host's dark theme, and a mode passed to polyxd_show overrides it", async (t) => {
  if (!browser) return t.skip("Chromium is not installed for Playwright");
  const page = await browser.newPage();
  let frame = await host(page, { content: [], structuredContent: { shown: true, document: archive, pack: "material3" } }, { theme: "dark" });
  await frame.waitForSelector(".pxd-surface");
  assert.equal(await frame.$eval(".pxd-surface", (el) => el.getAttribute("data-pxd-mode")), "dark");
  frame = await host(page, { content: [], structuredContent: { shown: true, document: archive, pack: "material3", mode: "light" } }, { theme: "dark" });
  await frame.waitForSelector(".pxd-surface");
  assert.equal(await frame.$eval(".pxd-surface", (el) => el.getAttribute("data-pxd-mode")), "light");
  await page.close();
});

test("a result with errors shows them instead of a screen", async (t) => {
  if (!browser) return t.skip("Chromium is not installed for Playwright");
  const page = await browser.newPage();
  const frame = await host(page, {
    isError: true,
    content: [{ type: "text", text: "Not shown." }],
    structuredContent: { shown: false, issues: [{ severity: "error", pointer: "/root", message: 'root "missing" is not a component id' }] },
  });
  await frame.waitForSelector("text=The document has errors");
  assert.ok(await frame.$('li:has-text("/root: root \\"missing\\" is not a component id")'));
  assert.equal(await frame.$(".pxd-surface"), null);
  await page.close();
});
