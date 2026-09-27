import { test } from "node:test";
import assert from "node:assert/strict";
import { currencySymbol, formatCount, formatPercent, formatValue, resolveFormat, safeColor, ROOT_SCOPE } from "../src/index.ts";

test("numbers, currency and percent follow the locale", () => {
  assert.equal(formatValue(2450.125, { type: "currency", currency: "GBP" }, "en-GB"), "£2,450.13");
  assert.equal(formatValue(2450.125, { type: "currency", currency: "EUR" }, "de-DE"), "2.450,13\u00a0€");
  assert.equal(formatValue(1234.5, { type: "number" }, "en-GB"), "1,234.5");
  assert.equal(formatValue(1234.5, { type: "number", precision: 2 }, "fr-FR"), "1 234,50".replace(" ", " "));
  assert.equal(formatValue(0.083, { type: "percent" }, "en-GB"), "8.3%");
  assert.equal(formatValue(0.083, { type: "percent", precision: 0 }, "en-GB"), "8%");
  assert.equal(formatValue("12", { type: "number" }, "en-GB"), "12");
});

test("dates and times are in UTC and the locale's style", () => {
  assert.equal(formatValue("2026-03-04T09:05:00Z", { type: "date" }, "en-GB"), "4 Mar 2026");
  assert.equal(formatValue("2026-03-04T09:05:00Z", { type: "date" }, "en-US"), "Mar 4, 2026");
  assert.equal(formatValue("2026-03-04T09:05:00Z", { type: "time" }, "en-GB"), "09:05");
  assert.equal(formatValue("2026-03-04T09:05:00Z", { type: "datetime" }, "en-GB"), "4 Mar 2026, 09:05");
});

test("relative time, duration and bytes read as people say them", () => {
  const now = Date.parse("2026-03-04T12:00:00Z");
  assert.equal(formatValue("2026-03-04T09:00:00Z", { type: "relativeTime" }, "en-GB", now), "3 hours ago");
  assert.equal(formatValue("2026-03-05T12:00:00Z", { type: "relativeTime" }, "en-GB", now), "tomorrow");
  assert.equal(formatValue("2026-03-04T11:59:40Z", { type: "relativeTime" }, "en-GB", now), "20 seconds ago");
  assert.equal(formatValue(90 * 60, { type: "duration" }, "en-GB"), "1 h 30 min");
  assert.equal(formatValue(25 * 60, { type: "duration" }, "en-GB"), "25 min");
  assert.equal(formatValue(1_200_000, { type: "bytes" }, "en-GB"), "1.2 MB");
  assert.equal(formatValue(512, { type: "bytes" }, "en-GB"), "512 B");
});

test("empty values are a dash; text joins lists; colours are the value itself", () => {
  assert.equal(formatValue(null, { type: "number" }, "en-GB"), "—");
  assert.equal(formatValue("", undefined, "en-GB"), "—");
  assert.equal(formatValue(["a", "b"], { type: "text" }, "en-GB"), "a, b");
  assert.equal(formatValue(" #fff ", { type: "color" }, "en-GB"), "#fff");
  assert.equal(formatValue("x", { type: "number" }, "en-GB"), "NaN");
});

test("a bound currency resolves before formatting; symbols come from the locale", () => {
  const f = resolveFormat({ type: "currency", currency: { path: "/account/currency" } }, { account: { currency: "JPY" } }, ROOT_SCOPE);
  assert.equal(f?.currency, "JPY");
  assert.equal(resolveFormat({ type: "number" }, {}, ROOT_SCOPE)?.type, "number");
  assert.equal(currencySymbol("GBP", "en-GB"), "£");
  assert.equal(currencySymbol("USD", "en-US"), "$");
  assert.equal(currencySymbol("nope", "en-GB"), "nope");
  assert.equal(formatCount(1204, "en-GB"), "1,204");
  assert.equal(formatPercent(0.42, "en-GB"), "42%");
});

test("only real CSS colours are painted as swatches", () => {
  assert.equal(safeColor("#0af"), "#0af");
  assert.equal(safeColor("rgb(1, 2, 3)"), "rgb(1, 2, 3)");
  assert.equal(safeColor("oklch(60% 0.1 200)"), "oklch(60% 0.1 200)");
  assert.equal(safeColor("url(x)"), undefined);
  assert.equal(safeColor("red; background: url(x)"), undefined);
});
