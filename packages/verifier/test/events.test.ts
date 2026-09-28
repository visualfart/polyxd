/**
 * Semantic events in a real browser: the same clicks and keys in the React and Web Components
 * harnesses emit the same events, each valid against the spec's schema/event.schema.json, and none
 * of them carries what was typed.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Browser, Page } from "playwright";
import { HARNESSES, launch, renderPage } from "../src/index.ts";
import { load } from "./helpers.ts";

const schema = JSON.parse(readFileSync(new URL("../../spec/schema/event.schema.json", import.meta.url), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
const TARGET = { theme: "material3", mode: "light" as const, width: 1100 };

let browser: Browser;
before(async () => (browser = await launch()));
after(async () => browser.close());

const events = (page: Page): Promise<any[]> => page.evaluate(() => (window as any).__pxdEvents ?? []);

/** What must match across renderers: everything but the clock and the random session id. */
const comparable = (list: any[]) => list.map(({ timestamp, sessionId, durationMs, ...rest }) => rest);

async function run(name: string, doc: unknown, script: (page: Page) => Promise<void>) {
  const out: Record<string, any[]> = {};
  for (const harness of [HARNESSES.react, HARNESSES.web]) {
    const { page, errors } = await renderPage(browser, doc, TARGET, harness);
    await script(page);
    const got = await events(page);
    await page.close();
    assert.deepEqual(errors, [], `${harness.name}: no runtime errors`);
    for (const e of got) assert.ok(validate(e), `${harness.name} ${name} ${e.type}: ${JSON.stringify(validate.errors)}`);
    assert.equal(new Set(got.map((e) => e.sessionId)).size, 1, `${harness.name}: one session`);
    out[harness.name!] = got;
  }
  assert.deepEqual(comparable(out.web), comparable(out.react), `${name}: both renderers emit the same events`);
  return out.react;
}

/** The parts of each event a person would read in a funnel: type, component, capability or reason, steps. */
const said = (list: any[]) => list.map((e) => [e.type, e.component?.id, e.capability ?? e.checkpoint ?? e.reason, e.steps].filter((x) => x !== undefined).join(" "));

test("a form: shown, a refused submit is input.error, then a valid submit completes", async () => {
  const got = await run("money-send-form", load("money-send-form"), async (page) => {
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: "Alex Kim" }).click();
    await page.getByLabel("Amount").pressSequentially("3791");
    await page.getByLabel("Reference").fill("Rent share");
    await page.getByRole("button", { name: "Continue" }).click();
  });
  assert.deepEqual(said(got), [
    "surface.shown",
    "input.error amount required 0",
    // Three fields, however many keys went into each, and the submit.
    "action.taken form transfer.review 4",
    "task.completed form transfer.review 4",
  ]);
  assert.deepEqual(got[1].component, { id: "amount", key: "amount", type: "TextInput" });
  assert.doesNotMatch(JSON.stringify(comparable(got)), /Rent share|3791|Alex/, "nothing typed or chosen is in an event");
});

test("a list with an undo: the Status shown, an action, then the undo", async () => {
  const got = await run("tasks-archive", load("tasks-archive"), async (page) => {
    await page.getByRole("button", { name: /Archive/ }).first().click();
    await page.getByRole("button", { name: "Undo" }).click();
  });
  assert.deepEqual(said(got), [
    "surface.shown",
    "status.shown archived undo 0",
    "action.taken archive task.archive 1",
    "action.taken undo-archive task.unarchive 2",
    "undo undo-archive task.unarchive 2",
  ]);
});

test("a root confirmation: Keep is ui.dismiss, so the surface is dismissed", async () => {
  const got = await run("settings-delete-account", load("settings-delete-account"), async (page) => {
    await page.getByRole("button", { name: "Keep my account" }).click();
  });
  assert.deepEqual(said(got), ["surface.shown", "surface.dismissed dismiss 0"]);
});

test("an error Status is status.shown with its kind; its retry is an action", async () => {
  const got = await run("error-load-failed", load("error-load-failed"), async (page) => {
    await page.getByRole("button").first().click();
  });
  assert.deepEqual(said(got).slice(0, 2), ["surface.shown", "status.shown root error 0"]);
  assert.equal(got[2].type, "action.taken");
});
